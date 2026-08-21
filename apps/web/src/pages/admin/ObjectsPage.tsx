import { FormEvent, useCallback, useEffect, useState } from 'react'
import { QrPrintModal } from '@/components/QrPrintModal'
import { QrCanvas } from '@/components/QrCanvas'
import { DeleteSectionDialog } from '@/components/DeleteSectionDialog'
import { Toast } from '@/components/Toast'
import { toUserMessage } from '@/api/client'
import { createObject, deleteObject, fetchObjects, updateObject } from '@/api/objectsApi'
import {
  createSection,
  fetchSections,
  updateSection,
} from '@/api/sectionsApi'
import { buildWorkFormUrlBySectionCode } from '@/lib/appConfig'
import { onSectionsChanged } from '@/lib/sectionEvents'
import type { NurseryObject, Section } from '@/lib/types'

type SectionWithObject = Section

export function ObjectsPage() {
  const [objects, setObjects] = useState<NurseryObject[]>([])
  const [sections, setSections] = useState<SectionWithObject[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [objName, setObjName] = useState('')
  const [objDesc, setObjDesc] = useState('')
  const [objSaving, setObjSaving] = useState(false)
  const [objError, setObjError] = useState<string | null>(null)

  const [secObjectId, setSecObjectId] = useState('')
  const [secName, setSecName] = useState('')
  const [secArea, setSecArea] = useState('')
  const [secCulture, setSecCulture] = useState('')
  const [secDesc, setSecDesc] = useState('')
  const [secSaving, setSecSaving] = useState(false)
  const [secError, setSecError] = useState<string | null>(null)

  const [editingObjId, setEditingObjId] = useState<number | null>(null)
  const [editObjName, setEditObjName] = useState('')
  const [editObjDesc, setEditObjDesc] = useState('')
  const [editObjSaving, setEditObjSaving] = useState(false)

  const [editingSecId, setEditingSecId] = useState<number | null>(null)
  const [editSecObjId, setEditSecObjId] = useState('')
  const [editSecName, setEditSecName] = useState('')
  const [editSecArea, setEditSecArea] = useState('')
  const [editSecCulture, setEditSecCulture] = useState('')
  const [editSecDesc, setEditSecDesc] = useState('')
  const [editSecSaving, setEditSecSaving] = useState(false)

  const [printSectionCode, setPrintSectionCode] = useState<string | null>(null)
  const [autoPrint, setAutoPrint] = useState(false)
  const [sectionToDelete, setSectionToDelete] = useState<SectionWithObject | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setObjError(null)
    try {
      const [o, s] = await Promise.all([fetchObjects(), fetchSections()])
      setObjects(o)
      setSections(s)
    } catch (err) {
      console.error('[objects]', err)
      setObjError(toUserMessage(err, 'Не удалось загрузить данные'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    return onSectionsChanged(() => {
      void reload()
    })
  }, [reload])

  async function handleCreateObject(e: FormEvent) {
    e.preventDefault()
    setObjError(null)
    if (!objName.trim()) {
      setObjError('Укажите название объекта')
      return
    }
    setObjSaving(true)
    try {
      await createObject({ name: objName.trim(), description: objDesc.trim() || undefined })
      setObjName('')
      setObjDesc('')
      setToast('Объект успешно сохранен')
      await reload()
    } catch (err) {
      console.error('[objects] create:', err)
      setObjError(toUserMessage(err))
    } finally {
      setObjSaving(false)
    }
  }

  function startEditObject(o: NurseryObject) {
    setEditingObjId(o.id)
    setEditObjName(o.name)
    setEditObjDesc(o.description ?? '')
  }

  async function handleSaveObject(e: FormEvent) {
    e.preventDefault()
    if (editingObjId == null) return
    setEditObjSaving(true)
    try {
      await updateObject(editingObjId, {
        name: editObjName.trim(),
        description: editObjDesc.trim() || undefined,
      })
      setEditingObjId(null)
      setToast('Объект обновлён')
      await reload()
    } catch (err) {
      console.error('[objects] update:', err)
      alert(toUserMessage(err))
    } finally {
      setEditObjSaving(false)
    }
  }

  async function handleDeleteObject(id: number) {
    if (!confirm('Удалить объект? Все участки этого объекта тоже будут удалены.')) return
    try {
      await deleteObject(id)
      setToast('Объект удалён')
      await reload()
    } catch (err) {
      console.error('[objects] delete:', err)
      alert(toUserMessage(err))
    }
  }

  async function handleCreateSection(e: FormEvent) {
    e.preventDefault()
    setSecError(null)
    if (!secObjectId) {
      setSecError('Выберите объект')
      return
    }
    if (!secName.trim()) {
      setSecError('Укажите название участка')
      return
    }
    setSecSaving(true)
    try {
      await createSection({
        objectId: Number(secObjectId),
        name: secName.trim(),
        area: secArea.trim() || undefined,
        culture: secCulture.trim() || undefined,
        customText: secDesc.trim() || undefined,
      })
      setSecName('')
      setSecArea('')
      setSecCulture('')
      setSecDesc('')
      setToast('Участок сохранён, QR-код создан')
      await reload()
    } catch (err) {
      console.error('[sections] create:', err)
      setSecError(toUserMessage(err))
    } finally {
      setSecSaving(false)
    }
  }

  function startEditSection(s: SectionWithObject) {
    setEditingSecId(s.id)
    setEditSecObjId(String(s.object_id))
    setEditSecName(s.name)
    setEditSecArea(s.area ?? '')
    setEditSecCulture(s.culture ?? '')
    setEditSecDesc(s.description ?? '')
  }

  async function handleSaveSection(e: FormEvent) {
    e.preventDefault()
    if (editingSecId == null) return
    setEditSecSaving(true)
    try {
      await updateSection(editingSecId, {
        objectId: Number(editSecObjId),
        name: editSecName.trim(),
        area: editSecArea.trim() || undefined,
        culture: editSecCulture.trim() || undefined,
        customText: editSecDesc.trim() || undefined,
      })
      setEditingSecId(null)
      setToast('Участок обновлён')
      await reload()
    } catch (err) {
      console.error('[sections] update:', err)
      alert(toUserMessage(err))
    } finally {
      setEditSecSaving(false)
    }
  }

  function handleSectionDeleted(id: number) {
    setSections((prev) => prev.filter((s) => s.id !== id))
    if (sectionToDelete?.id === id && printSectionCode === sectionToDelete.code) {
      setPrintSectionCode(null)
    }
    if (editingSecId === id) {
      setEditingSecId(null)
    }
    setToast('Участок успешно удален.')
  }

  const printSection = printSectionCode
    ? sections.find((s) => s.code === printSectionCode) ?? null
    : null

  if (loading) return <p className="text-slate-500">Загрузка…</p>

  function openPrint(section: SectionWithObject) {
    setPrintSectionCode(section.code)
    setAutoPrint(true)
  }

  function closePrint() {
    setPrintSectionCode(null)
    setAutoPrint(false)
  }

  return (
    <div className="no-print space-y-10">
      <h1 className="text-2xl font-bold">Объекты и участки</h1>
      <p className="text-sm text-slate-500">Данные хранятся на сервере (NestJS + PostgreSQL)</p>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Добавить объект</h2>
        <form onSubmit={handleCreateObject} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Название объекта *</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
                value={objName}
                onChange={(e) => setObjName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Описание</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
                value={objDesc}
                onChange={(e) => setObjDesc(e.target.value)}
              />
            </div>
          </div>
          {objError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{objError}</p>}
          <button
            type="submit"
            disabled={objSaving}
            className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {objSaving ? 'Сохранение…' : 'Сохранить объект'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Список объектов</h2>
        {objects.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
            Объектов пока нет
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Описание</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {objects.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-medium">
                      {editingObjId === o.id ? (
                        <form id={`obj-${o.id}`} onSubmit={handleSaveObject}>
                          <input
                            className="w-full rounded-lg border px-2 py-1.5 text-sm"
                            value={editObjName}
                            onChange={(e) => setEditObjName(e.target.value)}
                            required
                          />
                        </form>
                      ) : (
                        o.name
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingObjId === o.id ? (
                        <textarea
                          rows={2}
                          className="w-full rounded-lg border px-2 py-1.5 text-sm"
                          value={editObjDesc}
                          onChange={(e) => setEditObjDesc(e.target.value)}
                          form={`obj-${o.id}`}
                        />
                      ) : (
                        o.description ?? '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingObjId === o.id ? (
                        <button type="submit" form={`obj-${o.id}`} disabled={editObjSaving} className="text-xs text-emerald-700">
                          Сохранить
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => startEditObject(o)} className="text-xs underline">
                            Изменить
                          </button>
                          <button type="button" onClick={() => void handleDeleteObject(o.id)} className="text-xs text-red-600">
                            Удалить
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Добавить участок</h2>
        {objects.length === 0 ? (
          <p className="text-sm text-amber-800">Сначала добавьте объект</p>
        ) : (
          <form onSubmit={handleCreateSection} className="space-y-4">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              value={secObjectId}
              onChange={(e) => setSecObjectId(e.target.value)}
              required
            >
              <option value="">— объект —</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                placeholder="Название участка *"
                className="rounded-lg border px-3 py-2.5"
                value={secName}
                onChange={(e) => setSecName(e.target.value)}
                required
              />
              <input
                placeholder="Площадь"
                className="rounded-lg border px-3 py-2.5"
                value={secArea}
                onChange={(e) => setSecArea(e.target.value)}
              />
              <input
                placeholder="Культура"
                className="rounded-lg border px-3 py-2.5"
                value={secCulture}
                onChange={(e) => setSecCulture(e.target.value)}
              />
              <input
                placeholder="Доп. текст"
                className="rounded-lg border px-3 py-2.5"
                value={secDesc}
                onChange={(e) => setSecDesc(e.target.value)}
              />
            </div>
            {secError && <p className="text-sm text-red-600">{secError}</p>}
            <button
              type="submit"
              disabled={secSaving}
              className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {secSaving ? 'Сохранение…' : 'Сохранить участок'}
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Участки и QR</h2>
        {sections.length === 0 ? (
          <p className="text-slate-500">Участков пока нет</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-3">QR</th>
                  <th className="px-3 py-3">Код</th>
                  <th className="px-3 py-3">Участок</th>
                  <th className="px-3 py-3">Объект</th>
                  <th className="px-3 py-3">Культура</th>
                  <th className="px-3 py-3">Форма</th>
                  <th className="px-3 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sections.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">
                      <QrCanvas value={buildWorkFormUrlBySectionCode(s.code)} className="h-14 w-14" size={56} />
                    </td>
                    <td className="px-3 py-2 font-mono">{s.code}</td>
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2">{s.objects?.name ?? '—'}</td>
                    <td className="px-3 py-2">{s.culture ?? '—'}</td>
                    <td className="px-3 py-2">
                      <a
                        href={buildWorkFormUrlBySectionCode(s.code)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 underline"
                      >
                        открыть
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openPrint(s)}
                          className="text-xs text-emerald-700 underline"
                        >
                          Печать
                        </button>
                        <button type="button" onClick={() => startEditSection(s)} className="text-xs underline">
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => setSectionToDelete(s)}
                          className="text-xs text-red-600"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingSecId != null && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold">Редактирование участка</h3>
          <form
            onSubmit={handleSaveSection}
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <select
              value={editSecObjId}
              onChange={(e) => setEditSecObjId(e.target.value)}
              className="rounded-lg border px-3 py-2"
            >
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <input
              value={editSecName}
              onChange={(e) => setEditSecName(e.target.value)}
              className="rounded-lg border px-3 py-2"
            />
            <input
              value={editSecArea}
              onChange={(e) => setEditSecArea(e.target.value)}
              placeholder="Площадь"
              className="rounded-lg border px-3 py-2"
            />
            <input
              value={editSecCulture}
              onChange={(e) => setEditSecCulture(e.target.value)}
              placeholder="Культура"
              className="rounded-lg border px-3 py-2"
            />
            <input
              value={editSecDesc}
              onChange={(e) => setEditSecDesc(e.target.value)}
              placeholder="Доп. текст"
              className="rounded-lg border px-3 py-2 sm:col-span-2"
            />
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={editSecSaving} className="rounded-lg bg-emerald-700 px-4 py-2 text-white text-sm">
                Сохранить
              </button>
              <button type="button" onClick={() => setEditingSecId(null)} className="rounded-lg border px-4 py-2 text-sm">
                Отмена
              </button>
            </div>
          </form>
        </section>
      )}

      <QrPrintModal
        section={printSection}
        objectName={printSection?.objects?.name ?? '—'}
        formUrl={printSection ? buildWorkFormUrlBySectionCode(printSection.code) : ''}
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
