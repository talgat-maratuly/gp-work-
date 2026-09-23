import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { locationPoint, type LocationDraft } from '@/lib/sectionLocation'

const DEFAULT_CENTER: L.LatLngTuple = [51.23, 51.37]

export function SectionLocationMap({ value, disabled, onSelect }: {
  value: LocationDraft
  disabled: boolean
  onSelect: (latitude: number, longitude: number) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const tiles = useRef<L.TileLayer | null>(null)
  const marker = useRef<L.CircleMarker | null>(null)
  const circle = useRef<L.Circle | null>(null)
  const latest = useRef({ value, disabled, onSelect })
  latest.current = { value, disabled, onSelect }
  const [tileError, setTileError] = useState(false)
  const point = locationPoint(value)
  const latitude = point?.[0]
  const longitude = point?.[1]
  const radius = Number(value.radius.trim())
  const validRadius = Number.isInteger(radius) && radius >= 10 && radius <= 5000

  useEffect(() => {
    if (!container.current) return
    const initial = locationPoint(latest.current.value)
    const instance = L.map(container.current, {
      zoomControl: false, scrollWheelZoom: false, worldCopyJump: true,
      zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
    }).setView(initial ?? DEFAULT_CENTER, initial ? 16 : 13)
    map.current = instance
    L.control.zoom({ zoomInTitle: 'Приблизить', zoomOutTitle: 'Отдалить' }).addTo(instance)
    L.control.scale({ imperial: false }).addTo(instance)
    const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    })
    layer.on('tileerror', () => setTileError(true))
    layer.addTo(instance)
    tiles.current = layer
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (latest.current.disabled) return
      const selected = event.latlng.wrap()
      if (Math.abs(selected.lat) <= 90) latest.current.onSelect(selected.lat, selected.lng)
    })
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }))
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      layer.off()
      instance.remove()
      map.current = null
      tiles.current = null
      marker.current = null
      circle.current = null
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    if (latitude === undefined || longitude === undefined) {
      marker.current?.remove()
      marker.current = null
      return
    }
    const center: L.LatLngTuple = [latitude, longitude]
    if (!marker.current) marker.current = L.circleMarker(center, {
      radius: 7, weight: 3, color: '#fff', fillColor: '#1d4ed8', fillOpacity: 1,
      interactive: false, className: 'section-location-marker',
    }).addTo(instance)
    else marker.current.setLatLng(center)
    instance.panTo(center, { animate: false })
    marker.current.bringToFront()
  }, [latitude, longitude])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    if (latitude === undefined || longitude === undefined || !validRadius) {
      circle.current?.remove()
      circle.current = null
      return
    }
    const center: L.LatLngTuple = [latitude, longitude]
    if (!circle.current) circle.current = L.circle(center, {
      radius, weight: 2, color: '#2563eb', fillOpacity: 0.12,
      interactive: false, className: 'section-location-radius',
    }).addTo(instance)
    else circle.current.setLatLng(center).setRadius(radius)
    circle.current.bringToBack()
  }, [latitude, longitude, radius, validRadius])

  return <div className="min-w-0 space-y-2">
    <p className="text-sm text-slate-600">Найдите участок на карте и нажмите на его центр. Синяя точка — центр, круг — радиус допуска. Для уточнения нажмите в другом месте.</p>
    <div inert={disabled} className={disabled ? 'opacity-60' : ''}>
      <div ref={container} role="application" aria-label="Карта местоположения участка" aria-disabled={disabled}
        className="relative z-0 h-72 w-full rounded-lg border border-slate-300 bg-slate-100 sm:h-80" />
    </div>
    <button type="button" disabled={disabled} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
      onClick={() => {
        const center = map.current?.getCenter().wrap()
        if (center && !disabled && Math.abs(center.lat) <= 90) onSelect(center.lat, center.lng)
      }}>Поставить точку в центре карты</button>
    {!point && <p className="text-xs text-slate-500">Точка ещё не выбрана. Перемещение и масштабирование карты не меняют координаты участка.</p>}
    {tileError && <div role="note" aria-live="polite" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      <p>Не удалось загрузить карту. Введённые координаты сохранены в форме. Можно ввести их вручную или повторить загрузку карты.</p>
      <button type="button" disabled={disabled} className="mt-2 underline" onClick={() => { setTileError(false); tiles.current?.redraw() }}>Повторить загрузку карты</button>
    </div>}
  </div>
}
