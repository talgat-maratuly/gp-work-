import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PasswordResetDialog } from '@/components/PasswordResetDialog'
import {
  createUser,
  fetchUsers,
  updateUser,
  type ApiUser,
} from '@/api/usersApi'
import { fetchBrigades, type ApiBrigade } from '@/api/brigadesApi'
import { canJoinBrigade, eligibleBrigades } from '@/lib/brigade-membership'
import { toUserMessage } from '@/api/client'
import { ROLE_LABELS, type UserRole } from '@/lib/auth'
import { fetchJobPositions, type JobPosition } from '@/api/jobPositionsApi'
import { JobPositionsEditor } from '@/components/JobPositionsEditor'

type UserForm = {
  fullName: string
  username: string
  password: string
  role: UserRole
  positionId: string
  brigadeId: string
  isActive: boolean
}

const emptyForm = (): UserForm => ({
  fullName: '',
  username: '',
  password: '',
  role: 'WORKER',
  positionId: '',
  brigadeId: '',
  isActive: true,
})

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [resetUser, setResetUser] = useState<ApiUser | null>(null)
  const [users, setUsers] = useState<ApiUser[]>([])
  const [brigades, setBrigades] = useState<ApiBrigade[]>([])
  const [createForm, setCreateForm] = useState<UserForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<UserForm>(emptyForm)
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [positions, setPositions] = useState<JobPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  async function reload() {
    setLoading(true)
    setLoadFailed(false)
    try {
      const [u, b, p] = await Promise.all([fetchUsers(), fetchBrigades(), fetchJobPositions()])
      setUsers(u)
      setBrigades(b)
      setPositions(p)
    } catch (err) {
      setLoadFailed(true)
      throw err
    } finally {
      setLoading(false)
    }
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
      positionId: user.positionId != null ? String(user.positionId) : '',
      brigadeId: user.brigadeId != null ? String(user.brigadeId) : '',
      isActive: user.isActive,
    })
    setError(null)
    setSuccess(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(emptyForm())
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (loading || loadFailed || saving) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await createUser({
        fullName: createForm.fullName.trim(),
        username: createForm.username.trim(),
        password: createForm.password,
        role: createForm.role,
        positionId: createForm.positionId ? Number(createForm.positionId) : null,
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
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    if (editingId == null || loading || loadFailed || saving) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateUser(editingId, {
        fullName: editForm.fullName.trim(),
        username: editForm.username.trim(),
        role: editForm.role,
        positionId: editForm.positionId ? Number(editForm.positionId) : null,
        brigadeId: editForm.brigadeId ? Number(editForm.brigadeId) : null,
        isActive: editForm.isActive,
      })
      cancelEdit()
      setSuccess('Пользователь успешно обновлен.')
      await reload()
    } catch (err) {
      console.error('[users/update]', err)
      setError(toUserMessage(err))
    } finally {
      setSaving(false)
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

  function renderRoleSelect(
    value: UserRole,
    onChange: (role: UserRole) => void,
    scope: 'create' | 'edit',
  ) {
    return (
      <div className="flex min-w-0 flex-col gap-1 text-sm">
      <label htmlFor={`${scope}-user-role`}>Роль доступа</label>
      <select
        id={`${scope}-user-role`}
        className="min-w-0 rounded-lg border px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value as UserRole)}
      >
        {Object.entries(ROLE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      </div>
    )
  }

  function renderBrigadeSelect(
    role: UserRole,
    value: string,
    onChange: (brigadeId: string) => void,
    userId?: number | null,
  ) {
    const options = eligibleBrigades(brigades, role, userId)
    const current = brigades.find(brigade => String(brigade.id) === value)
    const unavailable = current && !options.some(brigade => brigade.id === current.id)
    return (
      <div className="flex min-w-0 flex-col gap-1 text-sm">
      <span>Бригада</span>
      <select aria-label="Бригада"
        className="min-w-0 rounded-lg border px-3 py-2"
        value={value}
        disabled={loading || loadFailed || saving || !canJoinBrigade(role)}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Без бригады —</option>
        {unavailable && <option value={current.id} disabled>{current.name} ({current.isActive ? 'назначен другой бригадир' : 'неактивна'})</option>}
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500">{!canJoinBrigade(role)
        ? 'Для этой роли привязка к бригаде не предусмотрена. При смене роли прежний выбор сбрасывается.'
        : role === 'BRIGADIER'
          ? 'Бригадир отвечает за выбранную бригаду. Доступны активные бригады без другого руководителя, включая свою.'
          : 'Сотрудник входит в выбранную активную бригаду. Название бригады не меняет права доступа.'}</p>
      {canJoinBrigade(role) && options.length === 0 && <p className="text-xs text-amber-800">Подходящих активных бригад нет. Можно сохранить без бригады и назначить её позже.</p>}
      </div>
    )
  }

  function changeRole(form: UserForm, role: UserRole, userId?: number | null): UserForm {
    const keepBrigade = eligibleBrigades(brigades, role, userId).some(brigade => String(brigade.id) === form.brigadeId)
    return { ...form, role, brigadeId: keepBrigade ? form.brigadeId : '' }
  }

  function positionSaved(position: JobPosition) {
    if (!positions.some(row => row.id === position.id)) {
      if (editingId != null) setEditForm(form => ({ ...form, positionId: String(position.id) }))
      else setCreateForm(form => ({ ...form, positionId: String(position.id) }))
    }
    setPositions(rows => [...rows.filter(row => row.id !== position.id), position]
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'ru')))
    setUsers(rows => rows.map(row => row.positionId === position.id ? { ...row, positionName: position.name } : row))
    if (!position.isActive && createForm.positionId === String(position.id)) {
      setCreateForm(form => ({ ...form, positionId: '' }))
    }
    const assignedPositionId = users.find(user => user.id === editingId)?.positionId
    if (!position.isActive && editForm.positionId === String(position.id) && assignedPositionId !== position.id) {
      setEditForm(form => ({ ...form, positionId: assignedPositionId != null ? String(assignedPositionId) : '' }))
    }
  }

  function renderPositionSelect(value: string, onChange: (id: string) => void, scope: 'create' | 'edit', assignedId?: number | null) {
    return <div className="flex min-w-0 flex-col gap-1 text-sm">
      <label htmlFor={`${scope}-user-position`}>Должность</label>
      <select id={`${scope}-user-position`} className="min-w-0 rounded-lg border px-3 py-2" value={value} onChange={e => onChange(e.target.value)} disabled={loading || loadFailed}>
        <option value="">— Не назначена —</option>
        {positions.filter(position => position.isActive || position.id === assignedId).map(position =>
          <option key={position.id} value={position.id}>{position.name}{position.isActive ? '' : ' (в архиве)'}</option>)}
      </select>
    </div>
  }

  return (
    <div className="space-y-6">
      {resetUser && <PasswordResetDialog key={resetUser.id} user={resetUser} onClose={() => setResetUser(null)} onReset={() => setUsers(rows => rows.map(row => row.id === resetUser.id ? { ...row, mustChangePassword: true } : row))} />}
      <div>
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <p className="mt-1 text-sm text-slate-500">
          Регистрация закрыта. Создавайте сотрудников вручную и выдавайте им логин и пароль.
        </p>
        <p className="mt-2 text-sm text-slate-600">Роль доступа определяет права в системе. Должность — название работы сотрудника. Бригада — коллектив, которым бригадир руководит или в котором сотрудник работает.</p>
        <button type="button" disabled={loading || saving} className="mt-2 text-sm text-blue-700 underline disabled:opacity-50" onClick={() => { setError(null); void reload().catch(err => setError(toUserMessage(err))) }}>Обновить список бригад</button>
      </div>

      <JobPositionsEditor positions={positions} onSaved={positionSaved} disabled={loading || loadFailed || saving} />
      {loading && <p role="status" className="text-sm text-slate-600">Загрузка сотрудников и должностей…</p>}
      {loadFailed && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
        Не удалось загрузить сотрудников и должности.
        <button type="button" className="ml-2 underline" onClick={() => { setError(null); void reload().catch(err => setError(toUserMessage(err))) }}>Повторить загрузку</button>
      </div>}

      <form aria-label="Создание сотрудника" onSubmit={handleCreate} autoComplete="off" className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <input
          aria-label="ФИО"
          className="rounded-lg border px-3 py-2"
          placeholder="ФИО *"
          value={createForm.fullName}
          onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
          required
        />
        <input
          aria-label="Логин сотрудника"
          className="rounded-lg border px-3 py-2"
          placeholder="Логин *"
          value={createForm.username}
          onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
          required
          autoComplete="off"
          name="new-user-username"
        />
        <div className="flex min-w-0 rounded-lg border bg-white">
          <input
            aria-label="Пароль сотрудника"
            className="min-w-0 flex-1 rounded-l-lg px-3 py-2 outline-none"
            type={showCreatePassword ? 'text' : 'password'}
            placeholder="Пароль *"
            value={createForm.password}
            onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
            required
            minLength={8}
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
        {renderRoleSelect(createForm.role, (role) => setCreateForm((f) => changeRole(f, role)), 'create')}
        {renderPositionSelect(createForm.positionId, (positionId) => setCreateForm(f => ({ ...f, positionId })), 'create')}
        {renderBrigadeSelect(createForm.role, createForm.brigadeId, (brigadeId) =>
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
        <button type="submit" disabled={loading || loadFailed || saving} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50 sm:col-span-2">
          Создать пользователя
        </button>
      </form>

      {editingId != null && (
        <form aria-label="Редактирование сотрудника" onSubmit={handleUpdate} autoComplete="off" className="grid grid-cols-1 gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:grid-cols-2">
          <p className="text-sm font-medium text-blue-900 sm:col-span-2">Редактирование пользователя</p>
          <input
            aria-label="ФИО"
            className="rounded-lg border px-3 py-2"
            placeholder="ФИО *"
            value={editForm.fullName}
            onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
            required
          />
          <input
            aria-label="Логин сотрудника"
            className="rounded-lg border px-3 py-2"
            placeholder="Логин *"
            value={editForm.username}
            onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
            required
            autoComplete="off"
            name="edit-user-username"
          />
          {renderRoleSelect(editForm.role, (role) => setEditForm((f) => changeRole(f, role, editingId)), 'edit')}
          {renderPositionSelect(editForm.positionId, (positionId) => setEditForm(f => ({ ...f, positionId })), 'edit', users.find(user => user.id === editingId)?.positionId)}
          {renderBrigadeSelect(editForm.role, editForm.brigadeId, (brigadeId) =>
            setEditForm((f) => ({ ...f, brigadeId })), editingId,
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
            <button type="submit" disabled={loading || loadFailed || saving} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
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

      {error && <p role="alert" className="text-red-600">{error}</p>}
      {success && <p role="status" className="text-emerald-700">{success}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">ФИО</th>
              <th className="px-3 py-2 text-left">Логин</th>
              <th className="px-3 py-2 text-left">Должность</th>
              <th className="px-3 py-2 text-left">Роль доступа</th>
              <th className="px-3 py-2 text-left">Бригада</th>
              <th className="px-3 py-2 text-left">Статус</th>
              <th className="px-3 py-2 text-left">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className={editingId === u.id ? 'bg-blue-50/50' : undefined}>
                <td className="px-3 py-2">{u.fullName}</td>
                <td className="px-3 py-2 font-mono text-xs">{u.username}</td>
                <td className="px-3 py-2">{u.positionName ?? '—'}{u.positionId != null && positions.some(position => position.id === u.positionId && !position.isActive) && <span className="ml-1 text-xs text-slate-500">(в архиве)</span>}</td>
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
                  {u.mustChangePassword && <span className="mt-1 block text-xs text-amber-800">Нужно сменить пароль</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs text-blue-700 underline"
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
                    {u.id === currentUser?.id ? <Link to="/change-password" className="text-xs text-blue-700 underline">Сменить свой пароль</Link> : <button type="button" disabled={!u.isActive} title={u.isActive ? undefined : 'Сначала разблокируйте пользователя'} className="text-xs text-blue-700 underline disabled:text-slate-400" onClick={() => setResetUser(u)}>Сбросить пароль</button>}
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
