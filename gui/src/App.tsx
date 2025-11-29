import { useState, useEffect, useCallback } from 'react'
import { VideoDropzone } from './components/VideoDropzone'
import { SettingsPanel } from './components/SettingsPanel'
import { ProgressPanel } from './components/ProgressPanel'
import { TitleBar } from './components/TitleBar'
import { StatusBar } from './components/StatusBar'
import type { VideoInfo, EnhancementOptions, ProgressData, DependencyStatus } from './types'

type AppState = 'idle' | 'ready' | 'processing' | 'complete' | 'error'

function App() {
  const [state, setState] = useState<AppState>('idle')
  const [inputPath, setInputPath] = useState<string | null>(null)
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [progress, setProgress] = useState<ProgressData>({ phase: '', progress: 0, message: '' })
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dependencies, setDependencies] = useState<DependencyStatus | null>(null)

  const [settings, setSettings] = useState({
    model: 'realism',
    strength: 0.7,
    fps: 24,
    batchSize: 4,
    temporalBlend: 0.3,
    enableTemporal: true,
  })

  useEffect(() => {
    window.electronAPI.checkDependencies().then(setDependencies)
  }, [])

  useEffect(() => {
    const unsubProgress = window.electronAPI.onProgress((data) => {
      setProgress(data)
    })

    const unsubLog = window.electronAPI.onLog((message) => {
      setLogs(prev => [...prev.slice(-100), message])
    })

    const unsubComplete = window.electronAPI.onComplete((result) => {
      if (result.success) {
        setState('complete')
      } else {
        setState('error')
        setError(`Process exited with code ${result.code}`)
      }
    })

    const unsubError = window.electronAPI.onError((err) => {
      setState('error')
      setError(err)
    })

    return () => {
      unsubProgress()
      unsubLog()
      unsubComplete()
      unsubError()
    }
  }, [])

  const handleFileSelect = useCallback(async (path: string) => {
    setInputPath(path)
    setError(null)

    try {
      const info = await window.electronAPI.getVideoInfo(path)
      setVideoInfo(info)

      // Auto-set FPS from video
      if (info.fps > 0) {
        setSettings(prev => ({ ...prev, fps: Math.round(info.fps) }))
      }

      // Generate default output path
      const baseName = path.replace(/\.[^/.]+$/, '')
      const defaultOutput = `${baseName}_enhanced.mp4`
      setOutputPath(defaultOutput)

      setState('ready')
    } catch (err) {
      setError('Failed to read video file')
      setState('idle')
    }
  }, [])

  const handleBrowseInput = useCallback(async () => {
    const path = await window.electronAPI.selectInputFile()
    if (path) {
      handleFileSelect(path)
    }
  }, [handleFileSelect])

  const handleBrowseOutput = useCallback(async () => {
    const path = await window.electronAPI.selectOutputFile()
    if (path) {
      setOutputPath(path)
    }
  }, [])

  const handleStart = useCallback(async () => {
    if (!inputPath || !outputPath) return

    setState('processing')
    setProgress({ phase: 'Initializing', progress: 0, message: 'Starting enhancement...' })
    setLogs([])
    setError(null)

    const options: EnhancementOptions = {
      inputPath,
      outputPath,
      ...settings,
    }

    try {
      await window.electronAPI.startEnhancement(options)
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Failed to start enhancement')
    }
  }, [inputPath, outputPath, settings])

  const handleCancel = useCallback(async () => {
    await window.electronAPI.cancelEnhancement()
    setState('ready')
    setProgress({ phase: '', progress: 0, message: '' })
  }, [])

  const handleReset = useCallback(() => {
    setState('idle')
    setInputPath(null)
    setOutputPath(null)
    setVideoInfo(null)
    setProgress({ phase: '', progress: 0, message: '' })
    setLogs([])
    setError(null)
  }, [])

  const handleOpenOutput = useCallback(() => {
    if (outputPath) {
      window.electronAPI.openFileLocation(outputPath)
    }
  }, [outputPath])

  return (
    <div className="h-screen flex flex-col bg-surface-950 text-surface-100">
      <TitleBar />

      <main className="flex-1 flex flex-col p-6 pt-2 overflow-hidden">
        {state === 'idle' && (
          <VideoDropzone
            onFileSelect={handleFileSelect}
            onBrowse={handleBrowseInput}
          />
        )}

        {(state === 'ready' || state === 'processing' || state === 'complete' || state === 'error') && (
          <div className="flex-1 flex gap-6 min-h-0">
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <SettingsPanel
                settings={settings}
                onSettingsChange={setSettings}
                videoInfo={videoInfo}
                inputPath={inputPath}
                outputPath={outputPath}
                onBrowseOutput={handleBrowseOutput}
                disabled={state === 'processing'}
              />

              <ProgressPanel
                state={state}
                progress={progress}
                logs={logs}
                error={error}
                onStart={handleStart}
                onCancel={handleCancel}
                onReset={handleReset}
                onOpenOutput={handleOpenOutput}
              />
            </div>
          </div>
        )}
      </main>

      <StatusBar dependencies={dependencies} />
    </div>
  )
}

export default App
