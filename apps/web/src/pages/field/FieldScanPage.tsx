import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiRequest, toUserMessage } from '@/api/client'
import { uploadWorkPhotos } from '@/api/uploadsApi'
import { CameraCapture, type CameraShot } from '@/components/field/CameraCapture'
import { LivenessCapture } from '@/components/field/LivenessCapture'
import { useGeolocation } from '@/hooks/useGeolocation'

type DayState = { section: { code: string; name: string; object?: { name: string } }; session: null | { id: number; startedAt: string }; tasks: { id: number; description: string }[]; serverTime: string }

export function FieldScanPage() {
  const { sectionCode = '' } = useParams(); const { requestGeolocation } = useGeolocation()
  const [state, setState] = useState<DayState | null>(null); const [liveness, setLiveness] = useState<CameraShot[]>([]); const [workPhoto, setWorkPhoto] = useState<CameraShot | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [results,setResults]=useState<Record<number,{percent:number;actualVolume:string;description:string;incompleteReason:string}>>({})
  const load = () => apiRequest<DayState>(`/field/scan/${encodeURIComponent(sectionCode)}`).then(setState).catch(e => setMessage(toUserMessage(e)))
  useEffect(() => { void load() }, [sectionCode])
  async function submit(close: boolean) {
    if (liveness.length !== 3 || !workPhoto) { setMessage('Обязательны три кадра liveness и фото участка'); return }
    setBusy(true); setMessage('')
    try {
      const geo = await requestGeolocation(); if (geo.latitude == null || geo.longitude == null) throw new Error('Разрешите точную геолокацию')
      const [selfieUrls, photoUrls] = await Promise.all([uploadWorkPhotos(liveness.map(s=>s.file)), uploadWorkPhotos([workPhoto.file])])
      const common = { clientSessionId: crypto.randomUUID(), sectionCode, latitude: geo.latitude, longitude: geo.longitude, accuracy: geo.accuracy, selfieUrl: selfieUrls[0], livenessEvidenceUrls: selfieUrls, startPhotoUrl: photoUrls[0] }
      if (close) await apiRequest('/field/work-days/close', { method: 'POST', body: JSON.stringify({ ...common, sessionId: state!.session!.id, resultPhotoUrls: photoUrls, results: state!.tasks.map(t => ({ taskId: t.id, ...(results[t.id]||{percent:0,actualVolume:'',description:'',incompleteReason:''}) })) }) })
      else await apiRequest('/field/work-days/start', { method: 'POST', body: JSON.stringify(common) })
      setLiveness([]); setWorkPhoto(null); await load(); setMessage(close ? 'Рабочий день завершён' : 'Рабочий день открыт по серверному времени')
    } catch (e) { setMessage(toUserMessage(e)) } finally { setBusy(false) }
  }
  if (!state) return <div className="p-5">{message || 'Проверяем QR…'}</div>
  return <main className="mx-auto min-h-screen max-w-md space-y-4 bg-slate-50 p-4 pb-28">
    <div className="rounded-3xl bg-emerald-800 p-5 text-white"><div className="text-sm opacity-80">{state.section.object?.name}</div><h1 className="text-2xl font-black">{state.section.name}</h1><div className="mt-2 text-xs">QR {state.section.code} · сервер {new Date(state.serverTime).toLocaleTimeString()}</div></div>
    {state.session && <div className="rounded-2xl bg-emerald-50 p-4"><b>Смена открыта</b><div className="text-sm">Начало: {new Date(state.session.startedAt).toLocaleTimeString()}</div></div>}
    <LivenessCapture onChange={setLiveness} />
    <CameraCapture label={state.session ? 'Фото результата' : 'Начальное фото участка'} onChange={setWorkPhoto} />
    {state.session && <div className="rounded-2xl bg-white p-4"><b>Результат каждой задачи</b>{state.tasks.map(t => {const r=results[t.id]||{percent:0,actualVolume:'',description:'',incompleteReason:''};const set=(v:Partial<typeof r>)=>setResults(old=>({...old,[t.id]:{...r,...v}}));return <div key={t.id} className="mt-3 space-y-2 rounded-xl bg-slate-100 p-3"><b>{t.description}</b><label className="block text-sm">Выполнение: {r.percent}%<input type="range" min="0" max="100" value={r.percent} onChange={e=>set({percent:Number(e.target.value)})} className="w-full"/></label><input value={r.actualVolume} onChange={e=>set({actualVolume:e.target.value})} placeholder="Фактический объём и единица" className="w-full rounded-lg border p-2"/><textarea value={r.description} onChange={e=>set({description:e.target.value})} placeholder="Что выполнено" className="w-full rounded-lg border p-2"/>{r.percent<100&&<textarea required value={r.incompleteReason} onChange={e=>set({incompleteReason:e.target.value})} placeholder="Обязательная причина незавершения" className="w-full rounded-lg border border-amber-400 p-2"/>}</div>})}</div>}
    <button disabled={busy} onClick={() => void submit(!!state.session)} className={`w-full rounded-2xl p-5 text-lg font-black text-white disabled:opacity-50 ${state.session ? 'bg-red-700' : 'bg-emerald-700'}`}>{busy ? 'Сохраняем…' : state.session ? 'Завершить рабочий день' : 'Начать рабочий день'}</button>
    {message && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}
  </main>
}
