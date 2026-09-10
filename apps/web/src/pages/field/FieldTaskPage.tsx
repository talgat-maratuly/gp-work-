import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { fetchFieldToday, type FieldTask } from '@/api/fieldApi'

export function FieldTaskPage() {
  const taskId = Number(useParams().taskId)
  const [task, setTask] = useState<FieldTask | null | undefined>(undefined)
  useEffect(() => { void fetchFieldToday().then((data) => setTask(data.tasks.find((item) => item.id === taskId) ?? null)) }, [taskId])
  if (task === undefined) return <p className="py-16 text-center text-slate-500">Загрузка…</p>
  if (!task) return <p className="rounded-2xl bg-red-50 p-4 text-red-800">Задача не найдена или не назначена вашей бригаде.</p>
  if (task.execution) return <Navigate to={`/field/executions/${task.execution.id}`} replace />
  return <div className="space-y-4"><div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Задача #{task.id}</p><h1 className="mt-2 text-2xl font-black">{task.description || task.workType?.name}</h1><p className="mt-3 font-bold text-emerald-800">{task.section.object?.name}</p><p className="text-slate-500">{task.section.name} · QR {task.section.code}</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Для начала необходимо прибыть на объект, отсканировать QR и подтвердить геолокацию.</div><Link to={`/field/qr?taskId=${task.id}`} className="block rounded-xl bg-emerald-700 py-4 text-center font-bold text-white">Подтвердить прибытие</Link></div>
}
