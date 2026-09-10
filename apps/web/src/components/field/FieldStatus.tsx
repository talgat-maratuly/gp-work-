import type { ExecutionStatus } from '@/api/fieldApi'

const LABELS: Record<ExecutionStatus, string> = {
  ASSIGNED: 'Назначено',
  EN_ROUTE: 'В пути',
  ARRIVED: 'Прибыл',
  STARTED: 'Начато',
  IN_PROGRESS: 'Выполняется',
  COMPLETED: 'На приёмке',
  ACCEPTED: 'Принято',
  REJECTED: 'Отклонено',
}

export function FieldStatus({ status }: { status: ExecutionStatus }) {
  const color = status === 'ACCEPTED'
    ? 'bg-emerald-100 text-emerald-800'
    : status === 'REJECTED'
      ? 'bg-red-100 text-red-800'
      : status === 'COMPLETED'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-blue-100 text-blue-800'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{LABELS[status]}</span>
}
