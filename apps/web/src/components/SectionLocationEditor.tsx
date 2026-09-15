import { useState, type FormEvent } from 'react'
import { updateSection } from '@/api/sectionsApi'
import { toUserMessage } from '@/api/client'
import { SectionLocationFields } from '@/components/SectionLocationFields'
import { locationPayload, type LocationDraft } from '@/lib/sectionLocation'
import type { Section } from '@/lib/types'

type EditableLocation = Pick<Section, 'id' | 'latitude' | 'longitude' | 'radius_meters'>

export function SectionLocationEditor({ section, onSaved }: {
  section: EditableLocation
  onSaved: (section: Section) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<LocationDraft>({ latitude: '', longitude: '', radius: '150' })
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function startEditing() {
    setDraft({
      latitude: section.latitude == null ? '' : String(section.latitude),
      longitude: section.longitude == null ? '' : String(section.longitude),
      radius: String(section.radius_meters ?? 150),
    })
    setError('')
    setSaved(false)
    setLocating(false)
    setEditing(true)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (saving || locating) return
    setError('')
    setSaving(true)
    try {
      // This action configures a usable location; an empty draft is not a success.
      const updated = await updateSection(section.id, locationPayload(draft, true))
      onSaved(updated)
      setEditing(false)
      setSaved(true)
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!editing) return <div className="space-y-2">
    <button type="button" onClick={startEditing} className="font-semibold text-blue-700 underline">
      Настроить местоположение участка
    </button>
    {saved && <p role="status" className="text-emerald-800">Координаты участка сохранены. QR остался прежним.</p>}
  </div>

  return <form aria-label="Настройка местоположения участка" onSubmit={save} className="space-y-3">
    <SectionLocationFields value={draft} onChange={setDraft} disabled={saving} onLocatingChange={setLocating} />
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={saving || locating} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
        {saving ? 'Сохраняем…' : 'Сохранить координаты'}
      </button>
      <button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded-lg border px-4 py-2">
        Отмена
      </button>
    </div>
  </form>
}
