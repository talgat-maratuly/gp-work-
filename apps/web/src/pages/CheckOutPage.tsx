import { FormEvent, useEffect, useState } from 'react'
import { checkOut, fetchActiveWorkersToday, type ActiveWorker } from '@/api/attendanceApi'
import { toUserMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useGeolocation } from '@/hooks/useGeolocation'
import { formatSubmittedDate, formatSubmittedTime } from '@/lib/dateFilters'

export function CheckOutPage() {
  const [workers, setWorkers] = useState<ActiveWorker[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualName, setManualName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { geo, requestGeolocation } = useGeolocation()

  useEffect(() => {
    void fetchActiveWorkersToday()
      .then(setWorkers)
      .catch((err) => {
        console.error('[check-out]', err)
        setError(toUserMessage(err, 'Не удалось загрузить список'))
      })
      .finally(() => setLoading(false))
    void requestGeolocation()
  }, [requestGeolocation])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const hasCoords = geo.latitude != null && geo.longitude != null
      const result = await checkOut({
        attendanceId: manualMode ? undefined : selectedId ?? undefined,
        workerFullName: manualMode ? manualName.trim() : undefined,
        latitude: geo.latitude ?? undefined,
        longitude: geo.longitude ?? undefined,
        locationAccuracy: geo.accuracy ?? undefined,
        locationAllowed: hasCoords,
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
          <h1 className="text-xl font-bold text-emerald-800">Уход отмечен</h1>
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

  const canSubmit = manualMode
    ? manualName.trim().length > 0
    : selectedId != null

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 p-4">
      <header className="mb-4 rounded-xl bg-emerald-800 px-4 py-4 text-white">
        <h1 className="text-lg font-bold">Отметка ухода</h1>
        <p className="mt-1 text-sm opacity-90">Выберите себя из списка сотрудников на смене</p>
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
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="worker"
                          checked={selectedId === w.id}
                          onChange={() => setSelectedId(w.id)}
                          className="text-emerald-700"
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
                className="text-sm text-emerald-700 underline"
              >
                Меня нет в списке
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Введите ФИО вручную — только если вас нет в списке.
              </p>
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
                className="text-sm text-emerald-700 underline"
              >
                ← Вернуться к списку
              </button>
            </>
          )}

          {geo.status === 'denied' && (
            <p className="text-xs text-amber-700">
              Геолокация недоступна. Уход будет сохранён без координат.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={!canSubmit || submitting} className="w-full">
            {submitting ? 'Сохранение…' : 'Отметить уход'}
          </Button>
        </form>
      )}
    </div>
  )
}
