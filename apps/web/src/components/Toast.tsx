import { useEffect } from 'react'

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className="no-print fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-800 px-5 py-3 text-white shadow-lg">
      {message}
    </div>
  )
}
