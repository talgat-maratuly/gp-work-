import { useState } from 'react'
import type { FormFieldSetting, FormSettings } from '@/lib/types'

// One renderer for the actual worker form and both previews. Hidden fields
// must never be restored by a fallback or a separate hard-coded layout.
export function ResultFields({ fields, percent, valueOf, onChange }: {
  fields: FormFieldSetting[]; percent: number
  valueOf: (field: FormFieldSetting) => string
  onChange: (field: FormFieldSetting, value: string) => void
}) {
  return <>{fields.filter(field => field.visible && (field.id !== 'incompleteReason' || percent < 100))
    .sort((a, b) => a.order - b.order).map(field => {
      const required = field.required && !(field.id === 'description' && percent === 0)
      const props = { value: valueOf(field), required, placeholder: field.hint || field.label, className: 'w-full rounded-lg border p-2', 'aria-label': field.label }
      return <label key={field.id} className="block text-sm">
        <span>{field.label}{required ? ' *' : ''}</span>
        {field.type === 'comment' ? <textarea {...props} maxLength={1000} onChange={event => onChange(field, event.target.value)} />
          : ['select', 'boolean'].includes(field.type) ? <select {...props} onChange={event => onChange(field, event.target.value)}>
            <option value="">Выберите</option>
            {(field.type === 'boolean' ? [{ value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }]
              : (field.options ?? []).map(value => ({ value, label: value }))).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <input {...props} type={['number', 'percent'].includes(field.type) ? 'number' : 'text'}
            step="any" min={field.type === 'percent' ? 0 : undefined} max={field.type === 'percent' ? 100 : undefined}
            maxLength={field.id === 'actualVolume' ? 200 : 1000} onChange={event => onChange(field, event.target.value)} />}
        {field.hint && <span className="mt-1 block text-xs text-slate-500">{field.hint}</span>}
      </label>
    })}</>
}

export function ResultFormPreview({ settings }: { settings: FormSettings }) {
  const [percent, setPercent] = useState(50)
  return <section aria-label="Предпросмотр полей формы" className="space-y-3 rounded-xl border bg-white p-4">
    <h2 className="text-lg font-bold">{settings.formTitle}</h2>
    {settings.formDescription && <p className="text-sm text-slate-600">{settings.formDescription}</p>}
    <p className="text-sm text-slate-600">Образец полей результата одной задачи. Это просмотр, данные не отправляются.</p>
    <label className="block text-sm">Процент в предпросмотре: {percent}%<input aria-label="Процент в предпросмотре" type="range" className="w-full" min="0" max="100" value={percent} onChange={e => setPercent(Number(e.target.value))}/></label>
    <fieldset disabled className="space-y-3"><ResultFields fields={settings.fields} percent={percent} valueOf={() => ''} onChange={() => undefined}/></fieldset>
    {settings.formHints && <p className="text-sm text-slate-600">{settings.formHints}</p>}
  </section>
}
