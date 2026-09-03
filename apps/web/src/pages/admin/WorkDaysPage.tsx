import { useEffect, useState } from 'react'
import { apiRequest, resolveAssetUrl, toUserMessage } from '@/api/client'

type Day = { id:number; status:string; startedAt:string; closedAt:string|null; overallPercent:number; startDistanceMeters:number|null; startSelfieUrl:string; startPhotoUrl:string; resultPhotoUrls:string[]; summary:string|null; incompleteReasons:Record<string,string>; user:{fullName:string}; section:{name:string; object?:{name:string}} }

export function WorkDaysPage() {
  const [days,setDays]=useState<Day[]>([]); const [error,setError]=useState('')
  const load=()=>apiRequest<Day[]>('/field/work-days').then(setDays).catch(e=>setError(toUserMessage(e)))
  useEffect(()=>{void load()},[])
  async function review(id:number,accepted:boolean){ await apiRequest(`/field/work-days/${id}/review`,{method:'POST',body:JSON.stringify({accepted})}); await load() }
  return <div className="space-y-5"><div><h1 className="text-3xl font-black">Рабочие дни</h1><p className="text-slate-500">QR, GPS, селфи, задачи и итоговая приёмка</p></div>{error&&<div className="bg-red-50 p-3 text-red-700">{error}</div>}
    <div className="grid gap-4 xl:grid-cols-2">{days.map(d=><article key={d.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><b className="text-lg">{d.user.fullName}</b><div className="text-sm text-slate-500">{d.section.object?.name} · {d.section.name}</div></div><span className="h-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold">{d.status}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div>Приход: {new Date(d.startedAt).toLocaleString()}</div><div>Уход: {d.closedAt?new Date(d.closedAt).toLocaleString():'на объекте'}</div><div>Отклонение: {d.startDistanceMeters==null?'—':`${Math.round(d.startDistanceMeters)} м`}</div><div>Общий результат: <b>{d.overallPercent}%</b></div></div><div className="mt-3 flex gap-2 overflow-x-auto">{[d.startSelfieUrl,d.startPhotoUrl,...d.resultPhotoUrls].filter(Boolean).map((u,i)=><img key={i} src={resolveAssetUrl(u)} className="h-24 w-24 shrink-0 rounded-xl object-cover" />)}</div>{Object.keys(d.incompleteReasons||{}).length>0&&<div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">Причины: {Object.entries(d.incompleteReasons).map(([k,v])=>`задача ${k}: ${v}`).join('; ')}</div>}{d.status==='CLOSED'&&<div className="mt-4 flex gap-2"><button onClick={()=>void review(d.id,true)} className="flex-1 rounded-xl bg-emerald-700 p-3 font-bold text-white">Подтвердить</button><button onClick={()=>void review(d.id,false)} className="flex-1 rounded-xl bg-red-700 p-3 font-bold text-white">Вернуть</button></div>}</article>)}</div>
  </div>
}
