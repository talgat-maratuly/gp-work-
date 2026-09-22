import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../src/entities/user.entity';

describe('Password recovery (real API/database)', () => {
  let app: INestApplication, db: DataSource, jwt: JwtService;
  let admin: string, adminId: number, director: string;
  let sequence = 0;
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const originalPassword = 'recovery-original-test-password';
  const ip = () => ({ 'X-Forwarded-For': `10.67.${Math.floor(++sequence / 250)}.${sequence % 250 + 1}` });
  const headers = (token: string) => ({ ...ip(), Authorization: `Bearer ${token}` });
  const login = (username: string, password: string) => request(app.getHttpServer())
    .post('/api/auth/login').set(ip()).send({ username, password });
  const reset = (id: number, token = admin) => request(app.getHttpServer()).post(`/api/users/${id}/password-reset`).set(headers(token));
  const me = (token: string) => request(app.getHttpServer()).get('/api/auth/me').set(headers(token));
  const change = (token: string, data: object) => request(app.getHttpServer()).patch('/api/auth/password').set(headers(token)).send(data);
  const create = async (role = 'WORKER', isActive = true) => (await request(app.getHttpServer()).post('/api/users')
    .set(headers(admin)).send({ fullName: 'Recovery test', username: `recovery-${suffix}-${++sequence}`, role, isActive, password: originalPassword }).expect(201)).body;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_MIGRATE = 'true';
    process.env.JWT_SECRET ||= 'recovery-test-only-secret-at-least-32-characters';
    process.env.ADMIN_USERNAME ||= 'e2e-admin';
    process.env.ADMIN_PASSWORD ||= 'e2e-admin-password';
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.setGlobalPrefix('api', { exclude: [{ path: 'uploads/photos/:filename', method: RequestMethod.GET }] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init(); db = app.get(DataSource); jwt = app.get(JwtService);
    const auth = (await login(process.env.ADMIN_USERNAME!, process.env.ADMIN_PASSWORD!).expect(201)).body;
    admin = auth.accessToken; adminId = auth.user.id;
    const user = await create('DIRECTOR');
    director = (await login(user.username, originalPassword).expect(201)).body.accessToken;
  });
  afterAll(async () => { if (app) await app.close(); });

  it('only admin/director can reset active accounts; own resets and profile password assignment are rejected', async () => {
    const target = await create();
    await request(app.getHttpServer()).post(`/api/users/${target.id}/password-reset`).expect(401);
    for (const role of ['ACCOUNTANT', 'BRIGADIER', 'AGRONOMIST', 'WORKER', 'WATER_CARRIER', 'AKIMAT', 'ANTICOR']) {
      const user = await create(role);
      const token = (await login(user.username, originalPassword).expect(201)).body.accessToken;
      await reset(target.id, token).expect(403);
      await request(app.getHttpServer()).patch(`/api/users/${target.id}/password`).set(headers(token)).send({ password: 'new-password' }).expect(403);
    }
    await reset(adminId).expect(400);
    await reset((await create('WORKER', false)).id).expect(400);
    await reset(2147483647).expect(404);
    await request(app.getHttpServer()).patch(`/api/users/${target.id}`).set(headers(admin)).send({ password: 'bypass-password' }).expect(400);
    await request(app.getHttpServer()).patch(`/api/users/${target.id}`).set(headers(admin)).send({ mustChangePassword: false, authVersion: 0 }).expect(400);
    await reset(target.id, director).expect(201);
  });

  it('revokes old passwords, bearer tokens and media cookies, and stores only a hash plus reset metadata', async () => {
    const user = await create();
    const old = await login(user.username, originalPassword).expect(201);
    const cookie = String(old.headers['set-cookie'][0]).split(';')[0];
    const legacy = jwt.sign({ sub: user.id, role: 'WORKER' });
    await me(legacy).expect(200);
    const response = await reset(user.id).expect(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.temporaryPassword).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{16}$/);
    expect(Date.parse(response.body.expiresAt) - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
    await login(user.username, originalPassword).expect(401);
    await me(old.body.accessToken).expect(401); await me(legacy).expect(401);
    await request(app.getHttpServer()).get('/uploads/photos/recovery-no-photo.jpg').set('Cookie', cookie).expect(401);
    const [stored] = await db.query('SELECT * FROM users WHERE id=$1', [user.id]);
    expect(await bcrypt.compare(response.body.temporaryPassword, stored.password_hash)).toBe(true);
    expect(stored).toMatchObject({ auth_version: 1, must_change_password: true, password_reset_by_id: adminId });
    expect(JSON.stringify(stored)).not.toContain(response.body.temporaryPassword);
    const rows = await request(app.getHttpServer()).get('/api/users').set(headers(admin)).expect(200);
    expect(rows.body.find((row: { id: number }) => row.id === user.id)).toMatchObject({ mustChangePassword: true });
    for (const name of ['passwordHash', 'password_hash', 'authVersion', 'temporaryPassword', 'passwordResetById']) expect(JSON.stringify(rows.body)).not.toContain(name);
  });

  it('temporary sessions can only inspect their identity, change password or logout, including privileged accounts', async () => {
    for (const role of ['WORKER', 'DIRECTOR']) {
      const user = await create(role);
      const recovery = (await reset(user.id).expect(201)).body;
      const limited = await login(user.username, recovery.temporaryPassword).expect(201);
      const token = limited.body.accessToken;
      expect(limited.body.user.mustChangePassword).toBe(true);
      const payload = jwt.decode(token);
      expect(payload.exp - payload.iat).toBe(15 * 60);
      await me(token).expect(200);
      await request(app.getHttpServer()).get('/api/sections').set(headers(token)).expect(403);
      await request(app.getHttpServer()).get('/api/users').set(headers(token)).expect(403);
      await request(app.getHttpServer()).get('/uploads/photos/recovery-no-photo.jpg').set('Cookie', String(limited.headers['set-cookie'][0]).split(';')[0]).expect(403);
      await request(app.getHttpServer()).post('/api/auth/logout').set(headers(token)).expect(201);
      await change(token, { newPassword: recovery.temporaryPassword }).expect(400);
      for (const newPassword of ['short', ' '.repeat(8), 'я'.repeat(37), null]) await change(token, { newPassword }).expect(400);
      await request(app.getHttpServer()).patch(`/api/users/${user.id}`).set(headers(admin)).send({ fullName: 'Updated during reset' }).expect(200);
      expect((await me(token).expect(200)).body.mustChangePassword).toBe(true);
      const changed = await change(token, { newPassword: 'new-personal-test-password' }).expect(200);
      expect(String(changed.headers['set-cookie'][0])).toContain('gp_work_media=;');
      await me(token).expect(401);
      await login(user.username, recovery.temporaryPassword).expect(401);
      const fresh = (await login(user.username, 'new-personal-test-password').expect(201)).body;
      expect(fresh.user.mustChangePassword).toBe(false);
      await me(fresh.accessToken).expect(200);
      if (role === 'DIRECTOR') await request(app.getHttpServer()).get('/api/users').set(headers(fresh.accessToken)).expect(200);
    }
  });

  it('ordinary password change requires the current password and preserves exact whitespace', async () => {
    const user = await create();
    const token = (await login(user.username, originalPassword).expect(201)).body.accessToken;
    await change(token, { newPassword: 'replacement-password' }).expect(400);
    await change(token, { currentPassword: 'incorrect', newPassword: 'replacement-password' }).expect(400);
    await change(token, { currentPassword: null, newPassword: 'replacement-password' }).expect(400);
    const next = '  personal password with spaces  ';
    await change(token, { currentPassword: originalPassword, newPassword: next }).expect(200);
    await me(token).expect(401); await login(user.username, originalPassword).expect(401);
    await login(user.username, next.trim()).expect(401);
    expect((await login(user.username, next).expect(201)).body.user.mustChangePassword).toBe(false);
  });

  it('expired temporary passwords and sessions stop working, then an explicit new reset restores recovery', async () => {
    const user = await create();
    const first = (await reset(user.id).expect(201)).body;
    const token = (await login(user.username, first.temporaryPassword).expect(201)).body.accessToken;
    await db.query("UPDATE users SET password_reset_expires_at = NOW() - INTERVAL '1 minute' WHERE id=$1", [user.id]);
    const expired = await login(user.username, first.temporaryPassword).expect(401);
    expect(expired.body.message).toContain('истёк');
    await me(token).expect(401); await change(token, { newPassword: 'replacement-password' }).expect(401);
    const second = (await reset(user.id).expect(201)).body;
    expect(second.temporaryPassword).not.toBe(first.temporaryPassword);
    await login(user.username, first.temporaryPassword).expect(401);
    await login(user.username, second.temporaryPassword).expect(201);
  });

  it('concurrent resets serialize and stale profile saves cannot clear credential state', async () => {
    const user = await create();
    const repo = db.getRepository(User);
    const stale = (await repo.findOneBy({ id: user.id }))!;
    const responses = await Promise.all([reset(user.id), reset(user.id, director)]);
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    const [stored] = await db.query('SELECT auth_version, password_hash FROM users WHERE id=$1', [user.id]);
    expect(stored.auth_version).toBe(2);
    const matches = await Promise.all(responses.map(response => bcrypt.compare(response.body.temporaryPassword, stored.password_hash)));
    expect(matches.filter(Boolean)).toHaveLength(1);
    stale.fullName = 'Save an old profile after both resets';
    await repo.save(stale);
    const [current] = await db.query('SELECT auth_version, must_change_password FROM users WHERE id=$1', [user.id]);
    expect(current).toMatchObject({ auth_version: 2, must_change_password: true });
  });

  it('legacy manual reset also revokes sessions and forces a new password; invalid bytes are rejected', async () => {
    const user = await create();
    const token = (await login(user.username, originalPassword).expect(201)).body.accessToken;
    await request(app.getHttpServer()).patch(`/api/users/${user.id}/password`).set(headers(admin)).send({ password: 'я'.repeat(37) }).expect(400);
    await request(app.getHttpServer()).patch(`/api/users/${user.id}/password`).set(headers(admin)).send({ password: 'manual-reset-password' }).expect(200);
    await me(token).expect(401);
    expect((await login(user.username, 'manual-reset-password').expect(201)).body.user.mustChangePassword).toBe(true);
  });

  it('operator admin recovery revokes existing credentials and is disabled again afterwards', async () => {
    const user = await create('ADMIN');
    const token = (await login(user.username, originalPassword).expect(201)).body.accessToken;
    const names = ['ENABLE_ADMIN_RESET', 'ADMIN_RESET_TOKEN', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'] as const;
    const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
    try {
      Object.assign(process.env, { ENABLE_ADMIN_RESET: 'true', ADMIN_RESET_TOKEN: 'test-only-reset-token', ADMIN_USERNAME: user.username, ADMIN_PASSWORD: 'operator-new-test-password' });
      await request(app.getHttpServer()).post('/api/auth/reset-admin').set(ip()).set('x-admin-reset-token', 'wrong').expect(403);
      await request(app.getHttpServer()).post('/api/auth/reset-admin').set(ip()).set('x-admin-reset-token', 'test-only-reset-token').expect(201);
      await me(token).expect(401);
      expect((await login(user.username, 'operator-new-test-password').expect(201)).body.user.mustChangePassword).toBe(false);
    } finally {
      for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
    }
    await request(app.getHttpServer()).post('/api/auth/reset-admin').set(ip()).expect(404);
  });
});
