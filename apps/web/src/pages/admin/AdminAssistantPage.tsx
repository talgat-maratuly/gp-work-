import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { askAdminAi, type AiAnswer } from '@/api/adminAiApi'
import { toUserMessage } from '@/api/client'

const questions = [
  'Какие задачи просрочены?',
  'Кто сегодня не ушел?',
  'Какие товары заканчиваются?',
  'Какие участки давно не обслуживались?',
]

export function AdminAssistantPage() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<AiAnswer | null>(null)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!question.trim() || asking) return
    setAsking(true)
    setError(null)
    setResult(null)
    try {
      setResult(await askAdminAi(question.trim()))
    } catch (error) {
      setError(toUserMessage(error, 'Не удалось получить ответ. Повторите вопрос.'))
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="rounded-2xl bg-gradient-to-br from-blue-700 to-emerald-800 p-5 text-white">
        <h1 className="text-2xl font-bold">ИИ-ассистент</h1>
        <p className="mt-2 text-sm text-white/90">Вопросы по задачам, сотрудникам, рабочим дням и материалам GP Work.</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="admin-assistant-question" className="block font-semibold">Ваш вопрос</label>
          <textarea id="admin-assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)}
            placeholder="Например: какие задачи требуют внимания сегодня?" maxLength={1000}
            className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2" />
          <button type="submit" disabled={asking || !question.trim()}
            className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {asking ? 'Думаю…' : 'Спросить'}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {questions.map((sample) => <button key={sample} type="button" onClick={() => setQuestion(sample)}
            className="rounded-full bg-slate-100 px-3 py-2 text-left text-sm text-slate-700">{sample}</button>)}
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {result && <section aria-label="Ответ ассистента" aria-live="polite" className="mt-5 rounded-xl bg-blue-50 p-4">
          <p className="whitespace-pre-wrap text-sm text-blue-950">{result.answer}</p>
          {result.fallback && <p className="mt-3 text-xs text-slate-600">Ответ сформирован по данным GP Work без ИИ-модели: она сейчас недоступна.</p>}
        </section>}
      </section>
      <p className="text-sm text-slate-600">Ассистент отвечает по доступным данным. Общая сводка и риски — в <Link to="/admin/ai-director" className="font-semibold text-blue-700 underline">ИИ-директоре</Link>.</p>
    </div>
  )
}
