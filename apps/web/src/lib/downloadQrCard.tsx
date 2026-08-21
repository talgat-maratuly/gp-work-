import { type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import html2canvas from 'html2canvas'
import { QrExportCard } from '@/components/QrExportCard'
import type { Section } from '@/lib/types'

export interface DownloadQrCardOptions {
  objectName: string
  formUrl: string
  filename: string
  section?: Section
  title?: string
  code?: string
  description?: ReactNode
}

function createExportIframe(): { iframe: HTMLIFrameElement; mountNode: HTMLElement } {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:420px;height:640px;border:none;visibility:hidden;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    throw new Error('Failed to create export frame')
  }

  doc.open()
  doc.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;background:#ffffff;"></body></html>'
  )
  doc.close()

  const mountNode = doc.body
  return { iframe, mountNode }
}

export async function downloadQrPrintCardPng({
  objectName,
  formUrl,
  filename,
  section,
  title,
  code,
  description,
}: DownloadQrCardOptions): Promise<void> {
  const { iframe, mountNode } = createExportIframe()
  const root = createRoot(mountNode)

  try {
    await new Promise<void>((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      }

      root.render(
        <QrExportCard
          section={section}
          objectName={objectName}
          formUrl={formUrl}
          title={title}
          code={code}
          description={description}
          onReady={done}
        />
      )

      window.setTimeout(done, 2000)
    })

    const card = mountNode.querySelector('.qr-export-card')
    if (!card) {
      throw new Error('QR card element not found')
    }

    const canvas = await html2canvas(card as HTMLElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      windowWidth: 420,
      windowHeight: 640,
    })

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) {
      throw new Error('Failed to create PNG')
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    root.unmount()
    iframe.remove()
  }
}
