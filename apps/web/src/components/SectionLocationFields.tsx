import { useEffect, useId, useRef, useState } from 'react'
import type { LocationDraft } from '@/lib/sectionLocation'
import { SectionLocationMap } from '@/components/SectionLocationMap'

export function SectionLocationFields({ value, onChange, disabled, onLocatingChange }: {
  value: LocationDraft
  onChange: (value: LocationDraft) => void
  disabled: boolean
  onLocatingChange: (locating: boolean) => void
}) {
  const id = useId()
  const active = useRef(true)
  const [locating, setLocating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  function locate() {
    setMessage(null)
    if (!navigator.geolocation) {
      setMessage('Геолокация недоступна. Выберите точку на карте или введите координаты участка вручную.')
      return
    }
    setLocating(true)
    onLocatingChange(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!active.current) return
        setLocating(false)
        onLocatingChange(false)
        if (!Number.isFinite(coords.accuracy) || coords.accuracy > 50 || coords.accuracy < 0) {
          setMessage('Погрешность GPS больше 50 м или неизвестна. Подойдите на открытое место и повторите. Координаты не изменены.')
          return
        }
        onChange({ ...value, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })
        setMessage(`Координаты определены, погрешность ${Math.ceil(coords.accuracy)} м. Проверьте радиус и сохраните участок.`)
      },
      (error) => {
        if (!active.current) return
        setLocating(false)
        onLocatingChange(false)
        setMessage(error.code === 1
          ? 'Доступ к геолокации запрещён. Выберите точку на карте или введите координаты вручную.'
          : 'Не удалось определить местоположение. Выберите точку на карте или введите координаты вручную.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  return <fieldset className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" disabled={disabled || locating}>
    <legend className="px-1 text-sm font-semibold">Местоположение участка</legend>
    <p className="text-sm text-slate-600">Укажите центр участка и радиус, в пределах которого можно начать и завершить работу. Без координат участок сохраняется, но начало смены недоступно.</p>
    <SectionLocationMap value={value} disabled={disabled || locating} onSelect={(latitude, longitude) => {
      setMessage(null)
      onChange({ ...value, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) })
    }} />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="block min-w-0 text-sm" htmlFor={`${id}-lat`}>Широта
        <input id={`${id}-lat`} inputMode="decimal" value={value.latitude} onChange={e => onChange({ ...value, latitude: e.target.value })} placeholder="От −90 до 90" className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="block min-w-0 text-sm" htmlFor={`${id}-lon`}>Долгота
        <input id={`${id}-lon`} inputMode="decimal" value={value.longitude} onChange={e => onChange({ ...value, longitude: e.target.value })} placeholder="От −180 до 180" className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="block min-w-0 text-sm" htmlFor={`${id}-radius`}>Радиус, м
        <input id={`${id}-radius`} inputMode="numeric" value={value.radius} onChange={e => onChange({ ...value, radius: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
    </div>
    <p className="text-xs text-slate-500">Радиус можно изменить вручную: от 10 до 5000 метров.</p>
    <button type="button" onClick={locate} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-blue-800 disabled:opacity-50">
      {locating ? 'Определяем координаты…' : 'Я на участке — определить координаты'}
    </button>
    <p className="text-xs text-slate-500">Используйте эту кнопку, только находясь на участке: она определяет местоположение вашего устройства.</p>
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
  </fieldset>
}
