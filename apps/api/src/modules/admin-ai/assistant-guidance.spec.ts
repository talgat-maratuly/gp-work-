import { UserRole } from '../../common/enums/user-role.enum';
import { assistantProfile, staffFallbackAnswer, type BriefForAnswer } from './assistant-guidance';
import { AdminAiService } from './admin-ai.service';

function brief(role: UserRole): BriefForAnswer {
  return { worker: { fullName: 'Сотрудник', role }, assistant: assistantProfile(role), date: '2026-09-11',
    summary: 'Доступные данные', recommendations: assistantProfile(role).recommendations,
    workDay: null, watering: [], tasks: [],
  };
}
describe('assistant responsibilities and honest answers', () => {
  it('distinguishes an agronomist account from the assistant and does not prescribe worker check-in', () => {
    const b = brief(UserRole.AGRONOMIST);
    expect(staffFallbackAnswer('Кто ты?', b)).toContain('роль: Агроном');
    expect(staffFallbackAnswer('Что мне делать сейчас?', b)).toContain('Приёмка работ');
    expect(staffFallbackAnswer('Что мне делать сейчас?', b)).not.toContain('отсканируйте QR');
  });
  it('answers check-out instead of repeating check-in when the worker has no open day', () => {
    expect(staffFallbackAnswer('Что нужно сделать перед уходом?', brief(UserRole.WORKER))).toContain('закрывать нечего');
    expect(staffFallbackAnswer('Как правильно начать рабочий день?', brief(UserRole.WORKER))).toContain('Начать рабочий день');
  });
  it('shows only reviewable completed tasks for a review question', () => {
    const b = brief(UserRole.AGRONOMIST);
    b.tasks = [
      { title: 'Готовая', objectName: 'Парк', sectionCode: 'S-1', dueDate: null, status: 'COMPLETED', nextAction: 'Проверьте результат', canReview: true },
      { title: 'Будущая', objectName: 'Парк', sectionCode: 'S-2', dueDate: '2026-09-15', status: 'ASSIGNED', nextAction: 'Уточните срок', canReview: true },
    ];
    const answer = staffFallbackAnswer('Что нужно проверить?', b);
    expect(answer).toContain('Готовая'); expect(answer).not.toContain('Будущая');
  });
  it('does not pretend to create tasks, grant director rights or answer an unrelated question', () => {
    expect(staffFallbackAnswer('Создай задачу', brief(UserRole.AGRONOMIST))).toContain('ничего не создал');
    expect(staffFallbackAnswer('Сделай меня директором', brief(UserRole.AGRONOMIST))).toContain('не меняет права');
    expect(staffFallbackAnswer('Какая погода?', brief(UserRole.WORKER))).toContain('нет надёжного ответа');
  });
  it('uses watering assignments for a water carrier', () => {
    const b = brief(UserRole.WATER_CARRIER);
    b.watering = [{ id: 7, objectName: 'Парк', status: 'PLANNED', plannedLiters: 7000 }];
    expect(staffFallbackAnswer('Какие поливы назначены?', b)).toContain('7000 л');
  });
});

describe('AI provider failure handling', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it.each(['network', 'http', 'empty', 'bad-json'])('returns an explicit fallback on %s errors', async (failure) => {
    global.fetch = jest.fn(async () => {
      if (failure === 'network') throw new Error('network');
      return { ok: failure !== 'http', status: 429, json: async () => {
        if (failure === 'bad-json') throw new Error('invalid JSON');
        return { choices: [] };
      } } as unknown as Response;
    });
    const service = Object.assign(Object.create(AdminAiService.prototype), {
      configService: { get: () => 'test-only' }, logger: { warn: jest.fn() },
    });
    expect(await service.requestAnswer('model', 'role', 'question', {}, () => 'Данные GP Work'))
      .toMatchObject({ answer: 'Данные GP Work', fallback: true, fallbackReason: 'provider_unavailable' });
  });
});
