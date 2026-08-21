import { getToken } from '@/lib/auth'

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api'

export const API_ORIGIN = API_BASE.startsWith('http')
  ? API_BASE.replace(/\/api$/, '')
  : ''

export function resolveAssetUrl(path: string): string {
  if (!path) return path
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('load failed')
  )
}

export function toUserMessage(err: unknown, fallback = 'Не удалось сохранить данные'): string {
  if (err instanceof ApiError) {
    if (err.status === 0 || isNetworkError(err.cause)) {
      return 'Backend не запущен. Запустите: npm run dev:api'
    }
    if (err.status === 401) {
      if (!err.message || err.message === 'Unauthorized') {
        return 'Сессия истекла. Войдите заново.'
      }
      return err.message
    }
    if (err.status === 403) {
      if (!err.message || err.message === 'Forbidden') {
        return 'Нет доступа. Войдите заново или проверьте права администратора.'
      }
      return err.message
    }
    return err.message || fallback
  }
  if (isNetworkError(err)) {
    return 'Backend не запущен. Проверьте подключение к серверу'
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] }
    if (Array.isArray(body.message)) return body.message.join(', ')
    if (body.message) return body.message
  } catch {
    /* ignore */
  }
  return `Ошибка сервера (${res.status})`
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`

  let res: Response
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  try {
    res = await fetch(url, {
      ...options,
      headers,
    })
  } catch (err) {
    console.error('[api]', path, err)
    throw new ApiError('Проверьте подключение к серверу', 0, err)
  }

  if (!res.ok) {
    const message = await parseError(res)
    console.error('[api]', path, res.status, message)
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>
  }

  return res as unknown as T
}

export async function apiDownload(path: string): Promise<Blob> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let res: Response
  try {
    res = await fetch(url, { headers })
  } catch (err) {
    console.error('[api]', path, err)
    throw new ApiError('Проверьте подключение к серверу', 0, err)
  }
  if (!res.ok) {
    const message = await parseError(res)
    console.error('[api]', path, res.status, message)
    throw new ApiError(message, res.status)
  }
  return res.blob()
}
