import { useState, type FormEvent } from 'react'
import { createJobPosition, updateJobPosition, type JobPosition } from '@/api/jobPositionsApi'
import { toUserMessage } from '@/api/client'

export function JobPositionsEditor({ positions, onSaved, disabled }: {
  positions: JobPosition[]
  onSaved: (position: JobPosition) => void
  disabled: boolean
}) {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function save(action: () => Promise<JobPosition>, done: () => void, message: string) {
    if (pending || disabled) return
    setPending(true)
    setError(null)
    setSuccess(null)
    try {
      const position = await action()
      onSaved(position)
      done()
      setSuccess(message)
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setPending(false)
    }
  }

  function add(event: FormEvent) {
    event.preventDefault()
    void save(() => createJobPosition(name), () => setName(''), 'Должность добавлена. Теперь её можно назначить сотруднику.')
  }

  return <section aria-labelledby="job-positions-title" className="space-y-3 rounded-xl border bg-white p-4">
    <h2 id="job-positions-title" className="text-lg font-semibold">Должности</h2>
    <p className="text-sm text-slate-600">Добавляйте свои названия: снабженец, механик, личный ассистент. Доступ к разделам задаётся отдельно в поле «Роль доступа».</p>
    <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        Название новой должности
        <input className="min-w-0 rounded-lg border px-3 py-2" value={name} onChange={e => setName(e.target.value)} required maxLength={120} placeholder="Например, снабженец" disabled={pending || disabled} />
      </label>
      <button className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50 sm:self-end" disabled={pending || disabled || !name.trim()} type="submit">Добавить должность</button>
    </form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="text-sm text-emerald-700">{success}</p>}
    {positions.length === 0 && !disabled && <p className="text-sm text-slate-500">Должности пока не добавлены. Сотрудникам можно назначить их позже.</p>}
    {positions.length > 0 && <details>
      <summary className="cursor-pointer py-2 font-medium text-blue-800">Все должности и архив ({positions.length})</summary>
      <p className="mb-3 text-sm text-slate-500">Переименование обновляет название у сотрудников. Архивная должность остаётся у назначенных сотрудников, но недоступна для новых назначений.</p>
      <ul className="divide-y">
        {positions.map(position => <li key={position.id} className="py-3" aria-label={`Должность ${position.name}`}>
          {editingId === position.id ? <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
            event.preventDefault()
            void save(() => updateJobPosition(position.id, { name: editingName }), () => setEditingId(null), 'Название должности обновлено.')
          }}>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">Новое название должности
              <input autoFocus className="min-w-0 rounded-lg border px-3 py-2" value={editingName} onChange={e => setEditingName(e.target.value)} required maxLength={120} disabled={pending} />
            </label>
            <button type="submit" disabled={pending || disabled || !editingName.trim()} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">Сохранить название</button>
            <button type="button" disabled={pending} className="rounded-lg border px-3 py-2 text-sm" onClick={() => setEditingId(null)}>Отмена</button>
          </form> : <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-medium">{position.name}{!position.isActive && <span className="ml-2 text-slate-500">В архиве</span>}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <button type="button" className="text-blue-700 underline" disabled={pending || disabled} onClick={() => { setEditingId(position.id); setEditingName(position.name); setError(null); setSuccess(null) }}>Переименовать</button>
              <button type="button" className="text-slate-700 underline" disabled={pending || disabled} onClick={() => void save(
                () => updateJobPosition(position.id, { isActive: !position.isActive }),
                () => {},
                position.isActive ? 'Должность перенесена в архив. Назначения сотрудников сохранены.' : 'Должность восстановлена.',
              )}>{position.isActive ? 'В архив' : 'Восстановить'}</button>
            </div>
          </div>}
        </li>)}
      </ul>
    </details>}
  </section>
}
