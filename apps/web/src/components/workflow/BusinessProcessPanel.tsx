import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { toUserMessage } from '@/api/client'
import { attachBusinessProcess, getBusinessDefinitions, getTaskBusinessProcesses, saveBusinessProcess, type BusinessDefinition, type BusinessField, type BusinessInstance, type BusinessValues } from '@/api/businessProcessesApi'
import { Label, inputClass, buttonClass, panelClass } from './Controls'

const display = (value: unknown) => value === true ? 'Да' : value === false ? 'Нет' : value == null ? 'Не заполнено' : String(value)
function FieldInput({ field, value, set, disabled }: { field: BusinessField; value: BusinessValues[string] | undefined; set: (value: BusinessValues[string]) => void; disabled: boolean }) {
  return <div className="space-y-1"><Label name={field.label}>
    {disabled ? <span className="block whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3">{display(value)}</span> : field.type === 'boolean' ? <select className={inputClass} value={value === true ? 'yes' : value === false ? 'no' : ''} onChange={e => set(e.target.value === '' ? null : e.target.value === 'yes')}><option value="">Выберите ответ</option><option value="yes">Да</option><option value="no">Нет</option></select>
    : field.type === 'select' ? <select className={inputClass} value={String(value ?? '')} onChange={e => set(e.target.value || null)}><option value="">Выберите вариант</option>{field.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
    : field.type === 'text' ? <textarea className={inputClass} maxLength={4000} value={String(value ?? '')} onChange={e => set(e.target.value)}/>
    : <input className={inputClass} type={field.type} step={field.type === 'number' ? 'any' : undefined} value={String(value ?? '')} onChange={e => set(e.target.value === '' ? null : field.type === 'number' ? Number(e.target.value) : e.target.value)}/>}
  </Label>{field.hint && <p className="text-xs text-slate-500">{field.hint}</p>}</div>
}

function InstanceCard({ taskId, instance, onChanged }: { taskId: number; instance: BusinessInstance; onChanged: () => Promise<void> }) {
  const [values, setValues] = useState<BusinessValues>(instance.values), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const stages = instance.schema.stages
  const current = stages.find(s => s.id === instance.stage_id)!
  async function save(to?: string) {
    setBusy(true); setError(''); setNotice('')
    const patch = Object.fromEntries(instance.editableFieldIds.filter(id => (values[id] ?? null) !== (instance.values[id] ?? null)).map(id => [id, values[id] ?? null]))
    try { await saveBusinessProcess(taskId, instance.id, instance.revision, patch, to); setNotice('Сохранено'); await onChanged() }
    catch (e) { setError(toUserMessage(e)) } finally { setBusy(false) }
  }
  return <article className="space-y-4 rounded-xl border p-3 sm:p-4"><div><h3 className="text-lg font-bold">{instance.schema.title} · версия {instance.version}</h3>{instance.schema.description && <p className="text-sm text-slate-600">{instance.schema.description}</p>}<p className="mt-2 font-semibold">Этап: {current.label}</p><p className="text-sm text-slate-500">{instance.locked ? 'Доступен просмотр сохранённых данных' : 'Поля можно сохранять до перехода на следующий этап'}</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}{notice && <p role="status" className="text-emerald-700">{notice}</p>}
    <fieldset disabled={busy} className="space-y-3">{instance.schema.fields.map(field => <FieldInput key={field.id} field={field} value={values[field.id]} set={value => setValues(old => ({ ...old, [field.id]: value }))} disabled={!instance.editableFieldIds.includes(field.id)}/>)}
      {!!current.requiredFields.length && <p className="text-sm text-slate-600">Обязательные поля этого этапа: {current.requiredFields.map(id => instance.schema.fields.find(f => f.id === id)?.label).join(', ')}</p>}
      <div className="flex flex-wrap gap-2">{!!instance.editableFieldIds.length && <button type="button" className={buttonClass} onClick={() => void save()}>Сохранить поля</button>}{instance.allowedTransitions.map(id => <button key={id} type="button" className="rounded-lg border border-blue-700 px-4 py-2 font-semibold text-blue-700" onClick={() => void save(id)}>Перейти: {stages.find(s => s.id === id)!.label}</button>)}</div>
    </fieldset>
    <details><summary className="cursor-pointer text-sm font-semibold">История процесса</summary><ol className="mt-2 space-y-3">{instance.events.map(e => <li key={e.id} className="border-b pb-2 text-sm"><p>{e.kind === 'ATTACHED' ? 'Процесс подключён' : e.kind === 'TRANSITION' ? `${stages.find(s => s.id === e.from_stage_id)?.label} → ${stages.find(s => s.id === e.to_stage_id)?.label}` : 'Поля сохранены'} · {e.actor_name ?? 'Сотрудник удалён'} · {new Date(e.created_at).toLocaleString('ru-RU')}</p>{Object.entries(e.changes).map(([id, change]) => <p className="break-words text-slate-600" key={id}>{instance.schema.fields.find(f => f.id === id)?.label}: {display(change.before)} → {display(change.after)}</p>)}</li>)}</ol></details>
  </article>
}

