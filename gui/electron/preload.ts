import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

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

const electronAPI = {
  selectInputFile: (): Promise<string | null> =>
    ipcRenderer.invoke('select-input-file'),

  selectOutputFile: (): Promise<string | null> =>
    ipcRenderer.invoke('select-output-file'),

  getVideoInfo: (filePath: string): Promise<VideoInfo> =>
    ipcRenderer.invoke('get-video-info', filePath),

  startEnhancement: (options: EnhancementOptions): Promise<{ started: boolean }> =>
    ipcRenderer.invoke('start-enhancement', options),

  cancelEnhancement: (): Promise<{ cancelled: boolean }> =>
    ipcRenderer.invoke('cancel-enhancement'),

  openFileLocation: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('open-file-location', filePath),

  checkDependencies: (): Promise<DependencyStatus> =>
    ipcRenderer.invoke('check-dependencies'),

  onProgress: (callback: (data: ProgressData) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: ProgressData) => callback(data);
    ipcRenderer.on('enhancement-progress', handler);
    return () => ipcRenderer.removeListener('enhancement-progress', handler);
  },

  onLog: (callback: (message: string) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on('enhancement-log', handler);
    return () => ipcRenderer.removeListener('enhancement-log', handler);
  },

  onComplete: (callback: (result: { success: boolean; code: number }) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, result: { success: boolean; code: number }) => callback(result);
    ipcRenderer.on('enhancement-complete', handler);
    return () => ipcRenderer.removeListener('enhancement-complete', handler);
  },

  onError: (callback: (error: string) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on('enhancement-error', handler);
    return () => ipcRenderer.removeListener('enhancement-error', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
