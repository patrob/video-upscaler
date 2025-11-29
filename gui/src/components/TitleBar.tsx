import { Sparkles } from 'lucide-react'

export function TitleBar() {
  return (
    <header className="title-bar h-12 flex items-center px-20 border-b border-surface-800/50">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <h1 className="text-sm font-medium text-surface-200">Video Enhancer</h1>
      </div>
    </header>
  )
}
