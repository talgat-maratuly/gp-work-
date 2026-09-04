# GP Work: gate для white-label продукта

## Текущий вердикт

Текущая версия — приложение одной организации. Смена видимого названия не делает его безопасным тиражируемым продуктом: бизнес-таблицы не содержат `organization_id`, отраслевые модули и роли частично зафиксированы в коде, а PWA/API metadata содержат GP Work.

До завершения перечисленных ниже этапов продукт нельзя продавать нескольким независимым компаниям в общей инфраструктуре.

## Целевая модель

1. `organizations`: юридическое/отображаемое название, slug, timezone, locale, branding, status и настройки хранения данных.
2. Tenant context берётся только из проверенной server-side membership пользователя, а не из `organizationId`, присланного клиентом.
3. Каждая бизнес-запись принадлежит организации. Все unique indexes включают `organization_id`; внешние ключи не позволяют связать данные разных организаций.
4. PostgreSQL Row Level Security служит вторым барьером поверх обязательных repository/service filters.
5. Пользователь может иметь memberships в нескольких организациях; роль и permissions принадлежат membership, а не глобальному user.
6. Branding хранится как данные: название, логотипы, цвета, домен, PWA manifest, email/report metadata. В коде остаётся нейтральное platform name.
7. Отрасль задаётся profile/template: включённые модули, терминология, справочники, формы, workflow/state machine и KPI. «Полив» и «питомник» становятся подключаемыми модулями, а не обязательным ядром.
8. Роли переходят к permission sets. Предустановки GP Work остаются шаблонами, но компания может менять структуру без нового deploy.
9. Миграции, backup/restore, exports, uploads, audit events, background jobs, AI context и observability всегда tenant-aware.

## Безопасная последовательность внедрения

| Этап | Изменение | Доказательство перед продолжением |
|---|---|---|
| 0 | Закрыть известные дефекты single-company версии | Полный CI/E2E/security и test deploy |
| 1 | Organization + membership + branding без изменения текущего поведения | Все существующие строки принадлежат default organization; UI не меняется |
| 2 | Добавить nullable `organization_id`, backfill и составные FK/indexes | Migration rehearsal на копии production; orphan/cross-tenant count = 0 |
| 3 | Сделать tenant context обязательным во всех API/jobs/files/reports/AI | Негативный E2E: tenant A не читает/не меняет tenant B ни одним endpoint |
| 4 | Включить PostgreSQL RLS и сделать поля non-null | DB-level cross-tenant tests и restore drill |
| 5 | Configurable modules, terminology, roles и workflow templates | Минимум две разные отраслевые конфигурации проходят одинаковый core E2E |
| 6 | Custom domains, licensing, onboarding и tenant-scoped operations | Provision/deprovision, billing failure, backup/export/delete drills |

## Обязательные owner gates

До реализации коммерческого слоя владелец отдельно утверждает:

- shared database + RLS или отдельная database/schema на клиента;
- модель лицензий и ограничения тарифов;
- список отраслевых profiles первой версии;
- правила хранения/удаления персональных, GPS, Face/selfie и фото-данных;
- custom domains, SLA, backup RPO/RTO и регионы хранения.

## Критерий готовности к продаже

White-label readiness доказана только когда два тестовых tenant с одинаковыми ФИО, кодами, названиями объектов и файлами одновременно проходят полные E2E, не видят данные друг друга, независимо меняют branding/структуру/modules, переживают upgrade и раздельно экспортируются/восстанавливаются.

«Работает 100 лет без изменений» не является проверяемым критерием. Проверяемые критерии: backward-compatible migrations, автоматические dependency/security updates, versioned APIs, restore drills, observability, documented support window и воспроизводимые regression cycles.
