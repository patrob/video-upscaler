defmodule VideoEnhancer.NodeBridge do
  @moduledoc """
  Bridge module for communicating with Node.js scripts.

  Handles spawning Node processes, passing data via JSON,
  and collecting results.
  """

  require Logger

  @node_timeout 300_000  # 5 minutes for long operations

  @doc """
  Extract frames from a video file using FFmpeg via Node.js.
  """
  @spec extract_frames(String.t(), String.t(), integer()) :: {:ok, integer()} | {:error, term()}
  def extract_frames(input_path, output_dir, fps) do
    args = Jason.encode!(%{
      input: input_path,
      outputDir: output_dir,
      fps: fps
    })

    case run_node_script("js/extract_frames.js", [args]) do
      {:ok, %{"frameCount" => count}} ->
        {:ok, count}

      {:ok, %{"error" => error}} ->
        {:error, error}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Enhance a single frame using Ollama.
  """
  @spec enhance_frame(String.t(), String.t(), keyword()) :: {:ok, String.t()} | {:error, term()}
  def enhance_frame(input_path, output_path, opts) do
    args = Jason.encode!(%{
      input: input_path,
      output: output_path,
      model: Keyword.get(opts, :model, "llava"),
      prompt: Keyword.get(opts, :prompt, "Enhance this image"),
      strength: Keyword.get(opts, :strength, 0.7)
    })

    case run_node_script("js/enhance_frame.js", [args]) do
      {:ok, %{"output" => output}} ->
        {:ok, output}

      {:ok, %{"error" => error}} ->
        {:error, error}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Compute optical flow between two frames.
  """
  @spec compute_optical_flow(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def compute_optical_flow(prev_frame, curr_frame) do
    args = Jason.encode!(%{
      prevFrame: prev_frame,
      currFrame: curr_frame
    })

    case run_node_script("js/optical_flow.js", [args]) do
      {:ok, %{"flow" => flow_data}} ->
        {:ok, flow_data}

      {:ok, %{"error" => error}} ->
        {:error, error}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Apply temporal smoothing to a frame using optical flow.
  """
  @spec apply_temporal_smoothing(String.t(), String.t(), map(), float()) ::
          {:ok, String.t()} | {:error, term()}
  def apply_temporal_smoothing(current_frame, prev_enhanced, flow_data, blend_factor) do
    args = Jason.encode!(%{
      currentFrame: current_frame,
      prevEnhanced: prev_enhanced,
      flowData: flow_data,
      blendFactor: blend_factor
    })

    case run_node_script("js/temporal_smooth.js", [args]) do
      {:ok, %{"output" => output}} ->
        {:ok, output}

      {:ok, %{"error" => error}} ->
        {:error, error}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Assemble enhanced frames into a video.
  """
  @spec assemble_video(String.t(), String.t(), integer()) :: {:ok, String.t()} | {:error, term()}
  def assemble_video(frames_dir, output_path, fps) do
    args = Jason.encode!(%{
      framesDir: frames_dir,
      output: output_path,
      fps: fps
    })

    case run_node_script("js/assemble_video.js", [args]) do
      {:ok, %{"output" => output}} ->
        {:ok, output}

      {:ok, %{"error" => error}} ->
        {:error, error}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Process a batch of frames with enhancement and optional temporal smoothing.
  """
  @spec process_batch(list(map()), keyword()) :: {:ok, list(String.t())} | {:error, term()}
  def process_batch(frames, opts) do
    args = Jason.encode!(%{
      frames: frames,
      model: Keyword.get(opts, :model, "llava"),
      prompt: Keyword.get(opts, :prompt, "Enhance this image"),
      strength: Keyword.get(opts, :strength, 0.7),
      temporalSmoothing: Keyword.get(opts, :temporal_smoothing, true),
      temporalBlend: Keyword.get(opts, :temporal_blend, 0.3)
    })

    case run_node_script("js/process_batch.js", [args], @node_timeout * 2) do
      {:ok, %{"outputs" => outputs}} ->
        {:ok, outputs}

      {:ok, %{"error" => error}} ->
        {:error, error}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Run a Node.js script and parse JSON output
  defp run_node_script(script_path, args, timeout \\ @node_timeout) do
    # Get the project root directory
    project_root = File.cwd!()
    full_script_path = Path.join(project_root, script_path)

    unless File.exists?(full_script_path) do
      {:error, {:script_not_found, full_script_path}}
    else
      cmd_args = [full_script_path | args]

      Logger.debug("Running: node #{Enum.join(cmd_args, " ")}")

      case System.cmd("node", cmd_args, stderr_to_stdout: true, timeout: timeout) do
        {output, 0} ->
          parse_json_output(output)

        {output, code} ->
          Logger.error("Node script failed (exit #{code}): #{output}")
          {:error, {:node_exit, code, output}}
      end
    end
  rescue
    e ->
      Logger.error("Node script error: #{inspect(e)}")
      {:error, {:node_exception, e}}
  end

  defp parse_json_output(output) do
    # Find JSON in output (might have other log lines)
    output
    |> String.split("\n")
    |> Enum.reverse()
    |> Enum.find_value(fn line ->
      case Jason.decode(String.trim(line)) do
        {:ok, data} -> {:ok, data}
        _ -> nil
      end
    end)
    |> case do
      nil ->
        # Try parsing entire output
        case Jason.decode(String.trim(output)) do
          {:ok, data} -> {:ok, data}
          _ -> {:error, {:invalid_json, output}}
        end

      result ->
        result
    end
  end
end
