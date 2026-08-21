import { useEffect, useState } from 'react'
import { fetchWorkLogs } from '@/lib/workLogsApi'
import { formatSubmittedDate, formatSubmittedTime } from '@/lib/dateFilters'
import type { WorkLog } from '@/lib/types'

export function PhotosPage() {
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkLogs()
      .then((data) => setLogs(data.filter((l) => l.photo_urls?.length > 0)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-500">Загрузка…</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Фотоотчёты</h1>

      {logs.length === 0 ? (
        <p className="text-slate-500">Фотоотчётов пока нет</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {logs.map((log) => (
            <article
              key={log.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="grid grid-cols-2 gap-0.5 bg-slate-100">
                {log.photo_urls.slice(0, 4).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="" className="aspect-square w-full object-cover" />
                  </a>
                ))}
              </div>
              <div className="p-3 text-sm">
                <p className="font-medium">{log.worker_full_name}</p>
                <p className="text-slate-600">
                  {log.sections?.name} · {log.sections?.objects?.name}
                </p>
                <p className="text-xs text-slate-500">
                  {formatSubmittedDate(log.submitted_at)}{' '}
                  {formatSubmittedTime(log.submitted_at)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
