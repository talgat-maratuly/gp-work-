import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { fetchObjectsWithSections, type NurseryObjectWithSections } from '@/api/objectsApi'
import {
  clearImportedProducts,
  createStockMovement,
  downloadProductsExcel,
  fetchProducts,
  fetchStockMovements,
  PRODUCT_STATUS_LABELS,
  STOCK_MOVEMENT_LABELS,
  type Product,
  type StockMovement,
  type StockMovementType,
} from '@/api/productsApi'
import { toUserMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'

type MovementForm = {
  productId: string
  type: Exclude<StockMovementType, 'IMPORT'>
  quantity: string
  workerName: string
  objectId: string
  sectionId: string
  purpose: string
  comment: string
}

const emptyMovementForm = (): MovementForm => ({
  productId: '',
  type: 'OUTCOME',
  quantity: '',
  workerName: '',
  objectId: '',
  sectionId: '',
  purpose: '',
  comment: '',
})

function fmtNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: value % 1 === 0 ? 0 : digits,
  }).format(value)
}

function statusClass(status: Product['status']): string {
  if (status === 'INACTIVE') return 'bg-slate-100 text-slate-600'
  if (status === 'OUT_OF_STOCK') return 'bg-red-100 text-red-800'
  if (status === 'LOW_STOCK') return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
}

