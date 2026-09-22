import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS } from '@/lib/auth'
import { returnPathAfterLogout } from '@/lib/roleRoutes'

export function AccountControls() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  return <div aria-label="Текущий аккаунт" className="min-w-0 text-right text-xs">
    <p className="max-w-40 truncate font-semibold text-slate-900" title={user?.fullName}>{user?.fullName}</p>
    <p className="text-emerald-800">{user ? ROLE_LABELS[user.role] : ''}</p>
    {user?.positionName && <p className="max-w-40 truncate text-slate-600" title={user.positionName}>{user.positionName}</p>}
    <Link to="/change-password" state={{ from: location.pathname + location.search + location.hash }} className="mt-1 block text-blue-700 underline">Сменить пароль</Link>
    <button type="button" onClick={() => {
      const from = returnPathAfterLogout(location.pathname + location.search + location.hash)
      logout()
      navigate('/login', { replace: true, state: from ? { from } : null })
    }}
      className="mt-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700">Выйти</button>
  </div>
}
