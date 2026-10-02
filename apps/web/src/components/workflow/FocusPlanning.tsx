import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { workflowGet, workflowPost, type Improvement } from '@/api/workflowApi'
import { toUserMessage } from '@/api/client'
import { Label, inputClass, buttonClass, panelClass } from './Controls'

type Plan = {task_id:number;important:boolean;urgent:boolean;outcome:string;start_at:string;end_at:string;improvement_id:number|null;version:number}
type History = {id:number;actor_name:string;reason:string;created_at:string;before_value:Plan|null;after_value:Plan}
type Detail = {plan:Plan|null;history:History[]}
type Row = Plan & {description:string;status:string;assignee_name:string;due_date:string|null;reschedules:number}
const closed = (s:string) => ['COMPLETED','VERIFIED','CANCELLED'].includes(s)
const dateKey = (v:Date) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Oral',year:'numeric',month:'2-digit',day:'2-digit'}).format(v)
const time = (v:string) => new Date(v).toLocaleString('ru-RU',{timeZone:'Asia/Oral',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
const localInput = (v?:string) => v ? new Date(Date.parse(v)+5*3600000).toISOString().slice(0,16) : ''
const category = (p:Plan) => p.important ? p.urgent ? 'Важно и срочно' : 'Важное заранее' : p.urgent ? 'Срочные поручения' : 'Отложить или пересмотреть'

export function FocusPlan({taskId,canManage,status,improvements}:{taskId:number;canManage:boolean;status:string;improvements:Improvement[]}) {
  const [data,setData]=useState<Detail|null>(null), [error,setError]=useState(''), [busy,setBusy]=useState(false)
  async function load(){try{setData(await workflowGet<Detail>(`/tasks/${taskId}/focus`));setError('')}catch(e){setError(toUserMessage(e))}}
  useEffect(()=>{let active=true;setData(null);workflowGet<Detail>(`/tasks/${taskId}/focus`).then(d=>{if(active){setData(d);setError('')}}).catch(e=>{if(active)setError(toUserMessage(e))});return()=>{active=false}},[taskId])
  async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(!data||busy)return;const form=new FormData(e.currentTarget);setBusy(true);setError('');try{
    const result=await workflowPost<Detail>(`/tasks/${taskId}/focus`,{
      version:data.plan?.version??0,important:form.get('important')==='on',urgent:form.get('urgent')==='on',outcome:form.get('outcome'),
      startAt:new Date(`${form.get('startAt')}:00+05:00`).toISOString(),endAt:new Date(`${form.get('endAt')}:00+05:00`).toISOString(),
      ...(form.get('improvementId')?{improvementId:Number(form.get('improvementId'))}:{}),reason:form.get('reason')??''
    });setData(result)
  }catch(e){setError(toUserMessage(e))}finally{setBusy(false)}}
  return <section className={panelClass} aria-label="План важной работы"><h2 className="text-xl font-bold">Важное заранее</h2>
    <p className="text-sm text-slate-600">Выделите время для профилактики и улучшений. Срочность отмечайте при реальной необходимости. Время — Уральск (UTC+5).</p>
    {error&&<p role="alert" className="text-red-700">{error} <button type="button" className="underline" onClick={()=>void load()}>Обновить план</button></p>}
    {!data&&!error&&<p role="status">Загрузка плана…</p>}
    {data&&(canManage&&!closed(status)?<form key={`${taskId}:${data.plan?.version??0}`} onSubmit={save} className="space-y-3"><fieldset disabled={busy} className="space-y-3">
      <label className="flex gap-2"><input type="checkbox" name="important" defaultChecked={data.plan?.important??true}/>Важно для результата</label>
      <label className="flex gap-2"><input type="checkbox" name="urgent" defaultChecked={data.plan?.urgent??false}/>Требует срочной реакции</label>
      <Label name="Ожидаемый результат"><textarea name="outcome" required maxLength={2000} className={inputClass} defaultValue={data.plan?.outcome??''}/></Label>
      <div className="grid gap-3 sm:grid-cols-2"><Label name="Когда начать"><input type="datetime-local" name="startAt" required className={inputClass} defaultValue={localInput(data.plan?.start_at)}/></Label><Label name="Когда закончить"><input type="datetime-local" name="endAt" required className={inputClass} defaultValue={localInput(data.plan?.end_at)}/></Label></div>
      <Label name="Связанное предложение кайдзен"><select name="improvementId" className={inputClass} defaultValue={data.plan?.improvement_id??''}><option value="">Без предложения</option>{data.plan?.improvement_id&&!improvements.some(i=>i.id===data.plan!.improvement_id)&&<option value={data.plan.improvement_id}>Предложение #{data.plan.improvement_id}</option>}{improvements.map(i=><option key={i.id} value={i.id}>#{i.id} · {i.proposal}</option>)}</select></Label>
      {data.plan&&<Label name="Причина изменения или переноса"><textarea name="reason" required maxLength={1000} className={inputClass}/></Label>}
      <button type="submit" className={buttonClass}>{busy?'Сохраняем…':data.plan?'Сохранить изменение':'Выделить время'}</button>
    </fieldset></form>:data.plan?<div className="space-y-2"><p className="font-semibold">{category(data.plan)}</p><p>{data.plan.outcome}</p><p>{time(data.plan.start_at)} — {time(data.plan.end_at)}</p></div>:<p>Время на важную работу ещё не выделено.</p>)}
    {!!data?.history.length&&<details><summary className="cursor-pointer font-semibold">История планирования · {data.history.length}</summary><ul className="space-y-3 pt-3">{data.history.map(h=><li key={h.id} className="border-t pt-2 text-sm"><p>{h.actor_name} · {time(h.created_at)}</p><p>{h.reason}</p>{h.before_value&&<p>Было: {time(h.before_value.start_at)} — {time(h.before_value.end_at)}</p>}<p>Стало: {time(h.after_value.start_at)} — {time(h.after_value.end_at)}</p><p>Результат: {h.after_value.outcome}</p></li>)}</ul></details>}
  </section>
}

export function FocusBoard({mine=false}:{mine?:boolean}) {
  const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const [anchor,setAnchor]=useState(dateKey(new Date())),[view,setView]=useState('week'),[revision,setRevision]=useState(0)
  useEffect(()=>{let active=true;setLoading(true);workflowGet<Row[]>(mine?'/focus/my':'/focus').then(r=>{if(active){setRows(r);setError('')}}).catch(e=>{if(active)setError(toUserMessage(e))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[mine,revision])
  const today=dateKey(new Date()), day=new Date(`${anchor||today}T00:00:00Z`)
  const monday=new Date(day);monday.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7)
  const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6)
  const from=mine?today:monday.toISOString().slice(0,10),to=mine?today:sunday.toISOString().slice(0,10)
  const scoped=rows.filter(r=>mine? !closed(r.status)&&r.important&&!r.urgent&&dateKey(new Date(r.start_at))<=today : view==='matrix'? !closed(r.status) : dateKey(new Date(r.start_at))<=to&&dateKey(new Date(r.end_at))>=from)
  const card=(r:Row)=><Link key={r.task_id} to={`/workflow/tasks/${r.task_id}`} className="block space-y-1 rounded-xl border bg-white p-3 hover:border-violet-600"><p className="font-semibold">#{r.task_id} · {r.description}</p><p>{r.outcome}</p><p className="text-sm">{time(r.start_at)} — {time(r.end_at)} · {r.assignee_name}</p><p className="text-sm">Крайний срок: {r.due_date??'не задан'}</p>{mine&&dateKey(new Date(r.end_at))<today&&<p className="text-sm text-amber-800">Плановое время прошло — согласуйте новое время</p>}{r.reschedules>0&&<p className="text-sm text-amber-800">Переносов: {r.reschedules}</p>}{r.status==='VERIFIED'&&<p className="text-sm text-emerald-700">Результат принят</p>}{r.status==='COMPLETED'&&<p className="text-sm">На приёмке</p>}{r.status==='CANCELLED'&&<p className="text-sm">Отменена</p>}</Link>
  return <section className={panelClass} aria-label={mine?'Важное заранее сегодня':'План недели'}><h2 className="text-xl font-bold">{mine?'Важное заранее':'План недели и приоритеты'}</h2>
    <p className="text-sm text-slate-600">{mine?'Ваши важные дела на сегодня и незавершённые планы прошлых дней.':'Сначала выделите время важным несрочным делам. Откройте задачу, чтобы задать результат и время. Время — Уральск (UTC+5).'}</p>
    {!mine&&<div className="flex flex-wrap items-end gap-3"><Label name="Неделя с выбранной датой"><input type="date" className={inputClass} value={anchor} onChange={e=>{if(e.target.value)setAnchor(e.target.value)}}/></Label><button type="button" className={buttonClass} onClick={()=>setView(view==='week'?'matrix':'week')}>{view==='week'?'Показать четыре квадрата':'Показать неделю'}</button></div>}
    {loading?<p role="status">Загрузка планов…</p>:error?<p role="alert" className="text-red-700">{error}</p>:<>
      {!mine&&view==='week'&&<p>Неделя {from} — {to}. Принято важных несрочных результатов: {scoped.filter(r=>r.important&&!r.urgent&&r.status==='VERIFIED').length}. На приёмке: {scoped.filter(r=>r.important&&!r.urgent&&r.status==='COMPLETED').length}.</p>}
      {!scoped.length?<p>Запланированных дел за этот период нет.</p>:mine?<div className="space-y-3">{scoped.map(card)}</div>:<div className="grid gap-4 md:grid-cols-2">{[[true,false,'Важное заранее'],[true,true,'Важно и срочно'],[false,true,'Срочные поручения'],[false,false,'Отложить или пересмотреть']].map(([important,urgent,label],i)=><section key={i} className={`space-y-3 rounded-xl p-3 ${i===0?'border-2 border-violet-400 bg-violet-50':'bg-slate-100'}`}><h3 className="font-bold">{String(label)}</h3>{scoped.filter(r=>r.important===important&&r.urgent===urgent).map(card)}</section>)}</div>}
    </>}
    <button type="button" className="text-sm text-blue-700 underline" disabled={loading} onClick={()=>setRevision(r=>r+1)}>Обновить планы</button>
  </section>
}
