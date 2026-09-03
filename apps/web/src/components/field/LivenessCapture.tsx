import { useEffect, useRef, useState } from 'react'
import type { CameraShot } from './CameraCapture'

const prompts = ['Смотрите прямо', 'Поверните голову налево', 'Поверните голову направо']

export function LivenessCapture({ onChange }: { onChange: (shots: CameraShot[]) => void }) {
  const video = useRef<HTMLVideoElement>(null); const stream = useRef<MediaStream | null>(null)
  const [step,setStep]=useState(0); const [shots,setShots]=useState<CameraShot[]>([]); const [error,setError]=useState('')
  useEffect(()=>()=>stream.current?.getTracks().forEach(t=>t.stop()),[])
  async function open(){setError('');try{stream.current=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280}},audio:false});if(video.current)video.current.srcObject=stream.current}catch{setError('Фронтальная камера недоступна. Разрешите доступ в настройках Safari.') }}
  async function capture(){const v=video.current;if(!v||!v.videoWidth)return;const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d')!.drawImage(v,0,0);const blob=await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error()),'image/jpeg',.8));const file=new File([blob],`${crypto.randomUUID()}.jpg`,{type:'image/jpeg'});const next=[...shots,{file,preview:URL.createObjectURL(file)}];setShots(next);if(next.length===3){stream.current?.getTracks().forEach(t=>t.stop());onChange(next)}else setStep(next.length)}
  function reset(){shots.forEach(s=>URL.revokeObjectURL(s.preview));setShots([]);setStep(0);onChange([]);void open()}
  return <div className="rounded-2xl border bg-white p-4"><b>Проверка живого лица</b><p className="mt-1 text-sm text-slate-500">Три разных кадра защищают отметку от фотографии экрана.</p>{!stream.current&&!shots.length&&<button type="button" onClick={()=>void open()} className="mt-3 w-full rounded-xl bg-slate-900 p-4 font-bold text-white">Включить фронтальную камеру</button>}{shots.length<3&&<div className="mt-3"><video ref={video} autoPlay muted playsInline className="aspect-[3/4] w-full rounded-xl bg-black object-cover"/><p className="my-2 text-center font-bold">{prompts[step]}</p><button type="button" onClick={()=>void capture()} className="w-full rounded-xl bg-emerald-700 p-3 font-bold text-white">Снять кадр {step+1} из 3</button></div>}{shots.length===3&&<><div className="mt-3 flex gap-2">{shots.map((s,i)=><img key={i} src={s.preview} className="h-28 min-w-0 flex-1 rounded-lg object-cover"/>)}</div><button type="button" onClick={reset} className="mt-2 w-full rounded-xl border p-3">Пройти заново</button></>}{error&&<p className="mt-2 text-sm text-red-700">{error}</p>}</div>
}
