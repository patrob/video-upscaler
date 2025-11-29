import Config

# Test configuration
config :video_enhancer,
  log_level: :warn,
  verbose: false,
  # Use mock Ollama for testing
  ollama_host: "http://localhost:11434"
