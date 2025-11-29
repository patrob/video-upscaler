defmodule VideoEnhancer do
  @moduledoc """
  VideoEnhancer - AI-powered video enhancement tool.

  This module provides the main API for enhancing videos using
  Ollama-based AI models with temporal consistency.

  ## Features
  - Frame extraction and reassembly via FFmpeg
  - AI-based frame enhancement via Ollama
  - Optical flow for temporal consistency
  - Parallel processing with configurable batch sizes
  - Job resumption for interrupted processing

  ## Usage

      # Enhance a video with default settings
      VideoEnhancer.enhance("input.mp4", "output.mp4")

      # Enhance with specific model
      VideoEnhancer.enhance("input.mp4", "output.mp4", model: "realism")

      # Enhance with custom options
      VideoEnhancer.enhance("input.mp4", "output.mp4",
        model: "cinematic",
        fps: 30,
        batch_size: 8,
        strength: 0.8
      )
  """

  alias VideoEnhancer.{Pipeline, JobManager, Config}

  @doc """
  Enhance a video file using AI-powered frame enhancement.

  ## Options
  - `:model` - Enhancement model to use (default: "realism")
  - `:fps` - Output framerate (default: 24)
  - `:batch_size` - Parallel processing batch size (default: 4)
  - `:strength` - Enhancement strength 0.0-1.0 (default: 0.7)
  - `:temporal_smoothing` - Enable temporal consistency (default: true)
  - `:clean` - Clean working files after completion (default: true)
  - `:resume` - Resume from previous job if available (default: true)

  ## Returns
  - `{:ok, output_path}` on success
  - `{:error, reason}` on failure
  """
  @spec enhance(String.t(), String.t(), keyword()) :: {:ok, String.t()} | {:error, term()}
  def enhance(input_path, output_path, opts \\ []) do
    opts = Config.merge_defaults(opts)

    with :ok <- validate_input(input_path),
         :ok <- validate_output_dir(output_path),
         {:ok, job} <- JobManager.create_or_resume(input_path, output_path, opts) do
      Pipeline.run(job)
    end
  end

  @doc """
  List available enhancement models.
  """
  @spec list_models() :: map()
  def list_models do
    Config.get(:models)
  end

  @doc """
  Get the status of a running or completed job.
  """
  @spec job_status(String.t()) :: {:ok, map()} | {:error, :not_found}
  def job_status(job_id) do
    JobManager.get_status(job_id)
  end

  @doc """
  Cancel a running job.
  """
  @spec cancel_job(String.t()) :: :ok | {:error, term()}
  def cancel_job(job_id) do
    JobManager.cancel(job_id)
  end

  @doc """
  Clean up working files for a job.
  """
  @spec cleanup(String.t()) :: :ok
  def cleanup(job_id) do
    JobManager.cleanup(job_id)
  end

  # Private functions

  defp validate_input(path) do
    cond do
      !File.exists?(path) ->
        {:error, {:input_not_found, path}}

      !video_file?(path) ->
        {:error, {:invalid_video_format, path}}

      true ->
        :ok
    end
  end

  defp validate_output_dir(path) do
    dir = Path.dirname(path)

    case File.mkdir_p(dir) do
      :ok -> :ok
      {:error, reason} -> {:error, {:output_dir_error, reason}}
    end
  end

  defp video_file?(path) do
    ext = path |> Path.extname() |> String.downcase()
    ext in [".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v", ".wmv", ".flv"]
  end
end
