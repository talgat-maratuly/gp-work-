import { UserRole } from '../../common/enums/user-role.enum';

export function assistantProfile(role: UserRole) {
  const profiles = {
    AGRONOMIST: {
      roleLabel: 'Агроном', title: 'Помощник агронома',
      responsibilities: 'Планирование агрономических работ, контроль своих поручений и проверка результата.',
      scopeLabel: 'Созданные вами поручения и назначенные вам или бригаде работы на сегодня',
      recommendations: ['Проверьте свои поручения в разделе «Задачи»: сроки, исполнителей и замечания.', 'Откройте «Приёмка работ» и проверьте готовые работы по своим поручениям.', 'При необходимости создайте задачу по уходу за участком и назначьте исполнителя.'],
      samples: ['Что мне делать сейчас?', 'Какие мои задачи просрочены?', 'Что нужно проверить?', 'Как создать задачу?'],
      links: [{ label: 'Мои поручения', to: '/admin/tasks' }, { label: 'Приёмка работ', to: '/admin/executions' }, { label: 'Объекты', to: '/admin/objects' }],
    },
    BRIGADIER: {
      roleLabel: 'Бригадир', title: 'Помощник бригадира',
      responsibilities: 'Распределение работ своей бригады, контроль маршрута и приёмка выполнения.',
      scopeLabel: 'Ваши задачи и задачи вашей бригады',
      recommendations: ['Проверьте задачи и маршрут своей бригады.', 'Назначьте исполнителей своей бригады и проверьте сроки.', 'Откройте «Приёмка работ» для проверки завершённых работ бригады.'],
      samples: ['Что мне делать сейчас?', 'Какие задачи у моей бригады?', 'Что нужно проверить?', 'Как создать задачу?'],
      links: [{ label: 'Задачи бригады', to: '/admin/tasks' }, { label: 'Маршруты', to: '/admin/routes' }, { label: 'Приёмка работ', to: '/admin/executions' }],
    },
    WATER_CARRIER: {
      roleLabel: 'Водовоз', title: 'Помощник водовоза',
      responsibilities: 'Выполнение назначенных поливов, учёт времени, объёма воды и фото результата.',
      scopeLabel: 'Назначенные вам поливы, ваши полевые задачи и задачи вашей бригады',
      recommendations: ['Откройте «Полив и водовозы» и проверьте назначенные вам поливы.', 'При выполнении укажите фактический объём воды, время и фото.', 'Если назначений нет, уточните маршрут у бригадира.'],
      samples: ['Какие поливы мне назначены?', 'Что мне делать сейчас?', 'Как завершить полив?'],
      links: [{ label: 'Полив и водовозы', to: '/admin/watering' }, { label: 'Полевые задачи', to: '/field/tasks' }],
    },
    WORKER: {
      roleLabel: 'Рабочий', title: 'Помощник рабочего',
      responsibilities: 'Выполнение назначенных работ, отметки прихода и ухода, фотоотчёт.',
      scopeLabel: 'Ваши задачи и задачи вашей бригады',
      recommendations: [],
      samples: ['Что мне делать сейчас?', 'Как правильно начать рабочий день?', 'Что нужно сделать перед уходом?'],
      links: [{ label: 'Мои задачи', to: '/field/tasks' }, { label: 'Открыть QR', to: '/field/qr' }],
    },
  };
  return profiles[role as keyof typeof profiles] ?? profiles.WORKER;
}

export type BriefForAnswer = {
  worker: { fullName: string; role: UserRole };
  assistant: ReturnType<typeof assistantProfile>;
  summary: string; recommendations: string[];
  workDay: unknown;
  tasks: { title: string; objectName: string; sectionCode: string; dueDate: string | null; status: string; nextAction: string; canReview: boolean }[];
  watering: { id: number; objectName: string; status: string; plannedLiters: number | null }[];
  date: string;
};

