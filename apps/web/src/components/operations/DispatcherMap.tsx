import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DispatcherData } from '@/api/operationsApi'

export function DispatcherMap({ data }: { data: DispatcherData }) {
  const node = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  useEffect(() => {
    if (!node.current || map.current) return
    map.current = L.map(node.current).setView([51.23, 51.37], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap', maxZoom: 19,
    }).addTo(map.current)
    return () => { map.current?.remove(); map.current = null }
  }, [])
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    instance.eachLayer((layer) => { if (!(layer instanceof L.TileLayer)) instance.removeLayer(layer) })
    const bounds = L.latLngBounds([])
    data.objects.forEach((object) => {
      L.circleMarker([object.latitude, object.longitude], { radius: 7, color: '#047857', fillColor: '#10b981', fillOpacity: 0.85, weight: 2 })
        .bindTooltip(`<b>${object.objectName ?? 'Объект'}</b><br>${object.sectionName}`)
        .addTo(instance)
      bounds.extend([object.latitude, object.longitude])
    })
    data.teams.forEach((team) => {
      L.circleMarker([team.latitude, team.longitude], { radius: 9, color: team.stale ? '#b45309' : '#1d4ed8', fillColor: team.stale ? '#f59e0b' : '#3b82f6', fillOpacity: 0.95, weight: 3 })
        .bindTooltip(`<b>${team.brigadeName ?? team.userName}</b><br>${team.stale ? 'Геопозиция устарела' : 'Активная геопозиция'}`)
        .addTo(instance)
      bounds.extend([team.latitude, team.longitude])
    })
    if (bounds.isValid()) instance.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
  }, [data])
  return <div ref={node} className="h-[430px] w-full rounded-2xl bg-slate-100" aria-label="Оперативная карта объектов и бригад" />
}
