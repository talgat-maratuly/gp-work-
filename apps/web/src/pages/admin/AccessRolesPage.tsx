import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { fetchAccessCatalog, fetchAccessRoles, saveAccessRole, type AccessCatalog, type AccessRole } from '@/api/accessRolesApi'
import { toUserMessage } from '@/api/client'
import { ROLE_LABELS, type UserRole } from '@/lib/auth'

const fresh = () => ({name:'',baseRole:'ADMIN' as UserRole,permissions:[] as string[],pages:[] as string[],canJoinBrigade:false,isActive:true})
export function AccessRolesPage() {
  const [roles,setRoles]=useState<AccessRole[]>([])
  const [catalog,setCatalog]=useState<AccessCatalog|null>(null)
  const [editing,setEditing]=useState<AccessRole|null>(null)
  const [form,setForm]=useState(fresh)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  async function load() {
    setBusy(true); setError('')
    try { const [r,c]=await Promise.all([fetchAccessRoles(),fetchAccessCatalog()]);setRoles(r);setCatalog(c) }
    catch(e) { setError(toUserMessage(e)) } finally {setBusy(false)}
  }
  useEffect(()=>{void load()},[])
  function edit(role:AccessRole) {setEditing(role);setForm({...role,permissions:role.permissions??[]});setSuccess('');setError('')}
  async function submit(e:FormEvent) {
    e.preventDefault(); if(busy||!catalog)return
    setBusy(true);setError('');setSuccess('')
    try {
      const saved=await saveAccessRole({...form,revision:editing?.revision},editing?.id)
      setRoles(rows=>[...rows.filter(r=>r.id!==saved.id),saved]);setEditing(saved);setForm({...saved,permissions:saved.permissions??[]})
      setSuccess('Роль сохранена. Её можно выбрать при создании и редактировании сотрудника.')
    } catch(e){setError(toUserMessage(e))} finally {setBusy(false)}
  }
  const operations=catalog?.operations.filter(op=>op.roles.includes(form.baseRole))??[]
  const sections=[...new Set(operations.map(op=>op.section))]
  const toggle=(field:'pages'|'permissions',key:string,checked:boolean)=>setForm(f=>({...f,[field]:checked?[...f[field],key]:f[field].filter(v=>v!==key)}))
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Роли и права доступа</h1>
    <p className="text-sm text-slate-600">Роль определяет доступ, должность — название работы, бригада — коллектив. Новая роль не получает прав, пока вы их не отметите. Тип роли сохраняет существующие правила: например, бригадир работает в пределах своей бригады.</p>
    <Link to="/admin/users" className="text-blue-700 underline">Перейти к сотрудникам</Link>
    {error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {success&&<p role="status" className="rounded bg-green-50 p-3 text-green-800">{success}</p>}
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="rounded border bg-white p-2" onClick={()=>{setEditing(null);setForm(fresh());setSuccess('');setError('')}}>Новая роль</button><button type="button" disabled={busy} className="rounded border bg-white p-2" onClick={()=>void load()}>Обновить список</button></div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{roles.map(role=><button type="button" key={role.id} disabled={busy} onClick={()=>edit(role)} className={`min-w-0 rounded border p-3 text-left ${editing?.id===role.id?'border-blue-500 bg-blue-50':'bg-white'}`}><span className="break-words font-semibold">{role.name}</span><span className="block text-xs text-slate-500">{role.systemKey?'Системная':'Настраиваемая'} · {role.isActive?'Активна':'В архиве'} · {role.canJoinBrigade?'Можно в бригаду':'Без бригады'}</span></button>)}</div>
    {catalog&&<form aria-label="Настройка роли" onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-4">
      <h2 className="text-lg font-semibold">{editing?`Редактирование: ${editing.name}`:'Создание роли'}</h2>
      <label className="block">Название роли<input aria-label="Название роли" required maxLength={100} disabled={busy||!!editing?.systemKey} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="mt-1 block w-full rounded border p-2" /></label>
      <label className="block">Тип доступа<select aria-label="Тип доступа" disabled={busy||!!editing} value={form.baseRole} onChange={e=>setForm(f=>({...f,baseRole:e.target.value as UserRole,permissions:[],pages:[]}))} className="mt-1 block w-full rounded border p-2">{Object.entries(ROLE_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <p className="text-xs text-slate-500">Тип задаёт верхнюю границу прав и область ответственности, но сам по себе не выдаёт разрешения. Управление пользователями, паролями и ролями остаётся у системного администратора и директора.</p>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.canJoinBrigade} disabled={busy} onChange={e=>setForm(f=>({...f,canJoinBrigade:e.target.checked}))}/>Можно привязывать к бригаде</label>
      {!editing?.systemKey&&<label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} disabled={busy} onChange={e=>setForm(f=>({...f,isActive:e.target.checked}))}/>Роль активна</label>}
      {editing?.systemKey?<p className="rounded bg-slate-50 p-3 text-sm">Права и название системной роли сохранены для совместимости. Для другого набора прав создайте новую роль. Запрет привязки к бригаде возможен после снятия существующих назначений.</p>:<>
        <fieldset disabled={busy} className="rounded border p-3"><legend className="font-semibold">Видимые разделы</legend><p className="mb-2 text-xs text-slate-500">Отметьте разделы меню. Ниже отдельно разрешите нужные действия и чтение справочников для этих разделов.</p><div className="grid gap-2 sm:grid-cols-2">{Object.entries(catalog.pages).filter(([path])=>catalog.pageRoles[path]?.includes(form.baseRole)).map(([path,name])=><label key={path} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pages.includes(path)} onChange={e=>toggle('pages',path,e.target.checked)}/>{name}</label>)}</div></fieldset>
        <h3 className="font-semibold">Разрешённые действия на сервере</h3>
        <p className="text-xs text-slate-500">Без отметки действие запрещено, даже по прямому запросу. Просмотр данных, изменение и приёмка выдаются отдельно. Публичные QR-формы сохраняют прежние правила.</p>
        {sections.map(section=><details key={section} className="rounded border p-3"><summary className="cursor-pointer font-medium">{section} ({operations.filter(op=>op.section===section&&form.permissions.includes(op.key)).length})</summary><div className="mt-3 space-y-2">{operations.filter(op=>op.section===section).map(op=><label key={op.key} className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" disabled={busy} checked={form.permissions.includes(op.key)} onChange={e=>toggle('permissions',op.key,e.target.checked)}/><span>{op.label}<span className="block break-all text-xs text-slate-400">{op.path}</span></span></label>)}</div></details>)}
      </>}
      <button type="submit" disabled={busy||!form.name.trim()} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy?'Сохранение…':'Сохранить роль'}</button>
    </form>}
  </div>
}
