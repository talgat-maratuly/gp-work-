import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { AccountControls } from '@/components/AccountControls'
import { homePathForRole } from '@/lib/roleRoutes'
import { getNurseryName } from '@/lib/appConfig'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS, type UserRole } from '@/lib/auth'
import { ADMIN_ROUTE_ROLES } from '@/lib/rolePermissions'
import { aiLinksForRole } from '@/lib/aiNavigation'

type NavItem = { to: string; label: string; icon: string; end?: boolean; roles?: readonly UserRole[] }
type NavGroup = { label: string; items: NavItem[] }

const groups: NavGroup[] = [
  { label: 'Операции', items: [
    { to: '/admin', label: 'Главная', icon: '⌂', end: true, roles: ADMIN_ROUTE_ROLES.dashboard },
    { to: '/admin/director', label: 'Кабинет директора', icon: '◆', roles: ['ADMIN', 'DIRECTOR'] },
    { to: '/admin/dispatcher', label: 'Диспетчерская', icon: '◎', roles: ADMIN_ROUTE_ROLES.dispatcher },
    { to: '/admin/executions', label: 'Приёмка работ', icon: '✓', roles: ADMIN_ROUTE_ROLES.executions },
    { to: '/admin/tasks', label: 'Задачи', icon: '▣', roles: ADMIN_ROUTE_ROLES.tasks },
    { to: '/admin/routes', label: 'Маршруты', icon: '↗', roles: ADMIN_ROUTE_ROLES.routes },
    { to: '/admin/map', label: 'Карта', icon: '⌖', roles: ADMIN_ROUTE_ROLES.map },
    { to: '/admin/work-logs', label: 'Журнал работ', icon: '≡', roles: ADMIN_ROUTE_ROLES.workLogs },
    { to: '/admin/schedule', label: 'График', icon: '□', roles: ADMIN_ROUTE_ROLES.schedule },
    { to: '/admin/watering', label: 'Полив и водовозы', icon: '◇', roles: ADMIN_ROUTE_ROLES.watering },
  ]},
  { label: 'Объекты и люди', items: [
    { to: '/admin/objects', label: 'Объекты', icon: '▤', roles: ADMIN_ROUTE_ROLES.objects },
    { to: '/admin/users', label: 'Сотрудники', icon: '♙', roles: ADMIN_ROUTE_ROLES.users },
    { to: '/admin/brigades', label: 'Бригады', icon: '♟', roles: ADMIN_ROUTE_ROLES.brigades },
    { to: '/admin/attendance', label: 'Табель', icon: '◷', roles: ADMIN_ROUTE_ROLES.attendance },
    { to: '/admin/work-days', label: 'Рабочие дни', icon: '◉', roles: ADMIN_ROUTE_ROLES.workDays },
    { to: '/admin/qr', label: 'QR-паспорта', icon: '▦', roles: ADMIN_ROUTE_ROLES.qr },
    { to: '/admin/photos', label: 'Фото ДО/ПОСЛЕ', icon: '▧', roles: ADMIN_ROUTE_ROLES.photos },
  ]},
  { label: 'Ресурсы', items: [
    { to: '/admin/warehouse', label: 'Склад', icon: '▰', roles: ADMIN_ROUTE_ROLES.warehouse },
    { to: '/admin/vehicles', label: 'Техника', icon: '▱', roles: ADMIN_ROUTE_ROLES.vehicles },
    { to: '/admin/products/import', label: 'Импорт товаров', icon: '⇩', roles: ADMIN_ROUTE_ROLES.productImport },
    { to: '/admin/work-types', label: 'Виды работ', icon: '⌁', roles: ADMIN_ROUTE_ROLES.workTypes },
  ]},
  { label: 'Контроль', items: [
    { to: '/admin/kpi', label: 'KPI / Качество', icon: '↥', roles: ADMIN_ROUTE_ROLES.kpi },
    { to: '/admin/evidence-reports', label: 'Отчёты по работам', icon: '▥', roles: ADMIN_ROUTE_ROLES.evidenceReports },
    { to: '/admin/management', label: 'Управление', icon: '◆', roles: ADMIN_ROUTE_ROLES.management },
    { to: '/admin/daily-reports', label: 'Отчёты', icon: '▥', roles: ADMIN_ROUTE_ROLES.dailyReports },
    { to: '/admin/export', label: 'Экспорт Excel', icon: '⇧', roles: ADMIN_ROUTE_ROLES.export },
    { to: '/admin/form-settings', label: 'Настройки формы', icon: '⚙', roles: ADMIN_ROUTE_ROLES.formSettings },
    { to: '/admin/seed', label: 'Системные данные', icon: '◫', roles: ADMIN_ROUTE_ROLES.seed },
  ]},
]

