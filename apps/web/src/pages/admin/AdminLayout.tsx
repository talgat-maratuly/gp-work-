import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { getNurseryName } from '@/lib/appConfig'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS, type UserRole } from '@/lib/auth'

type IconName =
  | 'home'
  | 'clipboard'
  | 'list'
  | 'calendar'
  | 'map'
  | 'check'
  | 'schedule'
  | 'droplet'
  | 'doc'
  | 'mytasks'
  | 'building'
  | 'tag'
  | 'qr'
  | 'chat'
  | 'chart'
  | 'users'
  | 'user'
  | 'settings'
  | 'camera'
  | 'database'
  | 'layers'

type NavItem = {
  to: string
  end?: boolean
  label: string
  icon: IconName
  roles?: UserRole[]
}

type NavGroup = {
  key: string
  label: string
  icon: IconName
  to?: string // прямой пункт (без выпадающего списка)
  end?: boolean
  roles?: UserRole[]
  items?: NavItem[]
}

const ICON_PATHS: Record<IconName, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  clipboard: 'M9 4V3h6v1h2v16H7V4h2zM9 4h6',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 6h14v14H5z',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  check: 'M4 5h16v14H4zM8 12l3 3 5-6',
  schedule: 'M4 5h16v15H4zM4 9h16M9 13h6M9 16h6',
  droplet: 'M12 3s6 6 6 10a6 6 0 01-12 0c0-4 6-10 6-10z',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4',
  mytasks: 'M5 13l4 4L19 7',
  building: 'M5 21V4h9v17M14 9h5v12M8 8h.01M8 12h.01M8 16h.01',
  tag: 'M3 12l9-9h7v7l-9 9zM16 7h.01',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM19 19h1v1h-1z',
  chat: 'M4 5h16v10H9l-5 4V5z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M17 11a3 3 0 10-2-5M21 20a6 6 0 00-4-5.6',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM4 12h2M18 12h2M12 4v2M12 18v2M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18',
  camera: 'M4 8h3l2-2h6l2 2h3v11H4zM12 16a3 3 0 100-6 3 3 0 000 6z',
  database: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5',
}

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

