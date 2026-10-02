import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

describe('Combined organization structure (real database)', () => {
  let app:INestApplication, admin:string, director:string, worker:string;
  let first:any, second:any, directorUser:any, unit:any;
  const suffix=crypto.randomUUID(), password='organization-test-password';
  const auth=(token=admin)=>({Authorization:`Bearer ${token}`,'X-Forwarded-For':'10.77.0.1'});
  const post=(path:string,data:object,token=admin)=>request(app.getHttpServer()).post(`/api/${path}`).set(auth(token)).send(data);
  const put=(path:string,data:object,token=admin)=>request(app.getHttpServer()).put(`/api/${path}`).set(auth(token)).send(data);
  const get=(path:string,token=admin)=>request(app.getHttpServer()).get(`/api/${path}`).set(auth(token));
  const overview=async()=> (await get('organization').expect(200)).body;
  const createUnit=(name:string,extra={})=>post('organization/units',{name:`${name} ${suffix}`,kind:'DEPARTMENT',parentId:null,headUserId:null,objectId:null,brigadeId:null,purpose:'Результат',isActive:true,revision:0,...extra});
  const unitDto=(u:any,extra={})=>({name:u.name,kind:u.kind,parentId:u.parent_id,headUserId:u.head_user_id,objectId:u.object_id,brigadeId:u.brigade_id,purpose:u.purpose,isActive:u.is_active,revision:u.revision,...extra});
  const person=async(id:number)=>(await overview()).employees.find((p:any)=>p.user_id===id);
  beforeAll(async()=>{
    process.env.NODE_ENV='test';process.env.DB_MIGRATE='true';process.env.JWT_SECRET||='organization-test-secret-at-least-32-characters';
    process.env.ADMIN_USERNAME||='e2e-admin';process.env.ADMIN_PASSWORD||='e2e-admin-password';
    const {AppModule}=await import('../src/app.module');
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy',true);app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();
    const login=async(username:string,pass=password)=>(await post('auth/login',{username,password:pass}).expect(201)).body.accessToken;
    admin=await login(process.env.ADMIN_USERNAME!,process.env.ADMIN_PASSWORD!);
    first=(await post('users',{username:`org-a-${suffix}`,fullName:`Первый ${suffix}`,password,role:'WORKER'}).expect(201)).body;
    second=(await post('users',{username:`org-b-${suffix}`,fullName:`Второй ${suffix}`,password,role:'WORKER'}).expect(201)).body;
    directorUser=(await post('users',{username:`org-d-${suffix}`,fullName:`Директор ${suffix}`,password,role:'DIRECTOR'}).expect(201)).body;
    worker=await login(first.username);director=await login(directorUser.username);
  });
  afterAll(async()=>{if(app)await app.close()});

  it('seeds the agreed combined model and titles without assigning people or granting roles',async()=>{
    const data=(await get('organization',director).expect(200)).body;
    const general=data.units.find((n:any)=>n.seed_key==='general');
    const executive=data.units.find((n:any)=>n.seed_key==='director');
    expect(data.units.filter((n:any)=>n.seed_key)).toHaveLength(15);
    expect(executive).toMatchObject({parent_id:general.id,head_user_id:null});
    expect(data.units.find((n:any)=>n.seed_key==='quality').parent_id).toBe(general.id);
    expect(data.units.find((n:any)=>n.seed_key==='strategy').parent_id).toBe(general.id);
    expect(data.units.find((n:any)=>n.seed_key==='supply').parent_id).toBe(executive.id);
    expect(data.employees.find((p:any)=>p.user_id===first.id)).toMatchObject({unit_id:null,manager_id:null,revision:0});
    const positions=(await get('job-positions').expect(200)).body;
    for(const name of ['Генеральный директор','Директор','Менеджер по снабжению','Маркетолог','Специалист по качеству'])expect(positions.some((p:any)=>p.name===name)).toBe(true);
    const keys = (value:unknown):string[] => value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key,nested])=>[key,...keys(nested)]) : [];
    expect(keys(data).join(' ')).not.toMatch(/password|auth_version|recovery|username|access_role_id/i);
    await request(app.getHttpServer()).get('/api/organization').expect(401);
    for(const path of ['organization','organization/history'])await get(path,worker).expect(403);
    await put(`organization/employees/${first.id}`,{revision:0,unitId:general.id,managerId:null,duties:''},worker).expect(403);
  });

  it('persists heads, object/brigade links, validates references and prevents lost edits',async()=>{
    const object=(await post('objects',{name:`Объект ${suffix}`}).expect(201)).body;
    const brigade=(await post('brigades',{name:`Бригада ${suffix}`}).expect(201)).body;
    unit=(await createUnit('Снабжение',{headUserId:directorUser.id,objectId:object.id,brigadeId:brigade.id}).expect(201)).body;
    expect(unit).toMatchObject({revision:1,head_name:directorUser.fullName,object_name:object.name,brigade_name:brigade.name});
    await createUnit('снабжение').expect(409);
    await createUnit('Wrong',{headUserId:2147483647}).expect(400);
    await createUnit('Wrong',{name:'  '}).expect(400);
    await createUnit('Wrong',{parentId:'1'}).expect(400);
    await createUnit('Wrong',{role:'DIRECTOR'}).expect(400);
    const changed=(await put(`organization/units/${unit.id}`,unitDto(unit,{purpose:'Обновлённый результат'}),director).expect(200)).body;
    await put(`organization/units/${unit.id}`,unitDto(unit)).expect(409);
    unit=changed;
    expect((await overview()).units.find((n:any)=>n.id===unit.id).purpose).toBe('Обновлённый результат');
  });

  it('rejects direct/indirect and concurrent department cycles atomically',async()=>{
    const a=(await createUnit('Ветка A').expect(201)).body;
    const b=(await createUnit('Ветка B',{parentId:a.id}).expect(201)).body;
    await put(`organization/units/${a.id}`,unitDto(a,{parentId:a.id})).expect(400);
    await put(`organization/units/${a.id}`,unitDto(a,{parentId:b.id})).expect(400);
    const c=(await createUnit('Ветка C').expect(201)).body;
    const results=await Promise.all([put(`organization/units/${a.id}`,unitDto(a,{parentId:c.id})),put(`organization/units/${c.id}`,unitDto(c,{parentId:a.id}))]);
    expect(results.map(r=>r.status).sort()).toEqual([200,400]);
  });

  it('assigns employees, preserves access and brigades, audits changes and rejects manager cycles',async()=>{
    let saved=(await put(`organization/employees/${first.id}`,{unitId:unit.id,managerId:second.id,duties:'Закупка по согласованным заявкам',revision:0}).expect(200)).body;
    expect(saved).toMatchObject({unit_id:unit.id,unit_name:unit.name,manager_name:second.fullName,revision:1});
    await put(`organization/employees/${first.id}`,{unitId:null,managerId:null,duties:'',revision:0}).expect(409);
    await put(`organization/employees/${second.id}`,{unitId:unit.id,managerId:first.id,duties:'',revision:0}).expect(400);
    await put(`organization/employees/${first.id}`,{unitId:unit.id,managerId:first.id,duties:'',revision:1}).expect(400);
    const me=(await get('auth/me',worker).expect(200)).body;
    expect(me).toMatchObject({role:'WORKER',positionId:null,brigadeId:null});
    await get('users',worker).expect(403);
    await put(`organization/units/${unit.id}`,unitDto(unit,{isActive:false})).expect(400);
    saved=(await put(`organization/employees/${first.id}`,{unitId:null,managerId:null,duties:'',revision:1}).expect(200)).body;
    const results=await Promise.all([
      put(`organization/employees/${first.id}`,{unitId:null,managerId:second.id,duties:'',revision:saved.revision}),
      put(`organization/employees/${second.id}`,{unitId:null,managerId:first.id,duties:'',revision:0}),
    ]);
    expect(results.map(r=>r.status).sort()).toEqual([200,400]);
    const history=(await get('organization/history').expect(200)).body;
    const entry=history.items.find((h:any)=>h.target_id===first.id&&h.after_data.unit_id===null&&h.before_data?.unit_id===unit.id);
    expect(entry.before_data).toMatchObject({unit_name:unit.name,manager_name:second.fullName});
    expect(entry.actor_name).toBeTruthy();
    await get('organization/history?before=-1').expect(400);
    const older=(await get(`organization/history?before=${history.items[0].id}`).expect(200)).body;
    expect(older.items.every((h:any)=>h.id<history.items[0].id)).toBe(true);
  });

  it('archives/restores empty units without deleting history and refuses new archived assignments',async()=>{
    unit=(await put(`organization/units/${unit.id}`,unitDto(unit,{isActive:false})).expect(200)).body;
    const employee=await person(first.id);
    await put(`organization/employees/${first.id}`,{unitId:unit.id,managerId:null,duties:'',revision:employee.revision}).expect(400);
    await createUnit('Нельзя',{parentId:unit.id}).expect(400);
    unit=(await put(`organization/units/${unit.id}`,unitDto(unit,{isActive:true})).expect(200)).body;
    expect((await get('organization/history').expect(200)).body.items.some((h:any)=>h.kind==='UNIT'&&h.target_id===unit.id&&h.after_data.is_active===false)).toBe(true);
  });

  it('keeps process ownership across versions, protects archived processes and retains audit',async()=>{
    const schema={title:`Закупки ${suffix}`,description:'Заявки и приёмка',initialStageId:'request',fields:[],stages:[
      {id:'request',label:'Заявка',roles:['ADMIN'],requiredFields:[],nextStages:['done']},
      {id:'done',label:'Принято',roles:['ADMIN'],requiredFields:[],nextStages:[]},
    ]};
    const definition=(await post('business-processes/definitions',schema).expect(201)).body;
    const path=`organization/processes/${definition.process_id}`;
    await put(path,{unitId:unit.id,ownerUserId:directorUser.id,revision:0}).expect(200);
    await put(path,{unitId:null,ownerUserId:null,revision:0}).expect(409);
    await post('business-processes/definitions',{...schema,title:schema.title+' v2',processId:definition.process_id,baseVersion:1}).expect(201);
    expect((await overview()).processes.find((p:any)=>p.process_id===definition.process_id)).toMatchObject({owner_user_id:directorUser.id,unit_id:unit.id,revision:1,title:schema.title+' v2'});
    await put(`organization/units/${unit.id}`,unitDto(unit,{isActive:false})).expect(400);
    await put(`business-processes/definitions/${definition.process_id}/archive`,{archived:true}).expect(200);
    await put(path,{unitId:unit.id,ownerUserId:second.id,revision:1}).expect(400);
    await put(path,{unitId:null,ownerUserId:null,revision:1}).expect(200);
    expect((await get('organization/history').expect(200)).body.items.some((h:any)=>h.kind==='PROCESS'&&h.target_id===definition.process_id&&h.before_data?.owner_name===directorUser.fullName)).toBe(true);
  });

  it('delegates read separately from edits and does not expand field-role permissions',async()=>{
    const role=(await post('access-roles',{name:`Структура просмотр ${suffix}`,baseRole:'ADMIN',permissions:['organization.overview'],pages:['/admin/organization'],canJoinBrigade:false,isActive:true}).expect(201)).body;
    const employee=(await post('users',{username:`org-r-${suffix}`,fullName:'Чтение структуры',password,role:'ADMIN',accessRoleId:role.id}).expect(201)).body;
    const token=(await post('auth/login',{username:employee.username,password}).expect(201)).body.accessToken;
    await get('organization',token).expect(200);
    await get('organization/history',token).expect(403);
    await put(`organization/units/${unit.id}`,unitDto(unit),token).expect(403);
    await put(`organization/employees/${first.id}`,{unitId:null,managerId:null,duties:'',revision:0},token).expect(403);
    await post('access-roles',{name:`Запрещено ${suffix}`,baseRole:'WORKER',permissions:[],pages:['/admin/organization'],canJoinBrigade:false,isActive:true}).expect(400);
  });
});
