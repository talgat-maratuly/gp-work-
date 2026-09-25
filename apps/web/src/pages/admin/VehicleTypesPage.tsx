import { FormEvent, useEffect, useState } from 'react'
import {
  archiveVehicleType,
  createVehicleType,
  fetchAllVehicleTypes,
  updateVehicleType,
  type VehicleTypeRef,
} from '@/api/vehicleTypesApi'
import { toUserMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { canPerform } from '@/lib/accessPolicy'

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-800 px-5 py-3 text-white shadow-lg">
      {message}
    </div>
  )
}

export function VehicleTypesPage() {
  const { user } = useAuth()
  const [types, setTypes] = useState<VehicleTypeRef[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)

  const canCreate = canPerform(user, 'vehicle-types.create')
  const canUpdate = canPerform(user, 'vehicle-types.update')
  const canArchive = canPerform(user, 'vehicle-types.remove')

  async function reload() {
    setLoading(true)
    try {
      setTypes(await fetchAllVehicleTypes())
    } catch (err) {
      console.error('fetchAllVehicleTypes failed:', err)
      setError('Не удалось загрузить виды техники. Проверьте подключение к серверу.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void reload() }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await createVehicleType(name.trim())
      setName('')
      setToast('Вид техники добавлен')
      await reload()
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось сохранить вид техники'))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(t: VehicleTypeRef) {
    setEditingId(t.id)
    setEditName(t.name)
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (editingId == null) return
    setBusy(true)
    try {
      await updateVehicleType(editingId, { name: editName.trim() })
      setEditingId(null)
      setEditName('')
      setToast('Вид техники обновлён')
      await reload()
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(t: VehicleTypeRef) {
    setError(null)
    setBusy(true)
    try {
      await updateVehicleType(t.id, { isActive: !t.isActive })
      setToast(t.isActive ? 'Вид техники перемещён в архив' : 'Вид техники активирован')
      await reload()
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function move(t: VehicleTypeRef, direction: -1 | 1) {
    const sorted = [...types].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = sorted.findIndex((x) => x.id === t.id)
    const neighbor = sorted[index + direction]
    if (!neighbor) return
    setBusy(true)
    setError(null)
    try {
      await Promise.all([
        updateVehicleType(t.id, { sortOrder: neighbor.sortOrder }),
        updateVehicleType(neighbor.id, { sortOrder: t.sortOrder }),
      ])
      await reload()
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const sorted = [...types].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Виды техники</h1>
        <p className="mt-1 text-sm text-slate-600">
          Справочник видов техники на сервере. Активные виды сразу появляются в форме «Добавить технику».
          Отключённый вид скрывается из выбора, но сохраняется у ранее созданной техники.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Добавить вид техники</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Название</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-blue-600 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Экскаватор"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving || !canCreate}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </form>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Справочник видов техники</h2>
        {loading ? (
          <p className="text-slate-500">Загрузка…</p>
        ) : sorted.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
            Видов техники пока нет. Добавьте первый вид выше.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Порядок</th>
                  <th className="px-4 py-3">Название вида техники</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((t, index) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button type="button" disabled={busy || !canUpdate || index === 0} onClick={() => void move(t, -1)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-40" title="Выше">↑</button>
                        <button type="button" disabled={busy || !canUpdate || index === sorted.length - 1} onClick={() => void move(t, 1)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-40" title="Ниже">↓</button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {editingId === t.id ? (
                        <form id={`vt-form-${t.id}`} onSubmit={handleSaveEdit}>
                          <input
                            type="text"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                          />
                        </form>
                      ) : (
                        <span className={t.isActive ? '' : 'text-slate-400 line-through'}>{t.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {t.isSystem ? 'Системный' : 'Добавленный'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${t.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {t.isActive ? 'Активен' : 'В архиве'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {editingId === t.id ? (
                          <>
                            <button type="submit" form={`vt-form-${t.id}`} disabled={busy} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Сохранить</button>
                            <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">Отмена</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEdit(t)} disabled={!canUpdate} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">Изменить</button>
                            <button type="button" onClick={() => void handleToggle(t)} disabled={busy || (t.isActive ? !canArchive : !canUpdate)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">{t.isActive ? 'В архив' : 'Активировать'}</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
