import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchFieldToday, type FieldTask } from '@/api/fieldApi'
import { FieldStatus } from '@/components/field/FieldStatus'

export function FieldTasksPage() {
  const [tasks, setTasks] = useState<FieldTask[]>([])
  useEffect(() => { void fetchFieldToday().then((data) => setTasks(data.tasks)) }, [])
  return <div className="space-y-3"><div><h1 className="text-2xl font-black">Задачи</h1><p className="text-sm text-slate-500">Назначенные вам и вашей бригаде</p></div>{tasks.map((task) => <Link key={task.id} to={`/field/tasks/${task.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{task.description || task.workType?.name}</p><p className="mt-1 text-sm text-emerald-800">{task.section.object?.name}</p><p className="text-xs text-slate-500">{task.section.name}</p></div>{task.execution && <FieldStatus status={task.execution.status} />}</div></Link>)}{tasks.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-slate-500">Задач нет</p>}</div>
}
