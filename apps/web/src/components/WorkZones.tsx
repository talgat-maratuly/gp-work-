import { useEffect, useId, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { SectionLocationEditor } from './SectionLocationEditor'
import { hasSectionLocation } from '@/lib/sectionLocation'
import type { NurseryObject, Section } from '@/lib/types'

export function WorkZones({ sections, objects, onSaved }: {
  sections: Section[]
  objects: NurseryObject[]
  onSaved: (section: Section) => void
}) {
  const { user } = useAuth()
  const selectId = useId()
  const canEdit = !!user && ['ADMIN', 'DIRECTOR'].includes(user.role)
    && (user.accessRoleId == null || !!user.permissions?.includes('sections.update'))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tileError, setTileError] = useState(false)
  const node = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const active = useMemo(() => sections.filter(s => s.is_active
    && objects.some(o => o.id === s.object_id && o.is_active)), [sections, objects])
  const located = useMemo(() => active.filter(hasSectionLocation), [active])
  const selected = active.find(s => s.id === selectedId)
  const label = (s: Section) => `${objects.find(o => o.id === s.object_id)?.name ?? 'Объект'} — ${s.name}`

  useEffect(() => {
    if (!node.current) return
    const instance = L.map(node.current, { zoomAnimation: false, fadeAnimation: false,
      markerZoomAnimation: false, scrollWheelZoom: false }).setView([51.23, 51.37], 12)
    map.current = instance
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap', maxZoom: 19,
    }).on('tileerror', () => setTileError(true)).addTo(instance)
    return () => { instance.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const layer = L.featureGroup().addTo(instance)
    located.forEach(s => {
      // Use text nodes: object names must never become Leaflet HTML.
      const tooltip = document.createElement('span')
      tooltip.textContent = `${objects.find(o => o.id === s.object_id)?.name ?? 'Объект'} — ${s.name}. Радиус ${s.radius_meters ?? 150} м`
      L.circle([s.latitude!, s.longitude!], { radius: s.radius_meters ?? 150,
        color: '#047857', fillOpacity: 0.12, className: 'work-zone-boundary',
      }).bindTooltip(tooltip).on('click', () => setSelectedId(s.id)).addTo(layer)
      L.circleMarker([s.latitude!, s.longitude!], { radius: 6, color: '#047857',
        fillOpacity: 1, className: 'work-zone-marker',
      }).on('click', () => setSelectedId(s.id)).addTo(layer)
    })
    if (located.length) instance.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 16, animate: false })
    return () => { layer.remove() }
  }, [located, objects])

  useEffect(() => {
    if (selected && hasSectionLocation(selected)) {
      // Circle.getBounds() needs a mounted map layer. Build geographic bounds
      // directly so selecting a zone (including a newly saved one) is safe.
      const bounds = L.latLng(selected.latitude!, selected.longitude!)
        .toBounds(2 * (selected.radius_meters ?? 150))
      map.current?.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false })
    }
  }, [selected])

  return <section aria-label="Рабочие геозоны" className="space-y-3 rounded-xl border p-4">
    <h2 className="text-lg font-semibold">Рабочие геозоны</h2>
    <p className="text-sm text-slate-600">Объекты и радиусы отображаются даже без отчётов. Задание использует местоположение выбранного участка. Офис, склад и место встречи можно добавить как объект с участком.</p>
    <p role="status" className="text-sm">На карте: {located.length}. Без координат: {active.length - located.length}.</p>
    <div ref={node} role="region" aria-label="Карта рабочих геозон" className="relative z-0 h-80 w-full rounded-xl bg-slate-100" />
    {tileError && <p role="alert">Подложка карты недоступна. Выберите участок из списка; координаты можно ввести вручную.</p>}
    <div className="text-sm">
      <label htmlFor={selectId} className="block">Объект и участок</label>
      <select id={selectId} className="mt-1 w-full rounded-lg border p-2" value={selected?.id ?? ''}
        onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Выберите участок или нажмите на зону</option>
        {active.map(s => <option key={s.id} value={s.id}>{label(s)}{hasSectionLocation(s) ? '' : ' — нет координат'}</option>)}
      </select>
    </div>
    {selected && <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <h3 className="font-semibold">{label(selected)}</h3>
      <p>{hasSectionLocation(selected) ? `Радиус: ${selected.radius_meters ?? 150} м` : 'Местоположение ещё не указано'}</p>
      {canEdit && <SectionLocationEditor key={selected.id} section={selected} onSaved={onSaved} />}
    </div>}
    <p className="text-sm text-slate-600">Точку и радиус меняют только администратор и директор. Геозона сама по себе не включает фоновое отслеживание сотрудников.</p>
    {canEdit && <Link to="/admin/objects" className="inline-block text-blue-700 underline">Добавить объект или участок</Link>}
  </section>
}
