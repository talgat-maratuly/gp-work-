import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from '@/lib/roleRoutes'

export function HomeRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Загрузка…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homePathForRole(user.role)} replace />
}
