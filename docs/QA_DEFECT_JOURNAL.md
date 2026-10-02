undefined

## 2026-10-02 — «Важное заранее», цикл планирования

База: main fb08ab3948bb30a70a1bff55272052ca816db9cc. Добавлено планирование существующих полевых задач без изменения QR, фото и приёмки. Отдельные важность/срочность, ожидаемый результат, интервал UTC+5 в пределах крайнего срока, связь с предложением кайдзен. В «Работа и улучшения» — неделя/четыре квадрата; в «Мой рабочий день» — свои важные несрочные задачи, включая пропущенные планы. История сохраняет автора, причину, старый и новый план; версия защищает от устаревших вкладок. PostgreSQL advisory lock сериализует бронирование времени исполнителя. Назначение подготовленной задачи не меняется в обход проверки пересечений.

Проверки добавлены в существующие API E2E и desktop/mobile browser regression: роли/область доступа, срок, конфликт времени, параллельное бронирование, версия, перенос, история и сохранение после перезагрузки. Локальная сборка не выполнена: зависимости проекта отсутствуют, прямой доступ к GitHub/npm из shell ограничен. Проверка выполняется в GitHub CI на ветке codex/important-planning-v1; результат записывается после выполнения. Production не изменялся.

Границы: планируются существующие задачи с участком и полевым исполнителем; отдельные офисные задачи директора не добавлены. Пересечения проверяются между интервалами этого планировщика, не со всеми графиками/маршрутами. Срочность не повышается автоматически из-за просрочки. Счётчик принятых результатов использует реальную приёмку VERIFIED; экономия и предотвращённые аварии не выдумываются. Пользовательская приёмка ещё не проведена.


Уточнение по снимкам владельца: отдельной вкладки «Кайдзен» на production не было; предложения были скрыты внутри карточки задачи. Добавлена вкладка со списком доступных предложений, статусами, измерениями и формой подачи по выбранной задаче. Существующий PDCA-процесс переиспользуется. Это не отдельный утренний чат без привязки к задачам.

CI 3dd0aa6: сборки, unit, миграции и API E2E прошли; 82 браузерных теста прошли, два новых упали на поиске textarea после reload. Снимок и accessibility snapshot подтвердили сохранённое значение и видимую форму; исправлен локатор на getByRole('textbox', accessible name), проверка данных сохранена. Повторный CI продолжается после добавления заметного входа в кайдзен.



## 2026-10-02 — Комбинированная структура и ответственность

Факт: на main ffff86c1c7f7a3f004da264f292ba6351f4a2337 есть должности и отдельные роли доступа, но нет подразделений, состава, прямого подчинения и владельцев процессов. Сценарий владельца: добавить комбинированную структуру с генеральным директором, директором и общими службами, назначить реальных сотрудников и проследить изменения.

Изменение: модуль organization, 15 начальных звеньев и 28 должностей без автоматических назначений; редактор иерархии, руководители, привязки объектов/бригад, состав и прямые руководители, обязанности, владелец каждого существующего бизнес-процесса. Отдельная история до/после с автором, временем и сохранёнными названиями. Архив сохраняет данные и требует переноса зависимых назначений. Качество и стратегия напрямую подчинены генеральному директору в стартовой структуре. Все элементы редактируемы. Права доступа и рабочее членство в бригадах не меняются от оргназначений.

Защита: серверные права ADMIN/DIRECTOR и отдельные разрешения пользовательских ролей; белый список данных сотрудников; DTO, FK, версии редакторов, транзакционная история, общий advisory lock для защиты от циклов при конкурентных назначениях. Новый раздел включён в меню, страницу сотрудников и каталог разрешений. Миграция добавочная; существующие должности не перезаписываются.

