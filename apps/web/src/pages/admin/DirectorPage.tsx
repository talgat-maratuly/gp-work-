import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchObjectsWithSections } from '@/api/objectsApi'
import { fetchAllWorkTypes } from '@/api/workTypesApi'
import { fetchAssignableUsers } from '@/api/usersApi'
import { createTask, fetchTasks, TASK_LIST_STATUS_LABELS, type ApiTask } from '@/api/tasksApi'
import { toUserMessage, resolveAssetUrl } from '@/api/client'
import { businessDate, prepareDirectorCommand, type CommandCatalog } from '@/lib/directorCommands'
import { VoiceDictation } from '@/components/VoiceDictation'

const emptyDraft = { sectionId: '', workTypeId: '', assigneeUserId: '', dueDate: '', assignmentReason: '' }
const fieldClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3'

export function DirectorPage() {
  const [catalog, setCatalog] = useState<CommandCatalog | null>(null)
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [text, setText] = useState('')
  const [draft, setDraft] = useState(emptyDraft)
  const [prepared, setPrepared] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('active')
  async function reload() {
    setLoading(true)
    setError('')
    try {
      const [objects, workTypes, assignees, rows] = await Promise.all([fetchObjectsWithSections(), fetchAllWorkTypes(), fetchAssignableUsers(), fetchTasks()])
      setCatalog({ sections: objects.filter((o) => o.is_active).flatMap((o) => o.sections.filter((s) => s.is_active).map((s) => ({ ...s, objectName: o.name }))), workTypes: workTypes.filter((w) => w.is_active), assignees, tasks: rows })
      setTasks(rows)
    } catch (e) { setError(toUserMessage(e, 'Не удалось загрузить поручения. Повторите обновление.')) }
    finally { setLoading(false) }
  }
  useEffect(() => { void reload() }, [])
  const today = businessDate()
  const active = (t: ApiTask) => !['VERIFIED', 'CANCELLED'].includes(t.status)
  const overdue = (t: ApiTask) => active(t) && !!t.dueDate && t.dueDate.slice(0, 10) < today
  const shown = tasks.filter((t) => filter === 'all' || (filter === 'active' ? active(t) : filter === 'overdue' ? overdue(t) : t.status === 'COMPLETED'))
  function changeText(value: string) { setText(value); setPrepared(false); setDraft(emptyDraft); setNotice('') }
  async function send() {
    if (!catalog || !prepared || !text.trim() || !draft.sectionId || !draft.workTypeId || !draft.assigneeUserId || !draft.dueDate || lock.current) return
    lock.current = true
    setSaving(true); setError(''); setNotice('')
    try {
      const created = await createTask({ sectionId: Number(draft.sectionId), workTypeId: Number(draft.workTypeId), assigneeUserId: Number(draft.assigneeUserId), dueDate: draft.dueDate, description: text.trim() })
      setTasks((rows) => [created, ...rows])
      setCatalog((current) => current && { ...current, tasks: [created, ...current.tasks] })
      setText(''); setPrepared(false); setDraft(emptyDraft)
      setNotice(`Поручение №${created.id} создано и доступно исполнителю в «Моих задачах».`)
    } catch (e) { setError(toUserMessage(e, 'Не удалось подтвердить отправку. Обновите список перед повторной попыткой, чтобы не создать дубль.')) }
    finally { lock.current = false; setSaving(false) }
  }
  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-2xl bg-emerald-900 p-5 text-white">
      <h1 className="text-2xl font-bold">Кабинет директора</h1>
      <p className="mt-2">Дайте поручение. Здесь же следите, кто принял его, что выполнено и что требует проверки.</p>
      <Link to="/admin/ai-director" className="mt-3 inline-block underline">Сводка и риски от ИИ-директора →</Link>
    </header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{notice}</p>}
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Новое поручение</h2>
      <label htmlFor="director-command" className="mt-3 block text-sm">Напишите или надиктуйте: что сделать, на каком участке, кому и к какому сроку.</label>
      <textarea id="director-command" maxLength={4000} disabled={saving} value={text} onChange={(e) => changeText(e.target.value)} className={`${fieldClass} min-h-28`} placeholder="Например: Полив, участок S-001, Иван Иванов, завтра." />
      <VoiceDictation disabled={saving} onText={(value) => changeText(`${text} ${value}`.trim().slice(0, 4000))} />
      <button type="button" disabled={!catalog || loading || saving || !text.trim()} onClick={() => { if (catalog) { setDraft(prepareDirectorCommand(text, catalog)); setPrepared(true); setNotice('') } }} className="mt-3 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-50">Подготовить поручение</button>
      <p className="mt-2 text-xs text-slate-500">Автозаполнение по точным названиям и коду участка, без ИИ-модели. Срок: сегодня, завтра, послезавтра или ГГГГ-ММ-ДД. Неоднозначные данные уточняются ниже; само поручение ещё не отправлено.</p>
      {prepared && catalog && <form className="mt-4 space-y-4 border-t pt-4" onSubmit={(e) => { e.preventDefault(); void send() }}>
        <h3 className="font-semibold">Проверьте назначение и заполните нераспознанное</h3>
        <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Участок<select required className={fieldClass} value={draft.sectionId} onChange={(e) => setDraft({ ...draft, sectionId: e.target.value, assigneeUserId: '', assignmentReason: '' })}><option value="">Уточните участок</option>{catalog.sections.map((s) => <option key={s.id} value={s.id}>{s.objectName} / {s.name} ({s.code})</option>)}</select></label>
          <label className="text-sm">Вид работы<select required className={fieldClass} value={draft.workTypeId} onChange={(e) => setDraft({ ...draft, workTypeId: e.target.value, assigneeUserId: '', assignmentReason: '' })}><option value="">Уточните вид работы</option>{catalog.workTypes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className="text-sm">Исполнитель<select required className={fieldClass} value={draft.assigneeUserId} onChange={(e) => setDraft({ ...draft, assigneeUserId: e.target.value, assignmentReason: 'Исполнитель выбран вручную.' })}><option value="">Уточните исполнителя</option>{catalog.assignees.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></label>
          <label className="text-sm">Срок<input type="date" required min={today} className={fieldClass} value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></label>
        </fieldset>
        {draft.assignmentReason && <p className="text-sm text-slate-600">{draft.assignmentReason}</p>}
        <button disabled={saving || loading} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Отправляю…' : 'Подтвердить и отправить исполнителю'}</button>
      </form>}
    </section>
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Контроль исполнения</h2><button type="button" onClick={() => void reload()} disabled={loading || saving} className="rounded-xl border px-4 py-2 disabled:opacity-50">{loading ? 'Загрузка…' : 'Обновить'}</button></div>
      <p className="mt-2 text-sm text-slate-600">Все поручения компании. Выполнено работником ≠ принято: завершённые работы ждут проверки.</p>
      <div className="my-4 flex flex-wrap gap-2">{[['active', `Открытые (${tasks.filter(active).length})`], ['overdue', `Просрочены (${tasks.filter(overdue).length})`], ['review', `На проверке (${tasks.filter((t) => t.status === 'COMPLETED').length})`], ['all', `Все (${tasks.length})`]].map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`rounded-xl px-3 py-2 text-sm ${filter === key ? 'bg-emerald-700 text-white' : 'bg-slate-100'}`}>{label}</button>)}</div>
      {!loading && !error && !shown.length && <p className="text-slate-500">В этой группе поручений нет.</p>}
      <div className="space-y-3">{shown.map((t) => <article key={t.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">№{t.id} · {t.description}</h3><span className="text-sm font-semibold">{TASK_LIST_STATUS_LABELS[t.status]}</span></div>
        <p className="mt-1 text-sm">{t.section?.object?.name} / {t.section?.name} · {t.assignee?.fullName ?? 'Исполнитель не указан'}</p>
        <p className={`mt-1 text-sm ${overdue(t) ? 'font-semibold text-red-700' : 'text-slate-500'}`}>Срок: {t.dueDate?.slice(0, 10) ?? 'не указан'}{overdue(t) ? ' · просрочено' : ''}</p>
        {t.completionComment && <p className="mt-2 text-sm">Отчёт: {t.completionComment}</p>}
        {t.reviewComment && <p className="mt-1 text-sm">Проверка: {t.reviewComment}</p>}
        <div className="mt-2 flex flex-wrap gap-3">{t.completionPhotoUrls.map((url, i) => <a key={`${url}-${i}`} href={resolveAssetUrl(url)} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline">Фото {i + 1}</a>)}</div>
        <Link to={`/admin/tasks?task=${t.id}`} className="mt-2 inline-block text-sm text-blue-700 underline">Открыть поручение и проверку →</Link>
      </article>)}</div>
    </section>
  </div>
}
