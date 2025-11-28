defmodule VideoEnhancer.CLI do
  @moduledoc """
  Command-line interface for VideoEnhancer.

  Provides a CLI for enhancing videos with various options.

  ## Usage

      mix enhance_video input.mp4 output.mp4 [options]

  ## Options

      --model MODEL      Enhancement model (realism, upscale, denoise, sharpen, cinematic)
      --fps FPS          Output framerate (default: 24)
      --batch-size N     Parallel processing batch size (default: 4)
      --strength N       Enhancement strength 0.0-1.0 (default: 0.7)
      --no-temporal      Disable temporal smoothing
      --no-clean         Keep working files after completion
      --no-resume        Don't resume from previous job
      --verbose          Enable verbose logging
      --list-models      List available enhancement models
      --status JOB_ID    Check status of a job
      --cancel JOB_ID    Cancel a running job
      --help             Show this help message
  """

  alias VideoEnhancer.Config

  @doc """
  Main entry point for the CLI.
  """
  def main(args) do
    # Ensure application is started
    Application.ensure_all_started(:video_enhancer)

    args
    |> parse_args()
    |> run()
  end

  # Parse command line arguments
  defp parse_args(args) do
    {opts, positional, invalid} =
      OptionParser.parse(args,
        strict: [
          model: :string,
          fps: :integer,
          batch_size: :integer,
          strength: :float,
          temporal: :boolean,
          clean: :boolean,
          resume: :boolean,
          verbose: :boolean,
          list_models: :boolean,
          status: :string,
          cancel: :string,
          help: :boolean
        ],
        aliases: [
          m: :model,
          f: :fps,
          b: :batch_size,
          s: :strength,
          v: :verbose,
          h: :help
        ]
      )

    cond do
      opts[:help] -> :help
      opts[:list_models] -> :list_models
      opts[:status] -> {:status, opts[:status]}
      opts[:cancel] -> {:cancel, opts[:cancel]}
      length(invalid) > 0 -> {:error, {:invalid_options, invalid}}
      length(positional) < 2 -> {:error, :missing_arguments}
      true -> {:enhance, positional, normalize_opts(opts)}
    end
  end

  # Normalize options to internal format
  defp normalize_opts(opts) do
    opts
    |> Keyword.put(:temporal_smoothing, Keyword.get(opts, :temporal, true))
    |> Keyword.delete(:temporal)
  end

  # Run the appropriate command
  defp run(:help) do
    print_help()
  end

  defp run(:list_models) do
    print_models()
  end

  defp run({:status, job_id}) do
    check_status(job_id)
  end

  defp run({:cancel, job_id}) do
    cancel_job(job_id)
  end

  defp run({:error, :missing_arguments}) do
    IO.puts(:stderr, "Error: Missing input and/or output file arguments")
    IO.puts(:stderr, "")
    print_usage()
    System.halt(1)
  end

  defp run({:error, {:invalid_options, invalid}}) do
    IO.puts(:stderr, "Error: Invalid options: #{inspect(invalid)}")
    IO.puts(:stderr, "")
    print_usage()
    System.halt(1)
  end

  defp run({:enhance, [input, output | _], opts}) do
    print_banner()

    if opts[:verbose] do
      IO.puts("Input:  #{input}")
      IO.puts("Output: #{output}")
      IO.puts("Model:  #{opts[:model] || "realism"}")
      IO.puts("FPS:    #{opts[:fps] || 24}")
      IO.puts("")
    end

    case VideoEnhancer.enhance(input, output, opts) do
      {:ok, output_path} ->
        IO.puts("")
        IO.puts("✓ Enhancement complete!")
        IO.puts("  Output: #{output_path}")
        :ok

      {:error, {:input_not_found, path}} ->
        IO.puts(:stderr, "Error: Input file not found: #{path}")
        System.halt(1)

      {:error, {:invalid_video_format, path}} ->
        IO.puts(:stderr, "Error: Invalid video format: #{path}")
        System.halt(1)

      {:error, {:node_error, reason}} ->
        IO.puts(:stderr, "Error: Node.js processing failed: #{inspect(reason)}")
        System.halt(1)

      {:error, {:ollama_error, reason}} ->
        IO.puts(:stderr, "Error: Ollama enhancement failed: #{inspect(reason)}")
        IO.puts(:stderr, "Make sure Ollama is running: ollama serve")
        System.halt(1)

      {:error, reason} ->
        IO.puts(:stderr, "Error: #{inspect(reason)}")
        System.halt(1)
    end
  end

  defp print_banner do
    IO.puts("""

    ╔═══════════════════════════════════════════╗
    ║     VideoEnhancer - AI Video Enhancement  ║
    ╚═══════════════════════════════════════════╝
    """)
  end

  defp print_help do
    IO.puts("""

    VideoEnhancer - AI-powered video enhancement tool

    USAGE:
        mix enhance_video INPUT OUTPUT [OPTIONS]

    ARGUMENTS:
        INPUT               Input video file path
        OUTPUT              Output video file path

    OPTIONS:
        -m, --model MODEL   Enhancement model to use
                            Available: realism, upscale, denoise, sharpen, cinematic
                            Default: realism

        -f, --fps FPS       Output framerate (default: 24)

        -b, --batch-size N  Parallel processing batch size (default: 4)

        -s, --strength N    Enhancement strength 0.0-1.0 (default: 0.7)

        --no-temporal       Disable temporal consistency smoothing

        --no-clean          Keep working files after completion

        --no-resume         Start fresh, don't resume previous job

        -v, --verbose       Enable verbose logging

        --list-models       List available enhancement models

        --status JOB_ID     Check status of a running job

        --cancel JOB_ID     Cancel a running job

        -h, --help          Show this help message

    EXAMPLES:
        # Basic enhancement
        mix enhance_video input.mp4 output.mp4

        # Use specific model with higher strength
        mix enhance_video input.mp4 output.mp4 --model cinematic --strength 0.9

        # High FPS output with parallel processing
        mix enhance_video input.mp4 output.mp4 --fps 60 --batch-size 8

    REQUIREMENTS:
        - Node.js 18+
        - FFmpeg
        - Ollama with a vision model (e.g., llava)
    """)
  end

  defp print_usage do
    IO.puts("Usage: mix enhance_video INPUT OUTPUT [OPTIONS]")
    IO.puts("Run 'mix enhance_video --help' for more information")
  end

  defp print_models do
    IO.puts("")
    IO.puts("Available Enhancement Models:")
    IO.puts("─────────────────────────────")

    Config.get(:models, %{})
    |> Enum.each(fn {name, config} ->
      IO.puts("")
      IO.puts("  #{name}")
      IO.puts("    #{config.description}")
      IO.puts("    Ollama model: #{config.name}")
    end)

    IO.puts("")
  end

  defp check_status(job_id) do
    case VideoEnhancer.job_status(job_id) do
      {:ok, status} ->
        IO.puts("")
        IO.puts("Job Status: #{job_id}")
        IO.puts("─────────────────────────────")
        IO.puts("  State:    #{status.state}")
        IO.puts("  Progress: #{status.progress}%")
        IO.puts("  Frames:   #{status.processed_frames}/#{status.total_frames}")

        if status.error do
          IO.puts("  Error:    #{status.error}")
        end

        IO.puts("")

      {:error, :not_found} ->
        IO.puts(:stderr, "Error: Job not found: #{job_id}")
        System.halt(1)
    end
  end

  defp cancel_job(job_id) do
    case VideoEnhancer.cancel_job(job_id) do
      :ok ->
        IO.puts("Job cancelled: #{job_id}")

      {:error, reason} ->
        IO.puts(:stderr, "Error cancelling job: #{inspect(reason)}")
        System.halt(1)
    end
  end
end
