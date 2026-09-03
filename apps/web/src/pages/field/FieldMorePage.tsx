import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'

export function FieldMorePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pending, syncing, online, lastError, sync } = useOfflineQueue()
  return <div className="space-y-4"><div><h1 className="text-2xl font-black">Ещё</h1><p className="text-sm text-slate-500">Профиль и синхронизация</p></div><section className="rounded-2xl bg-white p-4 shadow-sm"><p className="font-bold">{user?.fullName}</p><p className="text-sm text-slate-500">{user?.role}</p></section><section className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">Синхронизация</p><p className="text-sm text-slate-500">{online ? 'Интернет доступен' : 'Нет подключения'} · в очереди {pending}</p>{lastError && <p className="mt-1 break-words text-xs text-red-700">Последняя ошибка: {lastError}</p>}</div><button disabled={!online || syncing || pending === 0} onClick={() => void sync()} className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40">{syncing ? 'Отправка…' : 'Отправить'}</button></div></section><button onClick={() => { logout(); navigate('/login', { replace: true }) }} className="w-full rounded-xl border border-red-200 bg-white py-3 font-semibold text-red-700">Выйти</button></div>
}
