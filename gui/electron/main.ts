import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let currentProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#18181b',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers

ipcMain.handle('select-input-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv'] }
    ]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-output-file', async () => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [
      { name: 'MP4 Video', extensions: ['mp4'] }
    ],
    defaultPath: 'enhanced_video.mp4'
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('get-video-info', async (_event, filePath: string) => {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(output);
          const videoStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
          resolve({
            duration: parseFloat(info.format?.duration || '0'),
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            fps: eval(videoStream?.r_frame_rate || '0') || 0,
            codec: videoStream?.codec_name || 'unknown',
            size: parseInt(info.format?.size || '0', 10),
          });
        } catch {
          reject(new Error('Failed to parse video info'));
        }
      } else {
        reject(new Error('ffprobe failed'));
      }
    });
  });
});

ipcMain.handle('start-enhancement', async (_event, options: {
  inputPath: string;
  outputPath: string;
  model: string;
  strength: number;
  fps: number;
  batchSize: number;
  temporalBlend: number;
  enableTemporal: boolean;
}) => {
  const projectRoot = path.resolve(__dirname, '../../..');

  const args = [
    'enhance_video',
    options.inputPath,
    options.outputPath,
    '--model', options.model,
    '--strength', options.strength.toString(),
    '--fps', options.fps.toString(),
    '--batch-size', options.batchSize.toString(),
    '--temporal-blend', options.temporalBlend.toString(),
    '--verbose'
  ];

  if (!options.enableTemporal) {
    args.push('--no-temporal');
  }

  currentProcess = spawn('mix', args, {
    cwd: projectRoot,
    env: { ...process.env },
  });

  currentProcess.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    mainWindow?.webContents.send('enhancement-progress', parseProgress(text));
  });

  currentProcess.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    mainWindow?.webContents.send('enhancement-log', text);
  });

  currentProcess.on('close', (code: number | null) => {
    mainWindow?.webContents.send('enhancement-complete', {
      success: code === 0,
      code
    });
    currentProcess = null;
  });

  currentProcess.on('error', (error: Error) => {
    mainWindow?.webContents.send('enhancement-error', error.message);
    currentProcess = null;
  });

  return { started: true };
});

ipcMain.handle('cancel-enhancement', async () => {
  if (currentProcess) {
    currentProcess.kill('SIGTERM');
    currentProcess = null;
    return { cancelled: true };
  }
  return { cancelled: false };
});

ipcMain.handle('open-file-location', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('check-dependencies', async () => {
  const checks = {
    ffmpeg: await checkCommand('ffmpeg', ['-version']),
    ffprobe: await checkCommand('ffprobe', ['-version']),
    ollama: await checkCommand('ollama', ['--version']),
    elixir: await checkCommand('elixir', ['--version']),
    node: await checkCommand('node', ['--version']),
  };
  return checks;
});

async function checkCommand(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(command, args);
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

function parseProgress(text: string): { phase: string; progress: number; message: string } {
  // Parse progress from CLI output
  const progressMatch = text.match(/\[(\d+)\/(\d+)\]/);
  const phaseMatch = text.match(/(Extracting|Processing|Assembling)/i);

  let phase = 'Initializing';
  let progress = 0;

  if (phaseMatch) {
    phase = phaseMatch[1];
  }

  if (progressMatch) {
    const current = parseInt(progressMatch[1], 10);
    const total = parseInt(progressMatch[2], 10);
    progress = Math.round((current / total) * 100);
  }

  // Check for percentage in text
  const percentMatch = text.match(/(\d+)%/);
  if (percentMatch) {
    progress = parseInt(percentMatch[1], 10);
  }

  return { phase, progress, message: text.trim() };
}
