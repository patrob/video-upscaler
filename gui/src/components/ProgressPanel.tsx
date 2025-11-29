import { useRef, useEffect } from 'react'
import { Play, Square, RotateCcw, FolderOpen, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import type { ProgressData } from '../types'

interface ProgressPanelProps {
  state: 'idle' | 'ready' | 'processing' | 'complete' | 'error'
  progress: ProgressData
  logs: string[]
  error: string | null
  onStart: () => void
  onCancel: () => void
  onReset: () => void
  onOpenOutput: () => void
}

export function ProgressPanel({
  state,
  progress,
  logs,
  error,
  onStart,
  onCancel,
  onReset,
  onOpenOutput,
}: ProgressPanelProps) {
  const logsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="glass rounded-xl p-5 flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {state === 'processing' && (
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          )}
          {state === 'complete' && (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          )}
          {state === 'error' && (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
          <div>
            <h3 className="font-medium text-surface-100">
              {state === 'ready' && 'Ready to enhance'}
              {state === 'processing' && progress.phase}
              {state === 'complete' && 'Enhancement complete'}
              {state === 'error' && 'Enhancement failed'}
            </h3>
            {state === 'processing' && (
              <p className="text-xs text-surface-400 mt-0.5">
                {progress.progress}% complete
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {state === 'ready' && (
            <button
              type="button"
              onClick={onStart}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-accent hover:bg-accent-hover',
                'text-white text-sm font-medium',
                'transition-colors'
              )}
            >
              <Play className="w-4 h-4" />
              Start
            </button>
          )}

          {state === 'processing' && (
            <button
              type="button"
              onClick={onCancel}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-red-500/20 hover:bg-red-500/30',
                'text-red-400 text-sm font-medium',
                'transition-colors'
              )}
            >
              <Square className="w-4 h-4" />
              Cancel
            </button>
          )}

          {state === 'complete' && (
            <>
              <button
                type="button"
                onClick={onOpenOutput}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg',
                  'bg-accent hover:bg-accent-hover',
                  'text-white text-sm font-medium',
                  'transition-colors'
                )}
              >
                <FolderOpen className="w-4 h-4" />
                Show in Folder
              </button>
              <button
                type="button"
                onClick={onReset}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg',
                  'bg-surface-700 hover:bg-surface-600',
                  'text-surface-200 text-sm font-medium',
                  'transition-colors'
                )}
              >
                <RotateCcw className="w-4 h-4" />
                New Video
              </button>
            </>
          )}

          {state === 'error' && (
            <button
              type="button"
              onClick={onReset}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-surface-700 hover:bg-surface-600',
                'text-surface-200 text-sm font-medium',
                'transition-colors'
              )}
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {state === 'processing' && (
        <div className="mb-4">
          <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-purple-500 transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Logs */}
      <div
        ref={logsRef}
        className={clsx(
          'flex-1 rounded-lg bg-surface-900/50 p-3 overflow-auto',
          'font-mono text-xs text-surface-400',
          'min-h-[100px]'
        )}
      >
        {logs.length === 0 ? (
          <p className="text-surface-600 italic">
            {state === 'ready' && 'Logs will appear here when processing starts...'}
            {state === 'complete' && 'Processing completed successfully.'}
            {state === 'error' && 'Check the error message above for details.'}
          </p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
