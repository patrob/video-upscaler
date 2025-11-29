import { FileVideo, FolderOpen, Clock, Maximize, Gauge } from 'lucide-react'
import clsx from 'clsx'
import type { VideoInfo, Settings } from '../types'

interface SettingsPanelProps {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  videoInfo: VideoInfo | null
  inputPath: string | null
  outputPath: string | null
  onBrowseOutput: () => void
  disabled: boolean
}

const MODELS = [
  { id: 'realism', name: 'Realism', description: 'Balanced enhancement' },
  { id: 'upscale', name: 'Upscale', description: 'Resolution improvement' },
  { id: 'denoise', name: 'Denoise', description: 'Noise reduction' },
  { id: 'sharpen', name: 'Sharpen', description: 'Edge clarity' },
  { id: 'cinematic', name: 'Cinematic', description: 'Color grading' },
]

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileName(path: string): string {
  return path.split('/').pop() || path
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  videoInfo,
  inputPath,
  outputPath,
  onBrowseOutput,
  disabled,
}: SettingsPanelProps) {
  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="glass rounded-xl p-5 space-y-5">
      {/* Video Info */}
      {videoInfo && inputPath && (
        <div className="flex items-start gap-4 pb-4 border-b border-surface-700/50">
          <div className="w-12 h-12 rounded-lg bg-surface-800 flex items-center justify-center flex-shrink-0">
            <FileVideo className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-surface-100 truncate" title={inputPath}>
              {getFileName(inputPath)}
            </h3>
            <div className="flex items-center gap-4 mt-1 text-xs text-surface-400">
              <span className="flex items-center gap-1">
                <Maximize className="w-3 h-3" />
                {videoInfo.width}×{videoInfo.height}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(videoInfo.duration)}
              </span>
              <span className="flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                {Math.round(videoInfo.fps)} fps
              </span>
              <span>{formatFileSize(videoInfo.size)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Output Path */}
      <div>
        <label className="block text-xs font-medium text-surface-400 mb-2">
          Output File
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={outputPath || ''}
            readOnly
            className={clsx(
              'flex-1 px-3 py-2 rounded-lg text-sm',
              'bg-surface-800 border border-surface-700',
              'text-surface-200 placeholder-surface-500',
              'focus:outline-none focus:border-accent'
            )}
            placeholder="Select output location..."
          />
          <button
            type="button"
            onClick={onBrowseOutput}
            disabled={disabled}
            className={clsx(
              'px-3 py-2 rounded-lg',
              'bg-surface-800 hover:bg-surface-700 border border-surface-700',
              'text-surface-300 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-xs font-medium text-surface-400 mb-2">
          Enhancement Model
        </label>
        <div className="grid grid-cols-5 gap-2">
          {MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => updateSetting('model', model.id)}
              disabled={disabled}
              className={clsx(
                'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                settings.model === model.id
                  ? 'bg-accent text-white'
                  : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
              )}
              title={model.description}
            >
              {model.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-4">
        <SliderInput
          label="Strength"
          value={settings.strength}
          onChange={(v) => updateSetting('strength', v)}
          min={0}
          max={1}
          step={0.1}
          format={(v) => `${Math.round(v * 100)}%`}
          disabled={disabled}
        />
        <SliderInput
          label="Output FPS"
          value={settings.fps}
          onChange={(v) => updateSetting('fps', v)}
          min={1}
          max={60}
          step={1}
          format={(v) => `${v}`}
          disabled={disabled}
        />
        <SliderInput
          label="Batch Size"
          value={settings.batchSize}
          onChange={(v) => updateSetting('batchSize', v)}
          min={1}
          max={16}
          step={1}
          format={(v) => `${v}`}
          disabled={disabled}
        />
        <SliderInput
          label="Temporal Blend"
          value={settings.temporalBlend}
          onChange={(v) => updateSetting('temporalBlend', v)}
          min={0}
          max={1}
          step={0.1}
          format={(v) => `${Math.round(v * 100)}%`}
          disabled={disabled || !settings.enableTemporal}
        />
      </div>

      {/* Temporal Smoothing Toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-surface-200">Temporal Smoothing</p>
          <p className="text-xs text-surface-500">Reduce flickering between frames</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enableTemporal}
          onClick={() => updateSetting('enableTemporal', !settings.enableTemporal)}
          disabled={disabled}
          className={clsx(
            'relative w-11 h-6 rounded-full transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            settings.enableTemporal ? 'bg-accent' : 'bg-surface-700'
          )}
        >
          <span
            className={clsx(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
              settings.enableTemporal ? 'left-6' : 'left-1'
            )}
          />
        </button>
      </div>
    </div>
  )
}

interface SliderInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  format: (value: number) => string
  disabled: boolean
}

function SliderInput({ label, value, onChange, min, max, step, format, disabled }: SliderInputProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-surface-400">{label}</label>
        <span className="text-xs font-mono text-surface-300">{format(value)}</span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={clsx(
          'w-full h-1.5 rounded-full appearance-none cursor-pointer',
          'bg-surface-700',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          '[&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:h-4',
          '[&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:bg-white',
          '[&::-webkit-slider-thumb]:shadow-native',
          '[&::-webkit-slider-thumb]:cursor-pointer',
          '[&::-webkit-slider-thumb]:transition-transform',
          '[&::-webkit-slider-thumb]:hover:scale-110'
        )}
      />
    </div>
  )
}
