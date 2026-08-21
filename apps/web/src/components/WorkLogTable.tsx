import { formatSubmittedDate, formatSubmittedTime } from '@/lib/dateFilters'
import { workTypeLabel } from '@/lib/workLogDisplay'
import { buildMapLink, buildWorkFormUrlBySectionCode } from '@/lib/appConfig'
import { REVIEW_STATUS_LABELS } from '@/lib/workLogsApi'
import type { WorkLog } from '@/lib/types'

interface Props {
  logs: WorkLog[]
  loading?: boolean
  canReview?: boolean
  onReview?: (log: WorkLog, status: 'APPROVED' | 'REJECTED') => void
}

export function WorkLogTable({ logs, loading, canReview, onReview }: Props) {
  if (loading) {
    return <p className="py-8 text-center text-slate-500">Загрузка…</p>
  }

  if (!logs.length) {
    return <p className="py-8 text-center text-slate-500">Записей не найдено</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-3">Дата</th>
            <th className="px-3 py-3">Время</th>
            <th className="px-3 py-3">ФИО</th>
            <th className="px-3 py-3">Объект</th>
            <th className="px-3 py-3">Участок</th>
            <th className="px-3 py-3">Культура</th>
            <th className="px-3 py-3">Вид работы</th>
            <th className="px-3 py-3">Процент выполнения</th>
            <th className="px-3 py-3">Комментарий</th>
            <th className="px-3 py-3">Фото</th>
            <th className="px-3 py-3">Геолокация</th>
            <th className="px-3 py-3">Проверка</th>
            {canReview && <th className="px-3 py-3">Действия</th>}
            <th className="px-3 py-3">Ссылка на QR-форму</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => {
            const hasGeo = log.latitude != null && log.longitude != null
            const mapHref =
              log.map_url ??
              (hasGeo ? buildMapLink(log.latitude!, log.longitude!) : null)
            const sectionCode = log.sections?.code
            return (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatSubmittedDate(log.submitted_at)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatSubmittedTime(log.submitted_at)}
                </td>
                <td className="px-3 py-2">{log.worker_full_name}</td>
                <td className="px-3 py-2">{log.sections?.objects?.name ?? '—'}</td>
                <td className="px-3 py-2">{log.sections?.name ?? '—'}</td>
                <td className="px-3 py-2">{log.sections?.culture ?? '—'}</td>
                <td className="px-3 py-2">{workTypeLabel(log)}</td>
                <td className="px-3 py-2 max-w-[140px]">{log.work_volume}</td>
                <td className="px-3 py-2 max-w-[180px]">{log.comment}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(log.photo_urls || []).map((url, i) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 underline"
                      >
                        фото {i + 1}
                      </a>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {hasGeo && mapHref ? (
                    <div className="space-y-0.5">
                      <a
                        href={mapHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                      >
                        Открыть на карте
                      </a>
                      {log.geo_accuracy != null && (
                        <p className="text-xs text-slate-500">±{Math.round(log.geo_accuracy)} м</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500">Геолокация не разрешена</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        log.review_status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.review_status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {REVIEW_STATUS_LABELS[log.review_status]}
                    </span>
                    {log.review_comment && (
                      <p className="text-xs text-slate-500">{log.review_comment}</p>
                    )}
                  </div>
                </td>
                {canReview && (
                  <td className="px-3 py-2">
                    {log.review_status === 'PENDING' && onReview ? (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="text-xs text-emerald-700 underline"
                          onClick={() => onReview(log, 'APPROVED')}
                        >
                          Подтвердить
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-600 underline"
                          onClick={() => onReview(log, 'REJECTED')}
                        >
                          Отклонить
                        </button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
                <td className="px-3 py-2">
                  {sectionCode ? (
                    <a
                      href={buildWorkFormUrlBySectionCode(sectionCode)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 underline break-all"
                    >
                      открыть форму
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
