import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toUserMessage } from '@/api/client'
import { fetchSectionById } from '@/api/sectionsApi'
import { AccountControls } from '@/components/AccountControls'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from '@/lib/roleRoutes'

export function LegacyWorkFormRedirect() {
  const { user } = useAuth()
  const { sectionCode } = useParams<{ sectionCode: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const sectionId = Number(params.get('sectionId'))

  useEffect(() => {
    if (sectionCode || !Number.isInteger(sectionId) || sectionId <= 0) return
    let active = true
    setError('')
    void fetchSectionById(sectionId)
      .then((section) => { if (active) navigate(`/field/scan/${encodeURIComponent(section.code)}`, { replace: true }) })
      .catch((loadError) => { if (active) setError(toUserMessage(loadError, 'Старая QR-ссылка недействительна')) })
    return () => { active = false }
  }, [navigate, sectionCode, sectionId])

  if (sectionCode) return <Navigate to={`/field/scan/${encodeURIComponent(sectionCode)}`} replace />
  const message = !Number.isInteger(sectionId) || sectionId <= 0 ? 'Неверная QR-ссылка участка.' : error
  return <main className="mx-auto max-w-lg space-y-4 p-4">
    <div className="flex items-center justify-between rounded-xl border p-3">
      <Link to={homePathForRole(user!.role)} className="text-blue-700">← В кабинет</Link><AccountControls />
    </div>
    <p role={message ? 'alert' : 'status'}>{message || 'Переходим к защищённой форме участка…'}</p>
  </main>
}
