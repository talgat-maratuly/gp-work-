import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { workflowPost, type ToolItem, type BoardTask } from '@/api/workflowApi'
import { toUserMessage } from '@/api/client'
import { Label,inputClass,buttonClass,panelClass } from './Controls'
const states={READY:'Готов к выдаче',ISSUED:'Выдан',MAINTENANCE:'Требует проверки или ремонта',RETIRED:'Списан'}
export function ToolsPanel({tools,tasks,onChanged}:{tools:ToolItem[];tasks:BoardTask[];onChanged:()=>Promise<void>}) {
  const {user}=useAuth();const global=['ADMIN','DIRECTOR'].includes(user!.role)
  const [error,setError]=useState('');const [busy,setBusy]=useState(false)
  async function create(e:React.FormEvent<HTMLFormElement>) {e.preventDefault();const form=e.currentTarget;const data=new FormData(form);setBusy(true);setError('');try{await workflowPost('/tools',{code:data.get('code'),name:data.get('name'),homeLocation:data.get('homeLocation')});form.reset();await onChanged()}catch(err){setError(toUserMessage(err))}finally{setBusy(false)}}
  return <div className="space-y-4"><p className="text-sm text-slate-600">Каждый инструмент имеет инвентарный номер и место хранения. Перед выдачей — проверка исправности и чистоты; при возврате — состояние и место. Расходные материалы учитываются в существующем складе.</p>
    {global&&<details className={panelClass}><summary className="cursor-pointer font-bold">Добавить инструмент</summary><form onSubmit={create} className="space-y-3"><fieldset disabled={busy} className="space-y-3"><Label name="Инвентарный номер"><input className={inputClass} name="code" maxLength={80} required/></Label><Label name="Название инструмента"><input className={inputClass} name="name" maxLength={160} required/></Label><Label name="Постоянное место хранения"><input className={inputClass} name="homeLocation" maxLength={200} required/></Label><button className={buttonClass} type="submit">Зарегистрировать инструмент</button></fieldset>{error&&<p role="alert" className="text-red-700">{error}</p>}</form></details>}
    {!tools.length&&<p className={panelClass}>Доступных инструментов пока нет.</p>}
    {tools.map(tool=><ToolCard key={`${tool.id}:${tool.state}:${tool.checked_at}`} tool={tool} tasks={tasks} onChanged={onChanged}/>)}
  </div>
}
function ToolCard({tool,tasks,onChanged}:{tool:ToolItem;tasks:BoardTask[];onChanged:()=>Promise<void>}) {
  const {user}=useAuth();const store=['ADMIN','DIRECTOR','BRIGADIER'].includes(user!.role);const global=['ADMIN','DIRECTOR'].includes(user!.role)
  const actions=tool.state==='RETIRED'?[]:tool.state==='ISSUED'?['return']:store?['inspect',...(tool.state==='READY'?['issue']:[]),...(global?['retire']:[])]:[]
  const labels:Record<string,string>={inspect:'Проверить состояние',issue:'Выдать на задачу',return:'Вернуть инструмент',retire:'Списать инструмент'}
  const [action,setAction]=useState(actions[0]??'');const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  async function submit(e:React.FormEvent<HTMLFormElement>) {e.preventDefault();const d=new FormData(e.currentTarget);setBusy(true);setError('');try{await workflowPost(`/tools/${tool.id}/actions`,{action,note:d.get('note'),...(action==='issue'?{taskId:Number(d.get('taskId'))}:action==='retire'?{}:{location:d.get('location'),serviceable:d.get('serviceable')==='on',clean:d.get('clean')==='on'})});await onChanged()}catch(err){setError(toUserMessage(err))}finally{setBusy(false)}}
  return <article className={panelClass}><div><h3 className="font-bold">{tool.code} · {tool.name}</h3><p className={tool.state==='READY'?'text-emerald-700':'text-amber-800'}>{states[tool.state]}</p><p className="text-sm">Сейчас: {tool.current_location}. Место хранения: {tool.home_location}{tool.task_id?` · задача #${tool.task_id}`:''}</p>{tool.condition_note&&<p className="text-sm text-slate-600">{tool.condition_note}</p>}{tool.checked_at&&<p className="text-xs text-slate-500">Проверен: {new Date(tool.checked_at).toLocaleString('ru-RU')}</p>}</div>
    {!!actions.length&&<details><summary className="cursor-pointer font-semibold text-blue-700">Действия с инструментом</summary><form onSubmit={submit} className="mt-3 space-y-3"><fieldset disabled={busy} className="space-y-3"><Label name="Действие"><select className={inputClass} value={action} onChange={e=>setAction(e.target.value)}>{actions.map(a=><option key={a} value={a}>{labels[a]}</option>)}</select></Label>
      {action==='issue'?<Label name="Задача для выдачи"><select className={inputClass} name="taskId" required defaultValue=""><option value="">Выберите задачу</option>{tasks.filter(t=>!['DONE','CANCELLED','REVIEW'].includes(t.stage)).map(t=><option key={t.id} value={t.id}>#{t.id} · {t.description}</option>)}</select></Label>:action!=='retire'&&<><Label name="Фактическое место"><input className={inputClass} name="location" defaultValue={tool.home_location} maxLength={200} required/></Label><label className="flex gap-2"><input name="serviceable" type="checkbox"/>Инструмент исправен</label><label className="flex gap-2"><input name="clean" type="checkbox"/>Инструмент очищен и комплектен</label></>}
      <Label name="Результат проверки или комментарий"><textarea className={inputClass} name="note" maxLength={1000} required/></Label><button type="submit" className={buttonClass}>{labels[action]}</button></fieldset>{error&&<p role="alert" className="text-red-700">{error}</p>}</form></details>}
  </article>
}
