import { FormEvent, startTransition, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { changeOwnPassword } from '@/api/authApi'
import { ApiError, toUserMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole, returnPathAfterLogout } from '@/lib/roleRoutes'
import { getToken } from '@/lib/auth'

export function ChangePasswordPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const sessionToken = useRef(getToken())
  const [error, setError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const from = returnPathAfterLogout((location.state as { from?: string } | null)?.from)
  if (!user) return null
  const forced = Boolean(user.mustChangePassword)

  function goToLogin(passwordChanged = false) {
    // BrowserRouter schedules navigation in a transition. Keep clearing the
    // profile in that same transition so ProtectedRoute cannot overwrite the
    // success notice and original QR with a competing /change-password return.
    startTransition(() => {
      logout()
      navigate('/login', { replace: true, state: { from, passwordChanged } })
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    setError(null)
    if (sessionToken.current !== getToken()) { setError('Аккаунт изменился. Обновите страницу.'); return }
    if (password !== confirmation) { setError('Пароли не совпадают.'); return }
    if (password.length < 8 || !/\S/.test(password)) { setError('Введите минимум 8 символов, не только пробелы.'); return }
    if (new TextEncoder().encode(password).length > 72) { setError('Пароль слишком длинный: максимум 72 латинских или 36 кириллических символов.'); return }
    busy.current = true
    setSaving(true)
    try {
      await changeOwnPassword(password, forced ? undefined : currentPassword)
      if (sessionToken.current !== getToken()) return
      setPassword(''); setConfirmation(''); setCurrentPassword('')
      goToLogin(true)
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось изменить пароль.'))
      setUncertain(!(err instanceof ApiError) || !err.status || err.status >= 500 || err.status === 401)
    } finally { busy.current = false; setSaving(false) }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
    <form aria-label="Смена пароля" onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <h1 className="text-xl font-bold">{forced ? 'Установите свой пароль' : 'Сменить пароль'}</h1>
      <p className="break-words text-sm text-slate-600">{user.fullName} · {user.username}</p>
      <p className="text-sm text-slate-600">{forced ? 'Вы вошли с временным паролем. Придумайте свой пароль, чтобы продолжить работу.' : 'После изменения потребуется снова войти. Остальные входы в ваш аккаунт будут завершены.'}</p>
      <input type="hidden" autoComplete="username" value={user.username} readOnly />
      {!forced && <label className="block text-sm">Текущий пароль
        <input type={show ? 'text' : 'password'} autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>}
      <label className="block text-sm">Новый пароль
        <input type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="block text-sm">Повторите новый пароль
        <input type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={72} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <p className="text-xs text-slate-500">Минимум 8 символов. Максимум 72 латинских или 36 кириллических символов.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Показать пароли</label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {uncertain && <p className="text-sm text-amber-800">Ответ сервера не подтверждён. Если пароль уже изменился, войдите с новым паролем. Если вход не удаётся, обратитесь к администратору.</p>}
      <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? 'Сохранение…' : 'Сохранить пароль'}</button>
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        {!forced && <Link to={from ?? homePathForRole(user.role)} className="text-blue-700 underline">Отмена</Link>}
        <button type="button" disabled={saving} onClick={() => goToLogin()} className="text-slate-600 underline">Перейти ко входу</button>
      </div>
    </form>
  </main>
}
