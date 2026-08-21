import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormSetting } from '../../entities/form-setting.entity';
import { UpdateFormSettingsDto } from './dto/update-form-settings.dto';

type FormFieldType = 'text' | 'number' | 'percent' | 'select' | 'boolean' | 'comment' | 'photo';

type FormFieldSetting = {
  id: string;
  label: string;
  type: FormFieldType;
  hint: string | null;
  required: boolean;
  visible: boolean;
  order: number;
  system: boolean;
  options?: string[];
};

type WorkFormSettings = {
  formTitle: string;
  formDescription: string | null;
  formSubmitText: string;
  formSuccessText: string;
  formHints: string | null;
  fields: FormFieldSetting[];
};

const SETTINGS_KEY = 'work_form';
const FIELD_TYPES: FormFieldType[] = ['text', 'number', 'percent', 'select', 'boolean', 'comment', 'photo'];

const defaultFields: FormFieldSetting[] = [
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
];

export const defaultWorkFormSettings: WorkFormSettings = {
  formTitle: 'Отчет о выполненной работе',
  formDescription: 'Заполните форму после выполнения работы на участке',
  formSubmitText: 'Отправить',
  formSuccessText: 'Отчет успешно отправлен',
  formHints: 'Отсканируйте QR-код, заполните форму и отправьте отчет о выполненной работе.',
  fields: defaultFields,
};

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

@Injectable()
export class FormSettingsService {
  constructor(
    @InjectRepository(FormSetting)
    private readonly settingsRepo: Repository<FormSetting>,
  ) {}

  private normalizeField(raw: unknown, fallback?: FormFieldSetting): FormFieldSetting | null {
    if (!raw || typeof raw !== 'object') return fallback ?? null;
    const value = raw as Partial<FormFieldSetting>;
    const id = asString(value.id, fallback?.id ?? '');
    if (!id) return null;
    const type = FIELD_TYPES.includes(value.type as FormFieldType)
      ? (value.type as FormFieldType)
      : fallback?.type ?? 'text';
    const options = Array.isArray(value.options)
      ? value.options.map(String).map((o) => o.trim()).filter(Boolean)
      : fallback?.options;

    return {
      id,
      label: asString(value.label, fallback?.label ?? 'Новое поле'),
      type: fallback?.system ? fallback.type : type,
      hint: asNullableString(value.hint),
      required: typeof value.required === 'boolean' ? value.required : fallback?.required ?? false,
      visible: typeof value.visible === 'boolean' ? value.visible : fallback?.visible ?? true,
      order: Number.isFinite(Number(value.order)) ? Number(value.order) : fallback?.order ?? 100,
      system: fallback?.system ?? Boolean(value.system),
      options,
    };
  }

  private normalizeSettings(raw: unknown): WorkFormSettings {
    const value = raw && typeof raw === 'object' ? (raw as Partial<WorkFormSettings>) : {};
    const rawFields = Array.isArray(value.fields) ? value.fields : [];
    const normalizedFields: FormFieldSetting[] = [];

    for (const fallback of defaultFields) {
      const existing = rawFields.find((f) => {
        return f && typeof f === 'object' && (f as { id?: unknown }).id === fallback.id;
      });
      const normalized = this.normalizeField(existing, fallback);
      if (normalized) normalizedFields.push(normalized);
    }

    for (const field of rawFields) {
      if (!field || typeof field !== 'object') continue;
      const id = (field as { id?: unknown }).id;
      if (typeof id !== 'string' || defaultFields.some((f) => f.id === id)) continue;
      const normalized = this.normalizeField(field);
      if (normalized) normalizedFields.push({ ...normalized, system: false });
    }

    normalizedFields.sort((a, b) => a.order - b.order);

    return {
      formTitle: asString(value.formTitle, defaultWorkFormSettings.formTitle),
      formDescription: asNullableString(value.formDescription) ?? defaultWorkFormSettings.formDescription,
      formSubmitText: asString(value.formSubmitText, defaultWorkFormSettings.formSubmitText),
      formSuccessText: asString(value.formSuccessText, defaultWorkFormSettings.formSuccessText),
      formHints: asNullableString(value.formHints),
      fields: normalizedFields,
    };
  }

  async getSettings() {
    const row = await this.settingsRepo.findOne({ where: { key: SETTINGS_KEY } });
    if (!row) return defaultWorkFormSettings;
    try {
      return this.normalizeSettings(JSON.parse(row.settingsJson));
    } catch {
      return defaultWorkFormSettings;
    }
  }

  async updateSettings(dto: UpdateFormSettingsDto) {
    const settings = this.normalizeSettings(dto);
    if (!settings.fields.length) {
      throw new BadRequestException('Добавьте хотя бы одно поле формы');
    }

    let row = await this.settingsRepo.findOne({ where: { key: SETTINGS_KEY } });
    if (!row) {
      row = this.settingsRepo.create({ key: SETTINGS_KEY, settingsJson: '{}' });
    }
    row.settingsJson = JSON.stringify(settings);
    await this.settingsRepo.save(row);
    return settings;
  }
}
