# GP Work — отчёт по развитию от production baseline

Дата проверки: 2026-09-03
Production baseline: `b677937c9e657debce27588ae0a621c48269b5d3`
Рабочая ветка: `codex/field-cycle-v1`
Production deploy: **не выполнялся**

## 1. Исходное состояние и ограничения

- Репозиторий `talgat-maratuly/gp-work-` публичный, default branch — `main`; baseline совпал с указанным владельцем commit.
- `https://gp-work.gpartners.kz` доступен и открывает существующую форму входа.
- На действующем production endpoint Swagger `/api/docs` доступен публично. В новой ветке Swagger по умолчанию выключен при `NODE_ENV=production` и включается только явной настройкой.
- Docker-конфигурация проекта содержит Nginx, NestJS API и PostgreSQL 18 с named volume. Фактическое состояние хоста, Docker daemon, PostgreSQL и production logs без SSH/серверного доступа независимо не подтверждено.
- По указанию владельца предварительная отдельная копия репозитория/данных не создавалась. Работа велась только в отдельной локальной ветке; `main` и production не изменялись.
- Визуальный макет использовался только как UI/UX-направление. Интерфейс реализован React-компонентами, маршрутами и API; изображение не встроено в продукт.

## 2. Переиспользованные рабочие модули

Сохранены и расширены существующие модули:

- Auth, JWT, Users и роли;
- Objects/NurseryObject и Sections с QR-кодами;
- Brigades;
- Tasks и WorkTypes;
- Attendance;
- WorkLogs и журнал работ;
- Uploads и существующее хранение фото;
- Products и StockMovement;
- Watering;
- ежедневные отчёты, управление, производственный график и существующие административные экраны.

Удалений существующих таблиц или колонок в `up` migrations нет. Старые endpoint-ы не переименованы и не удалены.

## 3. Реализованный сквозной цикл

Реализован связанный процесс:

`объект → задача → бригада → маршрут → прибытие QR/GPS → Face evidence → фото ДО → начало → чек-лист → материалы → фото ПОСЛЕ → завершение → Face review → приёмка → WorkLog/табель → KPI → доказательный отчёт`

Backend не разрешает завершение без фото ДО, фото ПОСЛЕ, Face evidence и всех обязательных пунктов чек-листа. Приёмка не разрешается, пока руководитель не подтвердил Face verification.

Статусы выполнения: `ASSIGNED`, `EN_ROUTE`, `ARRIVED`, `STARTED`, `IN_PROGRESS`, `COMPLETED`, `ACCEPTED`, `REJECTED`.

Каждое ключевое действие записывается в audit trail. UUID клиентских операций защищают от повторного создания событий, фото, Face evidence, GPS-точек и складских списаний. UUID дополнительно связан с пользователем, типом действия и ресурсом: повторное использование с другими данными отклоняется.

## 4. Изменения базы данных

### `1731400000000-AddFieldExecutionCore.ts`

Добавляет:

- `routes`;
- `route_stops`;
- `work_executions`;
- `work_execution_events`;
- `work_photos`;
- `checklist_items`;
- `checklist_answers`;
- `face_verifications`;
- `location_events`;
- `sync_operations`;
- nullable-связи `work_logs.user_id`, `work_logs.brigade_id`, `work_logs.execution_id`.

Также добавляет три общих обязательных пункта чек-листа. Уникальные ограничения созданы для `task_id`, `client_execution_id`, клиентских UUID операций/фото и пары execution/checklist item.

### `1731500000000-AddOperationalResources.ts`

Добавляет:

- `vehicles`;
- `vehicle_assignments`;
- `nursery_batches`;
- `nursery_movements`;
- `products.reserved_quantity`, `products.minimum_quantity`;
- nullable-связи StockMovement с задачей, бригадой, сотрудником, маршрутом и выполнением;
- `stock_movements.client_operation_id` с unique constraint.

Обе migrations аддитивные. Down-методы существуют только для контролируемого отката вне production-инцидента.

