import { apiRequest } from './client'
import type { AuthUser } from '@/lib/auth'
import { clearAuth, getToken, setAuth, setStoredUser } from '@/lib/auth'

let pendingLogout: Promise<void> = Promise.resolve()
let loggingOut = false

export function changeOwnPassword(newPassword: string, currentPassword?: string) {
  return apiRequest<{ ok: boolean }>('/auth/password', {
    method: 'PATCH', body: JSON.stringify({ newPassword, currentPassword }), signal: AbortSignal.timeout(30_000),
  })
}

export async function login(username: string, password: string) {
  await pendingLogout
  const data = await apiRequest<{ accessToken: string; user: AuthUser; role: AuthUser['role'] }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
  )
  setAuth(data.accessToken, data.user)
  return data.user
}

export async function fetchMe(signal?: AbortSignal): Promise<AuthUser> {
  const token = getToken()
  const me = await apiRequest<AuthUser>('/auth/me', { signal })
  if (token && token === getToken()) {
    setStoredUser(me)
  }
  return me
}

export function logout() {
  sessionStorage.setItem('gp-work_signed_out', '1')
  if (!loggingOut) {
    loggingOut = true
    pendingLogout = apiRequest('/auth/logout', { method: 'POST', signal: AbortSignal.timeout(5000) })
      .then(() => undefined, () => undefined).finally(() => { loggingOut = false })
  }
  clearAuth()
}
