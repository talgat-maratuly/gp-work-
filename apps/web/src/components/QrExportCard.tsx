import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { getNurseryName } from '@/lib/appConfig'
import type { Section } from '@/lib/types'

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

const cardStyle: CSSProperties = {
  width: 384,
  maxWidth: '100%',
  margin: '0 auto',
  borderRadius: 12,
  border: '2px solid #1e293b',
  backgroundColor: '#ffffff',
  padding: 24,
  textAlign: 'center',
  fontFamily: FONT,
  color: '#000000',
  boxSizing: 'border-box',
}

interface Props {
  section?: Section
  objectName: string
  formUrl: string
  title?: string
  code?: string
  description?: ReactNode
  onReady?: () => void
}

export function QrExportCard({
  section,
  objectName,
  formUrl,
  title,
  code,
  description,
  onReady,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const displayTitle = title ?? section?.name ?? 'QR-код'
  const displayCode = code ?? section?.code

  useEffect(() => {
    if (!canvasRef.current) return
    let cancelled = false
    QRCode.toCanvas(canvasRef.current, formUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(() => {
        if (!cancelled) onReady?.()
      })
      .catch(() => {
        if (!cancelled) onReady?.()
      })
    return () => {
      cancelled = true
    }
  }, [formUrl, onReady])

  return (
    <div className="qr-export-card" style={cardStyle}>
      <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#000000', fontFamily: FONT }}>
        {getNurseryName()}
      </p>
      <p style={{ fontSize: 14, margin: '4px 0', color: '#475569', fontFamily: FONT }}>{objectName}</p>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: '8px 0 4px', color: '#000000', fontFamily: FONT }}>
        {displayTitle}
      </h2>
      {displayCode && (
        <p style={{ fontSize: 14, margin: '4px 0', color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>
          Код: {displayCode}
        </p>
      )}
      <div style={{ margin: '16px 0', display: 'flex', justifyContent: 'center' }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.375, margin: 0, color: '#334155', fontFamily: FONT }}>
        {description ?? (
          <>
            <span style={{ fontWeight: 700, color: '#000000' }}>Отсканируйте QR-код</span>, заполните форму и
            отправьте отчёт о выполненной работе.
          </>
        )}
      </p>
    </div>
  )
}
