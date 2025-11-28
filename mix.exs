defmodule VideoEnhancer.MixProject do
  use Mix.Project

  def project do
    [
      app: :video_enhancer,
      version: "0.1.0",
      elixir: "~> 1.14",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      escript: escript(),
      aliases: aliases()
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {VideoEnhancer.Application, []}
    ]
  end

  defp deps do
    [
      {:jason, "~> 1.4"},
      {:uuid, "~> 1.1"}
    ]
  end

  defp escript do
    [main_module: VideoEnhancer.CLI]
  end

  defp aliases do
    [
      enhance_video: ["run", "-e", "VideoEnhancer.CLI.main(System.argv())"]
    ]
  end
end