// Навигация сгруппирована по разделам. Часть пунктов — прямые ссылки,
// часть — раскрывающиеся списки (удобнее искать, чем 19 иконок в ряд).
const navGroups: NavGroup[] = [
  { key: 'dashboard', label: 'Дашборд', icon: 'home', to: '/admin', end: true },
  {
    key: 'management',
    label: 'Управление',
    icon: 'clipboard',
    to: '/admin/management',
    roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'],
  },
  {
    key: 'works',
    label: 'Работы',
    icon: 'list',
    items: [
      {
        to: '/admin/work-logs',
        label: 'Журнал работ',
        icon: 'list',
        roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'],
      },
      {
        to: '/admin/map',
        label: 'Карта работ',
        icon: 'map',
        roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'],
      },
      { to: '/admin/tasks', label: 'Задачи', icon: 'check', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
      { to: '/admin/my-tasks', label: 'Мои задачи', icon: 'mytasks', roles: ['BRIGADIER', 'AGRONOMIST'] },
      { to: '/admin/attendance', label: 'Табель', icon: 'calendar', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
      {
        to: '/admin/photos',
        label: 'Фотоотчёты',
        icon: 'camera',
        roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'],
      },
    ],
  },
  {
    key: 'planning',
    label: 'Полив и график',
    icon: 'droplet',
    items: [
      {
        to: '/admin/watering',
        label: 'Полив',
        icon: 'droplet',
        roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER', 'AKIMAT', 'ANTICOR'],
      },
      {
        to: '/admin/schedule',
        label: 'Производственный график',
        icon: 'schedule',
        roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'],
      },
      {
        to: '/admin/daily-reports',
        label: 'Ежедневный отчёт',
        icon: 'doc',
        roles: ['ADMIN', 'AKIMAT', 'ANTICOR'],
      },
    ],
  },
  {
    key: 'objects',
    label: 'Объекты',
    icon: 'building',
    items: [
      { to: '/admin/objects', label: 'Объекты и участки', icon: 'building', roles: ['ADMIN', 'AGRONOMIST'] },
      { to: '/admin/qr', label: 'QR-паспорта', icon: 'qr', roles: ['ADMIN'] },
      { to: '/admin/work-types', label: 'Виды работ', icon: 'tag', roles: ['ADMIN'] },
    ],
  },
  {
    key: 'staff',
    label: 'Персонал',
    icon: 'users',
    items: [
      { to: '/admin/brigades', label: 'Бригады', icon: 'users', roles: ['ADMIN', 'BRIGADIER'] },
      { to: '/admin/users', label: 'Пользователи', icon: 'user', roles: ['ADMIN'] },
    ],
  },
  {
    key: 'settings',
    label: 'Отчёты и настройки',
    icon: 'settings',
    items: [
      { to: '/admin/export', label: 'Отчёты (Excel)', icon: 'chart', roles: ['ADMIN'] },
      { to: '/admin/ai-assistant', label: 'AI-помощник', icon: 'chat', roles: ['ADMIN'] },
      { to: '/admin/form-settings', label: 'Настройки формы', icon: 'settings', roles: ['ADMIN'] },
      { to: '/admin/seed', label: 'Seed', icon: 'database', roles: ['ADMIN'] },
    ],
  },
]

export function AdminLayout() {
  const { user, logout, hasRole } = useAuth()
  const { pathname } = useLocation()
  const [openKey, setOpenKey] = useState<string | null>(null)

  // Директор — полный доступ наравне с администратором.
  const isDirector = user?.role === 'DIRECTOR'
  const canSee = (roles?: UserRole[]) => !roles || isDirector || hasRole(...roles)

  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items?.filter((i) => canSee(i.roles)),
    }))
    .filter((g) => (g.to ? canSee(g.roles) : (g.items?.length ?? 0) > 0))

  const isGroupActive = (g: NavGroup) =>
    g.items?.some((i) => pathname === i.to || pathname.startsWith(i.to + '/')) ?? false

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Тёмно-синяя верхняя панель */}
      <header className="no-print bg-[#0f2e38] text-white shadow-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 pt-3">
          <div className="w-40" />
          <div className="text-center leading-none">
            <div className="text-2xl font-extrabold tracking-tight">
              <span className="text-emerald-400">GP</span>
            </div>
            <div className="mt-0.5 text-[10px] font-semibold tracking-[0.35em] text-slate-200">
              WORK
            </div>
          </div>
          <div className="flex w-40 items-center justify-end gap-3">
            {user && (
              <span className="hidden text-right text-xs text-slate-300 sm:block">
                {user.fullName}
                <span className="block text-[10px] text-emerald-300">{ROLE_LABELS[user.role]}</span>
              </span>
            )}
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
            >
              Выйти
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-1 px-2 pb-3 pt-2">
          {visibleGroups.map((g) =>
            g.to ? (
              <NavLink
                key={g.key}
                to={g.to}
                end={g.end}
                onClick={() => setOpenKey(null)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-emerald-500 text-white shadow' : 'text-slate-200 hover:bg-white/10'
                  }`
                }
              >
                <Icon name={g.icon} className="h-4 w-4" />
                {g.label}
              </NavLink>
            ) : (
              <div key={g.key} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenKey((k) => (k === g.key ? null : g.key))}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isGroupActive(g) || openKey === g.key
                      ? 'bg-emerald-500 text-white shadow'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Icon name={g.icon} className="h-4 w-4" />
                  {g.label}
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {openKey === g.key && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    {g.items?.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpenKey(null)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`
                        }
                      >
                        <span className="text-slate-400">
                          <Icon name={item.icon} className="h-4 w-4" />
                        </span>
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </nav>
      </header>

      {/* Прозрачный слой закрытия выпадающего меню по клику вне */}
      {openKey && <div className="fixed inset-0 z-40" onClick={() => setOpenKey(null)} />}

      {/* Светлая рабочая область */}
      <main className="no-print mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 md:px-6">
        <p className="mb-3 text-xs text-slate-400">{getNurseryName()} · панель управления</p>
        <Outlet />
      </main>
    </div>
  )
}
