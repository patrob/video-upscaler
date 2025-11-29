import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Film, Upload, FolderOpen } from 'lucide-react'
import clsx from 'clsx'

interface VideoDropzoneProps {
  onFileSelect: (path: string) => void
  onBrowse: () => void
}

export function VideoDropzone({ onFileSelect, onBrowse }: VideoDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      // In Electron, we can access the path property
      const file = acceptedFiles[0] as File & { path?: string }
      if (file.path) {
        onFileSelect(file.path)
      }
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv']
    },
    multiple: false,
  })

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        {...getRootProps()}
        className={clsx(
          'w-full max-w-lg aspect-video rounded-2xl border-2 border-dashed',
          'flex flex-col items-center justify-center gap-4 p-8',
          'cursor-pointer transition-all duration-200',
          isDragActive
            ? 'border-accent bg-accent/5 scale-[1.02]'
            : 'border-surface-700 hover:border-surface-500 hover:bg-surface-900/50'
        )}
      >
        <input {...getInputProps()} />

        <div className={clsx(
          'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
          isDragActive ? 'bg-accent/20' : 'bg-surface-800'
        )}>
          {isDragActive ? (
            <Upload className="w-8 h-8 text-accent" />
          ) : (
            <Film className="w-8 h-8 text-surface-400" />
          )}
        </div>

        <div className="text-center">
          <p className={clsx(
            'text-lg font-medium transition-colors',
            isDragActive ? 'text-accent' : 'text-surface-200'
          )}>
            {isDragActive ? 'Drop video here' : 'Drop a video to enhance'}
          </p>
          <p className="mt-1 text-sm text-surface-500">
            MP4, MKV, AVI, MOV, WebM supported
          </p>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-surface-600">or</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onBrowse()
            }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-surface-800 hover:bg-surface-700',
              'text-sm font-medium text-surface-200',
              'transition-colors'
            )}
          >
            <FolderOpen className="w-4 h-4" />
            Browse Files
          </button>
        </div>
      </div>
    </div>
  )
}
