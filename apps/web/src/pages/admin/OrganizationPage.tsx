import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toUserMessage } from '@/api/client'
import { getOrganization, getOrganizationHistory, saveOrgEmployee, saveOrgProcess, saveOrgUnit, UNIT_KINDS,
  type OrgDirectory, type OrgEmployee, type OrgHistory, type OrgProcess, type OrgUnit, type UnitInput, type UnitKind } from '@/api/organizationApi'
import { useAuth } from '@/context/AuthContext'
import { canOpenPage, canPerform } from '@/lib/accessPolicy'

const box = 'rounded-2xl border border-slate-200 bg-white p-4 md:p-5'
const input = 'mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900'
const button = 'rounded-lg border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50'
const primary = `${button} border-emerald-700 bg-emerald-700 text-white`
const numberOrNull = (value:string) => value ? Number(value) : null
const emptyUnit:UnitInput = { name:'',kind:'DEPARTMENT',parentId:null,headUserId:null,objectId:null,brigadeId:null,purpose:'',isActive:true,revision:0 }
const unitInput = (n:OrgUnit):UnitInput => ({name:n.name,kind:n.kind,parentId:n.parent_id,headUserId:n.head_user_id,objectId:n.object_id,brigadeId:n.brigade_id,purpose:n.purpose,isActive:n.is_active,revision:n.revision})
function Field({label,children}:{label:string;children:ReactNode}) { return <label className="block min-w-0 text-sm font-semibold text-slate-700">{label}{children}</label> }
function PersonOptions({data,current,exclude}:{data:OrgDirectory;current?:number|null;exclude?:number}) {
  return <><option value="">Не назначен</option>{data.employees.filter(p => p.user_id !== exclude && (p.is_active || p.user_id === current)).map(p => <option key={p.user_id} value={p.user_id}>{p.full_name}{p.is_active?'':' (отключён)'}</option>)}</>
}
function UnitOptions({data,current,exclude}:{data:OrgDirectory;current?:number|null;exclude?:number}) {
  return <><option value="">Не назначено</option>{data.units.filter(n => n.id !== exclude && (n.is_active || n.id === current)).map(n => <option key={n.id} value={n.id}>{n.name}{n.parent_name ? ` · ${n.parent_name}` : ''}{n.is_active?'':' (в архиве)'}</option>)}</>
}
function UnitForm({data,initial,id,busy,onSave,onCancel}:{data:OrgDirectory;initial:UnitInput;id:number|null;busy:boolean;onSave:(v:UnitInput)=>void;onCancel:()=>void}) {
  const [form,setForm] = useState(initial)
  const set = <K extends keyof UnitInput>(key:K,value:UnitInput[K]) => setForm(f=>({...f,[key]:value}))
  return <form aria-label="Редактор подразделения" className={`${box} border-emerald-400`} onSubmit={(e:FormEvent)=>{e.preventDefault();onSave(form)}}>
    <h2 className="mb-4 text-xl font-bold">{id == null?'Новое подразделение':'Редактирование подразделения'}</h2>
    <fieldset disabled={busy} className="grid min-w-0 gap-4 md:grid-cols-2">
      <Field label="Название подразделения"><input className={input} required maxLength={160} value={form.name} onChange={e=>set('name',e.target.value)}/></Field>
      <Field label="Тип подразделения"><select className={input} value={form.kind} onChange={e=>set('kind',e.target.value as UnitKind)}>{Object.entries(UNIT_KINDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Вышестоящее подразделение"><select className={input} value={form.parentId??''} onChange={e=>set('parentId',numberOrNull(e.target.value))}><UnitOptions data={data} current={form.parentId} exclude={id??undefined}/></select></Field>
      <Field label="Руководитель подразделения"><select className={input} value={form.headUserId??''} onChange={e=>set('headUserId',numberOrNull(e.target.value))}><PersonOptions data={data} current={form.headUserId}/></select></Field>
      <Field label="Связанный объект"><select className={input} value={form.objectId??''} onChange={e=>set('objectId',numberOrNull(e.target.value))}><option value="">Без привязки</option>{data.objects.filter(o=>o.is_active||o.id===form.objectId).map(o=><option key={o.id} value={o.id}>{o.name}{o.is_active?'':' (в архиве)'}</option>)}</select></Field>
      <Field label="Связанная бригада"><select className={input} value={form.brigadeId??''} onChange={e=>set('brigadeId',numberOrNull(e.target.value))}><option value="">Без привязки</option>{data.brigades.filter(b=>b.is_active||b.id===form.brigadeId).map(b=><option key={b.id} value={b.id}>{b.name}{b.is_active?'':' (в архиве)'}</option>)}</select></Field>
      <div className="md:col-span-2"><Field label="Функции и ожидаемый результат"><textarea className={input} rows={3} maxLength={3000} value={form.purpose} onChange={e=>set('purpose',e.target.value)}/></Field></div>
      {id != null && <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={e=>set('isActive',e.target.checked)}/>Действующее подразделение</label>}
      <p className="text-sm font-normal text-slate-500 md:col-span-2">Руководитель подразделения и прямой руководитель сотрудника назначаются отдельно. Привязка бригады не изменяет её рабочий состав.</p>
      <div className="flex flex-wrap gap-2 md:col-span-2"><button className={primary} type="submit">Сохранить подразделение</button><button className={button} type="button" onClick={onCancel}>Отмена</button></div>
    </fieldset>
  </form>
}
function EmployeeForm({data,person,busy,onSave,onCancel}:{data:OrgDirectory;person:OrgEmployee;busy:boolean;onSave:(v:{unitId:number|null;managerId:number|null;duties:string;revision:number})=>void;onCancel:()=>void}) {
  const [unit,setUnit] = useState(person.unit_id)
  const [manager,setManager] = useState(person.manager_id)
  const [duties,setDuties] = useState(person.duties)
  return <form aria-label="Назначение сотрудника" className={`${box} border-emerald-400`} onSubmit={e=>{e.preventDefault();onSave({unitId:unit,managerId:manager,duties,revision:person.revision})}}>
    <h2 className="mb-3 text-xl font-bold">{person.full_name}</h2>
    <p className="mb-4 text-slate-500">Должность: {person.position_name??'не назначена'}. {person.is_active?'':'Учётная запись отключена; можно снять назначение.'}</p>
    <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
      <Field label="Подразделение сотрудника"><select className={input} value={unit??''} onChange={e=>setUnit(numberOrNull(e.target.value))}><UnitOptions data={data} current={unit}/></select></Field>
      <Field label="Прямой руководитель"><select className={input} value={manager??''} onChange={e=>setManager(numberOrNull(e.target.value))}><PersonOptions data={data} current={manager} exclude={person.user_id}/></select></Field>
      <div className="md:col-span-2"><Field label="Зона ответственности сотрудника"><textarea className={input} rows={3} maxLength={3000} value={duties} onChange={e=>setDuties(e.target.value)}/></Field></div>
      <div className="flex flex-wrap gap-2 md:col-span-2"><button className={primary} type="submit">Сохранить назначение</button><button className={button} type="button" onClick={onCancel}>Отмена</button></div>
    </fieldset>
  </form>
}
function ProcessForm({data,process,busy,onSave,onCancel}:{data:OrgDirectory;process:OrgProcess;busy:boolean;onSave:(v:{unitId:number|null;ownerUserId:number|null;revision:number})=>void;onCancel:()=>void}) {
  const [unit,setUnit] = useState(process.unit_id)
  const [owner,setOwner] = useState(process.owner_user_id)
  return <form aria-label="Ответственность за процесс" className={`${box} border-emerald-400`} onSubmit={e=>{e.preventDefault();onSave({unitId:unit,ownerUserId:owner,revision:process.revision})}}>
    <h2 className="mb-4 text-xl font-bold">{process.title}</h2>
    <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
      <Field label="Подразделение процесса"><select className={input} value={unit??''} onChange={e=>setUnit(numberOrNull(e.target.value))}><UnitOptions data={data} current={unit}/></select></Field>
      <Field label="Владелец процесса"><select className={input} value={owner??''} onChange={e=>setOwner(numberOrNull(e.target.value))}><PersonOptions data={data} current={owner}/></select></Field>
      <p className="text-sm text-slate-500 md:col-span-2">Владелец отвечает за результат и улучшение процесса. Права выполнения этапов настраиваются в бизнес-процессе.{process.archived?' Процесс в архиве; можно снять ответственность.':''}</p>
      <div className="flex flex-wrap gap-2 md:col-span-2"><button className={primary} type="submit">Сохранить ответственность</button><button className={button} type="button" onClick={onCancel}>Отмена</button></div>
    </fieldset>
  </form>
}

const historyFields:Record<string,string> = {name:'Название',kind:'Тип',parent_name:'Вышестоящее подразделение',head_name:'Руководитель подразделения',object_name:'Объект',brigade_name:'Бригада',purpose:'Функции',is_active:'Действует',unit_name:'Подразделение',manager_name:'Прямой руководитель',duties:'Ответственность',owner_name:'Владелец процесса'}
function historyValue(value:unknown) { return value == null || value === '' ? 'Не назначено' : typeof value === 'boolean' ? (value?'Да':'Нет') : UNIT_KINDS[value as UnitKind]??String(value) }

export function OrganizationPage() {
  const {user} = useAuth()
  const [data,setData] = useState<OrgDirectory|null>(null)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [tab,setTab] = useState('structure')
  const [filter,setFilter] = useState('all')
  const [search,setSearch] = useState('')
  const [archive,setArchive] = useState(false)
  const [unitEditor,setUnitEditor] = useState<{id:number|null;value:UnitInput}|null>(null)
  const [personEditor,setPersonEditor] = useState<OrgEmployee|null>(null)
  const [processEditor,setProcessEditor] = useState<OrgProcess|null>(null)
  const [history,setHistory] = useState<OrgHistory[]>([])
  const [next,setNext] = useState<number|null>(null)
  const allowed = (key:string) => canPerform(user,`organization.${key}`)
  const closeEditors = () => {setUnitEditor(null);setPersonEditor(null);setProcessEditor(null)}
  const load = async () => {
    setLoading(true);setError('')
    try { setData(await getOrganization()) } catch(e) {setData(null);setError(toUserMessage(e,'Не удалось загрузить структуру'))} finally {setLoading(false)}
  }
  useEffect(()=>{void load()},[])
  const loadHistory = async (before?:number) => {
    setBusy(true);setError('')
    try {const result=await getOrganizationHistory(before);setHistory(prev=>before?[...prev,...result.items]:result.items);setNext(result.next)} catch(e) {setError(toUserMessage(e))} finally {setBusy(false)}
  }
  const save = async (action:()=>Promise<unknown>) => {
    setBusy(true);setError('');setNotice('')
    try {
      await action();closeEditors();setNotice('Изменения сохранены')
      try {setData(await getOrganization())} catch(e) {setData(null);setError(`Изменения сохранены, но список не обновлён. ${toUserMessage(e)}`)}
    } catch(e) {setError(toUserMessage(e))} finally {setBusy(false)}
  }
  const switchTab = (value:string) => {setTab(value);closeEditors();setNotice('');if(value==='history')void loadHistory()}
  const unitList = (parentId:number|null,depth=0):ReactNode => data?.units.filter(n=>n.parent_id===parentId&&(archive||n.is_active)).map(n=><li key={n.id}>
    <article aria-label={`Подразделение ${n.name}`} className={`${box} mb-3 ${n.is_active?'':'opacity-70'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{UNIT_KINDS[n.kind]}{n.is_active?'':' · Архив'}</p><h2 className="mt-1 break-words text-lg font-bold">{n.name}</h2></div>
        {allowed('updateUnit')&&<button className={button} disabled={busy} onClick={()=>{setUnitEditor({id:n.id,value:unitInput(n)});window.scrollTo({top:0,behavior:'smooth'})}}>Изменить</button>}</div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{n.purpose}</p>
      <p className="mt-3 text-sm"><strong>Руководитель:</strong> {n.head_name??'Не назначен'}{n.head_name&&n.head_active===false?' (отключён)':''}</p>
      {(n.object_name||n.brigade_name)&&<p className="mt-1 text-sm text-slate-600">{[n.object_name&&`Объект: ${n.object_name}`,n.brigade_name&&`Бригада: ${n.brigade_name}`].filter(Boolean).join(' · ')}</p>}
      <button className="mt-2 text-left text-sm font-semibold text-blue-700 underline" onClick={()=>{switchTab('people');setFilter(String(n.id));setSearch('')}}>Состав подразделения: {data.employees.filter(p=>p.unit_id===n.id&&p.is_active).length}</button>
    </article>
    {<ul className={depth<2?'ml-2 border-l-2 border-emerald-100 pl-2 md:ml-4 md:pl-4':'border-l border-slate-200 pl-1'}>{unitList(n.id,depth+1)}</ul>}
  </li>)
  const people = data?.employees.filter(p=>(archive||p.is_active)&&(filter==='all'||filter==='none'&&p.unit_id==null||String(p.unit_id)===filter)&&`${p.full_name} ${p.position_name??''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))??[]
  return <div className="mx-auto max-w-6xl space-y-5 text-slate-900">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-3 flex flex-wrap gap-3 text-sm font-semibold text-emerald-800"><Link to="/office">Проекты, договоры и финансы →</Link><Link to="/admin/office-access">Назначить личный рабочий доступ →</Link></div><h1 className="text-2xl font-black md:text-3xl">Структура и ответственность</h1><p className="mt-2 text-slate-600">Комбинированная модель: общие службы компании, территории, объекты и команды.</p></div><button className={button} disabled={loading||busy} onClick={()=>{closeEditors();setNotice('');void load();if(tab==='history')void loadHistory()}}>Обновить структуру</button></div>
    <div className={`${box} border-emerald-200 bg-emerald-50`}><p><strong>Генеральный директор</strong> отвечает за стратегию и развитие. <strong>Директор</strong> организует ежедневное выполнение работ.</p><p className="mt-2 text-sm text-slate-600">Качество и стратегическое планирование выделены в самостоятельные подразделения. Один сотрудник может совмещать функции. Назначения в структуре не меняют права доступа.</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-blue-700">
        {canOpenPage(user,'/admin/users')&&<Link className="underline" to="/admin/users">Сотрудники и должности →</Link>}
        {canOpenPage(user,'/admin/workflow')&&<Link className="underline" to="/admin/workflow">Кайдзен и важные задачи →</Link>}
        {canOpenPage(user,'/admin/business-processes')&&<Link className="underline" to="/admin/business-processes">Бизнес-процессы →</Link>}
      </div>
    </div>
    {error&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{error}<p className="mt-2 text-sm">При конфликте обновите структуру перед повторным редактированием.</p></div>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-100 p-3 text-emerald-900">{notice}</p>}
    {loading&&<p>Загрузка структуры…</p>}
    {!loading&&!data&&<button className={primary} onClick={()=>void load()}>Повторить загрузку</button>}
    {data&&<>
      <div className="grid gap-3 sm:grid-cols-3">{[['Звеньев структуры',data.units.filter(n=>n.is_active).length],['Сотрудников без подразделения',data.employees.filter(p=>p.is_active&&p.unit_id==null).length],['Подразделений без руководителя',data.units.filter(n=>n.is_active&&(!n.head_user_id||!n.head_active)).length]].map(([label,count])=><div key={label} className={box}><p className="text-2xl font-black">{count}</p><p className="text-sm text-slate-500">{label}</p></div>)}</div>
      <nav aria-label="Разделы структуры" className="flex flex-wrap gap-2">{[['structure','Структура'],['people','Состав подразделений'],['processes','Ответственность за процессы'],...(allowed('history')?[['history','История назначений']]:[])].map(([value,label])=><button key={value} disabled={busy} aria-pressed={tab===value} className={tab===value?primary:button} onClick={()=>switchTab(value)}>{label}</button>)}</nav>
      {tab!=='history'&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={archive} onChange={e=>setArchive(e.target.checked)}/>Показать архив и отключённых сотрудников</label>}
      {tab==='structure'&&<>
        {allowed('createUnit')&&<button className={primary} disabled={busy} onClick={()=>setUnitEditor({id:null,value:{...emptyUnit}})}>Добавить подразделение</button>}
        {unitEditor&&<UnitForm key={`${unitEditor.id}-${unitEditor.value.revision}`} data={data} id={unitEditor.id} initial={unitEditor.value} busy={busy} onCancel={()=>setUnitEditor(null)} onSave={v=>void save(()=>saveOrgUnit(unitEditor.id,v))}/>}
        <ul aria-label="Управленческая структура">{unitList(null)}</ul>
      </>}
      {tab==='people'&&<>
        <div className="grid gap-3 md:grid-cols-2"><Field label="Фильтр по подразделению"><select className={input} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Все сотрудники</option><option value="none">Без подразделения</option>{data.units.filter(n=>archive||n.is_active).map(n=><option key={n.id} value={n.id}>{n.name}{n.is_active?'':' (в архиве)'}</option>)}</select></Field><Field label="Поиск сотрудника"><input type="search" className={input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Имя или должность"/></Field></div>
        {personEditor&&<EmployeeForm key={`${personEditor.user_id}-${personEditor.revision}`} data={data} person={personEditor} busy={busy} onCancel={()=>setPersonEditor(null)} onSave={v=>void save(()=>saveOrgEmployee(personEditor.user_id,v))}/>}
        <p className="text-sm text-slate-500">Найдено сотрудников: {people.length}. Должности и рабочие бригады берутся из карточек сотрудников.</p>
        <ul className="grid gap-3 md:grid-cols-2">{people.map(p=><li aria-label={`Сотрудник ${p.full_name}`} key={p.user_id} className={box}><h2 className="break-words font-bold">{p.full_name}{p.is_active?'':' · Отключён'}</h2><p className="text-sm text-emerald-700">{p.position_name??'Должность не назначена'}{p.position_active===false?' (в архиве)':''}</p><dl className="mt-3 space-y-1 text-sm"><div><dt className="inline font-semibold">Подразделение: </dt><dd className="inline">{p.unit_name??'Не назначено'}</dd></div><div><dt className="inline font-semibold">Прямой руководитель: </dt><dd className="inline">{p.manager_name??'Не назначен'}{p.manager_active===false?' (отключён)':''}</dd></div><div><dt className="inline font-semibold">Бригада: </dt><dd className="inline">{p.brigade_name??'Не назначена'}</dd></div></dl>{p.duties&&<p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{p.duties}</p>}{allowed('assignEmployee')&&<button className={`${button} mt-3`} disabled={busy} onClick={()=>{setPersonEditor(p);window.scrollTo({top:0,behavior:'smooth'})}}>Назначить</button>}</li>)}</ul>
      </>}
      {tab==='processes'&&<>
        <p className="text-slate-600">Каждый процесс связан с ответственным подразделением и одним владельцем результата. Назначение сохраняется при выпуске новой версии процесса.</p>
        {processEditor&&<ProcessForm key={`${processEditor.process_id}-${processEditor.revision}`} data={data} process={processEditor} busy={busy} onCancel={()=>setProcessEditor(null)} onSave={v=>void save(()=>saveOrgProcess(processEditor.process_id,v))}/>}
        {!data.processes.some(p=>archive||!p.archived)&&<p className={box}>Действующих процессов пока нет. Опубликуйте процесс в разделе «Бизнес-процессы», затем назначьте владельца.</p>}
        <ul className="grid gap-3 md:grid-cols-2">{data.processes.filter(p=>archive||!p.archived).map(p=><li key={p.process_id} aria-label={`Процесс ${p.title}`} className={box}><h2 className="break-words font-bold">{p.title}{p.archived?' · Архив':''}</h2><p className="mt-2 text-sm">Подразделение: {p.unit_name??'Не назначено'}</p><p className="text-sm">Владелец: {p.owner_name??'Не назначен'}{p.owner_active===false?' (отключён)':''}</p>{allowed('assignProcess')&&<button disabled={busy} className={`${button} mt-3`} onClick={()=>setProcessEditor(p)}>Назначить ответственных</button>}</li>)}</ul>
      </>}
      {tab==='history'&&<><p className="text-sm text-slate-500">История изменений подразделений, подчинённости сотрудников и владельцев процессов. Начальные подразделения созданы при внедрении; персональные назначения выполняются вручную.</p>{!history.length&&!busy&&<p className={box}>Назначений и изменений пока нет.</p>}<ol className="space-y-3">{history.map(h=><li key={h.id} className={box}><p className="font-bold">{h.label}</p><p className="mt-1 text-sm text-slate-500">{new Date(h.created_at).toLocaleString('ru-RU')} · {h.actor_name??'Сотрудник недоступен'}</p><ul className="mt-2 space-y-1 text-sm">{Object.entries(historyFields).filter(([k])=>k in h.after_data&&h.before_data?.[k]!==h.after_data[k]).map(([k,label])=><li key={k} className="whitespace-pre-wrap break-words"><strong>{label}: </strong>{historyValue(h.before_data?.[k])} → {historyValue(h.after_data[k])}</li>)}</ul></li>)}</ol>{next&&<button disabled={busy} className={button} onClick={()=>void loadHistory(next)}>Показать более ранние изменения</button>}</>}
    </>}
  </div>
}
