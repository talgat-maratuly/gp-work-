import { useEffect, useRef, useState } from 'react'

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean
  start(): void; stop(): void; abort(): void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null; onend: (() => void) | null
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }

export function VoiceDictation({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<Recognition | null>(null)
  const Constructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition
  useEffect(() => () => {
    if (ref.current) { ref.current.onresult = null; ref.current.onend = null; ref.current.onerror = null; ref.current.abort() }
  }, [])
  function toggle() {
    if (listening) { ref.current?.stop(); return }
    if (!Constructor) return
    const recognition = new Constructor()
    ref.current = recognition
    recognition.lang = 'ru-RU'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => onText(Array.from(event.results).map((result) => result[0].transcript).join(' '))
    recognition.onend = () => setListening(false)
    recognition.onerror = () => { setListening(false); setError('Диктовка недоступна. Используйте микрофон клавиатуры или напишите текст.') }
    setError('')
    try { recognition.start(); setListening(true) } catch { setError('Не удалось включить микрофон. Используйте диктовку клавиатуры.') }
  }
  return <div className="space-y-1 text-sm">
    {Constructor ? <button type="button" disabled={disabled} onClick={toggle} className="rounded-xl border border-slate-300 px-4 py-2 disabled:opacity-50">{listening ? 'Остановить диктовку' : 'Надиктовать поручение'}</button> : <p>Для голосового ввода нажмите микрофон на клавиатуре телефона.</p>}
    <p className="text-xs text-slate-500">Диктовку обрабатывает браузер или клавиатура. Текст можно исправить до отправки.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>
}
