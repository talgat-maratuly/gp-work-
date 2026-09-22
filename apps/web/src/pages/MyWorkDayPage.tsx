import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyWorkDay, finishMyWorkDay, startMyWorkDay, type MyWorkDay } from '@/api/attendanceApi'
import { toUserMessage } from '@/api/client'
import { AccountControls } from '@/components/AccountControls'
import { useAuth } from '@/context/AuthContext'
import { useGeolocation } from '@/hooks/useGeolocation'
import { getToken } from '@/lib/auth'
import { homePathForRole } from '@/lib/roleRoutes'
import { ADMIN_ROUTE_ROLES } from '@/lib/rolePermissions'
import { buildMapLink } from '@/lib/appConfig'

function dayLabel(date: string) { return date.split('-').reverse().join('.') }
function timeLabel(value: string) { return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }
function durationLabel(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60))
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
}

function LocationLink({ latitude, longitude, accuracy, label }: {
  latitude: number | null; longitude: number | null; accuracy: number | null; label: string
}) {
  if (latitude == null || longitude == null) return null
  return <a href={buildMapLink(latitude, longitude)} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline">
    {label}{accuracy != null ? ` (±${Math.round(accuracy)} м)` : ''}
  </a>
}

export function MyWorkDayPage() {
  const { user, hasRole } = useAuth()
  const { requestGeolocation } = useGeolocation()
  const [data, setData] = useState<MyWorkDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)
  const activeId = useRef(user!.id)
  activeId.current = user!.id
  const mounted = useRef(true)
  const pending = useRef(false)
  const receivedAt = useRef(0)
  const revision = useRef(0)
  const stillMine = (id: number, token: string | null) => mounted.current && activeId.current === id && getToken() === token

  const load = useCallback(async () => {
    const id = user!.id, token = getToken()
    const requestRevision = ++revision.current
    setLoading(true)
    setLoadError(null)
    try {
      const result = await fetchMyWorkDay()
      if (!stillMine(id, token) || revision.current !== requestRevision) return
      receivedAt.current = performance.now()
      setData(result)
    } catch (err) {
      if (stillMine(id, token) && revision.current === requestRevision) setLoadError(toUserMessage(err, 'Не удалось загрузить рабочий день'))
    } finally {
      if (stillMine(id, token) && revision.current === requestRevision) setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    mounted.current = true
    setData(null)
    setError(null)
    setSuccess(null)
    void load()
    const timer = window.setInterval(() => tick(value => value + 1), 30_000)
    return () => { mounted.current = false; ++revision.current; window.clearInterval(timer) }
  }, [load])

  async function mark() {
    if (pending.current || loading || loadError || !data || data.current?.status === 'COMPLETED') return
    pending.current = true
    setBusy(true)
    setError(null)
    setSuccess(null)
    const id = user!.id, token = getToken(), current = data.current
    try {
      const location = await requestGeolocation()
      // GPS can outlive logout or an account change in another tab.
      if (!stillMine(id, token)) return
      if (location.status !== 'granted' || location.latitude == null || location.longitude == null || location.accuracy == null) {
        throw new Error(location.status === 'unsupported'
          ? 'Этот браузер не может определить местоположение. Откройте сайт на телефоне с геолокацией.'
          : 'Не удалось получить геолокацию. Проверьте разрешение на доступ к местоположению и повторите отметку.')
      }
      const point = { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy }
      const record = current ? await finishMyWorkDay(current.id, point) : await startMyWorkDay(point)
      if (!stillMine(id, token)) return
      setData(previous => previous ? { ...previous, current: record } : previous)
      setSuccess(record.status === 'COMPLETED' ? 'Рабочий день завершён. Время сохранено в табеле.' : 'Рабочий день начат. Время и геолокация сохранены.')
      await load()
    } catch (err) {
      if (stillMine(id, token)) setError(toUserMessage(err))
    } finally {
      pending.current = false
      if (stillMine(id, token)) setBusy(false)
    }
  }

  const current = data?.current
  const elapsed = current?.status === 'ON_DUTY' && data
    ? Math.max(0, (Date.parse(data.serverTime) + performance.now() - receivedAt.current - Date.parse(current.checkInTime)) / 3_600_000)
    : current?.workedHours ?? 0
  const fieldClose = current?.status === 'ON_DUTY' && data?.fieldSession

  return <div className="min-h-dvh bg-slate-100">
    <header className="border-b bg-white px-4 py-3">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <Link to={homePathForRole(user!.role)} className="rounded-lg border px-3 py-2 text-sm font-semibold">← В кабинет</Link>
        <AccountControls />
      </div>
    </header>
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <div><h1 className="text-2xl font-bold">Мой рабочий день</h1>
        <p className="mt-1 text-sm text-slate-600">Нажмите кнопку в начале и в конце работы. Геолокация сохраняется при каждой отметке.</p>
      </div>
      <section aria-label="Отметка рабочего дня" className="space-y-4 rounded-2xl border bg-white p-5">
        {loading && <p role="status">Загрузка рабочего дня…</p>}
        {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
        {!loading && !loadError && data && <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{dayLabel(current?.workDate ?? data.today)}</p>
            <p className={current?.status === 'ON_DUTY' ? 'font-semibold text-emerald-700' : 'text-slate-600'}>
              {current ? current.status === 'ON_DUTY' ? 'На работе' : 'Рабочий день завершён' : 'Рабочий день ещё не начат'}
            </p>
          </div>
          {current && <>
            <p className="text-3xl font-bold tabular-nums">{durationLabel(elapsed)}</p>
            <p className="text-sm text-slate-600">Начало: {timeLabel(current.checkInTime)}{current.checkOutTime ? ` · Завершение: ${timeLabel(current.checkOutTime)}` : ''}</p>
            {current.status === 'ON_DUTY' && current.workDate !== data.today && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Остался открытым день за {dayLabel(current.workDate)}. Завершите его перед новой отметкой.</p>}
            <div className="flex flex-wrap gap-3">
              <LocationLink latitude={current.checkInLatitude} longitude={current.checkInLongitude} accuracy={current.checkInAccuracy} label="Место начала" />
              <LocationLink latitude={current.checkOutLatitude} longitude={current.checkOutLongitude} accuracy={current.checkOutAccuracy} label="Место завершения" />
            </div>
          </>}
          {fieldClose ? <div className="space-y-3">
            <p className="text-sm text-slate-600">День открыт на участке. Заполните результат работы в форме участка — часы попадут в табель автоматически.</p>
            <Link to={`/field/scan/${encodeURIComponent(fieldClose.sectionCode)}`} className="block rounded-xl bg-emerald-700 px-4 py-3 text-center font-semibold text-white">Завершить день на участке</Link>
          </div> : current?.status !== 'COMPLETED' && <button type="button" onClick={() => void mark()} disabled={busy}
            className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? 'Определяем местоположение и сохраняем…' : current ? 'Завершить рабочий день' : 'Начать рабочий день'}
          </button>}
        </>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {success && <p role="status" className="text-emerald-800">{success}</p>}
        <button type="button" onClick={() => { setError(null); void load() }} disabled={loading || busy} className="text-sm text-blue-700 underline disabled:opacity-50">Обновить состояние</button>
        <p className="text-xs text-slate-500">Часы считаются между отметками. Перерывы отдельно не вычитаются. Отметка подтверждается после сохранения на сервере.</p>
      </section>
      {hasRole(...ADMIN_ROUTE_ROLES.attendance) && <Link to="/admin/attendance" className="block rounded-xl border bg-white px-4 py-3 font-semibold text-blue-800">Табель сотрудников →</Link>}
      {data && !loadError && <section aria-label="Мои отметки" className="space-y-3">
        <h2 className="text-lg font-bold">Мои отметки</h2>
        <p className="text-sm text-slate-500">Последние 31 рабочий день</p>
        {data.recent.length === 0 && <p className="text-sm text-slate-600">Пока нет отметок.</p>}
        {data.recent.map(row => <article key={row.id} className="flex flex-wrap justify-between gap-3 rounded-xl border bg-white p-4">
          <div><p className="font-semibold">{dayLabel(row.workDate)}</p><p className="mt-1 text-sm text-slate-600">{timeLabel(row.checkInTime)} — {row.checkOutTime ? timeLabel(row.checkOutTime) : 'день открыт'}</p></div>
          <p className="font-semibold">{row.workedHours != null ? durationLabel(row.workedHours) : 'Не завершён'}</p>
        </article>)}
      </section>}
    </main>
  </div>
}
