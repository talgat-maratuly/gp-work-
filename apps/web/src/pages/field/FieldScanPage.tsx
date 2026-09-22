import { useCallback, useEffect, useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, apiRequest, toUserMessage } from '@/api/client'
import { uploadWorkPhotos } from '@/api/uploadsApi'
import { CameraCapture, type CameraShot } from '@/components/field/CameraCapture'
import { LivenessCapture } from '@/components/field/LivenessCapture'
import { useGeolocation } from '@/hooks/useGeolocation'
import { hasSectionLocation } from '@/lib/sectionLocation'
import { useAuth } from '@/context/AuthContext'
import { AccountControls } from '@/components/AccountControls'
import { homePathForRole } from '@/lib/roleRoutes'
import { fetchSectionByCode } from '@/api/sectionsApi'
import { buildQrImageUrl } from '@/lib/appConfig'
import { SectionLocationEditor } from '@/components/SectionLocationEditor'
import type { FormFieldSetting, FormSettings } from '@/lib/types'
import { ResultFields, ResultFormPreview } from '@/components/field/ResultFields'
import type { PublicSectionForm } from './SectionEntryPage'

type TaskResult = {
  percent: number
  actualVolume: string
  description: string
  incompleteReason: string
  extra: Record<string, string>
}

type DayTask = {
  id: number
  description: string
  execution?: { id: number; status: string } | null
}

type DayState = {
  section: { id: number; code: string; name: string; latitude: number | null; longitude: number | null; radiusMeters: number | null; object?: { name: string } }
  session: null | { id: number; startedAt: string; status: string; reviewComment: string | null }
  tasks: DayTask[]
  serverTime?: string
  formSettings?: FormSettings
}

const emptyResult = (): TaskResult => ({
  percent: 0,
  actualVolume: '',
  description: '',
  incompleteReason: '',
  extra: {},
})

export function FieldScanPage() {
  const { sectionCode = '' } = useParams()
  const { user } = useAuth()
  return <SectionForm key={`${user!.id}:${user!.role}:${sectionCode}`} sectionCode={sectionCode} />
}

