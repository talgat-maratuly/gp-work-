import { FormEvent, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  AI_STATUS_LABELS,
  createAiAnalysis,
  fetchAiAgronomStats,
  fetchAiAnalyses,
  type AiAgronomAnalysis,
  type AiAgronomStats,
} from '@/api/aiAgronomApi'
import { fetchObjectsWithSections, type NurseryObjectWithSections } from '@/api/objectsApi'
import { toUserMessage } from '@/api/client'
import { uploadWorkPhotos } from '@/api/uploadsApi'

const DISCLAIMER =
  'AI-анализ носит рекомендательный характер и не заменяет профессиональное заключение агронома.'

function statusClass(status: AiAgronomAnalysis['status']) {
  if (status === 'CRITICAL' || status === 'BAD') return 'border-red-200 bg-red-50 text-red-900'
  if (status === 'AVERAGE') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-emerald-200 bg-emerald-50 text-emerald-900'
}

function yesNo(value: boolean) {
  return value ? 'Да' : 'Нет'
}

export function AiAgronomPage() {
  const [objects, setObjects] = useState<NurseryObjectWithSections[]>([])
  const [analyses, setAnalyses] = useState<AiAgronomAnalysis[]>([])
  const [stats, setStats] = useState<AiAgronomStats | null>(null)
  const [objectId, setObjectId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [culture, setCulture] = useState('')
  const [comment, setComment] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [result, setResult] = useState<AiAgronomAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedObject = useMemo(
    () => objects.find((o) => o.id === Number(objectId)) ?? null,
    [objects, objectId],
  )

  const sections = selectedObject?.sections ?? []

  useEffect(() => {
    void Promise.all([fetchObjectsWithSections(), fetchAiAnalyses(), fetchAiAgronomStats()])
      .then(([objectRows, analysisRows, statRows]) => {
        setObjects(objectRows)
        setAnalyses(analysisRows)
        setStats(statRows)
      })
      .catch((err) => {
        console.error('[ai-agronom]', err)
        setError(toUserMessage(err))
      })
      .finally(() => setLoading(false))
  }, [])

  function handleObjectChange(value: string) {
    setObjectId(value)
    setSectionId('')
    setCulture('')
  }

  function handleSectionChange(value: string) {
    setSectionId(value)
    const section = sections.find((s) => s.id === Number(value))
    setCulture(section?.culture ?? '')
  }

  async function refreshHistory() {
    const [analysisRows, statRows] = await Promise.all([fetchAiAnalyses(), fetchAiAgronomStats()])
    setAnalyses(analysisRows)
    setStats(statRows)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!objectId || !photo) return
    setSubmitting(true)
    setError(null)
    try {
      const [photoUrl] = await uploadWorkPhotos([photo])
      const analysis = await createAiAnalysis({
        objectId: Number(objectId),
        sectionId: sectionId ? Number(sectionId) : undefined,
        culture: culture.trim() || undefined,
        photoUrl,
        agronomistComment: comment.trim() || undefined,
      })
      setResult(analysis)
      setPhoto(null)
      setComment('')
      await refreshHistory()
    } catch (err) {
      console.error('[ai-agronom/analyze]', err)
      setError(toUserMessage(err, 'Не удалось выполнить AI-анализ'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🌿 AI-Агроном</h1>
        <p className="mt-1 text-sm text-slate-500">
          Инструмент для администратора и агронома: анализ фото растений, рекомендации и история осмотров.
        </p>
      </div>

      {stats && (
        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Всего анализов</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Здоровые</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.healthy}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Требуют внимания</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{stats.attention}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Проблемные</p>
            <p className="mt-1 text-2xl font-bold text-red-700">{stats.problem}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Частые проблемы</p>
            <p className="mt-1 text-sm font-medium">
              {stats.problemObjects.map((o) => `${o.objectName}: ${o.count}`).join(', ') || '—'}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2">
        <select
          className="rounded-lg border px-3 py-2"
          value={objectId}
          onChange={(e) => handleObjectChange(e.target.value)}
          required
        >
          <option value="">— объект —</option>
          {objects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border px-3 py-2"
          value={sectionId}
          onChange={(e) => handleSectionChange(e.target.value)}
          disabled={!objectId}
        >
          <option value="">— участок —</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>

        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Культура"
          value={culture}
          onChange={(e) => setCulture(e.target.value)}
        />

        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="rounded-lg border px-3 py-2 text-sm"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          required
        />

        <textarea
          className="rounded-lg border px-3 py-2 md:col-span-2"
          placeholder="Комментарий агронома (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !objectId || !photo}
          className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50 md:col-span-2"
        >
          {submitting ? 'Анализ…' : '🔍 Проанализировать'}
        </button>
      </form>

      {result && (
        <section className={`rounded-xl border p-5 ${statusClass(result.status)}`}>
          <h2 className="text-xl font-bold">AI-анализ</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
            <img src={result.photoUrl} alt="AI анализ" className="h-40 w-40 rounded-lg object-cover" />
            <div>
              <p className="text-lg font-semibold">Состояние: {AI_STATUS_LABELS[result.status]}</p>
              <p className="mt-1">Вероятность определения: {result.confidence}%</p>
              <p className="mt-1">Общее здоровье растения: {result.healthPercent}%</p>
              <p className="mt-1">Стадия роста: {result.growthStage || 'не определена'}</p>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <p>Признаки засухи: {yesNo(result.droughtSigns)}</p>
                <p>Признаки ожога: {yesNo(result.burnSigns)}</p>
                <p>Сорняки: {yesNo(result.weedsPresent)}</p>
                <p>Болезни: {yesNo(result.diseaseSigns)}</p>
                <p>Вредители: {yesNo(result.pestSigns)}</p>
                <p>Пожелтение листьев: {yesNo(result.yellowingLeaves)}</p>
                <p>Дефицит питания: {yesNo(result.nutritionDeficiency)}</p>
                <p>Механические повреждения: {yesNo(result.mechanicalDamage)}</p>
              </div>
              <h3 className="mt-4 font-semibold">AI-комментарий</h3>
              <p className="mt-1 text-sm">{result.aiComment}</p>
              <h3 className="mt-4 font-semibold">AI-рекомендации</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {result.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {result.modelName && (
                <p className="mt-4 text-xs opacity-70">Модель: {result.modelName}</p>
              )}
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-white/70 p-3 text-sm">{DISCLAIMER}</p>
        </section>
      )}

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">История AI-анализов</h2>
        {loading ? (
          <p className="mt-4 text-slate-500">Загрузка…</p>
        ) : analyses.length === 0 ? (
          <p className="mt-4 text-slate-500">Анализов пока нет</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Дата</th>
                  <th className="px-3 py-2 text-left">Агроном</th>
                  <th className="px-3 py-2 text-left">Объект</th>
                  <th className="px-3 py-2 text-left">Участок</th>
                  <th className="px-3 py-2 text-left">Фото</th>
                  <th className="px-3 py-2 text-left">Заключение</th>
                  <th className="px-3 py-2 text-left">Рекомендации</th>
                  <th className="px-3 py-2 text-left">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analyses.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm')}
                    </td>
                    <td className="px-3 py-2">{row.createdBy?.fullName ?? '—'}</td>
                    <td className="px-3 py-2">{row.object?.name ?? '—'}</td>
                    <td className="px-3 py-2">{row.section?.name ?? '—'}</td>
                    <td className="px-3 py-2">
                      <a href={row.photoUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
                        Фото
                      </a>
                    </td>
                    <td className="px-3 py-2">{AI_STATUS_LABELS[row.status]}</td>
                    <td className="px-3 py-2">{row.recommendations.join(', ')}</td>
                    <td className="px-3 py-2">{row.agronomistComment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{DISCLAIMER}</p>
      </section>
    </div>
  )
}
