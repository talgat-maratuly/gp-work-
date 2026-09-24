import { Link } from 'react-router-dom'
import { ROLE_LABELS } from '@/lib/auth'
import { aiLinksForRole } from '@/lib/aiNavigation'
import { useAuth } from '@/context/AuthContext'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { canOpenPage } from '@/lib/accessPolicy'

export function FieldMorePage() {
  const { user } = useAuth()
  const { pending, syncing, online, lastError, sync } = useOfflineQueue()
  const assistant=aiLinksForRole(user?.role)[0]?.to??'/field/assistant'
  return <div className="space-y-4">
    <div><h1 className="text-2xl font-black">Ещё</h1><p className="text-sm text-slate-500">Профиль, ИИ‑ассистент и синхронизация</p></div>
    {canOpenPage(user,assistant)&&<Link to={assistant} className="block rounded-2xl bg-gradient-to-r from-blue-700 to-emerald-700 p-4 text-white shadow-sm"><p className="text-lg font-black">✦ ИИ‑ассистент</p><p className="mt-1 text-sm text-white/85">Подсказки по вашим задачам и обязанностям</p></Link>}
    <section className="rounded-2xl bg-white p-4 shadow-sm"><p className="font-bold">{user?.fullName}</p><p className="text-sm text-slate-500">{user ? user.roleName??ROLE_LABELS[user.role] : ''}</p></section>
    <section className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">Синхронизация</p><p className="text-sm text-slate-500">{online ? 'Интернет доступен' : 'Нет подключения'} · в очереди {pending}</p>{lastError && <p className="mt-1 break-words text-xs text-red-700">Последняя ошибка: {lastError}</p>}</div><button disabled={!online || syncing || pending === 0} onClick={() => void sync()} className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40">{syncing ? 'Отправка…' : 'Отправить'}</button></div></section>
  </div>
}
