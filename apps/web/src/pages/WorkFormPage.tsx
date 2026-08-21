import { FormEvent, useEffect, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toUserMessage } from '@/api/client'
import { createWorkLog } from '@/api/workLogsApi'
import { fetchSectionByCode, fetchSectionById } from '@/api/sectionsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useGeolocation } from '@/hooks/useGeolocation'
import { OTHER_WORK_TYPE } from '@/lib/constants'
import { formatSubmittedDate, formatSubmittedTime } from '@/lib/dateFilters'
import { defaultFormSettings, fetchFormSettings } from '@/lib/formSettings'
import { uploadWorkPhotos } from '@/lib/photos'
import { fetchActiveWorkTypes } from '@/lib/workTypesApi'
import { fetchOpenTasksForSection, type ApiTask } from '@/api/tasksApi'
import { useAuth } from '@/context/AuthContext'
import type { FormFieldSetting, Section, WorkType } from '@/lib/types'

type FormSettings = typeof defaultFormSettings
const completionOptions = ['25%', '50%', '75%', '100%'] as const
const OTHER_COMPLETION = 'OTHER'
const builtInFieldIds = new Set(['workerName', 'completionPercent', 'photo', 'comment', 'geolocation'])

function orderedVisibleFields(settings: FormSettings): FormFieldSetting[] {
  return [...settings.fields].filter((field) => field.visible).sort((a, b) => a.order - b.order)
}

function fieldById(settings: FormSettings, id: string): FormFieldSetting | undefined {
  return settings.fields.find((field) => field.id === id)
}

