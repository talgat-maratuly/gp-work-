import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { archiveBusinessDefinition, getBusinessDefinitions, publishBusinessDefinition, type BusinessDefinition, type BusinessField, type BusinessSchema } from '@/api/businessProcessesApi'
import { toUserMessage } from '@/api/client'
import { ROLE_LABELS, type UserRole } from '@/lib/auth'
import { Label, inputClass, buttonClass, panelClass } from '@/components/workflow/Controls'

const roles = ['ADMIN', 'DIRECTOR', 'BRIGADIER', 'AGRONOMIST', 'WORKER', 'WATER_CARRIER']
const key = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`
const types: Record<BusinessField['type'], string> = { text: 'Текст', number: 'Число', date: 'Дата', boolean: 'Да / нет', select: 'Список' }
const blank = (): BusinessSchema => ({ title: '', description: '', initialStageId: 'stage_start', fields: [], stages: [
  { id: 'stage_start', label: 'Подготовка', roles: [...roles], requiredFields: [], nextStages: ['stage_review'] },
  { id: 'stage_review', label: 'Согласование', roles: ['ADMIN', 'DIRECTOR'], requiredFields: [], nextStages: ['stage_done', 'stage_start'] },
  { id: 'stage_done', label: 'Завершено', roles: ['ADMIN', 'DIRECTOR'], requiredFields: [], nextStages: [] },
] })
function Checks({ title, options, value, onChange }: { title: string; options: { id: string; label: string }[]; value: string[]; onChange: (ids: string[]) => void }) {
  return <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">{title}</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{options.map(o => <label key={o.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.includes(o.id)} onChange={e => onChange(e.target.checked ? [...value, o.id] : value.filter(id => id !== o.id))}/>{o.label}</label>)}</div></fieldset>
}
const roleOptions = roles.map(id => ({ id, label: ROLE_LABELS[id as UserRole] }))

export function BusinessProcessesPage() {
  const [definitions, setDefinitions] = useState<BusinessDefinition[]>([])
  const [previous, setPrevious] = useState<BusinessDefinition>()
  const [schema, setSchema] = useState<BusinessSchema>(blank)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState(''), [dirty, setDirty] = useState(false)
  const load = useCallback(async () => { setDefinitions(await getBusinessDefinitions()); setLoading(false) }, [])
  useEffect(() => { void load().catch(e => { setError(toUserMessage(e)); setLoading(false) }) }, [load])
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty])
  function change(next: BusinessSchema) { setSchema(next); setDirty(true); setNotice('') }
  function edit(item?: BusinessDefinition) {
    if (dirty && !window.confirm('Заменить несохранённые изменения шаблона?')) return
    setPrevious(item); setSchema(item ? structuredClone(item.schema) : blank()); setDirty(false); setError(''); setNotice('')
  }
  function field(id: string, patch: Partial<BusinessField>) { change({ ...schema, fields: schema.fields.map(f => f.id === id ? { ...f, ...patch } : f) }) }
  async function publish(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { const saved = await publishBusinessDefinition(schema, previous); setPrevious(saved); setSchema(structuredClone(saved.schema)); setDirty(false); setNotice(`Опубликована версия ${saved.version}. Её можно подключить к задаче.`); await load() }
    catch (e) { setError(toUserMessage(e)) } finally { setBusy(false) }
  }
  async function archive(item: BusinessDefinition) {
    if (previous?.process_id === item.process_id && dirty && !window.confirm('Отменить несохранённые изменения и изменить доступность процесса?')) return
    setBusy(true); setError('')
    try { await archiveBusinessDefinition(item.process_id, !item.archived); if (previous?.process_id === item.process_id) { setPrevious(undefined); setSchema(blank()); setDirty(false) } await load(); setNotice(item.archived ? 'Процесс восстановлен' : 'Процесс в архиве. Начатые экземпляры продолжают работать.') }
    catch (e) { setError(toUserMessage(e)) } finally { setBusy(false) }
  }
  return <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
    <header className="space-y-2"><h1 className="text-2xl font-bold">Бизнес-процессы</h1><p className="text-slate-600">Создайте поля и порядок согласования для задач. Каждая публикация сохраняет отдельную версию.</p><Link className="font-semibold text-blue-700 underline" to="/admin/workflow">Открыть задачи и подключить процесс</Link></header>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}<button type="button" className="ml-3 underline" disabled={busy} onClick={() => void load().then(() => setError('')).catch(e => setError(toUserMessage(e)))}>Обновить список</button></div>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className={panelClass}><h2 className="font-bold">Шаблоны процессов</h2><button type="button" className={buttonClass} disabled={busy} onClick={() => edit()}>Новый процесс</button>
        {loading ? <p>Загрузка…</p> : !definitions.length ? <p className="text-sm text-slate-600">Создайте первый шаблон справа.</p> : definitions.map(d => <article key={d.id} className="space-y-2 rounded-xl border p-3"><h3 className="break-words font-semibold">{d.schema.title}</h3><p className="text-sm">Версия {d.version} · {d.archived ? 'В архиве' : 'Действует'}</p><div className="flex flex-wrap gap-3">{!d.archived && <button type="button" className="text-blue-700 underline" disabled={busy} onClick={() => edit(d)}>Изменить шаблон</button>}<button type="button" className="text-slate-600 underline" disabled={busy} onClick={() => void archive(d)}>{d.archived ? 'Восстановить' : 'В архив'}</button></div></article>)}
      </aside>
      <form onSubmit={publish} className={panelClass}><h2 className="text-xl font-bold">{previous ? `Новая версия: ${previous.schema.title}` : 'Конструктор процесса'}</h2><fieldset disabled={busy} className="min-w-0 space-y-6">
        <Label name="Название процесса"><input required maxLength={120} className={inputClass} value={schema.title} onChange={e => change({ ...schema, title: e.target.value })} placeholder="Например: согласование работ на объекте"/></Label>
        <Label name="Описание процесса"><textarea maxLength={1000} className={inputClass} value={schema.description} onChange={e => change({ ...schema, description: e.target.value })}/></Label>
        <section className="space-y-4"><h3 className="text-lg font-bold">Бизнес-поля</h3><p className="text-sm text-slate-600">Число подходит для площади, количества или суммы. Единицу измерения укажите в названии. Директор и администратор видят все поля; заполнение определяется настройкой ниже.</p>
          {schema.fields.map((f, index) => <article key={f.id} className="space-y-3 rounded-xl border bg-slate-50 p-3 sm:p-4"><div className="grid gap-3 sm:grid-cols-2"><Label name={`Название поля ${index + 1}`}><input required maxLength={120} className={inputClass} value={f.label} onChange={e => field(f.id, { label: e.target.value })}/></Label><Label name={`Тип поля ${index + 1}`}><select className={inputClass} value={f.type} onChange={e => field(f.id, { type: e.target.value as BusinessField['type'], options: [] })}>{Object.entries(types).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Label></div>
            <Label name={`Подсказка поля ${index + 1}`}><input maxLength={300} className={inputClass} value={f.hint} onChange={e => field(f.id, { hint: e.target.value })}/></Label>
            {f.type === 'select' && <Label name={`Варианты поля ${index + 1}, каждый с новой строки`}><textarea required className={inputClass} value={f.options.join('\n')} onChange={e => field(f.id, { options: e.target.value.split('\n') })}/></Label>}
            <Checks title={`Кто видит поле ${index + 1}`} options={roleOptions} value={f.readRoles} onChange={readRoles => field(f.id, { readRoles })}/>
            <Checks title={`Кто заполняет поле ${index + 1}`} options={roleOptions} value={f.editRoles} onChange={editRoles => field(f.id, { editRoles })}/>
            <button type="button" className="text-sm text-red-700 underline" onClick={() => change({ ...schema, fields: schema.fields.filter(v => v.id !== f.id), stages: schema.stages.map(s => ({ ...s, requiredFields: s.requiredFields.filter(id => id !== f.id) })) })}>Убрать поле {index + 1}</button>
          </article>)}
          <button type="button" className="font-semibold text-blue-700 underline" disabled={schema.fields.length >= 50} onClick={() => change({ ...schema, fields: [...schema.fields, { id: key('field'), label: '', type: 'text', hint: '', options: [], readRoles: [...roles], editRoles: [...roles] }] })}>Добавить поле</button>
        </section>
        <section className="space-y-4"><h3 className="text-lg font-bold">Этапы и переходы</h3><p className="text-sm text-slate-600">Обязательные поля проверяются при выходе из этапа и входе в следующий. Этап без переходов завершает процесс и блокирует дальнейшее редактирование. Статус выполнения самой задачи меняется в её обычном рабочем цикле.</p>
          <Label name="Начальный этап"><select className={inputClass} value={schema.initialStageId} onChange={e => change({ ...schema, initialStageId: e.target.value })}>{schema.stages.map(s => <option key={s.id} value={s.id}>{s.label || 'Без названия'}</option>)}</select></Label>
          {schema.stages.map((s, index) => { const stage = (patch: Partial<typeof s>) => change({ ...schema, stages: schema.stages.map(v => v.id === s.id ? { ...v, ...patch } : v) }); return <article key={s.id} className="space-y-3 rounded-xl border bg-slate-50 p-3 sm:p-4">
            <Label name={`Название этапа ${index + 1}`}><input required maxLength={120} className={inputClass} value={s.label} onChange={e => stage({ label: e.target.value })}/></Label>
            <Checks title={`Кто завершает этап ${index + 1}`} options={roleOptions} value={s.roles} onChange={roles => stage({ roles })}/>
            {!!schema.fields.length && <Checks title={`Обязательные поля этапа ${index + 1}`} options={schema.fields.map(f => ({ id: f.id, label: f.label || 'Без названия' }))} value={s.requiredFields} onChange={requiredFields => stage({ requiredFields })}/>}
            <Checks title={`Переходы из этапа ${index + 1}`} options={schema.stages.filter(v => v.id !== s.id).map(v => ({ id: v.id, label: v.label || 'Без названия' }))} value={s.nextStages} onChange={nextStages => stage({ nextStages })}/>
            {!s.nextStages.length && <p className="text-sm font-semibold text-emerald-700">Завершающий этап</p>}
            <button type="button" disabled={schema.stages.length <= 2} className="text-sm text-red-700 underline disabled:opacity-40" onClick={() => { const stages = schema.stages.filter(v => v.id !== s.id).map(v => ({ ...v, nextStages: v.nextStages.filter(id => id !== s.id) })); change({ ...schema, stages, initialStageId: schema.initialStageId === s.id ? stages[0].id : schema.initialStageId }) }}>Убрать этап {index + 1}</button>
          </article> })}
          <button type="button" className="font-semibold text-blue-700 underline" disabled={schema.stages.length >= 20} onClick={() => change({ ...schema, stages: [...schema.stages, { id: key('stage'), label: '', roles: ['ADMIN', 'DIRECTOR'], requiredFields: [], nextStages: [] }] })}>Добавить этап</button>
        </section>
        <div className="space-y-2 border-t pt-4"><button type="submit" className={buttonClass}>{busy ? 'Сохранение…' : previous ? 'Опубликовать новую версию' : 'Опубликовать процесс'}</button><p className="text-sm text-slate-600">Начатые процессы сохраняют прежнюю версию и значения полей.</p></div>
      </fieldset></form>
    </div>
  </div>
}
