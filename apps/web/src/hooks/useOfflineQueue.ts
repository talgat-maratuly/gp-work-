import { useCallback, useEffect, useState } from 'react'
import { listQueued, processQueue } from '@/offline/queue'

export function useOfflineQueue() {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => setPending((await listQueued()).length), [])
  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      await processQueue()
      await refresh()
    } finally {
      setSyncing(false)
    }
  }, [refresh])

  useEffect(() => {
    void refresh()
    const online = () => void sync()
    window.addEventListener('online', online)
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => {
      window.removeEventListener('online', online)
      window.clearInterval(timer)
    }
  }, [refresh, sync])

  return { pending, syncing, online: navigator.onLine, refresh, sync }
}
