import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { resolveAssetUrl, toUserMessage } from '@/api/client'
import { fetchExecution, fetchReviewQueue, reviewExecution, reviewFace, type FieldExecution } from '@/api/fieldApi'
import { workflowGet, type TaskFlow } from '@/api/workflowApi'

const faceLabels = { PENDING: 'Ожидает проверки', VERIFIED: 'Личность подтверждена', REJECTED: 'Фото лица отклонено' }
const date = (value: string | null) => value ? new Date(value).toLocaleString('ru-RU') : 'Не зафиксировано'

export function ExecutionReviewPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('execution'))
  const [rows, setRows] = useState<FieldExecution[]>([])
  const [selected, setSelected] = useState<FieldExecution | null>(null)
  const [flow, setFlow] = useState<TaskFlow | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selectionRevision = useRef(0)
  const actionLock = useRef(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await fetchReviewQueue()); setError('') }
    catch (e) { setError(toUserMessage(e)) }
    finally { setLoading(false) }
  }, [])
  const select = useCallback(async (id: number) => {
    const revision = ++selectionRevision.current
    setDetailLoading(true); setSelected(null); setFlow(null); setComment(''); setError(''); setNotice('')
    try {
      const execution = await fetchExecution(id)
      const task = await workflowGet<TaskFlow>(`/tasks/${execution.task.id}`)
      if (revision === selectionRevision.current) { setSelected(execution); setFlow(task) }
    } catch (e) { if (revision === selectionRevision.current) setError(toUserMessage(e)) }
    finally { if (revision === selectionRevision.current) setDetailLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (Number.isSafeInteger(requested) && requested > 0) void select(requested)
    return () => { selectionRevision.current++ }
  }, [requested, select])
  const canDecide = !!selected && selected.status === 'COMPLETED' && !!flow?.canManage && (!flow.plan || flow.plan.reviewer_id === user?.id)
  async function face(status: 'VERIFIED' | 'REJECTED') {
    if (!selected?.faceVerifications[0] || actionLock.current || !canDecide) return
    if (status === 'REJECTED' && !comment.trim()) { setError('Укажите, что нужно исправить в фото лица'); return }
    actionLock.current = true; setBusy(true); setError('')
    try { setSelected(await reviewFace(selected.faceVerifications[0].id, status, comment.trim() || undefined)) }
    catch (e) { setError(toUserMessage(e)) }
    finally { actionLock.current = false; setBusy(false) }
  }
  async function decision(accepted: boolean) {
    if (!selected || actionLock.current || !canDecide) return
    if (!accepted && !comment.trim()) { setError('Укажите, что сотруднику нужно исправить'); return }
    actionLock.current = true; setBusy(true); setError('')
    try {
      await reviewExecution(selected.id, accepted, comment.trim() || undefined)
      ++selectionRevision.current; setSelected(null); setFlow(null); setComment(''); setParams({}, { replace: true })
      await load()
      setNotice(accepted ? 'Работа принята. Результат сохранён в журнале работ.' : 'Работа возвращена сотруднику на доработку с вашим комментарием.')
    } catch (e) { setError(toUserMessage(e)) }
    finally { actionLock.current = false; setBusy(false) }
  }
  return <div className="space-y-5">
    <header><h1 className="text-2xl font-black">Приёмка работ</h1><p className="text-sm text-slate-600">Проверка результата конкретной задачи, а не закрытие рабочего дня.</p></header>
    <section aria-label="Как работает приёмка" className="space-y-3 rounded-xl border bg-white p-4 text-sm">
      <h2 className="font-bold">Как работа попадает сюда</h2>
      <p>Исполнитель в экране выполнения задачи добавляет фото ДО/ПОСЛЕ, три кадра лица, чек-лист и отчёт, затем нажимает «Подтвердить 100% и отправить». После успешной отправки работа появляется в этой очереди.</p>
      <p>Принимающий проверяет QR и GPS, время, фотографии, фото лица, пункты чек-листа и отчёт. Фото лица проверяется человеком — это не Apple Face ID и не автоматическое распознавание.</p>
      <p>Если в задаче назначен принимающий, решение принимает именно он. Без такого назначения доступны директор/администратор, бригадир своей бригады или агроном по созданным им задачам.</p>
      <p>«Принять работу» подтверждает результат; сначала нужно подтвердить лицо. «На доработку» отклоняет текущий результат с обязательной причиной. Исполнитель исправляет и отправляет его снова. Отдельного окончательного отказа здесь нет.</p>
      <p>Закрытая смена проверяется отдельно в <Link className="text-blue-700 underline" to="/admin/work-days">«Рабочих днях»</Link>. Старые отчёты и решения доступны в <Link className="text-blue-700 underline" to="/admin/work-logs">журнале работ</Link>.</p>
    </section>
    <button type="button" disabled={loading || busy || detailLoading} className="rounded-lg border bg-white px-4 py-2 font-semibold" onClick={() => { void load(); if (selected) void select(selected.id) }}>Обновить очередь</button>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-900">{notice}</p>}
    <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-2" aria-label="Работы на проверке">
        {loading ? <p role="status">Загрузка очереди…</p> : rows.map(row => <button key={row.id} disabled={busy} onClick={() => void select(row.id)} className={`w-full rounded-xl border p-4 text-left ${selected?.id === row.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}><b>{row.task.description || `Задача #${row.task.id}`}</b><span className="mt-1 block text-sm text-slate-500">{row.section.object?.name} · {row.worker?.fullName ?? row.task.assignee?.fullName}</span></button>)}
        {!loading && !error && rows.length === 0 && <div className="space-y-2 rounded-xl bg-white p-5 text-sm"><h2 className="font-bold">Нет работ на приёмке</h2><p>Нет доступных вам задач, отправленных из экрана выполнения. Назначение задачи или закрытие смены сами по себе не добавляют сюда работу.</p><Link className="text-blue-700 underline" to="/admin/workflow">Проверить статусы задач →</Link></div>}
      </aside>
      {detailLoading ? <p role="status">Загрузка материалов…</p> : selected && <section aria-label="Материалы для приёмки" className="min-w-0 space-y-5 rounded-2xl border bg-white p-4 sm:p-5">
        <div><h2 className="text-xl font-black">{selected.task.description}</h2><p>{selected.section.object?.name} · {selected.section.name}</p><p className="text-sm">Исполнитель: {selected.worker?.fullName ?? selected.task.assignee?.fullName ?? 'Не указан'}</p><p className="text-sm">Принимает: {flow?.plan?.reviewer_name ?? 'Руководитель с доступом к этой работе'}</p><Link to={`/workflow/tasks/${selected.task.id}`} className="text-sm text-blue-700 underline">Открыть задачу и стандарт →</Link></div>
        {!canDecide && <p role="note" className="rounded-xl bg-amber-50 p-3 text-sm">{selected.status !== 'COMPLETED' ? 'Эта работа сейчас не ожидает приёмки. Ниже сохранённые материалы.' : 'Просмотр материалов. Решение принимает назначенный проверяющий.'}</p>}
        <section className="space-y-1 text-sm"><h3 className="font-bold">Отчёт исполнителя</h3><p>Выполнение: {selected.completionPercent == null ? 'Не указано' : `${selected.completionPercent}%`}</p><p>Объём: {selected.actualVolume || 'Не указан'}</p><p className="whitespace-pre-wrap break-words">{selected.completionDescription || 'Описание результата не указано'}</p><p>Начало: {date(selected.startedAt)} · Отправлено: {date(selected.completedAt)}</p>{selected.reviewComment && <p>Предыдущее замечание: {selected.reviewComment}</p>}{flow?.plan && <p><b>Критерии приёмки:</b> {flow.plan.acceptance}</p>}</section>
        <section className="space-y-1 text-sm"><h3 className="font-bold">QR и геолокация прибытия</h3><p>QR: {selected.section.code} · подтверждён {date(selected.qrVerifiedAt)}</p><p>GPS: {selected.arrivalLatitude ?? '—'}, {selected.arrivalLongitude ?? '—'}</p><p>Погрешность: {selected.arrivalAccuracy == null ? '—' : `${Math.round(selected.arrivalAccuracy)} м`} · Расстояние до участка: {selected.arrivalDistanceMeters == null ? '—' : `${Math.round(selected.arrivalDistanceMeters)} м`}</p></section>
        <section><h3 className="font-bold">Проверка фото лица руководителем</h3><p className="text-sm text-slate-500">Сравните все три кадра и подтвердите личность сотрудника вручную.</p>{selected.faceVerifications[0] ? <div className="mt-2 space-y-3"><div className="flex flex-wrap gap-2">{selected.faceVerifications[0].livenessEvidenceUrls.map((url, index) => <a key={url} href={resolveAssetUrl(url)} target="_blank" rel="noreferrer"><img src={resolveAssetUrl(url)} alt={`Фото лица ${index + 1}`} className="h-24 w-24 rounded-xl object-cover" /></a>)}</div><p className="font-semibold">{faceLabels[selected.faceVerifications[0].status]}</p>{selected.faceVerifications[0].reviewComment && <p className="text-sm">{selected.faceVerifications[0].reviewComment}</p>}{canDecide && <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void face('VERIFIED')} className="rounded-lg bg-emerald-700 px-3 py-2 text-white">Подтвердить лицо</button><button disabled={busy} onClick={() => void face('REJECTED')} className="rounded-lg border border-red-200 px-3 py-2 text-red-700">Отклонить фото лица</button></div>}</div> : <p className="text-red-700">Фото лица отсутствует</p>}</section>
        <div className="grid gap-4 lg:grid-cols-2">{(['BEFORE', 'AFTER'] as const).map(phase => <section key={phase}><h3 className="mb-2 font-bold">Фото {phase === 'BEFORE' ? 'ДО' : 'ПОСЛЕ'}</h3><div className="grid grid-cols-3 gap-2">{selected.photos.filter(p => p.phase === phase).map((p, i) => <a key={p.id} href={resolveAssetUrl(p.url)} target="_blank" rel="noreferrer"><img src={resolveAssetUrl(p.url)} alt={`Фото ${phase === 'BEFORE' ? 'ДО' : 'ПОСЛЕ'} ${i + 1}`} className="aspect-square rounded-xl object-cover" /></a>)}</div>{!selected.photos.some(p => p.phase === phase) && <p className="text-sm text-amber-800">Фото отсутствуют</p>}</section>)}</div>
        <section><h3 className="font-bold">Чек-лист</h3>{!selected.availableChecklist.length && <p className="text-sm text-slate-500">Для этого вида работ чек-лист не задан.</p>}{selected.availableChecklist.map(item => <p key={item.id} className="mt-1 text-sm">{selected.checklist.some(a => a.itemId === item.id && a.isCompleted) ? '✅' : '❌'} {item.label}{item.isRequired ? ' (обязательно)' : ''}</p>)}</section>
        {canDecide && <div className="space-y-3 border-t pt-4"><label className="block text-sm font-semibold">Что нужно исправить<textarea disabled={busy} value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} className="mt-1 w-full rounded-lg border p-3" placeholder="Обязательно при возврате работы или отклонении фото лица"/></label>{selected.faceVerifications[0]?.status !== 'VERIFIED' && <p className="text-sm text-amber-800">Перед приёмкой подтвердите фото лица. Вернуть на доработку можно без подтверждения.</p>}<div className="flex flex-wrap gap-3"><button disabled={busy || selected.faceVerifications[0]?.status !== 'VERIFIED'} onClick={() => void decision(true)} className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">Принять работу</button><button disabled={busy} onClick={() => void decision(false)} className="rounded-xl border border-red-300 px-4 py-3 font-bold text-red-700">На доработку</button></div></div>}
      </section>}
    </div>
  </div>
}
