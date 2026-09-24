import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AccessRole } from '../src/entities/access-role.entity';
import { User } from '../src/entities/user.entity';

describe('Configurable access roles',()=>{
  let app:INestApplication, token:string;
  const password='access-role-test-password';
  const headers=()=>({Authorization:`Bearer ${token}`,'X-Forwarded-For':'10.75.0.1'});
  const role=(extra={})=>({name:`Инженер ${crypto.randomUUID()}`,baseRole:'ADMIN',permissions:['objects.findAll'],pages:['/admin/objects'],canJoinBrigade:true,isActive:true,...extra});
  const saveRole=async (data:object)=>(await request(app.getHttpServer()).post('/api/access-roles').set(headers()).send(data).expect(201)).body;
  const employee=async (r:any,extra={})=>{
    const dto={fullName:'Инженер',username:`role-${crypto.randomUUID()}`,password,role:r.baseRole,accessRoleId:r.id,...extra};
    const u=(await request(app.getHttpServer()).post('/api/users').set(headers()).send(dto).expect(201)).body;
    const login=(await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For','10.75.0.2').send({username:dto.username,password}).expect(201)).body;
    return {u,login,auth:{Authorization:`Bearer ${login.accessToken}`,'X-Forwarded-For':'10.75.0.3'}};
  };
  const update=(r:any,changes:object)=>request(app.getHttpServer()).put(`/api/access-roles/${r.id}`).set(headers()).send({name:r.name,baseRole:r.baseRole,permissions:r.permissions??[],pages:r.pages,canJoinBrigade:r.canJoinBrigade,isActive:r.isActive,revision:r.revision,...changes});
  beforeAll(async()=>{
    process.env.NODE_ENV='test';process.env.DB_MIGRATE='true';process.env.JWT_SECRET||='access-role-test-secret-32-characters';
    process.env.ADMIN_USERNAME||='e2e-admin';process.env.ADMIN_PASSWORD||='e2e-admin-password';
    const {AppModule}=await import('../src/app.module');
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy',true);app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();
    token=(await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For','10.75.0.1').send({username:process.env.ADMIN_USERNAME,password:process.env.ADMIN_PASSWORD}).expect(201)).body.accessToken;
  });
  afterAll(async()=>{if(app)await app.close()});

  it('preserves all nine system roles and excludes credential administration from delegable actions',async()=>{
    const rows=(await request(app.getHttpServer()).get('/api/access-roles').set(headers()).expect(200)).body;
    expect(rows.filter((r:any)=>r.systemKey)).toHaveLength(9);
    expect(rows.find((r:any)=>r.systemKey==='BRIGADIER')).toMatchObject({canJoinBrigade:true,permissions:null});
    const c=(await request(app.getHttpServer()).get('/api/access-roles/catalog').set(headers()).expect(200)).body;
    expect(c.operations.some((o:any)=>o.key==='objects.findAll')).toBe(true);
    expect(c.operations.some((o:any)=>['users.create','access-roles.create','seed.seed'].includes(o.key))).toBe(false);
    await request(app.getHttpServer()).get('/api/access-roles').expect(401);
  });
  it('enforces allowed and denied actions server-side, including custom ADMIN and roleless endpoints',async()=>{
    const r=await saveRole(role()),e=await employee(r);
    expect(e.login.user).toMatchObject({accessRoleId:r.id,roleName:r.name,pages:['/admin/objects']});
    await request(app.getHttpServer()).get('/api/objects').set(e.auth).expect(200);
    await request(app.getHttpServer()).post('/api/objects').set(e.auth).send({name:'Forbidden'}).expect(403);
    await request(app.getHttpServer()).get('/api/users').set(e.auth).expect(403);
    await request(app.getHttpServer()).post('/api/users').set(e.auth).send({}).expect(403);
    await request(app.getHttpServer()).get('/api/access-roles').set(e.auth).expect(403);
    await request(app.getHttpServer()).post('/api/uploads/photos').set(e.auth).expect(403);
    await request(app.getHttpServer()).get('/api/auth/me').set(e.auth).expect(200);
    await request(app.getHttpServer()).post('/api/auth/logout').set(e.auth).expect(201);
    await update(r,{permissions:['objects.findAll','objects.create']}).expect(200);
    await request(app.getHttpServer()).post('/api/objects').set(e.auth).send({name:`Разрешено ${r.id}`}).expect(201);
    await request(app.getHttpServer()).delete('/api/objects/1').set(e.auth).expect(403);
  });
  it('applies permission revocation to the existing token and detects stale editor saves',async()=>{
    const r=await saveRole(role()),e=await employee(r);
    const changed=(await update(r,{permissions:[],pages:[],name:r.name+' изменён'}).expect(200)).body;
    await request(app.getHttpServer()).get('/api/objects').set(e.auth).expect(403);
    const me=(await request(app.getHttpServer()).get('/api/auth/me').set(e.auth).expect(200)).body;
    expect(me).toMatchObject({roleName:changed.name,permissions:[],pages:[]});
    await update(r,{canJoinBrigade:false}).expect(409);
    await update(changed,{isActive:false}).expect(409);
    // Removing/replacing a policy never grants the unrestricted underlying role.
    await app.get(DataSource).getRepository(AccessRole).update(r.id,{isActive:false});
    await request(app.getHttpServer()).get('/api/auth/me').set(e.auth).expect(401);
  });
  it('validates names, capability keys, template ceilings, identifiers and archived assignments',async()=>{
    const r=await saveRole(role());
    for(const payload of [role({name:'  '}),role({permissions:['users.create']}),role({permissions:['objects.create'],baseRole:'WORKER'}),role({pages:['/admin/users']}),role({baseRole:'WORKER',pages:['/admin/objects']})]) {
      await request(app.getHttpServer()).post('/api/access-roles').set(headers()).send(payload).expect(400);
    }
    await request(app.getHttpServer()).post('/api/access-roles').set(headers()).send(role({name:r.name.toUpperCase()})).expect(409);
    await update(r,{baseRole:'DIRECTOR'}).expect(400);
    const archived=await saveRole(role({isActive:false}));
    for(const accessRoleId of [0,-1,2147483647,archived.id])await request(app.getHttpServer()).post('/api/users').set(headers()).send({fullName:'Test',username:`invalid-${crypto.randomUUID()}`,password,role:'ADMIN',accessRoleId}).expect(400);
  });
  it('allows independent brigade membership and prevents disabling assigned policies',async()=>{
    const r=await saveRole(role({baseRole:'ACCOUNTANT',pages:[],permissions:[]}));
    const b=(await request(app.getHttpServer()).post('/api/brigades').set(headers()).send({name:'ИТР роли'}).expect(201)).body;
    const e=await employee(r,{brigadeId:b.id});expect(e.u.brigadeId).toBe(b.id);
    await update(r,{canJoinBrigade:false}).expect(409);
    await request(app.getHttpServer()).patch(`/api/brigades/${b.id}`).set(headers()).send({workerIds:[e.u.id]}).expect(200);
    await request(app.getHttpServer()).patch(`/api/users/${e.u.id}`).set(headers()).send({brigadeId:null}).expect(200);
    const disabled=(await update(r,{canJoinBrigade:false}).expect(200)).body;
    await request(app.getHttpServer()).patch(`/api/users/${e.u.id}`).set(headers()).send({brigadeId:b.id}).expect(400);
    await request(app.getHttpServer()).patch(`/api/brigades/${b.id}`).set(headers()).send({workerIds:[e.u.id]}).expect(400);
    expect(disabled.canJoinBrigade).toBe(false);
  });
  it('persists custom brigadier leadership, rejects mismatched roles and protects self-assignment',async()=>{
    const r=await saveRole(role({baseRole:'BRIGADIER',pages:[],permissions:[]}));
    const b=(await request(app.getHttpServer()).post('/api/brigades').set(headers()).send({name:'ИТР руководитель'}).expect(201)).body;
    const e=await employee(r,{brigadeId:b.id});
    expect((await request(app.getHttpServer()).get(`/api/brigades/${b.id}`).set(headers()).expect(200)).body).toMatchObject({brigadierId:e.u.id,workerIds:[e.u.id]});
    expect((await request(app.getHttpServer()).get(`/api/users/${e.u.id}`).set(headers()).expect(200)).body).toMatchObject({accessRoleId:r.id,roleName:r.name,brigadeId:b.id});
    await request(app.getHttpServer()).patch(`/api/users/${e.u.id}`).set(headers()).send({role:'ADMIN',accessRoleId:r.id}).expect(400);
    const me=(await request(app.getHttpServer()).get('/api/auth/me').set(headers()).expect(200)).body;
    const adminRole=await saveRole(role());
    await request(app.getHttpServer()).patch(`/api/users/${me.id}`).set(headers()).send({accessRoleId:adminRole.id}).expect(400);
    const dbUser=await app.get(DataSource).getRepository(User).findOneByOrFail({id:e.u.id});expect(dbUser.role).toBe('BRIGADIER');
  });
});
