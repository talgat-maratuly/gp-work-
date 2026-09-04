import { INestApplication, ValidationPipe } from '@nestjs/common';
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

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

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
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    dataSource = app.get(DataSource);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD })
      .expect(201);
    adminToken = login.body.accessToken;
    adminUserId = login.body.user.id;
  });

  afterAll(async () => {
    if (app) await app.close();
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
    const workType = (await request(app.getHttpServer()).post('/api/work-types').set(auth(adminToken)).send({
      name: `E2E Работа ${suffix}`,
    }).expect(201)).body;
    const task = (await request(app.getHttpServer()).post('/api/tasks').set(auth(adminToken)).send({
      sectionId: section.id,
      workTypeId: workType.id,
      assigneeUserId: worker.id,
      brigadeId: brigade.id,
      dueDate: businessDate(),
      description: 'Сквозной доказательный цикл E2E',
    }).expect(201)).body;
    const route = (await request(app.getHttpServer()).post('/api/routes').set(auth(adminToken)).send({
      workDate: businessDate(),
      brigadeId: brigade.id,
      stops: [{ taskId: task.id, plannedArrivalAt: new Date(Date.now() - 60_000).toISOString() }],
    }).expect(201)).body;

    workerToken = (await request(app.getHttpServer()).post('/api/auth/login').send({
      username: worker.username,
      password: 'worker-password',
    }).expect(201)).body.accessToken;
    await request(app.getHttpServer()).post(`/api/routes/${route.id}/start`).set(auth(workerToken)).expect(201);

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
    expect(execution.status).toBe('COMPLETED');

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
    await request(app.getHttpServer()).post('/api/auth/login').send({
      username: disposable.username,
      password: 'disabled-password',
    }).expect(403);
    await request(app.getHttpServer()).delete(`/api/users/${adminUserId}`).set(auth(adminToken)).expect(400);
    await request(app.getHttpServer()).delete(`/api/brigades/${brigade.id}`).set(auth(adminToken)).expect(204);
    expect((await request(app.getHttpServer()).get(`/api/brigades/${brigade.id}`).set(auth(adminToken)).expect(200)).body)
      .toMatchObject({ id: brigade.id, isActive: false });
    expect((await request(app.getHttpServer()).get(`/api/tasks/${task.id}`).set(auth(adminToken)).expect(200)).body)
      .toMatchObject({ id: task.id, brigadeId: brigade.id });
  });

  it('persists a validated worker-day result and rejects forged or inconsistent evidence', async () => {
    const suffix = Date.now();
    const worker = (await request(app.getHttpServer()).post('/api/users').set(auth(adminToken)).send({
      fullName: `E2E Смена ${suffix}`,
      username: `e2e-day-${suffix}`,
      password: 'worker-password',
      role: 'WORKER',
    }).expect(201)).body;
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
    const token = (await request(app.getHttpServer()).post('/api/auth/login').send({
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
    const reviewed = (await request(app.getHttpServer())
      .post(`/api/field/work-days/${session.id}/review`)
      .set(auth(adminToken))
      .send({ accepted: true, comment: 'Исправление принято' })
      .expect(201)).body;
    expect(reviewed.status).toBe('REVIEWED');
  });
});
