import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiRequest, toUserMessage } from '@/api/client'
import { uploadWorkPhotos } from '@/api/uploadsApi'
import { CameraCapture, type CameraShot } from '@/components/field/CameraCapture'
import { useGeolocation } from '@/hooks/useGeolocation'

type DayState = { section: { code: string; name: string; object?: { name: string } }; session: null | { id: number; startedAt: string }; tasks: { id: number; description: string }[]; serverTime: string }

export function FieldScanPage() {
  const { sectionCode = '' } = useParams(); const { requestGeolocation } = useGeolocation()
  const [state, setState] = useState<DayState | null>(null); const [selfie, setSelfie] = useState<CameraShot | null>(null); const [workPhoto, setWorkPhoto] = useState<CameraShot | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const load = () => apiRequest<DayState>(`/field/scan/${encodeURIComponent(sectionCode)}`).then(setState).catch(e => setMessage(toUserMessage(e)))
  useEffect(() => { void load() }, [sectionCode])
  async function submit(close: boolean) {
    if (!selfie || !workPhoto) { setMessage('Обязательны селфи и фото участка'); return }
    setBusy(true); setMessage('')
    try {
      const geo = await requestGeolocation(); if (geo.latitude == null || geo.longitude == null) throw new Error('Разрешите точную геолокацию')
      const [selfieUrls, photoUrls] = await Promise.all([uploadWorkPhotos([selfie.file]), uploadWorkPhotos([workPhoto.file])])
      const common = { clientSessionId: crypto.randomUUID(), sectionCode, latitude: geo.latitude, longitude: geo.longitude, accuracy: geo.accuracy, selfieUrl: selfieUrls[0], livenessEvidenceUrls: [selfieUrls[0], selfieUrls[0]], startPhotoUrl: photoUrls[0] }
      if (close) await apiRequest('/field/work-days/close', { method: 'POST', body: JSON.stringify({ ...common, sessionId: state!.session!.id, resultPhotoUrls: photoUrls, results: state!.tasks.map(t => ({ taskId: t.id, percent: 100, actualVolume: 'выполнено' })) }) })
      else await apiRequest('/field/work-days/start', { method: 'POST', body: JSON.stringify(common) })
      setSelfie(null); setWorkPhoto(null); await load(); setMessage(close ? 'Рабочий день завершён' : 'Рабочий день открыт по серверному времени')
    } catch (e) { setMessage(toUserMessage(e)) } finally { setBusy(false) }
  }
  if (!state) return <div className="p-5">{message || 'Проверяем QR…'}</div>
  return <main className="mx-auto min-h-screen max-w-md space-y-4 bg-slate-50 p-4 pb-28">
    <div className="rounded-3xl bg-emerald-800 p-5 text-white"><div className="text-sm opacity-80">{state.section.object?.name}</div><h1 className="text-2xl font-black">{state.section.name}</h1><div className="mt-2 text-xs">QR {state.section.code} · сервер {new Date(state.serverTime).toLocaleTimeString()}</div></div>
    {state.session && <div className="rounded-2xl bg-emerald-50 p-4"><b>Смена открыта</b><div className="text-sm">Начало: {new Date(state.session.startedAt).toLocaleTimeString()}</div></div>}
    <CameraCapture facing="user" label={state.session ? 'Конечное селфи и liveness' : 'Селфи и liveness'} onChange={setSelfie} />
    <CameraCapture label={state.session ? 'Фото результата' : 'Начальное фото участка'} onChange={setWorkPhoto} />
    {state.session && <div className="rounded-2xl bg-white p-4"><b>Текущие задачи</b>{state.tasks.map(t => <div key={t.id} className="mt-2 rounded-xl bg-slate-100 p-3">{t.description}</div>)}</div>}
    <button disabled={busy} onClick={() => void submit(!!state.session)} className={`w-full rounded-2xl p-5 text-lg font-black text-white disabled:opacity-50 ${state.session ? 'bg-red-700' : 'bg-emerald-700'}`}>{busy ? 'Сохраняем…' : state.session ? 'Завершить рабочий день' : 'Начать рабочий день'}</button>
    {message && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}
  </main>
}
