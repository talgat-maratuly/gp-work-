export enum ScheduleStatus {
  PLANNED = 'PLANNED', // Запланировано
  ACCEPTED = 'ACCEPTED', // Принято
  IN_PROGRESS = 'IN_PROGRESS', // В работе
  DONE = 'DONE', // Выполнено
  NEEDS_REVIEW = 'NEEDS_REVIEW', // Требует проверки
  OVERDUE = 'OVERDUE', // Просрочено
  POSTPONED_RAIN = 'POSTPONED_RAIN', // Перенесено из-за дождя
  POSTPONED_REASON = 'POSTPONED_REASON', // Перенесено по причине
  CANCELLED = 'CANCELLED', // Отменено
}
