import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { resetUserPassword, type ApiUser, type PasswordReset } from '@/api/usersApi'
import { ApiError, toUserMessage } from '@/api/client'
import { getToken } from '@/lib/auth'

export function PasswordResetDialog({ user, onClose, onReset }: { user: ApiUser; onClose: () => void; onReset: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const credentials = useRef<HTMLTextAreaElement>(null)
  const busy = useRef(false)
  const sessionToken = useRef(getToken())
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<PasswordReset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])

  async function reset() {
    if (busy.current) return
    if (sessionToken.current !== getToken()) { onClose(); return }
    busy.current = true
    setSaving(true); setError(null)
    try {
      const value = await resetUserPassword(user.id)
      if (sessionToken.current !== getToken()) return
      setResult(value)
      onReset()
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось сбросить пароль.'))
      setUncertain(!(err instanceof ApiError) || !err.status || err.status >= 500)
    } finally { busy.current = false; setSaving(false) }
  }

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(credentials.current?.value ?? '')
      setCopyStatus('Логин и временный пароль скопированы.')
    } catch {
      credentials.current?.focus(); credentials.current?.select()
      setCopyStatus('Не удалось скопировать автоматически. Выделите текст и скопируйте его вручную.')
    }
  }

  // Keep the modal outside the page's spacing/overflow rules.
  return createPortal(<dialog ref={dialog} aria-label="Сброс пароля" onCancel={event => { event.preventDefault(); if (!busy.current) onClose() }} className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-xl border bg-white p-5 shadow-xl backdrop:bg-slate-900/50">
    <h2 className="text-xl font-bold">Сброс пароля</h2>
    <p className="mt-2 break-words font-medium">{result?.fullName ?? user.fullName}</p>
    <p className="break-all text-sm text-slate-600">Логин: {result?.username ?? user.username}</p>
    {result ? <div className="mt-4 space-y-3">
      <p role="status" className="text-sm text-emerald-800">Временный пароль создан. Передайте его сотруднику лично.</p>
      <label className="block text-sm">Данные для входа
        <textarea ref={credentials} readOnly rows={3} value={`Логин: ${result.username}\nВременный пароль: ${result.temporaryPassword}`} className="mt-1 w-full resize-none rounded-lg border bg-slate-50 p-3 font-mono text-sm" />
      </label>
      <p className="text-sm text-slate-600">Действует до {new Date(result.expiresAt).toLocaleString('ru-RU')}. При входе сотрудник установит свой пароль.</p>
      <p className="text-sm text-slate-600">После закрытия окна этот пароль посмотреть снова нельзя. При необходимости создайте новый.</p>
      <button type="button" onClick={() => void copy()} className="w-full rounded-lg bg-blue-700 px-4 py-2 text-white">Скопировать логин и пароль</button>
      {copyStatus && <p role="status" className="text-sm text-slate-700">{copyStatus}</p>}
    </div> : <div className="mt-4 space-y-3">
      <p className="text-sm text-slate-600">Создать временный пароль на 24 часа? Прежний пароль и открытые сессии сотрудника перестанут работать.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {uncertain && <p className="text-sm text-amber-800">Ответ сервера не получен, но сброс мог выполниться. Создайте другой временный пароль — предыдущий станет недействителен.</p>}
      <button type="button" onClick={() => void reset()} disabled={saving} className="w-full rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Создание…' : uncertain ? 'Создать другой временный пароль' : 'Создать временный пароль'}</button>
    </div>}
    <button type="button" disabled={saving} onClick={onClose} className="mt-4 w-full rounded-lg border px-4 py-2 disabled:opacity-50">{result ? 'Закрыть' : 'Отмена'}</button>
  </dialog>, document.body)
}
