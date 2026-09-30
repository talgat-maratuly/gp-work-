import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { toUserMessage } from '@/api/client'
import { workflowGet, workflowPost, IMPROVEMENT_STATUS, type BoardTask, type Summary } from '@/api/workflowApi'
import { Label, inputClass, buttonClass, panelClass } from './Controls'

type Reply = { id: number; note: string; author_name: string; is_management: boolean }
type Answer = { id: number; author_id: number; author_name: string; day: string; task_id: number | null; task_name: string | null; problem: string; next_step: string; result: string; proposal: string; improvement_id: number | null; improvement_status: string | null; can_reply: boolean; replies: Reply[] }
type Feed = { day: string; rows: Answer[] }

export function KaizenPanel({ tasks, summary, onChanged }: { tasks: BoardTask[]; summary: Summary | null; onChanged: () => Promise<void> }) {
  const { user } = useAuth()
  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState('')
  const operation = useRef(crypto.randomUUID())
  const manager = ['ADMIN', 'DIRECTOR', 'BRIGADIER', 'AGRONOMIST'].includes(user!.role)
  const load = useCallback(async () => {
    setError('')
    try { setFeed(await workflowGet<Feed>('/kaizen')) }
    catch (e) { setError(toUserMessage(e)) }
  }, [])
  useEffect(() => { void load() }, [load])
  const mine = feed?.rows.find(row => row.author_id === user!.id && row.day === feed.day)
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const d = new FormData(form)
    setBusy(true); setError(''); setSaved('')
    try {
      await workflowPost('/kaizen', {
        taskId: d.get('taskId') ? Number(d.get('taskId')) : undefined,
        problem: String(d.get('problem')).trim(), nextStep: String(d.get('nextStep')).trim(),
        result: String(d.get('result')).trim(), proposal: String(d.get('proposal')).trim(),
        clientOperationId: operation.current,
      })
      form.reset(); operation.current = crypto.randomUUID()
      setSaved('Ответ сохранён. Предложение с выбранной задачей появится в её карточке улучшений.')
      await load()
      await onChanged().catch(() => undefined)
    } catch (e) { setError(toUserMessage(e)) }
    finally { setBusy(false) }
  }
  return <section className="space-y-4" aria-label="Кайдзен — ежедневные улучшения">
    <div className={panelClass}>
      <h2 className="text-xl font-bold">Кайдзен — улучшаем работу каждый день</h2>
      <p>В начале смены уделите 1–2 минуты: что мешает и какой следующий шаг поможет. ИТР и бригадир разбирают ответы утром, директор видит вопросы и результаты.</p>
      <p className="text-sm text-slate-600">Можно написать «препятствий нет» или «новой идеи нет». Ответ не блокирует начало дня, QR и выполнение задач. Сообщение о проблеме само по себе не снижает KPI.</p>
      <details><summary className="cursor-pointer font-semibold">Как это работает</summary>
        <p>Сообщили о проблеме → обсудили следующий шаг → проверили изменение в задаче → сравнили результат → закрепили удачное в стандарте.</p>
        <p>Руководитель в карточке улучшения назначает ответственного, срок и показатель. Результат проверяет другой человек. Переписка сама по себе не подтверждает экономию.</p>
      </details>
    </div>
    {saved && <p role="status" className="rounded-xl bg-emerald-50 p-3">{saved}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error} <button type="button" onClick={() => void load()} className="underline">Обновить обсуждения</button></p>}
    {!feed ? <p role="status">{error ? 'Обсуждения пока не загружены.' : 'Загрузка утренних ответов…'}</p> : <>
      {mine ? <p className={panelClass}>Ваш ответ за {feed.day} сохранён. Продолжите обсуждение ниже.</p> : <form className={`${panelClass} space-y-3`} onSubmit={submit} onChange={() => { operation.current = crypto.randomUUID() }}>
        <h3 className="font-bold">Утренний ответ · {feed.day}</h3>
        <fieldset disabled={busy} className="space-y-3">
          <Label name="Задача — если ответ связан с работой"><select name="taskId" defaultValue="" className={inputClass}><option value="">Общий вопрос, без задачи</option>{tasks.map(t => <option key={t.id} value={t.id}>#{t.id} · {t.description} · {t.objectName}</option>)}</select></Label>
          <Label name="Что вчера мешало работать нормально?"><textarea name="problem" required maxLength={2000} rows={2} className={inputClass} placeholder="Например, долго ждали воду. Или: препятствий нет." /></Label>
          <Label name="Что сегодня поможет работать удобнее или безопаснее?"><textarea name="nextStep" required maxLength={2000} rows={2} className={inputClass} placeholder="Один небольшой следующий шаг. Или: работаем по текущему плану." /></Label>
          <Label name="Что получилось после вчерашнего решения? — необязательно"><textarea name="result" maxLength={2000} rows={2} className={inputClass} placeholder="Наблюдение или замер. Если ещё не проверяли — оставьте пустым." /></Label>
          <Label name="Какое изменение предлагаем проверить? — необязательно"><textarea name="proposal" maxLength={2000} rows={2} className={inputClass} placeholder="Выберите задачу выше: предложение сохранится в существующем разделе улучшений." /></Label>
          <button type="submit" className={buttonClass}>{busy ? 'Сохраняем…' : 'Сохранить утренний ответ'}</button>
        </fieldset>
      </form>}
      {manager && <div className={panelClass}>
        <h3 className="font-bold">Утренний разбор</h3>
        <p>Среди показанных ответов за сегодня: {feed.rows.filter(r => r.day === feed.day).length}. Без ответа руководителя: {feed.rows.filter(r => r.day === feed.day && r.can_reply && !r.replies.some(reply => reply.is_management) && r.author_id !== user!.id).length}.</p>
        <p>Улучшения в доступных задачах: проверяем — {summary?.improvements?.filter(i => i.status === 'TESTING').length ?? 0}; результат на проверке — {summary?.improvements?.filter(i => i.status === 'CHECKING').length ?? 0}; закреплено в стандартах — {summary?.improvements?.filter(i => i.status === 'ADOPTED').length ?? 0}.</p>
        <p className="text-sm text-slate-600">Это количество записей, а не процент эффективности или выполнения стратегии. Проверьте факт, выберите одно препятствие и назначьте следующий шаг. В пилотной бригаде проверяйте не более двух изменений одновременно.</p>
      </div>}
      <h3 className="text-lg font-bold">Обсуждения</h3>
      <p className="text-sm text-slate-600">До 200 последних ответов за 30 дней в пределах ваших прав. Общие вопросы видит автор, его бригадир и руководство; вопросы с задачей — участники этой работы.</p>
      {!feed.rows.length && <p className={panelClass}>Ответов пока нет. Начните с одного наблюдения.</p>}
      {feed.rows.map(row => <article className={`${panelClass} space-y-2`} key={row.id}>
        <h4 className="font-bold">{row.author_name} · {row.day}</h4>
        {row.task_id && <Link className="font-semibold text-blue-700 underline" to={`/workflow/tasks/${row.task_id}`}>#{row.task_id} · {row.task_name}</Link>}
        <p className="whitespace-pre-wrap break-words"><b>Что мешает:</b> {row.problem}</p>
        <p className="whitespace-pre-wrap break-words"><b>Следующий шаг:</b> {row.next_step}</p>
        {row.result && <p className="whitespace-pre-wrap break-words"><b>Что получилось:</b> {row.result}</p>}
        {row.improvement_id && <Link className="block text-blue-700 underline" to={`/workflow/tasks/${row.task_id}#improvements`}>Улучшение #{row.improvement_id}: {IMPROVEMENT_STATUS[row.improvement_status!] ?? row.improvement_status} →</Link>}
        {row.replies.map(reply => <p key={reply.id} className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3"><b>{reply.author_name}:</b> {reply.note}</p>)}
        {(row.can_reply || row.author_id === user!.id) && <ReplyForm id={row.id} onChanged={load} />}
      </article>)}
    </>}
  </section>
}
function ReplyForm({ id, onChanged }: { id: number; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef(crypto.randomUUID())
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget
    const note = String(new FormData(form).get('note')).trim()
    setBusy(true); setError('')
    try {
      await workflowPost(`/kaizen/${id}/replies`, { note, clientOperationId: operation.current })
      form.reset(); operation.current = crypto.randomUUID(); await onChanged()
    } catch (e) { setError(toUserMessage(e)) }
    finally { setBusy(false) }
  }
  return <form onSubmit={submit} onChange={() => { operation.current = crypto.randomUUID() }} className="space-y-2">
    <fieldset disabled={busy} className="space-y-2"><Label name="Ответ в обсуждении"><textarea name="note" className={inputClass} required maxLength={2000} rows={2} /></Label><button className={buttonClass} type="submit">{busy ? 'Отправляем…' : 'Ответить'}</button></fieldset>
    {error && <p role="alert" className="text-red-800">{error}</p>}
  </form>
}
