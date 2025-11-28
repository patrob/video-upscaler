defmodule VideoEnhancer.Pipeline do
  @moduledoc """
  Main enhancement pipeline orchestration.

  Coordinates the full enhancement workflow:
  1. Extract frames from input video
  2. Process frames in parallel batches
  3. Assemble enhanced frames into output video
  """

  require Logger
  alias VideoEnhancer.{JobManager, NodeBridge, FrameProcessor, Config}

  @doc """
  Run the enhancement pipeline for a job.
  """
  @spec run(map()) :: {:ok, String.t()} | {:error, term()}
  def run(job) do
    Logger.info("Starting enhancement pipeline for job #{job.id}")
    print_progress_header(job)

    with {:ok, job} <- extract_frames(job),
         {:ok, job} <- process_frames(job),
         {:ok, output_path} <- assemble_video(job) do
      JobManager.complete(job.id)

      # Clean up if requested
      if job.opts[:clean] do
        JobManager.cleanup(job.id)
      end

      {:ok, output_path}
    else
      {:error, reason} = error ->
        JobManager.fail(job.id, reason)
        error
    end
  end

  # Phase 1: Extract frames from video
  defp extract_frames(job) do
    Logger.info("Phase 1: Extracting frames")
    JobManager.update_state(job.id, :extracting)

    # Check if frames already exist (for resume)
    existing_frames = count_frames(job.frames_dir)

    if existing_frames > 0 and job.opts[:resume] do
      Logger.info("Found #{existing_frames} existing frames, resuming...")
      job = %{job | total_frames: existing_frames}
      JobManager.update_progress(job.id, 0, existing_frames)
      {:ok, job}
    else
      # Extract frames using Node.js script
      case NodeBridge.extract_frames(job.input, job.frames_dir, job.opts[:fps]) do
        {:ok, frame_count} ->
          Logger.info("Extracted #{frame_count} frames")
          job = %{job | total_frames: frame_count}
          JobManager.update_progress(job.id, 0, frame_count)
          {:ok, job}

        {:error, reason} ->
          {:error, {:extraction_failed, reason}}
      end
    end
  end

  # Phase 2: Process/enhance frames
  defp process_frames(job) do
    Logger.info("Phase 2: Processing frames")
    JobManager.update_state(job.id, :processing)

    # Get list of frames to process
    frames = list_frames(job.frames_dir)

    if length(frames) == 0 do
      {:error, :no_frames_found}
    else
      # Find already processed frames for resume
      processed = list_frames(job.enhanced_dir) |> MapSet.new(&Path.basename/1)
      to_process = Enum.reject(frames, &(Path.basename(&1) in processed))

      Logger.info("#{length(to_process)} frames to process (#{MapSet.size(processed)} already done)")

      # Get model configuration
      {:ok, model_config} = Config.get_model(job.opts[:model])

      opts = [
        model: model_config.name,
        prompt: model_config.prompt,
        strength: job.opts[:strength],
        temporal_smoothing: job.opts[:temporal_smoothing],
        temporal_blend: job.opts[:temporal_blend]
      ]

      # Process frames in batches
      result =
        FrameProcessor.process_frames(
          to_process,
          job.enhanced_dir,
          opts,
          fn processed_count ->
            total_processed = MapSet.size(processed) + processed_count
            progress = round(total_processed / job.total_frames * 100)
            print_progress_bar(progress, total_processed, job.total_frames)
            JobManager.update_progress(job.id, total_processed, job.total_frames)
          end,
          job.opts[:batch_size]
        )

      case result do
        :ok ->
          IO.puts("")  # New line after progress bar
          {:ok, job}

        {:error, reason} ->
          {:error, {:processing_failed, reason}}
      end
    end
  end

  # Phase 3: Assemble output video
  defp assemble_video(job) do
    Logger.info("Phase 3: Assembling output video")
    JobManager.update_state(job.id, :assembling)

    case NodeBridge.assemble_video(job.enhanced_dir, job.output, job.opts[:fps]) do
      {:ok, output_path} ->
        Logger.info("Video assembled: #{output_path}")
        {:ok, output_path}

      {:error, reason} ->
        {:error, {:assembly_failed, reason}}
    end
  end

  # Helper functions

  defp count_frames(dir) do
    if File.exists?(dir) do
      dir
      |> File.ls!()
      |> Enum.count(&String.ends_with?(&1, ".png"))
    else
      0
    end
  end

  defp list_frames(dir) do
    if File.exists?(dir) do
      dir
      |> File.ls!()
      |> Enum.filter(&String.ends_with?(&1, ".png"))
      |> Enum.sort()
      |> Enum.map(&Path.join(dir, &1))
    else
      []
    end
  end

  defp print_progress_header(job) do
    IO.puts("Job ID:     #{job.id}")
    IO.puts("Input:      #{job.input}")
    IO.puts("Output:     #{job.output}")
    IO.puts("Model:      #{job.opts[:model]}")
    IO.puts("Batch size: #{job.opts[:batch_size]}")
    IO.puts("")
  end

  defp print_progress_bar(percent, current, total) do
    bar_width = 40
    filled = round(bar_width * percent / 100)
    empty = bar_width - filled

    bar = String.duplicate("█", filled) <> String.duplicate("░", empty)
    IO.write("\r  [#{bar}] #{percent}% (#{current}/#{total})")
  end
end
