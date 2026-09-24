import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { BrigadeMember } from '../src/entities/brigade-member.entity';

describe('User role and brigade assignment remain consistent', () => {
  let app: INestApplication, token: string;
  const suffix = crypto.randomUUID().slice(0, 8);
  const password = 'membership-test-password';
  const auth = () => ({ Authorization: `Bearer ${token}`, 'X-Forwarded-For': '10.72.0.1' });
  const user = (role = 'BRIGADIER', brigadeId?: number | null) => ({
    role, brigadeId, fullName: `Бригадир ${suffix}`, username: `member-${crypto.randomUUID()}`, password,
  });
  const postUser = (data: object) => request(app.getHttpServer()).post('/api/users').set(auth()).send(data);
  const patchUser = (id: number, data: object) => request(app.getHttpServer()).patch(`/api/users/${id}`).set(auth()).send(data);
  const getBrigade = async (id: number) => (await request(app.getHttpServer()).get(`/api/brigades/${id}`).set(auth()).expect(200)).body;
  const newBrigade = async (extra = {}) => (await request(app.getHttpServer()).post('/api/brigades').set(auth())
    .send({ name: `ИТР ${suffix}`, ...extra }).expect(201)).body;
  const membershipIds = async (userId: number) => (await app.get(DataSource).getRepository(BrigadeMember)
    .findBy({ userId })).map(row => row.brigadeId);

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.DB_MIGRATE = 'true';
    process.env.JWT_SECRET ||= 'membership-only-test-secret-32-characters';
    process.env.ADMIN_USERNAME ||= 'e2e-admin'; process.env.ADMIN_PASSWORD ||= 'e2e-admin-password';
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    token = (await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For', '10.72.0.1')
      .send({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }).expect(201)).body.accessToken;
  });
  afterAll(async () => { if (app) await app.close(); });

  it('creates BRIGADIER + ИТР, persists all three links and leaves access privileges unchanged', async () => {
    const b = await newBrigade(), payload = user('BRIGADIER', b.id);
    const u = (await postUser(payload).expect(201)).body;
    expect(u).toMatchObject({ role: 'BRIGADIER', brigadeId: b.id });
    expect(await getBrigade(b.id)).toMatchObject({ brigadierId: u.id, workerIds: [u.id] });
    expect(await membershipIds(u.id)).toEqual([b.id]);
    const list = (await request(app.getHttpServer()).get('/api/users').set(auth()).expect(200)).body;
    expect(list.find((row: any) => row.id === u.id)).toMatchObject({ role: 'BRIGADIER', brigadeId: b.id });
    const login = (await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For', '10.72.0.2')
      .send({ username: payload.username, password }).expect(201)).body;
    expect(login.user).toMatchObject({ role: 'BRIGADIER', brigadeId: b.id });
    await request(app.getHttpServer()).post('/api/users').set('Authorization', `Bearer ${login.accessToken}`).send(user()).expect(403);
    await request(app.getHttpServer()).post('/api/users').send(user()).expect(401);
  });

  it('moves, demotes and unassigns a brigadier without stale leadership or duplicate memberships', async () => {
    const a = await newBrigade(), b = await newBrigade();
    const u = (await postUser(user('BRIGADIER', a.id)).expect(201)).body;
    await patchUser(u.id, { brigadeId: b.id }).expect(200);
    expect(await getBrigade(a.id)).toMatchObject({ brigadierId: null, workerIds: [] });
    expect(await getBrigade(b.id)).toMatchObject({ brigadierId: u.id, workerIds: [u.id] });
    expect(await membershipIds(u.id)).toEqual([b.id]);
    await patchUser(u.id, { role: 'WORKER' }).expect(200);
    expect(await getBrigade(b.id)).toMatchObject({ brigadierId: null, workerIds: [u.id] });
    await patchUser(u.id, { role: 'BRIGADIER' }).expect(200);
    expect((await getBrigade(b.id)).brigadierId).toBe(u.id);
    await patchUser(u.id, { role: 'ACCOUNTANT', brigadeId: null }).expect(200);
    expect(await getBrigade(b.id)).toMatchObject({ brigadierId: null, workerIds: [] });
    expect(await membershipIds(u.id)).toEqual([]);
  });

  it('rejects occupied brigades without replacing leaders or partially creating/moving users', async () => {
    const a = await newBrigade(), b = await newBrigade();
    const first = (await postUser(user('BRIGADIER', a.id)).expect(201)).body;
    const second = (await postUser(user('BRIGADIER', b.id)).expect(201)).body;
    const draft = user('BRIGADIER', a.id);
    await postUser(draft).expect(409);
    await patchUser(second.id, { brigadeId: a.id }).expect(409);
    expect((await getBrigade(a.id)).brigadierId).toBe(first.id);
    expect((await getBrigade(b.id)).brigadierId).toBe(second.id);
    expect(await membershipIds(second.id)).toEqual([b.id]);
    const rows = (await request(app.getHttpServer()).get('/api/users').set(auth()).expect(200)).body;
    expect(rows.some((row: any) => row.username === draft.username)).toBe(false);
    const worker = (await postUser(user('WORKER', a.id)).expect(201)).body;
    expect(await membershipIds(worker.id)).toEqual([a.id]);
  });

  it('validates roles and inactive brigades; preserves an existing inactive assignment on ordinary edits', async () => {
    const b = await newBrigade();
    for (const role of ['DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'AKIMAT', 'ANTICOR']) await postUser(user(role, b.id)).expect(400);
    for (const role of ['WORKER', 'WATER_CARRIER', 'AGRONOMIST']) await postUser(user(role, b.id)).expect(201);
    const u = (await postUser(user('BRIGADIER', b.id)).expect(201)).body;
    await request(app.getHttpServer()).patch(`/api/brigades/${b.id}`).set(auth()).send({ isActive: false }).expect(200);
    await patchUser(u.id, { fullName: 'Обновлённое имя', brigadeId: b.id }).expect(200);
    expect((await getBrigade(b.id)).brigadierId).toBe(u.id);
    await postUser(user('WORKER', b.id)).expect(400);
    for (const brigadeId of [0, -1, 1.5, 2147483647]) await postUser(user('BRIGADIER', brigadeId)).expect(400);
    await patchUser(u.id, { brigadeId: null }).expect(200);
    expect((await getBrigade(b.id)).brigadierId).toBeNull();
  });

  it('keeps assignments consistent when using the brigade editor and then the user editor', async () => {
    const first = (await postUser(user()).expect(201)).body, second = (await postUser(user()).expect(201)).body;
    const b = await newBrigade({ brigadierId: first.id });
    expect(await membershipIds(first.id)).toEqual([b.id]);
    await request(app.getHttpServer()).patch(`/api/brigades/${b.id}`).set(auth()).send({ brigadierId: second.id }).expect(200);
    // Former leader remains an ordinary member unless explicitly removed.
    await patchUser(first.id, { fullName: 'Бывший руководитель' }).expect(200);
    expect((await getBrigade(b.id)).brigadierId).toBe(second.id);
    expect(await membershipIds(first.id)).toEqual([b.id]);
    await patchUser(second.id, { brigadeId: null }).expect(200);
    expect((await getBrigade(b.id)).brigadierId).toBeNull();
    expect(await membershipIds(second.id)).toEqual([]);
  });

  it('serializes competing leader assignments through users and brigades APIs', async () => {
    const b = await newBrigade();
    const candidates = [user('BRIGADIER', b.id), user('BRIGADIER', b.id)];
    const responses = await Promise.all(candidates.map(payload => postUser(payload)));
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    const winner = responses.find(r => r.status === 201)!.body;
    expect(await getBrigade(b.id)).toMatchObject({ brigadierId: winner.id, workerIds: [winner.id] });
    const a = await newBrigade(), c = await newBrigade();
    await patchUser(winner.id, { brigadeId: null }).expect(200);
    const race = await Promise.all([
      patchUser(winner.id, { brigadeId: a.id }),
      request(app.getHttpServer()).patch(`/api/brigades/${c.id}`).set(auth()).send({ brigadierId: winner.id }),
    ]);
    expect([200, 400]).toContain(race[1].status); expect(race[0].status).toBe(200);
    const current = (await request(app.getHttpServer()).get(`/api/users/${winner.id}`).set(auth()).expect(200)).body;
    expect(await membershipIds(winner.id)).toEqual([current.brigadeId]);
    const leaders = [await getBrigade(a.id), await getBrigade(c.id)].filter(row => row.brigadierId === winner.id);
    expect(leaders.map(row => row.id)).toEqual([current.brigadeId]);
  });
});
