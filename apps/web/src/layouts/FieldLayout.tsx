import { Link, NavLink, Outlet } from 'react-router-dom'
import { AccountControls } from '@/components/AccountControls'
import { homePathForRole } from '@/lib/roleRoutes'
import { aiLinksForRole } from '@/lib/aiNavigation'
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
  const { user } = useAuth()
  const { pending, online, lastError } = useOfflineQueue()
  const tracking = useRouteLocationTracking()

  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-slate-50 pb-24 shadow-xl">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-black tracking-tight"><span className="text-emerald-700">GP</span> WORK</p>
            <p className="text-xs text-slate-500">Полевые работы</p>
          </div>
          <div className="text-right text-xs">
            <AccountControls />
            <p className={online ? 'text-emerald-700' : 'text-amber-700'}>{online ? '● На связи' : '● Нет сети'}</p>
            {tracking.routeId && <p className={tracking.status === 'denied' || tracking.status === 'error' ? 'font-semibold text-red-700' : 'text-blue-700'}>{tracking.status === 'denied' ? 'GPS запрещён' : tracking.status === 'error' ? 'Ошибка GPS' : tracking.status === 'queued' ? 'GPS сохранён offline' : 'GPS маршрута активен'}</p>}
            {pending > 0 && <p className="font-semibold text-amber-700">Не синхронизировано: {pending}</p>}
            {lastError && <p className="max-w-48 truncate text-red-700" title={lastError}>Ошибка синхронизации</p>}
          </div>
        </div>
        <Link to="/field/workflow" className="mt-3 block rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Работа и улучшения</Link>
        <nav aria-label="ИИ-помощники" className="mt-3 flex flex-wrap gap-2">
          <Link to={homePathForRole(user!.role)} className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">← В кабинет</Link>
          <Link to="/my-work-day" className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Мой рабочий день</Link>
          <NavLink to={aiLinksForRole(user?.role)[0]?.to ?? '/field/assistant'} className={({ isActive }) => `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-800'}`}>
            <span aria-hidden="true">✧</span>ИИ-ассистент
          </NavLink>
        </nav>
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


    </div>
  )
}
