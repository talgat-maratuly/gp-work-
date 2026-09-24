import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from '@/lib/roleRoutes'
import { AuthRecovery } from './AuthRecovery'
import { userHome } from '@/lib/accessPolicy'

export function HomeRedirect() {
  const { user, loading, error } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Загрузка…
      </div>
    )
  }

  if (error) return <AuthRecovery />
  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  return <Navigate to={userHome(user,homePathForRole(user.role))} replace />
}
