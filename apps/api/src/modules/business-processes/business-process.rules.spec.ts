import { applyValues, canReadField, validateSchema, validateTransition } from './business-process.rules';
import { PublishBusinessProcessDto } from './business-process.dto';

const fixture = (): PublishBusinessProcessDto => ({
  title: 'Уход за объектом', description: '', initialStageId: 'start',
  fields: [
    { id: 'area', label: 'Площадь, м²', type: 'number', hint: '', options: [], readRoles: ['WORKER', 'ADMIN'], editRoles: ['WORKER'] },
    { id: 'ready', label: 'Готовность', type: 'boolean', hint: '', options: [], readRoles: ['WORKER'], editRoles: ['WORKER'] },
    { id: 'date', label: 'Дата', type: 'date', hint: '', options: [], readRoles: ['WORKER'], editRoles: ['WORKER'] },
    { id: 'budget', label: 'Внутренняя сумма', type: 'number', hint: '', options: [], readRoles: ['ADMIN'], editRoles: ['ADMIN'] },
  ],
  stages: [
    { id: 'start', label: 'Начало', roles: ['WORKER'], requiredFields: ['area', 'ready'], nextStages: ['done'] },
    { id: 'done', label: 'Готово', roles: ['ADMIN'], requiredFields: [], nextStages: [] },
  ],
});
describe('Business process rules', () => {
  it('preserves zero and false as valid required values', () => {
    const schema = validateSchema(fixture()); const values = applyValues(schema, {}, { area: 0, ready: false }, 'WORKER');
    expect(() => validateTransition(schema, 'start', 'done', values, 'WORKER')).not.toThrow();
  });
  it.each([NaN, Infinity, '12', true, {}, 1e30])('rejects invalid numeric input %p', value => {
    expect(() => applyValues(validateSchema(fixture()), {}, { area: value }, 'WORKER')).toThrow();
  });
  it('rejects invalid dates and accepts leap day', () => {
    const schema = validateSchema(fixture());
    for (const date of ['2026-02-30', '2025-02-29', 'tomorrow']) expect(() => applyValues(schema, {}, { date }, 'WORKER')).toThrow();
    expect(applyValues(schema, {}, { date: '2028-02-29' }, 'WORKER').date).toBe('2028-02-29');
  });
  it('enforces edit permissions, known keys and field visibility', () => {
    const schema = validateSchema(fixture());
    expect(() => applyValues(schema, {}, { budget: 9 }, 'WORKER')).toThrow('Нет права');
    expect(() => applyValues(schema, {}, { missing: 9 }, 'ADMIN')).toThrow('Неизвестное');
    expect(canReadField('WORKER', schema.fields[3])).toBe(false);
    expect(applyValues(schema, {}, { budget: 9 }, 'DIRECTOR').budget).toBe(9);
  });
  it('checks transition roles and hides confidential missing-field labels', () => {
    const dto = fixture(); dto.stages[1].requiredFields = ['budget']; const schema = validateSchema(dto);
    expect(() => validateTransition(schema, 'start', 'done', { area: 0, ready: false }, 'WORKER')).toThrow('поле другого ответственного');
    expect(() => validateTransition(schema, 'start', 'done', { area: 0, ready: false, budget: 1 }, 'ADMIN')).toThrow('Ваша роль');
    expect(() => validateTransition(schema, 'start', 'start', {}, 'WORKER')).toThrow('переход');
  });
  it('rejects duplicate IDs, dangling references and inaccessible field edits', () => {
    const dto = fixture(); dto.fields.push(dto.fields[0]); expect(() => validateSchema(dto)).toThrow('повторяться');
    const bad = fixture(); bad.stages[0].requiredFields.push('missing'); expect(() => validateSchema(bad)).toThrow('неизвестное');
    const access = fixture(); access.fields[3].editRoles = ['WORKER']; expect(() => validateSchema(access)).toThrow('просмотра');
  });
  it('rejects unreachable stages and cycles without an exit', () => {
    const dto = fixture(); dto.stages.push({ id: 'lost', label: 'Потерян', roles: ['ADMIN'], requiredFields: [], nextStages: [] }); expect(() => validateSchema(dto)).toThrow('достижимы');
    const cycle = fixture(); cycle.stages[1].nextStages = ['start']; expect(() => validateSchema(cycle)).toThrow('путь к завершению');
  });
  it('validates select choices after trimming and clears values explicitly', () => {
    const dto = fixture(); dto.fields[0] = { ...dto.fields[0], type: 'select', options: ['Газон', ' Газон '] }; expect(() => validateSchema(dto)).toThrow('уникальные');
    dto.fields[0].options = ['Газон', 'Цветник']; const schema = validateSchema(dto);
    expect(() => applyValues(schema, {}, { area: 'Другое' }, 'WORKER')).toThrow('неизвестный вариант');
    expect(applyValues(schema, { area: 'Газон' }, { area: null }, 'WORKER')).toEqual({});
  });
});