function SectionInfoHeader({ section }: { section: Section }) {
  const objectName = section.objects?.name ?? '—'
  return (
    <header className="mb-4 rounded-xl bg-emerald-800 px-4 py-4 text-white">
      <dl className="space-y-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="opacity-80">Объект:</dt>
          <dd className="font-medium">{objectName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="opacity-80">Участок:</dt>
          <dd className="font-medium">{section.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="opacity-80">Культура:</dt>
          <dd className="font-medium">{section.culture ?? '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="opacity-80">Код участка:</dt>
          <dd className="font-mono font-semibold">{section.code}</dd>
        </div>
      </dl>
    </header>
  )
}

function clearFormFields(setters: {
  setWorkerName: (v: string) => void
  setWorkTypeId: (v: string) => void
  setTaskId: (v: string) => void
  setCustomWorkType: (v: string) => void
  setCompletionPercent: (v: string) => void
  setCustomCompletionPercent: (v: string) => void
  setExtraValues: (v: Record<string, string>) => void
  setExtraFiles: (v: Record<string, FileList | null>) => void
  setComment: (v: string) => void
  setPhotos: (v: FileList | null) => void
}) {
  setters.setWorkerName('')
  setters.setWorkTypeId('')
  setters.setTaskId('')
  setters.setCustomWorkType('')
  setters.setCompletionPercent('')
  setters.setCustomCompletionPercent('')
  setters.setExtraValues({})
  setters.setExtraFiles({})
  setters.setComment('')
  setters.setPhotos(null)
}

export function WorkFormPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const { sectionCode } = useParams<{ sectionCode: string }>()

  const objectId = Number(params.get('objectId'))
  const legacySectionId = Number(params.get('sectionId'))

  const [section, setSection] = useState<Section | null>(null)
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [openTasks, setOpenTasks] = useState<ApiTask[]>([])
  const [settings, setSettings] = useState<FormSettings>(defaultFormSettings)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closeHint, setCloseHint] = useState(false)

  const [workerName, setWorkerName] = useState('')
  const [workTypeId, setWorkTypeId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [customWorkType, setCustomWorkType] = useState('')
  const [completionPercent, setCompletionPercent] = useState('')
  const [customCompletionPercent, setCustomCompletionPercent] = useState('')
  const [extraValues, setExtraValues] = useState<Record<string, string>>({})
  const [extraFiles, setExtraFiles] = useState<Record<string, FileList | null>>({})
  const [comment, setComment] = useState('')
  const [photos, setPhotos] = useState<FileList | null>(null)

  const { geo, requestGeolocation } = useGeolocation()
  const selectedType = workTypes.find((w) => String(w.id) === workTypeId)
  const isOther = selectedType?.is_other ?? selectedType?.name === OTHER_WORK_TYPE
  const sessionWorkerName = user?.fullName ?? ''
  const selectedCompletionValue =
    completionPercent === OTHER_COMPLETION
      ? customCompletionPercent.trim()
      : completionPercent
  const visibleFields = orderedVisibleFields(settings)
  const visibleFieldIds = new Set(visibleFields.map((field) => field.id))
  const extraFields = visibleFields.filter((field) => !builtInFieldIds.has(field.id))
  const workerNameField = fieldById(settings, 'workerName')
  const completionField = fieldById(settings, 'completionPercent')
  const photoField = fieldById(settings, 'photo')
  const commentField = fieldById(settings, 'comment')
  const geolocationField = fieldById(settings, 'geolocation')

  function setExtraValue(fieldId: string, value: string) {
    setExtraValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  function setExtraFileValue(fieldId: string, files: FileList | null) {
    setExtraFiles((prev) => ({ ...prev, [fieldId]: files }))
  }

  async function loadWorkTypes() {
    const active = await fetchActiveWorkTypes()
    setWorkTypes(active)
  }

  function createNewReport() {
    setSuccess(false)
    setSubmittedAt(null)
    setError(null)
    setCloseHint(false)
    clearFormFields({
      setWorkerName,
      setWorkTypeId,
      setTaskId,
      setCustomWorkType,
      setCompletionPercent,
      setCustomCompletionPercent,
      setExtraValues,
      setExtraFiles,
      setComment,
      setPhotos,
    })
    if (sessionWorkerName) {
      setWorkerName(sessionWorkerName)
    }
    void loadWorkTypes()
  }

  function closePage() {
    setCloseHint(false)
    window.close()
    window.setTimeout(() => setCloseHint(true), 300)
  }

  useEffect(() => {
    if (sessionWorkerName && !workerName.trim()) {
      setWorkerName(sessionWorkerName)
    }
  }, [sessionWorkerName, workerName])

  useEffect(() => {
    async function load() {
      const hasPath = !!sectionCode
      const hasLegacy = !!objectId && !!legacySectionId
      if (!hasPath && !hasLegacy) {
        setError('Неверная ссылка QR. Отсканируйте код на участке.')
        setLoading(false)
        return
      }

      let nextSettings = defaultFormSettings
      try {
        nextSettings = await fetchFormSettings()
        setSettings(nextSettings)
        const sec = hasPath
          ? await fetchSectionByCode(sectionCode!)
          : await fetchSectionById(legacySectionId)
        setSection(sec)
        await loadWorkTypes()
        const tasks = await fetchOpenTasksForSection(sec.id).catch(() => [])
        setOpenTasks(tasks)
      } catch (err) {
        console.error('[work-form] load:', err)
        setError(toUserMessage(err, 'Участок не найден'))
      }
      setLoading(false)
      if (fieldById(nextSettings, 'geolocation')?.visible !== false) {
        void requestGeolocation()
      }
    }
    void load()
  }, [objectId, legacySectionId, requestGeolocation, sectionCode])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && section && !success) {
        void loadWorkTypes()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [section, success])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!section) return
    if (workerNameField?.visible !== false && workerNameField?.required && !sessionWorkerName && !workerName.trim()) {
      setError(`Заполните поле: ${workerNameField.label}`)
      return
    }
    if (!workTypeId) {
      setError('Выберите вид работы')
      return
    }
    if (isOther && !customWorkType.trim()) {
      setError('Укажите вид работы вручную')
      return
    }
    if (completionField?.visible !== false && completionField?.required && !completionPercent) {
      setError(`Заполните поле: ${completionField.label}`)
      return
    }
    if (completionField?.visible !== false && completionPercent === OTHER_COMPLETION) {
      const parsed = Number(customCompletionPercent)
      if (!customCompletionPercent.trim() || !Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
        setError('Укажите процент выполнения от 1 до 100')
        return
      }
    }
    if (completionField?.visible !== false && completionField?.required && !selectedCompletionValue) {
      setError(`Заполните поле: ${completionField.label}`)
      return
    }
    if (photoField?.visible !== false && photoField?.required && !photos?.length) {
      setError(`Заполните поле: ${photoField.label}`)
      return
    }
    if (
      geolocationField?.visible !== false &&
      geolocationField?.required &&
      (geo.latitude == null || geo.longitude == null)
    ) {
      setError('Разрешите геолокацию для отправки отчета')
      return
    }
    for (const field of extraFields) {
      if (!field.required) continue
      if (field.type === 'photo') {
        if (!extraFiles[field.id]?.length) {
          setError(`Заполните поле: ${field.label}`)
          return
        }
      } else if (!extraValues[field.id]?.trim()) {
        setError(`Заполните поле: ${field.label}`)
        return
      }
    }

    setSubmitting(true)
    try {
      const geoResult = geo.status === 'pending' ? await requestGeolocation() : geo
      const photoUrls = photoField?.visible === false || !photos?.length ? [] : await uploadWorkPhotos(Array.from(photos))
      const extraPhotoEntries: string[] = []
      for (const field of extraFields.filter((f) => f.type === 'photo')) {
        const files = extraFiles[field.id]
        if (!files?.length) continue
        const uploaded = await uploadWorkPhotos(Array.from(files))
        photoUrls.push(...uploaded)
        extraPhotoEntries.push(`${field.label}: ${uploaded.join(', ')}`)
      }
      const extraEntries = extraFields
        .filter((field) => field.type !== 'photo')
        .map((field) => {
          const value = extraValues[field.id]?.trim()
          return value ? `${field.label}: ${value}` : null
        })
        .filter(Boolean) as string[]
      const extraComment = [...extraEntries, ...extraPhotoEntries]
      const commentParts = [
        commentField?.visible === false ? '' : comment.trim(),
        extraComment.length ? `Дополнительные поля:\n${extraComment.join('\n')}` : '',
      ].filter(Boolean)
      const hasCoords = geoResult.latitude != null && geoResult.longitude != null

      const created = await createWorkLog({
        sectionId: section.id,
        workerFullName: workerNameField?.visible === false ? 'Не указано' : workerName.trim(),
        workTypeId: Number(workTypeId),
        taskId: taskId ? Number(taskId) : undefined,
        customWorkType: isOther ? customWorkType.trim() : null,
        workVolume:
          completionField?.visible === false || !selectedCompletionValue
            ? '—'
            : `${selectedCompletionValue.replace('%', '')}%`,
        comment: commentParts.join('\n\n'),
        photoUrls,
        latitude: geolocationField?.visible === false ? null : geoResult.latitude,
        longitude: geolocationField?.visible === false ? null : geoResult.longitude,
        locationAccuracy: geolocationField?.visible === false ? null : geoResult.accuracy,
        locationAllowed: geolocationField?.visible !== false && geoResult.status === 'granted' && hasCoords,
      })

      clearFormFields({
        setWorkerName,
        setWorkTypeId,
        setTaskId,
        setCustomWorkType,
        setCompletionPercent,
        setCustomCompletionPercent,
        setExtraValues,
        setExtraFiles,
        setComment,
        setPhotos,
      })
      setSubmittedAt(created.submitted_at)
      setSuccess(true)
      setCloseHint(false)
    } catch (err) {
      console.error('[work-form] submit:', err)
      setError(toUserMessage(err, 'Не удалось сохранить отчет'))
    } finally {
      setSubmitting(false)
    }
  }

  const renderWorkTypeFields = () => (
    <>
      <Select
        label="Вид работы *"
        value={workTypeId}
        onChange={(e) => setWorkTypeId(e.target.value)}
        required
        options={[
          { value: '', label: '— выберите —' },
          ...workTypes.map((t) => ({ value: String(t.id), label: t.name })),
        ]}
      />

      {isOther && (
        <Input
          label="Укажите вид работы *"
          value={customWorkType}
          onChange={(e) => setCustomWorkType(e.target.value)}
          required
        />
      )}

      {openTasks.length > 0 && (
        <Select
          label="Выберите задачу"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          options={[
            { value: '', label: '— без задачи —' },
            ...openTasks.map((t) => ({
              value: String(t.id),
              label: `${t.workType?.name ?? 'Задача'} · ${t.description || 'без описания'}`,
            })),
          ]}
        />
      )}
    </>
  )

  const renderFieldHint = (field: FormFieldSetting) =>
    field.hint ? <p className="mt-1 text-xs text-slate-500">{field.hint}</p> : null

  const renderCompletionField = (field: FormFieldSetting) => (
    <div key={field.id}>
      <p className="mb-2 block text-sm font-medium text-slate-700">
        {field.label}
        {field.required ? ' *' : ''}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {completionOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setCompletionPercent(option)
              setCustomCompletionPercent('')
            }}
            className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${
              completionPercent === option
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400'
            }`}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCompletionPercent(OTHER_COMPLETION)}
          className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${
            completionPercent === OTHER_COMPLETION
              ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
              : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400'
          }`}
        >
          Другое
        </button>
      </div>
      {completionPercent === OTHER_COMPLETION && (
        <Input
          label={`${field.label} *`}
          type="number"
          min={1}
          max={100}
          inputMode="numeric"
          value={customCompletionPercent}
          onChange={(e) => setCustomCompletionPercent(e.target.value)}
          placeholder="Например, 60"
          className="mt-3"
          required={field.required}
        />
      )}
      {renderFieldHint(field)}
    </div>
  )

  const renderGeolocationField = (field: FormFieldSetting) => (
    <div key={field.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <span>
        {field.label}
        {field.required ? ' *' : ''}:{' '}
        {geo.status === 'granted'
          ? `получена${geo.accuracy != null ? ` (±${Math.round(geo.accuracy)} м)` : ''}`
          : geo.status === 'denied'
            ? 'не разрешена'
            : geo.status === 'unsupported'
              ? 'не поддерживается'
              : 'ожидание…'}
      </span>
      {geo.mapUrl && (
        <>
          <span className="mx-2">·</span>
          <a href={geo.mapUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
            на карте
          </a>
        </>
      )}
      {renderFieldHint(field)}
    </div>
  )

  const renderExtraField = (field: FormFieldSetting) => {
    const label = `${field.label}${field.required ? ' *' : ''}`
    const value = extraValues[field.id] ?? ''

    if (field.type === 'comment') {
      return (
        <div key={field.id}>
          <Textarea label={label} value={value} onChange={(e) => setExtraValue(field.id, e.target.value)} />
          {renderFieldHint(field)}
        </div>
      )
    }
    if (field.type === 'select') {
      return (
        <div key={field.id}>
          <Select
            label={label}
            value={value}
            onChange={(e) => setExtraValue(field.id, e.target.value)}
            options={[
              { value: '', label: '— выберите —' },
              ...(field.options ?? []).map((option) => ({ value: option, label: option })),
            ]}
          />
          {renderFieldHint(field)}
        </div>
      )
    }
    if (field.type === 'boolean') {
      return (
        <div key={field.id}>
          <Select
            label={label}
            value={value}
            onChange={(e) => setExtraValue(field.id, e.target.value)}
            options={[
              { value: '', label: '— выберите —' },
              { value: 'Да', label: 'Да' },
              { value: 'Нет', label: 'Нет' },
            ]}
          />
          {renderFieldHint(field)}
        </div>
      )
    }
    if (field.type === 'photo') {
      return (
        <div key={field.id}>
          <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="w-full text-sm"
            onChange={(e) => setExtraFileValue(field.id, e.target.files)}
            required={field.required}
          />
          {renderFieldHint(field)}
        </div>
      )
    }
    return (
      <div key={field.id}>
        <Input
          label={label}
          type={field.type === 'number' || field.type === 'percent' ? 'number' : 'text'}
          min={field.type === 'percent' ? 0 : undefined}
          max={field.type === 'percent' ? 100 : undefined}
          value={value}
          onChange={(e) => setExtraValue(field.id, e.target.value)}
          required={field.required}
        />
        {renderFieldHint(field)}
      </div>
    )
  }

  const renderConfiguredField = (field: FormFieldSetting) => {
    if (field.id === 'workerName') {
      return (
        <div key={field.id}>
          <Input
            label={`${field.label}${field.required ? ' *' : ''}`}
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
            readOnly={!!sessionWorkerName}
            className={sessionWorkerName ? 'bg-slate-50 text-slate-600' : ''}
            required={field.required}
          />
          {sessionWorkerName && (
            <p className="mt-1 text-xs text-slate-500">
              Используется текущая сессия: {sessionWorkerName}
            </p>
          )}
          {renderFieldHint(field)}
        </div>
      )
    }
    if (field.id === 'completionPercent') return renderCompletionField(field)
    if (field.id === 'photo') {
      return (
        <div key={field.id}>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {field.label}
            {field.required ? ' *' : ''}
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="w-full text-sm"
            onChange={(e) => setPhotos(e.target.files)}
            required={field.required}
          />
          {renderFieldHint(field)}
        </div>
      )
    }
    if (field.id === 'comment') {
      return (
        <div key={field.id}>
          <Textarea
            label={`${field.label}${field.required ? ' *' : ''}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={field.hint ?? 'Необязательно'}
            required={field.required}
          />
        </div>
      )
    }
    if (field.id === 'geolocation') return renderGeolocationField(field)
    return renderExtraField(field)
  }

  const shell = (children: ReactNode) => (
    <div className="mx-auto min-h-screen max-w-lg p-4 pb-8 pt-4">{children}</div>
  )

  if (loading) {
    return shell(
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-600">Загрузка формы...</p>
      </div>
    )
  }

  if (error && !section) {
    return shell(
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-red-600">{error}</p>
        <button
          type="button"
          onClick={closePage}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Закрыть страницу
        </button>
        {closeHint && (
          <p className="text-sm text-slate-600">Теперь можно просто закрыть эту вкладку.</p>
        )}
      </div>
    )
  }

  if (success && section && submittedAt) {
    const objectName = section.objects?.name ?? '—'

    return shell(
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 py-6 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="text-xl font-bold text-emerald-800">{settings.formSuccessText}</h1>
        <p className="text-sm text-slate-600">Спасибо! Ваш отчет успешно сохранен.</p>
        <dl className="space-y-1 text-sm text-slate-700">
          <div>
            <dt className="inline font-medium">Объект: </dt>
            <dd className="inline">{objectName}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Участок: </dt>
            <dd className="inline">{section.name}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Дата и время: </dt>
            <dd className="inline">
              {formatSubmittedDate(submittedAt)} {formatSubmittedTime(submittedAt)}
            </dd>
          </div>
        </dl>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            onClick={createNewReport}
            className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Отправить еще один отчет
          </button>
          <button
            type="button"
            onClick={closePage}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Закрыть страницу
          </button>
        </div>
        {closeHint && (
          <p className="text-sm text-slate-600">
            Отчет успешно отправлен. Теперь можно просто закрыть эту вкладку.
          </p>
        )}
      </div>
    )
  }

  if (!section) return null

  return shell(
    <>
      <SectionInfoHeader section={section} />

      <h1 className="mb-2 text-xl font-bold text-slate-900">{settings.formTitle}</h1>

      {settings.formDescription && (
        <p className="mb-4 text-sm text-slate-600">{settings.formDescription}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!visibleFieldIds.has('workerName') && renderWorkTypeFields()}
        {visibleFields.map((field) => (
          <div key={field.id}>
            {renderConfiguredField(field)}
            {field.id === 'workerName' && renderWorkTypeFields()}
          </div>
        ))}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {settings.formHints && (
          <p className="text-xs text-slate-500">{settings.formHints}</p>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Отправка…' : settings.formSubmitText}
        </Button>
      </form>
    </>
  )
}
