import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest, toUserMessage } from '@/api/client'
import { uploadWorkPhotos } from '@/api/uploadsApi'
import { CameraCapture, type CameraShot } from '@/components/field/CameraCapture'
import { LivenessCapture } from '@/components/field/LivenessCapture'
import { useGeolocation } from '@/hooks/useGeolocation'

type TaskResult = {
  percent: number
  actualVolume: string
  description: string
  incompleteReason: string
}

type DayTask = {
  id: number
  description: string
  execution?: { id: number; status: string } | null
}

type DayState = {
  section: { code: string; name: string; object?: { name: string } }
  session: null | { id: number; startedAt: string; status: string; reviewComment: string | null }
  tasks: DayTask[]
  serverTime: string
}

const emptyResult = (): TaskResult => ({
  percent: 0,
  actualVolume: '',
  description: '',
  incompleteReason: '',
})

export function FieldScanPage() {
  const { sectionCode = '' } = useParams()
  const { requestGeolocation } = useGeolocation()
  const [state, setState] = useState<DayState | null>(null)
  const [liveness, setLiveness] = useState<CameraShot[]>([])
  const [workPhoto, setWorkPhoto] = useState<CameraShot | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [results, setResults] = useState<Record<number, TaskResult>>({})

  const load = useCallback(async () => {
    try {
      setState(await apiRequest<DayState>(`/field/scan/${encodeURIComponent(sectionCode)}`))
      setMessage('')
    } catch (error) {
      setMessage(toUserMessage(error))
    }
  }, [sectionCode])

  useEffect(() => { void load() }, [load])

  function validateResults(tasks: DayTask[]): boolean {
    for (const task of tasks) {
      const result = results[task.id] || emptyResult()
      if (result.percent > 0 && !result.description.trim()) {
        setMessage(`Для задачи «${task.description}» укажите, что выполнено`)
        return false
      }
      if (result.percent < 100 && !result.incompleteReason.trim()) {
        setMessage(`Для задачи «${task.description}» укажите причину незавершения`)
        return false
      }
    }
    return true
  }

  async function submit(close: boolean) {
    if (liveness.length !== 3 || !workPhoto) {
      setMessage('Обязательны три разных кадра liveness и фото участка')
      return
    }
    if (close && state && !validateResults(state.tasks)) return

    setBusy(true)
    setMessage('')
    try {
      const geo = await requestGeolocation()
      if (geo.latitude == null || geo.longitude == null) {
        throw new Error('Разрешите точную геолокацию')
      }
      const [selfieUrls, photoUrls] = await Promise.all([
        uploadWorkPhotos(liveness.map((shot) => shot.file)),
        uploadWorkPhotos([workPhoto.file]),
      ])
      const evidence = {
        sectionCode,
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy,
        selfieUrl: selfieUrls[0],
        livenessEvidenceUrls: selfieUrls,
      }

      if (close) {
        await apiRequest('/field/work-days/close', {
          method: 'POST',
          body: JSON.stringify({
            ...evidence,
            sessionId: state!.session!.id,
            resultPhotoUrls: photoUrls,
            results: state!.tasks.map((task) => ({
              taskId: task.id,
              ...(results[task.id] || emptyResult()),
            })),
          }),
        })
      } else {
        await apiRequest('/field/work-days/start', {
          method: 'POST',
          body: JSON.stringify({
            ...evidence,
            clientSessionId: crypto.randomUUID(),
            startPhotoUrl: photoUrls[0],
          }),
        })
      }

      setLiveness([])
      setWorkPhoto(null)
      setResults({})
      await load()
      setMessage(close ? 'Рабочий день завершён' : 'Рабочий день открыт по серверному времени')
    } catch (error) {
      setMessage(toUserMessage(error))
    } finally {
      setBusy(false)
    }
  }

  if (!state) return <div className="p-5">{message || 'Проверяем QR…'}</div>

  return (
    <main className="mx-auto min-h-screen max-w-md space-y-4 bg-slate-50 p-4 pb-28">
      <div className="rounded-3xl bg-emerald-800 p-5 text-white">
        <div className="text-sm opacity-80">{state.section.object?.name}</div>
        <h1 className="text-2xl font-black">{state.section.name}</h1>
        <div className="mt-2 text-xs">
          QR {state.section.code} · сервер {new Date(state.serverTime).toLocaleTimeString()}
        </div>
      </div>

      {state.session && (
        <div className={`rounded-2xl p-4 ${state.session.status === 'RETURNED' ? 'bg-red-50 text-red-900' : 'bg-emerald-50'}`}>
          <b>{state.session.status === 'RETURNED' ? 'Смена возвращена на исправление' : 'Смена открыта'}</b>
          <div className="text-sm">Начало: {new Date(state.session.startedAt).toLocaleTimeString()}</div>
          {state.session.reviewComment && <div className="mt-2 text-sm">Причина: {state.session.reviewComment}</div>}
        </div>
      )}

      {state.session && (
        <section className="rounded-2xl border border-emerald-200 bg-white p-4">
          <h2 className="font-black">Назначенные задачи</h2>
          <p className="mt-1 text-xs text-slate-500">Каждую задачу нужно провести через QR/GPS, Face, фото и чек-лист.</p>
          <div className="mt-3 space-y-2">
            {state.tasks.map((task) => (
              <Link
                key={task.id}
                to={task.execution
                  ? `/field/executions/${task.execution.id}`
                  : `/field/qr?taskId=${task.id}&code=${encodeURIComponent(state.section.code)}`}
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"
              >
                <span><b>#{task.id}</b> {task.description}</span>
                <span className="font-bold text-emerald-700">
                  {task.execution ? task.execution.status : 'QR и GPS'} →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <LivenessCapture onChange={setLiveness} />
      <CameraCapture
        label={state.session ? 'Фото результата' : 'Начальное фото участка'}
        onChange={setWorkPhoto}
      />

      {state.session && (
        <div className="rounded-2xl bg-white p-4">
          <b>Результат каждой задачи</b>
          {state.tasks.map((task) => {
            const result = results[task.id] || emptyResult()
            const set = (value: Partial<TaskResult>) => setResults((old) => ({
              ...old,
              [task.id]: { ...result, ...value },
            }))
            return (
              <div key={task.id} className="mt-3 space-y-2 rounded-xl bg-slate-100 p-3">
                <b>{task.description}</b>
                <label className="block text-sm">
                  Выполнение: {result.percent}%
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={result.percent}
                    onChange={(event) => {
                      const percent = Number(event.target.value)
                      set({ percent, ...(percent === 100 ? { incompleteReason: '' } : {}) })
                    }}
                    className="w-full"
                  />
                </label>
                <input
                  value={result.actualVolume}
                  onChange={(event) => set({ actualVolume: event.target.value })}
                  placeholder="Фактический объём и единица"
                  className="w-full rounded-lg border p-2"
                />
                <textarea
                  required={result.percent > 0}
                  value={result.description}
                  onChange={(event) => set({ description: event.target.value })}
                  placeholder="Что выполнено"
                  className="w-full rounded-lg border p-2"
                />
                {result.percent < 100 && (
                  <textarea
                    required
                    value={result.incompleteReason}
                    onChange={(event) => set({ incompleteReason: event.target.value })}
                    placeholder="Обязательная причина незавершения"
                    className="w-full rounded-lg border border-amber-400 p-2"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      <button
        disabled={busy}
        onClick={() => void submit(!!state.session)}
        className={`w-full rounded-2xl p-5 text-lg font-black text-white disabled:opacity-50 ${state.session ? 'bg-red-700' : 'bg-emerald-700'}`}
      >
        {busy
          ? 'Сохраняем…'
          : state.session?.status === 'RETURNED'
            ? 'Исправить и повторно отправить'
            : state.session
              ? 'Завершить рабочий день'
              : 'Начать рабочий день'}
      </button>
      {message && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}
    </main>
  )
}
