import type { AiAnswer } from '@/api/adminAiApi'

export function AiAnswerNotice({ result }: { result: AiAnswer }) {
  if (!result.fallback) return null
  return <p className="mt-3 text-xs text-slate-600">Ответ по данным GP Work без ИИ-модели. {result.fallbackReason === 'not_configured'
    ? 'ИИ-сервис не подключён. Для свободного диалога администратору нужно настроить подключение.'
    : 'ИИ-сервис сейчас недоступен. Пока доступны подсказки по задачам и работе в системе.'}</p>
}
