import { useCallback, useState } from 'react'
import { buildMapLink } from '@/lib/appConfig'

export interface GeoResult {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  mapUrl: string | null
  status: 'pending' | 'granted' | 'denied' | 'unsupported'
}

function buildGeoResult(
  latitude: number | null,
  longitude: number | null,
  accuracy: number | null,
  status: GeoResult['status']
): GeoResult {
  const hasCoords = latitude != null && longitude != null
  return {
    latitude,
    longitude,
    accuracy,
    mapUrl: hasCoords ? buildMapLink(latitude, longitude) : null,
    status,
  }
}

export function useGeolocation() {
  const [geo, setGeo] = useState<GeoResult>(() =>
    buildGeoResult(null, null, null, 'pending')
  )

  const request = useCallback((): Promise<GeoResult> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const r = buildGeoResult(null, null, null, 'unsupported')
        setGeo(r)
        resolve(r)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const accuracy =
            typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null
          const r = buildGeoResult(
            pos.coords.latitude,
            pos.coords.longitude,
            accuracy,
            'granted'
          )
          setGeo(r)
          resolve(r)
        },
        () => {
          const r = buildGeoResult(null, null, null, 'denied')
          setGeo(r)
          resolve(r)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }, [])

  return { geo, requestGeolocation: request }
}
