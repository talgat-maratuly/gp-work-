import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { userHome } from '@/lib/accessPolicy'
import { homePathForRole } from '@/lib/roleRoutes'
import { browserSupportsWebAuthn, listPasskeys, registerPasskey, removePasskey, passkeyMessage, type Passkey } from '@/api/passkeysApi'

export function PasskeysPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [keys, setKeys] = useState<Passkey[]>([])
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supported = browserSupportsWebAuthn()
  async function load() {
    setLoading(true); setError('')
    try { setKeys(await listPasskeys()) } catch (err) { setError(passkeyMessage(err)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [user?.id])
  async function action(id?: string) {
    if (busy) return
    setBusy(true); setError(''); setSuccess('')
    const secret = password
    setPassword('')
    try {
      if (id) {
        await removePasskey(id, secret)
        logout()
        navigate('/login', { replace: true })
        return
      }
      await registerPasskey(secret)
      setSuccess('Ключ сохранён. Выйдите из аккаунта и проверьте кнопку «Войти с Face ID / ключом».')
      await load()
    } catch (err) { setError(passkeyMessage(err)) }
    finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-xl space-y-5 p-4 py-8">
    <Link className="text-blue-700 underline" to={userHome(user!, homePathForRole(user!.role))}>← В кабинет</Link>
    <h1 className="text-2xl font-bold">Face ID и ключи доступа</h1>
    <p>Пробный вход для директора. На iPhone подтверждение выполняет Face ID или код устройства. GP Work не получает фотографию или данные лица.</p>
    <p className="text-sm text-slate-600">Добавьте ключ на своём телефоне. Пароль остаётся запасным способом входа. После смены или сброса пароля ключи нужно подключить заново.</p>
    {!supported && <p role="status">Этот браузер не поддерживает ключи доступа. Откройте сайт в Safari на iPhone или используйте пароль.</p>}
    <label className="block font-medium" htmlFor="passkey-password">Текущий пароль для управления ключами</label>
    <input id="passkey-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy}
      className="w-full rounded-lg border p-3" />
    <button type="button" onClick={() => void action()} disabled={busy || loading || !password || !supported || keys.length >= 5}
      className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Ожидаем подтверждение…' : 'Подключить Face ID / ключ доступа'}</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {success && <p role="status" className="text-emerald-800">{success}</p>}
    <h2 className="text-lg font-semibold">Подключённые ключи</h2>
    {loading ? <p>Загрузка…</p> : keys.length === 0 && <p>Ключей пока нет.</p>}
    {keys.map((key, index) => <div key={key.id} className="space-y-2 rounded-xl border p-4">
      <p className="font-medium">Ключ {index + 1}</p>
      <p className="text-sm">Добавлен: {new Date(key.createdAt).toLocaleString('ru-RU')}</p>
      <p className="text-sm">{key.lastUsedAt ? `Последний вход: ${new Date(key.lastUsedAt).toLocaleString('ru-RU')}` : 'Вход ещё не проверен'}</p>
      <button type="button" onClick={() => { if (window.confirm('Удалить этот ключ и завершить все сеансы аккаунта? Потребуется войти заново.')) void action(key.id) }}
        disabled={busy || !password} className="rounded-lg border px-3 py-2 text-red-700 disabled:opacity-50">Удалить ключ {index + 1}</button>
    </div>)}
    <p className="text-sm text-slate-600">Удаление ключа завершит все сеансы этого аккаунта, включая потерянный телефон. Остальные подключённые ключи сохранятся.</p>
    <button type="button" onClick={() => void load()} disabled={busy || loading} className="text-blue-700 underline">Обновить список</button>
  </main>
}
