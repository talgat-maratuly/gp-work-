import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS } from '@/lib/auth'

export function AccountControls() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return <div aria-label="Текущий аккаунт" className="min-w-0 text-right text-xs">
    <p className="max-w-40 truncate font-semibold text-slate-900" title={user?.fullName}>{user?.fullName}</p>
    <p className="text-emerald-800">{user ? ROLE_LABELS[user.role] : ''}</p>
    <button type="button" onClick={() => { logout(); navigate('/login', { replace: true }) }}
      className="mt-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700">Выйти</button>
  </div>
}
