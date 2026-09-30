import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UserRole } from '../../common/enums/user-role.enum';

export const SECTION_NAMES: Record<string, string> = {
  objects:'Объекты', sections:'Участки', 'work-types':'Виды работ', 'vehicle-types':'Виды техники', 'work-logs':'Журнал работ',
  brigades:'Бригады', tasks:'Задачи', routes:'Маршруты', attendance:'Табель и личный рабочий день',
  field:'Полевые работы и приёмка', products:'Склад', 'stock-movements':'Движение материалов',
  resources:'Техника и ресурсы', workflow:'Работа и улучшения', 'business-processes':'Бизнес-процессы',
  schedule:'График', watering:'Полив', management:'Управление', 'admin-reports':'Отчёты',
  operations:'Диспетчерская, KPI и отчёты по работам', dashboard:'Сводка компании',
  'admin-ai':'ИИ-помощники', 'ai-agronom':'ИИ-агроном', 'form-settings':'Настройки формы',
  export:'Экспорт', uploads:'Загрузка фото', 'uploads/photos':'Просмотр фото', qr:'QR-паспорта',
  users:'Сотрудники', 'job-positions':'Должности',
};
export const PAGE_NAMES: Record<string, string> = {
  '/admin/overview':'Сводка компании', '/admin/director':'Кабинет директора',
  '/admin/dispatcher':'Диспетчерская', '/admin/executions':'Приёмка работ', '/admin/workflow':'Работа и улучшения',
  '/admin/tasks':'Задачи', '/admin/routes':'Маршруты', '/admin/map':'Карта', '/admin/work-logs':'Журнал работ',
  '/admin/schedule':'График', '/admin/watering':'Полив и водовозы', '/my-work-day':'Мой рабочий день',
  '/admin/objects':'Объекты и участки', '/admin/brigades':'Бригады', '/admin/attendance':'Табель',
  '/admin/work-days':'Рабочие дни', '/admin/qr':'Участки и QR', '/admin/photos':'Фото ДО/ПОСЛЕ',
  '/admin/warehouse':'Склад', '/admin/vehicles':'Техника', '/admin/products/import':'Импорт товаров',
  '/admin/work-types':'Виды работ', '/admin/vehicle-types':'Виды техники', '/admin/kpi':'KPI / Качество', '/admin/evidence-reports':'Отчёты по работам',
  '/admin/management':'Управление', '/admin/daily-reports':'Отчёты', '/admin/export':'Экспорт Excel',
  '/admin/form-settings':'Настройки формы', '/admin/business-processes':'Бизнес-процессы',
  '/admin/assistant':'ИИ-ассистент', '/admin/ai-director':'ИИ-директор', '/admin/my-tasks':'Мои задачи',
  '/field/today':'Сегодня в поле', '/field/tasks':'Мои полевые задачи', '/field/route':'Мой маршрут',
  '/field/qr':'Сканировать QR', '/field/assistant':'Полевой ИИ-ассистент', '/field/workflow':'Полевые улучшения',
};
export function pageAllowed(role:UserRole,path:string):boolean {
  const field=['/field/today','/field/tasks','/field/route','/field/qr','/field/assistant','/field/workflow'];
  if(path==='/my-work-day') return ![UserRole.AKIMAT,UserRole.ANTICOR].includes(role);
  if(field.includes(path)) return [UserRole.WORKER,UserRole.BRIGADIER,UserRole.AGRONOMIST,UserRole.WATER_CARRIER].includes(role);
  if(role===UserRole.WORKER)return false;
  if(role===UserRole.ACCOUNTANT)return ['/admin/attendance','/admin/daily-reports','/admin/workflow'].includes(path);
  if(role===UserRole.WATER_CARRIER)return ['/admin/watering','/admin/assistant'].includes(path);
  if(path==='/admin/director')return role===UserRole.DIRECTOR;
  if(role===UserRole.ADMIN||role===UserRole.DIRECTOR)return path!=='/admin/my-tasks';
  if(['/admin/qr','/admin/form-settings','/admin/business-processes','/admin/export','/admin/products/import','/admin/vehicle-types','/admin/ai-director'].includes(path))return false;
  if(['/admin/brigades','/admin/warehouse'].includes(path))return role===UserRole.BRIGADIER;
  if(path==='/admin/daily-reports')return [UserRole.AKIMAT,UserRole.ANTICOR].includes(role);
  if(['/admin/tasks','/admin/routes','/admin/executions','/admin/workflow','/admin/attendance','/admin/work-days','/admin/vehicles','/admin/assistant','/admin/my-tasks'].includes(path))return [UserRole.BRIGADIER,UserRole.AGRONOMIST].includes(role);
  return true;
}
const ACTIONS: Record<string,string> = {
  findAll:'Список', findOne:'Карточка', findMyToday:'Мой маршрут', findByCode:'Поиск по QR',
  create:'Создание', update:'Редактирование', remove:'Удаление / архив', review:'Приёмка',
  start:'Начать', finish:'Завершить', complete:'Завершить', mine:'Мои записи',
  summary:'Сводка', stats:'Статистика', catalog:'Справочники', board:'Доска задач', detail:'Карточка задачи',
  standard:'Сохранить стандарт', plan:'Настроить план', prepare:'Подготовка', steps:'Шаги выполнения',
  obstacle:'Сообщить препятствие', obstacleAction:'Обработать препятствие', improve:'Предложить улучшение',
  improvementAction:'Обработать улучшение', tools:'Список инструментов', addTool:'Добавить инструмент',
  toolAction:'Выдача и возврат инструмента', findAssignees:'Список исполнителей',
  acceptMy:'Принять свою задачу', action:'Переход этапа процесса', addPhotos:'Добавить фото',
  aggregate:'Собрать отчёт', answerManagerQuestion:'Вопрос ИИ-директору', answerQuestion:'Вопрос ИИ',
  answerWorkerQuestion:'Вопрос полевому ИИ', archive:'Перенести в архив', arrive:'Отметить прибытие',
  assignVehicle:'Назначить технику', attach:'Подключить бизнес-процесс', captureFace:'Подтверждение личности',
  check:'Проверить', checklist:'Заполнить чек-лист', clearImportedProducts:'Удалить импортированные товары',
  closeDay:'Закрыть рабочий день', completeAssignment:'Завершить назначение техники', completeMy:'Завершить свою задачу',
  createDecision:'Создать решение', createNurseryBatch:'Добавить партию', createNurseryMovement:'Движение партии',
  createVehicle:'Добавить технику', dispatcher:'Диспетчерская', exportProducts:'Выгрузить товары',
  exportWorkLogs:'Выгрузить журнал', fieldOptions:'Материалы для полевых работ', findActive:'Активные записи',
  findDecision:'Карточка решения', findDecisions:'Список решений', findMy:'Мои задачи', findMyOne:'Моя задача',
  forTask:'Процесс задачи', getQr:'QR-код', getRisks:'Риски', getSettings:'Настройки формы',
  getStats:'Статистика', getSummary:'Сводка', getWorkerBrief:'Задания и подсказки рабочего',
  importExcel:'Импорт Excel', kpi:'Показатели качества', legacyForm:'Форма участка', list:'Список',
  listNurseryBatches:'Партии', listNurseryMovements:'Движения партий', listVehicles:'Техника',
  locations:'Сохранить координаты маршрута', overview:'Обзор', publicForm:'Форма участка',
  publish:'Опубликовать процесс', read:'Открыть фото', report:'Отчёт', removeDecision:'Удалить решение',
  reviewDay:'Проверить рабочий день', reviewFace:'Проверить подтверждение личности', reviewQueue:'Очередь приёмки',
  scanState:'Состояние участка по QR', setVehicleStatus:'Изменить статус техники', startDay:'Начать рабочий день',
  startMy:'Начать свою задачу', submit:'Отправить на проверку', today:'Сегодня в поле',
  updateDecision:'Изменить решение', updateSettings:'Сохранить настройки формы', uploadPhotos:'Загрузить фото',
  workDayList:'Рабочие дни',
};
export function roleAllowed(role: UserRole, required?: UserRole[]) {
  return !required?.length || required.includes(role) || (role === UserRole.DIRECTOR && required.includes(UserRole.ADMIN));
}
export function operationKey(controller: Function, handler: Function): string {
  return `${Reflect.getMetadata(PATH_METADATA, controller)}.${handler.name}`;
}
export function operationInfo(controller: Function, handler: Function) {
  const resource = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
  const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
  const verb = method === 0 ? 'Просмотр' : method === 3 ? 'Удаление' : 'Изменение';
  return { key: operationKey(controller, handler), resource, section: SECTION_NAMES[resource],
    label: `${verb}: ${ACTIONS[handler.name] ?? path}`, method, path: `/${resource}/${path === '/' ? '' : path}` };
}
// Managing credentials/roles is deliberately non-delegable: otherwise a custom
// user could grant themselves the unrestricted ADMIN role through /users.
export function nonDelegable(resource: string, handlerName: string): boolean {
  return resource === 'access-roles' || resource === 'seed' ||
    (resource === 'users' && handlerName !== 'findAssignees');
}
