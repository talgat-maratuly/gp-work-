import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ProductSource } from '../src/common/enums/product-source.enum';
import { Product, StockMovement } from '../src/entities';

const clientId = () => crypto.randomUUID();
const businessDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.BUSINESS_TIME_ZONE || 'Asia/Oral',
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

describe('GP Work evidence field cycle (PostgreSQL)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
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
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('runs object → task → route → QR/GPS/Face → evidence → materials → acceptance → KPI/report', async () => {
    const suffix = Date.now();
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
    const brigade = (await request(app.getHttpServer()).post('/api/brigades').set(auth(adminToken)).send({
      name: `E2E Бригада ${suffix}`,
      brigadierId: brigadier.id,
      workerIds: [worker.id, brigadier.id],
    }).expect(201)).body;
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
    const upload = async (name: string) => (await request(app.getHttpServer())
      .post('/api/uploads/photos')
      .attach('files', jpeg, { filename: name, contentType: 'image/jpeg' })
      .expect(201)).body[0] as string;
    const faceUrl = await upload('face.jpg');
    const beforeUrl = await upload('before.jpg');
    const afterUrl = await upload('after.jpg');

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
      clientOperationId: clientId(), selfieUrl: faceUrl, livenessEvidenceUrls: [faceUrl],
    }).expect(201)).body;
    const beforePhotoBody = {
      photos: [{ clientPhotoId: clientId(), phase: 'BEFORE', url: beforeUrl, capturedAt: new Date().toISOString(), latitude: 51.2301, longitude: 51.3701 }],
    };
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/photos`).set(auth(workerToken)).send(beforePhotoBody).expect(201)).body;
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/photos`).set(auth(workerToken)).send(beforePhotoBody).expect(201)).body;
    expect(execution.photos.filter((photo: { phase: string }) => photo.phase === 'BEFORE')).toHaveLength(1);
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
      photos: [{ clientPhotoId: clientId(), phase: 'AFTER', url: afterUrl, capturedAt: new Date().toISOString(), latitude: 51.2301, longitude: 51.3701 }],
    }).expect(201)).body;
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/complete`).set(auth(workerToken)).send({
      clientOperationId: clientId(), occurredAt: new Date().toISOString(), comment: 'E2E работа завершена',
    }).expect(201)).body;
    expect(execution.status).toBe('COMPLETED');

    execution = (await request(app.getHttpServer()).post(`/api/field/face/${execution.faceVerifications[0].id}/review`).set(auth(adminToken)).send({
      status: 'VERIFIED', reviewComment: 'E2E лицо подтверждено',
    }).expect(201)).body;
    execution = (await request(app.getHttpServer()).post(`/api/field/executions/${execution.id}/review`).set(auth(adminToken)).send({
      clientOperationId: clientId(), accepted: true, comment: 'E2E принято',
    }).expect(201)).body;
    expect(execution.status).toBe('ACCEPTED');

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
    expect(reportRow.photos.map((row: { phase: string }) => row.phase).sort()).toEqual(['AFTER', 'BEFORE']);
    expect(reportRow.materials).toHaveLength(1);
  });
});
