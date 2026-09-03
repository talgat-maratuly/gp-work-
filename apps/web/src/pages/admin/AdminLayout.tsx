import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { getNurseryName } from '@/lib/appConfig'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS, type UserRole } from '@/lib/auth'

type NavItem = { to: string; label: string; icon: string; end?: boolean; roles?: UserRole[] }
type NavGroup = { label: string; items: NavItem[] }

const groups: NavGroup[] = [
  { label: 'Операции', items: [
    { to: '/admin', label: 'Главная', icon: '⌂', end: true },
    { to: '/admin/dispatcher', label: 'Диспетчерская', icon: '◎', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'] },
    { to: '/admin/executions', label: 'Приёмка работ', icon: '✓', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
    { to: '/admin/tasks', label: 'Задачи', icon: '▣', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
    { to: '/admin/routes', label: 'Маршруты', icon: '↗', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
    { to: '/admin/map', label: 'Карта', icon: '⌖', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'] },
    { to: '/admin/work-logs', label: 'Журнал работ', icon: '≡', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'] },
    { to: '/admin/schedule', label: 'График', icon: '□', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'] },
    { to: '/admin/watering', label: 'Полив и водовозы', icon: '◇', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER', 'AKIMAT', 'ANTICOR'] },
  ]},
  { label: 'Объекты и люди', items: [
    { to: '/admin/objects', label: 'Объекты', icon: '▤', roles: ['ADMIN', 'AGRONOMIST'] },
    { to: '/admin/users', label: 'Сотрудники', icon: '♙', roles: ['ADMIN'] },
    { to: '/admin/brigades', label: 'Бригады', icon: '♟', roles: ['ADMIN', 'BRIGADIER'] },
    { to: '/admin/attendance', label: 'Табель', icon: '◷', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
    { to: '/admin/qr', label: 'QR-паспорта', icon: '▦', roles: ['ADMIN'] },
    { to: '/admin/photos', label: 'Фото ДО/ПОСЛЕ', icon: '▧', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'] },
  ]},
  { label: 'Ресурсы', items: [
    { to: '/admin/warehouse', label: 'Склад', icon: '▰', roles: ['ADMIN', 'BRIGADIER'] },
    { to: '/admin/nursery', label: 'Питомник', icon: '♧', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
    { to: '/admin/vehicles', label: 'Техника', icon: '▱', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
    { to: '/admin/products/import', label: 'Импорт товаров', icon: '⇩', roles: ['ADMIN'] },
    { to: '/admin/work-types', label: 'Виды работ', icon: '⌁', roles: ['ADMIN'] },
  ]},
  { label: 'Контроль', items: [
    { to: '/admin/kpi', label: 'KPI / Качество', icon: '↥', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'] },
    { to: '/admin/evidence-reports', label: 'Отчёты по работам', icon: '▥', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'] },
    { to: '/admin/management', label: 'Управление', icon: '◆', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'] },
    { to: '/admin/daily-reports', label: 'Отчёты', icon: '▥', roles: ['ADMIN', 'AKIMAT', 'ANTICOR'] },
    { to: '/admin/export', label: 'Экспорт Excel', icon: '⇧', roles: ['ADMIN'] },
    { to: '/admin/ai-assistant', label: 'AI-помощник', icon: '✦', roles: ['ADMIN'] },
    { to: '/admin/form-settings', label: 'Настройки формы', icon: '⚙', roles: ['ADMIN'] },
    { to: '/admin/seed', label: 'Системные данные', icon: '◫', roles: ['ADMIN'] },
  ]},
]

export function AdminLayout() {
  const { user, logout, hasRole } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const canSee = (roles?: UserRole[]) => !roles || user?.role === 'DIRECTOR' || hasRole(...roles)
  const visible = groups.map((group) => ({ ...group, items: group.items.filter((item) => canSee(item.roles)) })).filter((group) => group.items.length)

  const navigation = <>{visible.map((group) => <section key={group.label} className="mb-5"><p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{group.label}</p><div className="space-y-0.5">{group.items.map((item) => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><span className="w-5 text-center text-base">{item.icon}</span><span>{item.label}</span></NavLink>)}</div></section>)}</>

  return (
    <div className="min-h-dvh bg-slate-100 lg:flex">
      <aside className="hidden h-dvh w-64 shrink-0 flex-col bg-[#101b1e] text-white lg:sticky lg:top-0 lg:flex">
        <div className="border-b border-white/10 px-5 py-5"><p className="text-2xl font-black"><span className="text-emerald-400">GP</span> WORK</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Операционная система полевых работ</p></div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">{navigation}</nav>
        <div className="border-t border-white/10 p-4"><p className="text-sm font-semibold">{user?.fullName}</p><p className="text-xs text-emerald-400">{user ? ROLE_LABELS[user.role] : ''}</p><button onClick={logout} className="mt-3 text-xs text-slate-400 hover:text-white">Выйти</button></div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)}><aside className="h-full w-72 overflow-y-auto bg-[#101b1e] p-4 text-white" onClick={(e) => e.stopPropagation()}><p className="mb-5 text-xl font-black"><span className="text-emerald-400">GP</span> WORK</p>{navigation}</aside></div>}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 lg:hidden">☰</button><div><p className="font-bold text-slate-900">{getNurseryName()}</p><p className="text-xs text-slate-500">Управление полевыми работами</p></div></div>
          <div className="flex items-center gap-3"><div className="hidden rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500 md:block">Поиск объектов, сотрудников, задач…</div><div className="h-9 w-9 rounded-full bg-emerald-100 text-center font-bold leading-9 text-emerald-800">{user?.fullName?.charAt(0) ?? 'G'}</div></div>
        </header>
        <main className="w-full p-4 md:p-6 xl:p-8"><Outlet /></main>
      </div>
    </div>
  )
}
