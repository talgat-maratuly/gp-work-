import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'crypto';

// Real P-256 WebAuthn signatures + PostgreSQL; no mocked verifier.
describe('Director passkey authentication security', () => {
  let app: INestApplication, db: DataSource, admin: string, userId: number, token: string;
  let seq = 0;
  const origin = 'https://gp-work.gpartners.kz';
  const password = 'passkey-api-test-password';
  const username = `passkey-api-${randomUUID()}`;
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = pair.publicKey.export({ format: 'jwk' });
  const credentialId = randomBytes(32).toString('base64url');
  const keyId = randomUUID();
  const headers = (value: string) => ({ Authorization: `Bearer ${value}` });
  const post = (path: string) => request(app.getHttpServer()).post(`/api/auth/passkeys/${path}`)
    .set('X-Forwarded-For', `10.90.${Math.floor(++seq / 250)}.${seq % 250 + 1}`);
  async function options() {
    const r = await post('login/options').expect(201);
    return { ...r.body, cookie: r.headers['set-cookie'][0].split(';')[0] };
  }
  function assertion(challenge: string, changes: { origin?: string; rpID?: string; flags?: number; counter?: number; challenge?: string; corrupt?: boolean } = {}) {
    const client = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: changes.challenge ?? challenge, origin: changes.origin ?? origin }));
    const authenticator = Buffer.alloc(37);
    createHash('sha256').update(changes.rpID ?? 'gp-work.gpartners.kz').digest().copy(authenticator);
    authenticator[32] = changes.flags ?? 5;
    authenticator.writeUInt32BE(changes.counter ?? 2, 33);
    const signature = sign('sha256', Buffer.concat([authenticator, createHash('sha256').update(client).digest()]), pair.privateKey);
    if (changes.corrupt) signature[signature.length - 1] ^= 1;
    return { id: credentialId, rawId: credentialId, type: 'public-key', clientExtensionResults: {}, response: {
      clientDataJSON: client.toString('base64url'), authenticatorData: authenticator.toString('base64url'), signature: signature.toString('base64url'),
    } };
  }
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.DB_MIGRATE = 'true';
    process.env.PASSKEY_ORIGIN = origin;
    process.env.JWT_SECRET ||= 'passkey-test-only-secret-at-least-32-characters';
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init(); db = app.get(DataSource);
    const login = async (name: string, secret: string) => (await request(app.getHttpServer()).post('/api/auth/login')
      .set('X-Forwarded-For', `10.91.0.${++seq}`).send({ username: name, password: secret }).expect(201)).body.accessToken;
    admin = await login(process.env.ADMIN_USERNAME || 'e2e-admin', process.env.ADMIN_PASSWORD || 'e2e-admin-password');
    const created = await request(app.getHttpServer()).post('/api/users').set(headers(admin))
      .send({ username, password, fullName: 'Passkey API director', role: 'DIRECTOR' }).expect(201);
    userId = created.body.id; token = await login(username, password);
    // COSE EC2: kty=2, alg=-7, crv=1, x/y=32-byte coordinates.
    const publicKey = Buffer.concat([Buffer.from('a5010203262001215820', 'hex'), Buffer.from(jwk.x!, 'base64url'),
      Buffer.from('225820', 'hex'), Buffer.from(jwk.y!, 'base64url')]);
    await db.query(`INSERT INTO auth_passkeys(id,user_id,credential_id,public_key,counter,auth_version)
      SELECT $1,id,$2,$3,1,auth_version FROM users WHERE id=$4`, [keyId, credentialId, publicKey, userId]);
  });
  afterAll(async () => { if (app) await app.close(); });

  it('accepts a signed assertion once and preserves normal identity/role policy', async () => {
    const o = await options();
    const data = { challengeId: o.challengeId, response: assertion(o.options.challenge) };
    const r = await post('login/verify').set('Cookie', o.cookie).send(data).expect(201);
    expect(r.body.user).toMatchObject({ id: userId, role: 'DIRECTOR' });
    expect(r.body.user).not.toHaveProperty('passwordHash');
    await request(app.getHttpServer()).get('/api/auth/me').set(headers(r.body.accessToken)).expect(200);
    await post('login/verify').set('Cookie', o.cookie).send(data).expect(401);
  });
  it.each([
    ['foreign origin', { origin: 'https://phishing.invalid' }], ['foreign RP', { rpID: 'phishing.invalid' }],
    ['missing verification', { flags: 1 }], ['missing presence', { flags: 4 }],
    ['stale counter', { counter: 1 }], ['wrong challenge', { challenge: 'not-the-server-challenge' }],
    ['invalid signature', { corrupt: true }],
  ])('rejects %s', async (_label, change) => {
    const o = await options();
    await post('login/verify').set('Cookie', o.cookie).send({ challengeId: o.challengeId, response: assertion(o.options.challenge, { counter: 3, ...change as object }) }).expect(401);
  });
  it('rejects missing browser binding, expired challenges and malformed input', async () => {
    const o = await options();
    const body = { challengeId: o.challengeId, response: assertion(o.options.challenge, { counter: 3 }) };
    await post('login/verify').send(body).expect(401);
    await db.query("UPDATE auth_passkey_challenges SET expires_at=now()-interval '1 minute' WHERE id=$1", [o.challengeId]);
    await post('login/verify').set('Cookie', o.cookie).send(body).expect(401);
    await post('login/verify').send({ challengeId: 'not-uuid', response: {} }).expect(400);
    const n = await options();
    await post('login/verify').set('Cookie', n.cookie).send({ challengeId: n.challengeId, response: {} }).expect(401);
  });
  it('blocks disabled and changed-role accounts before issuing tokens', async () => {
    await db.query('UPDATE users SET is_active=false WHERE id=$1', [userId]);
    let o = await options();
    await post('login/verify').set('Cookie', o.cookie).send({ challengeId: o.challengeId, response: assertion(o.options.challenge, { counter: 3 }) }).expect(401);
    await db.query("UPDATE users SET is_active=true,role='WORKER' WHERE id=$1", [userId]);
    o = await options();
    await post('login/verify').set('Cookie', o.cookie).send({ challengeId: o.challengeId, response: assertion(o.options.challenge, { counter: 3 }) }).expect(403);
    await db.query("UPDATE users SET role='DIRECTOR' WHERE id=$1", [userId]);
  });
  it('password change invalidates existing keys and enrollment challenges', async () => {
    const enrollment = await post('register/options').set(headers(token)).send({ password }).expect(201);
    await request(app.getHttpServer()).patch('/api/auth/password').set(headers(token))
      .send({ currentPassword: password, newPassword: 'changed-passkey-api-password' }).expect(200);
    const o = await options();
    await post('login/verify').set('Cookie', o.cookie).send({ challengeId: o.challengeId, response: assertion(o.options.challenge, { counter: 3 }) }).expect(401);
    await post('register/verify').set(headers(token)).set('Cookie', enrollment.headers['set-cookie'][0].split(';')[0])
      .send({ challengeId: enrollment.body.challengeId, response: {} }).expect(401);
  });
});
