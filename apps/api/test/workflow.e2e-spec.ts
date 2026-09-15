import { INestApplication,ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Product } from '../src/entities';
import { WorkflowService } from '../src/modules/workflow/workflow.service';
import { UserRole } from '../src/common/enums/user-role.enum';
const operation=()=>crypto.randomUUID();
describe('Integrated work improvement flow (real API/database)',()=>{
  let app:INestApplication,db:DataSource;let admin:{id:number;token:string},worker:{id:number;token:string},outsider:{id:number;token:string},director:{id:number;token:string},accountant:{id:number;token:string};
  let workType:number,section:any,standard:any,task:any,tool:any,product:Product;
  const headers=(token:string)=>({Authorization:`Bearer ${token}`,'X-Forwarded-For':`10.81.0.${token===admin?.token?1:token===worker?.token?2:token===director?.token?3:token===accountant?.token?4:5}`});
  const post=async(path:string,body:object,who=admin,status=201)=>(await request(app.getHttpServer()).post('/api'+path).set(headers(who.token)).send(body).expect(res=>{if(res.status!==status)throw new Error(`POST ${path}: expected ${status}, got ${res.status}: ${JSON.stringify(res.body)}`)})).body;
  const get=async(path:string,who=admin,status=200)=>(await request(app.getHttpServer()).get('/api'+path).set(headers(who.token)).expect(status)).body;
  const login=async(username:string,password:string)=>{const r=await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For',`10.82.0.${Math.floor(Math.random()*200)+1}`).send({username,password}).expect(201);return{id:r.body.user.id,token:r.body.accessToken}};
  beforeAll(async()=>{
    process.env.NODE_ENV='test';process.env.DB_MIGRATE='true';process.env.JWT_SECRET||='workflow-only-test-secret-at-least-32-characters';process.env.ADMIN_USERNAME||='e2e-admin';process.env.ADMIN_PASSWORD||='e2e-admin-password';
    const {AppModule}=await import('../src/app.module');const mod=await Test.createTestingModule({imports:[AppModule]}).compile();app=mod.createNestApplication();app.getHttpAdapter().getInstance().set('trust proxy',true);app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(DataSource);
    admin=await login(process.env.ADMIN_USERNAME!,process.env.ADMIN_PASSWORD!);
    const suffix=Date.now();async function user(role:string){const username=`flow-${role}-${suffix}-${operation().slice(0,8)}`;await post('/users',{username,password:'workflow-test-pass',fullName:username,role});return login(username,'workflow-test-pass')}
    worker=await user('WORKER');outsider=await user('WORKER');director=await user('DIRECTOR');accountant=await user('ACCOUNTANT');
    const object=await post('/objects',{name:`Flow object ${suffix}`});section=await post('/sections',{objectId:object.id,name:`Flow section ${suffix}`,latitude:51.23,longitude:51.37,radiusMeters:150});workType=(await post('/work-types',{name:`Flow work ${suffix}`})).id;
    standard=await post('/workflow/standards',{workTypeId:workType,title:'Уход за газоном',preparation:['Доступ на участок подтверждён'],steps:['Провести работу по заданию','Убрать участок'],acceptance:'Ровная стрижка, мусор убран'});
    task=await newTask();tool=await post('/workflow/tools',{code:`TOOL-${suffix}`,name:'Триммер',homeLocation:'Склад / полка 1'});
    product=await db.getRepository(Product).save(db.getRepository(Product).create({name:`Fuel ${suffix}`,unit:'л',initialQuantity:'10',currentQuantity:'10'}));
  });
  afterAll(async()=>{if(app)await app.close()});
  async function newTask(){return post('/tasks',{sectionId:section.id,workTypeId:workType,assigneeUserId:worker.id,dueDate:'2026-09-16',description:'Уход за участком'})}
  const planBody=(extra={})=>({standardId:standard.id,accountableId:admin.id,reviewerId:director.id,wipLimit:1,toolIds:[],materials:[],...extra});
  it('uses role and task scope for every read and mutation',async()=>{
    await get(`/workflow/tasks/${task.id}`,outsider,403);await get('/workflow/board',accountant,403);await get('/workflow/summary',accountant);
    expect(await get('/workflow/board',outsider)).toEqual([]);
    await post('/workflow/standards',{workTypeId:workType,title:'forged',preparation:['a'],steps:['b'],acceptance:'c'},worker,403);
    await post(`/workflow/tasks/${task.id}/plan`,planBody(),worker,403);
    await post(`/workflow/tasks/${task.id}/plan`,planBody({reviewerId:worker.id}),admin,400);
    const catalog=await get('/workflow/catalog',worker);expect(catalog.people).toEqual([]);expect(JSON.stringify(catalog)).not.toContain('passwordHash');
  });
  it('prepares against real material issuance and an inspected tool; duplicate issue is rejected',async()=>{
    await post(`/workflow/tasks/${task.id}/plan`,planBody({toolIds:[tool.id],materials:[{productId:product.id,quantity:2}]}));
    await request(app.getHttpServer()).patch(`/api/tasks/${task.id}`).set(headers(admin.token)).send({sectionId:section.id,workTypeId:workType,assigneeUserId:worker.id,description:'Уход за участком по стандарту'}).expect(200);
    await request(app.getHttpServer()).patch(`/api/tasks/${task.id}`).set(headers(admin.token)).send({assigneeUserId:outsider.id}).expect(400);
    await post(`/workflow/tasks/${task.id}/prepare`,{checked:[0]},worker,400);
    await post(`/workflow/tools/${tool.id}/actions`,{action:'issue',taskId:task.id,note:'Выдача'},admin,400);
    await post(`/workflow/tools/${tool.id}/actions`,{action:'inspect',location:'Склад / полка 1',serviceable:true,clean:true,note:'Проверен и очищен'});
    await post(`/workflow/tools/${tool.id}/actions`,{action:'issue',taskId:task.id,note:'Выдан'});
    await post(`/workflow/tools/${tool.id}/actions`,{action:'issue',taskId:task.id,note:'Повтор'},admin,400);
    await post('/stock-movements',{type:'OUTCOME',productId:product.id,quantity:2,taskId:task.id,purpose:'Подготовка',clientOperationId:operation()});
    const ready=await post(`/workflow/tasks/${task.id}/prepare`,{checked:[0]},worker);expect(ready.ready_at).toBeTruthy();
    const detail=await get(`/workflow/tasks/${task.id}`,worker);expect(detail.readiness).toEqual([]);expect(detail.materials[0]).toMatchObject({required:2,issued:2,missing:0});
  });
  it('deduplicates reports, requires independent verification and preserves an auditable cause',async()=>{
    const body={category:'WATER',description:'Нет воды',clientOperationId:operation()};const o=await post(`/workflow/tasks/${task.id}/obstacles`,body,worker);expect((await post(`/workflow/tasks/${task.id}/obstacles`,body,worker)).id).toBe(o.id);
    await post(`/workflow/tasks/${task.id}/obstacles`,{...body,description:'Другое'},worker,409);
    expect((await get('/workflow/board',worker)).find((t:any)=>t.id===task.id).stage).toBe('BLOCKED');
    await post(`/workflow/tasks/${task.id}/prepare`,{checked:[0]},worker,400);
    await post(`/workflow/obstacles/${o.id}/actions`,{action:'assign',ownerId:admin.id,dueAt:'2026-09-16T12:00:00Z',note:'Проверить подачу'});
    await post(`/workflow/obstacles/${o.id}/actions`,{action:'resolve',note:'Вода доставлена'});
    await post(`/workflow/obstacles/${o.id}/actions`,{action:'verify',note:'Сам проверил'},admin,403);
    await post(`/workflow/obstacles/${o.id}/actions`,{action:'verify',note:'Подтверждаю, вода есть'},worker);
    const detail=await get(`/workflow/tasks/${task.id}`,worker);expect(detail.obstacles[0].status).toBe('CLOSED');expect(detail.events.some((e:any)=>e.kind==='OBSTACLE_VERIFY')).toBe(true);
  });
  it('keeps QR/evidence mandatory and completes the configured task with the assigned reviewer',async()=>{
    await post(`/tasks/my/${task.id}/accept`,{},worker);
    await post(`/tasks/my/${task.id}/start`,{},worker,400);
    const exec=await arrive(task.id);await evidence(exec.id);
    await startExecution(exec.id);
    await post(`/field/executions/${exec.id}/complete`,{clientOperationId:operation(),percent:100,description:'Всё выполнено'},worker,400);
    await post(`/workflow/tasks/${task.id}/steps`,{checked:[0,0]},worker,400);
    await post(`/workflow/tasks/${task.id}/steps`,{checked:[0,1]},worker);
    await post(`/field/executions/${exec.id}/complete`,{clientOperationId:operation(),percent:100,description:'Всё выполнено'},worker);
    await post(`/field/executions/${exec.id}/review`,{accepted:true,clientOperationId:operation()},admin,403);
    await post(`/field/executions/${exec.id}/review`,{accepted:true,clientOperationId:operation()},director);
    expect((await get('/workflow/board',worker)).find((t:any)=>t.id===task.id).stage).toBe('DONE');
    await post(`/workflow/tools/${tool.id}/actions`,{action:'return',location:'Зона ремонта',serviceable:false,clean:true,note:'Нужна замена лески'},worker);
    expect((await get(`/workflow/tasks/${task.id}`,worker)).tools[0].state).toBe('MAINTENANCE');
  });
  async function startExecution(id:number){
    const execution=await post(`/field/executions/${id}/start`,{clientOperationId:operation()},worker);
    const answers=execution.availableChecklist.map((i:{id:number})=>({itemId:i.id,isCompleted:true}));
    if(answers.length)await post(`/field/executions/${id}/checklist`,{clientOperationId:operation(),answers},worker);
  }
  async function arrive(taskId:number){return post(`/field/tasks/${taskId}/arrive`,{sectionCode:section.code,latitude:51.23,longitude:51.37,accuracy:5,clientExecutionId:operation(),clientOperationId:operation()},worker)}
  async function evidence(execId:number){
    let upload=request(app.getHttpServer()).post('/api/uploads/photos').set(headers(worker.token));for(let i=0;i<5;i++)upload=upload.attach('files',Buffer.from([0xff,0xd8,0xff,0xd9]),{filename:`flow-${execId}-${i}.jpg`,contentType:'image/jpeg'});
    const photos=(await upload.expect(201)).body;
    const e=await post(`/field/executions/${execId}/face`,{clientOperationId:operation(),selfieUrl:photos[0],livenessEvidenceUrls:photos.slice(0,3)},worker);
    await post(`/field/face/${e.faceVerifications[0].id}/review`,{status:'VERIFIED',clientOperationId:operation()},director);
    await post(`/field/executions/${execId}/photos`,{photos:[{clientPhotoId:operation(),phase:'BEFORE',url:photos[3],capturedAt:new Date().toISOString()},{clientPhotoId:operation(),phase:'AFTER',url:photos[4],capturedAt:new Date().toISOString()}]},worker);
  }
  it('enforces the WIP limit across different prepared tasks including the review queue',async()=>{
    const first=await newTask(),second=await newTask();for(const t of [first,second]){await post(`/workflow/tasks/${t.id}/plan`,planBody());await post(`/workflow/tasks/${t.id}/prepare`,{checked:[0]},worker)}
    const a=await arrive(first.id);await evidence(a.id);const b=await arrive(second.id);await evidence(b.id);
    await startExecution(a.id);
    await post(`/field/executions/${b.id}/start`,{clientOperationId:operation()},worker,409);
    await post(`/workflow/tasks/${first.id}/steps`,{checked:[0,1]},worker);
    await post(`/field/executions/${a.id}/complete`,{clientOperationId:operation(),percent:100,description:'Готово'},worker);
    await post(`/field/executions/${b.id}/start`,{clientOperationId:operation()},worker,409);
    await post(`/field/executions/${a.id}/review`,{accepted:true,clientOperationId:operation()},director);
    await startExecution(b.id);
    // Restore a free slot for other scenarios without weakening the gate.
    await post(`/workflow/tasks/${second.id}/steps`,{checked:[0,1]},worker);
    await post(`/field/executions/${b.id}/complete`,{clientOperationId:operation(),percent:100,description:'Готово'},worker);
    await post(`/field/executions/${b.id}/review`,{accepted:true,clientOperationId:operation()},director);
  });
  it('measures an improvement, prevents self approval and versions the standard without changing history',async()=>{
    const proposal={problem:'Долго ищем инструмент',proposal:'Собирать комплект до выезда',clientOperationId:operation()};const i=await post(`/workflow/tasks/${task.id}/improvements`,proposal,worker);
    expect((await post(`/workflow/tasks/${task.id}/improvements`,proposal,worker)).id).toBe(i.id);
    await post(`/workflow/improvements/${i.id}/actions`,{action:'adopt',adoptionRule:'Собрать комплект',note:'Принять'},director,400);
    await post(`/workflow/improvements/${i.id}/actions`,{action:'plan',ownerId:admin.id,dueAt:'2026-09-16T12:00:00Z',hypothesis:'Инструмент хранится без комплекта',metric:'Затраты на поиск за смену',unit:'тг',direction:'LOWER',baseline:1000,note:'Сравнить пять сопоставимых смен'});
    await post(`/workflow/improvements/${i.id}/actions`,{action:'measure',observed:400,note:'Табель и расчёт: пять смен по одному виду работы'});
    await post(`/workflow/improvements/${i.id}/actions`,{action:'adopt',adoptionRule:'Проверить комплект до выезда',note:'Подтверждено'},admin,400);
    const adopted=await post(`/workflow/improvements/${i.id}/actions`,{action:'adopt',adoptionRule:'Проверить комплект до выезда',note:'Сверено с записями смен'},director);
    expect(adopted.status).toBe('ADOPTED');const c=await get('/workflow/catalog');expect(c.standards.find((s:any)=>s.work_type_id===workType).version).toBe(2);
    const old=await get(`/workflow/tasks/${task.id}`,worker);expect(old.plan.version).toBe(1);expect(old.plan.steps).toHaveLength(2);
    const financial=await get('/workflow/summary',accountant);expect(financial.financial.some((r:any)=>r.id===i.id)).toBe(true);expect(financial).not.toHaveProperty('counts');
  });
  it('serializes simultaneous starts for one worker (native PostgreSQL locking)',async()=>{
    const first=await newTask(),second=await newTask();const latest=(await get('/workflow/catalog')).standards.find((s:any)=>s.work_type_id===workType);
    for(const t of [first,second]){await post(`/workflow/tasks/${t.id}/plan`,planBody({standardId:latest.id}));await post(`/workflow/tasks/${t.id}/prepare`,{checked:[0]},worker)}
    const service=app.get(WorkflowService);const actor={id:worker.id,role:UserRole.WORKER,brigadeId:null} as any;
    const start=(id:number)=>service.withStart(id,actor,async q=>{await q.query("UPDATE tasks SET status='IN_PROGRESS' WHERE id=$1",[id]);return id});
    const result=await Promise.allSettled([start(first.id),start(second.id)]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(result.filter(r=>r.status==='rejected')).toHaveLength(1);
  });
});
