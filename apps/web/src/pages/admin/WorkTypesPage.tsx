import { FormEvent, useEffect, useState } from 'react'
import {
  createWorkType,
  deleteWorkType,
  fetchAllWorkTypes,
  toggleWorkTypeActive,
  updateWorkType,
} from '@/lib/workTypesApi'
import type { WorkType } from '@/lib/types'

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

export function WorkTypesPage() {
  const [types, setTypes] = useState<WorkType[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  async function reload() {
    setLoading(true)
    const list = await fetchAllWorkTypes()
    setTypes(list)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const { data, error: err } = await createWorkType(name)
    setSaving(false)
    if (err) {
      console.error('createWorkType failed:', err)
      setError(
        err.includes('уже есть') || err.includes('Укажите')
          ? err
          : 'Не удалось сохранить вид работы. Проверьте подключение к базе данных.'
      )
      return
    }
    if (data) {
      setName('')
      setToast('Вид работы успешно добавлен')
      setTypes((prev) => {
        const merged = [...prev.filter((t) => t.id !== data.id), data]
        return merged.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      })
      void reload()
    }
  }

  function startEdit(t: WorkType) {
    setEditingId(t.id)
    setEditName(t.name)
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (editingId == null) return
    setEditSaving(true)
    const { error: err } = await updateWorkType(editingId, editName)
    setEditSaving(false)
    if (err) {
      console.error('updateWorkType failed:', err)
      setError(err)
      return
    }
    setEditingId(null)
    setEditName('')
    setToast('Вид работы успешно обновлён')
    await reload()
  }

  async function handleToggle(t: WorkType) {
    const { error: err } = await toggleWorkTypeActive(t.id, t.is_active)
    if (err) {
      console.error('toggleWorkTypeActive failed:', err)
      setError('Не удалось сохранить вид работы. Проверьте подключение к базе данных.')
      return
    }
    setToast(t.is_active ? 'Вид работы отключён' : 'Вид работы включён')
    await reload()
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить вид работы? Он исчезнет из формы рабочего.')) return
    const { error: err } = await deleteWorkType(id)
    if (err) {
      console.error('deleteWorkType failed:', err)
      setError('Не удалось сохранить вид работы. Проверьте подключение к базе данных.')
      return
    }
    setEditingId(null)
    setToast('Вид работы удалён')
    await reload()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Виды работ</h1>
        <p className="mt-1 text-sm text-slate-600">
          Единый справочник на сервере. Активные виды сразу появляются в QR-форме рабочего.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Добавить вид работы</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Название</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Полив"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </form>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Справочник видов работ</h2>

        {loading ? (
          <p className="text-slate-500">Загрузка…</p>
        ) : types.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
            Видов работ пока нет. Добавьте первый вид выше — он появится в форме рабочего.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Название вида работы</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3 whitespace-nowrap">Дата создания</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {types.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {editingId === t.id ? (
                        <form id={`wt-form-${t.id}`} onSubmit={handleSaveEdit}>
                          <input
                            type="text"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                          />
                        </form>
                      ) : (
                        <span className={t.is_active ? '' : 'text-slate-400 line-through'}>
                          {t.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          t.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleDateString('ru-RU')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {editingId === t.id ? (
                          <>
                            <button
                              type="submit"
                              form={`wt-form-${t.id}`}
                              disabled={editSaving}
                              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              {editSaving ? '…' : 'Сохранить'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              Отмена
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(t)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Изменить
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggle(t)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {t.is_active ? 'Отключить' : 'Включить'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(t.id)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Удалить
                            </button>
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
