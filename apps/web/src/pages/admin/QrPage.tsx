import { useCallback, useEffect, useState } from 'react'
import { QrPrintModal } from '@/components/QrPrintModal'
import { QrCanvas } from '@/components/QrCanvas'
import { DeleteSectionDialog } from '@/components/DeleteSectionDialog'
import { Toast } from '@/components/Toast'
import { Button } from '@/components/ui/Button'
import { fetchSections } from '@/api/sectionsApi'
import { API_ORIGIN, toUserMessage } from '@/api/client'
import { buildCheckOutUrl, buildWorkFormUrlBySectionCode } from '@/lib/appConfig'
import { downloadQrPrintCardPng } from '@/lib/downloadQrCard'
import { onSectionsChanged } from '@/lib/sectionEvents'
import type { Section } from '@/lib/types'

export function QrPage() {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [printSectionCode, setPrintSectionCode] = useState<string | null>(null)
  const [printCheckOut, setPrintCheckOut] = useState(false)
  const [autoPrint, setAutoPrint] = useState(false)
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)

  const loadSections = useCallback(async () => {
    try {
      const data = await fetchSections()
      setSections(data)
      setError(null)
    } catch (err) {
      console.error('[qr]', err)
      setError(toUserMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSections()
    return onSectionsChanged(() => {
      void loadSections()
    })
  }, [loadSections])

  const printSection = printSectionCode
    ? sections.find((s) => s.code === printSectionCode) ?? null
    : null
  const checkOutUrl = buildCheckOutUrl()

  async function downloadQrPng(section: Section) {
    const key = `section-${section.code}`
    setDownloadingKey(key)
    try {
      await downloadQrPrintCardPng({
        section,
        objectName: section.objects?.name ?? '—',
        formUrl: buildWorkFormUrlBySectionCode(section.code),
        filename: `QR_${section.code}_карточка.png`,
      })
    } catch (err) {
      console.error('[qr/section-download]', err)
      setError('Не удалось скачать карточку QR. Попробуйте еще раз.')
    } finally {
      setDownloadingKey(null)
    }
  }

  function handleSectionDeleted(id: number) {
    setSections((prev) => prev.filter((s) => s.id !== id))
    if (sectionToDelete?.id === id && printSectionCode === sectionToDelete.code) {
      setPrintSectionCode(null)
    }
    setToast('Участок успешно удален.')
  }

  function openPrint(section: Section) {
    setPrintSectionCode(section.code)
    setAutoPrint(true)
  }

  function closePrint() {
    setPrintSectionCode(null)
    setPrintCheckOut(false)
    setAutoPrint(false)
  }

  function openCheckOutPrint() {
    setPrintCheckOut(true)
    setAutoPrint(true)
  }

  async function downloadCheckOutQr() {
    setDownloadingKey('checkout')
    try {
      await downloadQrPrintCardPng({
        objectName: 'Общий QR для отметки ухода',
        formUrl: checkOutUrl,
        title: 'QR «Уход»',
        description: (
          <>
            <span style={{ fontWeight: 700, color: '#000000' }}>Отсканируйте QR-код</span> и отметьте уход в
            конце смены.
          </>
        ),
        filename: 'QR_Уход_карточка.png',
      })
    } catch (err) {
      console.error('[qr/check-out-download]', err)
      setError('Не удалось скачать карточку QR. Попробуйте еще раз.')
    } finally {
      setDownloadingKey(null)
    }
  }

  return (
    <div className="no-print space-y-6">
      <h1 className="text-2xl font-bold">QR-коды</h1>

      <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
        <h2 className="text-lg font-semibold text-blue-900">QR «Уход» (общий)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Один QR для отметки ухода в конце смены. Приход фиксируется автоматически первым отчётом с участка.
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="rounded-lg border bg-white p-1">
            <QrCanvas value={checkOutUrl} className="h-[120px] w-[120px]" size={120} />
          </div>
          <div className="space-y-2 text-sm">
            <a href={checkOutUrl} target="_blank" rel="noreferrer" className="block break-all text-blue-700 underline">
              {checkOutUrl}
            </a>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={downloadingKey === 'checkout'}
                onClick={() => void downloadCheckOutQr()}
              >
                {downloadingKey === 'checkout' ? 'Скачивание…' : 'Скачать PNG'}
              </Button>
              <Button variant="ghost" onClick={openCheckOutPrint}>
                Печать
              </Button>
              <Button onClick={() => window.open(checkOutUrl, '_blank')}>Открыть форму ухода</Button>
            </div>
          </div>
        </div>
      </section>

      <p className="text-sm text-slate-500">QR участков: {API_ORIGIN}/api/qr/&#123;код&#125;</p>

      {error && <p className="text-red-600">{error}</p>}
      {loading ? (
        <p className="text-slate-600">Загрузка…</p>
      ) : sections.length === 0 ? (
        <p className="text-slate-600">Участков пока нет</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Объект</th>
                <th className="px-3 py-3">Участок</th>
                <th className="px-3 py-3">Код</th>
                <th className="px-3 py-3">Форма</th>
                <th className="px-3 py-3">QR</th>
                <th className="px-3 py-3">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sections.map((s) => {
                const formUrl = buildWorkFormUrlBySectionCode(s.code)
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">{s.objects?.name ?? '—'}</td>
                    <td className="px-3 py-3">{s.name}</td>
                    <td className="px-3 py-3 font-mono text-xs">{s.code}</td>
                    <td className="px-3 py-3">
                      <a href={formUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline break-all">
                        {formUrl}
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      <QrCanvas value={formUrl} className="h-[90px] w-[90px]" size={90} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={downloadingKey === `section-${s.code}`}
                          onClick={() => void downloadQrPng(s)}
                        >
                          {downloadingKey === `section-${s.code}` ? 'Скачивание…' : 'Скачать PNG'}
                        </Button>
                        <Button onClick={() => window.open(formUrl, '_blank')}>Открыть форму</Button>
                        <Button variant="ghost" onClick={() => openPrint(s)}>
                          Печать
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setSectionToDelete(s)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Удалить
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <QrPrintModal
        section={printSection}
        objectName={printSection?.objects?.name ?? '—'}
        formUrl={printSection ? buildWorkFormUrlBySectionCode(printSection.code) : ''}
        onClose={closePrint}
        autoPrint={autoPrint}
      />

      <QrPrintModal
        objectName="Общий QR для отметки ухода"
        formUrl={printCheckOut ? checkOutUrl : ''}
        title={printCheckOut ? 'QR «Уход»' : undefined}
        description={
          <>
            <strong>Отсканируйте QR-код</strong> и отметьте уход в конце смены.
          </>
        }
        onClose={closePrint}
        autoPrint={autoPrint}
      />

      <DeleteSectionDialog
        section={sectionToDelete}
        onClose={() => setSectionToDelete(null)}
        onSuccess={handleSectionDeleted}
      />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
