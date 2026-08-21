import { FormEvent, useEffect, useState } from 'react'
import {
  changeUserPassword,
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type ApiUser,
} from '@/api/usersApi'
import { fetchBrigades } from '@/api/brigadesApi'
import { toUserMessage } from '@/api/client'
import { ROLE_LABELS, type UserRole } from '@/lib/auth'

type UserForm = {
  fullName: string
  username: string
  password: string
  role: UserRole
  brigadeId: string
  isActive: boolean
}

const emptyForm = (): UserForm => ({
  fullName: '',
  username: '',
  password: '',
  role: 'WORKER',
  brigadeId: '',
  isActive: true,
})

export function UsersPage() {
  const [users, setUsers] = useState<ApiUser[]>([])
  const [brigades, setBrigades] = useState<{ id: number; name: string }[]>([])
  const [createForm, setCreateForm] = useState<UserForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<UserForm>(emptyForm)
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function reload() {
    const [u, b] = await Promise.all([fetchUsers(), fetchBrigades()])
    setUsers(u)
    setBrigades(b.map((x) => ({ id: x.id, name: x.name })))
  }

  useEffect(() => {
    void reload().catch((err) => setError(toUserMessage(err)))
  }, [])

  function startEdit(user: ApiUser) {
    setEditingId(user.id)
    setEditForm({
      fullName: user.fullName,
      username: user.username,
      password: '',
      role: user.role,
      brigadeId: user.brigadeId != null ? String(user.brigadeId) : '',
      isActive: user.isActive,
    })
    setShowEditPassword(false)
    setError(null)
    setSuccess(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(emptyForm())
    setShowEditPassword(false)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await createUser({
        fullName: createForm.fullName.trim(),
        username: createForm.username.trim(),
        password: createForm.password,
        role: createForm.role,
        brigadeId: createForm.brigadeId ? Number(createForm.brigadeId) : undefined,
        isActive: createForm.isActive,
      })
      setCreateForm(emptyForm())
      setShowCreatePassword(false)
      setSuccess('Пользователь успешно создан.')
      await reload()
    } catch (err) {
      console.error('[users/create]', err)
      setError(toUserMessage(err))
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    if (editingId == null) return
    setError(null)
    setSuccess(null)
    try {
      await updateUser(editingId, {
        fullName: editForm.fullName.trim(),
        username: editForm.username.trim(),
        role: editForm.role,
        brigadeId: editForm.brigadeId ? Number(editForm.brigadeId) : null,
        isActive: editForm.isActive,
      })
      if (editForm.password.trim()) {
        await changeUserPassword(editingId, editForm.password.trim())
      }
      cancelEdit()
      setSuccess('Пользователь успешно обновлен.')
      await reload()
    } catch (err) {
      console.error('[users/update]', err)
      setError(toUserMessage(err))
    }
  }

  async function toggleBlock(user: ApiUser) {
    setError(null)
    setSuccess(null)
    try {
      await updateUser(user.id, { isActive: !user.isActive })
      setSuccess('Пользователь успешно обновлен.')
      await reload()
    } catch (err) {
      console.error('[users/block]', err)
      setError(toUserMessage(err))
    }
  }

  async function handleDelete(user: ApiUser) {
    if (!window.confirm(`Удалить пользователя «${user.fullName}»?`)) return
    setError(null)
    setSuccess(null)
    try {
      await deleteUser(user.id)
      if (editingId === user.id) cancelEdit()
      setSuccess('Пользователь удален.')
      await reload()
    } catch (err) {
      console.error('[users/delete]', err)
      setError(toUserMessage(err))
    }
  }

  function renderRoleSelect(
    value: UserRole,
    onChange: (role: UserRole) => void,
    className?: string,
  ) {
    return (
      <select
        className={className ?? 'rounded-lg border px-3 py-2'}
        value={value}
        onChange={(e) => onChange(e.target.value as UserRole)}
      >
        {Object.entries(ROLE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    )
  }

  function renderBrigadeSelect(
    value: string,
    onChange: (brigadeId: string) => void,
    className?: string,
  ) {
    return (
      <select
        className={className ?? 'rounded-lg border px-3 py-2'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— бригада —</option>
        {brigades.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <p className="mt-1 text-sm text-slate-500">
          Регистрация закрыта. Создавайте сотрудников вручную и выдавайте им логин и пароль.
        </p>
      </div>

      <form onSubmit={handleCreate} autoComplete="off" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <input
          className="rounded-lg border px-3 py-2"
          placeholder="ФИО *"
          value={createForm.fullName}
          onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
          required
        />
        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Логин *"
          value={createForm.username}
          onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
          required
          autoComplete="off"
          name="new-user-username"
        />
        <div className="flex rounded-lg border bg-white">
          <input
            className="min-w-0 flex-1 rounded-l-lg px-3 py-2 outline-none"
            type={showCreatePassword ? 'text' : 'password'}
            placeholder="Пароль *"
            value={createForm.password}
            onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
            required
            minLength={4}
            autoComplete="new-password"
            name="new-user-password"
          />
          <button
            type="button"
            onClick={() => setShowCreatePassword((v) => !v)}
            className="shrink-0 rounded-r-lg border-l px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {showCreatePassword ? '🙈 Скрыть' : '👁 Показать'}
          </button>
        </div>
        {renderRoleSelect(createForm.role, (role) => setCreateForm((f) => ({ ...f, role })))}
        {renderBrigadeSelect(createForm.brigadeId, (brigadeId) =>
          setCreateForm((f) => ({ ...f, brigadeId })),
        )}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={createForm.isActive}
            onChange={(e) => setCreateForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Активен
        </label>
        <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-white sm:col-span-2">
          Создать пользователя
        </button>
      </form>

      {editingId != null && (
        <form onSubmit={handleUpdate} autoComplete="off" className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-2">
          <p className="text-sm font-medium text-emerald-900 sm:col-span-2">Редактирование пользователя</p>
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="ФИО *"
            value={editForm.fullName}
            onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Логин *"
            value={editForm.username}
            onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
            required
            autoComplete="off"
            name="edit-user-username"
          />
          <div className="flex rounded-lg border bg-white">
            <input
              className="min-w-0 flex-1 rounded-l-lg px-3 py-2 outline-none"
              type={showEditPassword ? 'text' : 'password'}
              placeholder="Новый пароль (оставьте пустым, чтобы не менять)"
              value={editForm.password}
              onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
              name="edit-user-new-password"
            />
            <button
              type="button"
              onClick={() => setShowEditPassword((v) => !v)}
              className="shrink-0 rounded-r-lg border-l px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              {showEditPassword ? '🙈 Скрыть' : '👁 Показать'}
            </button>
          </div>
          {renderRoleSelect(editForm.role, (role) => setEditForm((f) => ({ ...f, role })))}
          {renderBrigadeSelect(editForm.brigadeId, (brigadeId) =>
            setEditForm((f) => ({ ...f, brigadeId })),
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={editForm.isActive}
              onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Активен
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-white">
              Сохранить
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-red-600">{error}</p>}
      {success && <p className="text-emerald-700">{success}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">ФИО</th>
              <th className="px-3 py-2 text-left">Логин</th>
              <th className="px-3 py-2 text-left">Роль</th>
              <th className="px-3 py-2 text-left">Бригада</th>
              <th className="px-3 py-2 text-left">Статус</th>
              <th className="px-3 py-2 text-left">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className={editingId === u.id ? 'bg-emerald-50/50' : undefined}>
                <td className="px-3 py-2">{u.fullName}</td>
                <td className="px-3 py-2 font-mono text-xs">{u.username}</td>
                <td className="px-3 py-2">{ROLE_LABELS[u.role]}</td>
                <td className="px-3 py-2">{brigades.find((b) => b.id === u.brigadeId)?.name ?? '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {u.isActive ? 'Активен' : 'Заблокирован'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs text-emerald-700 underline"
                      onClick={() => startEdit(u)}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="text-xs text-amber-700 underline"
                      onClick={() => void toggleBlock(u)}
                    >
                      {u.isActive ? 'Заблокировать' : 'Разблокировать'}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 underline"
                      onClick={() => void handleDelete(u)}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

