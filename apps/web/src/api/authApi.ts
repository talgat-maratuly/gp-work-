import { apiRequest } from './client'
import type { AuthUser } from '@/lib/auth'
import { clearAuth, getToken, setAuth, setStoredUser } from '@/lib/auth'

export async function login(username: string, password: string) {
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

export async function fetchMe(): Promise<AuthUser> {
  const me = await apiRequest<AuthUser>('/auth/me')
  const token = getToken()
  if (token) {
    setStoredUser(me)
  }
  return me
}

export function logout() {
  clearAuth()
}
