import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useRouteLocationTracking } from '@/hooks/useRouteLocationTracking'

const items = [
  { to: '/field/today', label: 'Сегодня', icon: '⌂' },
  { to: '/field/route', label: 'Маршрут', icon: '↗' },
  { to: '/field/qr', label: 'QR', icon: '▦' },
  { to: '/field/tasks', label: 'Задачи', icon: '✓' },
  { to: '/field/more', label: 'Ещё', icon: '•••' },
]

export function FieldLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pending, online, lastError } = useOfflineQueue()
  const tracking = useRouteLocationTracking()

  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-slate-50 pb-24 shadow-xl">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-black tracking-tight"><span className="text-emerald-700">GP</span> WORK</p>
            <p className="text-xs text-slate-500">{user?.fullName ?? 'Полевые работы'}</p>
          </div>
          <div className="text-right text-xs">
            <p className={online ? 'text-emerald-700' : 'text-amber-700'}>{online ? '● На связи' : '● Нет сети'}</p>
            {tracking.routeId && <p className={tracking.status === 'denied' || tracking.status === 'error' ? 'font-semibold text-red-700' : 'text-blue-700'}>{tracking.status === 'denied' ? 'GPS запрещён' : tracking.status === 'error' ? 'Ошибка GPS' : tracking.status === 'queued' ? 'GPS сохранён offline' : 'GPS маршрута активен'}</p>}
            {pending > 0 && <p className="font-semibold text-amber-700">Не синхронизировано: {pending}</p>}
            {lastError && <p className="max-w-48 truncate text-red-700" title={lastError}>Ошибка синхронизации</p>}
          </div>
        </div>
      </header>

      <main className="px-4 py-4"><Outlet /></main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-xl grid-cols-5 border-t border-slate-200 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex flex-col items-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
            <span className="text-xl leading-5">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button className="sr-only" onClick={() => { logout(); navigate('/login', { replace: true }) }}>Выйти</button>
    </div>
  )
}
