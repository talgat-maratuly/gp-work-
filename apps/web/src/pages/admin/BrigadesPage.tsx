import { FormEvent, useEffect, useState } from 'react'
import { createBrigade, deleteBrigade, fetchBrigades, type ApiBrigade } from '@/api/brigadesApi'
import { fetchUsers } from '@/api/usersApi'
import { toUserMessage } from '@/api/client'

export function BrigadesPage() {
  const [brigades, setBrigades] = useState<ApiBrigade[]>([])
  const [users, setUsers] = useState<{ id: number; fullName: string }[]>([])
  const [name, setName] = useState('')
  const [brigadierId, setBrigadierId] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    const [b, u] = await Promise.all([fetchBrigades(), fetchUsers()])
    setBrigades(b)
    setUsers(u.map((x) => ({ id: x.id, fullName: x.fullName })))
  }

  useEffect(() => {
    void reload().catch((err) => setError(toUserMessage(err)))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await createBrigade({
        name: name.trim(),
        brigadierId: brigadierId ? Number(brigadierId) : undefined,
        description: description.trim() || undefined,
      })
      setName('')
      setBrigadierId('')
      setDescription('')
      await reload()
    } catch (err) {
      console.error('[brigades]', err)
      setError(toUserMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Бригады</h1>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <input className="rounded-lg border px-3 py-2" placeholder="Название бригады *" value={name} onChange={(e) => setName(e.target.value)} required />
        <select className="rounded-lg border px-3 py-2" value={brigadierId} onChange={(e) => setBrigadierId(e.target.value)}>
          <option value="">— бригадир —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
        <textarea className="rounded-lg border px-3 py-2 sm:col-span-2" placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-white sm:col-span-2">Создать бригаду</button>
      </form>

      {error && <p className="text-red-600">{error}</p>}

      <div className="space-y-3">
        {brigades.map((b) => (
          <div key={b.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{b.name}</h2>
                <p className="text-sm text-slate-500">{b.description || 'Без описания'}</p>
                <p className="mt-2 text-sm">Бригадир: {users.find((u) => u.id === b.brigadierId)?.fullName ?? '—'}</p>
                <p className="text-sm">Рабочие: {b.workers.map((w) => w.fullName).join(', ') || '—'}</p>
              </div>
              <button type="button" className="text-sm text-red-600" onClick={() => void deleteBrigade(b.id).then(reload)}>Удалить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
