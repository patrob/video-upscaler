defmodule VideoEnhancer.JobManager do
  @moduledoc """
  Manages enhancement jobs, including state persistence,
  resumption, and progress tracking.
  """

  use GenServer
  require Logger

  alias VideoEnhancer.Config

  @type job_state :: :pending | :extracting | :processing | :assembling | :completed | :failed | :cancelled
  @type job :: %{
          id: String.t(),
          input: String.t(),
          output: String.t(),
          opts: keyword(),
          state: job_state(),
          work_dir: String.t(),
          frames_dir: String.t(),
          enhanced_dir: String.t(),
          total_frames: non_neg_integer(),
          processed_frames: non_neg_integer(),
          start_time: DateTime.t(),
          error: term() | nil
        }

  # Client API

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @doc """
  Create a new job or resume an existing one.
  """
  @spec create_or_resume(String.t(), String.t(), keyword()) :: {:ok, job()} | {:error, term()}
  def create_or_resume(input, output, opts) do
    GenServer.call(__MODULE__, {:create_or_resume, input, output, opts})
  end

  @doc """
  Update job state.
  """
  @spec update_state(String.t(), job_state()) :: :ok
  def update_state(job_id, state) do
    GenServer.cast(__MODULE__, {:update_state, job_id, state})
  end

  @doc """
  Update job progress.
  """
  @spec update_progress(String.t(), non_neg_integer(), non_neg_integer()) :: :ok
  def update_progress(job_id, processed, total) do
    GenServer.cast(__MODULE__, {:update_progress, job_id, processed, total})
  end

  @doc """
  Get job status.
  """
  @spec get_status(String.t()) :: {:ok, map()} | {:error, :not_found}
  def get_status(job_id) do
    GenServer.call(__MODULE__, {:get_status, job_id})
  end

  @doc """
  Cancel a running job.
  """
  @spec cancel(String.t()) :: :ok | {:error, term()}
  def cancel(job_id) do
    GenServer.call(__MODULE__, {:cancel, job_id})
  end

  @doc """
  Mark job as failed with error.
  """
  @spec fail(String.t(), term()) :: :ok
  def fail(job_id, error) do
    GenServer.cast(__MODULE__, {:fail, job_id, error})
  end

  @doc """
  Mark job as completed.
  """
  @spec complete(String.t()) :: :ok
  def complete(job_id) do
    GenServer.cast(__MODULE__, {:complete, job_id})
  end

  @doc """
  Clean up job working files.
  """
  @spec cleanup(String.t()) :: :ok
  def cleanup(job_id) do
    GenServer.call(__MODULE__, {:cleanup, job_id})
  end

  @doc """
  Get job by ID.
  """
  @spec get_job(String.t()) :: {:ok, job()} | {:error, :not_found}
  def get_job(job_id) do
    GenServer.call(__MODULE__, {:get_job, job_id})
  end

  # Server callbacks

  @impl true
  def init(_) do
    # Load any persisted jobs on startup
    jobs = load_persisted_jobs()
    {:ok, %{jobs: jobs}}
  end

  @impl true
  def handle_call({:create_or_resume, input, output, opts}, _from, state) do
    job_id = generate_job_id(input, output)

    case Map.get(state.jobs, job_id) do
      nil ->
        # Create new job
        job = create_new_job(job_id, input, output, opts)
        persist_job(job)
        new_state = put_in(state, [:jobs, job_id], job)
        {:reply, {:ok, job}, new_state}

      existing_job when opts[:resume] ->
        # Resume existing job
        Logger.info("Resuming job #{job_id}")
        job = %{existing_job | opts: opts}
        {:reply, {:ok, job}, state}

      _existing_job ->
        # Start fresh
        job = create_new_job(job_id, input, output, opts)
        cleanup_job_files(job)
        persist_job(job)
        new_state = put_in(state, [:jobs, job_id], job)
        {:reply, {:ok, job}, new_state}
    end
  end

  @impl true
  def handle_call({:get_status, job_id}, _from, state) do
    case Map.get(state.jobs, job_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      job ->
        status = %{
          state: job.state,
          progress: calculate_progress(job),
          processed_frames: job.processed_frames,
          total_frames: job.total_frames,
          error: job.error
        }

        {:reply, {:ok, status}, state}
    end
  end

  @impl true
  def handle_call({:get_job, job_id}, _from, state) do
    case Map.get(state.jobs, job_id) do
      nil -> {:reply, {:error, :not_found}, state}
      job -> {:reply, {:ok, job}, state}
    end
  end

  @impl true
  def handle_call({:cancel, job_id}, _from, state) do
    case Map.get(state.jobs, job_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      job ->
        job = %{job | state: :cancelled}
        new_state = put_in(state, [:jobs, job_id], job)
        persist_job(job)
        {:reply, :ok, new_state}
    end
  end

  @impl true
  def handle_call({:cleanup, job_id}, _from, state) do
    case Map.get(state.jobs, job_id) do
      nil ->
        {:reply, :ok, state}

      job ->
        cleanup_job_files(job)
        new_state = %{state | jobs: Map.delete(state.jobs, job_id)}
        delete_persisted_job(job_id)
        {:reply, :ok, new_state}
    end
  end

  @impl true
  def handle_cast({:update_state, job_id, new_state}, state) do
    case Map.get(state.jobs, job_id) do
      nil ->
        {:noreply, state}

      job ->
        job = %{job | state: new_state}
        persist_job(job)
        new_state = put_in(state, [:jobs, job_id], job)
        {:noreply, new_state}
    end
  end

  @impl true
  def handle_cast({:update_progress, job_id, processed, total}, state) do
    case Map.get(state.jobs, job_id) do
      nil ->
        {:noreply, state}

      job ->
        job = %{job | processed_frames: processed, total_frames: total}
        persist_job(job)
        new_state = put_in(state, [:jobs, job_id], job)
        {:noreply, new_state}
    end
  end

  @impl true
  def handle_cast({:fail, job_id, error}, state) do
    case Map.get(state.jobs, job_id) do
      nil ->
        {:noreply, state}

      job ->
        job = %{job | state: :failed, error: error}
        persist_job(job)
        new_state = put_in(state, [:jobs, job_id], job)
        {:noreply, new_state}
    end
  end

  @impl true
  def handle_cast({:complete, job_id}, state) do
    case Map.get(state.jobs, job_id) do
      nil ->
        {:noreply, state}

      job ->
        job = %{job | state: :completed}
        persist_job(job)
        new_state = put_in(state, [:jobs, job_id], job)
        {:noreply, new_state}
    end
  end

  # Private functions

  defp generate_job_id(input, output) do
    hash =
      :crypto.hash(:md5, "#{input}:#{output}")
      |> Base.encode16(case: :lower)
      |> String.slice(0, 8)

    "job_#{hash}"
  end

  defp create_new_job(job_id, input, output, opts) do
    work_dir = Path.join(Config.work_dir(), job_id)
    frames_dir = Path.join(work_dir, "frames")
    enhanced_dir = Path.join(work_dir, "enhanced")

    # Create directories
    File.mkdir_p!(frames_dir)
    File.mkdir_p!(enhanced_dir)

    %{
      id: job_id,
      input: Path.expand(input),
      output: Path.expand(output),
      opts: opts,
      state: :pending,
      work_dir: work_dir,
      frames_dir: frames_dir,
      enhanced_dir: enhanced_dir,
      total_frames: 0,
      processed_frames: 0,
      start_time: DateTime.utc_now(),
      error: nil
    }
  end

  defp calculate_progress(%{total_frames: 0}), do: 0

  defp calculate_progress(%{processed_frames: processed, total_frames: total}) do
    round(processed / total * 100)
  end

  defp cleanup_job_files(job) do
    if File.exists?(job.work_dir) do
      File.rm_rf!(job.work_dir)
    end
  end

  defp persist_job(job) do
    cache_dir = Config.cache_dir()
    File.mkdir_p!(cache_dir)

    path = Path.join(cache_dir, "#{job.id}.json")

    job_data = %{
      id: job.id,
      input: job.input,
      output: job.output,
      state: job.state,
      work_dir: job.work_dir,
      frames_dir: job.frames_dir,
      enhanced_dir: job.enhanced_dir,
      total_frames: job.total_frames,
      processed_frames: job.processed_frames,
      start_time: DateTime.to_iso8601(job.start_time),
      error: job.error
    }

    File.write!(path, Jason.encode!(job_data, pretty: true))
  end

  defp load_persisted_jobs do
    cache_dir = Config.cache_dir()

    if File.exists?(cache_dir) do
      cache_dir
      |> File.ls!()
      |> Enum.filter(&String.ends_with?(&1, ".json"))
      |> Enum.map(fn file ->
        path = Path.join(cache_dir, file)

        case File.read(path) do
          {:ok, content} ->
            case Jason.decode(content) do
              {:ok, data} -> {data["id"], deserialize_job(data)}
              _ -> nil
            end

          _ ->
            nil
        end
      end)
      |> Enum.reject(&is_nil/1)
      |> Map.new()
    else
      %{}
    end
  end

  defp deserialize_job(data) do
    %{
      id: data["id"],
      input: data["input"],
      output: data["output"],
      opts: [],
      state: String.to_atom(data["state"]),
      work_dir: data["work_dir"],
      frames_dir: data["frames_dir"],
      enhanced_dir: data["enhanced_dir"],
      total_frames: data["total_frames"],
      processed_frames: data["processed_frames"],
      start_time: DateTime.from_iso8601(data["start_time"]) |> elem(1),
      error: data["error"]
    }
  end

  defp delete_persisted_job(job_id) do
    path = Path.join(Config.cache_dir(), "#{job_id}.json")

    if File.exists?(path) do
      File.rm!(path)
    end
  end
end