## 5. Новые и расширенные API

| Область | Endpoint-ы |
|---|---|
| Полевой день | `GET /api/field/today`, `GET /api/field/executions/:id` |
| Прибытие | `POST /api/field/tasks/:taskId/arrive` |
| Face | `POST /api/field/executions/:id/face`, `POST /api/field/face/:verificationId/review` |
| Фото/работа | `POST /api/field/executions/:id/photos`, `/start`, `/checklist`, `/complete`, `/review` |
| GPS | `POST /api/field/locations/batch` |
| Маршруты | `GET/POST /api/routes`, `GET /api/routes/my/today`, `POST /api/routes/:id/start` |
| Приёмка | `GET /api/field/executions/review-queue` |
| Диспетчерская | `GET /api/operations/dispatcher` |
| KPI | `GET /api/operations/kpi` |
| Доказательства | `GET /api/operations/reports/evidence` |
| Техника | `/api/resources/vehicles`, назначения и завершение назначений |
| Питомник | `/api/resources/nursery/batches`, `/api/resources/nursery/movements` |
| Склад | расширен `/api/stock-movements`; добавлен безопасный `GET /api/products/field-options` без цен |
| Диагностика | `GET /api/health` с проверкой соединения БД и commit SHA |

## 6. UI

### Mobile PWA

Отдельный мобильный layout с нижней навигацией:

`Сегодня | Маршрут | QR | Задачи | Ещё`

Добавлены реальные экраны сегодняшнего дня, маршрута и остановок, QR-сканера, полевых задач, выполнения, Face evidence, фото ДО/ПОСЛЕ, чек-листа, списания материалов и синхронизации.

PWA генерирует manifest и service worker. IndexedDB-очередь хранит запросы и Blob-фото, последовательно повторяет операции после восстановления сети и показывает число несинхронизированных действий и последнюю ошибку. Одновременный запуск двух обработчиков очереди заблокирован.

После запуска активного маршрута PWA включает `watchPosition` и отправляет GPS-точку раз в минуту. При отсутствии сети точки попадают в ту же idempotent очередь. В шапке виден статус GPS.

### Desktop

Добавлены/расширены:

- dashboard и dispatcher с картой объектов, последних позиций бригад, маршрутов, просрочек, проблем, техники и водовозов;
- маршруты;
- приёмка доказательств;
- склад с резервом, минимальным и доступным остатком и связями с работой;
- реестр техники/транспорта и назначения;
- питомник и движения партий;
- KPI;
- доказательные отчёты с фото, временем, координатами, чек-листом, Face review, материалами и audit trail.

Dispatcher обновляется polling-запросом каждые 20 секунд. Это near-real-time, не WebSocket.

## 7. Статус этапов

| Этап | Статус | Что остаётся |
|---|---|---|
| 1. Полевой цикл | Реализован локально | Прогон E2E на реальном PostgreSQL и staging-приёмка |
| 2. Mobile PWA | Реализован локально | Проверка камеры/GPS/offline на реальных iPhone разных версий |
| 3. Диспетчерская | MVP реализован | При необходимости WebSocket и кластеризация большого числа маркеров |
| 4. Карта/маршруты | Основной контур реализован | Внешняя оптимизация маршрута, ETA и навигационный провайдер |
| 5. Транспорт/техника | Основной реестр и история назначений | Отдельные журналы топлива, ТО и ремонтов |
| 6. Склад | Реализовано расширение существующих сущностей | Мультисклад и строгий процесс согласования заявки/выдачи |
| 7. Питомник | Основной реестр и движения реализованы | Инвентаризация, печатные формы и специализированная аналитика |
| 8. KPI/качество | Доказательные KPI реализованы | Утверждение весов/нормативов Owner; автоматических HR/зарплатных санкций нет |
| 9. Отчёты | Доказательный день/неделя/месяц реализован | Отдельные агрегаты город/техника/склад и утверждённые печатные формы |
| 10. Безопасность | Проведено базовое hardening | Решение владельца по приватному доступу к legacy-фото и биометрическому провайдеру |

