# VideoEnhancer

AI-powered video enhancement tool that uses Ollama vision models and temporal consistency algorithms to upscale and enhance video quality.

## Features

- **AI-Powered Enhancement**: Uses Ollama vision models (llava) for intelligent frame enhancement
- **Temporal Consistency**: Optical flow-based smoothing prevents flickering between frames
- **Multiple Enhancement Models**: Realism, upscaling, denoising, sharpening, and cinematic modes
- **Parallel Processing**: Configurable batch processing for faster enhancement
- **Job Resumption**: Interrupted jobs can be resumed without losing progress
- **Per-Frame Caching**: Enhanced frames are cached to avoid reprocessing

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Elixir Backend                           │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │   CLI    │──│   Pipeline   │──│     Job Manager            │ │
│  └──────────┘  └──────────────┘  └────────────────────────────┘ │
│        │              │                      │                   │
│        │              ▼                      │                   │
│        │       ┌──────────────┐              │                   │
│        │       │ Node Bridge  │──────────────┘                   │
│        │       └──────────────┘                                  │
└────────┼──────────────┼─────────────────────────────────────────┘
         │              │
         ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Node.js Layer                               │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────┐   │
│  │Extract Frames │  │Enhance Frames │  │  Assemble Video    │   │
│  │   (FFmpeg)    │  │   (Ollama)    │  │     (FFmpeg)       │   │
│  └───────────────┘  └───────────────┘  └────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│              ┌─────────────────────────┐                        │
│              │   Temporal Smoothing    │                        │
│              │   (Optical Flow)        │                        │
│              └─────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
         │              │
         ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        External Services                         │
│  ┌─────────────┐                        ┌────────────────────┐  │
│  │   FFmpeg    │                        │      Ollama        │  │
│  │  (system)   │                        │   localhost:11434  │  │
│  └─────────────┘                        └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Requirements

- **Elixir** >= 1.14
- **Node.js** >= 18.0
- **FFmpeg** (installed and in PATH)
- **Ollama** with a vision model (e.g., llava)

## Installation

### 1. Install System Dependencies

```bash
# macOS
brew install elixir node ffmpeg

# Ubuntu/Debian
sudo apt install elixir nodejs npm ffmpeg

# Arch Linux
sudo pacman -S elixir nodejs npm ffmpeg
```

### 2. Install Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a vision model
ollama pull llava
```

### 3. Setup Project

```bash
# Clone and enter directory
cd video-upscaler

# Install Elixir dependencies
mix deps.get

# Install Node.js dependencies
cd js && npm install && cd ..

# Compile
mix compile
```

## Usage

### Basic Enhancement

```bash
# Enhance a video with default settings
mix enhance_video input.mp4 output.mp4

# Or using the compiled escript
./video_enhancer input.mp4 output.mp4
```

### With Options

```bash
# Use specific enhancement model
mix enhance_video input.mp4 output.mp4 --model cinematic

# Higher strength enhancement
mix enhance_video input.mp4 output.mp4 --strength 0.9

# Custom FPS and batch size
mix enhance_video input.mp4 output.mp4 --fps 30 --batch-size 8

# Disable temporal smoothing (faster but may flicker)
mix enhance_video input.mp4 output.mp4 --no-temporal

# Keep working files for inspection
mix enhance_video input.mp4 output.mp4 --no-clean

# Verbose logging
mix enhance_video input.mp4 output.mp4 --verbose
```

### Available Models

| Model | Description |
|-------|-------------|
| `realism` | Realistic enhancement with detail preservation (default) |
| `upscale` | Upscaling with detail enhancement |
| `denoise` | Noise reduction only |
| `sharpen` | Sharpening enhancement |
| `cinematic` | Cinematic color grading |

```bash
# List all available models
mix enhance_video --list-models
```

### Job Management

```bash
# Check status of a job
mix enhance_video --status job_abc123

