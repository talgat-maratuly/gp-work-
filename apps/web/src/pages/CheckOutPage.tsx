import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { checkOut, fetchActiveWorkersToday, type ActiveWorker } from '@/api/attendanceApi'
import { toUserMessage } from '@/api/client'
import { uploadWorkPhotos } from '@/api/uploadsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useGeolocation } from '@/hooks/useGeolocation'
import { formatSubmittedDate, formatSubmittedTime } from '@/lib/dateFilters'
import { defaultCheckoutFormSettings, fetchFormSettings } from '@/lib/formSettings'
import type { FormFieldSetting, FormSettings } from '@/lib/types'

const PERCENT_FIELD_ID = 'completionPercent'

export function CheckOutPage() {
  const [settings, setSettings] = useState<FormSettings>(defaultCheckoutFormSettings)
  const [workers, setWorkers] = useState<ActiveWorker[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualName, setManualName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Значения настраиваемых полей формы ухода, по id поля.
  const [values, setValues] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<Record<string, string[]>>({})
  const { geo, requestGeolocation } = useGeolocation()

  useEffect(() => {
    void fetchFormSettings('checkout_form')
      .then(setSettings)
      .catch(() => setSettings(defaultCheckoutFormSettings))
    void fetchActiveWorkersToday()
      .then(setWorkers)
      .catch((err) => {
        console.error('[check-out]', err)
        setError(toUserMessage(err, 'Не удалось загрузить список'))
      })
      .finally(() => setLoading(false))
    void requestGeolocation()
  }, [requestGeolocation])

  const visibleFields = useMemo(
    () => settings.fields.filter((f) => f.visible).sort((a, b) => a.order - b.order),
    [settings.fields],
  )

  const setValue = (id: string, value: string) => setValues((prev) => ({ ...prev, [id]: value }))

  async function handlePhoto(field: FormFieldSetting, e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    try {
      const urls = await uploadWorkPhotos(files)
      setPhotos((prev) => ({ ...prev, [field.id]: [...(prev[field.id] ?? []), ...urls] }))
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось загрузить фото'))
    }
  }

  function validate(): string | null {
    for (const field of visibleFields) {
      if (field.id === PERCENT_FIELD_ID) {
        const raw = values[field.id]?.trim() ?? ''
        if (!raw) {
          if (field.required) return `Заполните поле: ${field.label}`
          continue
        }
        const num = Number(raw)
        if (!Number.isInteger(num) || num < 0 || num > 100) {
          return 'Процент выполненной работы должен быть целым числом от 0 до 100'
        }
        continue
      }
      if (field.type === 'photo') {
        if (field.required && !(photos[field.id]?.length)) return `Прикрепите: ${field.label}`
        continue
      }
      if (field.type === 'boolean') continue
      if (field.required && !values[field.id]?.trim()) return `Заполните поле: ${field.label}`
    }
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      const hasCoords = geo.latitude != null && geo.longitude != null

      // Процент — отдельным полем; остальные видимые поля — в extraValues (по названию).
      const percentRaw = values[PERCENT_FIELD_ID]?.trim()
      const completionPercent =
        percentRaw != null && percentRaw !== '' ? Number(percentRaw) : undefined

      const extraValues: Record<string, unknown> = {}
      for (const field of visibleFields) {
        if (field.id === PERCENT_FIELD_ID) continue
        if (field.type === 'photo') {
          if (photos[field.id]?.length) extraValues[field.label] = photos[field.id]
          continue
        }
        if (field.type === 'boolean') {
          extraValues[field.label] = values[field.id] === 'true'
          continue
        }
        const v = values[field.id]?.trim()
        if (v) extraValues[field.label] = v
      }

      const result = await checkOut({
        attendanceId: manualMode ? undefined : selectedId ?? undefined,
        workerFullName: manualMode ? manualName.trim() : undefined,
        latitude: geo.latitude ?? undefined,
        longitude: geo.longitude ?? undefined,
        locationAccuracy: geo.accuracy ?? undefined,
        locationAllowed: hasCoords,
        completionPercent,
        extraValues: Object.keys(extraValues).length ? extraValues : undefined,
      })
      setCheckOutTime(result.checkOutTime)
      setSuccess(true)
    } catch (err) {
      console.error('[check-out/submit]', err)
      setError(toUserMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (success && checkOutTime) {
    return (
      <div className="mx-auto min-h-screen max-w-lg bg-slate-50 p-4">
        <div className="rounded-xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-emerald-800">{settings.formSuccessText}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {formatSubmittedDate(checkOutTime)} в {formatSubmittedTime(checkOutTime)}
          </p>
          <p className="mt-4 text-sm text-slate-500">Хорошего отдыха!</p>
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-6 w-full rounded-lg border border-slate-300 py-2.5 text-sm text-slate-700"
          >
            Закрыть страницу
          </button>
        </div>
      </div>
    )
  }

  const canSubmit = manualMode ? manualName.trim().length > 0 : selectedId != null

  const renderField = (field: FormFieldSetting) => {
    const label = `${field.label}${field.required ? ' *' : ''}`

    // Процент выполненной работы — числовое поле 0..100 с обозначением «%».
    if (field.id === PERCENT_FIELD_ID) {
      return (
        <div key={field.id}>
          <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={values[field.id] ?? ''}
              onChange={(e) => setValue(field.id, e.target.value)}
              placeholder="0–100"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <span className="text-lg font-semibold text-slate-500">%</span>
          </div>
          {field.hint && <p className="mt-1 text-xs text-slate-500">{field.hint}</p>}
        </div>
      )
    }

    if (field.type === 'comment' || field.type === 'text') {
      const isComment = field.type === 'comment'
      return (
        <label key={field.id} className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
          {isComment ? (
            <textarea
              rows={3}
              value={values[field.id] ?? ''}
              onChange={(e) => setValue(field.id, e.target.value)}
              placeholder={field.hint ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          ) : (
            <input
              value={values[field.id] ?? ''}
              onChange={(e) => setValue(field.id, e.target.value)}
              placeholder={field.hint ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          )}
        </label>
      )
    }

    if (field.type === 'number') {
      return (
        <label key={field.id} className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
          <input
            type="number"
            value={values[field.id] ?? ''}
            onChange={(e) => setValue(field.id, e.target.value)}
            placeholder={field.hint ?? ''}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          />
        </label>
      )
    }

    if (field.type === 'select') {
      return (
        <label key={field.id} className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
          <select
            value={values[field.id] ?? ''}
            onChange={(e) => setValue(field.id, e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
          >
            <option value="">— выберите —</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      )
    }

    if (field.type === 'boolean') {
      return (
        <label key={field.id} className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values[field.id] === 'true'}
            onChange={(e) => setValue(field.id, e.target.checked ? 'true' : 'false')}
          />
          {field.label}
        </label>
      )
    }

    if (field.type === 'photo') {
      return (
        <div key={field.id}>
          <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
          <input type="file" accept="image/*" multiple onChange={(e) => void handlePhoto(field, e)} />
          {photos[field.id]?.length ? (
            <p className="mt-1 text-xs text-emerald-700">Загружено фото: {photos[field.id].length}</p>
          ) : null}
        </div>
      )
    }

    return null
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 p-4">
      <header className="mb-4 rounded-xl bg-linear-to-r from-emerald-700 to-blue-800 px-4 py-4 text-white">
        <h1 className="text-lg font-bold">{settings.formTitle}</h1>
        {settings.formDescription && <p className="mt-1 text-sm opacity-90">{settings.formDescription}</p>}
      </header>

      {loading ? (
        <p className="text-center text-slate-500">Загрузка…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
          {!manualMode ? (
            <>
              <p className="text-sm font-medium text-slate-700">Выберите себя из списка</p>
              {workers.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Сегодня ещё никто не начал смену. Сначала отправьте отчёт с QR-кода участка.
                </p>
              ) : (
                <ul className="space-y-2">
                  {workers.map((w) => (
                    <li key={w.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 ${
                          selectedId === w.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="worker"
                          checked={selectedId === w.id}
                          onChange={() => setSelectedId(w.id)}
                          className="text-blue-700"
                        />
                        <span>
                          <span className="block font-medium">{w.workerFullName}</span>
                          <span className="text-xs text-slate-500">
                            Приход: {formatSubmittedTime(w.checkInTime)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => {
                  setManualMode(true)
                  setSelectedId(null)
                }}
                className="text-sm text-blue-700 underline"
              >
                Меня нет в списке
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">Введите ФИО вручную — только если вас нет в списке.</p>
              <Input
                label="ФИО"
                placeholder="ФИО *"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => {
                  setManualMode(false)
                  setManualName('')
                }}
                className="text-sm text-blue-700 underline"
              >
                ← Вернуться к списку
              </button>
            </>
          )}

          {/* Настраиваемые поля формы ухода */}
          {visibleFields.length > 0 && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              {visibleFields.map((field) => renderField(field))}
            </div>
          )}

          {geo.status === 'denied' && (
            <p className="text-xs text-amber-700">Геолокация недоступна. Уход будет сохранён без координат.</p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={!canSubmit || submitting} className="w-full">
            {submitting ? 'Сохранение…' : settings.formSubmitText}
          </Button>
        </form>
      )}
    </div>
  )
}
