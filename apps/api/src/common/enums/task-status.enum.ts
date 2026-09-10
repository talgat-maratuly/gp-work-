export enum TaskStatus {
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.ASSIGNED]: 'Новая',
  [TaskStatus.ACCEPTED]: 'Принята',
  [TaskStatus.IN_PROGRESS]: 'В работе',
  [TaskStatus.COMPLETED]: 'Завершена',
  [TaskStatus.VERIFIED]: 'Проверена',
  [TaskStatus.REJECTED]: 'Отклонена',
  [TaskStatus.CANCELLED]: 'Отменена',
};
