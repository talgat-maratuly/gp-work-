import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toUserMessage } from '@/api/client'
import { fetchSectionById } from '@/api/sectionsApi'

export function LegacyWorkFormRedirect() {
  const { sectionCode } = useParams<{ sectionCode: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const sectionId = Number(params.get('sectionId'))

  useEffect(() => {
    if (sectionCode || !Number.isInteger(sectionId) || sectionId <= 0) return
    void fetchSectionById(sectionId)
      .then((section) => navigate(`/field/scan/${encodeURIComponent(section.code)}`, { replace: true }))
      .catch((loadError) => setError(toUserMessage(loadError, 'Старая QR-ссылка недействительна')))
  }, [navigate, sectionCode, sectionId])

  if (sectionCode) return <Navigate to={`/field/scan/${encodeURIComponent(sectionCode)}`} replace />
  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    return <div className="mx-auto mt-12 max-w-lg rounded-xl bg-red-50 p-5 text-red-700">Неверная QR-ссылка участка.</div>
  }
  if (error) return <div className="mx-auto mt-12 max-w-lg rounded-xl bg-red-50 p-5 text-red-700">{error}</div>
  return <div className="mx-auto mt-12 max-w-lg rounded-xl bg-white p-5 text-slate-500">Переходим к защищённой форме участка…</div>
}
