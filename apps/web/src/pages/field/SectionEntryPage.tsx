import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthRecovery } from '@/components/AuthRecovery'
import { apiRequest, toUserMessage } from '@/api/client'
import { ResultFormPreview } from '@/components/field/ResultFields'
import type { FormSettings } from '@/lib/types'
import { FieldScanPage } from './FieldScanPage'

export type PublicSectionForm = {
  section: { code: string; name: string; objectName: string }
  formSettings: FormSettings
}

export function SectionEntryPage() {
  const { user, loading, error } = useAuth()
  if (loading) return <p role="status" className="p-4">Проверяем вход…</p>
  if (error) return <AuthRecovery />
  if (user) return <ProtectedRoute roles={['ADMIN', 'DIRECTOR', 'AKIMAT', 'ANTICOR', 'WORKER', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER']}><FieldScanPage /></ProtectedRoute>
  return <PublicForm />
}

function PublicForm() {
  const { sectionCode = '' } = useParams()
  const location = useLocation()
  const [data, setData] = useState<PublicSectionForm | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setData(null); setError('')
    void apiRequest<PublicSectionForm>(`/qr/form/${encodeURIComponent(sectionCode)}`)
      .then(value => { if (active) setData(value) })
      .catch(e => { if (active) setError(toUserMessage(e, 'Не удалось открыть форму участка')) })
    return () => { active = false }
  }, [sectionCode, attempt])
  const from = location.pathname + location.search + location.hash
  return <main className="mx-auto min-h-screen max-w-lg space-y-4 bg-slate-50 p-4">
    <p className="text-xl font-black text-emerald-800">GP WORK · Форма участка</p>
    {error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}<button type="button" className="mt-2 block underline" onClick={() => setAttempt(v => v + 1)}>Повторить загрузку</button></div>
      : !data ? <p role="status">Открываем форму участка…</p> : <>
        <header className="rounded-2xl bg-emerald-800 p-5 text-white"><p>{data.section.objectName}</p><h1 className="text-2xl font-bold">{data.section.name}</h1><p className="mt-2 text-sm">QR {data.section.code}</p></header>
        <section className="space-y-3 rounded-xl border bg-white p-4">
          <h2 className="font-bold">Как отметить работу</h2>
          <p className="text-sm">Форма открыта без входа. Чтобы записать смену и результат на своё имя, войдите как сотрудник. После входа вы останетесь на этом участке.</p>
          <Link to="/login" state={{ from }} className="inline-block rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Войти как сотрудник</Link>
          <ol className="list-decimal space-y-2 pl-5 text-sm"><li>В начале дня: GPS, три кадра лица и фото участка до работы.</li><li>Выполните назначенные задачи, приложите фото результата и чек-лист.</li><li>В конце дня: повторный QR, GPS, фото и результат каждой задачи.</li></ol>
          <p className="text-xs text-slate-500">Без входа недоступны сотрудники, задачи, фотографии и история работ. Камера и геолокация не включаются автоматически.</p>
        </section>
        <ResultFormPreview settings={data.formSettings}/>
      </>}
  </main>
}
