import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  createTask,
  cancelTask,
  fetchTask,
  fetchTasks,
  getTaskReviewLabel,
  PRIORITY_LABELS,
  reviewTask,
  TASK_LIST_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type ApiTask,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
} from '@/api/tasksApi'
import { fetchObjectsWithSections, type NurseryObjectWithSections } from '@/api/objectsApi'
import { fetchAllWorkTypes } from '@/api/workTypesApi'
import { fetchAssignableUsers, type ApiAssignee } from '@/api/usersApi'
import { resolveAssetUrl, toUserMessage } from '@/api/client'
import { ROLE_LABELS } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'

function formatAssigneeLabel(user: ApiAssignee): string {
  return `${user.fullName} — ${ROLE_LABELS[user.role]}`
}

function formatTaskAssignee(task: ApiTask): string {
  if (!task.assignee) return '—'
  return `${task.assignee.fullName} — ${ROLE_LABELS[task.assignee.role]}`
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

function formatTaskExecutor(task: ApiTask): string {
  if (task.status === 'ASSIGNED') return '—'
  return task.assignee?.fullName ?? '—'
}

function statusBadgeClass(status: TaskStatus): string {
  switch (status) {
    case 'ASSIGNED':
      return 'bg-slate-100 text-slate-700'
    case 'ACCEPTED':
      return 'bg-blue-100 text-blue-800'
    case 'IN_PROGRESS':
      return 'bg-amber-100 text-amber-800'
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-800'
    case 'VERIFIED':
      return 'bg-emerald-700 text-white'
    case 'REJECTED':
      return 'bg-red-100 text-red-800'
    case 'CANCELLED':
      return 'bg-slate-200 text-slate-600'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function reviewBadgeClass(status: TaskStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-600 text-white'
    case 'VERIFIED':
      return 'bg-emerald-100 text-emerald-800'
    case 'REJECTED':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function taskRowClass(task: ApiTask): string {
  if (task.status === 'COMPLETED') {
    return 'bg-emerald-50/80'
  }
  return 'hover:bg-slate-50'
}

function TaskPhotoPreview({ urls }: { urls: string[] }) {
  if (!urls.length) {
    return <span className="text-slate-400">—</span>
  }

  const firstUrl = resolveAssetUrl(urls[0])

  return (
    <a
      href={firstUrl}
      target="_blank"
      rel="noreferrer"
      className="relative inline-block"
      title={urls.length > 1 ? `Фото: ${urls.length}` : 'Открыть фото'}
    >
      <img
        src={firstUrl}
        alt="Фотоотчёт"
        className="h-[60px] w-[60px] rounded border border-slate-200 object-cover"
      />
      {urls.length > 1 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {urls.length}
        </span>
      )}
    </a>
  )
}

export function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [objects, setObjects] = useState<NurseryObjectWithSections[]>([])
  const [workTypes, setWorkTypes] = useState<{ id: number; name: string }[]>([])
  const [assignees, setAssignees] = useState<ApiAssignee[]>([])
  const [objectId, setObjectId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [workTypeId, setWorkTypeId] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [description, setDescription] = useState('')
  const [category] = useState<TaskCategory>(user?.role === 'AGRONOMIST' ? 'AGRO' : 'WORK')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

  const selectedObject = useMemo(
    () => objects.find((o) => o.id === Number(objectId)),
    [objects, objectId],
  )

  const objectSections = useMemo(
    () => selectedObject?.sections.filter((section) => section.is_active) ?? [],
    [selectedObject],
  )

  async function reload() {
    const [t, o, w, a] = await Promise.all([
      fetchTasks(),
      fetchObjectsWithSections(),
      fetchAllWorkTypes(),
      fetchAssignableUsers(),
    ])
    setTasks(t)
    setObjects(o)
    setWorkTypes(w.filter((x) => x.is_active).map((x) => ({ id: x.id, name: x.name })))
    setAssignees(a)
  }

  useEffect(() => {
    void reload().catch((err) => setError(toUserMessage(err)))
  }, [])

  useEffect(() => {
    if (selectedTaskId == null) {
      setSelectedTask(null)
      setReviewComment('')
      return
    }
    void fetchTask(selectedTaskId)
      .then(setSelectedTask)
      .catch((err) => setError(toUserMessage(err)))
  }, [selectedTaskId])

  function handleObjectChange(nextObjectId: string) {
    setObjectId(nextObjectId)
    setSectionId('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canCreateTask) return
    setSaving(true)
    setError(null)
    try {
      await createTask({
        sectionId: Number(sectionId),
        workTypeId: Number(workTypeId),
        assigneeUserId: Number(assigneeUserId),
        dueDate,
        priority,
        description: description.trim(),
        category,
      })
      setDescription('')
      setSectionId('')
      setWorkTypeId('')
      setAssigneeUserId('')
      setDueDate('')
      await reload()
    } catch (err) {
      console.error('[tasks]', err)
      setError(toUserMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleReview(status: 'VERIFIED' | 'REJECTED') {
    if (!selectedTask) return
    setReviewLoading(true)
    setError(null)
    try {
      const updated = await reviewTask(selectedTask.id, {
        status,
        reviewComment: reviewComment.trim() || undefined,
      })
      setSelectedTask(updated)
      setReviewComment('')
      await reload()
    } catch (err) {
      console.error('[tasks/review]', err)
      setError(toUserMessage(err))
    } finally {
      setReviewLoading(false)
    }
  }

  async function handleCancel(task: ApiTask) {
    if (!confirm(`Отменить задачу #${task.id}? История задачи сохранится.`)) return
    setError(null)
    try {
      await cancelTask(task.id)
      if (selectedTaskId === task.id) setSelectedTaskId(null)
      await reload()
    } catch (err) {
      console.error('[tasks/cancel]', err)
      setError(toUserMessage(err))
    }
  }

  const canCreateTask = Boolean(
    objectId &&
      sectionId &&
      workTypeId &&
      assigneeUserId &&
      dueDate &&
      description.trim(),
  )

  const isAdmin = user?.role === 'ADMIN'
  const isAgronomist = user?.role === 'AGRONOMIST'
  const isBrigadier = user?.role === 'BRIGADIER'
  const showExtendedTable = isAdmin || isAgronomist

  function canReviewTask(task: ApiTask): boolean {
    if (isAdmin) return true
    if (isAgronomist && task.createdById === user?.id) return true
    return false
  }

  const pageTitle = isAdmin ? 'Все задачи' : isAgronomist ? 'Созданные задачи' : 'Назначенные задачи'
  const pageHint = isAdmin
    ? 'Просмотр всех задач в системе, контроль статусов и проверка выполнения.'
    : isAgronomist
      ? 'Задачи, которые вы создали. После завершения можно проверить фотоотчёт.'
      : 'Задачи, назначенные вам. Примите и выполните их в разделе «Мои задачи».'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <p className="mt-1 text-sm text-slate-600">{pageHint}</p>
      </div>

      {isBrigadier && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Чтобы принять, начать и завершить задачу, перейдите в раздел{' '}
          <a href="/admin/my-tasks" className="font-medium underline">
            Мои задачи
          </a>
          .
        </p>
      )}

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Объект *</label>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={objectId}
            onChange={(e) => handleObjectChange(e.target.value)}
            required
          >
            <option value="">— выберите объект —</option>
            {objects.filter((o) => o.is_active).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {objects.every((object) => !object.is_active) && (
            <p className="mt-2 text-sm text-amber-700">
              Объекты ещё не созданы. Администратор должен добавить их в разделе «Объекты и участки».
            </p>
          )}
        </div>

        {selectedObject && (
          <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Описание объекта</p>
            <p className="mt-1 text-sm text-slate-700">
              {selectedObject.description?.trim() || 'Описание не указано'}
            </p>
            {objectSections.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">Участков: {objectSections.length}</p>
            )}
          </div>
        )}

        {selectedObject && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Участок *</label>
            {objectSections.length > 0 ? (
              <select
                className="w-full rounded-lg border px-3 py-2"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                required
              >
                <option value="">— выберите участок —</option>
                {objectSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                У этого объекта нет участков. Создайте участок в разделе «Объекты и участки».
              </p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Вид работы *</label>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={workTypeId}
            onChange={(e) => setWorkTypeId(e.target.value)}
            required
          >
            <option value="">— выберите вид работы —</option>
            {workTypes.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Кому назначить *</label>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
            required
          >
            <option value="">— выберите пользователя —</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {formatAssigneeLabel(u)}
              </option>
            ))}
          </select>
          {assignees.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              Нет активных пользователей. Добавьте их в разделе «Пользователи».
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Срок *</label>
          <input
            type="date"
            className="w-full rounded-lg border px-3 py-2"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Приоритет *</label>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            required
          >
            <option value="LOW">{PRIORITY_LABELS.LOW}</option>
            <option value="MEDIUM">{PRIORITY_LABELS.MEDIUM}</option>
            <option value="HIGH">{PRIORITY_LABELS.HIGH}</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Описание *</label>
          <textarea
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Описание задачи"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={!canCreateTask || saving}
          className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
        >
          {saving ? 'Сохранение…' : 'Создать задачу'}
        </button>
      </form>

      {error && <p className="text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Объект</th>
              <th className="px-3 py-2 text-left">Участок</th>
              <th className="px-3 py-2 text-left">Вид работы</th>
              <th className="px-3 py-2 text-left">Срок</th>
              <th className="px-3 py-2 text-left">Кому назначена</th>
              {showExtendedTable && <th className="px-3 py-2 text-left">Статус</th>}
              {showExtendedTable && <th className="px-3 py-2 text-left">Кто выполняет</th>}
              {showExtendedTable && <th className="px-3 py-2 text-left">Дата принятия</th>}
              {showExtendedTable && <th className="px-3 py-2 text-left">Дата завершения</th>}
              {showExtendedTable && <th className="px-3 py-2 text-left">Фотоотчёт</th>}
              {showExtendedTable && <th className="px-3 py-2 text-left">Проверка</th>}
              {!showExtendedTable && <th className="px-3 py-2 text-left">Статус</th>}
              <th className="px-3 py-2 text-left">Приоритет</th>
              {isAdmin && <th className="px-3 py-2 text-left">Тип</th>}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((t) => {
              const reviewLabel = getTaskReviewLabel(t.status)
              return (
                <tr key={t.id} className={showExtendedTable ? taskRowClass(t) : undefined}>
                  <td className="px-3 py-2">{t.section?.object?.name ?? '—'}</td>
                  <td className="px-3 py-2">{t.section?.name ?? t.sectionId}</td>
                  <td className="px-3 py-2">{t.workType?.name ?? '—'}</td>
                  <td className="px-3 py-2">{t.dueDate ?? '—'}</td>
                  <td className="px-3 py-2">{formatTaskAssignee(t)}</td>
                  {showExtendedTable && (
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(t.status)}`}
                      >
                        {TASK_LIST_STATUS_LABELS[t.status]}
                      </span>
                    </td>
                  )}
                  {showExtendedTable && (
                    <td className="px-3 py-2">{formatTaskExecutor(t)}</td>
                  )}
                  {showExtendedTable && (
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(t.acceptedAt)}</td>
                  )}
                  {showExtendedTable && (
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(t.completedAt)}</td>
                  )}
                  {showExtendedTable && (
                    <td className="px-3 py-2">
                      <TaskPhotoPreview urls={t.completionPhotoUrls} />
                    </td>
                  )}
                  {showExtendedTable && (
                    <td className="px-3 py-2">
                      {reviewLabel === '—' ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${reviewBadgeClass(t.status)}`}
                        >
                          {reviewLabel}
                        </span>
                      )}
                    </td>
                  )}
                  {!showExtendedTable && (
                    <td className="px-3 py-2">{TASK_STATUS_LABELS[t.status]}</td>
                  )}
                  <td className="px-3 py-2">{PRIORITY_LABELS[t.priority]}</td>
                  {isAdmin && <td className="px-3 py-2">{t.category === 'AGRO' ? 'Агро' : 'Рабочая'}</td>}
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs text-blue-700"
                        onClick={() => setSelectedTaskId(t.id)}
                      >
                        Подробнее
                      </button>
                      {!['IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED'].includes(t.status) && <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => void handleCancel(t)}
                      >
                        Отменить
                      </button>}
                    </div>
                  </td>
                </tr>
              )
            })}
            {tasks.length === 0 && (
              <tr>
                <td
                  colSpan={showExtendedTable ? (isAdmin ? 14 : 13) : isAdmin ? 9 : 8}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  Задач пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedTask && (
        <section className="rounded-xl border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">Задача #{selectedTask.id}</h2>
            <button
              type="button"
              onClick={() => setSelectedTaskId(null)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Закрыть
            </button>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Кому назначена</dt>
              <dd>{formatTaskAssignee(selectedTask)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Кто выполняет</dt>
              <dd>
                {selectedTask.status === 'ASSIGNED' ? '—' : formatTaskAssignee(selectedTask)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Статус</dt>
              <dd>{TASK_LIST_STATUS_LABELS[selectedTask.status]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Принята</dt>
              <dd>{formatDateTime(selectedTask.acceptedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Завершена</dt>
              <dd>{formatDateTime(selectedTask.completedAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Описание</dt>
              <dd>{selectedTask.description || '—'}</dd>
            </div>
            {selectedTask.completionComment && (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Комментарий при завершении</dt>
                <dd>{selectedTask.completionComment}</dd>
              </div>
            )}
            {selectedTask.completionPhotoUrls.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="mb-2 text-slate-500">Фото завершения</dt>
                <dd className="flex flex-wrap gap-2">
                  {selectedTask.completionPhotoUrls.map((url) => (
                    <a key={url} href={resolveAssetUrl(url)} target="_blank" rel="noreferrer">
                      <img
                        src={resolveAssetUrl(url)}
                        alt=""
                        className="h-24 w-24 rounded border object-cover"
                      />
                    </a>
                  ))}
                </dd>
              </div>
            )}
            {selectedTask.reviewComment && (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Комментарий проверки</dt>
                <dd>{selectedTask.reviewComment}</dd>
              </div>
            )}
            {selectedTask.reviewedAt && (
              <div>
                <dt className="text-slate-500">Проверена</dt>
                <dd>
                  {formatDateTime(selectedTask.reviewedAt)}
                  {selectedTask.reviewedBy ? ` · ${selectedTask.reviewedBy.fullName}` : ''}
                </dd>
              </div>
            )}
          </dl>

          {selectedTask.status === 'COMPLETED' && canReviewTask(selectedTask) && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">Проверка задачи</p>
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Комментарий проверки"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={reviewLoading}
                  onClick={() => void handleReview('VERIFIED')}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  disabled={reviewLoading}
                  onClick={() => void handleReview('REJECTED')}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
                >
                  Отклонить
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
