import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

describe('Public section form without exposing authenticated work data', () => {
  let app: INestApplication, token: string, section: any, object: any, original: any;
  const auth = () => ({ Authorization: `Bearer ${token}`, 'X-Forwarded-For': '10.71.0.1' });
  const settingsUrl = '/api/form-settings?form=field_day_form';
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.DB_MIGRATE = 'true';
    process.env.JWT_SECRET ||= 'public-section-only-test-secret-32-characters';
    process.env.ADMIN_USERNAME ||= 'e2e-admin'; process.env.ADMIN_PASSWORD ||= 'e2e-admin-password';
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    token = (await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For', '10.71.0.1')
      .send({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }).expect(201)).body.accessToken;
    original = (await request(app.getHttpServer()).get(settingsUrl).set(auth()).expect(200)).body;
    object = (await request(app.getHttpServer()).post('/api/objects').set(auth()).send({ name: `Public form ${crypto.randomUUID()}` }).expect(201)).body;
    section = (await request(app.getHttpServer()).post('/api/sections').set(auth()).send({ objectId: object.id, name: 'Участок открытой формы', latitude: 51.23, longitude: 51.37, radiusMeters: 150, customText: 'Private section notes' }).expect(201)).body;
  });
  afterAll(async () => {
    try { if (original) await request(app.getHttpServer()).put(settingsUrl).set(auth()).send(original).expect(200); }
    finally { if (app) await app.close(); }
  });

  it('opens only an allowlisted form by code and legacy id, without a token or caching', async () => {
    for (const path of [`/api/qr/form/${section.code}`, `/api/qr/form-by-id/${section.id}`]) {
      const response = await request(app.getHttpServer()).get(path).expect(200).expect('Cache-Control', 'no-store');
      expect(Object.keys(response.body).sort()).toEqual(['formSettings', 'section']);
      expect(response.body.section).toEqual({ code: section.code, name: section.name, objectName: object.name });
      expect(Object.keys(response.body.formSettings).sort()).toEqual(['fields', 'formDescription', 'formHints', 'formSubmitText', 'formSuccessText', 'formTitle']);
      expect(JSON.stringify(response.body)).not.toContain('Private section notes');
      expect(response.body.formSettings.fields.every((field: any) => field.visible)).toBe(true);
    }
  });

  it('persists hidden system/custom fields and omits their labels from the public form', async () => {
    const fields = original.fields.map((field: any) => field.id === 'description' ? { ...field, label: 'Hidden description', visible: false, required: true } : field);
    fields.push({ id: 'hiddenTest', label: 'Hidden private field', type: 'text', visible: false, required: true, order: 90 });
    const saved = (await request(app.getHttpServer()).put(settingsUrl).set(auth()).send({ ...original, fields }).expect(200)).body;
    const read = (await request(app.getHttpServer()).get(settingsUrl).set(auth()).expect(200)).body;
    expect(read).toEqual(saved);
    for (const id of ['description', 'hiddenTest']) expect(read.fields.find((field: any) => field.id === id)).toMatchObject({ visible: false, required: false });
    const form = (await request(app.getHttpServer()).get(`/api/qr/form/${section.code}`).expect(200)).body;
    expect(form.formSettings.fields.some((field: any) => ['description', 'hiddenTest'].includes(field.id))).toBe(false);
    expect(JSON.stringify(form)).not.toContain('Hidden');
    await request(app.getHttpServer()).put(settingsUrl).set(auth()).send(original).expect(200);
  });

  it('does not authorize staff data, evidence, settings or work mutations for QR visitors', async () => {
    for (const path of ['/api/users', '/api/sections', `/api/sections/${section.id}`, `/api/field/scan/${section.code}`, '/api/field/work-days', '/api/field/executions/review-queue', settingsUrl]) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
    for (const path of ['/api/field/work-days/start', '/api/field/work-days/close', '/api/uploads/photos']) {
      await request(app.getHttpServer()).post(path).send({}).expect(401);
    }
    // The legacy anonymous report writer no longer exists at all.
    await request(app.getHttpServer()).post('/api/work-logs').send({}).expect(404);
    await request(app.getHttpServer()).put(settingsUrl).send(original).expect(401);
    await request(app.getHttpServer()).get(`/api/qr/${section.code}`).expect(200).expect('Content-Type', /image\/png/);
  });

  it('refuses unknown, archived sections and sections of archived objects without redirecting', async () => {
    await request(app.getHttpServer()).get('/api/qr/form/unknown-section-test').expect(404);
    await request(app.getHttpServer()).get('/api/qr/form-by-id/not-a-number').expect(400);
    await request(app.getHttpServer()).patch(`/api/sections/${section.id}`).set(auth()).send({ isActive: false }).expect(200);
    await request(app.getHttpServer()).get(`/api/qr/form/${section.code}`).expect(404);
    await request(app.getHttpServer()).get(`/api/qr/form-by-id/${section.id}`).expect(404);
    await request(app.getHttpServer()).patch(`/api/sections/${section.id}`).set(auth()).send({ isActive: true }).expect(200);
    await request(app.getHttpServer()).patch(`/api/objects/${object.id}`).set(auth()).send({ isActive: false }).expect(200);
    await request(app.getHttpServer()).get(`/api/qr/form/${section.code}`).expect(404);
    await request(app.getHttpServer()).get(`/api/qr/form-by-id/${section.id}`).expect(404);
  });
});
