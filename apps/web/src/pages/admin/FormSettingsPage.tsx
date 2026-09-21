import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Toast } from '@/components/Toast'
import { fetchFormSettings, getDefaultSettings, saveFormSettings, type FormKey } from '@/lib/formSettings'
import { toUserMessage } from '@/api/client'
import type { FormFieldSetting, FormFieldType, FormSettings } from '@/lib/types'

const fieldTypeLabels: Record<FormFieldType, string> = {
  text: 'текст',
  number: 'число',
  percent: 'процент',
  select: 'список',
  boolean: 'да/нет',
  comment: 'комментарий',
  photo: 'фото',
}

const fieldTypeOptions = Object.entries(fieldTypeLabels).map(([value, label]) => ({ value, label }))

const FORM_TABS: { key: FormKey; label: string }[] = [
  { key: 'field_day_form', label: 'Форма «Рабочий день»' },
  { key: 'work_form', label: 'Форма отчёта по объекту' },
  { key: 'checkout_form', label: 'Форма отметки ухода' },
]

function normalizeOrders(fields: FormFieldSetting[]): FormFieldSetting[] {
  return fields.map((field, index) => ({ ...field, order: (index + 1) * 10 }))
}

export function FormSettingsPage() {
  const [activeForm, setActiveForm] = useState<FormKey>('field_day_form')
  const [settings, setSettings] = useState<FormSettings>(getDefaultSettings('field_day_form'))
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<FormFieldType>('text')
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Загружаем настройки активной формы с сервера при смене вкладки.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoaded(false)
    setToast(null)
    setNewFieldType('text')
    setNewFieldLabel('')
    setError(null)
    fetchFormSettings(activeForm)
      .then((s) => { if (!cancelled) { setSettings(s); setLoaded(true) } })
      .catch((err) => !cancelled && setError(toUserMessage(err, 'Не удалось загрузить настройки формы')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [activeForm, loadAttempt])

  function updateSettings(patch: Partial<FormSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  function updateField(id: string, patch: Partial<FormFieldSetting>) {
    setSettings((prev) => ({
      ...prev,
      fields: prev.fields.map((field) => {
        if (field.id !== id) return field
        const next = { ...field, ...patch }
        // Скрытое поле не может быть обязательным.
        if (next.visible === false) next.required = false
        return next
      }),
    }))
  }

  function moveField(id: string, direction: -1 | 1) {
    setSettings((prev) => {
      const fields = [...prev.fields].sort((a, b) => a.order - b.order)
      const index = fields.findIndex((field) => field.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= fields.length) return prev
      const [field] = fields.splice(index, 1)
      fields.splice(nextIndex, 0, field)
      return { ...prev, fields: normalizeOrders(fields) }
    })
  }

  function removeField(id: string) {
    setSettings((prev) => ({
      ...prev,
      fields: normalizeOrders(prev.fields.filter((field) => field.id !== id)),
    }))
  }

  function addField() {
    const label = newFieldLabel.trim()
    if (!label) {
      setError('Укажите название нового поля')
      return
    }
    const maxOrder = Math.max(0, ...settings.fields.map((field) => field.order))
    const field: FormFieldSetting = {
      id: `extra-${Date.now()}`,
      label,
      type: newFieldType,
      hint: null,
      required: false,
      visible: true,
      order: maxOrder + 10,
      system: false,
      options: newFieldType === 'select' ? ['Вариант 1', 'Вариант 2'] : undefined,
    }
    setSettings((prev) => ({ ...prev, fields: [...prev.fields, field] }))
    setNewFieldLabel('')
    setNewFieldType('text')
    setError(null)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!loaded || loading || saving) return
    setSaving(true)
    setError(null)
    try {
      const savedSettings = await saveFormSettings(
        {
          ...settings,
          formTitle: settings.formTitle.trim(),
          formDescription: settings.formDescription?.trim() || null,
          formSubmitText: settings.formSubmitText.trim(),
          formSuccessText: settings.formSuccessText.trim(),
          formHints: settings.formHints?.trim() || null,
          fields: normalizeOrders(settings.fields),
        },
        activeForm,
      )
      setSettings(savedSettings)
      setToast('Настройки успешно сохранены')
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось сохранить настройки формы'))
    } finally {
      setSaving(false)
    }
  }

  const sortedFields = [...settings.fields].sort((a, b) => a.order - b.order)
  const isCheckout = activeForm === 'checkout_form'
  const isFieldDay = activeForm === 'field_day_form'
  const allowedFieldTypes = fieldTypeOptions.filter(option => !isFieldDay || option.value !== 'photo')

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-blue-800">Настройки формы</h1>

      {/* Вкладки — две независимые формы */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {FORM_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={saving}
            onClick={() => setActiveForm(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeForm === t.key ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-600">
        {isFieldDay
          ? 'Эти поля заполняет сотрудник по каждой задаче при завершении рабочего дня. Можно менять подписи, порядок и обязательность, добавлять свои поля. Процент, QR, GPS, фото лица и фото результата остаются обязательной частью рабочего цикла.'
          : isCheckout
          ? 'Сохранённые настройки прежней формы «Отметка ухода». Теперь QR открывает рабочий день: процент рассчитывается по результатам назначенных задач. Эти настройки не изменяют текущий рабочий день.'
          : 'Сохранённые настройки прежней формы отчёта. Теперь QR открывает рабочий день с назначенными задачами. Эти настройки не изменяют текущий рабочий день.'}
      </p>

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <fieldset disabled={loading || saving || !loaded} className="space-y-4">
        <Input
          label="Заголовок формы"
          value={settings.formTitle}
          onChange={(e) => updateSettings({ formTitle: e.target.value })}
          required
        />
        <Textarea
          label="Описание формы"
          value={settings.formDescription ?? ''}
          onChange={(e) => updateSettings({ formDescription: e.target.value })}
        />
        <Input
          label="Текст кнопки отправки"
          value={settings.formSubmitText}
          onChange={(e) => updateSettings({ formSubmitText: e.target.value })}
          required
        />
        <Input
          label="Текст после успешной отправки"
          value={settings.formSuccessText}
          onChange={(e) => updateSettings({ formSuccessText: e.target.value })}
          required
        />
        <Textarea
          label="Общие подсказки"
          value={settings.formHints ?? ''}
          onChange={(e) => updateSettings({ formHints: e.target.value })}
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-lg font-semibold">Поля формы</h2>
          <p className="mt-1 text-sm text-slate-600">
            Можно менять название, подсказку, обязательность, видимость и порядок.
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Загрузка…</p>
          ) : (
            <div className="mt-4 space-y-3">
              {sortedFields.map((field, index) => (
                <div key={field.id} role="group" aria-label={`Поле ${field.label}`} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{field.label || 'Без названия'}</p>
                      <p className="text-xs text-slate-500">
                        {field.system ? 'Системное поле' : 'Дополнительное поле'} · {fieldTypeLabels[field.type]}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" onClick={() => moveField(field.id, -1)} disabled={index === 0}>
                        Выше
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => moveField(field.id, 1)}
                        disabled={index === sortedFields.length - 1}
                      >
                        Ниже
                      </Button>
                      {!field.system && (
                        <Button variant="danger" onClick={() => removeField(field.id)}>
                          Удалить
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      label="Название поля"
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      required
                    />
                    <Select
                      label="Тип поля"
                      value={field.type}
                      onChange={(e) => updateField(field.id, { type: e.target.value as FormFieldType })}
                      options={allowedFieldTypes}
                      disabled={field.system}
                    />
                  </div>

                  <Textarea
                    label="Подсказка"
                    value={field.hint ?? ''}
                    onChange={(e) => updateField(field.id, { hint: e.target.value })}
                    className="mt-3"
                  />

                  {field.type === 'select' && (
                    <Textarea
                      label="Варианты списка"
                      value={(field.options ?? []).join('\n')}
                      onChange={(e) =>
                        updateField(field.id, {
                          options: e.target.value
                            .split('\n')
                            .map((option) => option.trim())
                            .filter(Boolean),
                        })
                      }
                      className="mt-3"
                    />
                  )}

                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.visible}
                        onChange={(e) => updateField(field.id, { visible: e.target.checked })}
                      />
                      Показывать поле
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.required}
                        disabled={!field.visible}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                      />
                      Обязательное поле
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/50 p-4">
          <h2 className="text-lg font-semibold text-blue-900">Добавить дополнительное поле</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
            <Input
              label="Название"
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="Например, Причина незавершения работы"
            />
            <Select
              label="Тип"
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as FormFieldType)}
              options={allowedFieldTypes}
            />
            <Button onClick={addField}>Добавить</Button>
          </div>
        </div>

        <Button type="submit" disabled={saving || !loaded}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {!loaded && !loading && <Button onClick={() => setLoadAttempt(value => value + 1)}>Повторить загрузку</Button>}
      </form>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
