import { FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { login } from '@/api/authApi'
import { toUserMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { resolvePostLoginPath } from '@/lib/roleRoutes'

export function LoginPage() {
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Загрузка…
      </div>
    )
  }

  if (user) {
    const target = resolvePostLoginPath(user.role, from)
    return <Navigate to={target} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedIn = await login(username.trim(), password)
      await refresh()
      navigate(resolvePostLoginPath(loggedIn.role, from), { replace: true })
    } catch (err) {
      console.error('[login]', err)
      setError(toUserMessage(err, 'Не удалось войти'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 h-1.5 w-16 rounded-full bg-gradient-to-r from-emerald-600 to-blue-700" />
        <h1 className="text-xl font-bold text-blue-800">Вход в систему</h1>
        <p className="mt-1 text-sm text-slate-500">
          <span className="font-semibold text-emerald-700">G</span>
          <span className="font-semibold text-blue-700">P</span> Work — управление работами
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Логин</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Пароль</label>
            <div className="flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {showPassword ? 'Скрыть' : '👁 Показать'}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {submitting ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}

