import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { workflowGet, IMPROVEMENT_STATUS, type BoardTask, type Improvement } from '@/api/workflowApi'
import { toUserMessage } from '@/api/client'
import { ReportForm } from './ImprovementForms'
import { Label, inputClass, panelClass } from './Controls'
type Idea = Improvement & {task_id:number;task_description:string}
export function KaizenPanel({tasks}:{tasks:BoardTask[]}) {
  const [ideas,setIdeas]=useState<Idea[]>([]),[taskId,setTaskId]=useState(''),[filter,setFilter]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const load=useCallback(async()=>{setLoading(true);try{setIdeas(await workflowGet<Idea[]>('/kaizen'));setError('')}catch(e){setError(toUserMessage(e));throw e}finally{setLoading(false)}},[])
  useEffect(()=>{void load().catch(()=>undefined)},[load])
  return <section className="space-y-4" aria-label="Кайдзен"><div className={panelClass}><h2 className="text-xl font-bold">Кайдзен — улучшения в работе</h2>
    <p>Что сегодня можно упростить, автоматизировать или перестать делать дважды? Выберите задачу и предложите одно конкретное изменение.</p>
    <p className="text-sm text-slate-600">Предложение → проверка изменения → измерение результата → утверждённое правило. Важному улучшению выделите время в блоке «Важное заранее» карточки задачи.</p>
    <Label name="К какой задаче относится идея"><select className={inputClass} value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">Выберите задачу</option>{tasks.filter(t=>t.status!=='CANCELLED').map(t=><option key={t.id} value={t.id}>#{t.id} · {t.description}</option>)}</select></Label>
    {!tasks.length&&<p>Сначала нужна задача, к которой относится улучшение. Создайте её или попросите руководителя назначить работу.</p>}
    {taskId&&<ReportForm key={taskId} taskId={Number(taskId)} obstacles={[]} initialKind="improvement" onChanged={load}/>}
  </div><div className={panelClass}><h3 className="text-lg font-bold">Предложения и результаты</h3>
    <Label name="Статус предложения"><select className={inputClass} value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Все статусы</option>{Object.entries(IMPROVEMENT_STATUS).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></Label>
    {error&&<p role="alert" className="text-red-700">{error}</p>}{loading?<p role="status">Загрузка предложений…</p>:!error&&!ideas.filter(i=>!filter||i.status===filter).length?<p>Предложений с выбранным статусом пока нет.</p>:ideas.filter(i=>!filter||i.status===filter).map(i=><article key={i.id} className="space-y-2 rounded-xl border p-3"><p className="font-bold">#{i.id} · {IMPROVEMENT_STATUS[i.status]}</p><p><b>Проблема:</b> {i.problem}</p><p><b>Предложение:</b> {i.proposal}</p><p className="text-sm">Автор: {i.proposer_name} · Ответственный: {i.owner_name??'ещё не назначен'}</p>{i.metric&&<p>{i.metric}: было {i.baseline??'нет замера'}, после {i.observed??'нет замера'} {i.unit}</p>}<Link className="font-semibold text-blue-700 underline" to={`/workflow/tasks/${i.task_id}#kaizen`}>Открыть задачу и следующий шаг →</Link></article>)}
    <button type="button" disabled={loading} className="text-blue-700 underline" onClick={()=>void load().catch(()=>undefined)}>Обновить предложения</button>
  </div></section>
}
