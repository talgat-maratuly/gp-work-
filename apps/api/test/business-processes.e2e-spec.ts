import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

describe('Business process builder with persisted tasks and permissions', () => {
  let app: INestApplication, db: DataSource;
  let admin: any, worker: any, outsider: any, director: any, task: any, definition: any, instance: any, section: any, workType: any;
  const headers = (user: any) => ({ Authorization: `Bearer ${user.token}`, 'X-Forwarded-For': `10.91.0.${user.id % 200 + 1}` });
  const post = async (path: string, data: object, user = admin, status = 201) => (await request(app.getHttpServer()).post('/api/business-processes' + path).set(headers(user)).send(data).expect(res => { if (res.status !== status) throw new Error(`${path}: ${res.status} ${JSON.stringify(res.body)}`) })).body;
  const get = async (path: string, user = admin, status = 200) => (await request(app.getHttpServer()).get('/api/business-processes' + path).set(headers(user)).expect(status)).body;
  const create = async (path: string, data: object) => (await request(app.getHttpServer()).post('/api' + path).set(headers(admin)).send(data).expect(res => { if (res.status !== 201) throw new Error(`${path}: ${res.status} ${JSON.stringify(res.body)}`); })).body;
  const login = async (username: string, password: string) => { const res = await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For', `10.92.0.${Math.floor(Math.random() * 200) + 1}`).send({ username, password }).expect(201); return { ...res.body.user, token: res.body.accessToken }; };
  const schema = () => ({ title: 'Согласование участка', description: 'Бизнес-поля задачи', initialStageId: 'start', fields: [
    { id: 'area', label: 'Площадь, м²', type: 'number', hint: '', options: [], readRoles: ['ADMIN', 'WORKER'], editRoles: ['ADMIN', 'WORKER'] },
    { id: 'ready', label: 'Доступ есть', type: 'boolean', hint: '', options: [], readRoles: ['ADMIN', 'WORKER'], editRoles: ['WORKER'] },
    { id: 'budget', label: 'Внутренний бюджет', type: 'number', hint: '', options: [], readRoles: ['ADMIN'], editRoles: ['ADMIN'] },
  ], stages: [
    { id: 'start', label: 'Подготовка', roles: ['ADMIN', 'WORKER'], requiredFields: ['area', 'ready'], nextStages: ['review'] },
    { id: 'review', label: 'Согласование', roles: ['ADMIN'], requiredFields: [], nextStages: ['done', 'start'] },
    { id: 'done', label: 'Завершено', roles: ['ADMIN'], requiredFields: ['budget'], nextStages: [] },
  ] });
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.DB_MIGRATE = 'true'; process.env.JWT_SECRET ||= 'business-process-only-test-secret-32-characters'; process.env.ADMIN_USERNAME ||= 'e2e-admin'; process.env.ADMIN_PASSWORD ||= 'e2e-admin-password';
    const { AppModule } = await import('../src/app.module'); const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); app.getHttpAdapter().getInstance().set('trust proxy', true); app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })); await app.init(); db = app.get(DataSource);
    admin = await login(process.env.ADMIN_USERNAME!, process.env.ADMIN_PASSWORD!);
    const suffix = crypto.randomUUID().slice(0, 8); const password = 'business-process-test';
    async function person(role: string) { const username = `bp-${role}-${crypto.randomUUID().slice(0, 8)}`; await create('/users', { username, password, fullName: username, role }); return login(username, password); }
    worker = await person('WORKER'); outsider = await person('WORKER'); director = await person('DIRECTOR');
    const object = await create('/objects', { name: `BP object ${suffix}` }); section = await create('/sections', { objectId: object.id, name: `BP section ${suffix}`, latitude: 51.23, longitude: 51.37 });
    workType = await create('/work-types', { name: `BP work ${suffix}` }); task = await newTask();
  });
  afterAll(async () => { if (app) await app.close(); });
  async function newTask() { return create('/tasks', { sectionId: section.id, workTypeId: workType.id, assigneeUserId: worker.id, description: 'Процесс согласования', dueDate: '2026-09-16' }); }
  const action = (values: object, revision: number, toStageId?: string, who = worker, status = 201) => post(`/tasks/${task.id}/${instance.id}/actions`, { values, revision, toStageId }, who, status);

  it('protects the builder and validates nested configuration', async () => {
    await request(app.getHttpServer()).get('/api/business-processes/definitions').expect(401);
    await post('/definitions', schema(), worker, 403);
    await post('/definitions', { ...schema(), fields: [{ ...schema().fields[0], editRoles: ['SUPERADMIN'] }] }, admin, 400);
    await post('/definitions', { ...schema(), fields: [{ ...schema().fields[0], malicious: 'extra' }] }, admin, 400);
    definition = await post('/definitions', schema(), director); expect(definition.version).toBe(1);
    instance = await post(`/tasks/${task.id}`, { definitionId: definition.id });
    await post(`/tasks/${task.id}`, { definitionId: definition.id }, admin, 409);
  });
  it('uses task ownership for reads and mutations', async () => {
    await get(`/tasks/${task.id}`, outsider, 403);
    await action({}, 1, undefined, outsider, 403);
    await post(`/tasks/${task.id}`, { definitionId: definition.id }, worker, 403);
    const [view] = await get(`/tasks/${task.id}`, worker); expect(view.schema.fields.map((f: any) => f.id)).toEqual(['area', 'ready']);
    expect(view.allowedTransitions).toEqual(['review']);
  });
  it('rejects missing values, invalid types and field permission bypass', async () => {
    await action({}, 1, 'review', worker, 400);
    await action({ area: '20' }, 1, undefined, worker, 400);
    await action({ budget: 200 }, 1, undefined, worker, 403);
    await action({ unknown: 200 }, 1, undefined, worker, 400);
    await action({ area: 0, ready: false }, 1, 'review');
    const [view] = await get(`/tasks/${task.id}`, worker); expect(view).toMatchObject({ revision: 2, stage_id: 'review', values: { area: 0, ready: false }, allowedTransitions: [] });
    await action({}, 2, 'done', worker, 403);
  });
  it('prevents stale overwrites and filters values and audit changes', async () => {
    await action({ budget: 1000 }, 2, undefined, admin);
    await action({ area: 10 }, 2, undefined, worker, 409);
    const [view] = await get(`/tasks/${task.id}`, worker);
    expect(view.values).not.toHaveProperty('budget'); expect(JSON.stringify(view)).not.toContain('Внутренний бюджет');
    expect(view.events.every((e: any) => !Object.prototype.hasOwnProperty.call(e.changes, 'budget'))).toBe(true);
    const [full] = await get(`/tasks/${task.id}`, director); expect(full.values.budget).toBe(1000); expect(full.events[0].changes.budget.after).toBe(1000);
  });
  it('pins running instances to the old schema after a new publication', async () => {
    const next = schema(); next.title = 'Обновлённое согласование'; next.fields[0].label = 'Новая площадь';
    const v2 = await post('/definitions', { ...next, processId: definition.process_id, baseVersion: 1 });
    expect(v2.version).toBe(2);
    await post('/definitions', { ...next, processId: definition.process_id, baseVersion: 1 }, admin, 409);
    const [old] = await get(`/tasks/${task.id}`); expect(old.version).toBe(1); expect(old.schema.fields[0].label).toBe('Площадь, м²');
    const otherTask = await newTask(); await post(`/tasks/${otherTask.id}`, { definitionId: definition.id }, admin, 409);
    await post(`/tasks/${otherTask.id}`, { definitionId: v2.id });
    definition = v2;
  });
  it('archives templates while preserving started processes and supports restore', async () => {
    await request(app.getHttpServer()).put(`/api/business-processes/definitions/${definition.process_id}/archive`).set(headers(admin)).send({ archived: true }).expect(200);
    expect((await get('/definitions')).find((d: any) => d.id === definition.id).archived).toBe(true);
    const otherTask = await newTask(); await post(`/tasks/${otherTask.id}`, { definitionId: definition.id }, admin, 400);
    await action({}, 3, 'start', director); expect((await get(`/tasks/${task.id}`))[0].stage_id).toBe('start');
    await request(app.getHttpServer()).put(`/api/business-processes/definitions/${definition.process_id}/archive`).set(headers(director)).send({ archived: false }).expect(200);
  });
  it('finishes the business process without bypassing field execution and preserves history', async () => {
    await action({}, 4, 'review'); await action({}, 5, 'done', director);
    const [view] = await get(`/tasks/${task.id}`); expect(view).toMatchObject({ locked: true, stage_id: 'done', revision: 6 });
    await action({ area: 5 }, 6, undefined, admin, 400);
    const [original] = await db.query('SELECT status FROM tasks WHERE id=$1', [task.id]); expect(original.status).toBe('ASSIGNED');
    expect(view.events.filter((e: any) => e.kind === 'TRANSITION')).toHaveLength(4);
  });
  it('serializes simultaneous updates with native PostgreSQL locks and keeps one audit event', async () => {
    const other = await newTask(); const linked = await post(`/tasks/${other.id}`, { definitionId: definition.id });
    const path = `/api/business-processes/tasks/${other.id}/${linked.id}/actions`;
    const results = await Promise.all([1, 2].map(area => request(app.getHttpServer()).post(path).set(headers(admin)).send({ revision: 1, values: { area } })));
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const [view] = await get(`/tasks/${other.id}`); expect(view.revision).toBe(2);
    expect(view.events.filter((e: any) => e.kind === 'FIELDS_SAVED')).toHaveLength(1);
    await db.query("UPDATE tasks SET status='CANCELLED' WHERE id=$1", [other.id]);
    expect((await get(`/tasks/${other.id}`))[0].locked).toBe(true);
    await post(`/tasks/${other.id}/${linked.id}/actions`, { revision: 2, values: { area: 3 } }, admin, 400);
  });
});
