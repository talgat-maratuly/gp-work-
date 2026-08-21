import { apiDownload, apiRequest } from './client'

export type ProductSource = 'EXCEL' | 'MANUAL' | '1C'
export type ProductStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'INACTIVE'
export type StockMovementType = 'IMPORT' | 'INCOME' | 'OUTCOME' | 'WRITE_OFF' | 'CORRECTION'

export type Product = {
  id: number
  code: string | null
  article: string | null
  name: string
  unit: string | null
  accountingPrice: number
  salePrice: number
  ourPrice: number
  markupPercent: number | null
  initialQuantity: number
  incomingQuantity: number
  outgoingQuantity: number
  currentQuantity: number
  totalAmount: number
  externalId1C: string | null
  code1C: string | null
  source: ProductSource
  lastSyncAt: string | null
  isActual: boolean
  status: ProductStatus
  createdAt: string
  updatedAt: string
}

export type StockMovement = {
  id: number
  productId: number
  type: StockMovementType
  quantity: number
  createdById: number | null
  workerName: string | null
  objectId: number | null
  sectionId: number | null
  purpose: string | null
  comment: string | null
  balanceAfter: number
  createdAt: string
  product?: Product
  createdBy?: { id: number; fullName: string } | null
  object?: { id: number; name: string } | null
  section?: { id: number; name: string; code: string } | null
}

export type ProductImportResult = {
  created: number
  updated: number
  skipped: number
  markedInactive: number
  total: number
}

export type ClearImportedResult = {
  deleted: number
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  IN_STOCK: 'В наличии',
  LOW_STOCK: 'Мало осталось',
  OUT_OF_STOCK: 'Закончился',
  INACTIVE: 'Неактуальный',
}

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  IMPORT: 'Импорт',
  INCOME: 'Приход',
  OUTCOME: 'Расход',
  WRITE_OFF: 'Списание',
  CORRECTION: 'Корректировка',
}

export async function fetchProducts(search?: string): Promise<Product[]> {
  const params = new URLSearchParams()
  if (search?.trim()) params.set('search', search.trim())
  const qs = params.toString()
  return apiRequest<Product[]>(`/products${qs ? `?${qs}` : ''}`)
}

export async function fetchProduct(id: number): Promise<Product> {
  return apiRequest<Product>(`/products/${id}`)
}

export async function importProductsExcel(
  file: File,
  options: { fullSync?: boolean } = {}
): Promise<ProductImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  return apiRequest<ProductImportResult>(
    `/products/import-excel${options.fullSync ? '?fullSync=true' : ''}`,
    {
    method: 'POST',
    body: formData,
    }
  )
}

export async function clearImportedProducts(): Promise<ClearImportedResult> {
  return apiRequest<ClearImportedResult>('/products/imported', { method: 'DELETE' })
}

export async function createStockMovement(payload: {
  productId: number
  type: Exclude<StockMovementType, 'IMPORT'>
  quantity: number
  workerName?: string
  objectId?: number
  sectionId?: number
  purpose?: string
  comment?: string
}): Promise<StockMovement> {
  return apiRequest<StockMovement>('/stock-movements', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchStockMovements(productId?: number): Promise<StockMovement[]> {
  const params = new URLSearchParams()
  if (productId) params.set('productId', String(productId))
  const qs = params.toString()
  return apiRequest<StockMovement[]>(`/stock-movements${qs ? `?${qs}` : ''}`)
}

export async function downloadProductsExcel(): Promise<Blob> {
  return apiDownload('/products/export.xlsx')
}