# Cancel a running job
mix enhance_video --cancel job_abc123
```

## CLI Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--model` | `-m` | realism | Enhancement model to use |
| `--fps` | `-f` | 24 | Output framerate |
| `--batch-size` | `-b` | 4 | Parallel processing batch size |
| `--strength` | `-s` | 0.7 | Enhancement strength (0.0-1.0) |
| `--no-temporal` | | false | Disable temporal smoothing |
| `--no-clean` | | false | Keep working files |
| `--no-resume` | | false | Don't resume previous job |
| `--verbose` | `-v` | false | Enable verbose logging |
| `--list-models` | | | List available models |
| `--status` | | | Check job status |
| `--cancel` | | | Cancel a job |
| `--help` | `-h` | | Show help |

## Configuration

Configuration can be modified in `config/config.exs`:

```elixir
config :video_enhancer,
  # Ollama server
  ollama_host: "http://localhost:11434",

  # Processing defaults
  default_fps: 24,
  default_batch_size: 4,
  default_strength: 0.7,
  temporal_blend_factor: 0.3
```

### Environment Variables

```bash
# Custom Ollama host
export OLLAMA_HOST="http://192.168.1.100:11434"
```

## Pipeline Overview

1. **Frame Extraction**: FFmpeg extracts frames from input video at specified FPS
2. **Frame Enhancement**: Each frame is enhanced using Ollama vision model
3. **Temporal Smoothing**: Optical flow is computed between consecutive frames, and enhanced frames are blended for consistency
4. **Video Assembly**: Enhanced frames are reassembled into output video

### Temporal Consistency

The temporal smoothing algorithm:

1. Computes optical flow between consecutive frames using block matching
2. Warps the previous enhanced frame according to detected motion
3. Blends the warped previous frame with the current enhanced frame
4. Adjusts blend factor based on motion confidence

This prevents the "flickering" artifact common in frame-by-frame video enhancement.

## Project Structure

```
video-upscaler/
├── mix.exs                    # Elixir project config
├── config/
│   ├── config.exs             # Main configuration
│   ├── dev.exs                # Development config
│   └── prod.exs               # Production config
├── lib/
│   ├── video_enhancer.ex      # Main API module
│   └── video_enhancer/
│       ├── application.ex     # OTP Application
│       ├── cli.ex             # Command-line interface
│       ├── config.ex          # Configuration helper
│       ├── pipeline.ex        # Enhancement pipeline
│       ├── job_manager.ex     # Job state management
│       ├── frame_processor.ex # Frame processing logic
│       └── node_bridge.ex     # Node.js communication
├── js/
│   ├── package.json           # Node.js dependencies
│   ├── extract_frames.js      # FFmpeg extraction
│   ├── enhance_frame.js       # Ollama enhancement
│   ├── process_batch.js       # Batch processing
│   ├── optical_flow.js        # Motion detection
│   ├── temporal_smooth.js     # Frame blending
│   ├── assemble_video.js      # Video assembly
│   └── lib/
│       ├── ollama_client.js   # Ollama API client
│       └── temporal_smoother.js # Smoothing utilities
└── README.md
```

## Example: Processing a 5-Second Video

```bash
# Create a test video (requires ffmpeg)
ffmpeg -f lavfi -i testsrc=duration=5:size=640x480:rate=24 test_input.mp4

# Enhance with realism model
mix enhance_video test_input.mp4 test_output.mp4 --model realism --verbose

# Check progress
mix enhance_video --status job_xxxxxx
```

## Troubleshooting

### Ollama Not Running

```bash
# Start Ollama
ollama serve

# Verify it's running
curl http://localhost:11434/api/tags
```

### Model Not Found

```bash
# Pull the required model
ollama pull llava
```

### FFmpeg Not Found

```bash
# Verify FFmpeg is installed
ffmpeg -version

# Install if missing (macOS)
brew install ffmpeg
```

### Out of Memory

Reduce batch size to process fewer frames in parallel:

```bash
mix enhance_video input.mp4 output.mp4 --batch-size 1
```

## Performance Tips

1. **Batch Size**: Increase `--batch-size` for faster processing (requires more memory)
2. **GPU Acceleration**: Ensure Ollama is using GPU for faster enhancement
3. **FPS**: Lower FPS reduces frame count but may affect smoothness
4. **Strength**: Lower strength values process faster

## License

MIT License

## Contributing

Contributions welcome! Please read the contributing guidelines first.
