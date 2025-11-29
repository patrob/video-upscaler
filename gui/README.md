# Video Enhancer GUI

A native-looking desktop application for AI-powered video enhancement.

## Prerequisites

Make sure you have the following installed:

- Node.js 18+
- FFmpeg
- Ollama (with llava model)
- Elixir 1.14+ (for the backend)

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package as desktop app
npm run package
```

## Features

- **Drag & Drop** - Simply drop a video file to start
- **Multiple Models** - Choose from Realism, Upscale, Denoise, Sharpen, or Cinematic
- **Real-time Progress** - Watch the enhancement progress with live logs
- **Temporal Smoothing** - Reduce flickering between frames
- **Native Look** - Clean, modern interface that feels at home on your system

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Electron** - Desktop wrapper
- **Tailwind CSS** - Styling
- **Vite** - Build tool