## 8. Security hardening

- production требует непустой `JWT_SECRET`;
- первый bootstrap admin требует `ADMIN_PASSWORD`, публичный reset-admin выключен по умолчанию и защищён отдельным token при явном включении;
- добавлены rate limits на login/reset/upload/attendance и общий limiter;
- Swagger в production выключен по умолчанию;
- CORS переведён на allowlist;
- добавлены security headers и корректная настройка proxy;
- upload работает через memory storage, проверяет magic bytes JPEG/PNG/WebP/HEIC, использует случайное серверное имя и удаляет частично записанный batch при ошибке;
- полевой список материалов не раскрывает закупочные/учётные цены;
- tracked-файлы проверены на очевидные секреты — совпадений не найдено;
- `npm audit` не показывает high/critical. Остались 2 moderate в транзитивной зависимости `uuid` внутри `exceljs`; безопасного patch без принудительной смены dependency tree нет.

Существующий upload endpoint и статическая раздача legacy-фото остаются публичными ради обратной совместимости. Закрывать их можно только после решения по миграции старых ссылок и правилам доступа.

Face verification в текущей ветке — сбор selfie/liveness evidence и обязательное ручное подтверждение уполномоченным руководителем. Автоматическое биометрическое сравнение лица не заявляется: для него нужны выбранный провайдер/модель, эталонные фотографии, согласие работников, сроки хранения и Owner Approval.

## 9. Тесты и проверки

- API unit: 3 suites, 12 tests — пройдены.
- E2E TypeScript compilation — пройдена.
- Полная NestJS и React/Vite production build — пройдена.
- PWA build создаёт `dist/sw.js`, manifest и Workbox precache.
- `git diff --check` — пройден.
- Написан реальный PostgreSQL E2E-сценарий полного цикла, включая повтор arrival/start/photo/GPS/StockMovement, запрет изменения payload под тем же UUID, Face review, приёмку, табель, KPI и отчёт.
- GitHub Actions workflow поднимает `postgres:18-alpine`, выполняет build, unit, migration и E2E.

Фактический запуск E2E и migrations на реальном PostgreSQL пока не состоялся: текущий рабочий контейнер не позволяет запустить PostgreSQL daemon под отдельным системным пользователем, а ветка ещё не опубликована в GitHub. Поэтому нельзя честно отметить database E2E зелёным до запуска CI или staging.

## 10. Commits рабочей ветки

1. `88e7530` — evidence-based field cycle и Mobile PWA;
2. `671776b` — materials, vehicles и nursery;
3. `790f8c9` — dispatcher, evidence reports и KPI;
4. `d1d9558` — auth/upload/docs/rate-limit hardening;
5. `1cd720f` — PostgreSQL E2E и CI;
6. `a52883c` — ownership-aware idempotency и маршрутный GPS;
7. `015738a` — ограничение складских данных для field roles.

## 11. Screenshots

Новые desktop/mobile screenshots не создавались, потому что новый интерфейс ещё не запускался против реально промигрированной PostgreSQL/staging базы. Статический mock или подмена API ради красивого изображения сознательно не использовались. Скриншоты нужно снять после зелёного database E2E на временном/staging окружении.

## 12. Deploy gate

Код является кандидатом для публикации рабочей ветки и запуска CI, но **не готов к прямому production deploy без следующих ворот**:

1. Owner Approval на публикацию ветки/PR.
2. Зелёный GitHub Actions: migration + полный PostgreSQL E2E.
3. Backup production PostgreSQL непосредственно перед развёртыванием и проверка восстановления.
4. Staging smoke-test ролей, камеры, QR, GPS, offline/retry, фото и приёмки.
5. Desktop/iPhone screenshots и бизнес-приёмка владельцем.
6. Решение по Face/биометрии и доступу к legacy-фото.
7. Отдельная команда владельца на production deploy.

До выполнения этих пунктов production и `main` должны оставаться на baseline.
