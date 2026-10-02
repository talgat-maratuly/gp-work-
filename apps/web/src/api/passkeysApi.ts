import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { apiRequest } from './client'
import { getToken } from '@/lib/auth'

export { browserSupportsWebAuthn }
export type Passkey = { id: string; createdAt: string; lastUsedAt: string | null }
export const listPasskeys = () => apiRequest<Passkey[]>('/auth/passkeys')
const post = <T>(path: string, data: unknown = {}) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(data) })

export async function registerPasskey(password: string) {
  const token = getToken()
  const data = await post<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>('/auth/passkeys/register/options', { password })
  const response = await startRegistration({ optionsJSON: data.options })
  if (!token || getToken() !== token) throw new Error('Аккаунт изменился. Войдите заново.')
  await post('/auth/passkeys/register/verify', { challengeId: data.challengeId, response })
}
export const removePasskey = (id: string, password: string) => post(`/auth/passkeys/${id}/remove`, { password })
export async function authenticatePasskey() {
  const data = await post<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>('/auth/passkeys/login/options')
  const response = await startAuthentication({ optionsJSON: data.options })
  return post<import('./authApi').LoginResult>('/auth/passkeys/login/verify', { challengeId: data.challengeId, response })
}
export function passkeyMessage(error: unknown) {
  if (error instanceof Error && ['NotAllowedError', 'AbortError'].includes(error.name)) return 'Подтверждение отменено или время истекло. Попробуйте снова либо войдите по паролю.'
  return error instanceof Error ? error.message : 'Не удалось подтвердить ключ доступа. Используйте пароль.'
}
