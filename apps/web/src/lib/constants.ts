export const OTHER_WORK_TYPE = 'Другое'

export const QUICK_FILTERS = [
  { id: 'today', label: 'Сегодня' },
  { id: 'yesterday', label: 'Вчера' },
  { id: 'week', label: 'Текущая неделя' },
  { id: 'month', label: 'Текущий месяц' },
] as const

export type QuickFilterId = (typeof QUICK_FILTERS)[number]['id']
