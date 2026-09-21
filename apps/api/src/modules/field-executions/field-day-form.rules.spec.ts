import { defaultFieldDayFormSettings, type FormFieldSetting } from '../form-settings/form-settings.service';
import { normalizedExtra, validateFieldDayResult } from './field-day-form.rules';

const field = (id: string, type: FormFieldSetting['type'] = 'text'): FormFieldSetting =>
  ({ id, label: id, type, hint: null, visible: true, required: true, order: 10, system: false });
const result = { taskId: 1, percent: 100, description: 'Готово' };

describe('field day configurable results', () => {
  it('preserves the default completion rules and permits configured optional fields', () => {
    const fields = defaultFieldDayFormSettings.fields;
    expect(() => validateFieldDayResult(fields, { taskId: 1, percent: 50 })).toThrow();
    expect(() => validateFieldDayResult(fields, { ...result, percent: 50 })).toThrow();
    expect(validateFieldDayResult(fields, result)).toEqual({});
    expect(validateFieldDayResult(fields.map(f => ({ ...f, required: false, visible: false })), { taskId: 1, percent: 0 })).toEqual({});
  });
  it('retains zero, false and the field labels used when the work was submitted', () => {
    expect(validateFieldDayResult([field('liters', 'number'), field('checked', 'boolean')], {
      ...result, extra: { liters: '0', checked: 'false' },
    })).toEqual({ extra: { liters: '0', checked: 'false' }, extraLabels: { liters: 'liters', checked: 'checked' } });
  });
  it.each([123, [], { x: {} }, { x: false }, { x: 'a'.repeat(1001) }])('rejects malformed payload %j with a client error', extra => {
    expect(() => normalizedExtra(extra)).toThrow();
  });
  it.each(['NaN', 'Infinity', '0x12', '1e9999', '1,2'])('rejects invalid number %s', value => {
    expect(() => validateFieldDayResult([field('n', 'number')], { ...result, extra: { n: value } })).toThrow();
  });
  it('rejects hidden/unknown fields and invalid select, boolean and percentage values', () => {
    expect(() => validateFieldDayResult([{ ...field('x'), visible: false }], { ...result, extra: { x: 'secret' } })).toThrow();
    expect(() => validateFieldDayResult([], { ...result, extra: { unknown: 'x' } })).toThrow();
    expect(() => validateFieldDayResult([{ ...field('x', 'select'), options: ['A'] }], { ...result, extra: { x: 'B' } })).toThrow();
    expect(() => validateFieldDayResult([field('x', 'boolean')], { ...result, extra: { x: 'yes' } })).toThrow();
    expect(() => validateFieldDayResult([field('x', 'percent')], { ...result, extra: { x: '101' } })).toThrow();
  });
});
