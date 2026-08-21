import { useState } from 'react'
import { runSeed, type SeedResult } from '@/api/seedApi'
import { toUserMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'

export function SeedPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SeedResult | null>(null)

  async function handleRun() {
    setLoading(true)
    setError(null)
    try {
      const data = await runSeed()
      setResult(data)
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось запустить seed'))
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Seed запуск</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <p className="text-sm text-slate-600">
          Добавляет стандартные виды работ (Полив, Прополка, Обрезка и др.) и счётчик кодов
          участков, если их ещё нет. Повторный запуск безопасен — существующие данные не
          перезаписываются.
        </p>

        <Button type="button" onClick={handleRun} disabled={loading}>
          {loading ? 'Запуск…' : 'Запустить seed'}
        </Button>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {result && (
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 space-y-1">
            <p className="font-medium">{result.message}</p>
            <p>Добавлено видов работ: {result.workTypesCreated}</p>
            <p>Уже было: {result.workTypesSkipped}</p>
            <p>
              Счётчик участков инициализирован:{' '}
              {result.counterInitialized ? 'да' : 'нет (уже был)'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
