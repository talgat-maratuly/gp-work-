import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

describe('Custom job positions (real API/database)', () => {
  let app: INestApplication;
  let admin: string, director: string, worker: string;
  let employeeId: number, positionId: number;
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const password = 'positions-test-password';
  const username = `positions-worker-${suffix}`;
  const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (name: string, pass: string) =>
    (await request(app.getHttpServer()).post('/api/auth/login').send({ username: name, password: pass }).expect(201)).body;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_MIGRATE = 'true';
    process.env.JWT_SECRET ||= 'positions-only-test-secret-at-least-32-characters';
    process.env.ADMIN_USERNAME ||= 'e2e-admin';
    process.env.ADMIN_PASSWORD ||= 'e2e-admin-password';
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    admin = (await login(process.env.ADMIN_USERNAME!, process.env.ADMIN_PASSWORD!)).accessToken;
    for (const [name, role] of [[username, 'WORKER'], [`positions-director-${suffix}`, 'DIRECTOR']]) {
      const created = await request(app.getHttpServer()).post('/api/users').set(headers(admin))
        .send({ fullName: name, username: name, password, role }).expect(201);
      expect(created.body.positionId).toBeNull();
      expect(created.body.positionName).toBeNull();
      if (role === 'WORKER') employeeId = created.body.id;
      const token = (await login(name, password)).accessToken;
      if (role === 'WORKER') worker = token; else director = token;
    }
  });
  afterAll(async () => { if (app) await app.close(); });

  it('allows directors to manage positions and denies anonymous and field accounts', async () => {
    await request(app.getHttpServer()).get('/api/job-positions').expect(401);
    await request(app.getHttpServer()).post('/api/job-positions').send({ name: 'Forged' }).expect(401);
    await request(app.getHttpServer()).get('/api/job-positions').set(headers(worker)).expect(403);
    await request(app.getHttpServer()).post('/api/job-positions').set(headers(worker)).send({ name: 'Forged' }).expect(403);
    const created = await request(app.getHttpServer()).post('/api/job-positions').set(headers(director))
      .send({ name: `  Снабженец   ${suffix}  ` }).expect(201);
    positionId = created.body.id;
    expect(created.body).toMatchObject({ name: `Снабженец ${suffix}`, isActive: true });
    await request(app.getHttpServer()).patch(`/api/job-positions/${positionId}`).set(headers(worker)).send({ isActive: false }).expect(403);
  });

  it('validates names and prevents case/whitespace duplicates including concurrent creates', async () => {
    for (const name of ['', '  ', null, 42, 'x'.repeat(121)]) {
      await request(app.getHttpServer()).post('/api/job-positions').set(headers(admin)).send({ name }).expect(400);
    }
    await request(app.getHttpServer()).post('/api/job-positions').set(headers(admin))
      .send({ name: ` снабженец  ${suffix} ` }).expect(409);
    await request(app.getHttpServer()).patch(`/api/job-positions/${positionId}`).set(headers(admin)).send({ name: null }).expect(400);
    await request(app.getHttpServer()).patch(`/api/job-positions/${positionId}`).set(headers(admin)).send({ isActive: null }).expect(400);
    await request(app.getHttpServer()).patch(`/api/job-positions/${positionId}`).set(headers(admin)).send({}).expect(400);
    const results = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post('/api/job-positions')
      .set(headers(admin)).send({ name: `Механик ${suffix}` })));
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
  });

  it('assigns positions on create/update and persists them in the list, login and profile', async () => {
    const assigned = await request(app.getHttpServer()).patch(`/api/users/${employeeId}`).set(headers(director))
      .send({ positionId }).expect(200);
    expect(assigned.body).toMatchObject({ positionId, positionName: `Снабженец ${suffix}`, role: 'WORKER' });
    const created = await request(app.getHttpServer()).post('/api/users').set(headers(admin))
      .send({ fullName: 'Position create', username: `positions-created-${suffix}`, password, role: 'WORKER', positionId }).expect(201);
    expect(created.body).toMatchObject({ positionId, positionName: `Снабженец ${suffix}` });
    const users = await request(app.getHttpServer()).get('/api/users').set(headers(director)).expect(200);
    expect(users.body.find((u: { id: number }) => u.id === employeeId)).toMatchObject({ positionId, positionName: `Снабженец ${suffix}` });
    expect(JSON.stringify(users.body)).not.toContain('passwordHash');
    expect((await login(username, password)).user).toMatchObject({ positionId, positionName: `Снабженец ${suffix}` });
    const me = await request(app.getHttpServer()).get('/api/auth/me').set(headers(worker)).expect(200);
    expect(me.body).toMatchObject({ positionId, positionName: `Снабженец ${suffix}`, role: 'WORKER' });
    for (const invalid of [0, -1, 1.5, '1', 2147483647]) {
      await request(app.getHttpServer()).patch(`/api/users/${employeeId}`).set(headers(admin)).send({ positionId: invalid }).expect(400);
    }
  });

  it('renaming a job to Director never grants the employee privileged access', async () => {
    const name = `Директор ${suffix}`;
    await request(app.getHttpServer()).patch(`/api/job-positions/${positionId}`).set(headers(director)).send({ name }).expect(200);
    expect((await login(username, password)).user).toMatchObject({ role: 'WORKER', positionName: name });
    await request(app.getHttpServer()).get('/api/users').set(headers(worker)).expect(403);
    await request(app.getHttpServer()).patch(`/api/users/${employeeId}`).set(headers(worker)).send({ role: 'ADMIN', positionId }).expect(403);
    await request(app.getHttpServer()).post('/api/job-positions').set(headers(director)).send({ name: 'Forged', role: 'ADMIN' }).expect(400);
  });

  it('archives without losing assignments, allows existing employee edits, rejects new assignments, and restores', async () => {
    await request(app.getHttpServer()).patch(`/api/job-positions/${positionId}`).set(headers(admin)).send({ isActive: false }).expect(200);
    const edited = await request(app.getHttpServer()).patch(`/api/users/${employeeId}`).set(headers(admin))
      .send({ fullName: 'Updated worker', positionId }).expect(200);
    expect(edited.body).toMatchObject({ positionId, positionName: `Директор ${suffix}`, role: 'WORKER' });
    await request(app.getHttpServer()).post('/api/users').set(headers(admin))
      .send({ fullName: 'Invalid assignment', username: `invalid-${suffix}`, password, role: 'WORKER', positionId }).expect(400);
    await request(app.getHttpServer()).post('/api/job-positions').set(headers(admin)).send({ name: `Директор ${suffix}` }).expect(409);
    await request(app.getHttpServer()).patch(`/api/users/${employeeId}`).set(headers(admin)).send({ positionId: null }).expect(200);
    await request(app.getHttpServer()).patch(`/api/users/${employeeId}`).set(headers(admin)).send({ positionId }).expect(400);
    await request(app.getHttpServer()).patch(`/api/job-positions/${positionId}`).set(headers(director)).send({ isActive: true }).expect(200);
    await request(app.getHttpServer()).patch(`/api/users/${employeeId}`).set(headers(director)).send({ positionId }).expect(200);
    await request(app.getHttpServer()).patch(`/api/users/${employeeId}`).set(headers(director)).send({ positionId: null }).expect(200);
    const me = await request(app.getHttpServer()).get('/api/auth/me').set(headers(worker)).expect(200);
    expect(me.body).toMatchObject({ positionId: null, positionName: null, role: 'WORKER' });
  });
});
