import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchMe, logout as apiLogout } from '@/api/authApi'
import type { AuthUser, UserRole } from '@/lib/auth'
import { clearAuth, getToken } from '@/lib/auth'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  logout: () => void
  hasRole: (...roles: UserRole[]) => boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = getToken()
    if (!token) {
      clearAuth()
      setUser(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const me = await fetchMe()
      setUser(me)
    } catch {
      apiLogout()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      logout: () => {
        apiLogout()
        setUser(null)
      },
      // Директор — полный доступ наравне с администратором: где разрешён ADMIN,
      // там разрешён и DIRECTOR (иначе кнопки создания/действий были бы скрыты).
      hasRole: (...roles) =>
        !!user &&
        (roles.includes(user.role) ||
          (user.role === 'DIRECTOR' && roles.includes('ADMIN'))),
      refresh,
    }),
    [user, loading, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