function SectionForm({ sectionCode }: { sectionCode: string }) {
  const { user } = useAuth()
  const preview = ['ADMIN', 'DIRECTOR', 'AKIMAT', 'ANTICOR'].includes(user!.role)
  const { requestGeolocation } = useGeolocation()
  const [state, setState] = useState<DayState | null>(null)
  const [liveness, setLiveness] = useState<CameraShot[]>([])
  const [workPhoto, setWorkPhoto] = useState<CameraShot | null>(null)
  const [captureRevision, setCaptureRevision] = useState(0)
  const prepared = useRef<{ path: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [results, setResults] = useState<Record<number, TaskResult>>({})
  const loadRevision = useRef(0)
  const formSettings = state?.formSettings
  const formFields = formSettings?.fields ?? []
  const coreFields = ['actualVolume', 'description', 'incompleteReason']
  const visibleFields = (result: TaskResult) => formFields.filter(field => field.visible &&
    (field.id !== 'incompleteReason' || result.percent < 100)).sort((a, b) => a.order - b.order)
  const valueOf = (result: TaskResult, field: FormFieldSetting) => coreFields.includes(field.id)
    ? result[field.id as 'actualVolume' | 'description' | 'incompleteReason'] : result.extra[field.id] ?? ''

  const load = useCallback(async () => {
    const revision = ++loadRevision.current
    try {
      let next: DayState
      if (preview) {
        const [section, form] = await Promise.all([fetchSectionByCode(sectionCode), apiRequest<PublicSectionForm>(`/qr/form/${encodeURIComponent(sectionCode)}`)])
        if (!section.is_active || section.objects?.is_active === false) throw new Error('Участок или объект в архиве. Форма для отметки смены недоступна.')
        next = { section: { id: section.id, code: section.code, name: section.name, latitude: section.latitude,
          longitude: section.longitude, radiusMeters: section.radius_meters, object: section.objects }, session: null, tasks: [], formSettings: form.formSettings }
      } else {
        next = await apiRequest<DayState>(`/field/scan/${encodeURIComponent(sectionCode)}`)
      }
      if (revision !== loadRevision.current) return
      setState(next)
      setMessage('')
    } catch (error) {
      if (revision !== loadRevision.current) return
      setState(null)
      setMessage(toUserMessage(error))
    }
  }, [sectionCode, preview])

  useEffect(() => { void load(); return () => { loadRevision.current++ } }, [load])

  function validateResults(tasks: DayTask[]): boolean {
    if (!formSettings) { setMessage('Не удалось загрузить поля формы. Обновите данные участка.'); return false }
    for (const task of tasks) {
      const result = results[task.id] || emptyResult()
      for (const field of visibleFields(result)) {
        const value = valueOf(result, field).trim()
        if (field.required && !(field.id === 'description' && result.percent === 0) && !value) {
          setMessage(field.id === 'incompleteReason'
            ? `Для задачи «${task.description}» укажите причину незавершения`
            : `Для задачи «${task.description}» заполните «${field.label}»`)
          return false
        }
        if (value && ['number', 'percent'].includes(field.type) &&
          (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)) ||
            (field.type === 'percent' && (Number(value) < 0 || Number(value) > 100)))) {
          setMessage(`В поле «${field.label}» укажите корректное число${field.type === 'percent' ? ' от 0 до 100' : ''}`)
          return false
        }
      }
    }
    return true
  }

  async function submit(close: boolean) {
    if (busy || preview) return
    if (!prepared.current && state && !hasSectionLocation({ ...state.section, radius_meters: state.section.radiusMeters })) {
      setMessage('Местоположение участка не настроено. Обратитесь к руководителю.')
      return
    }
    if (!prepared.current && (liveness.length !== 3 || !workPhoto)) {
      setMessage('Обязательны три кадра лица и фото участка')
      return
    }
    if (!prepared.current && close && state && !validateResults(state.tasks)) return

    setBusy(true)
    setMessage('')
    try {
      if (!prepared.current) {
        const geo = await requestGeolocation()
        if (geo.latitude == null || geo.longitude == null) {
          throw new Error('Разрешите точную геолокацию')
        }
        if (geo.accuracy == null || geo.accuracy > 50) throw new Error('Погрешность GPS больше 50 м. Выйдите на открытое место и повторите')
        const [selfieUrls, photoUrls] = await Promise.all([
          uploadWorkPhotos(liveness.map((shot) => shot.file)),
          uploadWorkPhotos([workPhoto!.file]),
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
          prepared.current = { path: '/field/work-days/close', body: JSON.stringify({
              ...evidence,
              sessionId: state!.session!.id,
              resultPhotoUrls: photoUrls,
              results: state!.tasks.map((task) => {
                const result = results[task.id] || emptyResult()
                return { taskId: task.id, ...result,
                  ...Object.fromEntries(coreFields.filter(id => !formFields.some(field => field.id === id && field.visible)).map(id => [id, ''])),
                  extra: Object.fromEntries(Object.entries(result.extra)
                  .filter(([id]) => formFields.some(field => field.id === id && field.visible))) }
              }),
            }),
          }
        } else {
          prepared.current = { path: '/field/work-days/start', body: JSON.stringify({
              ...evidence,
              clientSessionId: crypto.randomUUID(),
              startPhotoUrl: photoUrls[0],
            }),
          }
        }

      }
      await apiRequest(prepared.current.path, { method: 'POST', body: prepared.current.body })
      prepared.current = null
      setCaptureRevision((value) => value + 1)
      setLiveness([])
      setWorkPhoto(null)
      setResults({})
      await load()
      setMessage(close ? formSettings?.formSuccessText || 'Рабочий день завершён' : 'Рабочий день открыт по серверному времени')
    } catch (error) {
      if (error instanceof ApiError && error.status && error.status < 500) prepared.current = null
      setMessage(toUserMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const navigation = <div className="flex items-center justify-between gap-4 rounded-2xl border bg-white p-3">
    <Link to={preview ? '/admin/objects' : homePathForRole(user!.role)} className="text-sm font-semibold text-blue-700">{preview ? '← К объектам' : '← В кабинет'}</Link>
    <AccountControls />
  </div>
  if (!state) return <main className="mx-auto max-w-xl space-y-4 p-4">
    {navigation}
    <p role={message ? 'alert' : 'status'}>{message || 'Проверяем QR…'}</p>
    {message && <button type="button" onClick={() => void load()} className="rounded-xl border p-3">Повторить загрузку</button>}
  </main>
  const locationReady = hasSectionLocation({ ...state.section, radius_meters: state.section.radiusMeters })

  return (
    <main className="mx-auto min-h-screen max-w-md space-y-4 bg-slate-50 p-4 pb-28">
      {navigation}
      <div className="rounded-3xl bg-emerald-800 p-5 text-white">
        <p className="mb-2 text-sm font-semibold">Форма участка</p>
        <div className="text-sm opacity-80">{state.section.object?.name}</div>
        <h1 className="text-2xl font-black">{state.section.name}</h1>
        <div className="mt-2 text-xs">
          QR {state.section.code}{state.serverTime && <> · сервер {new Date(state.serverTime).toLocaleTimeString()}</>}
        </div>
      </div>

      {preview && <section aria-label="Просмотр формы участка" className="space-y-3 rounded-2xl border bg-white p-4 text-sm">
        <h2 className="font-bold">Просмотр формы участка</h2>
        <p>Вы просматриваете форму. Рабочий заполняет её под своим аккаунтом, чтобы смена и фотографии были записаны на него.</p>
        <img src={buildQrImageUrl(sectionCode)} alt={`QR участка ${sectionCode}`} className="mx-auto h-40 w-40" />
        <p>Этот QR открывает форму без входа. Для записи смены сотрудник входит в свой аккаунт и остаётся на этом участке.</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Начало смены: точная геолокация, три кадра лица и фото участка до работы.</li>
          <li>Работа: назначенные задачи, чек-лист и фотографии результата.</li>
          <li>Завершение: повторный QR, геолокация, фото лица, результат и процент выполнения каждой задачи.</li>
          <li>Руководитель проверяет фото и принимает работу или возвращает на доработку.</li>
        </ol>
        {locationReady && <p className="text-emerald-800">Местоположение настроено. Радиус участка: {state.section.radiusMeters ?? 150} м.</p>}
        {['ADMIN', 'DIRECTOR'].includes(user!.role) && <SectionLocationEditor
          key={state.section.id}
          section={{ ...state.section, radius_meters: state.section.radiusMeters }}
          onSaved={(updated) => setState(current => current && ({
            ...current,
            section: { ...current.section, latitude: updated.latitude, longitude: updated.longitude, radiusMeters: updated.radius_meters },
          }))}
        />}
      </section>}

      {preview && formSettings && <ResultFormPreview settings={formSettings}/>}

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
          <p className="mt-1 text-xs text-slate-500">Каждую задачу нужно провести через QR/GPS, фото лица, фото работ и чек-лист.</p>
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

      {!locationReady && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Местоположение участка не настроено. {['ADMIN', 'DIRECTOR'].includes(user!.role) ? 'Нажмите «Настроить местоположение участка» выше и сохраните координаты и радиус.' : 'Попросите руководителя указать координаты и радиус участка.'} До настройки начать или завершить смену нельзя.</p>
        <button type="button" onClick={() => void load()} className="mt-3 font-semibold underline">Обновить данные участка</button>
      </div>}
      <fieldset disabled={preview || busy || !!prepared.current || !locationReady} className="space-y-4">
      <LivenessCapture key={`face-${captureRevision}`} onChange={setLiveness} />
      <CameraCapture key={`work-${captureRevision}`}
        label={state.session ? 'Фото результата' : 'Начальное фото участка'}
        onChange={setWorkPhoto}
      />

      {state.session && (
        <div className="rounded-2xl bg-white p-4">
          <b>{formSettings?.formTitle || 'Результат каждой задачи'}</b>
          {formSettings?.formDescription && <p className="text-sm text-slate-600">{formSettings.formDescription}</p>}
          {formSettings?.formHints && <p className="text-sm text-slate-600">{formSettings.formHints}</p>}
          <button type="button" className="text-sm text-blue-700 underline" onClick={() => void load()}>Обновить поля формы</button>
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
                <ResultFields fields={formFields} percent={result.percent} valueOf={field => valueOf(result, field)}
                  onChange={(field, value) => coreFields.includes(field.id)
                    ? set({ [field.id]: value }) : set({ extra: { ...result.extra, [field.id]: value } })}/>
              </div>
            )
          })}
        </div>
      )}

      </fieldset>
      <button
        disabled={preview || busy || (!locationReady && !prepared.current)}
        onClick={() => void submit(!!state.session)}
        className={`w-full rounded-2xl p-5 text-lg font-black text-white disabled:opacity-50 ${state.session ? 'bg-red-700' : 'bg-emerald-700'}`}
      >
        {busy
          ? 'Сохраняем…'
          : prepared.current
            ? 'Повторить отправку'
            : state.session?.status === 'RETURNED'
            ? 'Исправить и повторно отправить'
            : state.session
              ? formSettings?.formSubmitText || 'Завершить рабочий день'
              : 'Начать рабочий день'}
      </button>
      {message && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}
    </main>
  )
}
