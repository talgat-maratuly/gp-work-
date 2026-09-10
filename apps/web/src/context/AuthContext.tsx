import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  const revision = useRef(0)
  const currentRequest = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    currentRequest.current?.abort()
    const controller = new AbortController()
    currentRequest.current = controller
    const requestRevision = ++revision.current
    const token = getToken()
    if (!token) {
      clearAuth()
      setUser(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const me = await fetchMe(controller.signal)
      if (revision.current === requestRevision && getToken() === token) setUser(me)
    } catch {
      if (revision.current === requestRevision && getToken() === token) {
        apiLogout()
        setUser(null)
      }
    } finally {
      if (revision.current === requestRevision) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const changed = (event: StorageEvent) => {
      if (event.key === 'gp-work_token' || event.key === null) {
        setUser(null)
        void refresh()
      }
    }
    window.addEventListener('storage', changed)
    return () => { ++revision.current; currentRequest.current?.abort(); window.removeEventListener('storage', changed) }
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      logout: () => {
        ++revision.current
        currentRequest.current?.abort()
        apiLogout()
        setUser(null)
        setLoading(false)
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
