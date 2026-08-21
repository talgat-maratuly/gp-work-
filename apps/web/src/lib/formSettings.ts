import type { FormSettings } from './types'
import { apiRequest } from '@/api/client'

const STORAGE_KEY = 'nursery_form_settings'

export const defaultFormSettings: FormSettings = {
  formTitle: 'Отчет о выполненной работе',
  formDescription: 'Заполните форму после выполнения работы на участке',
  formSubmitText: 'Отправить',
  formSuccessText: 'Отчет успешно отправлен',
  formHints: 'Отсканируйте QR-код, заполните форму и отправьте отчет о выполненной работе.',
  fields: [
    {
      id: 'workerName',
      label: 'ФИО работника',
      type: 'text',
      hint: null,
      required: true,
      visible: true,
      order: 10,
      system: true,
    },
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
    {
      id: 'photo',
      label: 'Фото',
      type: 'photo',
      hint: null,
      required: true,
      visible: true,
      order: 40,
      system: true,
    },
    {
      id: 'comment',
      label: 'Комментарий',
      type: 'comment',
      hint: 'Необязательно',
      required: false,
      visible: true,
      order: 50,
      system: true,
    },
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

export function normalizeFormSettings(settings: Partial<FormSettings> | null | undefined): FormSettings {
  const fields = Array.isArray(settings?.fields) ? settings.fields : []
  return {
    ...defaultFormSettings,
    ...settings,
    fields: [
      ...defaultFormSettings.fields.map((fallback) => {
        const existing = fields.find((f) => f.id === fallback.id)
        return { ...fallback, ...existing, system: true, type: fallback.type }
      }),
      ...fields.filter((field) => !defaultFormSettings.fields.some((fallback) => fallback.id === field.id)),
    ].sort((a, b) => a.order - b.order),
  }
}

export function readStoredFormSettings(): FormSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultFormSettings
    return normalizeFormSettings(JSON.parse(raw) as Partial<FormSettings>)
  } catch {
    return defaultFormSettings
  }
}

export function storeFormSettings(settings: FormSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export async function fetchFormSettings(): Promise<FormSettings> {
  try {
    const settings = normalizeFormSettings(await apiRequest<FormSettings>('/form-settings'))
    storeFormSettings(settings)
    return settings
  } catch (err) {
    console.error('[form-settings/load]', err)
    return readStoredFormSettings()
  }
}

export async function saveFormSettings(settings: FormSettings): Promise<FormSettings> {
  const saved = normalizeFormSettings(
    await apiRequest<FormSettings>('/form-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  )
  storeFormSettings(saved)
  return saved
}
