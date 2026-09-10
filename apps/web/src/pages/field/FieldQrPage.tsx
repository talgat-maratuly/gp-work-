import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { arriveAtTask, newClientId } from '@/api/fieldApi'
import { toUserMessage } from '@/api/client'
import { useGeolocation } from '@/hooks/useGeolocation'
import { queueRequest } from '@/offline/queue'

function extractCode(value: string): string {
  const trimmed = value.trim()
  try {
    const url = new URL(trimmed)
    const parts = url.pathname.split('/').filter(Boolean)
    return decodeURIComponent(parts.at(-1) ?? '')
  } catch {
    return trimmed.split('/').filter(Boolean).at(-1) ?? trimmed
  }
}

export function FieldQrPage() {
  const [params] = useSearchParams()
  const taskId = Number(params.get('taskId'))
  const routeStopId = Number(params.get('routeStopId')) || undefined
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [manual, setManual] = useState(params.get('code') || '')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const { requestGeolocation } = useGeolocation()

  async function confirm(raw: string) {
    if (!taskId || busy) {
      if (!taskId) setMessage('Сначала откройте QR из конкретной задачи или маршрута.')
      return
    }
    setBusy(true)
    controlsRef.current?.stop()
    const geo = await requestGeolocation()
    if (geo.latitude == null || geo.longitude == null) {
      setMessage('Для прибытия необходимо разрешить точную геолокацию.')
      setBusy(false)
      return
    }
    const body = {
      clientOperationId: newClientId(),
      clientExecutionId: newClientId(),
      sectionCode: extractCode(raw),
      routeStopId,
      latitude: geo.latitude,
      longitude: geo.longitude,
      accuracy: geo.accuracy,
      occurredAt: new Date().toISOString(),
    }
    try {
      if (!navigator.onLine) {
        await queueRequest(`/field/tasks/${taskId}/arrive`, 'POST', body)
        setMessage('Прибытие сохранено. Для продолжения Face verification восстановите интернет и синхронизируйте данные.')
        return
      }
      const execution = await arriveAtTask(taskId, body)
      navigate(`/field/executions/${execution.id}`, { replace: true })
    } catch (error) {
      setMessage(toUserMessage(error, 'QR не подтверждён'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!taskId || !videoRef.current) return
    const reader = new BrowserQRCodeReader()
    void reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (result) void confirm(result.getText())
    }).then((controls) => { controlsRef.current = controls }).catch(() => setMessage('Камера недоступна. Введите код участка вручную.'))
    return () => controlsRef.current?.stop()
  }, [taskId])

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-black">QR-паспорт</h1><p className="text-sm text-slate-500">Наведите камеру на QR-код объекта</p></div>
      {!taskId && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">QR должен быть открыт из задачи или остановки маршрута.</div>}
      <div className="overflow-hidden rounded-3xl bg-slate-950 shadow-lg"><video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline /><div className="pointer-events-none absolute" /></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-sm font-semibold">Код участка вручную</label>
        <div className="mt-2 flex gap-2"><input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Например GP-001" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3" /><button disabled={!manual || busy} onClick={() => void confirm(manual)} className="rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-50">{busy ? 'Проверяем…' : 'Подтвердить QR и GPS'}</button></div>
      </div>
      {message && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{message}</div>}
    </div>
  )
}
