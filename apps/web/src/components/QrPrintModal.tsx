import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { QrPrintCard } from '@/components/QrPrintCard'
import type { Section } from '@/lib/types'

interface Props {
  section?: Section | null
  objectName: string
  formUrl: string
  title?: string
  code?: string
  description?: ReactNode
  onClose: () => void
  autoPrint?: boolean
}

export function QrPrintModal({
  section,
  objectName,
  formUrl,
  title,
  code,
  description,
  onClose,
  autoPrint,
}: Props) {
  const isOpen = !!section || !!title

  useEffect(() => {
    if (!isOpen || !autoPrint) return
    const t = window.setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [isOpen, autoPrint, formUrl])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-40 grid place-items-center p-4">
      <div
        className="no-print absolute inset-0 bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      <div className="relative grid w-full max-w-sm grid-cols-1 grid-rows-1">
        <div
          className="no-print col-start-1 row-start-1 min-h-full w-full rounded-xl bg-white p-4 shadow-xl"
          aria-hidden
        />
        <div className="col-start-1 row-start-1 flex flex-col p-4">
          <button
            type="button"
            onClick={onClose}
            className="qr-print-actions no-print absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-600 hover:bg-slate-100"
            aria-label="Закрыть"
          >
            ✕
          </button>
          <QrPrintCard
            section={section ?? undefined}
            objectName={objectName}
            formUrl={formUrl}
            title={title}
            code={code}
            description={description}
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="qr-print-actions no-print mt-4 w-full rounded-lg bg-emerald-700 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Печать
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