export function staffFallbackAnswer(question: string, brief: BriefForAnswer): string {
  const q = question.toLowerCase().replace(/ё/g, 'е');
  const { assistant, worker } = brief;
  const wateringLabels: Record<string, string> = { PLANNED: 'Запланирован', IN_PROGRESS: 'В работе', DONE: 'Выполнен', SKIPPED: 'Пропущен', NEEDS_REVIEW: 'Нужна проверка' };
  if (/кто (ты|я)|моя роль|почему.*агроном|что (ты )?умеешь|помощь|привет|здравствуй/.test(q)) {
    return `Вы вошли как ${worker.fullName}, роль: ${assistant.roleLabel}. Я — ${assistant.title.toLowerCase()}. ${assistant.responsibilities}\nДоступные данные: ${assistant.scopeLabel.toLowerCase()}.`;
  }
  if (/директор|сменить.*(роль|аккаунт)|друг.*аккаунт|выйти|назад|вернут/.test(q)) {
    return `Ваш аккаунт: ${worker.fullName} — ${assistant.roleLabel}. Кнопка «В кабинет» сверху возвращает в ваш кабинет. Кнопка «Выйти» завершает сеанс. ИИ-директор доступен только в аккаунте директора или администратора; для этого выйдите и войдите под нужным аккаунтом. Ассистент не меняет права доступа.`;
  }
  if (/созда|назначь|назначить|как\s+.*назнач|распредел|отправ.*задач/.test(q)) {
    return ['AGRONOMIST', 'BRIGADIER'].includes(worker.role)
      ? 'Откройте «Задачи», укажите участок, вид работы, исполнителя и срок, затем сохраните. Бригадир назначает только свою бригаду; агроном контролирует созданные им поручения. Я ничего не создал и не назначил.'
      : 'Задачи назначает руководитель. Уточните участок, вид работы и срок у бригадира. Я не создаю и не меняю назначения.';
  }
  if (worker.role === UserRole.WATER_CARRIER && /полив|вод|рейс/.test(q)) {
    if (/заверш|закры|уход/.test(q)) return 'В разделе «Полив и водовозы» откройте свой полив, укажите фактические литры, время и фото результата, затем сохраните завершение. Изменения выполняются в форме полива.';
    return brief.watering.length ? brief.watering.map(w => `Полив #${w.id}: ${w.objectName}; план: ${w.plannedLiters == null ? 'не указан' : `${w.plannedLiters} л`}; статус: ${wateringLabels[w.status] ?? w.status}.`).join('\n') : 'На сегодня вам не назначены поливы. Уточните маршрут у бригадира.';
  }
  if (/начать.*(день|смен)|начал.*(дня|смен)|уйти|уход|законч|закрыть.*(день|смен)|завершить.*(день|смен)/.test(q)) {
    if (worker.role !== UserRole.WORKER) return `${assistant.responsibilities}\n${assistant.recommendations.join('\n')}\nQR, GPS и селфи нужны при личном выполнении полевой работы, а не для открытия вашего кабинета.`;
    if (/уйти|уход|законч|закры|заверш/.test(q)) return brief.workDay ? 'Отсканируйте QR участка, подтвердите GPS, сделайте три кадра лица и фото результата, укажите выполненные работы и процент, затем завершите рабочий день.' : 'Открытого рабочего дня нет — закрывать нечего. Если вы работали без отметки прихода, обратитесь к руководителю для проверки.';
    return brief.workDay ? 'Ваш рабочий день уже открыт. Перейдите к назначенной задаче; повторно начинать смену не нужно.' : 'На участке отсканируйте QR, разрешите GPS, сделайте три кадра лица и фото ДО, затем нажмите «Начать рабочий день». Если координаты участка не настроены, попросите руководителя заполнить их.';
  }
  if (/задач|поручен|просроч|провери|приемк|готов.*работ/.test(q)) {
    const rows = brief.tasks.filter(t => /просроч/.test(q) ? !!t.dueDate && t.dueDate < brief.date && t.status !== 'COMPLETED' : /провери|приемк|готов.*работ/.test(q) ? t.canReview && t.status === 'COMPLETED' : true);
    return rows.length ? rows.slice(0, 10).map((t, i) => `${i + 1}. ${t.title} — ${t.objectName}, ${t.sectionCode}. ${t.nextAction}`).join('\n') : `По запросу в доступных вам данных задач нет. Область проверки: ${assistant.scopeLabel.toLowerCase()}.`;
  }
  if (/что.*делать|дальше|сейчас|план|приоритет/.test(q)) return [brief.summary, ...brief.recommendations].join('\n');
  return `Сейчас доступны подсказки по данным GP Work без ИИ-модели. На этот вопрос у меня нет надёжного ответа. Могу помочь по вашей роли «${assistant.roleLabel}»: ${assistant.samples.join(' / ')}. Уточните задачу или раздел.`;
}