Проверки: добавлены реальные API E2E (начальная структура, ограничения доступа, ссылки, версии, циклы включая конкурентные, архив, сохранение владельца при новой версии процесса, история) и desktop/mobile Playwright (создание подразделения, назначение, сетевой отказ, конфликт вкладок, reload, владелец процесса, история, ширина экрана). Локальная сборка невозможна без зависимостей проекта; полный существующий GitHub CI является обязательной проверкой перед предложением публикации. Результат CI фиксируется в PR на конкретном commit.

Границы: структура описывает ответственность и не делегирует права на выполнение задач автоматически. Руководители назначаются вручную. История содержит изменения этого модуля; изменения должностей/рабочего состава бригад остаются в соответствующих разделах. Наличие отдела качества не добавляет новый автоматический маршрут эскалации. Production и пользовательская приёмка — отдельные этапы; merge/deploy требуют Owner Approval.


CI f9fcd704: сборка, миграции, unit и 62 из 63 API E2E прошли. Одна новая проверка отсутствия секретных полей ошибочно искала слово recovery также в значениях и сработала на имени чужого тестового сотрудника Recovery test. Исправлена на рекурсивную проверку имён полей, без ослабления запрета на credential-поля. Браузерный этап этим запуском не выполнялся; требуется полный CI исправленного commit.


Уточнение владельца 2026-10-02: добавлены Отдел проектов под директором и отдельная Бухгалтерия под финансами; финансовый отдел отвечает за бюджетирование и платёжный план. Начальная структура теперь содержит 17 звеньев, справочник — 34 предлагаемые должности. Нумерация и шаблоны договоров, проектные бюджеты, счета и интеграция ChatGPT описываются как следующий прикладной цикл; появление подразделений не означает реализацию этих модулей.

CI eb93e88: 63 API E2E и 84 существующих браузерных теста прошли; два новых браузерных сценария не дошли до интерфейса из-за локальной переменной process, затенившей Node.js process.env. Исправлено имя фикстуры на projectProcess. Проверки не отключены; требуется полный повторный CI вместе с уточнённым составом подразделений.

## 2026-10-02 — Personal office and financial execution (verification in progress)

- Request: organizational units must determine real work and visibility; each employee needs a personal login; implement contracts, invoices and financial operations in GP Work.
- Code finding: organization assignments and titles did not constrain legacy resource lists. Unique usernames/password recovery existed, but no project/department financial workspace.
- Change: additive Office module; explicit access presets and SELF/DEPARTMENT/COMPANY scope resolved from current database state. Scoped project membership, tasks/checklists/quality acceptance, quadrant 2 and improvement target, template snapshots and contract numbering, budgets, procurement/receipts, invoices and confirmed partial payment accounting. Existing field roles remain unchanged until an administrator explicitly assigns an office profile.
- Credentials: personal random login code + one-time 24-hour password; existing forced password change and token revocation reused. No plaintext secret in directories/audit; no broad legacy API access for office profiles, even when disabled.
- Money: integer minor units, serial transaction lock, idempotent creation/actions, optimistic revisions, budget/contract/receipt/payment ceilings; cancellation and reversals retain history. Private PDF/image files are authenticated database-backed downloads.
- Local evidence so far: API/web build passes; pre-existing 101 API unit tests passed. Added real-database E2E and desktop/mobile browser scenarios; their result is pending CI.
- Boundaries: accounting records are not bank transfers, electronic invoices, digital signatures or a 1C integration. No production appointments, migration or deployment performed for this change. Main/production require separate owner approval after review.

- Real-database verification found an adapter contract issue: TypeORM returns `UPDATE ... RETURNING` as `[rows, affectedCount]`. Office transitions initially returned the row array instead of the row, so the next action received no record ID. Corrected task/document, project and template updates; real-database scenarios now pass on commit `482830c6359b6c3c37bad4c057495142b406e18d` (CI run `36968253719`, job `110716595796`). Browser verification remains in progress.
- Financial summaries and paid balances are computed over all project records on the server, independent of the UI list limit. Office role labels now identify the actual work profile. Action notes are disabled while a request is pending to preserve input across revision refreshes.
