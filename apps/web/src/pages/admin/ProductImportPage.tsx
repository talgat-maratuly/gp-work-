import { FormEvent, useState } from 'react'
import { importProductsExcel, type ProductImportResult } from '@/api/productsApi'
import { toUserMessage } from '@/api/client'

export function ProductImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ProductImportResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runImport(fullSync: boolean) {
    if (!file) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const data = await importProductsExcel(file, { fullSync })
      setResult(data)
      setFile(null)
    } catch (err) {
      console.error('[products/import]', err)
      setError(toUserMessage(err, 'Не удалось импортировать Excel'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await runImport(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Импорт Excel</h1>
        <p className="mt-1 text-sm text-slate-500">
          Загрузите файл с товарами и остатками. Товары ищутся по коду или артикулу:
          найденные обновляются, новые создаются.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Excel-файл</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Поддерживаемые колонки:</p>
          <p className="mt-1">
            Код, Артикул, Товар/Название/Наименование, Ед. изм., Учетная цена,
            Количество, Сумма, Цена продажи, Наша цена, Проценты / наценка.
          </p>
          <p className="mt-2">
            Файл может содержать 1900+ строк. Ручной ввод товаров не требуется.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!file || submitting}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Импорт…' : 'Загрузить и импортировать'}
          </button>
          <button
            type="button"
            disabled={!file || submitting}
            onClick={() => void runImport(true)}
            className="rounded-lg border border-emerald-700 px-4 py-2 text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Полностью обновить склад из Excel
          </button>
        </div>
      </form>

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <h2 className="font-semibold text-emerald-900">Импорт завершён</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            <div className="rounded-lg bg-white p-3">
              <p className="text-slate-500">Создано</p>
              <p className="text-xl font-bold">{result.created}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-slate-500">Обновлено</p>
              <p className="text-xl font-bold">{result.updated}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-slate-500">Пропущено</p>
              <p className="text-xl font-bold">{result.skipped}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-slate-500">Всего обработано</p>
              <p className="text-xl font-bold">{result.total}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-slate-500">Неактуальные</p>
              <p className="text-xl font-bold">{result.markedInactive}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
