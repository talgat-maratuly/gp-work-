import { FormEvent, useEffect, useMemo, useState } from 'react'
import { fetchObjectsWithSections, type NurseryObjectWithSections } from '@/api/objectsApi'
import { fetchTasks, type ApiTask } from '@/api/tasksApi'
import {
  createNurseryBatch,
  createNurseryMovement,
  fetchNurseryBatches,
  fetchNurseryMovements,
  NURSERY_MOVEMENT_LABELS,
  type NurseryBatch,
  type NurseryMovement,
  type NurseryMovementType,
} from '@/api/resourcesApi'
import { toUserMessage } from '@/api/client'

const movementTypes = Object.keys(NURSERY_MOVEMENT_LABELS) as NurseryMovementType[]

export function NurseryPage() {
  const [batches, setBatches] = useState<NurseryBatch[]>([])
  const [movements, setMovements] = useState<NurseryMovement[]>([])
  const [objects, setObjects] = useState<NurseryObjectWithSections[]>([])
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [showBatch, setShowBatch] = useState(false)
  const [movingBatch, setMovingBatch] = useState<number | null>(null)
  const [batchCode, setBatchCode] = useState('')
  const [culture, setCulture] = useState('')
  const [variety, setVariety] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('шт')
  const [location, setLocation] = useState('')
  const [movementType, setMovementType] = useState<NurseryMovementType>('ISSUE')
  const [movementQuantity, setMovementQuantity] = useState('')
  const [objectId, setObjectId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const [batchRows, movementRows, objectRows, taskRows] = await Promise.all([
      fetchNurseryBatches(), fetchNurseryMovements(), fetchObjectsWithSections(), fetchTasks(),
    ])
    setBatches(batchRows); setMovements(movementRows); setObjects(objectRows); setTasks(taskRows)
  }
  useEffect(() => { void load().catch((e) => setError(toUserMessage(e))) }, [])
  const selectedObject = objects.find((row) => row.id === Number(objectId))
  const selectedSectionIds = new Set(selectedObject?.sections.map((row) => row.id) ?? [])
  const objectTasks = useMemo(() => tasks.filter((task) => !objectId || selectedSectionIds.has(task.sectionId)), [tasks, objectId, selectedObject])

  async function submitBatch(event: FormEvent) {
    event.preventDefault(); setError(null)
    try {
      await createNurseryBatch({ batchCode, culture, variety: variety || undefined, quantity: Number(quantity), unit, location: location || undefined })
      setBatchCode(''); setCulture(''); setVariety(''); setQuantity(''); setShowBatch(false); await load()
    } catch (e) { setError(toUserMessage(e)) }
  }

  async function submitMovement(event: FormEvent) {
    event.preventDefault(); if (!movingBatch) return; setError(null)
    try {
      await createNurseryMovement({ batchId: movingBatch, type: movementType, quantity: Number(movementQuantity), objectId: objectId ? Number(objectId) : undefined, taskId: taskId ? Number(taskId) : undefined, toLocation: movementType === 'TRANSFER' ? location || undefined : undefined, clientOperationId: crypto.randomUUID() })
      setMovingBatch(null); setMovementQuantity(''); setObjectId(''); setTaskId(''); await load()
    } catch (e) { setError(toUserMessage(e)) }
  }

  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-black">Питомник</h1><p className="text-sm text-slate-500">Партии, резерв, перемещение и выдача растений на объекты</p></div><button onClick={() => setShowBatch((value) => !value)} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white">Новая партия</button></div>
    {showBatch && <form onSubmit={submitBatch} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-3"><input required value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="Код партии *" className="rounded-xl border px-3 py-2"/><input required value={culture} onChange={(e) => setCulture(e.target.value)} placeholder="Культура *" className="rounded-xl border px-3 py-2"/><input value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="Сорт" className="rounded-xl border px-3 py-2"/><input required type="number" min="0" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Количество *" className="rounded-xl border px-3 py-2"/><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Ед. изм." className="rounded-xl border px-3 py-2"/><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Местоположение" className="rounded-xl border px-3 py-2"/><button className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white md:col-span-3">Создать партию</button></form>}
    {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Партия</th><th className="p-3">Культура / сорт</th><th className="p-3">Место</th><th className="p-3 text-right">Всего</th><th className="p-3 text-right">Резерв</th><th className="p-3">Статус</th><th className="p-3"/></tr></thead><tbody className="divide-y">{batches.map((batch) => <tr key={batch.id}><td className="p-3 font-mono font-bold">{batch.batchCode}</td><td className="p-3"><b>{batch.culture}</b><small className="block text-slate-500">{batch.variety || 'Сорт не указан'}</small></td><td className="p-3">{batch.location || '—'}</td><td className="p-3 text-right font-bold">{Number(batch.quantity).toLocaleString('ru-RU')} {batch.unit}</td><td className="p-3 text-right">{Number(batch.reservedQuantity).toLocaleString('ru-RU')}</td><td className="p-3">{batch.status}</td><td className="p-3"><button onClick={() => setMovingBatch(batch.id)} className="font-bold text-emerald-800 underline">Движение</button></td></tr>)}</tbody></table></div>
    {movingBatch && <form onSubmit={submitMovement} className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 md:grid-cols-4"><h2 className="font-black md:col-span-4">Движение партии {batches.find((row) => row.id === movingBatch)?.batchCode}</h2><select value={movementType} onChange={(e) => setMovementType(e.target.value as NurseryMovementType)} className="rounded-xl border px-3 py-2">{movementTypes.filter((value) => value !== 'INCOME').map((value) => <option key={value} value={value}>{NURSERY_MOVEMENT_LABELS[value]}</option>)}</select><input required type="number" min="0.001" step="0.001" value={movementQuantity} onChange={(e) => setMovementQuantity(e.target.value)} placeholder="Количество *" className="rounded-xl border px-3 py-2"/><select value={objectId} onChange={(e) => { setObjectId(e.target.value); setTaskId('') }} className="rounded-xl border px-3 py-2"><option value="">— объект —</option>{objects.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select><select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="rounded-xl border px-3 py-2"><option value="">— задача —</option>{objectTasks.map((row) => <option key={row.id} value={row.id}>#{row.id} {row.description}</option>)}</select>{movementType === 'TRANSFER' && <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Новое местоположение" className="rounded-xl border px-3 py-2 md:col-span-2"/>}<button className="rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white">Сохранить</button><button type="button" onClick={() => setMovingBatch(null)} className="rounded-xl border px-4 py-2 font-bold">Отмена</button></form>}
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-black">Последние движения</h2><div className="mt-3 divide-y">{movements.slice(0, 15).map((movement) => <div key={movement.id} className="grid gap-1 py-3 text-sm md:grid-cols-5"><b>{movement.batch?.batchCode}</b><span>{NURSERY_MOVEMENT_LABELS[movement.type]}</span><span>{Number(movement.quantity).toLocaleString('ru-RU')}</span><span>{movement.object?.name || movement.toLocation || '—'}</span><time className="text-slate-500">{new Date(movement.createdAt).toLocaleString('ru-RU')}</time></div>)}</div></section>
  </div>
}
