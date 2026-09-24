import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from '@/lib/roleRoutes'
import type { UserRole } from '@/lib/auth'
import { AuthRecovery } from './AuthRecovery'
import { canOpenPage, userHome } from '@/lib/accessPolicy'

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

  if (user.mustChangePassword && location.pathname.replace(/\/$/, '') !== '/change-password') {
    return <Navigate to="/change-password" replace state={{ from: location.pathname + location.search + location.hash }} />
  }

  if (roles?.length && !hasRole(...roles)) {
    return <Navigate to={userHome(user,homePathForRole(user.role))} replace />
  }
  if (!canOpenPage(user,location.pathname)) return <Navigate to="/access-home" replace />

  return <>{children}</>
}
