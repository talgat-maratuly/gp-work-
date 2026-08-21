import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { WorkLog } from '@/lib/types'

export function logsWithGeo(logs: WorkLog[]): WorkLog[] {
  return logs.filter((l) => l.latitude != null && l.longitude != null)
}

interface Props {
  logs: WorkLog[]
  selectedId: number | null
  onSelect: (log: WorkLog) => void
}

const DEFAULT_CENTER: L.LatLngExpression = [55.75, 37.62]
const DEFAULT_ZOOM = 10

function markerStyle(selected: boolean): L.CircleMarkerOptions {
  return {
    radius: selected ? 11 : 8,
    fillColor: selected ? '#065f46' : '#047857',
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9,
  }
}

export function WorkLogsMap({ logs, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markersByIdRef = useRef<Map<number, L.CircleMarker>>(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const stableSelect = useCallback((log: WorkLog) => {
    onSelectRef.current(log)
  }, [])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const layer = L.layerGroup().addTo(map)
    mapRef.current = map
    layerRef.current = layer

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
      markersByIdRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    markersByIdRef.current.clear()

    if (!logs.length) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      return
    }

    const bounds = L.latLngBounds([])

    for (const log of logs) {
      const lat = log.latitude!
      const lng = log.longitude!
      const selected = log.id === selectedId
      const marker = L.circleMarker([lat, lng], markerStyle(selected))
      marker.on('click', () => stableSelect(log))
      marker.addTo(layer)
      markersByIdRef.current.set(log.id, marker)
      bounds.extend([lat, lng])
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 })
    }
  }, [logs, stableSelect])

  useEffect(() => {
    for (const [id, marker] of markersByIdRef.current) {
      marker.setStyle(markerStyle(id === selectedId))
    }

    const map = mapRef.current
    if (!map || selectedId == null) return
    const log = logs.find((l) => l.id === selectedId)
    if (log?.latitude != null && log.longitude != null) {
      map.panTo([log.latitude, log.longitude], { animate: true })
    }
  }, [selectedId, logs])

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[320px] w-full rounded-xl border border-slate-200 bg-slate-100 shadow-inner"
      role="application"
      aria-label="Карта выполненных работ"
    />
  )
}