const directorGroups: NavGroup[] = [{ label: 'Кабинет директора', items: [
  { to: '/admin/director', label: 'Поручения и исполнение', icon: '⌂' },
  { to: '/admin/executions', label: 'Приёмка работ', icon: '✓' },
  { to: '/admin/map', label: 'Карта объектов', icon: '⌖' },
  { to: '/admin/evidence-reports', label: 'Отчёты по работам', icon: '▥' },
  { to: '/admin/management', label: 'Управленческие решения', icon: '◆' },
] }]

export function AdminLayout() {
  const { user, hasRole } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const aiLinks = aiLinksForRole(user?.role)
  const canSee = (roles?: readonly UserRole[]) => !roles || user?.role === 'DIRECTOR' || hasRole(...roles)
  const allGroups: NavGroup[] = [...(user?.role === 'DIRECTOR' ? directorGroups : groups), ...(aiLinks.length ? [{ label: 'ИИ-помощники', items: aiLinks }] : [])]
  const visible = allGroups.map((group) => ({ ...group, items: group.items.filter((item) => canSee(item.roles)) })).filter((group) => group.items.length)

  const navigation = <>{visible.map((group) => <section key={group.label} className="mb-5"><p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{group.label}</p><div className="space-y-0.5">{group.items.map((item) => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><span className="w-5 text-center text-base">{item.icon}</span><span>{item.label}</span></NavLink>)}</div></section>)}</>

  return (
    <div className="min-h-dvh bg-slate-100 lg:flex">
      <aside className="hidden h-dvh w-64 shrink-0 flex-col bg-[#101b1e] text-white lg:sticky lg:top-0 lg:flex">
        <div className="border-b border-white/10 px-5 py-5"><p className="text-2xl font-black"><span className="text-emerald-400">GP</span> WORK</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Операционная система полевых работ</p></div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">{navigation}</nav>
        <div className="border-t border-white/10 p-4"><p className="text-sm font-semibold">{user?.fullName}</p><p className="text-xs text-emerald-400">{user ? ROLE_LABELS[user.role] : ''}</p></div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)}><aside aria-label="Меню GP Work" className="flex h-full w-72 flex-col overflow-y-auto bg-[#101b1e] p-4 text-white" onClick={(e) => e.stopPropagation()}><div className="mb-5 flex items-center justify-between"><p className="text-xl font-black"><span className="text-emerald-400">GP</span> WORK</p><button type="button" aria-label="Закрыть меню" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2">✕</button></div><div className="mb-4 rounded-xl bg-white p-3"><AccountControls /></div><nav>{navigation}</nav></aside></div>}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-3 px-4 md:px-6">
            <div className="flex items-center gap-3"><button aria-label="Открыть меню" onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 lg:hidden">☰</button><div><p className="font-bold text-slate-900">{getNurseryName()}</p><p className="text-xs text-slate-500">Управление полевыми работами</p></div></div>
            {!mobileOpen && <AccountControls />}
          </div>
          <nav aria-label="ИИ-помощники" className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2 md:px-6">
            <Link to={homePathForRole(user!.role)} className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">← В кабинет</Link>
            {aiLinks.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'}`}><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}
          </nav>
        </header>
        <main className="w-full p-4 md:p-6 xl:p-8"><Outlet /></main>
      </div>
    </div>
  )
}
