import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS } from '@/lib/auth'

export function WorkerLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Мои задачи</p>
        {user && (
          <p className="mt-1 font-semibold text-emerald-800">
            {user.fullName}
            <span className="ml-2 text-sm font-normal text-slate-500">({ROLE_LABELS[user.role]})</span>
          </p>
        )}
      </header>
      <main className="p-4 pb-20">
        <Outlet />
      </main>
      <footer className="fixed bottom-0 left-0 right-0 mx-auto max-w-lg border-t border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Выйти
        </button>
      </footer>
    </div>
  )
}
