import { useEffect, useRef, useState } from 'react'
import type { CameraShot } from './CameraCapture'

const prompts = ['Смотрите прямо', 'Поверните голову налево', 'Поверните голову направо']

export function LivenessCapture({ onChange }: { onChange: (shots: CameraShot[]) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const previews = useRef<string[]>([])
  const mounted = useRef(true)
  const [shots, setShots] = useState<CameraShot[]>([])
  const [ready, setReady] = useState(false)
  const [opening, setOpening] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stream.current?.getTracks().forEach((track) => track.stop())
      previews.current.forEach(URL.revokeObjectURL)
    }
  }, [])

  async function open() {
    setError('')
    setReady(false)
    setOpening(true)
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false })
      if (!mounted.current) { next.getTracks().forEach((track) => track.stop()); return }
      stream.current = next
      if (video.current) { video.current.srcObject = next; await video.current.play() }
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop())
      stream.current = null
      if (mounted.current) setError('Фронтальная камера недоступна. Разрешите доступ к камере и повторите.')
    } finally {
      if (mounted.current) setOpening(false)
    }
  }

  async function capture() {
    const element = video.current
    if (capturing || !ready || !element?.videoWidth || shots.length >= 3) return
    setCapturing(true)
    setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = element.videoWidth
      canvas.height = element.videoHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Камера не готова')
      context.drawImage(element, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Не удалось сохранить кадр')), 'image/jpeg', .8))
      if (!mounted.current) return
      const file = new File([blob], `${crypto.randomUUID()}.jpg`, { type: 'image/jpeg' })
      const preview = URL.createObjectURL(file)
      previews.current.push(preview)
      const next = [...shots, { file, preview }]
      setShots(next)
      if (next.length === 3) {
        stream.current?.getTracks().forEach((track) => track.stop())
        stream.current = null
        setReady(false)
        onChange(next)
      }
    } catch {
      if (mounted.current) setError('Не удалось снять кадр. Попробуйте ещё раз.')
    } finally {
      if (mounted.current) setCapturing(false)
    }
  }

  function reset() {
    previews.current.forEach(URL.revokeObjectURL)
    previews.current = []
    setShots([])
    setReady(false)
    onChange([])
    // The video element is mounted on the next render; let the user start it.
  }

  return <div className="rounded-2xl border bg-white p-4">
    <b>Фото лица для проверки руководителем</b>
    <p className="mt-1 text-sm text-slate-500">Сделайте три кадра по подсказкам. Руководитель проверит их вручную. Автоматическое распознавание лица не выполняется.</p>
    {shots.length < 3 && <>
      {!ready && <button type="button" disabled={opening} onClick={() => void open()} className="mt-3 w-full rounded-xl bg-slate-900 p-4 font-bold text-white disabled:opacity-50">{opening ? 'Открываем камеру…' : 'Включить фронтальную камеру'}</button>}
      <video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} className="mt-3 aspect-[3/4] w-full rounded-xl bg-black object-cover" />
      <p className="my-2 text-center font-bold">{prompts[shots.length]}</p>
      <button type="button" disabled={!ready || capturing} onClick={() => void capture()} className="w-full rounded-xl bg-emerald-700 p-3 font-bold text-white disabled:opacity-50">Снять кадр {shots.length + 1} из 3</button>
    </>}
    {shots.length === 3 && <>
      <div className="mt-3 flex gap-2">{shots.map((shot, index) => <img key={shot.preview} src={shot.preview} alt={prompts[index]} className="h-28 min-w-0 flex-1 rounded-lg object-cover" />)}</div>
      <button type="button" onClick={reset} className="mt-2 w-full rounded-xl border p-3">Снять заново</button>
    </>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>
}
