import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { businessDateString } from '../src/common/business-date';

describe('Employee day clock (real API/database)', () => {
  let app: INestApplication, db: DataSource;
  let admin: string;
  let worker: { id: number; token: string }, office: { id: number; token: string };
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  let sequence = 0;
  const point = { latitude: 51.2301, longitude: 51.3701, accuracy: 5 };
  const password = 'clock-test-password';
  const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, pass = password) => (await request(app.getHttpServer())
    .post('/api/auth/login').set('X-Forwarded-For', `10.70.0.${++sequence}`)
    .send({ username, password: pass }).expect(201)).body.accessToken;
  const create = async (role: string) => {
    const username = `clock-${role.toLowerCase()}-${suffix}-${sequence}`;
    const result = await request(app.getHttpServer()).post('/api/users').set(headers(admin))
      .send({ username, password, fullName: `Одинаковое ФИО ${suffix}`, role }).expect(201);
    return { id: result.body.id, token: await login(username) };
  };
  const start = (token: string, body: object = point) => request(app.getHttpServer())
    .post('/api/attendance/me/start').set(headers(token)).send(body);
  const finish = (token: string, id: number, body: object = point) => request(app.getHttpServer())
    .post(`/api/attendance/me/${id}/finish`).set(headers(token)).send(body);
  const mine = async (token: string) => (await request(app.getHttpServer()).get('/api/attendance/me').set(headers(token)).expect(200)).body;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_MIGRATE = 'true';
    process.env.JWT_SECRET ||= 'clock-test-only-secret-at-least-32-characters';
    process.env.ADMIN_USERNAME ||= 'e2e-admin';
    process.env.ADMIN_PASSWORD ||= 'e2e-admin-password';
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    db = app.get(DataSource);
    admin = await login(process.env.ADMIN_USERNAME!, process.env.ADMIN_PASSWORD!);
    worker = await create('WORKER');
    office = await create('ACCOUNTANT');
  });
  afterAll(async () => { if (app) await app.close(); });

  it('allows every employee role to mark itself and excludes anonymous and external observers', async () => {
    await request(app.getHttpServer()).get('/api/attendance/me').expect(401);
    await request(app.getHttpServer()).post('/api/attendance/me/start').send(point).expect(401);
    for (const role of ['AKIMAT', 'ANTICOR']) {
      const observer = await create(role);
      await request(app.getHttpServer()).get('/api/attendance/me').set(headers(observer.token)).expect(403);
      await start(observer.token).expect(403);
      await finish(observer.token, 1).expect(403);
    }
    for (const role of ['ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'BRIGADIER', 'AGRONOMIST', 'WORKER', 'WATER_CARRIER']) {
      const employee = await create(role);
      const record = (await start(employee.token).expect(201)).body;
      expect(record).toMatchObject({ userId: employee.id, status: 'ON_DUTY', checkInAccuracy: 5 });
      expect((await mine(employee.token)).current.id).toBe(record.id);
      expect((await finish(employee.token, record.id).expect(201)).body).toMatchObject({ status: 'COMPLETED', checkOutAccuracy: 5 });
    }
  });

  it('requires valid GPS and ignores neither forged identities nor client timestamps; concurrent retries keep one mark', async () => {
    for (const body of [
      {}, { ...point, latitude: 91 }, { ...point, longitude: -181 }, { ...point, accuracy: -1 },
      { ...point, latitude: null }, { ...point, latitude: '51' }, { ...point, accuracy: null },
      { ...point, userId: office.id }, { ...point, checkInTime: '2000-01-01T00:00:00Z' },
    ]) await start(worker.token, body).expect(400);
    expect((await mine(worker.token)).current).toBeNull();
    const before = Date.now();
    const results = await Promise.all([1, 2, 3].map(() => start(worker.token).expect(201)));
    const first = results[0].body;
    expect(new Set(results.map(result => result.body.id)).size).toBe(1);
    expect(first).toMatchObject({ userId: worker.id, status: 'ON_DUTY', reportCount: 0, workedHours: null, checkInLatitude: point.latitude });
    expect(Date.parse(first.checkInTime)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(first.checkInTime)).toBeLessThanOrEqual(Date.now());
    const rows = await db.query('SELECT id FROM attendance_records WHERE user_id = $1', [worker.id]);
    expect(rows).toHaveLength(1);
  });

  it('keeps personal records isolated, protects other employees, and preserves accountant location redaction', async () => {
    const own = (await start(office.token, { latitude: 0, longitude: 0, accuracy: 30 }).expect(201)).body;
    const workerDay = (await mine(worker.token)).current;
    await finish(office.token, workerDay.id).expect(404);
    await request(app.getHttpServer()).get('/api/attendance').set(headers(worker.token)).expect(403);
    const personal = await mine(office.token);
    expect(personal.recent.every((row: { userId: number }) => row.userId === office.id)).toBe(true);
    expect(personal.current).toMatchObject({ id: own.id, checkInLatitude: 0, checkInLongitude: 0 });
    const accounting = (await request(app.getHttpServer()).get('/api/attendance').set(headers(office.token)).expect(200)).body;
    expect(accounting.find((row: { userId: number }) => row.userId === worker.id)).toMatchObject({
      checkInLatitude: null, checkInLongitude: null, checkInAccuracy: null, checkOutAccuracy: null,
    });
    const report = (await request(app.getHttpServer()).get('/api/attendance').set(headers(admin)).expect(200)).body;
    expect(report.filter((row: { userId: number }) => [worker.id, office.id].includes(row.userId))).toHaveLength(2);
    expect(report.find((row: { userId: number }) => row.userId === worker.id).checkInLatitude).toBe(point.latitude);
  });

  it('finishes overnight records with server time, preserves the first finish on retries, then allows the next date', async () => {
    const record = (await mine(worker.token)).current;
    const yesterday = businessDateString(new Date(Date.now() - 86_400_000));
    const started = new Date(Date.now() - 7_200_000);
    // A historical fixture, never a client-supplied timestamp.
    await db.query('UPDATE attendance_records SET work_date = $1, check_in_time = $2 WHERE id = $3', [yesterday, started, record.id]);
    expect((await mine(worker.token)).current).toMatchObject({ id: record.id, workDate: yesterday });
    expect((await start(worker.token).expect(201)).body.id).toBe(record.id);
    await finish(worker.token, record.id, { ...point, accuracy: null }).expect(400);
    const closed = (await finish(worker.token, record.id, { ...point, longitude: 52 }).expect(201)).body;
    expect(closed).toMatchObject({ status: 'COMPLETED', checkOutLongitude: 52, checkOutAccuracy: 5 });
    expect(closed.workedHours).toBeCloseTo(2, 1);
    const repeated = (await finish(worker.token, record.id, { ...point, longitude: 53 }).expect(201)).body;
    expect(repeated).toMatchObject({ checkOutTime: closed.checkOutTime, workedHours: closed.workedHours, checkOutLongitude: 52 });
    const next = (await start(worker.token).expect(201)).body;
    expect(next.id).not.toBe(record.id);
    expect(next.workDate).toBe(businessDateString());
    await finish(worker.token, next.id).expect(201);
    const repeatedStart = (await start(worker.token).expect(201)).body;
    expect(repeatedStart).toMatchObject({ id: next.id, status: 'COMPLETED' });
    expect((await mine(worker.token)).recent).toHaveLength(2);
  });
});