export function WarehousePage() {
  const location = useLocation()
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [objects, setObjects] = useState<NurseryObjectWithSections[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [showMovementForm, setShowMovementForm] = useState(() =>
    location.pathname.endsWith('/issue'),
  )
  const [form, setForm] = useState<MovementForm>(emptyMovementForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )

  const selectedObject = useMemo(
    () => objects.find((o) => o.id === Number(form.objectId)) ?? null,
    [objects, form.objectId],
  )

  const availableSections = selectedObject?.sections ?? []

  async function loadProducts(nextSearch = search) {
    const data = await fetchProducts(nextSearch)
    setProducts(data)
    if (selectedProductId && !data.some((p) => p.id === selectedProductId)) {
      setSelectedProductId(null)
      setMovements([])
    }
  }

  async function loadInitial() {
    setLoading(true)
    try {
      const [p, o] = await Promise.all([fetchProducts(search), fetchObjectsWithSections()])
      setProducts(p)
      setObjects(o)
      setError(null)
    } catch (err) {
      console.error('[warehouse]', err)
      setError(toUserMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadMovements(productId: number) {
    const data = await fetchStockMovements(productId)
    setMovements(data)
  }

  useEffect(() => {
    void loadInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (location.pathname.endsWith('/issue')) {
      setShowMovementForm(true)
    }
  }, [location.pathname])

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await loadProducts(search)
    } catch (err) {
      console.error('[warehouse/search]', err)
      setError(toUserMessage(err))
    }
  }

  function startMovement(product?: Product) {
    setShowMovementForm(true)
    setForm({ ...emptyMovementForm(), productId: product ? String(product.id) : '' })
  }

  async function handleSelectProduct(product: Product) {
    setSelectedProductId(product.id)
    setError(null)
    try {
      await loadMovements(product.id)
    } catch (err) {
      console.error('[warehouse/movements]', err)
      setError(toUserMessage(err))
    }
  }

  async function handleMovementSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const movement = await createStockMovement({
        productId: Number(form.productId),
        type: form.type,
        quantity: Number(form.quantity),
        workerName: form.workerName.trim() || undefined,
        objectId: form.objectId ? Number(form.objectId) : undefined,
        sectionId: form.sectionId ? Number(form.sectionId) : undefined,
        purpose: form.purpose.trim() || undefined,
        comment: form.comment.trim() || undefined,
      })
      setForm(emptyMovementForm())
      setShowMovementForm(false)
      await loadProducts()
      setSelectedProductId(movement.productId)
      await loadMovements(movement.productId)
    } catch (err) {
      console.error('[warehouse/movement]', err)
      setError(toUserMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleExport() {
    setError(null)
    try {
      const blob = await downloadProductsExcel()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ostatki_sklad.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[warehouse/export]', err)
      setError(toUserMessage(err, 'Не удалось скачать остатки'))
    }
  }

  async function handleClearImported() {
    const confirmed = window.confirm(
      'Вы действительно хотите очистить импортированные товары? Это действие нельзя отменить.',
    )
    if (!confirmed) return
    setError(null)
    try {
      await clearImportedProducts()
      setSelectedProductId(null)
      setMovements([])
      await loadProducts()
    } catch (err) {
      console.error('[warehouse/clear-imported]', err)
      setError(toUserMessage(err, 'Не удалось очистить импортированные товары'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Склад</h1>
          <p className="mt-1 text-sm text-slate-500">
            Остаток считается как начальный остаток + приход - расход/списание.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startMovement()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white"
          >
            Выдать / списать товар
          </button>
          {user?.role === 'ADMIN' && (
            <>
              <button
                type="button"
                onClick={() => void handleExport()}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Скачать остатки Excel
              </button>
              <button
                type="button"
                onClick={() => void handleClearImported()}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                Очистить импортированные данные
              </button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 rounded-xl border bg-white p-4">
        <input
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
          placeholder="Поиск по коду, артикулу или названию"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">
          Найти
        </button>
      </form>

      {showMovementForm && (
        <form onSubmit={handleMovementSubmit} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Выдать / списать товар</h2>
            <button
              type="button"
              onClick={() => setShowMovementForm(false)}
              className="text-sm text-slate-500 underline"
            >
              Закрыть
            </button>
          </div>

          <select
            className="rounded-lg border px-3 py-2"
            value={form.productId}
            onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
            required
          >
            <option value="">— товар —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.article ? `(${p.article})` : ''}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border px-3 py-2"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MovementForm['type'] }))}
          >
            <option value="OUTCOME">Расход</option>
            <option value="WRITE_OFF">Списание</option>
            <option value="INCOME">Приход</option>
            <option value="CORRECTION">Корректировка остатка</option>
          </select>

          <input
            type="number"
            min="0.001"
            step="0.001"
            className="rounded-lg border px-3 py-2"
            placeholder={form.type === 'CORRECTION' ? 'Новый остаток *' : 'Количество *'}
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            required
          />

          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Кто забрал"
            value={form.workerName}
            onChange={(e) => setForm((f) => ({ ...f, workerName: e.target.value }))}
          />

          <select
            className="rounded-lg border px-3 py-2"
            value={form.objectId}
            onChange={(e) => setForm((f) => ({ ...f, objectId: e.target.value, sectionId: '' }))}
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
            value={form.sectionId}
            onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))}
            disabled={!form.objectId}
          >
            <option value="">— участок —</option>
            {availableSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>

          <input
            className="rounded-lg border px-3 py-2 sm:col-span-2"
            placeholder="Цель расхода"
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          />

          <textarea
            className="rounded-lg border px-3 py-2 sm:col-span-2"
            placeholder="Комментарий"
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
          />

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50 sm:col-span-2"
          >
            {submitting ? 'Сохранение…' : 'Сохранить движение'}
          </button>
        </form>
      )}

      {error && <p className="text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Код</th>
              <th className="px-3 py-2 text-left">Артикул</th>
              <th className="px-3 py-2 text-left">Название</th>
              <th className="px-3 py-2 text-left">Ед. изм.</th>
              <th className="px-3 py-2 text-right">Количество</th>
              <th className="px-3 py-2 text-right">Приход</th>
              <th className="px-3 py-2 text-right">Расход</th>
              <th className="px-3 py-2 text-right">Текущий остаток</th>
              <th className="px-3 py-2 text-right">Учетная цена</th>
              <th className="px-3 py-2 text-right">Сумма</th>
              <th className="px-3 py-2 text-left">Статус</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-slate-500">
                  Загрузка…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-slate-500">
                  Товаров пока нет. Загрузите Excel-файл в разделе «Импорт Excel».
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className={selectedProductId === p.id ? 'bg-emerald-50/50' : undefined}>
                  <td className="px-3 py-2 font-mono text-xs">{p.code ?? '—'}</td>
                  <td className="px-3 py-2">{p.article ?? '—'}</td>
                  <td className="px-3 py-2 min-w-[16rem] font-medium">{p.name}</td>
                  <td className="px-3 py-2">{p.unit ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{fmtNumber(p.currentQuantity, 3)}</td>
                  <td className="px-3 py-2 text-right">{fmtNumber(p.incomingQuantity, 3)}</td>
                  <td className="px-3 py-2 text-right">{fmtNumber(p.outgoingQuantity, 3)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtNumber(p.currentQuantity, 3)}</td>
                  <td className="px-3 py-2 text-right">{fmtNumber(p.accountingPrice)}</td>
                  <td className="px-3 py-2 text-right">{fmtNumber(p.totalAmount)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(p.status)}`}>
                      {PRODUCT_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs text-emerald-700 underline"
                        onClick={() => void handleSelectProduct(p)}
                      >
                        История
                      </button>
                      <button
                        type="button"
                        className="text-xs text-slate-700 underline"
                        onClick={() => startMovement(p)}
                      >
                        Выдать
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedProduct && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">История движения: {selectedProduct.name}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Дата</th>
                  <th className="px-3 py-2 text-left">Операция</th>
                  <th className="px-3 py-2 text-right">Количество</th>
                  <th className="px-3 py-2 text-left">Кто сделал</th>
                  <th className="px-3 py-2 text-left">Кто забрал</th>
                  <th className="px-3 py-2 text-left">Объект</th>
                  <th className="px-3 py-2 text-left">Участок</th>
                  <th className="px-3 py-2 text-left">Комментарий</th>
                  <th className="px-3 py-2 text-right">Остаток после</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                      Движений пока нет
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {format(new Date(m.createdAt), 'dd.MM.yyyy HH:mm')}
                      </td>
                      <td className="px-3 py-2">{STOCK_MOVEMENT_LABELS[m.type]}</td>
                      <td className="px-3 py-2 text-right">{fmtNumber(m.quantity, 3)}</td>
                      <td className="px-3 py-2">{m.createdBy?.fullName ?? '—'}</td>
                      <td className="px-3 py-2">{m.workerName ?? '—'}</td>
                      <td className="px-3 py-2">{m.object?.name ?? '—'}</td>
                      <td className="px-3 py-2">{m.section?.name ?? '—'}</td>
                      <td className="px-3 py-2">{m.comment || m.purpose || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtNumber(m.balanceAfter, 3)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
