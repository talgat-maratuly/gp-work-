// Единая логика опоздания: рабочий день начинается в 09:00, опозданием считается
// приход позже порога (по умолчанию 09:05, «плюс-минус» 5 минут). Порог и часовой
// пояс настраиваются переменными окружения, чтобы и табель, и дашборд считали одинаково.
export function lateThresholdTime(): string {
  return process.env.SHIFT_LATE_AFTER || '09:05';
}

export function businessTimeZone(): string {
  return process.env.BUSINESS_TIME_ZONE || 'Asia/Oral';
}

// Локальное время прихода в формате HH:MM (для сравнения с порогом).
export function checkInLocalTime(checkInTime: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: businessTimeZone(),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(checkInTime);
}

// Опоздание: строковое сравнение «HH:MM» корректно для дополненного нулями времени.
export function isLateCheckIn(checkInTime: Date): boolean {
  return checkInLocalTime(checkInTime) > lateThresholdTime();
}
