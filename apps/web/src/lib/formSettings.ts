import type { FormSettings } from './types'
import { apiRequest } from '@/api/client'

export type FormKey = 'work_form' | 'field_day_form'

const STORAGE_KEYS: Record<FormKey, string> = {
  work_form: 'nursery_form_settings',
  field_day_form: 'nursery_field_day_form_settings',
}

// ---- Форма отчёта по объекту (легаси) ----
export const defaultFormSettings: FormSettings = {
  formTitle: 'Отчет о выполненной работе',
  formDescription: 'Заполните форму после выполнения работы на участке',
  formSubmitText: 'Отправить',
  formSuccessText: 'Отчет успешно отправлен',
  formHints: 'Отсканируйте QR-код, заполните форму и отправьте отчет о выполненной работе.',
  fields: [
    { id: 'workerName', label: 'ФИО работника', type: 'text', hint: null, required: true, visible: true, order: 10, system: true },
    {
      id: 'completionPercent',
      label: 'Процент выполнения',
      type: 'percent',
      hint: 'Выберите 25%, 50%, 75%, 100% или укажите другой процент.',
      required: true,
      visible: true,
      order: 30,
      system: true,
    },
    { id: 'photo', label: 'Фото', type: 'photo', hint: null, required: true, visible: true, order: 40, system: true },
    { id: 'comment', label: 'Комментарий', type: 'comment', hint: 'Необязательно', required: false, visible: true, order: 50, system: true },
    {
      id: 'geolocation',
      label: 'Геолокация',
      type: 'boolean',
      hint: 'Координаты помогут проверить место выполнения работ.',
      required: false,
      visible: true,
      order: 60,
      system: true,
    },
  ],
}

// ---- Форма «Рабочий день» (завершение дня). Процент — в коде (ядро), тут не настраивается. ----
export const defaultFieldDayFormSettings: FormSettings = {
  formTitle: 'Результат каждой задачи',
  formDescription: 'Заполните результат по каждой задаче при завершении рабочего дня',
  formSubmitText: 'Завершить рабочий день',
  formSuccessText: 'Рабочий день завершён',
  formHints: null,
  fields: [
    { id: 'actualVolume', label: 'Фактический объём', type: 'text', hint: 'Объём и единица измерения', required: false, visible: true, order: 10, system: true },
    { id: 'description', label: 'Что выполнено', type: 'comment', hint: null, required: true, visible: true, order: 20, system: true },
    { id: 'incompleteReason', label: 'Причина незавершения', type: 'comment', hint: 'Заполняется, если выполнено меньше 100%', required: true, visible: true, order: 30, system: true },
  ],
}

export function getDefaultSettings(form: FormKey): FormSettings {
  return form === 'field_day_form' ? defaultFieldDayFormSettings : defaultFormSettings
}

export function normalizeFormSettings(
  settings: Partial<FormSettings> | null | undefined,
  defaults: FormSettings = defaultFormSettings,
): FormSettings {
  const fields = Array.isArray(settings?.fields) ? settings.fields : []
  return {
    ...defaults,
    ...settings,
    fields: [
      ...defaults.fields.map((fallback) => {
        const existing = fields.find((f) => f.id === fallback.id)
        const merged = { ...fallback, ...existing, system: true, type: fallback.type }
        // Скрытое поле не может быть обязательным.
        return { ...merged, required: merged.visible ? merged.required : false }
      }),
      ...fields
        .filter((field) => !defaults.fields.some((fallback) => fallback.id === field.id))
        .map((field) => ({ ...field, required: field.visible ? field.required : false })),
    ].sort((a, b) => a.order - b.order),
  }
}

export function readStoredFormSettings(form: FormKey = 'work_form'): FormSettings {
  const defaults = getDefaultSettings(form)
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[form])
    if (!raw) return defaults
    return normalizeFormSettings(JSON.parse(raw) as Partial<FormSettings>, defaults)
  } catch {
    return defaults
  }
}

export function storeFormSettings(settings: FormSettings, form: FormKey = 'work_form'): void {
  try {
    localStorage.setItem(STORAGE_KEYS[form], JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

export async function fetchFormSettings(form: FormKey = 'work_form'): Promise<FormSettings> {
  const defaults = getDefaultSettings(form)
  try {
    const settings = normalizeFormSettings(await apiRequest<FormSettings>(`/form-settings?form=${form}`), defaults)
    storeFormSettings(settings, form)
    return settings
  } catch (err) {
    console.error('[form-settings/load]', err)
    return readStoredFormSettings(form)
  }
}

export async function saveFormSettings(settings: FormSettings, form: FormKey = 'work_form'): Promise<FormSettings> {
  const defaults = getDefaultSettings(form)
  const saved = normalizeFormSettings(
    await apiRequest<FormSettings>(`/form-settings?form=${form}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
    defaults,
  )
  storeFormSettings(saved, form)
  return saved
}
