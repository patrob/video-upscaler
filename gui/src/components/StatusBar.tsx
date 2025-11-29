import { CheckCircle2, XCircle } from 'lucide-react'
import clsx from 'clsx'
import type { DependencyStatus } from '../types'

interface StatusBarProps {
  dependencies: DependencyStatus | null
}

export function StatusBar({ dependencies }: StatusBarProps) {
  if (!dependencies) return null

  const items = [
    { name: 'FFmpeg', ok: dependencies.ffmpeg },
    { name: 'Ollama', ok: dependencies.ollama },
    { name: 'Elixir', ok: dependencies.elixir },
    { name: 'Node', ok: dependencies.node },
  ]

  const allOk = items.every(item => item.ok)

  return (
    <footer className="h-7 flex items-center justify-between px-4 border-t border-surface-800/50 text-xs text-surface-500">
      <div className="flex items-center gap-4">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-1">
            {item.ok ? (
              <CheckCircle2 className="w-3 h-3 text-green-500" />
            ) : (
              <XCircle className="w-3 h-3 text-red-500" />
            )}
            <span className={clsx(!item.ok && 'text-red-400')}>
              {item.name}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {allOk ? (
          <span className="text-green-500">All systems ready</span>
        ) : (
          <span className="text-yellow-500">Some dependencies missing</span>
        )}
      </div>
    </footer>
  )
}
