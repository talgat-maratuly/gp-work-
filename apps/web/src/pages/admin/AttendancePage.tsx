import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  ATTENDANCE_STATUS_LABELS,
  fetchAttendance,
  type AttendanceRecord,
} from '@/api/attendanceApi'
import { toUserMessage } from '@/api/client'
import { formatSubmittedTime, toDateInput } from '@/lib/dateFilters'
import { buildMapLink } from '@/lib/appConfig'

function GeoLink({ lat, lng, label }: { lat: number | null; lng: number | null; label: string }) {
  if (lat == null || lng == null) return <span className="text-slate-400">—</span>
  return (
    <a
      href={buildMapLink(lat, lng)}
      target="_blank"
      rel="noreferrer"
      className="text-emerald-700 underline"
    >
      {label}
    </a>
  )
}

export function AttendancePage() {
  const today = toDateInput(new Date())
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [workerName, setWorkerName] = useState('')
  const [rows, setRows] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAttendance({
        dateFrom,
        dateTo,
        workerFullName: workerName.trim() || undefined,
      })
      setRows(data)
      setError(null)
    } catch (err) {
      console.error('[attendance]', err)
      setError(toUserMessage(err))
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, workerName])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Табель</h1>
        <p className="mt-1 text-sm text-slate-500">
          Приход фиксируется первым QR-отчётом за день. Уход — через общий QR «Уход».
        </p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">С</label>
          <input
            type="date"
            className="rounded-lg border px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">По</label>
          <input
            type="date"
            className="rounded-lg border px-3 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block text-xs text-slate-500">ФИО</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Поиск по ФИО"
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white"
          >
            Обновить
          </button>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Дата</th>
              <th className="px-3 py-2 text-left">ФИО</th>
              <th className="px-3 py-2 text-left">Приход</th>
              <th className="px-3 py-2 text-left">Последняя активность</th>
              <th className="px-3 py-2 text-left">Уход</th>
              <th className="px-3 py-2 text-left">Часов</th>
              <th className="px-3 py-2 text-left">Отчётов</th>
              <th className="px-3 py-2 text-left">Статус</th>
              <th className="px-3 py-2 text-left">Гео прихода</th>
              <th className="px-3 py-2 text-left">Гео ухода</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                  Записей нет
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {format(parseISO(r.workDate), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.workerFullName}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatSubmittedTime(r.checkInTime)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatSubmittedTime(r.lastActivityTime)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.checkOutTime ? formatSubmittedTime(r.checkOutTime) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {r.workedHours != null ? r.workedHours.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2">{r.reportCount}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === 'COMPLETED'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {ATTENDANCE_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <GeoLink lat={r.checkInLatitude} lng={r.checkInLongitude} label="Карта" />
                  </td>
                  <td className="px-3 py-2">
                    <GeoLink lat={r.checkOutLatitude} lng={r.checkOutLongitude} label="Карта" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
