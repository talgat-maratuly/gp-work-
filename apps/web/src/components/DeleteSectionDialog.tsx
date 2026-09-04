import { useState } from 'react'
import { toUserMessage } from '@/api/client'
import { archiveSection } from '@/api/sectionsApi'
import { Button } from '@/components/ui/Button'
import type { Section } from '@/lib/types'

export function ArchiveSectionDialog({
  section,
  onClose,
  onSuccess,
}: {
  section: Section | null
  onClose: () => void
  onSuccess: (id: number) => void
}) {
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!section) return null

  async function handleArchive() {
    setArchiving(true)
    setError(null)
    try {
      await archiveSection(section!.id)
      onSuccess(section!.id)
      onClose()
    } catch (err) {
      console.error('[sections] archive:', err)
      setError(toUserMessage(err, 'Не удалось переместить участок в архив.'))
    } finally {
      setArchiving(false)
    }
  }

  function handleClose() {
    if (archiving) return
    setError(null)
    onClose()
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-section-title"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id="archive-section-title" className="text-lg font-semibold text-slate-900">
          Переместить участок в архив?
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          Название участка: <span className="font-medium text-slate-900">{section.name}</span>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          История задач и отчётов сохранится. QR и новые полевые действия будут отключены.
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={archiving}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => void handleArchive()}
            disabled={archiving}
            className="bg-red-600 hover:bg-red-700"
          >
            {archiving ? 'Архивация…' : 'В архив'}
          </Button>
        </div>
      </div>
    </div>
  )
}
