import { formatSubmittedDate, formatSubmittedTime } from '@/lib/dateFilters'
import { buildMapLink } from '@/lib/appConfig'
import { sectionLabel, workTypeLabel } from '@/lib/workLogDisplay'
import type { WorkLog } from '@/lib/types'

interface Props {
  log: WorkLog | null
}

export function WorkMapDetail({ log }: Props) {
  if (!log) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Нажмите на точку на карте, чтобы увидеть отчёт о работе
      </div>
    )
  }

  const hasGeo = log.latitude != null && log.longitude != null
  const mapHref =
    log.map_url ??
    (hasGeo ? buildMapLink(log.latitude!, log.longitude!) : null)

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {log.photo_urls?.length > 0 && (
        <div className="grid grid-cols-2 gap-0.5 bg-slate-100 sm:grid-cols-3">
          {log.photo_urls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt=""
                className="aspect-square w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}

      <div className="space-y-3 p-4 text-sm">
        <h2 className="text-lg font-bold text-slate-900">{log.worker_full_name}</h2>

        <dl className="space-y-2">
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Участок</dt>
            <dd className="text-slate-800">{sectionLabel(log)}</dd>
            {log.sections?.code && (
              <dd className="font-mono text-xs text-slate-500">{log.sections.code}</dd>
            )}
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Вид работы</dt>
            <dd className="text-slate-800">{workTypeLabel(log)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Дата</dt>
            <dd className="text-slate-800">
              {formatSubmittedDate(log.submitted_at)}{' '}
              <span className="text-slate-500">{formatSubmittedTime(log.submitted_at)}</span>
            </dd>
          </div>
          {log.comment?.trim() && (
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Комментарий</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{log.comment}</dd>
            </div>
          )}
        </dl>

        {!log.photo_urls?.length && (
          <p className="text-slate-500">Фото не приложены</p>
        )}

        {mapHref && (
          <a
            href={mapHref}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            Открыть в Google Maps
          </a>
        )}
      </div>
    </article>
  )
}