export function BusinessProcessPanel({ taskId, canManage, taskStatus }: { taskId: number; canManage: boolean; taskStatus: string }) {
  const { user } = useAuth()
  const [instances, setInstances] = useState<BusinessInstance[]>([]), [definitions, setDefinitions] = useState<BusinessDefinition[]>([])
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState(''), [refresh, setRefresh] = useState(0)
  const load = useCallback(async () => {
    const [data, catalog] = await Promise.all([getTaskBusinessProcesses(taskId), canManage ? getBusinessDefinitions() : Promise.resolve([])])
    setInstances(data); setDefinitions(catalog); setLoading(false)
  }, [taskId, canManage])
  useEffect(() => { setLoading(true); void load().catch(e => { setError(toUserMessage(e)); setLoading(false) }) }, [load])
  async function attach(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await attachBusinessProcess(taskId, Number(selected)); setSelected(''); await load() } catch (e) { setError(toUserMessage(e)) } finally { setBusy(false) }
  }
  const available = definitions.filter(d => !d.archived && !instances.some(i => i.process_id === d.process_id))
  return <section className={panelClass} aria-label="Бизнес-процессы задачи"><h2 className="text-xl font-bold">Бизнес-процессы задачи</h2>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="flex flex-wrap gap-3"><button type="button" className="text-sm text-blue-700 underline" disabled={busy || loading} onClick={() => { if (instances.length && !window.confirm('Обновить процессы? Несохранённые поля будут заменены данными сервера.')) return; void load().then(() => { setRefresh(v => v + 1); setError('') }).catch(e => setError(toUserMessage(e))) }}>Обновить процессы</button>{['ADMIN', 'DIRECTOR'].includes(user!.role) && <Link className="text-sm text-blue-700 underline" to="/admin/business-processes">Конструктор процессов</Link>}</div>
    {loading ? <p role="status">Загрузка процессов…</p> : <>{instances.map(i => <InstanceCard key={`${i.id}:${i.revision}:${refresh}`} taskId={taskId} instance={i} onChanged={load}/>)}{!instances.length && <p className="text-slate-600">К этой задаче ещё не подключён бизнес-процесс.</p>}
      {canManage && !['VERIFIED', 'CANCELLED'].includes(taskStatus) && (available.length ? <form onSubmit={attach} className="space-y-3"><fieldset disabled={busy} className="space-y-3"><Label name="Процесс для задачи"><select className={inputClass} required value={selected} onChange={e => setSelected(e.target.value)}><option value="">Выберите шаблон</option>{available.map(d => <option key={d.id} value={d.id}>{d.schema.title} · версия {d.version}</option>)}</select></Label><button type="submit" className={buttonClass}>Подключить процесс</button></fieldset></form> : <p className="text-sm text-slate-500">Других действующих шаблонов пока нет. Администратор может создать их в конструкторе.</p>)}
    </>}
  </section>
}
