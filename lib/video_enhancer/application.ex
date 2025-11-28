defmodule VideoEnhancer.Application do
  @moduledoc """
  OTP Application for VideoEnhancer.

  Starts the job manager and other supervised processes.
  """

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Job state registry
      {Registry, keys: :unique, name: VideoEnhancer.JobRegistry},
      # Dynamic supervisor for job processes
      {DynamicSupervisor, strategy: :one_for_one, name: VideoEnhancer.JobSupervisor},
      # Job manager for tracking all jobs
      VideoEnhancer.JobManager
    ]

    opts = [strategy: :one_for_one, name: VideoEnhancer.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
