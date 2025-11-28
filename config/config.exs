import Config

# VideoEnhancer Configuration
config :video_enhancer,
  # Ollama server configuration
  ollama_host: System.get_env("OLLAMA_HOST", "http://localhost:11434"),

  # Available enhancement models
  models: %{
    "realism" => %{
      name: "llava",
      prompt: "Enhance this image. Keep structure identical. Improve realism, detail, and clarity. Do NOT change shapes, objects, or composition. Maintain exact colors and lighting balance.",
      description: "Realistic enhancement with detail preservation"
    },
    "upscale" => %{
      name: "llava",
      prompt: "Upscale and enhance this image. Preserve all details exactly. Increase sharpness and clarity. Do NOT alter content, colors, or structure.",
      description: "Upscaling with detail enhancement"
    },
    "denoise" => %{
      name: "llava",
      prompt: "Remove noise and grain from this image. Keep all details and structure exactly the same. Only reduce noise artifacts.",
      description: "Noise reduction only"
    },
    "sharpen" => %{
      name: "llava",
      prompt: "Sharpen this image. Enhance edge clarity. Keep all content exactly the same. Do NOT change colors or add details.",
      description: "Sharpening enhancement"
    },
    "cinematic" => %{
      name: "llava",
      prompt: "Enhance this image with cinematic quality. Improve color grading subtly. Enhance contrast and detail. Keep all content and composition identical.",
      description: "Cinematic color grading"
    }
  },

  # Default processing settings
  default_fps: 24,
  default_batch_size: 4,
  default_strength: 0.7,
  temporal_blend_factor: 0.3,

  # Node.js script paths (relative to project root)
  node_scripts: %{
    extract: "js/extract_frames.js",
    enhance: "js/enhance_frame.js",
    optical_flow: "js/optical_flow.js",
    assemble: "js/assemble_video.js"
  },

  # Working directories
  work_dir: ".video_enhancer_work",
  cache_dir: ".video_enhancer_cache"

# Environment-specific configuration
import_config "#{config_env()}.exs"
