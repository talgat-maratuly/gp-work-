import { useEffect, useRef, useState } from 'react'
import { fetchMyRoute, newClientId, sendLocationBatch } from '@/api/fieldApi'
import { queueRequest } from '@/offline/queue'

export type RouteTrackingStatus = 'idle' | 'tracking' | 'queued' | 'denied' | 'unsupported' | 'error'

const LOCATION_INTERVAL_MS = 60_000

export function useRouteLocationTracking() {
  const [routeId, setRouteId] = useState<number | null>(null)
  const [status, setStatus] = useState<RouteTrackingStatus>('idle')
  const lastRecordedAt = useRef(0)
  const sending = useRef(false)

  useEffect(() => {
    let active = true
    const refreshRoute = async () => {
      try {
        const route = await fetchMyRoute()
        if (active) setRouteId(route?.status === 'IN_PROGRESS' ? route.id : null)
      } catch {
        // Keep the last known active route while the device is offline.
      }
    }
    void refreshRoute()
    const timer = window.setInterval(() => void refreshRoute(), 30_000)
    window.addEventListener('gp-work-route-changed', refreshRoute)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('gp-work-route-changed', refreshRoute)
    }
  }, [])

  useEffect(() => {
    if (!routeId) {
      setStatus('idle')
      return
    }
    if (!navigator.geolocation) {
      setStatus('unsupported')
      return
    }

    setStatus('tracking')
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now()
        if (sending.current || now - lastRecordedAt.current < LOCATION_INTERVAL_MS) return
        sending.current = true
        const point = {
          clientOperationId: newClientId(),
          routeId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          occurredAt: new Date(position.timestamp || now).toISOString(),
        }
        const send = async () => {
          try {
            if (navigator.onLine) {
              await sendLocationBatch({ points: [point] })
              setStatus('tracking')
            } else {
              await queueRequest('/field/locations/batch', 'POST', { points: [point] })
              setStatus('queued')
            }
            lastRecordedAt.current = now
          } catch {
            try {
              await queueRequest('/field/locations/batch', 'POST', { points: [point] })
              setStatus('queued')
              lastRecordedAt.current = now
            } catch {
              setStatus('error')
            }
          } finally {
            sending.current = false
          }
        }
        void send()
      },
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [routeId])

  return { routeId, status }
}
