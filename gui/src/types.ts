export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  size: number;
}

export interface EnhancementOptions {
  inputPath: string;
  outputPath: string;
  model: string;
  strength: number;
  fps: number;
  batchSize: number;
  temporalBlend: number;
  enableTemporal: boolean;
}

export interface ProgressData {
  phase: string;
  progress: number;
  message: string;
}

export interface DependencyStatus {
  ffmpeg: boolean;
  ffprobe: boolean;
  ollama: boolean;
  elixir: boolean;
  node: boolean;
}

export interface Settings {
  model: string;
  strength: number;
  fps: number;
  batchSize: number;
  temporalBlend: number;
  enableTemporal: boolean;
}
