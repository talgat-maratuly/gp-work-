import { FormEvent, useEffect, useState } from 'react'
import { createBrigade, fetchBrigades, updateBrigade, type ApiBrigade } from '@/api/brigadesApi'
import { fetchUsers, type ApiUser } from '@/api/usersApi'
import { toUserMessage } from '@/api/client'

export function BrigadesPage() {
  const [brigades, setBrigades] = useState<ApiBrigade[]>([])
  const [users, setUsers] = useState<ApiUser[]>([])
  const [name, setName] = useState('')
  const [brigadierId, setBrigadierId] = useState('')
  const [description, setDescription] = useState('')
  const [workerIds, setWorkerIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function reload() {
    const [b, u] = await Promise.all([fetchBrigades(), fetchUsers()])
    setBrigades(b)
    setUsers(u)
  }

  useEffect(() => {
    void reload().catch((err) => setError(toUserMessage(err))).finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await createBrigade({
        name: name.trim(),
        brigadierId: brigadierId ? Number(brigadierId) : undefined,
        description: description.trim() || undefined,
        workerIds,
      })
      setName('')
      setBrigadierId('')
      setDescription('')
      setWorkerIds([])
      setSuccess('Бригада создана и сотрудники привязаны.')
      await reload()
    } catch (err) {
      console.error('[brigades]', err)
      setError(toUserMessage(err))
    }
  }

  async function toggleActive(brigade: ApiBrigade) {
    setBusyId(brigade.id)
    setError(null)
    setSuccess(null)
    try {
      await updateBrigade(brigade.id, { isActive: !brigade.isActive })
      setSuccess(brigade.isActive ? 'Бригада деактивирована, история сохранена.' : 'Бригада активирована.')
      await reload()
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const fieldUsers = users.filter((user) =>
    user.isActive && ['WORKER', 'WATER_CARRIER', 'BRIGADIER', 'AGRONOMIST'].includes(user.role),
  )
  const brigadiers = users.filter((user) => user.isActive && user.role === 'BRIGADIER')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Бригады</h1>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <input className="rounded-lg border px-3 py-2" placeholder="Название бригады *" value={name} onChange={(e) => setName(e.target.value)} required />
        <select className="rounded-lg border px-3 py-2" value={brigadierId} onChange={(e) => setBrigadierId(e.target.value)}>
          <option value="">— бригадир —</option>
          {brigadiers.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
        <textarea className="rounded-lg border px-3 py-2 sm:col-span-2" placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
        <fieldset className="space-y-2 rounded-lg border p-3 sm:col-span-2">
          <legend className="px-1 text-sm font-medium">Сотрудники</legend>
          {fieldUsers.length === 0 ? (
            <p className="text-sm text-slate-500">Нет активных сотрудников полевых ролей.</p>
          ) : fieldUsers.map((user) => (
            <label key={user.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={workerIds.includes(user.id)}
                onChange={(event) => setWorkerIds((current) => event.target.checked
                  ? [...current, user.id]
                  : current.filter((id) => id !== user.id))}
              />
              {user.fullName}
            </label>
          ))}
        </fieldset>
        <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-white sm:col-span-2">Создать бригаду</button>
      </form>

      {error && <p className="text-red-600">{error}</p>}
      {success && <p className="text-emerald-700">{success}</p>}

      <div className="space-y-3">
        {loading && <div className="rounded-xl border bg-white p-6 text-slate-500">Загрузка бригад…</div>}
        {!loading && brigades.length === 0 && <div className="rounded-xl border bg-white p-6 text-slate-500">Бригад пока нет.</div>}
        {brigades.map((b) => (
          <div key={b.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{b.name}</h2>
                <p className={`text-xs font-semibold ${b.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {b.isActive ? 'Активна' : 'Неактивна'}
                </p>
                <p className="text-sm text-slate-500">{b.description || 'Без описания'}</p>
                <p className="mt-2 text-sm">Бригадир: {users.find((u) => u.id === b.brigadierId)?.fullName ?? '—'}</p>
                <p className="text-sm">Рабочие: {b.workers.map((w) => w.fullName).join(', ') || '—'}</p>
              </div>
              <button
                type="button"
                disabled={busyId === b.id}
                className="text-sm text-amber-700 disabled:opacity-50"
                onClick={() => void toggleActive(b)}
              >
                {b.isActive ? 'Деактивировать' : 'Активировать'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
