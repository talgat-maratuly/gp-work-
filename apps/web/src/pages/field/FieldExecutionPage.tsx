import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  addExecutionPhotos,
  captureFace,
  completeExecution,
  fetchExecution,
  newClientId,
  saveExecutionChecklist,
  startExecution,
  type FieldExecution,
  type WorkPhoto,
} from '@/api/fieldApi'
import { toUserMessage } from '@/api/client'
import { uploadWorkPhotos } from '@/api/uploadsApi'
import { FieldStatus } from '@/components/field/FieldStatus'
import { useGeolocation } from '@/hooks/useGeolocation'
import { queuePhoto, queueRequest } from '@/offline/queue'
import { createStockMovement, fetchProducts, type Product } from '@/api/productsApi'

export function FieldExecutionPage() {
  const id = Number(useParams().id)
  const [execution, setExecution] = useState<FieldExecution | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [materialProductId, setMaterialProductId] = useState('')
  const [materialQuantity, setMaterialQuantity] = useState('')
  const { requestGeolocation } = useGeolocation()
  const load = useCallback(async () => { try { setExecution(await fetchExecution(id)) } catch (error) { setMessage(toUserMessage(error)) } }, [id])
  useEffect(() => { void load() }, [load])
  useEffect(() => { void fetchProducts().then(setProducts).catch(() => undefined) }, [])

  const completedIds = useMemo(() => new Set(execution?.checklist.filter((item) => item.isCompleted).map((item) => item.itemId) ?? []), [execution])
  const before = execution?.photos.filter((photo) => photo.phase === 'BEFORE') ?? []
  const after = execution?.photos.filter((photo) => photo.phase === 'AFTER') ?? []
  const face = execution?.faceVerifications[0]
  const materials = execution?.materials ?? []

  async function uploadPhotos(event: ChangeEvent<HTMLInputElement>, phase: 'BEFORE' | 'AFTER') {
    const files = Array.from(event.target.files ?? [])
    if (!files.length || !execution) return
    setBusy(true)
    setMessage(null)
    const geo = await requestGeolocation()
    try {
      if (!navigator.onLine) {
        const optimistic: WorkPhoto[] = []
        for (const file of files) {
          const clientPhotoId = newClientId()
          await queuePhoto({ executionId: execution.id, clientPhotoId, phase, file, fileName: file.name, capturedAt: new Date().toISOString(), latitude: geo.latitude ?? undefined, longitude: geo.longitude ?? undefined })
          optimistic.push({ id: -Date.now(), clientPhotoId, phase, url: URL.createObjectURL(file), capturedAt: new Date().toISOString() })
        }
        setExecution({ ...execution, photos: [...execution.photos, ...optimistic] })
        setMessage('Фото сохранено на телефоне и будет отправлено при появлении сети.')
      } else {
        const urls = await uploadWorkPhotos(files)
        setExecution(await addExecutionPhotos(execution.id, { photos: urls.map((url) => ({ clientPhotoId: newClientId(), phase, url, capturedAt: new Date().toISOString(), latitude: geo.latitude, longitude: geo.longitude })) }))
      }
    } catch (error) { setMessage(toUserMessage(error, 'Не удалось сохранить фото')) } finally { setBusy(false); event.target.value = '' }
  }

  async function faceCapture(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length || !execution) return
    if (!navigator.onLine) { setMessage('Первичная Face verification требует интернет. Фото работы можно продолжать сохранять offline.'); return }
    setBusy(true)
    try {
      const urls = await uploadWorkPhotos(files)
      setExecution(await captureFace(execution.id, { clientOperationId: newClientId(), selfieUrl: urls[0], livenessEvidenceUrls: urls }))
      setMessage('Face evidence отправлено руководителю на подтверждение.')
    } catch (error) { setMessage(toUserMessage(error)) } finally { setBusy(false); event.target.value = '' }
  }

  async function action(path: string, body: Record<string, unknown>, optimistic: FieldExecution['status']) {
    if (!execution) return
    setBusy(true)
    setMessage(null)
    try {
      if (!navigator.onLine) {
        await queueRequest(path, 'POST', body)
        setExecution({ ...execution, status: optimistic })
        setMessage('Действие сохранено offline и ожидает синхронизации.')
      } else {
        const result = optimistic === 'STARTED'
          ? await startExecution(execution.id, body)
          : await completeExecution(execution.id, body)
        setExecution(result)
      }
    } catch (error) { setMessage(toUserMessage(error)) } finally { setBusy(false) }
  }

  async function saveChecklist(itemId: number, checked: boolean) {
    if (!execution) return
    const answers = execution.availableChecklist.map((item) => ({ itemId: item.id, isCompleted: item.id === itemId ? checked : completedIds.has(item.id) }))
    const body = { clientOperationId: newClientId(), answers }
    if (!navigator.onLine) {
      await queueRequest(`/field/executions/${execution.id}/checklist`, 'POST', body)
      setExecution({ ...execution, status: 'IN_PROGRESS', checklist: answers.map((answer, index) => ({ id: -(index + 1), itemId: answer.itemId, isCompleted: answer.isCompleted, comment: null })) })
      setMessage('Чек-лист сохранён offline.')
      return
    }
    try { setExecution(await saveExecutionChecklist(execution.id, body)) } catch (error) { setMessage(toUserMessage(error)) }
  }

  async function issueMaterial() {
    if (!execution || !materialProductId || Number(materialQuantity) <= 0) return
    const product = products.find((row) => row.id === Number(materialProductId))
    const body = {
      productId: Number(materialProductId),
      type: 'OUTCOME',
      quantity: Number(materialQuantity),
      objectId: execution.section.object?.id,
      sectionId: execution.section.id,
      taskId: execution.task.id,
      brigadeId: execution.task.brigade?.id,
      executionId: execution.id,
      clientOperationId: newClientId(),
      purpose: `Работа #${execution.task.id}`,
    } as const
    setBusy(true); setMessage(null)
    try {
      if (!navigator.onLine) {
        await queueRequest('/stock-movements', 'POST', body)
        setExecution({
          ...execution,
          materials: [...(execution.materials ?? []), {
            id: -Date.now(), productId: body.productId, type: body.type,
            quantity: String(body.quantity), balanceAfter: '', createdAt: new Date().toISOString(),
            product: product ? { id: product.id, name: product.name, unit: product.unit } : undefined,
          }],
        })
        setMessage('Материал сохранён offline и будет списан один раз после синхронизации.')
      } else {
        await createStockMovement(body)
        await load()
      }
      setMaterialProductId(''); setMaterialQuantity('')
    } catch (error) { setMessage(toUserMessage(error, 'Не удалось списать материал')) } finally { setBusy(false) }
  }

  if (!execution) return <p className="py-16 text-center text-slate-500">Загрузка выполнения…</p>
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Работа #{execution.task.id}</p><FieldStatus status={execution.status} /></div><h1 className="mt-3 text-xl font-black">{execution.task.description || execution.task.workType?.name}</h1><p className="mt-2 font-bold text-emerald-800">{execution.section.object?.name}</p><p className="text-sm text-slate-500">{execution.section.name}{execution.arrivalDistanceMeters != null ? ` · прибытие ${Math.round(execution.arrivalDistanceMeters)} м от точки` : ''}</p></section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><div><h2 className="font-bold">1. Face verification</h2><p className="text-xs text-slate-500">Селфи и дополнительный кадр для проверки живого человека</p></div>{face && <span className={`text-xs font-bold ${face.status === 'VERIFIED' ? 'text-emerald-700' : face.status === 'REJECTED' ? 'text-red-700' : 'text-amber-700'}`}>{face.status === 'VERIFIED' ? 'Подтверждено' : face.status === 'REJECTED' ? 'Отклонено' : 'На проверке'}</span>}</div>{!face && <label className="mt-3 block cursor-pointer rounded-xl border border-emerald-300 bg-emerald-50 py-3 text-center font-bold text-emerald-800">Снять лицо<input className="hidden" type="file" accept="image/*" capture="user" multiple onChange={faceCapture} /></label>}</section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-bold">2. Фото ДО</h2><span className="text-xs text-slate-500">{before.length} фото</span></div><div className="mt-3 grid grid-cols-3 gap-2">{before.map((photo) => <img key={photo.clientPhotoId} src={photo.url} className="aspect-square rounded-xl object-cover" />)}<label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 text-2xl text-emerald-700">＋<input className="hidden" type="file" accept="image/*" capture="environment" multiple onChange={(e) => void uploadPhotos(e, 'BEFORE')} /></label></div></section>

      {['ARRIVED', 'REJECTED'].includes(execution.status) && <button disabled={busy || !face || before.length === 0} onClick={() => void action(`/field/executions/${execution.id}/start`, { clientOperationId: newClientId(), occurredAt: new Date().toISOString() }, 'STARTED')} className="w-full rounded-xl bg-emerald-700 py-4 font-bold text-white disabled:opacity-40">Начать работу</button>}

      {['STARTED', 'IN_PROGRESS', 'REJECTED'].includes(execution.status) && <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">3. Чек-лист</h2><div className="mt-3 space-y-2">{execution.availableChecklist.map((item) => <label key={item.id} className="flex gap-3 rounded-xl bg-slate-50 p-3"><input type="checkbox" checked={completedIds.has(item.id)} onChange={(e) => void saveChecklist(item.id, e.target.checked)} className="h-5 w-5 accent-emerald-700" /><span className="text-sm font-medium">{item.label}{item.isRequired && <span className="text-red-600"> *</span>}</span></label>)}</div></section>}

      {['STARTED', 'IN_PROGRESS', 'REJECTED'].includes(execution.status) && <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">4. Материалы</h2><div className="mt-3 space-y-2">{materials.map((row) => <div key={row.id} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{row.product?.name ?? `Материал #${row.productId}`}</span><b>{Number(row.quantity).toLocaleString('ru-RU')} {row.product?.unit ?? ''}</b></div>)}</div><div className="mt-3 grid grid-cols-[1fr_7rem] gap-2"><select value={materialProductId} onChange={(e) => setMaterialProductId(e.target.value)} className="min-w-0 rounded-xl border px-3 py-2"><option value="">— добавить материал —</option>{products.filter((row) => (row.availableQuantity ?? row.currentQuantity) > 0).map((row) => <option key={row.id} value={row.id}>{row.name} · {row.availableQuantity ?? row.currentQuantity} {row.unit ?? ''}</option>)}</select><input type="number" min="0.001" step="0.001" value={materialQuantity} onChange={(e) => setMaterialQuantity(e.target.value)} placeholder="Кол-во" className="min-w-0 rounded-xl border px-3 py-2"/></div><button disabled={busy || !materialProductId || Number(materialQuantity) <= 0} onClick={() => void issueMaterial()} className="mt-2 w-full rounded-xl border border-emerald-700 py-2 font-bold text-emerald-800 disabled:opacity-40">Списать на эту работу</button></section>}

      {['STARTED', 'IN_PROGRESS', 'REJECTED'].includes(execution.status) && <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-bold">5. Фото ПОСЛЕ</h2><span className="text-xs text-slate-500">{after.length} фото</span></div><div className="mt-3 grid grid-cols-3 gap-2">{after.map((photo) => <img key={photo.clientPhotoId} src={photo.url} className="aspect-square rounded-xl object-cover" />)}<label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 text-2xl text-blue-700">＋<input className="hidden" type="file" accept="image/*" capture="environment" multiple onChange={(e) => void uploadPhotos(e, 'AFTER')} /></label></div></section>}

      {['STARTED', 'IN_PROGRESS', 'REJECTED'].includes(execution.status) && <button disabled={busy || after.length === 0 || execution.availableChecklist.some((item) => item.isRequired && !completedIds.has(item.id))} onClick={() => void action(`/field/executions/${execution.id}/complete`, { clientOperationId: newClientId(), occurredAt: new Date().toISOString() }, 'COMPLETED')} className="w-full rounded-xl bg-blue-700 py-4 font-bold text-white disabled:opacity-40">Завершить и отправить</button>}
      {execution.status === 'COMPLETED' && <div className="rounded-2xl bg-amber-50 p-4 text-center text-amber-900"><p className="font-bold">Работа ожидает приёмки</p><p className="mt-1 text-sm">Руководитель проверит лицо, фото, чек-лист и геолокацию.</p></div>}
      {execution.status === 'ACCEPTED' && <div className="rounded-2xl bg-emerald-50 p-4 text-center text-emerald-900"><p className="text-xl font-black">Работа принята ✓</p></div>}
      {message && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{message}</div>}
    </div>
  )
}
