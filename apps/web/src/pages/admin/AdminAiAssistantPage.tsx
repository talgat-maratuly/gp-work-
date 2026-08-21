import { FormEvent, useEffect, useState } from 'react'
import {
  ADMIN_AI_RISK_LABELS,
  askAdminAi,
  fetchAdminAiRisks,
  fetchAdminAiSummary,
  type AdminAiRisk,
  type AdminAiRiskLevel,
  type AdminAiSummary,
} from '@/api/adminAiApi'
import { toUserMessage } from '@/api/client'

const DISCLAIMER =
  'AI-помощник помогает анализировать данные, но окончательное решение принимает администратор.'

function riskClass(level: AdminAiRiskLevel): string {
  if (level === 'URGENT') return 'border-red-300 bg-red-50 text-red-900'
  if (level === 'HIGH') return 'border-orange-200 bg-orange-50 text-orange-900'
  if (level === 'MEDIUM') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-200 bg-slate-50 text-slate-800'
}

export function AdminAiAssistantPage() {
  const [summary, setSummary] = useState<AdminAiSummary | null>(null)
  const [risks, setRisks] = useState<AdminAiRisk[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([fetchAdminAiSummary(), fetchAdminAiRisks()])
      .then(([summaryData, riskData]) => {
        setSummary(summaryData)
        setRisks(riskData)
      })
      .catch((err) => {
        console.error('[admin-ai]', err)
        setError(toUserMessage(err))
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleQuestion(e: FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    setAsking(true)
    setError(null)
    try {
      const result = await askAdminAi(question.trim())
      setAnswer(result.answer)
    } catch (err) {
      console.error('[admin-ai/question]', err)
      setError(toUserMessage(err, 'Не удалось получить ответ AI-помощника'))
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI-помощник администратора</h1>
        <p className="mt-1 text-sm text-slate-500">
          Управленческая сводка по людям, задачам, табелю, складу, отчетам и рискам питомника.
        </p>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Загрузка…</p>
      ) : summary ? (
        <>
          <section className="rounded-xl border bg-white p-4">
            <h2 className="text-lg font-semibold">Ежедневная сводка</h2>
            <p className="mt-2 text-sm text-slate-700">{summary.summary}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Работ сегодня</p>
                <p className="text-2xl font-bold">{summary.completedWorksToday}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Сотрудников вышло</p>
                <p className="text-2xl font-bold">{summary.employeesCheckedInToday}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Просроченных задач</p>
                <p className="text-2xl font-bold">{summary.overdueTasks}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Отчетов на проверке</p>
                <p className="text-2xl font-bold">{summary.reportsPendingReview}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h2 className="text-lg font-semibold">Проблемы и риски</h2>
            {risks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Критичных рисков не найдено.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {risks.slice(0, 20).map((risk, idx) => (
                  <article key={`${risk.title}-${idx}`} className={`rounded-lg border p-3 ${riskClass(risk.level)}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-white/70 px-2 py-0.5 text-xs font-semibold">
                        {ADMIN_AI_RISK_LABELS[risk.level]}
                      </span>
                      <span className="text-xs opacity-70">{risk.source}</span>
                    </div>
                    <h3 className="mt-2 font-semibold">{risk.title}</h3>
                    <p className="mt-1 text-sm">{risk.description}</p>
                    <p className="mt-2 text-sm font-medium">Рекомендация: {risk.recommendation}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h2 className="text-lg font-semibold">Рекомендации</h2>
            {summary.recommendations.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Рекомендаций пока нет.</p>
            ) : (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {[...new Set(summary.recommendations)].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h2 className="text-lg font-semibold">Вопрос к AI</h2>
            <form onSubmit={handleQuestion} className="mt-3 flex flex-col gap-3 md:flex-row">
              <input
                className="min-w-0 flex-1 rounded-lg border px-3 py-2"
                placeholder="Например: кто сегодня не ушел?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button
                type="submit"
                disabled={asking || !question.trim()}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
              >
                {asking ? 'Думаю…' : 'Спросить'}
              </button>
            </form>
            {answer && (
              <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                {answer}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {[
                'Кто сегодня не ушел?',
                'Какие участки давно не обслуживались?',
                'Какие товары заканчиваются?',
                'Кто сделал больше всего работ за неделю?',
                'Какие задачи просрочены?',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setQuestion(sample)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
                >
                  {sample}
                </button>
              ))}
            </div>
          </section>

          <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">{DISCLAIMER}</p>
        </>
      ) : null}
    </div>
  )
}
