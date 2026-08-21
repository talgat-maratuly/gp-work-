import { FormEvent, useEffect, useState } from 'react'
import {
  acceptMyTask,
  completeMyTask,
  fetchMyTask,
  fetchMyTasks,
  PRIORITY_LABELS,
  startMyTask,
  TASK_STATUS_LABELS,
  type MyTask,
} from '@/api/tasksApi'
import { toUserMessage } from '@/api/client'
import { uploadWorkPhotos } from '@/lib/photos'

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

export function MyTasksPage() {
  const [tasks, setTasks] = useState<MyTask[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<MyTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [completeComment, setCompleteComment] = useState('')
  const [completePhotos, setCompletePhotos] = useState<File[]>([])
  const [completePreviews, setCompletePreviews] = useState<string[]>([])

  async function reloadList() {
    const data = await fetchMyTasks()
    setTasks(data)
  }

  useEffect(() => {
    void reloadList()
      .catch((err) => {
        console.error('[my/tasks]', err)
        setError('Не удалось загрузить задачи')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null)
      setCompleteComment('')
      setCompletePhotos([])
      setCompletePreviews([])
      return
    }
    void fetchMyTask(selectedId)
      .then(setDetail)
      .catch((err) => {
        console.error('[my/task]', err)
        setError('Не удалось загрузить задачу')
      })
  }, [selectedId])

  useEffect(() => {
    return () => {
      completePreviews.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [completePreviews])

  function handlePhotosChange(files: FileList | null) {
    if (!files?.length) return
    const next = [...completePhotos, ...Array.from(files)]
    setCompletePhotos(next)
    setCompletePreviews(next.map((file) => URL.createObjectURL(file)))
  }

  async function runAction(action: () => Promise<MyTask>) {
    setActionLoading(true)
    setError(null)
    try {
      const updated = await action()
      setDetail(updated)
      await reloadList()
    } catch (err) {
      console.error('[my/task/action]', err)
      setError(toUserMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleComplete(e: FormEvent) {
    e.preventDefault()
    if (!detail || !completePhotos.length) {
      setError('Для завершения задачи обязательно прикрепите фото')
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const photoUrls = await uploadWorkPhotos(completePhotos)
      const updated = await completeMyTask(detail.id, {
        photoUrls,
        comment: completeComment.trim() || undefined,
      })
      setDetail(updated)
      setCompleteComment('')
      setCompletePhotos([])
      setCompletePreviews([])
      await reloadList()
    } catch (err) {
      console.error('[my/task/complete]', err)
      setError(toUserMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <p className="text-center text-slate-500">Загрузка…</p>
  }

  if (detail && selectedId != null) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="text-sm text-emerald-700 underline"
        >
          ← К списку задач
        </button>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold">{detail.sectionName}</h1>
          <p className="text-sm text-slate-500">{detail.objectName}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Срок</dt>
              <dd className="font-medium">{detail.dueDate ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Вид работы</dt>
              <dd className="font-medium">{detail.workTypeName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Статус</dt>
              <dd className="font-medium">{TASK_STATUS_LABELS[detail.status]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Приоритет</dt>
              <dd className="font-medium">{PRIORITY_LABELS[detail.priority]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Описание</dt>
              <dd>{detail.description || '—'}</dd>
            </div>
            {detail.acceptedAt && (
              <div>
                <dt className="text-slate-500">Принята</dt>
                <dd className="font-medium">{formatDateTime(detail.acceptedAt)}</dd>
              </div>
            )}
            {detail.completedAt && (
              <div>
                <dt className="text-slate-500">Завершена</dt>
                <dd className="font-medium">{formatDateTime(detail.completedAt)}</dd>
              </div>
            )}
            {detail.completionComment && (
              <div>
                <dt className="text-slate-500">Комментарий при завершении</dt>
                <dd>{detail.completionComment}</dd>
              </div>
            )}
            {detail.completionPhotoUrls.length > 0 && (
              <div>
                <dt className="mb-2 text-slate-500">Фото завершения</dt>
                <dd className="flex flex-wrap gap-2">
                  {detail.completionPhotoUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="" className="h-20 w-20 rounded border object-cover" />
                    </a>
                  ))}
                </dd>
              </div>
            )}
            {detail.reviewComment && (
              <div>
                <dt className="text-slate-500">Комментарий проверки</dt>
                <dd>{detail.reviewComment}</dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {detail.status === 'ASSIGNED' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void runAction(() => acceptMyTask(detail.id))}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Принять задачу
              </button>
            )}
            {detail.status === 'ACCEPTED' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void runAction(() => startMyTask(detail.id))}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Начать работу
              </button>
            )}
          </div>

          {detail.status === 'IN_PROGRESS' && (
            <form onSubmit={handleComplete} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">Завершение задачи</p>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Фото *</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handlePhotosChange(e.target.files)}
                  className="block w-full text-sm"
                  required
                />
                {completePreviews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {completePreviews.map((url) => (
                      <img key={url} src={url} alt="" className="h-16 w-16 rounded border object-cover" />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Комментарий</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                  value={completeComment}
                  onChange={(e) => setCompleteComment(e.target.value)}
                  placeholder="Комментарий к выполненной работе"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading || completePhotos.length === 0}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {actionLoading ? 'Отправка…' : 'Завершить задачу'}
              </button>
            </form>
          )}
        </article>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Здесь отображаются задачи, назначенные вам. Примите задачу, начните работу и завершите её с фотоотчётом.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          Назначенных задач пока нет
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelectedId(t.id)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-emerald-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{t.sectionName}</p>
                    <p className="text-sm text-slate-500">{t.workTypeName ?? 'Без вида работы'}</p>
                  </div>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {TASK_STATUS_LABELS[t.status]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {t.dueDate ? `Срок: ${t.dueDate}` : 'Без срока'} · {PRIORITY_LABELS[t.priority]}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
