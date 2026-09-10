import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ProductSource } from '../src/common/enums/product-source.enum';
import { Product, StockMovement, WorkLog } from '../src/entities';

const clientId = () => crypto.randomUUID();
const businessDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.BUSINESS_TIME_ZONE || 'Asia/Oral',
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

describe('GP Work evidence field cycle (PostgreSQL)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let adminUserId: number;
  let workerToken: string;

  const clientIps = new Map<string, string>();
  const client = (identity: string) => {
    if (!clientIps.has(identity)) clientIps.set(identity, `10.10.0.${clientIps.size + 10}`);
    return { 'X-Forwarded-For': clientIps.get(identity)! };
  };
  const tokenIps = new Map<string, string>();
  const auth = (token: string) => {
    if (!tokenIps.has(token)) tokenIps.set(token, `10.20.0.${tokenIps.size + 10}`);
    return {
      Authorization: `Bearer ${token}`,
      'X-Forwarded-For': tokenIps.get(token)!,
    };
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_MIGRATE = 'true';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-only-secret-at-least-32-characters';
    process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'e2e-admin';
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'e2e-admin-password';
    process.env.BUSINESS_TIME_ZONE = 'Asia/Oral';
    process.env.BUSINESS_UTC_OFFSET = '+05:00';

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.setGlobalPrefix('api', { exclude: [{ path: 'uploads/photos/:filename', method: RequestMethod.GET }] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    dataSource = app.get(DataSource);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set(client(process.env.ADMIN_USERNAME!))
      .send({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD })
      .expect(201);
    adminToken = login.body.accessToken;
    adminUserId = login.body.user.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('agronomist assistant includes own completed and future tasks and rejects role impersonation', async () => {
    const create = async (path: string, data: object, token = adminToken) => (await request(app.getHttpServer()).post(`/api${path}`).set(auth(token)).send(data).expect(201)).body;
    const suffix = Date.now();
    const agro = await create('/users', { username: `assistant-agro-${suffix}`, fullName: 'Assistant agronomist', role: 'AGRONOMIST', password: 'assistant-test-password' });
    const worker = await create('/users', { username: `assistant-worker-${suffix}`, fullName: 'Assistant worker', role: 'WORKER', password: 'assistant-test-password' });
    const login = await request(app.getHttpServer()).post('/api/auth/login').set(client(agro.username)).send({ username: agro.username, password: 'assistant-test-password' }).expect(201);
    const token = login.body.accessToken;
    const object = await create('/objects', { name: `Assistant park ${suffix}` });
    const section = await create('/sections', { objectId: object.id, name: 'Assistant section' });
    const workType = await create('/work-types', { name: `Assistant work ${suffix}` });
    const base = { sectionId: section.id, workTypeId: workType.id, assigneeUserId: worker.id };
    const ready = await create('/tasks', { ...base, description: 'READY OWN REVIEW', dueDate: '2001-01-01' }, token);
    const future = await create('/tasks', { ...base, description: 'FUTURE OWN CONTROL', dueDate: '2099-01-01' }, token);
    const foreign = await create('/tasks', { ...base, description: 'PRIVATE OTHER MANAGER', dueDate: '2001-01-01' });
    await dataSource.query("UPDATE tasks SET status = 'COMPLETED' WHERE id = $1", [ready.id]);
    const brief = (await request(app.getHttpServer()).get('/api/admin-ai/worker/brief').set(auth(token)).expect(200)).body;
    expect(brief.worker).toMatchObject({ id: agro.id, role: 'AGRONOMIST' });
    expect(brief.metrics.pendingReview).toBe(1);
    expect(brief.tasks.map((t: { id: number }) => t.id)).toEqual(expect.arrayContaining([ready.id, future.id]));
    expect(brief.tasks.map((t: { id: number }) => t.id)).not.toContain(foreign.id);
    const answer = (await request(app.getHttpServer()).post('/api/admin-ai/worker/question').set(auth(token)).send({ question: 'Что нужно проверить?' }).expect(201)).body;
    expect(answer.answer).toContain('READY OWN REVIEW');
    expect(answer.answer).not.toContain('FUTURE OWN CONTROL');
    expect(answer.answer).not.toContain('PRIVATE OTHER MANAGER');
    await request(app.getHttpServer()).post('/api/admin-ai/worker/question').set(auth(token)).send({ question: 'Сводка', role: 'DIRECTOR', userId: adminUserId }).expect(400);
    await request(app.getHttpServer()).post('/api/admin-ai/assistant/question').set(auth(token)).send({ question: 'Сводка' }).expect(403);
  });

  it('persists section location on create/edit and prevents partial or invalid configuration', async () => {
    const object = (await request(app.getHttpServer()).post('/api/objects').set(auth(adminToken))
      .send({ name: `Location setup ${Date.now()}` }).expect(201)).body;
    const create = (location: object) => request(app.getHttpServer()).post('/api/sections').set(auth(adminToken))
      .send({ objectId: object.id, name: 'Location setup section', ...location });
    await create({ latitude: 51.23 }).expect(400);
    await create({ radiusMeters: 150 }).expect(400);
    await create({ latitude: null, longitude: null }).expect(400);
    const section = (await create({ latitude: 0, longitude: 0, radiusMeters: 150 }).expect(201)).body;
    expect(section).toMatchObject({ latitude: 0, longitude: 0, radiusMeters: 150 });
    const patch = (location: object) => request(app.getHttpServer()).patch(`/api/sections/${section.id}`)
      .set(auth(adminToken)).send(location);
    for (const invalid of [{ latitude: 51.23 }, { longitude: null }, { latitude: '', longitude: '' }, { radiusMeters: 5 }]) {
      await patch(invalid).expect(400);
    }
    const unchanged = (await request(app.getHttpServer()).get(`/api/sections/${section.id}`).set(auth(adminToken)).expect(200)).body;
    expect(unchanged).toMatchObject({ latitude: 0, longitude: 0, radiusMeters: 150 });
    await patch({ latitude: 51.2301, longitude: 51.3701, radiusMeters: 250 }).expect(200);
    await patch({ name: 'Renamed without moving' }).expect(200);
    const reread = (await request(app.getHttpServer()).get(`/api/sections/code/${section.code}`).set(auth(adminToken)).expect(200)).body;
    expect(reread).toMatchObject({ name: 'Renamed without moving', code: section.code, latitude: 51.2301, longitude: 51.3701, radiusMeters: 250 });
    const saved = (await dataSource.query('SELECT latitude, longitude, radius_meters FROM sections WHERE id = $1', [section.id]))[0];
    expect(saved).toEqual({ latitude: 51.2301, longitude: 51.3701, radius_meters: 250 });
    const worker = (await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      username: `location-worker-${Date.now()}`, fullName: 'Location worker', role: 'WORKER', password: 'location-test-password',
    }).expect(201)).body;
    const token = (await request(app.getHttpServer()).post('/api/auth/login').set(client(worker.username))
      .send({ username: worker.username, password: 'location-test-password' }).expect(201)).body.accessToken;
    await request(app.getHttpServer()).patch(`/api/sections/${section.id}`).set(auth(token))
      .send({ latitude: 0, longitude: 0 }).expect(403);
    expect((await request(app.getHttpServer()).get(`/api/field/scan/${section.code}`).set(auth(token)).expect(200)).body.section)
      .toMatchObject({ latitude: 51.2301, longitude: 51.3701, radiusMeters: 250 });
  });

  it('runs object → task → route → QR/GPS/Face → evidence → materials → acceptance → KPI/report', async () => {
    const suffix = Date.now();
    await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      fullName: `Слабый пароль ${suffix}`,
      username: `weak-password-${suffix}`,
      password: '1234',
      role: 'WORKER',
    }).expect(400);
    await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      fullName: '   ',
      username: `blank-name-${suffix}`,
      password: 'valid-password',
      role: 'WORKER',
    }).expect(400);
    const controlUser = (await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      fullName: `E2E Антикор ${suffix}`,
      username: `e2e-control-${suffix}`,
      password: 'control-password',
      role: 'ANTICOR',
    }).expect(201)).body;
    const worker = (await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      fullName: `E2E Рабочий ${suffix}`,
      username: `e2e-worker-${suffix}`,
      password: 'worker-password',
      role: 'WORKER',
    }).expect(201)).body;
    const brigadier = (await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      fullName: `E2E Бригадир ${suffix}`,
      username: `e2e-brigadier-${suffix}`,
      password: 'brigadier-password',
      role: 'BRIGADIER',
    }).expect(201)).body;
    const outsiderBrigadier = (await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      fullName: `E2E Бригадир без бригады ${suffix}`,
      username: `e2e-unassigned-brigadier-${suffix}`,
      password: 'brigadier-password',
      role: 'BRIGADIER',
    }).expect(201)).body;
    const outsiderBrigadierToken = (await request(app.getHttpServer()).post('/api/auth/login').set(client(outsiderBrigadier.username)).send({
      username: outsiderBrigadier.username,
      password: 'brigadier-password',
    }).expect(201)).body.accessToken as string;
    const assignees = (await request(app.getHttpServer()).get('/api/users/assignees').set(auth(adminToken)).expect(200)).body;
    expect(assignees.some((row: { id: number }) => row.id === worker.id)).toBe(true);
    expect(assignees.some((row: { id: number }) => row.id === controlUser.id)).toBe(false);
    await request(app.getHttpServer()).post('/api/brigades').set(auth(adminToken)).send({
      name: '   ',
      brigadierId: controlUser.id,
      workerIds: [controlUser.id],
    }).expect(400);
    await request(app.getHttpServer()).post('/api/brigades').set(auth(adminToken)).send({
      name: `E2E Недопустимый бригадир ${suffix}`,
      brigadierId: controlUser.id,
      workerIds: [controlUser.id],
    }).expect(400);
    const brigade = (await request(app.getHttpServer()).post('/api/brigades').set(auth(adminToken)).send({
      name: `E2E Бригада ${suffix}`,
      brigadierId: brigadier.id,
      workerIds: [worker.id, brigadier.id],
    }).expect(201)).body;
    expect(new Set(brigade.workerIds)).toEqual(new Set([worker.id, brigadier.id]));
    const object = (await request(app.getHttpServer()).post('/api/objects').set(auth(adminToken)).send({
      name: `E2E Объект ${suffix}`,
    }).expect(201)).body;
    let section = (await request(app.getHttpServer()).post('/api/sections').set(auth(adminToken)).send({
      objectId: object.id,
      name: `E2E Участок ${suffix}`,
    }).expect(201)).body;
    await request(app.getHttpServer()).patch(`/api/sections/${section.id}`).set(auth(adminToken)).send({
      latitude: 91,
      longitude: 51.3701,
      radiusMeters: 5,
    }).expect(400);
    section = (await request(app.getHttpServer()).patch(`/api/sections/${section.id}`).set(auth(adminToken)).send({
      latitude: 51.2301,
      longitude: 51.3701,
      radiusMeters: 150,
    }).expect(200)).body;
    await request(app.getHttpServer()).get(`/api/sections/${section.id}`).expect(401);
    await request(app.getHttpServer()).post('/api/work-logs').send({
      sectionId: section.id,
      workerFullName: 'Аноним',
      workVolume: '100%',
      photoUrls: [],
    }).expect(404);
    await request(app.getHttpServer()).get('/api/attendance').expect(401);
    await request(app.getHttpServer()).get('/api/attendance/active-today').expect(404);
    await request(app.getHttpServer()).post('/api/attendance/check-out').send({
      workerFullName: worker.fullName,
    }).expect(404);
    const workType = (await request(app.getHttpServer()).post('/api/work-types').set(auth(adminToken)).send({
      name: `E2E Работа ${suffix}`,
    }).expect(201)).body;
    const inactiveWorkType = (await request(app.getHttpServer()).post('/api/work-types').set(auth(adminToken)).send({
      name: `E2E Архивная работа ${suffix}`,
    }).expect(201)).body;
    await request(app.getHttpServer()).post('/api/work-types').set(auth(adminToken)).send({
      name: `  ${workType.name.toLocaleLowerCase('ru')}  `,
    }).expect(409);
    await request(app.getHttpServer()).post('/api/work-types').set(auth(adminToken)).send({
      name: '   ',
    }).expect(400);
    expect((await request(app.getHttpServer())
      .delete(`/api/work-types/${inactiveWorkType.id}`)
      .set(auth(adminToken))
      .expect(200)).body).toMatchObject({ id: inactiveWorkType.id, isActive: false });
    expect((await request(app.getHttpServer()).get('/api/work-types').set(auth(adminToken)).expect(200)).body)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: inactiveWorkType.id, isActive: false })]));
    await request(app.getHttpServer()).post('/api/tasks').set(auth(adminToken)).send({
      sectionId: section.id,
      workTypeId: inactiveWorkType.id,
      assigneeUserId: worker.id,
      dueDate: businessDate(),
      description: 'Нельзя назначить архивный вид работы',
    }).expect(400);
    await request(app.getHttpServer()).post('/api/tasks').set(auth(adminToken)).send({
      sectionId: section.id,
      workTypeId: workType.id,
      assigneeUserId: controlUser.id,
      dueDate: businessDate(),
      description: 'Контрольная роль не является исполнителем',
    }).expect(400);
    await request(app.getHttpServer()).post('/api/tasks').set(auth(adminToken)).send({
      sectionId: section.id,
      workTypeId: workType.id,
      assigneeUserId: worker.id,
      dueDate: businessDate(),
      description: 'Клиент не управляет статусом создания',
      status: 'VERIFIED',
    }).expect(400);
    const task = (await request(app.getHttpServer()).post('/api/tasks').set(auth(adminToken)).send({
      sectionId: section.id,
      workTypeId: workType.id,
      assigneeUserId: worker.id,
      brigadeId: brigade.id,
      dueDate: businessDate(),
      description: 'Сквозной доказательный цикл E2E',
    }).expect(201)).body;
    const cancellableTask = (await request(app.getHttpServer()).post('/api/tasks').set(auth(adminToken)).send({
      sectionId: section.id,
      workTypeId: workType.id,
      assigneeUserId: worker.id,
      brigadeId: brigade.id,
      dueDate: businessDate(),
      description: 'Проверка отмены без удаления истории',
    }).expect(201)).body;
    await request(app.getHttpServer())
      .get('/api/dashboard/summary?date=2026-02-31')
      .set(auth(adminToken))
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/dashboard/summary?objectId=not-a-number')
      .set(auth(adminToken))
      .expect(400);
    const filteredDashboard = (await request(app.getHttpServer())
      .get(`/api/dashboard/summary?date=${businessDate()}&period=day&objectId=${object.id}&brigadeId=${brigade.id}`)
      .set(auth(adminToken))
      .expect(200)).body;
    expect(filteredDashboard.filters).toMatchObject({
      date: businessDate(),
      period: 'day',
      objectId: object.id,
      brigadeId: brigade.id,
    });
    expect(filteredDashboard.cards.objectsTotal).toBe(1);
    expect(filteredDashboard.tasksTodayList).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: task.id }),
      expect.objectContaining({ id: cancellableTask.id }),
    ]));
    const emptyDashboard = (await request(app.getHttpServer())
      .get(`/api/dashboard/summary?date=${businessDate()}&objectId=2147483647`)
      .set(auth(adminToken))
      .expect(200)).body;
    expect(emptyDashboard.cards.objectsTotal).toBe(0);
    expect(emptyDashboard.cards.tasksToday).toBe(0);
    expect(emptyDashboard.tasksTodayList).toEqual([]);
    const unassignedBrigadierDashboard = (await request(app.getHttpServer())
      .get(`/api/dashboard/summary?date=${businessDate()}`)
      .set(auth(outsiderBrigadierToken))
      .expect(200)).body;
    expect(unassignedBrigadierDashboard.cards.activeBrigades).toBe(0);
    expect(unassignedBrigadierDashboard.cards.tasksToday).toBe(0);
    expect(unassignedBrigadierDashboard.tasksTodayList).toEqual([]);
    await request(app.getHttpServer())
      .get(`/api/dashboard/summary?brigadeId=${brigade.id}`)
      .set(auth(outsiderBrigadierToken))
      .expect(403);
    await request(app.getHttpServer()).patch(`/api/work-types/${workType.id}`).set(auth(adminToken)).send({
      isActive: false,
    }).expect(400);
    await request(app.getHttpServer()).delete(`/api/work-types/${workType.id}`).set(auth(adminToken)).expect(400);
    await request(app.getHttpServer()).delete(`/api/sections/${section.id}`).set(auth(adminToken)).expect(400);
    await request(app.getHttpServer()).delete(`/api/objects/${object.id}`).set(auth(adminToken)).expect(400);
    const route = (await request(app.getHttpServer()).post('/api/routes').set(auth(adminToken)).send({
      workDate: businessDate(),
      brigadeId: brigade.id,
      stops: [
        { taskId: task.id, plannedArrivalAt: new Date(Date.now() - 60_000).toISOString() },
        { taskId: cancellableTask.id, plannedArrivalAt: new Date().toISOString() },
      ],
    }).expect(201)).body;
    await request(app.getHttpServer()).post('/api/routes').set(auth(adminToken)).send({
      workDate: businessDate(),
      brigadeId: brigade.id,
      stops: [{ taskId: task.id }],
    }).expect(400);
    await request(app.getHttpServer()).delete(`/api/tasks/${cancellableTask.id}`).set(auth(adminToken)).expect(204);
    expect((await request(app.getHttpServer()).get(`/api/tasks/${cancellableTask.id}`).set(auth(adminToken)).expect(200)).body)
      .toMatchObject({ id: cancellableTask.id, status: 'CANCELLED' });
    expect((await request(app.getHttpServer()).get(`/api/routes/${route.id}`).set(auth(adminToken)).expect(200)).body.stops)
      .toEqual(expect.arrayContaining([expect.objectContaining({ taskId: cancellableTask.id, status: 'SKIPPED' })]));
    await request(app.getHttpServer()).post('/api/routes').set(auth(adminToken)).send({
      workDate: businessDate(),
      brigadeId: brigade.id,
      stops: [{ taskId: cancellableTask.id }],
    }).expect(400);

    const brigadierToken = (await request(app.getHttpServer()).post('/api/auth/login').set(client(brigadier.username)).send({
      username: brigadier.username,
      password: 'brigadier-password',
    }).expect(201)).body.accessToken;
    const brigadeAssignees = (await request(app.getHttpServer()).get('/api/users/assignees').set(auth(brigadierToken)).expect(200)).body;
    expect(brigadeAssignees.some((row: { id: number }) => row.id === worker.id)).toBe(true);
    expect(brigadeAssignees.some((row: { id: number }) => row.id === controlUser.id)).toBe(false);
    await request(app.getHttpServer()).get(`/api/tasks/${task.id}`).set(auth(brigadierToken)).expect(200);
    await request(app.getHttpServer()).post('/api/routes').set(auth(brigadierToken)).send({
      workDate: businessDate(),
      brigadeId: 999999,
      stops: [{ taskId: task.id }],
    }).expect(403);
    await request(app.getHttpServer()).patch(`/api/tasks/${task.id}`).set(auth(adminToken)).send({
      status: 'VERIFIED',
    }).expect(400);

    workerToken = (await request(app.getHttpServer()).post('/api/auth/login').set(client(worker.username)).send({
      username: worker.username,
      password: 'worker-password',
    }).expect(201)).body.accessToken;
    const fieldToday = (await request(app.getHttpServer()).get('/api/field/today').set(auth(workerToken)).expect(200)).body;
    expect(fieldToday.tasks.some((row: { id: number }) => row.id === cancellableTask.id)).toBe(false);
    await request(app.getHttpServer()).post(`/api/routes/${route.id}/start`).set(auth(workerToken)).expect(201);
    await request(app.getHttpServer()).patch(`/api/tasks/${task.id}`).set(auth(adminToken)).send({
      description: 'Нельзя менять принятую задачу',
    }).expect(400);

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const uploadMany = async (names: string[]) => {
      let uploadRequest = request(app.getHttpServer()).post('/api/uploads/photos').set(auth(workerToken));
      for (const name of names) {
        uploadRequest = uploadRequest.attach('files', jpeg, { filename: name, contentType: 'image/jpeg' });
      }
      return (await uploadRequest.expect(201)).body as string[];
    };
    const upload = async (name: string) => (await uploadMany([name]))[0];
    const [faceCenter, faceLeft, faceRight, beforeUrl, afterUrl, forgedFutureAfterUrl] = await uploadMany([
      'face-center.jpg', 'face-left.jpg', 'face-right.jpg', 'before.jpg', 'after.jpg', 'after-forged-future.jpg',
    ]);
    const faceUrls = [faceCenter, faceLeft, faceRight];

    const arrivalBody = {
      clientOperationId: clientId(),
      clientExecutionId: clientId(),
      sectionCode: section.code,
      routeStopId: route.stops[0].id,
      latitude: 51.2301,
      longitude: 51.3701,
      accuracy: 5,
    };
    let execution = (await request(app.getHttpServer()).post(`/api/field/tasks/${task.id}/arrive`).set(auth(workerToken)).send(arrivalBody).expect(201)).body;
    const repeatedArrival = (await request(app.getHttpServer()).post(`/api/field/tasks/${task.id}/arrive`).set(auth(workerToken)).send(arrivalBody).expect(201)).body;
    expect(repeatedArrival.id).toBe(execution.id);
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/face`).set(auth(workerToken)).send({
      clientOperationId: clientId(), selfieUrl: faceUrls[0], livenessEvidenceUrls: faceUrls,
    }).expect(201)).body;
    const beforePhotoBody = {
      photos: [{ clientPhotoId: clientId(), phase: 'BEFORE', url: beforeUrl, capturedAt: new Date().toISOString(), latitude: 51.2301, longitude: 51.3701 }],
    };
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/photos`).set(auth(workerToken)).send(beforePhotoBody).expect(201)).body;
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/photos`).set(auth(workerToken)).send(beforePhotoBody).expect(201)).body;
    expect(execution.photos.filter((photo: { phase: string }) => photo.phase === 'BEFORE')).toHaveLength(1);
    await request(app.getHttpServer()).post(`/api/field/face/${execution.faceVerifications[0].id}/review`).set(auth(adminToken)).send({
      status: 'REJECTED',
    }).expect(400);
    execution = (await request(app.getHttpServer()).post(`/api/field/face/${execution.faceVerifications[0].id}/review`).set(auth(adminToken)).send({
      status: 'REJECTED', reviewComment: 'Лицо закрыто головным убором',
    }).expect(201)).body;
    await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/start`).set(auth(workerToken)).send({
      clientOperationId: clientId(), occurredAt: new Date().toISOString(),
    }).expect(400);
    await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/face`).set(auth(workerToken)).send({
      clientOperationId: clientId(), selfieUrl: faceUrls[0], livenessEvidenceUrls: faceUrls,
    }).expect(400);
    const repeatedFaceUrls = await uploadMany([
      'face-repeat-center.jpg', 'face-repeat-left.jpg', 'face-repeat-right.jpg',
    ]);
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/face`).set(auth(workerToken)).send({
      clientOperationId: clientId(), selfieUrl: repeatedFaceUrls[0], livenessEvidenceUrls: repeatedFaceUrls,
    }).expect(201)).body;
    const startBody = { clientOperationId: clientId(), occurredAt: new Date().toISOString() };
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/start`).set(auth(workerToken)).send(startBody).expect(201)).body;
    expect(execution.status).toBe('STARTED');
    const repeatedStart = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/start`).set(auth(workerToken)).send(startBody).expect(201)).body;
    expect(repeatedStart.id).toBe(execution.id);

    const material = await dataSource.getRepository(Product).save(dataSource.getRepository(Product).create({
      code: `E2E-${suffix}`,
      name: `E2E Материал ${suffix}`,
      unit: 'кг',
      initialQuantity: '100.000',
      incomingQuantity: '0.000',
      outgoingQuantity: '0.000',
      currentQuantity: '100.000',
      reservedQuantity: '0.000',
      minimumQuantity: '5.000',
      accountingPrice: '1.00', salePrice: '1.00', ourPrice: '1.00', totalAmount: '100.00',
      source: ProductSource.MANUAL,
    }));
    await request(app.getHttpServer()).get('/api/products').set(auth(workerToken)).expect(403);
    const fieldMaterials = (await request(app.getHttpServer()).get('/api/products/field-options').set(auth(workerToken)).expect(200)).body;
    const fieldMaterial = fieldMaterials.find((row: { id: number }) => row.id === material.id);
    expect(fieldMaterial).toMatchObject({ id: material.id, name: material.name, availableQuantity: 100 });
    expect(fieldMaterial).not.toHaveProperty('accountingPrice');
    const stockOperation = clientId();
    const issueBody = { productId: material.id, type: 'OUTCOME', quantity: 2, objectId: object.id, sectionId: section.id, taskId: task.id, brigadeId: brigade.id, executionId: execution.id, clientOperationId: stockOperation };
    const issued = (await request(app.getHttpServer()).post('/api/stock-movements').set(auth(workerToken)).send(issueBody).expect(201)).body;
    const duplicateIssue = (await request(app.getHttpServer()).post('/api/stock-movements').set(auth(workerToken)).send(issueBody).expect(201)).body;
    expect(duplicateIssue.id).toBe(issued.id);
    expect(await dataSource.getRepository(StockMovement).count({ where: { clientOperationId: stockOperation } })).toBe(1);
    await request(app.getHttpServer()).post('/api/stock-movements').set(auth(workerToken)).send({ ...issueBody, quantity: 3 }).expect(400);

    const locationOperation = clientId();
    const locationPoint = { clientOperationId: locationOperation, routeId: route.id, latitude: 51.2301, longitude: 51.3701, accuracy: 5, occurredAt: new Date().toISOString() };
    const locations = (await request(app.getHttpServer()).post('/api/field/locations/batch').set(auth(workerToken)).send({ points: [locationPoint, locationPoint] }).expect(201)).body;
    expect(locations).toMatchObject({ received: 2, created: 1, duplicates: 1 });
    const repeatedLocations = (await request(app.getHttpServer()).post('/api/field/locations/batch').set(auth(workerToken)).send({ points: [locationPoint] }).expect(201)).body;
    expect(repeatedLocations).toMatchObject({ received: 1, created: 0, duplicates: 1 });

    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/checklist`).set(auth(workerToken)).send({
      clientOperationId: clientId(),
      answers: execution.availableChecklist.map((item: { id: number }) => ({ itemId: item.id, isCompleted: true })),
    }).expect(201)).body;
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/photos`).set(auth(workerToken)).send({
      photos: [
        { clientPhotoId: clientId(), phase: 'AFTER', url: afterUrl, capturedAt: new Date().toISOString(), latitude: 51.2301, longitude: 51.3701 },
        {
          clientPhotoId: clientId(), phase: 'AFTER', url: forgedFutureAfterUrl,
          capturedAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          latitude: 51.2301, longitude: 51.3701,
        },
      ],
    }).expect(201)).body;
    await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/complete`).set(auth(workerToken)).send({
      clientOperationId: clientId(), occurredAt: new Date().toISOString(),
    }).expect(400);
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/complete`).set(auth(workerToken)).send({
      clientOperationId: clientId(), occurredAt: new Date().toISOString(), percent: 100,
      actualVolume: '250 м²', description: 'E2E работа завершена полностью',
    }).expect(201)).body;
    const outsiderQueue = (await request(app.getHttpServer())
      .get('/api/field/executions/review-queue')
      .set(auth(outsiderBrigadierToken))
      .expect(200)).body as Array<{ id: number }>;
    expect(outsiderQueue.some((row) => row.id === execution.id)).toBe(false);
    await request(app.getHttpServer())
      .get(`/api/field/executions/${execution.id}`)
      .set(auth(outsiderBrigadierToken))
      .expect(403);
    expect(execution.status).toBe('COMPLETED');
    const pendingReviewToday = (await request(app.getHttpServer()).get('/api/field/today').set(auth(workerToken)).expect(200)).body;
    expect(pendingReviewToday.tasks.some((row: { id: number }) => row.id === task.id)).toBe(false);

    execution = (await request(app.getHttpServer()).post(`/api/field/face/${execution.faceVerifications[0].id}/review`).set(auth(adminToken)).send({
      status: 'VERIFIED', reviewComment: 'E2E лицо подтверждено',
    }).expect(201)).body;
    await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/review`).set(auth(adminToken)).send({
      clientOperationId: clientId(), accepted: false,
    }).expect(400);
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/review`).set(auth(adminToken)).send({
      clientOperationId: clientId(), accepted: false, comment: 'Нужно исправить край участка',
    }).expect(201)).body;
    expect(execution.status).toBe('REJECTED');
    expect((await dataSource.getRepository(WorkLog).findOneByOrFail({ executionId: execution.id })).reviewStatus).toBe('REJECTED');
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/start`).set(auth(workerToken)).send({
      clientOperationId: clientId(), occurredAt: new Date().toISOString(),
    }).expect(201)).body;
    await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/complete`).set(auth(workerToken)).send({
      clientOperationId: clientId(), occurredAt: new Date().toISOString(), percent: 100,
      actualVolume: '260 м²', description: 'Край участка исправлен',
    }).expect(400);
    const reworkAfterUrl = await upload('after-rework.jpg');
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/photos`).set(auth(workerToken)).send({
      photos: [{ clientPhotoId: clientId(), phase: 'AFTER', url: reworkAfterUrl, capturedAt: new Date().toISOString(), latitude: 51.2301, longitude: 51.3701 }],
    }).expect(201)).body;
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/complete`).set(auth(workerToken)).send({
      clientOperationId: clientId(), occurredAt: new Date().toISOString(), percent: 100,
      actualVolume: '260 м²', description: 'Край участка исправлен',
    }).expect(201)).body;
    expect(await dataSource.getRepository(WorkLog).findOneByOrFail({ executionId: execution.id })).toMatchObject({
      reviewStatus: 'PENDING', workVolume: '260 м²', comment: 'Край участка исправлен',
    });
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/review`).set(auth(adminToken)).send({
      clientOperationId: clientId(), accepted: true, comment: 'E2E принято',
    }).expect(201)).body;
    expect(execution.status).toBe('ACCEPTED');
    expect((await dataSource.getRepository(WorkLog).findOneByOrFail({ executionId: execution.id })).reviewStatus).toBe('APPROVED');

    const finalRoute = (await request(app.getHttpServer()).get(`/api/routes/${route.id}`).set(auth(adminToken)).expect(200)).body;
    expect(finalRoute.status).toBe('COMPLETED');
    const finalTask = (await request(app.getHttpServer()).get(`/api/tasks/${task.id}`).set(auth(adminToken)).expect(200)).body;
    expect(finalTask.status).toBe('VERIFIED');
    const attendance = (await request(app.getHttpServer()).get(`/api/attendance?dateFrom=${businessDate()}&dateTo=${businessDate()}`).set(auth(adminToken)).expect(200)).body;
    expect(attendance.some((row: { workerFullName: string }) => row.workerFullName === worker.fullName)).toBe(true);
    const kpi = (await request(app.getHttpServer()).get(`/api/operations/kpi?anchor=${businessDate()}&period=day&groupBy=employee`).set(auth(adminToken)).expect(200)).body;
    expect(kpi.rows.some((row: { key: string; accepted: number }) => row.key === String(worker.id) && row.accepted === 1)).toBe(true);
    const report = (await request(app.getHttpServer()).get(`/api/operations/reports/evidence?anchor=${businessDate()}&period=day`).set(auth(adminToken)).expect(200)).body;
    const reportRow = report.rows.find((row: { id: number }) => row.id === execution.id);
    expect(reportRow.face.status).toBe('VERIFIED');
    expect(reportRow.photos.map((row: { phase: string }) => row.phase).sort()).toEqual(['AFTER', 'AFTER', 'AFTER', 'BEFORE']);
    expect(reportRow.materials).toHaveLength(1);
    expect(execution.worker).not.toHaveProperty('passwordHash');
    const users = (await request(app.getHttpServer()).get('/api/users').set(auth(adminToken)).expect(200)).body;
    expect(users.every((row: Record<string, unknown>) => !('passwordHash' in row))).toBe(true);
    const disposable = (await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      fullName: `E2E Отключение ${suffix}`,
      username: `e2e-disabled-${suffix}`,
      password: 'disabled-password',
      role: 'WORKER',
    }).expect(201)).body;
    await request(app.getHttpServer()).delete(`/api/users/${disposable.id}`).set(auth(adminToken)).expect(204);
    expect((await request(app.getHttpServer()).get(`/api/users/${disposable.id}`).set(auth(adminToken)).expect(200)).body)
      .toMatchObject({ id: disposable.id, isActive: false });
    await request(app.getHttpServer()).post('/api/auth/login').set(client(disposable.username)).send({
      username: disposable.username,
      password: 'disabled-password',
    }).expect(401);
    await request(app.getHttpServer()).delete(`/api/users/${adminUserId}`).set(auth(adminToken)).expect(400);
    await request(app.getHttpServer()).delete(`/api/brigades/${brigade.id}`).set(auth(adminToken)).expect(204);
    expect((await request(app.getHttpServer()).get(`/api/brigades/${brigade.id}`).set(auth(adminToken)).expect(200)).body)
      .toMatchObject({ id: brigade.id, isActive: false });
    expect((await request(app.getHttpServer()).get(`/api/tasks/${task.id}`).set(auth(adminToken)).expect(200)).body)
      .toMatchObject({ id: task.id, brigadeId: brigade.id });

    await request(app.getHttpServer()).delete(`/api/objects/${object.id}`).set(auth(adminToken)).expect(200);
    const archivedObject = (await request(app.getHttpServer())
      .get(`/api/objects/${object.id}`)
      .set(auth(adminToken))
      .expect(200)).body;
    expect(archivedObject).toMatchObject({ id: object.id, isActive: false });
    expect(archivedObject.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: section.id, isActive: false }),
    ]));
    expect((await request(app.getHttpServer()).get(`/api/tasks/${task.id}`).set(auth(adminToken)).expect(200)).body)
      .toMatchObject({ id: task.id, sectionId: section.id });
    await request(app.getHttpServer()).get(`/api/field/scan/${section.code}`).set(auth(workerToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/qr/${section.code}`).expect(404);
    await request(app.getHttpServer()).post('/api/sections').set(auth(adminToken)).send({
      objectId: object.id,
      name: `E2E Участок архивного объекта ${suffix}`,
    }).expect(400);
    await request(app.getHttpServer()).post('/api/tasks').set(auth(adminToken)).send({
      sectionId: section.id,
      workTypeId: workType.id,
      assigneeUserId: worker.id,
      dueDate: businessDate(),
      description: 'Нельзя назначить задачу на архивный участок',
    }).expect(400);

    await request(app.getHttpServer()).patch(`/api/objects/${object.id}`).set(auth(adminToken)).send({
      isActive: true,
    }).expect(200);
    expect((await request(app.getHttpServer()).get(`/api/sections/${section.id}`).set(auth(adminToken)).expect(200)).body)
      .toMatchObject({ id: section.id, isActive: false });
    await request(app.getHttpServer()).patch(`/api/sections/${section.id}`).set(auth(adminToken)).send({
      isActive: true,
    }).expect(200);
    await request(app.getHttpServer()).get(`/api/qr/${section.code}`).expect(200).expect('Content-Type', /image\/png/);
    await request(app.getHttpServer()).delete(`/api/sections/${section.id}`).set(auth(adminToken)).expect(204);
    expect((await request(app.getHttpServer()).get(`/api/sections/${section.id}`).set(auth(adminToken)).expect(200)).body)
      .toMatchObject({ id: section.id, isActive: false });
    expect((await request(app.getHttpServer()).get(`/api/tasks/${task.id}`).set(auth(adminToken)).expect(200)).body)
      .toMatchObject({ id: task.id, sectionId: section.id });
    await request(app.getHttpServer()).get(`/api/field/scan/${section.code}`).set(auth(workerToken)).expect(404);
  });

  it('persists a validated worker-day result and rejects forged or inconsistent evidence', async () => {
    const suffix = Date.now();
    const worker = (await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      fullName: `E2E Смена ${suffix}`,
      username: `e2e-day-${suffix}`,
      password: 'worker-password',
      role: 'WORKER',
    }).expect(201)).body;
    const outsiderBrigadier = (await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      fullName: `E2E Чужой бригадир ${suffix}`,
      username: `e2e-outsider-brigadier-${suffix}`,
      password: 'brigadier-password',
      role: 'BRIGADIER',
    }).expect(201)).body;
    const outsiderToken = (await request(app.getHttpServer()).post('/api/auth/login').set(client(outsiderBrigadier.username)).send({
      username: outsiderBrigadier.username,
      password: 'brigadier-password',
    }).expect(201)).body.accessToken as string;
    const object = (await request(app.getHttpServer()).post('/api/objects').set(auth(adminToken)).send({
      name: `E2E Объект смены ${suffix}`,
    }).expect(201)).body;
    let section = (await request(app.getHttpServer()).post('/api/sections').set(auth(adminToken)).send({
      objectId: object.id,
      name: `E2E Участок смены ${suffix}`,
    }).expect(201)).body;
    section = (await request(app.getHttpServer()).patch(`/api/sections/${section.id}`).set(auth(adminToken)).send({
      latitude: 51.2301,
      longitude: 51.3701,
      radiusMeters: 150,
    }).expect(200)).body;
    const workType = (await request(app.getHttpServer()).post('/api/work-types').set(auth(adminToken)).send({
      name: `E2E Работа смены ${suffix}`,
    }).expect(201)).body;
    const task = (await request(app.getHttpServer()).post('/api/tasks').set(auth(adminToken)).send({
      sectionId: section.id,
      workTypeId: workType.id,
      assigneeUserId: worker.id,
      dueDate: businessDate(),
      description: 'Полив участка и уборка территории',
    }).expect(201)).body;
    const token = (await request(app.getHttpServer()).post('/api/auth/login').set(client(worker.username)).send({
      username: worker.username,
      password: 'worker-password',
    }).expect(201)).body.accessToken as string;
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const uploadMany = async (names: string[]) => {
      let uploadRequest = request(app.getHttpServer()).post('/api/uploads/photos').set(auth(token));
      for (const name of names) {
        uploadRequest = uploadRequest.attach('files', jpeg, { filename: name, contentType: 'image/jpeg' });
      }
      return (await uploadRequest.expect(201)).body as string[];
    };
    const [startCenter, startLeft, startRight, startPhoto] = await uploadMany([
      'start-center.jpg', 'start-left.jpg', 'start-right.jpg', 'start-work.jpg',
    ]);
    const startFaces = [startCenter, startLeft, startRight];
    const startBody = {
      clientSessionId: clientId(),
      sectionCode: section.code,
      latitude: 51.2301,
      longitude: 51.3701,
      accuracy: 5,
      selfieUrl: startFaces[0],
      livenessEvidenceUrls: startFaces,
      startPhotoUrl: startPhoto,
    };
    // A valid authenticated upload remains unreadable to anonymous and unrelated users.
    await request(app.getHttpServer()).get(startPhoto).expect(401);
    await request(app.getHttpServer()).get(startPhoto).set(auth(token)).expect(200).expect('Cache-Control', /no-store/);
    await request(app.getHttpServer()).get(startPhoto).set(auth(outsiderToken)).expect(404);
    await request(app.getHttpServer()).get(startPhoto).set(auth(adminToken)).expect(200);
    await request(app.getHttpServer()).post('/api/uploads/photos').attach('files', jpeg, 'anonymous.jpg').expect(401);
    const foreign = (await request(app.getHttpServer()).post('/api/uploads/photos').set(auth(adminToken))
      .attach('files', jpeg, { filename: 'foreign.jpg', contentType: 'image/jpeg' }).expect(201)).body[0];
    await request(app.getHttpServer()).post('/api/field/work-days/start').set(auth(token))
      .send({ ...startBody, startPhotoUrl: foreign }).expect(403);
    for (const accuracy of [null, 51, 1000000]) {
      await request(app.getHttpServer()).post('/api/field/work-days/start').set(auth(token))
        .send({ ...startBody, accuracy }).expect(400);
    }
    await request(app.getHttpServer()).post('/api/field/work-days/start').set(auth(token))
      .send({ ...startBody, latitude: 51.2316, accuracy: 50 }).expect(400);
    await dataSource.query('UPDATE sections SET latitude = NULL WHERE id = $1', [section.id]);
    await request(app.getHttpServer()).post('/api/field/work-days/start').set(auth(token)).send(startBody).expect(400);
    await dataSource.query('UPDATE sections SET latitude = $1 WHERE id = $2', [51.2301, section.id]);
    const session = (await request(app.getHttpServer())
      .post('/api/field/work-days/start')
      .set(auth(token))
      .send(startBody)
      .expect(201)).body;
    const repeatedStart = (await request(app.getHttpServer())
      .post('/api/field/work-days/start')
      .set(auth(token))
      .send(startBody)
      .expect(201)).body;
    expect(repeatedStart.id).toBe(session.id);
    expect(session.taskScope).toEqual([{ taskId: task.id, description: task.description }]);
    expect(session.startLivenessEvidenceUrls).toEqual(startFaces);
    const outsiderDays = (await request(app.getHttpServer())
      .get('/api/field/work-days')
      .set(auth(outsiderToken))
      .expect(200)).body as Array<{ id: number }>;
    expect(outsiderDays.some((row) => row.id === session.id)).toBe(false);
    const me = await request(app.getHttpServer()).get('/api/auth/me').set(auth(token)).expect(200);
    const cookie = String(me.headers['set-cookie'][0]).split(';')[0];
    await request(app.getHttpServer()).get(startPhoto).set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).get('/api/users').set('Cookie', cookie).expect(401);
    const logout = await request(app.getHttpServer()).post('/api/auth/logout').expect(201);
    expect(String(logout.headers['set-cookie'][0])).toContain('gp_work_media=;');
    // Brigade access comes from a related shift, not from possession of its URL.
    const openAttendance = (await request(app.getHttpServer())
      .get(`/api/attendance?dateFrom=${businessDate()}&dateTo=${businessDate()}`)
      .set(auth(adminToken))
      .expect(200)).body.find((row: { userId: number }) => row.userId === worker.id);
    expect(openAttendance).toMatchObject({
      userId: worker.id,
      workerFullName: worker.fullName,
      status: 'ON_DUTY',
      checkOutTime: null,
      reportCount: 0,
    });

    const [endCenter, endLeft, endRight, resultPhoto] = await uploadMany([
      'end-center.jpg', 'end-left.jpg', 'end-right.jpg', 'result-work.jpg',
    ]);
    const endFaces = [endCenter, endLeft, endRight];
    const validResult = {
      taskId: task.id,
      percent: 75,
      actualVolume: '150 м²',
      description: 'Полив выполнен, территория очищена частично',
      incompleteReason: 'Не хватило воды для последней зоны',
    };
    const closeBody = {
      sessionId: session.id,
      sectionCode: section.code,
      latitude: 51.2301,
      longitude: 51.3701,
      accuracy: 5,
      selfieUrl: endFaces[0],
      livenessEvidenceUrls: endFaces,
      resultPhotoUrls: [resultPhoto],
      results: [validResult],
      summary: 'Смена завершена с подтверждённым частичным результатом',
    };
    await request(app.getHttpServer())
      .post('/api/field/work-days/close')
      .set(auth(token))
      .send({ ...closeBody, resultPhotoUrls: ['https://attacker.example/fake.jpg'] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/field/work-days/close')
      .set(auth(token))
      .send({ ...closeBody, results: [{ ...validResult, percent: 101 }] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/field/work-days/close')
      .set(auth(token))
      .send({ ...closeBody, results: [validResult, validResult] })
      .expect(400);

    await request(app.getHttpServer()).post('/api/field/work-days/close').set(auth(token))
      .send({ ...closeBody, accuracy: 1000000 }).expect(400);
    const closed = (await request(app.getHttpServer())
      .post('/api/field/work-days/close')
      .set(auth(token))
      .send(closeBody)
      .expect(201)).body;
    expect(closed).toMatchObject({ status: 'CLOSED', overallPercent: 75 });
    expect(closed.endLivenessEvidenceUrls).toEqual(endFaces);
    expect(closed.taskResults).toEqual([{
      taskId: task.id,
      description: task.description,
      percent: 75,
      actualVolume: '150 м²',
      workDescription: validResult.description,
      incompleteReason: validResult.incompleteReason,
    }]);
    const repeatedClose = (await request(app.getHttpServer())
      .post('/api/field/work-days/close')
      .set(auth(token))
      .send(closeBody)
      .expect(201)).body;
    expect(repeatedClose.id).toBe(session.id);
    const closedAttendance = (await request(app.getHttpServer())
      .get(`/api/attendance?dateFrom=${businessDate()}&dateTo=${businessDate()}`)
      .set(auth(adminToken))
      .expect(200)).body.find((row: { userId: number }) => row.userId === worker.id);
    expect(closedAttendance).toMatchObject({ userId: worker.id, status: 'COMPLETED', completionPercent: 75 });
    expect(closedAttendance.checkOutTime).toBeTruthy();
    expect(closedAttendance.checkOutLatitude).toBeCloseTo(51.2301);
    expect(closedAttendance.checkOutLongitude).toBeCloseTo(51.3701);
    await request(app.getHttpServer())
      .post(`/api/field/work-days/${session.id}/review`)
      .set(auth(outsiderToken))
      .send({ accepted: true })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/field/work-days/close')
      .set(auth(token))
      .send({ ...closeBody, results: [{ ...validResult, percent: 80 }] })
      .expect(400);

    const listed = (await request(app.getHttpServer())
      .get('/api/field/work-days')
      .set(auth(adminToken))
      .expect(200)).body as Array<{ id: number; taskResults: unknown[] }>;
    expect(listed.find((row) => row.id === session.id)?.taskResults).toHaveLength(1);

    await request(app.getHttpServer())
      .post(`/api/field/work-days/${session.id}/review`)
      .set(auth(adminToken))
      .send({ accepted: false })
      .expect(400);
    const returned = (await request(app.getHttpServer())
      .post(`/api/field/work-days/${session.id}/review`)
      .set(auth(adminToken))
      .send({ accepted: false, comment: 'Исправить незавершённую зону' })
      .expect(201)).body;
    expect(returned).toMatchObject({ status: 'RETURNED', reviewComment: 'Исправить незавершённую зону' });
    const returnedState = (await request(app.getHttpServer())
      .get(`/api/field/scan/${section.code}`)
      .set(auth(token))
      .expect(200)).body;
    expect(returnedState).toMatchObject({
      action: 'CORRECT_AND_CLOSE',
      session: { id: session.id, status: 'RETURNED' },
    });

    await request(app.getHttpServer())
      .post('/api/field/work-days/close')
      .set(auth(token))
      .send({
        ...closeBody,
        results: [{ ...validResult, percent: 100, incompleteReason: '' }],
        summary: 'Замечание устранено, работа выполнена полностью',
      })
      .expect(400);
    const [resubmitCenter, resubmitLeft, resubmitRight, resubmittedPhoto] = await uploadMany([
      'resubmit-center.jpg', 'resubmit-left.jpg', 'resubmit-right.jpg', 'result-work-resubmitted.jpg',
    ]);
    const resubmittedFaces = [resubmitCenter, resubmitLeft, resubmitRight];
    const resubmitted = (await request(app.getHttpServer())
      .post('/api/field/work-days/close')
      .set(auth(token))
      .send({
        ...closeBody,
        selfieUrl: resubmittedFaces[0],
        livenessEvidenceUrls: resubmittedFaces,
        resultPhotoUrls: [resultPhoto, resubmittedPhoto],
        results: [{ ...validResult, percent: 100, incompleteReason: '' }],
        summary: 'Замечание устранено, работа выполнена полностью',
      })
      .expect(201)).body;
    expect(resubmitted).toMatchObject({ status: 'CLOSED', overallPercent: 100, reviewComment: null });
    expect(resubmitted.endLivenessEvidenceUrls).toEqual(resubmittedFaces);
    expect(resubmitted.resultPhotoUrls).toEqual([resultPhoto, resubmittedPhoto]);
    expect(resubmitted.events.at(-1).type).toBe('RESUBMITTED');
    const correctedAttendance = (await request(app.getHttpServer())
      .get(`/api/attendance?dateFrom=${businessDate()}&dateTo=${businessDate()}`)
      .set(auth(adminToken)).expect(200)).body.find((row: { userId: number }) => row.userId === worker.id);
    expect(correctedAttendance).toMatchObject({ id: closedAttendance.id, userId: worker.id, completionPercent: 100 });
    expect(correctedAttendance.checkOutTime).toBe(closedAttendance.checkOutTime);
    expect(correctedAttendance.workedHours).toBe(closedAttendance.workedHours);
    const reviewed = (await request(app.getHttpServer())
      .post(`/api/field/work-days/${session.id}/review`)
      .set(auth(adminToken))
      .send({ accepted: true, comment: 'Исправление принято' })
      .expect(201)).body;
    expect(reviewed.status).toBe('REVIEWED');
  });
  it('keeps both form settings independent and requires administrator access', async () => {
    await request(app.getHttpServer()).get('/api/form-settings?form=checkout_form').expect(401);
    const work = (await request(app.getHttpServer()).get('/api/form-settings?form=work_form')
      .set(auth(adminToken)).expect(200)).body;
    const checkout = (await request(app.getHttpServer()).get('/api/form-settings?form=checkout_form')
      .set(auth(adminToken)).expect(200)).body;
    const updated = { ...checkout, formTitle: `Уход ${Date.now()}`,
      fields: checkout.fields.map((field: { id: string }) => field.id === 'comment'
        ? { ...field, visible: false, required: true } : field) };
    await request(app.getHttpServer()).put('/api/form-settings?form=checkout_form')
      .set(auth(adminToken)).send(updated).expect(200);
    const saved = (await request(app.getHttpServer()).get('/api/form-settings?form=checkout_form')
      .set(auth(adminToken)).expect(200)).body;
    expect(saved.formTitle).toBe(updated.formTitle);
    expect(saved.fields.find((field: { id: string }) => field.id === 'comment'))
      .toMatchObject({ visible: false, required: false });
    expect((await request(app.getHttpServer()).get('/api/form-settings?form=work_form')
      .set(auth(adminToken)).expect(200)).body).toEqual(work);
  });

  it('backfills only unambiguous legacy photo owners without changing evidence', async () => {
    const suffix = Date.now();
    const make = async (path: string, body: unknown) => (await request(app.getHttpServer())
      .post(`/api/${path}`).set(auth(adminToken)).send(body as Record<string, unknown>).expect(201)).body;
    const first = await make('users', { fullName: 'Legacy A', username: `legacy-a-${suffix}`, password: 'legacy-test-password', role: 'WORKER' });
    const second = await make('users', { fullName: 'Legacy B', username: `legacy-b-${suffix}`, password: 'legacy-test-password', role: 'WORKER' });
    const object = await make('objects', { name: `Legacy migration ${suffix}` });
    const section = await make('sections', { objectId: object.id, name: 'Legacy section' });
    const a = `${suffix}-${clientId()}.jpg`;
    const b = `${suffix}-${clientId()}.jpg`;
    const ambiguous = `${suffix}-${clientId()}.jpg`;
    for (const [userId, filename] of [[first.id, a], [second.id, b]]) {
      await dataSource.query(`INSERT INTO work_day_sessions
        (client_session_id, user_id, section_id, shift_date, status, start_qr, start_latitude, start_longitude, start_selfie_url, start_photo_url)
        VALUES ($1, $2, $3, CURRENT_DATE, 'CLOSED', $4, 51.23, 51.37, $5, $6)`,
        [clientId(), userId, section.id, section.code, `/uploads/photos/${filename}`, `/uploads/photos/${ambiguous}`]);
    }
    const before = await dataSource.query('SELECT * FROM work_day_sessions WHERE section_id = $1 ORDER BY id', [section.id]);
    const { AddPhotoOwnership1732400000000 } = await import('../src/database/migrations/1732400000000-AddPhotoOwnership');
    const runner = dataSource.createQueryRunner();
    try {
      await new AddPhotoOwnership1732400000000().up(runner);
      await new AddPhotoOwnership1732400000000().up(runner);
    } finally { await runner.release(); }
    const owners = await dataSource.query('SELECT filename, owner_user_id FROM uploaded_photos WHERE filename = ANY($1::text[])', [[a, b, ambiguous]]);
    expect(owners).toHaveLength(2);
    expect(owners).toEqual(expect.arrayContaining([
      { filename: a, owner_user_id: first.id }, { filename: b, owner_user_id: second.id },
    ]));
    expect(await dataSource.query('SELECT * FROM work_day_sessions WHERE section_id = $1 ORDER BY id', [section.id])).toEqual(before);
  });

});
