import { useCallback, useEffect, useState } from 'react'
import { listQueued, processQueue } from '@/offline/queue'

export function useOfflineQueue() {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [lastError, setLastError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const rows = await listQueued()
    setPending(rows.length)
    setLastError(rows.find((row) => row.lastError)?.lastError ?? null)
  }, [])
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
    const becameOnline = () => { setOnline(true); void sync() }
    const becameOffline = () => setOnline(false)
    const queueChanged = () => void refresh()
    window.addEventListener('online', becameOnline)
    window.addEventListener('offline', becameOffline)
    window.addEventListener('gp-work-queue-changed', queueChanged)
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => {
      window.removeEventListener('online', becameOnline)
      window.removeEventListener('offline', becameOffline)
      window.removeEventListener('gp-work-queue-changed', queueChanged)
      window.clearInterval(timer)
    }
  }, [refresh, sync])

  return { pending, syncing, online, lastError, refresh, sync }
}
