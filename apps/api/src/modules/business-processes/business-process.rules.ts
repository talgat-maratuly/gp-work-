import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BusinessFieldDto, PublishBusinessProcessDto } from './business-process.dto';

export type ProcessSchema = Pick<PublishBusinessProcessDto, 'title' | 'description' | 'initialStageId' | 'fields' | 'stages'>;
export const roleAllowed = (role: string, allowed: string[]) => allowed.includes(role) || (role === 'DIRECTOR' && allowed.includes('ADMIN'));
export const canReadField = (role: string, field: BusinessFieldDto) => ['ADMIN', 'DIRECTOR'].includes(role) || roleAllowed(role, field.readRoles);

export function validateSchema(dto: PublishBusinessProcessDto): ProcessSchema {
  const schema: ProcessSchema = {
    title: dto.title.trim(), description: dto.description.trim(), initialStageId: dto.initialStageId,
    fields: dto.fields.map(f => ({ ...f, label: f.label.trim(), hint: f.hint.trim(), options: f.options.map(o => o.trim()) })),
    stages: dto.stages.map(s => ({ ...s, label: s.label.trim() })),
  };
  if (!schema.title || schema.fields.some(f => !f.label || ['constructor', 'prototype', '__proto__'].includes(f.id)) || schema.stages.some(s => !s.label)) {
    throw new BadRequestException('Названия не могут быть пустыми; используйте безопасные коды полей');
  }
  if (new Set(schema.fields.map(f => f.id)).size !== schema.fields.length || new Set(schema.stages.map(s => s.id)).size !== schema.stages.length) {
    throw new BadRequestException('Коды полей и этапов не должны повторяться');
  }
  const fieldIds = new Set(schema.fields.map(f => f.id));
  const stages = new Map(schema.stages.map(s => [s.id, s]));
  if (!stages.has(schema.initialStageId)) throw new BadRequestException('Выберите начальный этап');
  for (const field of schema.fields) {
    if (field.editRoles.some(r => !canReadField(r, field))) throw new BadRequestException(`Поле «${field.label}»: право изменения требует права просмотра`);
    if (field.type === 'select' && (!field.options.length || field.options.some(o => !o) || new Set(field.options).size !== field.options.length)) {
      throw new BadRequestException(`Поле «${field.label}»: задайте непустые уникальные варианты`);
    }
    if (field.type !== 'select' && field.options.length) throw new BadRequestException('Варианты допустимы только для поля «Список»');
  }
  for (const stage of schema.stages) {
    if (stage.requiredFields.some(id => !fieldIds.has(id)) || stage.nextStages.some(id => !stages.has(id) || id === stage.id)) {
      throw new BadRequestException(`Этап «${stage.label}» ссылается на неизвестное поле или недопустимый переход`);
    }
  }
  const reachable = new Set<string>();
  function visit(id: string) { if (reachable.has(id)) return; reachable.add(id); stages.get(id)!.nextStages.forEach(visit); }
  visit(schema.initialStageId);
  if (reachable.size !== stages.size) throw new BadRequestException('Все этапы должны быть достижимы из начального');
  const canFinish = new Set(schema.stages.filter(s => !s.nextStages.length).map(s => s.id));
  for (let i = 0; i < stages.size; i++) for (const s of schema.stages) if (s.nextStages.some(id => canFinish.has(id))) canFinish.add(s.id);
  if (canFinish.size !== stages.size || !stages.get(schema.initialStageId)!.nextStages.length) throw new BadRequestException('Из каждого этапа должен существовать путь к завершению');
  return schema;
}

export function applyValues(schema: ProcessSchema, old: Record<string, unknown>, patch: Record<string, unknown>, role: string) {
  const result = { ...old };
  const fields = new Map(schema.fields.map(f => [f.id, f]));
  if (Object.keys(patch).length > 50) throw new BadRequestException('Слишком много полей');
  for (const [id, raw] of Object.entries(patch)) {
    const f = fields.get(id);
    if (!f) throw new BadRequestException('Неизвестное бизнес-поле');
    if (!roleAllowed(role, f.editRoles)) throw new ForbiddenException('Нет права изменять одно из полей');
    if (raw === null) { delete result[id]; continue; }
    let value = raw;
    if (f.type === 'text' || f.type === 'date' || f.type === 'select') {
      if (typeof raw !== 'string' || raw.length > 4000) throw new BadRequestException(`Поле «${f.label}»: требуется текст до 4000 символов`);
      value = raw.trim();
      if (value === '') { delete result[id]; continue; }
    }
    if (f.type === 'number' && (typeof raw !== 'number' || !Number.isFinite(raw) || Math.abs(raw) > Number.MAX_SAFE_INTEGER)) throw new BadRequestException(`Поле «${f.label}»: требуется конечное число`);
    if (f.type === 'boolean' && typeof raw !== 'boolean') throw new BadRequestException(`Поле «${f.label}»: выберите да или нет`);
    if (f.type === 'select' && !f.options.includes(value as string)) throw new BadRequestException(`Поле «${f.label}»: неизвестный вариант`);
    if (f.type === 'date') {
      const date = value as string;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new BadRequestException(`Поле «${f.label}»: укажите существующую дату`);
    }
    result[id] = value;
  }
  return result;
}

export function validateTransition(schema: ProcessSchema, from: string, to: string, values: Record<string, unknown>, role: string) {
  const stage = schema.stages.find(s => s.id === from)!;
  const next = schema.stages.find(s => s.id === to);
  if (!roleAllowed(role, stage.roles)) throw new ForbiddenException('Ваша роль не может завершать этот этап');
  if (!next || !stage.nextStages.includes(to)) throw new BadRequestException('Этот переход не разрешён');
  const missing = [...new Set([...stage.requiredFields, ...next.requiredFields])].filter(id => values[id] === undefined || values[id] === null || values[id] === '');
  if (missing.length) {
    const names = missing.map(id => { const f = schema.fields.find(v => v.id === id)!; return canReadField(role, f) ? f.label : 'поле другого ответственного'; });
    throw new BadRequestException(`Заполните обязательные поля: ${names.join(', ')}`);
  }
}
