import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, toUserMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { getToken } from '@/lib/auth'
import { Field, Panel, inputClass, buttonClass, secondaryClass, scopeNames } from './office-ui'

type AccessData={users:any[];units:any[];positions:any[];profiles:Record<string,string>}
export function OfficeAccessPage(){
  const {user}=useAuth();const [data,setData]=useState<AccessData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState('')
  const [selected,setSelected]=useState('new'),[name,setName]=useState(''),[unit,setUnit]=useState(''),[position,setPosition]=useState(''),[profile,setProfile]=useState('EMPLOYEE'),[scope,setScope]=useState('SELF'),[enabled,setEnabled]=useState(true)
  const [credentials,setCredentials]=useState<any>(null);const lock=useRef(false)
  const load=useCallback(async()=>{const token=getToken();try{const result=await apiRequest<AccessData>('/office-access');if(token===getToken())setData(result)}catch(e){if(token===getToken()){setData(null);setError(toUserMessage(e))}}},[user?.id])
  useEffect(()=>{void load();return()=>setCredentials(null)},[load])
  function select(value:string){setSelected(value);setCredentials(null);setSuccess('');const row=data?.users.find(u=>u.id===Number(value));setName(row?.full_name??'');setUnit(String(row?.unit_id??''));setPosition(String(row?.position_id??''));setProfile(row?.profile??'EMPLOYEE');setScope(row?.scope??'SELF');setEnabled(row?.enabled??true)}
  async function save(e:React.FormEvent){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setSuccess('');setCredentials(null);const token=getToken();try{
    if(selected==='new'){
      const result=await apiRequest('/office-access/provision',{method:'POST',body:JSON.stringify({fullName:name,unitId:Number(unit),positionId:position?Number(position):null,profile,scope})});if(token!==getToken())return;setCredentials(result);setSuccess('Личный аккаунт создан. Передайте код и временный пароль только этому сотруднику.');
    }else{const row=data!.users.find(u=>u.id===Number(selected));await apiRequest('/office-access/save',{method:'POST',body:JSON.stringify({userId:row.id,revision:row.revision,organizationRevision:row.organization_revision,unitId:Number(unit),profile,scope,enabled})});if(token!==getToken())return;setSuccess('Доступ сохранён. Новые ограничения действуют при следующем запросе сотрудника.');}
    await load()
  }catch(err){if(token===getToken())setError(toUserMessage(err))}finally{lock.current=false;setBusy(false)}}
  const staff=data?.users.filter(u=>!(u.access_role_id==null&&['ADMIN','DIRECTOR'].includes(u.role))&&!['AKIMAT','ANTICOR'].includes(u.role))??[]
  return <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
    <div className="flex flex-wrap gap-3 text-sm font-semibold text-emerald-800"><Link to="/admin/organization">← Структура и состав</Link><Link to="/office">Рабочий кабинет →</Link></div>
    <h1 className="text-3xl font-bold">Личные рабочие доступы</h1>
    <p className="text-slate-600">Подразделение определяет доступные проекты, профиль — доступные разделы и действия. Назначение рабочего профиля переводит сотрудника в личный кабинет и закрывает общие административные и полевые разделы. Для полевых сотрудников сохраняйте их существующий доступ.</p>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button onClick={()=>void load()} className="underline">Обновить</button></p>}
    {success&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{success}</p>}
    {credentials&&<Panel title="Личный вход — покажите сотруднику один раз"><dl className="space-y-2 break-all"><dt>Сотрудник</dt><dd className="font-bold">{credentials.fullName}</dd><dt>Личный код (логин)</dt><dd data-testid="personal-code" className="font-mono text-xl">{credentials.username}</dd><dt>Временный пароль</dt><dd data-testid="temporary-password" className="font-mono text-xl">{credentials.temporaryPassword}</dd></dl><p className="my-3 text-sm">Действует 24 часа. При первом входе сотрудник устанавливает свой пароль. Повторно посмотреть этот пароль нельзя; новый выдаётся в разделе «Сотрудники».</p><button className={secondaryClass} onClick={()=>setCredentials(null)}>Скрыть реквизиты входа</button></Panel>}
    {data&&<Panel title="Назначение доступа"><form onSubmit={save} className="space-y-4"><Field label="Сотрудник"><select className={inputClass} value={selected} onChange={e=>select(e.target.value)}><option value="new">Создать нового сотрудника с личным кодом</option>{staff.map(u=><option key={u.id} value={u.id}>{u.full_name} · {u.username}</option>)}</select></Field>
      {selected==='new'&&<div className="grid gap-4 sm:grid-cols-2"><Field label="ФИО"><input required maxLength={240} className={inputClass} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Должность"><select className={inputClass} value={position} onChange={e=>setPosition(e.target.value)}><option value="">Не назначена</option>{data.positions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div>}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Подразделение"><select required className={inputClass} value={unit} onChange={e=>setUnit(e.target.value)}><option value="">Выберите подразделение</option>{data.units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><Field label="Рабочий профиль"><select className={inputClass} value={profile} onChange={e=>{setProfile(e.target.value);if(e.target.value==='EMPLOYEE')setScope('SELF')}}>{Object.entries(data.profiles).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field></div>
      <Field label="Какие проекты доступны"><select className={inputClass} value={scope} onChange={e=>setScope(e.target.value)}>{Object.entries(scopeNames).filter(([k])=>profile!=='EMPLOYEE'||k==='SELF').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
      {selected!=='new'&&<label className="flex gap-2"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Рабочий доступ включён</label>}
      <button disabled={busy} className={buttonClass}>{busy?'Сохранение…':selected==='new'?'Создать личный вход':'Сохранить рабочий доступ'}</button>
    </form></Panel>}
    {data&&<Panel title="Состав и доступы"><div className="space-y-3">{data.users.map(u=><article key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><strong>{u.full_name}</strong><p className="text-sm text-slate-600">{u.username} · {data.units.find(n=>n.id===u.unit_id)?.name??'Подразделение не назначено'}</p><p className="text-sm">{u.profile?`${data.profiles[u.profile]} · ${scopeNames[u.scope]} · ${u.enabled?'Включён':'Отключён'}`:u.access_role_id==null&&['ADMIN','DIRECTOR'].includes(u.role)?'Руководитель: все проекты':'Существующий доступ; рабочий профиль не назначен'}</p></div>{staff.some(s=>s.id===u.id)&&<button className={secondaryClass} onClick={()=>{select(String(u.id));window.scrollTo({top:0,behavior:'smooth'})}}>Настроить</button>}</article>)}</div></Panel>}
  </main>
}
