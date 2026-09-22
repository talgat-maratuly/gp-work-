import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function AuthRecovery() {
  const { error, refresh, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  return <main className="mx-auto max-w-md space-y-4 p-6">
    <h1 className="text-xl font-bold">Не удалось проверить вход</h1>
    <p role="alert">{error}</p>
    <p className="text-sm text-slate-600">Ссылка сохранена. Повторите проверку, чтобы продолжить с этой страницы.</p>
    <button type="button" onClick={() => void refresh()}
      className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Повторить проверку входа</button>
    <button type="button" className="block rounded-xl border px-4 py-3" onClick={() => {
      const from = location.pathname === '/login'
        ? (location.state as { from?: string } | null)?.from
        : location.pathname + location.search + location.hash
      logout()
      navigate('/login', { replace: true, state: from ? { from } : null })
    }}>Войти другим аккаунтом</button>
  </main>
}
