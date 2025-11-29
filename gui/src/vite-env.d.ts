/// <reference types="vite/client" />

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  size: number;
}

interface EnhancementOptions {
  inputPath: string;
  outputPath: string;
  model: string;
  strength: number;
  fps: number;
  batchSize: number;
  temporalBlend: number;
  enableTemporal: boolean;
}

interface ProgressData {
  phase: string;
  progress: number;
  message: string;
}

interface DependencyStatus {
  ffmpeg: boolean;
  ffprobe: boolean;
  ollama: boolean;
  elixir: boolean;
  node: boolean;
}

interface ElectronAPI {
  selectInputFile: () => Promise<string | null>;
  selectOutputFile: () => Promise<string | null>;
  getVideoInfo: (filePath: string) => Promise<VideoInfo>;
  startEnhancement: (options: EnhancementOptions) => Promise<{ started: boolean }>;
  cancelEnhancement: () => Promise<{ cancelled: boolean }>;
  openFileLocation: (filePath: string) => Promise<void>;
  checkDependencies: () => Promise<DependencyStatus>;
  onProgress: (callback: (data: ProgressData) => void) => () => void;
  onLog: (callback: (message: string) => void) => () => void;
  onComplete: (callback: (result: { success: boolean; code: number }) => void) => () => void;
  onError: (callback: (error: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {}
