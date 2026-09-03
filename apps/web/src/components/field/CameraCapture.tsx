import { useEffect, useRef, useState } from 'react'

export type CameraShot = { file: File; preview: string }

async function jpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Не удалось обработать фото')), 'image/jpeg', .78))
  return new File([blob], `${crypto.randomUUID()}.jpg`, { type: 'image/jpeg' })
}

export function CameraCapture({ facing = 'environment', label, onChange }: { facing?: 'user' | 'environment'; label: string; onChange: (shot: CameraShot | null) => void }) {
  const input = useRef<HTMLInputElement>(null); const [shot, setShot] = useState<CameraShot | null>(null); const [error, setError] = useState('')
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.preview) }, [shot])
  async function pick(file?: File) {
    if (!file) return
    setError('')
    try { const converted = await jpeg(file); const next = { file: converted, preview: URL.createObjectURL(converted) }; setShot(next); onChange(next) }
    catch { setError('Формат фото не прочитан. Сделайте новый снимок камерой.') }
  }
  function clear() { if (shot) URL.revokeObjectURL(shot.preview); setShot(null); onChange(null); if (input.current) input.current.value = '' }
  return <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="font-bold">{label}</div>
    {shot ? <><img src={shot.preview} className="mt-3 aspect-[4/3] w-full rounded-xl object-cover" /><div className="mt-2 flex gap-2"><button type="button" onClick={() => input.current?.click()} className="flex-1 rounded-xl bg-emerald-700 p-3 font-bold text-white">Переснять</button><button type="button" onClick={clear} className="rounded-xl border px-4">Удалить</button></div></> : <button type="button" onClick={() => input.current?.click()} className="mt-3 w-full rounded-xl bg-slate-900 p-4 font-bold text-white">Открыть камеру</button>}
    <input ref={input} hidden type="file" accept="image/*,.heic,.heif" capture={facing} onChange={e => void pick(e.target.files?.[0])} />
    {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
  </div>
}
