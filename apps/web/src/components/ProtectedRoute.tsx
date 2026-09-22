import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from '@/lib/roleRoutes'
import type { UserRole } from '@/lib/auth'
import { AuthRecovery } from './AuthRecovery'

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode
  roles?: readonly UserRole[]
}) {
  const { user, loading, error, hasRole } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Загрузка…
      </div>
    )
  }

  if (error) return <AuthRecovery />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />
  }

  if (roles?.length && !hasRole(...roles)) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  return <>{children}</>
}
