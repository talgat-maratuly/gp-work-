import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

describe('Personal office and finance cycle (real database)',()=>{
  let app:INestApplication,admin:string,unit:any,otherUnit:any,project:any,otherProject:any,contract:any,budget:any,purchase:any,invoice:any,task:any,documentId:number,template:any;
  const suffix=crypto.randomUUID(),password='office-test-password',users:Record<string,any>={};let loginIp=1;
  const headers=(token=admin)=>({Authorization:`Bearer ${token}`,'X-Forwarded-For':'10.91.0.1'});
  const post=(path:string,data:object,token=admin)=>request(app.getHttpServer()).post('/api/'+path).set(headers(token)).send(data);
  const get=(path:string,token=admin)=>request(app.getHttpServer()).get('/api/'+path).set(headers(token));
  const login=async(username:string,pass=password)=>(await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For',`10.91.1.${loginIp++}`).send({username,password:pass}).expect(201)).body;
  const command=(path:string,data:object,token=admin)=>post('office/'+path,{requestId:crypto.randomUUID(),...data},token);
  const create=(kind:string,title:string,data:object,token=admin,p=project)=>command('records',{projectId:p.id,kind,title,data},token);
  const action=(row:any,actionName:string,token=admin,extra={})=>command('actions',{id:row.id,revision:row.revision,action:actionName,note:'Проверено по исходным документам',...extra},token);
  const ws=async(token=admin,p=project)=>(await get('office/workspace?projectId='+p.id,token).expect(200)).body;
  const row=async(id:number,token=admin)=>(await ws(token)).records.find((r:any)=>r.id===id);
  async function assign(id:number,profile:string,scope='DEPARTMENT',unitId=unit.id,enabled=true){
    const snapshot=(await get('office-access').expect(200)).body.users.find((u:any)=>u.id===id);
    return post('office-access/save',{userId:id,profile,scope,unitId,enabled,revision:snapshot.revision,organizationRevision:snapshot.organization_revision}).expect(201);
  }
  beforeAll(async()=>{
    process.env.NODE_ENV='test';process.env.DB_MIGRATE='true';process.env.JWT_SECRET||='office-test-secret-at-least-32-characters';process.env.ADMIN_USERNAME||='e2e-admin';process.env.ADMIN_PASSWORD||='e2e-admin-password';
    const {AppModule}=await import('../src/app.module');const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy',true);app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();
    admin=(await login(process.env.ADMIN_USERNAME!,process.env.ADMIN_PASSWORD!)).accessToken;
    const unitCreate=(name:string)=>post('organization/units',{name:name+suffix,kind:'DEPARTMENT',parentId:null,headUserId:null,objectId:null,brigadeId:null,purpose:'Работа',isActive:true,revision:0});
    unit=(await unitCreate('Офис A ').expect(201)).body;otherUnit=(await unitCreate('Офис B ').expect(201)).body;
    for(const profile of ['PROJECT_MANAGER','SUPPLY','FINANCE','ACCOUNTANT','QUALITY','LEGAL','EMPLOYEE','OUTSIDER']){
      const u=(await post('users',{username:profile+suffix,fullName:profile,password,role:'WORKER'}).expect(201)).body;
      await assign(u.id,profile==='OUTSIDER'?'EMPLOYEE':profile,['EMPLOYEE','OUTSIDER'].includes(profile)?'SELF':'DEPARTMENT',profile==='OUTSIDER'?otherUnit.id:unit.id);
      users[profile]={...u,token:(await login(u.username)).accessToken};
    }
    const projectData={title:'Проект A '+suffix,unitId:unit.id,ownerId:users.PROJECT_MANAGER.id,startDate:'2026-01-01',dueDate:'2026-12-31',description:'План результата',memberIds:[users.EMPLOYEE.id],unitIds:[]};
    project=(await command('projects',projectData,users.PROJECT_MANAGER.token).expect(201)).body;
    otherProject=(await command('projects',{...projectData,title:'Скрытый проект B '+suffix,unitId:otherUnit.id,ownerId:(await get('auth/me').expect(200)).body.id,memberIds:[users.OUTSIDER.id]}).expect(201)).body;
  });
  afterAll(async()=>{if(app)await app.close()});
  it('creates individual code, forces initial password change and never returns credentials in directories',async()=>{
    const result=await post('office-access/provision',{fullName:'Личный сотрудник '+suffix,unitId:unit.id,positionId:null,profile:'EMPLOYEE',scope:'SELF'}).expect(201);
    expect(result.headers['cache-control']).toBe('no-store');expect(result.body.username).toMatch(/^GP-[0-9A-F]{12}$/);
    const first=await login(result.body.username,result.body.temporaryPassword);expect(first.user.mustChangePassword).toBe(true);
    await get('office/workspace',first.accessToken).expect(403);
    await request(app.getHttpServer()).patch('/api/auth/password').set(headers(first.accessToken)).send({newPassword:password}).expect(200);
    await get('auth/me',first.accessToken).expect(401);
    const second=await login(result.body.username);expect(second.user.officeAccess.profile).toBe('EMPLOYEE');expect(second.user.mustChangePassword).toBe(false);
    const list=(await get('office-access').expect(200)).body;
    expect(JSON.stringify(list)).not.toContain(result.body.temporaryPassword);expect(JSON.stringify(list)).not.toMatch(/passwordHash|password_hash|auth_version/);
  });
  it('enforces personal/department scope on lists, direct IDs, legacy endpoints and custom-role delegation',async()=>{
    const data=(await get('office/workspace',users.PROJECT_MANAGER.token).expect(200)).body;
    expect(data.projects.map((p:any)=>p.id)).toContain(project.id);expect(data.projects.map((p:any)=>p.id)).not.toContain(otherProject.id);
    await get('office/workspace?projectId='+otherProject.id,users.PROJECT_MANAGER.token).expect(404);
    for(const path of ['users','organization','attendance','operations/kpi','products','office-access','admin-ai/risks'])await get(path,users.EMPLOYEE.token).expect(403);
    await get('attendance/me',users.EMPLOYEE.token).expect(200);
    await post('office-access/provision',{fullName:'Нельзя',unitId:unit.id,profile:'FINANCE',scope:'COMPANY'},users.EMPLOYEE.token).expect(403);
    await command('projects',{title:'Попытка',unitId:otherUnit.id,ownerId:users.PROJECT_MANAGER.id,startDate:'2026-01-01',dueDate:'2026-12-31',memberIds:[],unitIds:[]},users.PROJECT_MANAGER.token).expect(403);
    const custom=(await post('access-roles',{name:'Office view '+suffix,baseRole:'WORKER',permissions:['office.me','office.workspace'],pages:['/office'],canJoinBrigade:false,isActive:true}).expect(201)).body;
    const u=(await post('users',{username:'office-custom-'+suffix,fullName:'Custom',password,role:'WORKER',accessRoleId:custom.id}).expect(201)).body;
    await assign(u.id,'PROJECT_MANAGER');const token=(await login(u.username)).accessToken;
    await get('office/workspace',token).expect(200);
    await create('TASK','Forbidden',{assigneeId:users.EMPLOYEE.id,dueDate:'2026-12-31',checklist:[]},token).expect(403);
  });
  it('keeps tasks/checklists personal, accepts result independently and carries quadrant 2 improvement',async()=>{
    task=(await create('TASK','Проверка до выезда',{assigneeId:users.EMPLOYEE.id,dueDate:'2026-12-01',checklist:['Инструмент проверен','План подтверждён'],quadrant:2,improvement:'Сократить простои'},users.PROJECT_MANAGER.token).expect(201)).body;
    await create('TASK','Чужая задача',{assigneeId:users.PROJECT_MANAGER.id,dueDate:'2026-12-01',checklist:[]},users.PROJECT_MANAGER.token).expect(201);
    expect((await ws(users.EMPLOYEE.token)).records.map((r:any)=>r.id)).toEqual([task.id]);
    await action(task,'SUBMIT',users.EMPLOYEE.token).expect(400);
    task=(await action(task,'CHECK',users.EMPLOYEE.token,{checked:[true,true]}).expect(201)).body;
    task=(await action(task,'SUBMIT',users.EMPLOYEE.token,{note:'Все шаги выполнены'}).expect(201)).body;
    await action(task,'ACCEPT',users.EMPLOYEE.token).expect(403);
    task=(await action(task,'ACCEPT',users.QUALITY.token).expect(201)).body;expect(task.status).toBe('DONE');
    await action({...task,revision:1},'ACCEPT',users.QUALITY.token).expect(409);
    await create('TASK','Неверный исполнитель',{assigneeId:users.OUTSIDER.id,dueDate:'2026-12-01',checklist:[]},users.PROJECT_MANAGER.token).expect(400);
  });
  it('snapshots approved contract templates, numbers documents and protects signed attachments',async()=>{
    const body='Договор {{number}}. {{counterparty}}: {{subject}}. Стоимость {{amount}}. Оплата {{paymentTerms}}.';
    template=(await command('templates',{title:'Шаблон '+suffix,body,approve:true},users.LEGAL.token).expect(201)).body;
    const payload={templateId:template.id,counterparty:'Поставщик '+suffix,requisites:'Реквизиты сторон',subject:'Поставка материалов',amount:'1000.00',paymentTerms:'После приёмки',startDate:'2026-01-01',endDate:'2026-12-31',direction:'SUPPLIER'};
    contract=(await create('CONTRACT','Поставка материалов',payload,users.LEGAL.token).expect(201)).body;
    expect(contract.code).toMatch(/^DOG-\d{4}-\d{6}$/);expect(contract.data.renderedBody).toContain(contract.code);
    await command('templates',{id:template.id,revision:template.revision,title:template.title,body:body+' Новые условия',approve:true},users.LEGAL.token).expect(201);
    expect((await row(contract.id)).data.renderedBody).not.toContain('Новые условия');
    contract=(await action(contract,'SUBMIT',users.LEGAL.token).expect(201)).body;
    await action(contract,'SIGN',users.LEGAL.token).expect(400);
    const doc=await request(app.getHttpServer()).post(`/api/office/records/${contract.id}/documents`).set(headers(users.LEGAL.token)).attach('file',Buffer.from('%PDF-1.4\nTest signed file'),{filename:'signed.pdf',contentType:'application/pdf'}).expect(201);documentId=doc.body.id;
    contract=(await action(contract,'SIGN',users.LEGAL.token).expect(201)).body;
    const download=await get('office/documents/'+documentId,users.LEGAL.token).expect(200);expect(download.headers['content-disposition']).toContain('attachment');
    for(const token of [users.OUTSIDER.token,users.QUALITY.token,users.SUPPLY.token]){
      await get('office/documents/'+documentId,token).expect(404);await get('office/records/'+contract.id+'/print',token).expect(404);
    }
    await request(app.getHttpServer()).post(`/api/office/records/${contract.id}/documents`).set(headers(users.LEGAL.token)).attach('file',Buffer.from('%PDF-1.4\nReplacement'),{filename:'new.pdf',contentType:'application/pdf'}).expect(400);
    const supply=await ws(users.SUPPLY.token);expect(supply.records.some((r:any)=>r.kind==='CONTRACT')).toBe(false);expect(supply.contractOptions[0]).not.toHaveProperty('amount');
  });
  it('reserves budget atomically and retries creation without duplicate numbers',async()=>{
    budget=(await create('BUDGET','Бюджет проекта',{lines:[{title:'Материалы',amount:'100.00'}]},users.PROJECT_MANAGER.token).expect(201)).body;
    budget=(await action(budget,'SUBMIT',users.PROJECT_MANAGER.token).expect(201)).body;
    budget=(await action(budget,'APPROVE',users.FINANCE.token).expect(201)).body;
    const data={supplier:contract.data.counterparty,amount:'70.00',purpose:'Материалы',dueDate:'2026-12-01',contractId:contract.id};
    const p1=(await create('PURCHASE','Закупка 1',data,users.SUPPLY.token).expect(201)).body;
    const p2=(await create('PURCHASE','Закупка 2',data,users.SUPPLY.token).expect(201)).body;
    const one=(await action(p1,'SUBMIT',users.SUPPLY.token).expect(201)).body,two=(await action(p2,'SUBMIT',users.SUPPLY.token).expect(201)).body;
    const outcomes=await Promise.all([action(one,'APPROVE',users.FINANCE.token),action(two,'APPROVE',users.FINANCE.token)]);
    expect(outcomes.map(r=>r.status).sort()).toEqual([201,400]);purchase=outcomes.find(r=>r.status===201)!.body;
    const body={requestId:crypto.randomUUID(),projectId:project.id,kind:'PURCHASE',title:'Повтор',data:{...data,amount:'1.00'}};
    const duplicates=await Promise.all([post('office/records',body,users.SUPPLY.token),post('office/records',body,users.SUPPLY.token)]);
    expect(duplicates.every(r=>r.status===201)).toBe(true);expect(duplicates[0].body.id).toBe(duplicates[1].body.id);
    await post('office/records',{...body,title:'Подмена'},users.SUPPLY.token).expect(409);
    const forbidden=await create('BUDGET','Малый бюджет',{lines:[{title:'Мало',amount:'60.00'}]},users.PROJECT_MANAGER.token).expect(201);
    const submitted=(await action(forbidden.body,'SUBMIT',users.PROJECT_MANAGER.token).expect(201)).body;
    await action(submitted,'APPROVE',users.FINANCE.token).expect(400);
    const budgets=(await ws()).records.filter((r:any)=>r.kind==='BUDGET'&&r.status==='APPROVED');expect(budgets.map((r:any)=>r.id)).toEqual([budget.id]);
  });
  it('matches contract, purchase, receipt and invoice; records partial payments with exact concurrent ceiling',async()=>{
    const invoiceData={direction:'IN',amount:'70.00',contractId:contract.id,purchaseId:purchase.id,externalNumber:'invoice-'+suffix,counterparty:contract.data.counterparty,requisites:'Реквизиты',issueDate:'2026-01-01',dueDate:'2026-12-01',advance:false,advanceReason:''};
    invoice=(await create('INVOICE','Счёт поставщика',invoiceData,users.ACCOUNTANT.token).expect(201)).body;
    invoice=(await action(invoice,'SUBMIT',users.ACCOUNTANT.token).expect(201)).body;
    await action(invoice,'APPROVE',users.FINANCE.token).expect(400);
    const receipt=(await create('RECEIPT','Материалы получены',{purchaseId:purchase.id,amount:'70.00',date:'2026-01-01',note:'Комплект и качество проверены'},users.SUPPLY.token).expect(201)).body;
    invoice=(await action(invoice,'APPROVE',users.FINANCE.token).expect(201)).body;
    await action(receipt,'VOID',users.FINANCE.token).expect(400);
    const paymentData={invoiceId:invoice.id,amount:'40.00',date:'2026-01-02',reference:'pay-a-'+suffix};
    const results=await Promise.all([create('PAYMENT','Частичная оплата',paymentData,users.ACCOUNTANT.token),create('PAYMENT','Вторая оплата',{...paymentData,reference:'pay-b-'+suffix},users.ACCOUNTANT.token)]);
    expect(results.map(r=>r.status).sort()).toEqual([201,400]);
    const payment=results.find(r=>r.status===201)!.body;
    await create('PAYMENT','Остаток',{...paymentData,amount:'30.00',reference:'pay-c-'+suffix},users.ACCOUNTANT.token).expect(201);
    expect((await row(invoice.id)).status).toBe('PAID');
    await action(payment,'VOID',users.FINANCE.token,{note:'Ошибка реквизитов: сторнировано по выписке'}).expect(201);
    expect((await row(invoice.id)).status).toBe('APPROVED');
    const final=(await ws()).records.filter((r:any)=>r.kind==='PAYMENT'&&r.parent_id===invoice.id&&r.status==='RECORDED').reduce((s:number,r:any)=>s+Number(r.amount),0);expect(final).toBe(3000);
    await create('INVOICE','Чужой счёт',{...invoiceData,externalNumber:'other-'+suffix},users.ACCOUNTANT.token,otherProject).expect(404);
    await create('PAYMENT','Нельзя',{...paymentData,amount:'1.00'},users.SUPPLY.token).expect(403);
    expect((await ws(users.QUALITY.token)).records.every((r:any)=>r.kind==='TASK')).toBe(true);
    expect((await ws(users.EMPLOYEE.token)).events.every((e:any)=>e.category==='TASK')).toBe(true);
  });
  it('applies department move and disabling immediately to the same JWT without restoring legacy access',async()=>{
    await assign(users.SUPPLY.id,'SUPPLY','DEPARTMENT',otherUnit.id);
    await get('office/workspace?projectId='+project.id,users.SUPPLY.token).expect(404);
    await assign(users.SUPPLY.id,'SUPPLY','DEPARTMENT',otherUnit.id,false);
    await get('office/workspace',users.SUPPLY.token).expect(403);
    await get('users',users.SUPPLY.token).expect(403);
    await get('products',users.SUPPLY.token).expect(403);
    const me=(await get('auth/me',users.SUPPLY.token).expect(200)).body;expect(me.officeAccess.enabled).toBe(false);
  });
});
