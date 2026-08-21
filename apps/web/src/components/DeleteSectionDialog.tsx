import { useState } from 'react'
import { ApiError } from '@/api/client'
import { deleteSection } from '@/api/sectionsApi'
import { Button } from '@/components/ui/Button'
import type { Section } from '@/lib/types'

const REPORTS_MESSAGE =
  'По данному участку существуют отчеты. Удаление невозможно. Сначала удалите журнал работ или перенесите участок в архив.'

export function DeleteSectionDialog({
  section,
  onClose,
  onSuccess,
}: {
  section: Section | null
  onClose: () => void
  onSuccess: (id: number) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!section) return null

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteSection(section!.id)
      onSuccess(section!.id)
      onClose()
    } catch (err) {
      console.error('[sections] delete:', err)
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message || REPORTS_MESSAGE)
      } else {
        setError('Не удалось удалить участок. Проверьте соединение с сервером.')
      }
    } finally {
      setDeleting(false)
    }
  }

  function handleClose() {
    if (deleting) return
    setError(null)
    onClose()
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-section-title"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id="delete-section-title" className="text-lg font-semibold text-slate-900">
          Вы действительно хотите удалить этот участок?
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          Название участка: <span className="font-medium text-slate-900">{section.name}</span>
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={deleting}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleting ? 'Удаление…' : 'Удалить'}
          </Button>
        </div>
      </div>
    </div>
  )
}
