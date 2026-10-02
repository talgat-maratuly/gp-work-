import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganization1733500000000 implements MigrationInterface {
  name = 'AddOrganization1733500000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE organization_units (
      id SERIAL PRIMARY KEY, seed_key VARCHAR(40) UNIQUE, name VARCHAR(160) NOT NULL,
      kind VARCHAR(24) NOT NULL CHECK(kind IN ('MANAGEMENT','DEPARTMENT','FUNCTION','TERRITORY','OBJECT','TEAM')),
      parent_id INTEGER REFERENCES organization_units(id) ON DELETE RESTRICT,
      head_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      object_id INTEGER REFERENCES objects(id) ON DELETE RESTRICT,
      brigade_id INTEGER REFERENCES brigades(id) ON DELETE RESTRICT,
      purpose TEXT NOT NULL DEFAULT '', is_active BOOLEAN NOT NULL DEFAULT true,
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK(parent_id IS DISTINCT FROM id)
    )`);
    await q.query('CREATE UNIQUE INDEX organization_units_name_idx ON organization_units(COALESCE(parent_id,0),lower(name))');
    await q.query(`CREATE TABLE organization_assignments (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
      unit_id INTEGER REFERENCES organization_units(id) ON DELETE RESTRICT,
      manager_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      duties TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(manager_id IS DISTINCT FROM user_id)
    )`);
    await q.query('CREATE INDEX organization_assignments_unit_idx ON organization_assignments(unit_id)');
    await q.query(`CREATE TABLE organization_process_owners (
      process_id INTEGER PRIMARY KEY REFERENCES business_processes(id) ON DELETE RESTRICT,
      unit_id INTEGER REFERENCES organization_units(id) ON DELETE RESTRICT,
      owner_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE organization_history (
      id SERIAL PRIMARY KEY, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      kind VARCHAR(24) NOT NULL, target_id INTEGER NOT NULL, label TEXT NOT NULL,
      before_data JSONB, after_data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX organization_history_target_idx ON organization_history(kind,target_id,id)');
    // Empty organizational slots, never inferred appointments or security roles.
    const units = [
      ['general','Генеральный директор','MANAGEMENT',null,'Стратегия компании, бюджет, развитие, приоритеты. Прямая эскалация по качеству и безопасности.'],
      ['director','Директор','MANAGEMENT','general','Ежедневное исполнение: объекты, бригады, ресурсы и графики. Согласование приоритетов общих служб и объектов.'],
      ['production','Производство и эксплуатация','DEPARTMENT','director','Подготовка и выполнение работ, руководители объектов и бригад. Территории и объекты добавляются по фактической структуре.'],
      ['supply','Снабжение, склад и логистика','DEPARTMENT','director','Потребность → согласование → закупка → приёмка → выдача. Разделение ответственных за закупку и приёмку.'],
      ['quality','Качество и стандартизация','DEPARTMENT','general','Независимый контроль качества, приёмка, разбор дефектов, стандарты и кайдзен. Эскалация генеральному директору.'],
      ['strategy','Стратегия, планирование и развитие','DEPARTMENT','general','Цели на квартал, план развития, важные несрочные задачи (квадрат 2), контроль результатов улучшений.'],
      ['marketing','Маркетинг','DEPARTMENT','general','Исследование рынка, продвижение, обращения и оценка эффективности каналов.'],
      ['sales','Продажи и работа с клиентами','DEPARTMENT','general','Запросы клиентов, предложения, договорённости, передача заказа в производство и обратная связь.'],
      ['finance','Финансы и бухгалтерия','DEPARTMENT','general','Бюджет, платежи, учёт, себестоимость и финансовые результаты.'],
      ['engineering','Инженерная подготовка и сметы','DEPARTMENT','director','Обследование, технологии работ, агрономия, объёмы, сметы и подготовка ресурсов.'],
      ['people','Персонал и обучение','DEPARTMENT','general','Подбор, адаптация, наставничество, обучение стандартам и развитие компетенций.'],
      ['it','ИТ и автоматизация','DEPARTMENT','general','Поддержка GP Work, доступы, надёжность данных и автоматизация процессов.'],
      ['maintenance','Обслуживание техники','FUNCTION','director','Плановое обслуживание, исправность техники и предупреждение простоев.'],
      ['safety','Охрана труда','FUNCTION','general','Инструктажи, безопасная организация работ и разбор происшествий.'],
      ['legal','Юридическое сопровождение','FUNCTION','general','Проверка договоров, претензии и правовое сопровождение.'],
    ];
    for (const [key,name,kind,parent,purpose] of units) {
      await q.query(`INSERT INTO organization_units(seed_key,name,kind,parent_id,purpose)
        VALUES($1,$2,$3,(SELECT id FROM organization_units WHERE seed_key=$4),$5)`, [key,name,kind,parent,purpose]);
    }
    const positions = ['Генеральный директор','Директор','Руководитель производства','Руководитель территории',
      'Руководитель объекта','Бригадир','Менеджер по снабжению','Кладовщик','Диспетчер',
      'Руководитель качества','Специалист по качеству','Руководитель развития','Аналитик-планировщик',
      'Маркетолог','Менеджер по продажам','Менеджер по работе с клиентами','Главный бухгалтер',
      'Финансовый специалист','Инженер','Сметчик','Агроном','Специалист по персоналу','Наставник',
      'ИТ-специалист','Ответственный за автоматизацию','Механик','Специалист по охране труда','Юрист'];
    for (const name of positions) await q.query('INSERT INTO job_positions(name) VALUES($1) ON CONFLICT (lower(name)) DO NOTHING', [name]);
  }
  async down(): Promise<void> {
    throw new Error('Organization appointments and history are preserved. Roll back code without removing additive data.');
  }
}
