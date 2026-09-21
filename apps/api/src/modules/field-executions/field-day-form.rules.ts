import { BadRequestException } from '@nestjs/common';
import type { FormFieldSetting } from '../form-settings/form-settings.service';

export const coreResultFields = ['actualVolume', 'description', 'incompleteReason'];

export function normalizedExtra(extra: unknown): Record<string, string> {
  if (extra == null) return {};
  if (typeof extra !== 'object' || Array.isArray(extra) || Object.keys(extra).length > 50) {
    throw new BadRequestException('Некорректные дополнительные поля');
  }
  return Object.fromEntries(Object.entries(extra).map(([id, value]) => {
    if (typeof value !== 'string' || value.length > 1000) {
      throw new BadRequestException('Значение дополнительного поля должно быть текстом до 1000 символов');
    }
    return [id, value.trim()];
  }).filter(([, value]) => value !== ''));
}

export function validateFieldDayResult(fields: FormFieldSetting[], result: {
  taskId: number; percent: number; actualVolume?: string; description?: string; incompleteReason?: string; extra?: unknown;
}) {
  const values = normalizedExtra(result.extra);
  const custom = fields.filter(field => !coreResultFields.includes(field.id));
  if (Object.keys(values).some(id => !custom.some(field => field.id === id && field.visible))) {
    throw new BadRequestException('Настройки формы изменились. Обновите поля формы и повторите отправку');
  }
  const labels: Record<string, string> = {};
  for (const field of fields.filter(field => field.visible)) {
    if (field.id === 'description' && result.percent === 0) continue;
    if (field.id === 'incompleteReason' && result.percent === 100) continue;
    const value = coreResultFields.includes(field.id)
      ? result[field.id as 'actualVolume' | 'description' | 'incompleteReason']?.trim()
      : Object.prototype.hasOwnProperty.call(values, field.id) ? values[field.id] : undefined;
    if (!value) {
      if (field.required) throw new BadRequestException(`Для задачи ${result.taskId} заполните «${field.label}»`);
      continue;
    }
    if (field.type === 'number' || field.type === 'percent') {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)) ||
        (field.type === 'percent' && (Number(value) < 0 || Number(value) > 100))) {
        throw new BadRequestException(`В поле «${field.label}» укажите корректное число${field.type === 'percent' ? ' от 0 до 100' : ''}`);
      }
    }
    if (field.type === 'boolean' && !['true', 'false'].includes(value)) throw new BadRequestException(`В поле «${field.label}» выберите да или нет`);
    if (field.type === 'select' && !field.options?.includes(value)) throw new BadRequestException(`В поле «${field.label}» выберите вариант из списка`);
    if (!coreResultFields.includes(field.id)) labels[field.id] = field.label;
  }
  return Object.keys(values).length ? { extra: values, extraLabels: labels } : {};
}
