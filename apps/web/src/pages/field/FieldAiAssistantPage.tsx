import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { askWorkerAi, fetchWorkerAiBrief, type WorkerAiBrief } from '@/api/adminAiApi'
import { toUserMessage } from '@/api/client'

const samples = [
  'Что мне делать сейчас?',
  'Как правильно начать рабочий день?',
  'Что нужно сделать перед уходом?',
]

export function FieldAiAssistantPage() {
  const [brief, setBrief] = useState<WorkerAiBrief | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchWorkerAiBrief()
      .then(setBrief)
      .catch((err) => setError(toUserMessage(err, 'Не удалось загрузить подсказки')))
      .finally(() => setLoading(false))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    setAsking(true)
    setError(null)
    try {
      const result = await askWorkerAi(question.trim())
      setAnswer(result.answer)
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось получить ответ ИИ-ассистента'))
    } finally {
      setAsking(false)
    }
  }

  if (loading) return <p className="py-16 text-center text-slate-500">ИИ‑ассистент изучает рабочий день…</p>

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-blue-700 to-emerald-800 p-5 text-white shadow-lg">
        <p className="text-sm text-blue-100">Ваш помощник</p>
        <h1 className="mt-1 text-2xl font-black">ИИ‑ассистент</h1>
        <p className="mt-3 text-sm text-white/90">{brief?.summary ?? 'Данные рабочего дня пока недоступны.'}</p>
      </section>

      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}

      {brief && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-2xl font-bold">{brief.metrics.total}</p><p className="text-xs text-slate-500">Задач</p></div>
            <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-2xl font-bold text-blue-700">{brief.metrics.active}</p><p className="text-xs text-slate-500">В работе</p></div>
            <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-2xl font-bold text-red-700">{brief.metrics.problems}</p><p className="text-xs text-slate-500">Проблем</p></div>
          </div>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-bold">Что делать дальше</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-700">
              {brief.recommendations.map((item, index) => (
                <li key={item} className="flex gap-3"><span className="font-bold text-emerald-700">{index + 1}</span><span>{item}</span></li>
              ))}
            </ol>
          </section>

          {brief.tasks[0] && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Ближайшая задача</p>
              <h2 className="mt-2 font-bold text-slate-900">{brief.tasks[0].title}</h2>
              <p className="mt-1 text-sm text-slate-600">{brief.tasks[0].objectName} · {brief.tasks[0].sectionName}</p>
              <p className="mt-3 text-sm font-medium text-emerald-900">{brief.tasks[0].nextAction}</p>
              <Link to={`/field/tasks/${brief.tasks[0].id}`} className="mt-3 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Открыть задачу</Link>
            </section>
          )}
        </>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">Спросить ассистента</h2>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Напишите вопрос о своей работе"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="submit" disabled={asking || !question.trim()} className="w-full rounded-xl bg-blue-700 py-3 font-bold text-white disabled:opacity-50">
            {asking ? 'Думаю…' : 'Спросить'}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {samples.map((sample) => <button key={sample} type="button" onClick={() => setQuestion(sample)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">{sample}</button>)}
        </div>
        {answer && <div className="mt-4 whitespace-pre-wrap rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{answer}</div>}
      </section>

      <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">ИИ‑ассистент подсказывает по вашим данным, но не меняет задачи и решения руководителя.</p>
    </div>
  )
}
