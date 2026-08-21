import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatSubmittedDate, formatSubmittedTime } from '@/lib/dateFilters'
import { fetchWorkLogStats } from '@/lib/workLogsApi'
import type { WorkLog } from '@/lib/types'

export function DashboardPage() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchWorkLogStats>> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkLogStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-500">Загрузка…</p>
  if (!stats) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Главная</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Сегодня" value={stats.today} />
        <StatCard label="За неделю" value={stats.week} />
        <StatCard label="За месяц" value={stats.month} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Последние отчёты</h2>
        <RecentList logs={stats.recent} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Самые активные работники</h2>
          <ul className="rounded-xl border border-slate-200 bg-white divide-y">
            {stats.topWorkers.length === 0 ? (
              <li className="px-4 py-3 text-slate-500">Нет данных</li>
            ) : (
              stats.topWorkers.map((w) => (
                <li key={w.name} className="flex justify-between px-4 py-3">
                  <span>{w.name}</span>
                  <span className="font-medium text-emerald-700">{w.count}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Участки без недавних работ</h2>
          <ul className="rounded-xl border border-slate-200 bg-white divide-y">
            {stats.staleSections.map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <p className="font-medium">
                  {s.name}{' '}
                  <span className="font-mono text-slate-500">({s.code})</span>
                </p>
                <p className="text-slate-500">{s.objectName}</p>
                <p className="text-xs text-amber-700">
                  {s.lastWork
                    ? `Последняя работа: ${formatSubmittedDate(s.lastWork)}`
                    : 'Работ ещё не было'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Link
        to="/admin/work-logs"
        className="inline-block text-emerald-700 underline text-sm"
      >
        Открыть полный журнал →
      </Link>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-emerald-800">{value}</p>
    </div>
  )
}

function RecentList({ logs }: { logs: WorkLog[] }) {
  if (!logs.length) {
    return <p className="text-slate-500">Пока нет отчётов</p>
  }

  return (
    <ul className="rounded-xl border border-slate-200 bg-white divide-y">
      {logs.map((log) => (
        <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
          <div>
            <span className="font-medium">{log.worker_full_name}</span>
            <span className="text-slate-500">
              {' '}
              · {log.sections?.name} · {log.work_types?.name ?? log.custom_work_type}
            </span>
          </div>
          <span className="text-slate-500">
            {formatSubmittedDate(log.submitted_at)}{' '}
            {formatSubmittedTime(log.submitted_at)}
          </span>
        </li>
      ))}
    </ul>
  )
}
