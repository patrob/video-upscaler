defmodule VideoEnhancer.FrameProcessor do
  @moduledoc """
  Frame processing with concurrent batch execution and temporal consistency.

  Handles the enhancement of individual frames while maintaining
  temporal coherence through optical flow and blending.
  """

  require Logger
  alias VideoEnhancer.NodeBridge

  @doc """
  Process a list of frames with concurrent batch processing.

  ## Parameters
  - `frames` - List of frame paths to process
  - `output_dir` - Directory to save enhanced frames
  - `opts` - Processing options (model, prompt, strength, etc.)
  - `progress_fn` - Callback function for progress updates
  - `batch_size` - Number of frames to process in parallel
  """
  @spec process_frames(
          list(String.t()),
          String.t(),
          keyword(),
          (integer() -> any()),
          integer()
        ) :: :ok | {:error, term()}
  def process_frames(frames, output_dir, opts, progress_fn, batch_size \\ 4) do
    total = length(frames)

    if total == 0 do
      :ok
    else
      # Process frames in order-preserving batches
      frames
      |> Enum.with_index()
      |> Enum.chunk_every(batch_size)
      |> Enum.reduce_while({:ok, 0, nil}, fn batch, {:ok, processed_count, prev_enhanced} ->
        case process_batch(batch, output_dir, opts, prev_enhanced) do
          {:ok, last_enhanced} ->
            new_count = processed_count + length(batch)
            progress_fn.(new_count)
            {:cont, {:ok, new_count, last_enhanced}}

          {:error, reason} ->
            {:halt, {:error, reason}}
        end
      end)
      |> case do
        {:ok, _, _} -> :ok
        {:error, reason} -> {:error, reason}
      end
    end
  end

  # Process a batch of frames
  defp process_batch(batch, output_dir, opts, prev_enhanced) do
    # Build frame info list for batch processing
    frame_infos =
      batch
      |> Enum.map(fn {frame_path, index} ->
        output_path = Path.join(output_dir, Path.basename(frame_path))

        %{
          input: frame_path,
          output: output_path,
          index: index
        }
      end)

    # Add previous enhanced frame reference for temporal smoothing
    frame_infos =
      if prev_enhanced && opts[:temporal_smoothing] do
        [first | rest] = frame_infos
        [Map.put(first, :prevEnhanced, prev_enhanced) | rest]
      else
        frame_infos
      end

    # Process batch through Node.js
    case NodeBridge.process_batch(frame_infos, opts) do
      {:ok, outputs} ->
        # Return last enhanced frame for temporal continuity
        last_output = List.last(outputs)
        {:ok, last_output}

      {:error, reason} ->
        # Fallback to sequential processing on batch failure
        Logger.warn("Batch processing failed, falling back to sequential: #{inspect(reason)}")
        process_sequential(frame_infos, opts, prev_enhanced)
    end
  end

  # Sequential fallback processing
  defp process_sequential(frame_infos, opts, prev_enhanced) do
    Enum.reduce_while(frame_infos, {:ok, prev_enhanced}, fn frame_info, {:ok, prev} ->
      # Add temporal reference
      frame_info =
        if prev && opts[:temporal_smoothing] do
          Map.put(frame_info, :prevEnhanced, prev)
        else
          frame_info
        end

      case process_single_frame(frame_info, opts) do
        {:ok, output} ->
          {:cont, {:ok, output}}

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
  end

  # Process a single frame with retries
  defp process_single_frame(frame_info, opts, retries \\ 3) do
    case NodeBridge.enhance_frame(frame_info.input, frame_info.output, opts) do
      {:ok, output} ->
        # Apply temporal smoothing if we have a previous frame
        if Map.has_key?(frame_info, :prevEnhanced) && opts[:temporal_smoothing] do
          apply_temporal_smoothing(
            output,
            frame_info.prevEnhanced,
            opts[:temporal_blend]
          )
        else
          {:ok, output}
        end

      {:error, reason} when retries > 0 ->
        Logger.warn("Frame enhancement failed, retrying (#{retries} left): #{inspect(reason)}")
        Process.sleep(1000)
        process_single_frame(frame_info, opts, retries - 1)

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Apply temporal smoothing between frames
  defp apply_temporal_smoothing(current_frame, prev_enhanced, blend_factor) do
    case NodeBridge.compute_optical_flow(prev_enhanced, current_frame) do
      {:ok, flow_data} ->
        NodeBridge.apply_temporal_smoothing(
          current_frame,
          prev_enhanced,
          flow_data,
          blend_factor
        )

      {:error, _reason} ->
        # If optical flow fails, just use the enhanced frame as-is
        {:ok, current_frame}
    end
  end
end
