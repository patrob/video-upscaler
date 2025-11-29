defmodule VideoEnhancer.Config do
  @moduledoc """
  Configuration management for VideoEnhancer.

  Provides access to application configuration with defaults
  and validation.
  """

  @default_opts [
    model: "realism",
    fps: 24,
    batch_size: 4,
    strength: 0.7,
    temporal_smoothing: true,
    temporal_blend: 0.3,
    clean: true,
    resume: true,
    verbose: false
  ]

  @doc """
  Get a configuration value.
  """
  @spec get(atom(), term()) :: term()
  def get(key, default \\ nil) do
    Application.get_env(:video_enhancer, key, default)
  end

  @doc """
  Merge user options with defaults.
  """
  @spec merge_defaults(keyword()) :: keyword()
  def merge_defaults(opts) do
    @default_opts
    |> Keyword.merge(opts)
    |> validate_opts()
  end

  @doc """
  Get model configuration by name.
  """
  @spec get_model(String.t()) :: {:ok, map()} | {:error, :unknown_model}
  def get_model(name) do
    models = get(:models, %{})

    case Map.get(models, name) do
      nil -> {:error, :unknown_model}
      config -> {:ok, config}
    end
  end

  @doc """
  Get the Ollama API host URL.
  """
  @spec ollama_host() :: String.t()
  def ollama_host do
    get(:ollama_host, "http://localhost:11434")
  end

  @doc """
  Get working directory path.
  """
  @spec work_dir() :: String.t()
  def work_dir do
    get(:work_dir, ".video_enhancer_work")
  end

  @doc """
  Get cache directory path.
  """
  @spec cache_dir() :: String.t()
  def cache_dir do
    get(:cache_dir, ".video_enhancer_cache")
  end

  @doc """
  Get node script path.
  """
  @spec node_script(atom()) :: String.t()
  def node_script(name) do
    scripts = get(:node_scripts, %{})
    Map.get(scripts, name)
  end

  # Private functions

  defp validate_opts(opts) do
    opts
    |> validate_model()
    |> validate_fps()
    |> validate_strength()
    |> validate_batch_size()
  end

  defp validate_model(opts) do
    model = Keyword.get(opts, :model)
    models = get(:models, %{})

    if Map.has_key?(models, model) do
      opts
    else
      IO.warn("Unknown model '#{model}', falling back to 'realism'")
      Keyword.put(opts, :model, "realism")
    end
  end

  defp validate_fps(opts) do
    fps = Keyword.get(opts, :fps)

    cond do
      fps < 1 -> Keyword.put(opts, :fps, 1)
      fps > 120 -> Keyword.put(opts, :fps, 120)
      true -> opts
    end
  end

  defp validate_strength(opts) do
    strength = Keyword.get(opts, :strength)

    cond do
      strength < 0.0 -> Keyword.put(opts, :strength, 0.0)
      strength > 1.0 -> Keyword.put(opts, :strength, 1.0)
      true -> opts
    end
  end

  defp validate_batch_size(opts) do
    batch_size = Keyword.get(opts, :batch_size)

    cond do
      batch_size < 1 -> Keyword.put(opts, :batch_size, 1)
      batch_size > 32 -> Keyword.put(opts, :batch_size, 32)
      true -> opts
    end
  end
end
