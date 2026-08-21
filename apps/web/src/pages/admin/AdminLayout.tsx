import { NavLink, Outlet } from 'react-router-dom'
import { getNurseryName } from '@/lib/appConfig'
import { useAuth } from '@/context/AuthContext'
import { ROLE_LABELS, type UserRole } from '@/lib/auth'

type NavItem = {
  to: string
  end?: boolean
  label: string
  roles?: UserRole[]
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Работы',
    items: [
      { to: '/admin', end: true, label: 'Главная' },
      { to: '/admin/work-logs', label: 'Журнал работ', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
      { to: '/admin/attendance', label: 'Табель', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
      { to: '/admin/map', label: 'Карта работ', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
      { to: '/admin/tasks', label: 'Задачи', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
      { to: '/admin/my-tasks', label: 'Мои задачи', roles: ['BRIGADIER', 'AGRONOMIST'] },
      { to: '/admin/objects', label: 'Объекты и участки', roles: ['ADMIN', 'AGRONOMIST'] },
      { to: '/admin/work-types', label: 'Виды работ', roles: ['ADMIN'] },
      { to: '/admin/qr', label: 'QR-коды', roles: ['ADMIN'] },
      { to: '/admin/ai-agronom', label: '🌿 AI-Агроном', roles: ['ADMIN', 'AGRONOMIST'] },
      { to: '/admin/ai-assistant', label: 'AI-помощник администратора', roles: ['ADMIN'] },
      { to: '/admin/export', label: 'Экспорт работ (Excel)', roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Склад',
    items: [
      { to: '/admin/products/import', label: 'Импорт товаров (Excel)', roles: ['ADMIN'] },
      { to: '/admin/warehouse', label: 'Учет товаров и остатков', roles: ['ADMIN', 'BRIGADIER'] },
      { to: '/admin/warehouse/issue', label: 'Выдача / Списание товаров', roles: ['ADMIN', 'BRIGADIER'] },
      { to: '/admin/warehouse/export', label: 'Экспорт остатков (Excel)', roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Персонал',
    items: [
      { to: '/admin/brigades', label: 'Бригады', roles: ['ADMIN', 'BRIGADIER'] },
      { to: '/admin/users', label: 'Пользователи', roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Настройки',
    items: [
      { to: '/admin/form-settings', label: 'Настройки формы', roles: ['ADMIN'] },
      { to: '/admin/photos', label: 'Фотоотчёты', roles: ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] },
      { to: '/admin/seed', label: 'Seed запуск', roles: ['ADMIN'] },
    ],
  },
]

export function AdminLayout() {
  const { user, logout, hasRole } = useAuth()
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || hasRole(...item.roles)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="no-print flex min-h-screen flex-col md:flex-row">
      <aside className="no-print border-b border-slate-200 bg-white md:w-56 md:border-b-0 md:border-r">
        <div className="border-b border-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Админ-панель</p>
          <p className="font-bold text-emerald-800">{getNurseryName()}</p>
          {user && (
            <p className="mt-2 text-xs text-slate-600">
              {user.fullName.trim().toLowerCase() === ROLE_LABELS[user.role].toLowerCase()
                ? user.fullName
                : `${user.fullName} · ${ROLE_LABELS[user.role]}`}
            </p>
          )}
        </div>
        <nav className="flex gap-3 overflow-x-auto p-2 md:flex-col md:gap-4">
          {visibleGroups.map((group) => (
            <section key={group.title} className="min-w-max md:min-w-0">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group.title}
              </p>
              <div className="flex gap-1 md:flex-col">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-2">
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="no-print flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
