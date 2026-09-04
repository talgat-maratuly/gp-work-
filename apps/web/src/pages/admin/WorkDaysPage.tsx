import { useCallback, useEffect, useState } from 'react'
import { apiRequest, resolveAssetUrl, toUserMessage } from '@/api/client'

type TaskResult = {
  taskId: number
  description: string
  percent: number
  actualVolume: string | null
  workDescription: string | null
  incompleteReason: string | null
}

type Day = {
  id: number
  status: string
  startedAt: string
  closedAt: string | null
  overallPercent: number
  startDistanceMeters: number | null
  endDistanceMeters: number | null
  startSelfieUrl: string
  startLivenessEvidenceUrls: string[]
  startPhotoUrl: string
  endSelfieUrl: string | null
  endLivenessEvidenceUrls: string[]
  resultPhotoUrls: string[]
  taskResults: TaskResult[]
  summary: string | null
  incompleteReasons: Record<string, string>
  reviewComment: string | null
  user: { fullName: string }
  section: { name: string; object?: { name: string } }
}

const statusStyle: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-amber-100 text-amber-800',
  REVIEWED: 'bg-emerald-100 text-emerald-800',
  RETURNED: 'bg-red-100 text-red-800',
}

export function WorkDaysPage() {
  const [days, setDays] = useState<Day[]>([])
  const [comments, setComments] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDays(await apiRequest<Day[]>('/field/work-days'))
      setError('')
    } catch (loadError) {
      setError(toUserMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function review(id: number, accepted: boolean) {
    const comment = comments[id]?.trim() || ''
    if (!accepted && !comment) {
      setError('При возврате смены обязательно укажите причину для работника')
      return
    }
    setBusyId(id)
    setError('')
    try {
      await apiRequest(`/field/work-days/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ accepted, comment: comment || undefined }),
      })
      setComments((old) => ({ ...old, [id]: '' }))
      await load()
    } catch (reviewError) {
      setError(toUserMessage(reviewError))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black">Рабочие дни</h1>
        <p className="text-slate-500">QR, GPS, селфи, результаты задач и итоговая приёмка</p>
      </div>
      {error && <div className="rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}
      {loading && <div className="rounded-xl bg-white p-8 text-center text-slate-500">Загрузка смен…</div>}
      {!loading && days.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center text-slate-500">Рабочих смен пока нет</div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {days.map((day) => {
          const evidence = [...new Set([
            day.startSelfieUrl,
            ...day.startLivenessEvidenceUrls,
            day.startPhotoUrl,
            day.endSelfieUrl,
            ...day.endLivenessEvidenceUrls,
            ...day.resultPhotoUrls,
          ].filter(Boolean) as string[])]
          return (
            <article key={day.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <b className="text-lg">{day.user.fullName}</b>
                  <div className="text-sm text-slate-500">
                    {day.section.object?.name} · {day.section.name}
                  </div>
                </div>
                <span className={`h-fit rounded-full px-3 py-1 text-xs font-bold ${statusStyle[day.status] || 'bg-slate-100'}`}>
                  {day.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>Приход: {new Date(day.startedAt).toLocaleString()}</div>
                <div>Уход: {day.closedAt ? new Date(day.closedAt).toLocaleString() : 'на объекте'}</div>
                <div>GPS приход: {day.startDistanceMeters == null ? '—' : `${Math.round(day.startDistanceMeters)} м`}</div>
                <div>GPS уход: {day.endDistanceMeters == null ? '—' : `${Math.round(day.endDistanceMeters)} м`}</div>
                <div>Общий результат: <b>{day.overallPercent}%</b></div>
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto">
                {evidence.map((url, index) => (
                  <a key={`${url}-${index}`} href={resolveAssetUrl(url)} target="_blank" rel="noreferrer">
                    <img src={resolveAssetUrl(url)} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                  </a>
                ))}
              </div>

              {day.taskResults?.length > 0 && (
                <section className="mt-4 space-y-2">
                  <h2 className="font-black">Результаты задач</h2>
                  {day.taskResults.map((result) => (
                    <div key={result.taskId} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex justify-between gap-2">
                        <b>#{result.taskId} {result.description}</b>
                        <b>{result.percent}%</b>
                      </div>
                      {result.actualVolume && <p>Фактический объём: {result.actualVolume}</p>}
                      {result.workDescription && <p>Выполнено: {result.workDescription}</p>}
                      {result.incompleteReason && (
                        <p className="text-amber-800">Причина: {result.incompleteReason}</p>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {day.summary && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{day.summary}</p>}
              {day.status === 'RETURNED' && day.reviewComment && (
                <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  Возвращено на исправление: {day.reviewComment}
                </div>
              )}
              {day.status === 'CLOSED' && (
                <div className="mt-4 space-y-2">
                  <textarea
                    value={comments[day.id] || ''}
                    onChange={(event) => setComments((old) => ({ ...old, [day.id]: event.target.value }))}
                    placeholder="Комментарий; обязателен при возврате"
                    className="w-full rounded-xl border p-3 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === day.id}
                      onClick={() => void review(day.id, true)}
                      className="flex-1 rounded-xl bg-emerald-700 p-3 font-bold text-white disabled:opacity-50"
                    >
                      Подтвердить
                    </button>
                    <button
                      disabled={busyId === day.id}
                      onClick={() => void review(day.id, false)}
                      className="flex-1 rounded-xl bg-red-700 p-3 font-bold text-white disabled:opacity-50"
                    >
                      Вернуть
                    </button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
