export enum DecisionStatus {
  OPEN = 'OPEN', // Открыто
  IN_PROGRESS = 'IN_PROGRESS', // В работе
  ROUTED_TO_TASK = 'ROUTED_TO_TASK', // Переведено в задачу
  DONE = 'DONE', // Выполнено
  CANCELLED = 'CANCELLED', // Отменено
}

export enum DecisionPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}
