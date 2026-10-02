import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { resolveAccessRole } from '../access-roles/access-roles.service';
import { executive, loadOfficeAccess, OfficeAccess, Profile, PROFILES, requireRight, RIGHTS, VIEWS } from './office-policy';
import { bool, canonical, choice, day, escapeHtml, ids, integer, invalid, money, object, text, today } from './office-validation';

type Actor={user:User;access:OfficeAccess};
type RecordRow={id:number;project_id:number;kind:string;code:string;title:string;status:string;parent_id:number|null;assignee_id:number|null;amount:string;due_date:string|null;data:any;revision:number;created_by:number};
const prefixes:Record<string,string>={PROJECT:'PR',TASK:'TSK',CONTRACT:'DOG',BUDGET:'BDG',PURCHASE:'ZAK',RECEIPT:'RCV',INVOICE:'SCH',PAYMENT:'PAY'};

@Injectable()
export class OfficeService {
  constructor(private readonly db:DataSource){}
  private async actor(m:EntityManager, user:User, allowDisabled=false):Promise<Actor> {
    const live=await m.getRepository(User).createQueryBuilder('u').addSelect(['u.authVersion','u.mustChangePassword']).where('u.id=:id',{id:user.id}).getOne();
    if(!live?.isActive||live.authVersion!==user.authVersion||live.mustChangePassword)throw new UnauthorizedException('Войдите заново');
    const policy=await resolveAccessRole(m,live);
    if(!policy?.isActive||policy.baseRole!==live.role)throw new ForbiddenException('Роль недоступна');
    live.accessPolicy=policy;
    const access=await loadOfficeAccess(m,live);
    if(!access||(!allowDisabled&&!access.enabled))throw new ForbiddenException('Рабочий доступ не назначен или отключён. Обратитесь к руководителю.');
    return {user:live,access};
  }
  private async write<T>(user:User, operation:string, input:unknown, work:(m:EntityManager,a:Actor)=>Promise<T>):Promise<T> {
    const requestId=(input as any)?.requestId;
    if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))invalid('Нужен идентификатор операции');
    const digest=createHash('sha256').update(canonical(input)).digest('hex');
    return this.db.transaction(async m=>{
      // All monetary reservations and transitions serialize, including retries.
      await m.query('SELECT pg_advisory_xact_lock(1733600000)');
      await m.query('SELECT pg_advisory_xact_lock(1733500000)');
      const a=await this.actor(m,user);
      if(a.user.accessRoleId!=null&&!a.user.accessPolicy?.permissions?.includes(`office.${operation}`))throw new ForbiddenException();
      const [previous]=await m.query('SELECT * FROM office_requests WHERE user_id=$1 AND request_id=$2',[user.id,requestId]);
      if(previous) {
        if(previous.operation!==operation||previous.digest!==digest)throw new ConflictException('Этот идентификатор уже использован для другой операции');
        // Do not replay sensitive snapshots after a scope/profile revocation.
        const reference=previous.result;
        if(reference.project_id)await this.project(m,a,reference.project_id);
        if(reference.kind&&!VIEWS[a.access.profile].includes(reference.kind))throw new ForbiddenException();
        if(reference.kind==='TASK'&&a.access.profile==='EMPLOYEE'&&reference.assignee_id!==user.id)throw new ForbiddenException();
        if(operation.startsWith('template'))requireRight(a.access,'template');
        return reference as T;
      }
      const result=await work(m,a);
      await m.query('INSERT INTO office_requests(user_id,request_id,operation,digest,result) VALUES($1,$2,$3,$4,$5)',[user.id,requestId,operation,digest,JSON.stringify(result)]);
      return result;
    });
  }
  private async event(m:EntityManager,a:Actor,projectId:number|null,category:string,action:string,before:any,after:any,recordId:number|null=null) {
    await m.query('INSERT INTO office_events(project_id,record_id,category,actor_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',[projectId,recordId,category,a.user.id,action,before?JSON.stringify(before):null,after?JSON.stringify(after):null]);
  }
  private async code(m:EntityManager,kind:string) {
    const year=Number(today().slice(0,4));const [r]=await m.query(`INSERT INTO office_counters(kind,year,value) VALUES($1,$2,1) ON CONFLICT(kind,year) DO UPDATE SET value=office_counters.value+1 RETURNING value`,[kind,year]);
    return `${prefixes[kind]}-${year}-${String(r.value).padStart(6,'0')}`;
  }
  private scope(a:Actor,alias='p') {
    return {sql:`($1::boolean OR ${alias}.owner_id=$2 OR EXISTS(SELECT 1 FROM office_project_members pm WHERE pm.project_id=${alias}.id AND pm.user_id=$2)
      OR ($3::boolean AND (${alias}.unit_id=$4 OR EXISTS(SELECT 1 FROM office_project_units pu WHERE pu.project_id=${alias}.id AND pu.unit_id=$4))))`,
      params:[a.access.scope==='COMPANY',a.user.id,a.access.scope==='DEPARTMENT',a.access.unitId]};
  }
  private async project(m:EntityManager,a:Actor,id:number) {
    const s=this.scope(a);const [p]=await m.query(`SELECT p.*,p.start_date::text,p.due_date::text,u.name unit_name,usr.full_name owner_name FROM office_projects p JOIN organization_units u ON u.id=p.unit_id JOIN users usr ON usr.id=p.owner_id WHERE p.id=$5 AND ${s.sql}`,[...s.params,id]);
    if(!p)throw new NotFoundException('Проект не найден');return p;
  }
  private async record(m:EntityManager,a:Actor,id:number,kind?:string):Promise<RecordRow> {
    const [r]=await m.query('SELECT r.*,r.due_date::text FROM office_records r WHERE id=$1',[id]);
    if(!r||!VIEWS[a.access.profile].includes(r.kind)||(kind&&r.kind!==kind))throw new NotFoundException('Запись не найдена');
    await this.project(m,a,r.project_id);
    if(r.kind==='TASK'&&a.access.profile==='EMPLOYEE'&&r.assignee_id!==a.user.id)throw new NotFoundException('Задача не найдена');return r;
  }
  private revision(row:{revision:number},value:unknown) {if(integer(value,'Версия',0)!==row.revision)throw new ConflictException('Запись уже изменена. Обновите страницу.');}
  private async activeProject(m:EntityManager,a:Actor,id:number) {const p=await this.project(m,a,id);if(p.status!=='ACTIVE')invalid('Проект закрыт');return p;}
  private async insert(m:EntityManager,a:Actor,projectId:number,kind:string,title:string,data:any,amount=0,parentId:number|null=null,assignee:number|null=null,dueDate:string|null=null,status='DRAFT') {
    const [r]=await m.query(`INSERT INTO office_records(project_id,kind,code,title,status,data,amount,parent_id,assignee_id,due_date,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *,due_date::text`,[projectId,kind,await this.code(m,kind),title,status,JSON.stringify(data),amount,parentId,assignee,dueDate,a.user.id]);
    await this.event(m,a,projectId,kind,'Создано',null,r,r.id);return r;
  }
  private async save(m:EntityManager,a:Actor,row:RecordRow,status:string,data=row.data) {
    const [[r]]=await m.query('UPDATE office_records SET status=$2,data=$3,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *,due_date::text',[row.id,status,JSON.stringify(data)]);
    await this.event(m,a,row.project_id,row.kind,status,row,r,row.id);return r;
  }
  async me(user:User) {const a=await this.actor(this.db.manager,user,true);return {...a.access,label:PROFILES[a.access.profile],rights:a.access.enabled?RIGHTS[a.access.profile]:[],views:a.access.enabled?VIEWS[a.access.profile]:[]};}
  async workspace(user:User,projectId?:number) {
    const m=this.db.manager,a=await this.actor(m,user),s=this.scope(a);
    const projects=await m.query(`SELECT p.*,p.start_date::text,p.due_date::text,u.name unit_name,usr.full_name owner_name FROM office_projects p JOIN organization_units u ON u.id=p.unit_id JOIN users usr ON usr.id=p.owner_id WHERE ${s.sql} ORDER BY p.id DESC LIMIT 500`,s.params);
    if(projectId)await this.project(m,a,projectId);
    const projectIds=projectId?[projectId]:projects.map((p:any)=>p.id);
    const records=await m.query(`SELECT r.*,r.due_date::text,usr.full_name assignee_name,(SELECT COALESCE(sum(pay.amount),0)::text FROM office_records pay WHERE pay.parent_id=r.id AND pay.kind='PAYMENT' AND pay.status='RECORDED') paid_amount FROM office_records r LEFT JOIN users usr ON usr.id=r.assignee_id WHERE r.project_id=ANY($1::int[]) AND r.kind=ANY($2::text[]) AND ($3::boolean OR r.kind!='TASK' OR r.assignee_id=$4) ORDER BY r.id DESC LIMIT 2000`,[projectIds,VIEWS[a.access.profile],a.access.profile!=='EMPLOYEE',user.id]);
    const units=await m.query('SELECT id,name FROM organization_units WHERE is_active ORDER BY name');
    const employees=await m.query(`SELECT u.id,u.full_name,a.unit_id FROM users u LEFT JOIN organization_assignments a ON a.user_id=u.id
      WHERE u.is_active AND (EXISTS(SELECT 1 FROM office_access oa WHERE oa.user_id=u.id AND oa.enabled) OR (u.access_role_id IS NULL AND u.role IN ('ADMIN','DIRECTOR')))
      AND ($1::boolean OR u.id=$2 OR a.unit_id=$3 OR EXISTS(SELECT 1 FROM office_project_members pm WHERE pm.user_id=u.id AND pm.project_id=ANY($4::int[])) OR EXISTS(SELECT 1 FROM office_project_units pu WHERE pu.unit_id=a.unit_id AND pu.project_id=ANY($4::int[]))) ORDER BY u.full_name`,[executive(a.user),user.id,a.access.unitId,projectIds]);
    const memberships=await m.query('SELECT project_id,user_id FROM office_project_members WHERE project_id=ANY($1::int[])',[projectIds]);
    const projectUnits=await m.query('SELECT project_id,unit_id FROM office_project_units WHERE project_id=ANY($1::int[])',[projectIds]);
    const templates=VIEWS[a.access.profile].includes('CONTRACT')?await m.query('SELECT id,title,body,revision,approved FROM office_templates ORDER BY id DESC'):[];
    const contractOptions=await m.query("SELECT id,project_id,code,data->>'counterparty' counterparty,data->>'direction' direction FROM office_records WHERE project_id=ANY($1::int[]) AND kind='CONTRACT' AND status='SIGNED'",[projectIds]);
    const events=projectId?await m.query(`SELECT e.id,e.record_id,e.category,e.action,e.created_at,u.full_name actor_name FROM office_events e JOIN users u ON u.id=e.actor_id WHERE e.project_id=$1 AND (e.category=ANY($2::text[]) OR e.category='PROJECT') AND ($3::boolean OR e.record_id IN (SELECT id FROM office_records WHERE assignee_id=$4 AND kind='TASK')) ORDER BY e.id DESC LIMIT 100`,[projectId,VIEWS[a.access.profile],a.access.profile!=='EMPLOYEE',user.id]):[];
    const financial=projectId&&VIEWS[a.access.profile].includes('BUDGET')?(await m.query("SELECT (SELECT amount::text FROM office_records WHERE project_id=$1 AND kind='BUDGET' AND status='APPROVED') budget,(SELECT COALESCE(sum(amount),0)::text FROM office_records WHERE project_id=$1 AND kind='PURCHASE' AND status IN ('APPROVED','RECEIVED')) committed",[projectId]))[0]:null;
    const documents=await m.query('SELECT id,record_id,name,mime,created_at FROM office_documents WHERE record_id=ANY($1::int[]) ORDER BY id',[records.map((r:any)=>r.id)]);
    return {access:{...a.access,label:PROFILES[a.access.profile],rights:RIGHTS[a.access.profile],views:VIEWS[a.access.profile]},projects,records,units,employees:a.access.profile==='EMPLOYEE'?employees.filter((e:any)=>e.id===user.id):employees,contractOptions:RIGHTS[a.access.profile].includes('purchase')||RIGHTS[a.access.profile].includes('invoice')?contractOptions:[],memberships,projectUnits,templates,events,documents,financial,today:today(),limits:{projects:500,records:2000}};
  }
  async projectSave(user:User,input:unknown) {
    const d=object(input,['requestId','id','revision','title','unitId','ownerId','startDate','dueDate','description','memberIds','unitIds','status']);
    return this.write(user,'projectSave',d,async(m,a)=>{
      requireRight(a.access,'project');const id=d.id==null?null:integer(d.id),previous=id?await this.project(m,a,id):null;
      if(previous)this.revision(previous,d.revision);
      const titleValue=text(d.title,'Название'),unitId=integer(d.unitId),ownerId=integer(d.ownerId),start=day(d.startDate),due=day(d.dueDate),members=ids(d.memberIds),units=ids(d.unitIds);
      if(due<start)invalid('Срок окончания раньше начала');
      if(!executive(a.user)&&(unitId!==a.access.unitId||ownerId!==user.id||previous&&previous.owner_id!==user.id))throw new ForbiddenException('Менеджер изменяет свои проекты в своём подразделении');
      const validUnits=await m.query('SELECT id FROM organization_units WHERE id=ANY($1::int[]) AND is_active',[[...new Set([unitId,...units])]]);
      if(validUnits.length!==new Set([unitId,...units]).size)invalid('Подразделение недоступно');
      const [owner]=await m.query(`SELECT u.id FROM users u LEFT JOIN office_access oa ON oa.user_id=u.id WHERE u.id=$1 AND u.is_active AND ((u.access_role_id IS NULL AND u.role IN ('ADMIN','DIRECTOR')) OR (oa.enabled AND oa.profile='PROJECT_MANAGER'))`,[ownerId]);
      if(!owner)invalid('Ответственным должен быть руководитель или менеджер проектов с рабочим доступом');
      if(members.length){const valid=await m.query(`SELECT u.id FROM users u LEFT JOIN office_access oa ON oa.user_id=u.id LEFT JOIN organization_assignments o ON o.user_id=u.id WHERE u.id=ANY($1::int[]) AND u.is_active AND (oa.enabled OR (u.access_role_id IS NULL AND u.role IN ('ADMIN','DIRECTOR'))) AND ($2::boolean OR o.unit_id=ANY($3::int[]))`,[members,executive(a.user),[unitId,...units]]);if(valid.length!==members.length)invalid('Исполнитель недоступен в подразделениях проекта');}
      const status=choice(d.status??'ACTIVE',['ACTIVE','COMPLETED','ARCHIVED']);
      if(previous&&status!=='ACTIVE'){
        const [open]=await m.query(`SELECT count(*)::int n FROM office_records WHERE project_id=$1 AND ((kind='TASK' AND status NOT IN ('DONE','CANCELLED')) OR (kind='PURCHASE' AND status='APPROVED') OR (kind='INVOICE' AND status NOT IN ('PAID','CANCELLED')))` ,[id]);
        if(open.n)invalid('Сначала завершите задачи, закупки и расчёты проекта');
      }
      let p:any;
      if(id)[[p]]=await m.query('UPDATE office_projects SET title=$2,unit_id=$3,owner_id=$4,start_date=$5,due_date=$6,description=$7,status=$8,revision=revision+1 WHERE id=$1 RETURNING *,start_date::text,due_date::text',[id,titleValue,unitId,ownerId,start,due,text(d.description,'Описание',4000,true),status]);
      else {if(status!=='ACTIVE')invalid('Новый проект должен быть активным');[p]=await m.query('INSERT INTO office_projects(code,title,unit_id,owner_id,start_date,due_date,description) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *,start_date::text,due_date::text',[await this.code(m,'PROJECT'),titleValue,unitId,ownerId,start,due,text(d.description,'Описание',4000,true)]);}
      await m.query('DELETE FROM office_project_members WHERE project_id=$1',[p.id]);
      await m.query('DELETE FROM office_project_units WHERE project_id=$1',[p.id]);
      for(const member of members)await m.query('INSERT INTO office_project_members VALUES($1,$2)',[p.id,member]);
      for(const unit of units)await m.query('INSERT INTO office_project_units VALUES($1,$2)',[p.id,unit]);
      await this.event(m,a,p.id,'PROJECT',previous?'Проект обновлён':'Проект создан',previous,{...p,memberIds:members,unitIds:units});return {...p,project_id:p.id};
    });
  }
  async templateSave(user:User,input:unknown) {
    const d=object(input,['requestId','id','revision','title','body','approve']);
    return this.write(user,'templateSave',d,async(m,a)=>{
      requireRight(a.access,'template');const id=d.id?integer(d.id):null;
      const [old]=id?await m.query('SELECT * FROM office_templates WHERE id=$1',[id]):[];
      if(id&&!old)throw new NotFoundException();if(old)this.revision(old,d.revision);
      const titleValue=text(d.title,'Название'),body=text(d.body,'Текст шаблона',40000),approve=bool(d.approve??false);
      const allowed=['number','date','counterparty','requisites','subject','amount','paymentTerms','startDate','endDate'];
      const placeholders=[...body.matchAll(/\{\{([^{}]+)\}\}/g)].map(x=>x[1]);
      if(placeholders.some(p=>!allowed.includes(p))||body.replace(/\{\{[^{}]+\}\}/g,'').includes('{{'))invalid('Неизвестный маркер шаблона');
      for(const required of ['number','counterparty','subject','amount','paymentTerms'])if(!placeholders.includes(required))invalid(`В шаблоне нужен маркер {{${required}}}`);
      let result:any;
      if(old)[[result]]=await m.query('UPDATE office_templates SET title=$2,body=$3,approved=$4,revision=revision+1,updated_by=$5,updated_at=now() WHERE id=$1 RETURNING id,title,body,approved,revision',[id,titleValue,body,approve,user.id]);
      else [result]=await m.query('INSERT INTO office_templates(title,body,approved,updated_by) VALUES($1,$2,$3,$4) RETURNING id,title,body,approved,revision',[titleValue,body,approve,user.id]);
      await this.event(m,a,null,'TEMPLATE',approve?'Шаблон утверждён':'Шаблон сохранён',old,result);return result;
    });
  }
  private async related(m:EntityManager,a:Actor,id:unknown,kind:string,projectId:number):Promise<RecordRow> {
    const r=kind==='CONTRACT'&&a.access.profile==='SUPPLY'?(await m.query("SELECT * FROM office_records WHERE id=$1 AND kind='CONTRACT'",[integer(id)]))[0]:await this.record(m,a,integer(id),kind);if(!r)throw new NotFoundException();await this.project(m,a,r.project_id);if(r.project_id!==projectId)invalid('Документы относятся к разным проектам');return r;
  }
  async recordCreate(user:User,input:unknown) {
    const d=object(input,['requestId','projectId','kind','title','data']);
    return this.write(user,'recordCreate',d,async(m,a)=>{
      const projectId=integer(d.projectId);await this.activeProject(m,a,projectId);const titleValue=text(d.title,'Название');
      const kind=choice(d.kind,['TASK','CONTRACT','BUDGET','PURCHASE','RECEIPT','INVOICE','PAYMENT']);
      const right={TASK:'plan',CONTRACT:'contract',BUDGET:'budget',PURCHASE:'purchase',RECEIPT:'receive',INVOICE:'invoice',PAYMENT:'pay'}[kind];requireRight(a.access,right);
      if(kind==='TASK'){
        const v=object(d.data,['assigneeId','dueDate','checklist','quadrant','improvement']);const assignee=integer(v.assigneeId),due=day(v.dueDate);
        const [allowed]=await m.query(`SELECT u.id FROM users u LEFT JOIN organization_assignments o ON o.user_id=u.id LEFT JOIN office_access oa ON oa.user_id=u.id WHERE u.id=$1 AND u.is_active AND (oa.enabled OR (u.access_role_id IS NULL AND u.role IN ('ADMIN','DIRECTOR'))) AND (u.id=(SELECT owner_id FROM office_projects WHERE id=$2) OR EXISTS(SELECT 1 FROM office_project_members pm WHERE pm.project_id=$2 AND pm.user_id=u.id) OR (oa.scope!='SELF' AND (o.unit_id=(SELECT unit_id FROM office_projects WHERE id=$2) OR EXISTS(SELECT 1 FROM office_project_units pu WHERE pu.project_id=$2 AND pu.unit_id=o.unit_id))))`,[assignee,projectId]);
        if(!allowed)invalid('Добавьте исполнителя в состав проекта и назначьте рабочий доступ');
        if(!Array.isArray(v.checklist)||v.checklist.length>50)invalid('Чек-лист: до 50 шагов');
        const checklist=v.checklist.map((s:unknown)=>({text:text(s,'Шаг',400),done:false}));
        return this.insert(m,a,projectId,kind,titleValue,{checklist,quadrant:choice(String(v.quadrant??2),['1','2','3','4']),improvement:text(v.improvement,'Ожидаемое улучшение',2000,true)},0,null,assignee,due,'TODO');
      }
      if(kind==='CONTRACT'){
        const v=object(d.data,['templateId','counterparty','requisites','subject','amount','paymentTerms','startDate','endDate','direction']);
        const [template]=await m.query('SELECT * FROM office_templates WHERE id=$1 AND approved',[integer(v.templateId)]);if(!template)invalid('Выберите утверждённый шаблон');
        const amount=money(v.amount),start=day(v.startDate),end=day(v.endDate);if(end<start)invalid('Срок окончания раньше начала');
        const data={counterparty:text(v.counterparty,'Контрагент'),requisites:text(v.requisites,'Реквизиты сторон',4000),subject:text(v.subject,'Предмет договора',4000),paymentTerms:text(v.paymentTerms,'Условия оплаты',4000),startDate:start,endDate:end,direction:choice(v.direction,['CUSTOMER','SUPPLIER']),templateId:template.id,templateRevision:template.revision,templateBody:template.body};
        const r=await this.insert(m,a,projectId,kind,titleValue,data,amount,null,null,end);
        const replacements:any={...data,number:r.code,date:today(),amount:(amount/100).toFixed(2)+' KZT'};
        r.data.renderedBody=template.body.replace(/\{\{([^{}]+)\}\}/g,(_:string,k:string)=>replacements[k]);
        await m.query('UPDATE office_records SET data=$2 WHERE id=$1',[r.id,JSON.stringify(r.data)]);return r;
      }
      if(kind==='BUDGET'){
        const v=object(d.data,['lines']);if(!Array.isArray(v.lines)||!v.lines.length||v.lines.length>100)invalid('Бюджет: от 1 до 100 статей');
        const lines=v.lines.map((line:unknown)=>{const l=object(line,['title','amount']);return {title:text(l.title,'Статья'),amount:money(l.amount)};});
        const total=lines.reduce((sum:number,l:any)=>sum+l.amount,0);if(total>9000000000000)invalid('Слишком большой бюджет');
        return this.insert(m,a,projectId,kind,titleValue,{lines},total);
      }
      if(kind==='PURCHASE'){
        const v=object(d.data,['amount','supplier','purpose','dueDate','contractId']);
        let contract:RecordRow|null=null;if(v.contractId!=null){contract=await this.related(m,a,v.contractId,'CONTRACT',projectId);if(contract.status!=='SIGNED'||contract.data.direction!=='SUPPLIER')invalid('Нужен подписанный договор с поставщиком');}
        return this.insert(m,a,projectId,kind,titleValue,{supplier:text(v.supplier,'Поставщик'),purpose:text(v.purpose,'Основание',2000),contractId:contract?.id??null},money(v.amount),null,null,day(v.dueDate));
      }
      if(kind==='RECEIPT'){
        const v=object(d.data,['purchaseId','amount','date','note']);const purchase=await this.related(m,a,v.purchaseId,'PURCHASE',projectId);
        if(purchase.status!=='APPROVED')invalid('Закупка должна быть согласована');const amount=money(v.amount),date=day(v.date);if(date>today())invalid('Приёмка не может быть в будущем');
        const [total]=await m.query("SELECT COALESCE(sum(amount),0)::text amount FROM office_records WHERE parent_id=$1 AND kind='RECEIPT' AND status='RECORDED'",[purchase.id]);
        if(Number(total.amount)+amount>Number(purchase.amount))invalid('Приёмка превышает сумму закупки');
        const r=await this.insert(m,a,projectId,kind,titleValue,{date,note:text(v.note,'Результат приёмки',2000)},amount,purchase.id,null,date,'RECORDED');
        if(Number(total.amount)+amount===Number(purchase.amount))await this.save(m,a,purchase,'RECEIVED');return r;
      }
      if(kind==='INVOICE'){
        const v=object(d.data,['direction','amount','contractId','purchaseId','externalNumber','counterparty','requisites','issueDate','dueDate','advance','advanceReason']);
        const direction=choice(v.direction,['IN','OUT']),amount=money(v.amount),contract=await this.related(m,a,v.contractId,'CONTRACT',projectId);
        if(contract.status!=='SIGNED'||contract.data.direction!==(direction==='IN'?'SUPPLIER':'CUSTOMER'))invalid('Выберите подписанный договор соответствующего вида');
        let purchase:RecordRow|null=null;
        if(direction==='IN'){
          purchase=await this.related(m,a,v.purchaseId,'PURCHASE',projectId);
          if(!['APPROVED','RECEIVED'].includes(purchase.status)||purchase.data.contractId!==contract.id)invalid('Закупка должна быть согласована и связана с этим договором');
          if(text(v.counterparty,'Контрагент')!==purchase.data.supplier||v.counterparty!==contract.data.counterparty)invalid('Контрагент должен совпадать в договоре, закупке и счёте');
        } else if(v.purchaseId!=null)invalid('Исходящий счёт не связан с закупкой');
        const [used]=await m.query(`SELECT COALESCE(sum(amount),0)::text amount FROM office_records WHERE kind='INVOICE' AND status!='CANCELLED' AND data->>'contractId'=$1`,[String(contract.id)]);
        if(Number(used.amount)+amount>Number(contract.amount))invalid('Счета превышают сумму договора');
        if(purchase){const [sum]=await m.query("SELECT COALESCE(sum(amount),0)::text amount FROM office_records WHERE kind='INVOICE' AND parent_id=$1 AND status!='CANCELLED'",[purchase.id]);if(Number(sum.amount)+amount>Number(purchase.amount))invalid('Счета превышают сумму закупки');}
        const externalNumber=text(v.externalNumber,'Номер счёта поставщика',120,direction==='OUT');
        if(direction==='IN'){const [duplicate]=await m.query("SELECT id FROM office_records WHERE kind='INVOICE' AND data->>'direction'='IN' AND data->>'externalNumber'=$1 AND data->>'counterparty'=$2 AND status!='CANCELLED'",[externalNumber,contract.data.counterparty]);if(duplicate)throw new ConflictException('Счёт этого поставщика с таким номером уже зарегистрирован');}
        const issue=day(v.issueDate),due=day(v.dueDate);if(due<issue)invalid('Срок оплаты раньше даты счёта');
        const advance=bool(v.advance??false);if(advance&&direction!=='IN')invalid('Аванс доступен для входящего счёта');
        return this.insert(m,a,projectId,kind,titleValue,{direction,contractId:contract.id,externalNumber,counterparty:contract.data.counterparty,requisites:text(v.requisites,'Реквизиты',4000),issueDate:issue,advance,advanceReason:text(v.advanceReason,'Основание аванса по договору',2000,!advance)},amount,purchase?.id??null,null,due);
      }
      const v=object(d.data,['invoiceId','amount','date','reference']);const invoice=await this.related(m,a,v.invoiceId,'INVOICE',projectId);
      if(invoice.status!=='APPROVED')invalid('Оплату можно учесть только по согласованному счёту');
      const amount=money(v.amount),date=day(v.date),reference=text(v.reference,'Номер платёжного документа',240);
      if(date>today()||date<invoice.data.issueDate)invalid('Дата оплаты должна быть между датой счёта и сегодняшним днём');
      const [duplicate]=await m.query("SELECT id FROM office_records WHERE kind='PAYMENT' AND status='RECORDED' AND data->>'reference'=$1 AND data->>'date'=$2",[reference,date]);if(duplicate)throw new ConflictException('Этот платёжный документ уже учтён');
      const [paid]=await m.query("SELECT COALESCE(sum(amount),0)::text amount FROM office_records WHERE parent_id=$1 AND kind='PAYMENT' AND status='RECORDED'",[invoice.id]);
      if(Number(paid.amount)+amount>Number(invoice.amount))invalid('Оплата превышает остаток счёта');
      const r=await this.insert(m,a,projectId,kind,titleValue,{date,reference,direction:invoice.data.direction},amount,invoice.id,null,date,'RECORDED');
      if(Number(paid.amount)+amount===Number(invoice.amount))await this.save(m,a,invoice,'PAID');return r;
    });
  }
  async recordAction(user:User,input:unknown) {
    const d=object(input,['requestId','id','revision','action','note','checked']);
    return this.write(user,'recordAction',d,async(m,a)=>{
      const r=await this.record(m,a,integer(d.id));this.revision(r,d.revision);
      const action=text(d.action,'Действие',40),note=text(d.note,'Комментарий',2000,true);
      if(action!=='VOID')await this.activeProject(m,a,r.project_id);
      if(r.kind==='TASK'){
        if(action==='CHECK'||action==='START'||action==='SUBMIT'){
          requireRight(a.access,'work');if(r.assignee_id!==user.id&&!executive(a.user))throw new ForbiddenException('Выполняет назначенный исполнитель');
          if(!['TODO','IN_PROGRESS','REWORK'].includes(r.status))invalid('Задача уже передана на проверку');
          const data={...r.data};
          if(action==='CHECK'){
            if(!Array.isArray(d.checked)||d.checked.length!==data.checklist.length||d.checked.some((v:unknown)=>typeof v!=='boolean'))invalid('Заполните все пункты чек-листа');
            data.checklist=data.checklist.map((s:any,i:number)=>({...s,done:d.checked[i]}));
          }
          if(action==='SUBMIT'){
            if(data.checklist.some((s:any)=>!s.done))invalid('Сначала выполните чек-лист');
            data.result=text(d.note,'Результат выполнения',2000);
          }
          return this.save(m,a,r,action==='SUBMIT'?'SUBMITTED':'IN_PROGRESS',data);
        }
        if(action==='ACCEPT'||action==='REWORK'){
          requireRight(a.access,'quality');if(r.status!=='SUBMITTED')invalid('Задача ещё не предъявлена к приёмке');
          if(r.assignee_id===user.id&&!executive(a.user))throw new ForbiddenException('Принимает другой сотрудник');
          return this.save(m,a,r,action==='ACCEPT'?'DONE':'REWORK',{...r.data,review:text(d.note,'Результат проверки',2000),reviewerId:user.id});
        }
        if(action==='CANCEL'){requireRight(a.access,'plan');if(['DONE','CANCELLED'].includes(r.status))invalid('Задача уже закрыта');return this.save(m,a,r,'CANCELLED',{...r.data,note:text(d.note,'Причина отмены',2000)});}
      }
      if(action==='SUBMIT'&&['CONTRACT','BUDGET','PURCHASE','INVOICE'].includes(r.kind)){
        requireRight(a.access,({CONTRACT:'contract',BUDGET:'budget',PURCHASE:'purchase',INVOICE:'invoice'} as Record<string,string>)[r.kind]);
        if(r.status!=='DRAFT')invalid('Можно отправить только черновик');return this.save(m,a,r,'SUBMITTED');
      }
      if(action==='APPROVE'&&['BUDGET','PURCHASE','INVOICE'].includes(r.kind)){
        requireRight(a.access,'approve');if(r.status!=='SUBMITTED')invalid('Документ ещё не отправлен на согласование');
        if(r.created_by===user.id&&!executive(a.user))throw new ForbiddenException('Согласование выполняет другой сотрудник');
        if(r.created_by===user.id&&!note)invalid('Укажите основание согласования своего документа руководителем');
        if(r.kind==='BUDGET'){
          const [committed]=await m.query("SELECT COALESCE(sum(amount),0)::text amount FROM office_records WHERE project_id=$1 AND kind='PURCHASE' AND status IN ('APPROVED','RECEIVED')",[r.project_id]);
          if(Number(r.amount)<Number(committed.amount))invalid('Бюджет меньше уже согласованных обязательств');
          const old=await m.query("SELECT * FROM office_records WHERE project_id=$1 AND kind='BUDGET' AND status='APPROVED'",[r.project_id]);
          for(const prior of old)await this.save(m,a,prior,'SUPERSEDED',{...prior.data,replacedBy:r.id});
        }
        if(r.kind==='PURCHASE'){
          const [budget]=await m.query("SELECT amount FROM office_records WHERE project_id=$1 AND kind='BUDGET' AND status='APPROVED'",[r.project_id]);
          const [committed]=await m.query("SELECT COALESCE(sum(amount),0)::text amount FROM office_records WHERE project_id=$1 AND kind='PURCHASE' AND status IN ('APPROVED','RECEIVED')",[r.project_id]);
          if(!budget||Number(committed.amount)+Number(r.amount)>Number(budget.amount))invalid('Недостаточно свободного утверждённого бюджета');
          if(!r.data.contractId)invalid('Для согласования закупки нужен подписанный договор. Создайте новую заявку с договором.');
          const contract=await this.related(m,a,r.data.contractId,'CONTRACT',r.project_id);
          if(contract.status!=='SIGNED'||contract.data.counterparty!==r.data.supplier)invalid('Договор и поставщик закупки должны совпадать');
          const [contractUsed]=await m.query("SELECT COALESCE(sum(amount),0)::text amount FROM office_records WHERE kind='PURCHASE' AND status IN ('APPROVED','RECEIVED') AND data->>'contractId'=$1",[String(contract.id)]);
          if(Number(contractUsed.amount)+Number(r.amount)>Number(contract.amount))invalid('Закупки превышают сумму договора');
        }
        if(r.kind==='INVOICE'){
          const contract=await this.related(m,a,r.data.contractId,'CONTRACT',r.project_id);if(contract.status!=='SIGNED')invalid('Договор не действует');
          if(r.data.direction==='IN'){
            const purchase=await this.related(m,a,r.parent_id,'PURCHASE',r.project_id);if(!['APPROVED','RECEIVED'].includes(purchase.status))invalid('Закупка не согласована');
            if(!r.data.advance){
              const [received]=await m.query("SELECT COALESCE(sum(amount),0)::text amount FROM office_records WHERE parent_id=$1 AND kind='RECEIPT' AND status='RECORDED'",[purchase.id]);
              const [previous]=await m.query("SELECT COALESCE(sum(amount),0)::text amount FROM office_records WHERE parent_id=$1 AND kind='INVOICE' AND status IN ('APPROVED','PAID')",[purchase.id]);
              if(Number(previous.amount)+Number(r.amount)>Number(received.amount))invalid('Счёт превышает подтверждённую приёмку. Аванс оформляется отдельно с основанием по договору.');
            } else if(!note)invalid('Подтвердите основание аванса комментарием');
          } else {
            const [accepted]=await m.query("SELECT id FROM office_records WHERE project_id=$1 AND kind='TASK' AND status='DONE' LIMIT 1",[r.project_id]);
            if(!accepted)invalid('Для исходящего счёта сначала примите выполненный этап проекта');
          }
        }
        return this.save(m,a,r,'APPROVED',{...r.data,approvedBy:user.id,approvalNote:note,approvedAt:new Date().toISOString()});
      }
      if(action==='SIGN'&&r.kind==='CONTRACT'){
        requireRight(a.access,'sign');if(r.status!=='SUBMITTED')invalid('Сначала отправьте договор на проверку');
        const [file]=await m.query('SELECT id FROM office_documents WHERE record_id=$1 LIMIT 1',[r.id]);if(!file)invalid('Прикрепите подписанный договор');
        return this.save(m,a,r,'SIGNED',{...r.data,signedBy:user.id,signedAt:new Date().toISOString(),note:text(d.note,'Основание регистрации подписания',2000)});
      }
      if(action==='REJECT'&&['CONTRACT','BUDGET','PURCHASE','INVOICE'].includes(r.kind)){
        requireRight(a.access,r.kind==='CONTRACT'?'sign':'approve');if(r.status!=='SUBMITTED')invalid('Документ не на согласовании');
        return this.save(m,a,r,'DRAFT',{...r.data,rejection:text(d.note,'Причина возврата',2000)});
      }
      if(action==='CANCEL'&&['CONTRACT','BUDGET','PURCHASE','INVOICE'].includes(r.kind)){
        requireRight(a.access,({CONTRACT:'contract',BUDGET:'budget',PURCHASE:'purchase',INVOICE:'invoice'} as Record<string,string>)[r.kind]);
        if(!['DRAFT','SUBMITTED','SIGNED','APPROVED'].includes(r.status)||r.kind==='BUDGET'&&r.status==='APPROVED')invalid('Этот документ нельзя отменить');
        if(['SIGNED','APPROVED'].includes(r.status)&&!executive(a.user))throw new ForbiddenException('Утверждённый документ отменяет руководитель');
        const [linked]=await m.query("SELECT id FROM office_records WHERE (parent_id=$1 OR data->>'contractId'=$2) AND status NOT IN ('CANCELLED','VOID') LIMIT 1",[r.id,String(r.id)]);
        if(linked)invalid('Сначала урегулируйте связанные документы');
        return this.save(m,a,r,'CANCELLED',{...r.data,cancellation:text(d.note,'Причина отмены',2000)});
      }
      if(action==='VOID'&&['PAYMENT','RECEIPT'].includes(r.kind)){
        requireRight(a.access,'reverse');if(r.status!=='RECORDED')invalid('Запись уже сторнирована');
        if(r.kind==='RECEIPT'){
          const [approved]=await m.query("SELECT id FROM office_records WHERE parent_id=$1 AND kind='INVOICE' AND status IN ('APPROVED','PAID') LIMIT 1",[r.parent_id]);if(approved)invalid('Приёмка связана с согласованным счётом. Сначала урегулируйте расчёты.');
        }
        const parent=await this.record(m,a,r.parent_id!);
        const result=await this.save(m,a,r,'VOID',{...r.data,voidReason:text(d.note,'Причина сторно',2000)});
        if(parent.status==='PAID'||parent.status==='RECEIVED')await this.save(m,a,parent,'APPROVED');return result;
      }
      invalid('Переход статуса недоступен');
    });
  }
  async upload(user:User,id:number,file:Express.Multer.File|undefined) {
    if(!file?.buffer||file.size>10*1024*1024||!file.size)invalid('Загрузите PDF, JPEG или PNG до 10 МБ');
    const b=file.buffer;let mime='';
    if(b.subarray(0,5).toString()==='%PDF-')mime='application/pdf';
    else if(b[0]===255&&b[1]===216&&b[2]===255)mime='image/jpeg';
    else if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
    else invalid('Разрешены PDF, JPEG и PNG');
    return this.db.transaction(async m=>{
      await m.query('SELECT pg_advisory_xact_lock(1733600000)');const a=await this.actor(m,user);
      if(a.user.accessRoleId!=null&&!a.user.accessPolicy?.permissions?.includes('office.upload'))throw new ForbiddenException();
      const r=await this.record(m,a,id);await this.activeProject(m,a,r.project_id);
      if(!['CONTRACT','INVOICE'].includes(r.kind))invalid('Вложение доступно для договора или счёта');requireRight(a.access,r.kind==='CONTRACT'?'contract':'invoice');
      if(!['DRAFT','SUBMITTED'].includes(r.status))invalid('Вложения утверждённого документа неизменяемы');
      const [count]=await m.query('SELECT count(*)::int n FROM office_documents WHERE record_id=$1',[id]);if(count.n>=10)invalid('Не более 10 вложений на документ');
      const name=text(file.originalname.replace(/[\\/\x00-\x1f\x7f]/g,'_'),'Имя файла',240);
      const [saved]=await m.query('INSERT INTO office_documents(record_id,name,mime,content,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id,record_id,name,mime',[id,name,mime,b,user.id]);
      await this.event(m,a,r.project_id,r.kind,'Добавлен документ',null,saved,r.id);return saved;
    });
  }
  async download(user:User,id:number) {
    const a=await this.actor(this.db.manager,user),[meta]=await this.db.query('SELECT record_id FROM office_documents WHERE id=$1',[id]);
    if(!meta)throw new NotFoundException();await this.record(this.db.manager,a,meta.record_id);
    const [file]=await this.db.query('SELECT name,mime,content FROM office_documents WHERE id=$1',[id]);return file;
  }
  async print(user:User,id:number) {
    const a=await this.actor(this.db.manager,user),r=await this.record(this.db.manager,a,id);
    if(!['CONTRACT','INVOICE'].includes(r.kind))invalid('Печатная форма доступна для договора и счёта');
    const body=r.kind==='CONTRACT'?r.data.renderedBody:
      `СЧЁТ НА ОПЛАТУ ${r.code}\nДата: ${r.data.issueDate}\nКонтрагент: ${r.data.counterparty}\nРеквизиты: ${r.data.requisites}\nОснование: ${r.title}\nСумма: ${(Number(r.amount)/100).toFixed(2)} KZT\nОплатить до: ${r.due_date}\n${r.data.externalNumber?'Номер поставщика: '+r.data.externalNumber:''}`;
    return `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(r.code)}</title><style>body{font:16px/1.6 Arial;margin:40px}pre{white-space:pre-wrap;font:inherit}small{color:#555}</style><small>GP Work · ${escapeHtml(r.status)} · ${r.kind==='CONTRACT'?'Печатный текст; подписанный оригинал хранится во вложениях.':'Учётная форма счёта. Не электронная счёт-фактура.'}</small><h1>${escapeHtml(r.code)}</h1><pre>${escapeHtml(body)}</pre></html>`;
  }
  private async admin(m:EntityManager,user:User) {const a=await this.actor(m,user);if(!executive(a.user))throw new ForbiddenException('Рабочие доступы назначает руководитель или администратор');return a;}
  async accessList(user:User) {
    await this.admin(this.db.manager,user);
    const users=await this.db.query(`SELECT u.id,u.full_name,u.username,u.role,u.access_role_id,u.is_active,u.position_id,
      a.profile,a.scope,a.enabled,COALESCE(a.revision,0) revision,o.unit_id,COALESCE(o.revision,0) organization_revision,u.must_change_password
      FROM users u LEFT JOIN office_access a ON a.user_id=u.id LEFT JOIN organization_assignments o ON o.user_id=u.id ORDER BY u.full_name`);
    const units=await this.db.query('SELECT id,name FROM organization_units WHERE is_active ORDER BY name');
    const positions=await this.db.query('SELECT id,name FROM job_positions WHERE is_active ORDER BY name');
    return {users,units,positions,profiles:Object.fromEntries(Object.entries(PROFILES).filter(([key])=>key!=='EXECUTIVE'))};
  }
  async accessSave(user:User,input:unknown) {
    const d=object(input,['userId','revision','organizationRevision','unitId','profile','scope','enabled']);
    return this.db.transaction(async m=>{
      await m.query('SELECT pg_advisory_xact_lock(1733600000)');await m.query('SELECT pg_advisory_xact_lock(1733500000)');const a=await this.admin(m,user);
      const target=await m.getRepository(User).findOneBy({id:integer(d.userId)});if(!target)throw new NotFoundException();
      if(executive(target)||[UserRole.AKIMAT,UserRole.ANTICOR].includes(target.role))invalid('Этот тип аккаунта не переводится в рабочий профиль');
      if(target.accessRoleId!=null){const p=await resolveAccessRole(m,target);if(!p?.pages.includes('/office')||!p.permissions?.includes('office.me')||!p.permissions?.includes('office.workspace'))invalid('Сначала разрешите странице /office и чтение рабочего кабинета в роли доступа сотрудника');}
      const [previous]=await m.query('SELECT * FROM office_access WHERE user_id=$1',[target.id]);this.revision(previous??{revision:0},d.revision);
      const [assignment]=await m.query('SELECT * FROM organization_assignments WHERE user_id=$1',[target.id]);this.revision(assignment??{revision:0},d.organizationRevision);
      const unitId=integer(d.unitId),[unit]=await m.query('SELECT id FROM organization_units WHERE id=$1 AND is_active',[unitId]);if(!unit)invalid('Подразделение недоступно');
      const profile=choice(d.profile,Object.keys(PROFILES).filter(p=>p!=='EXECUTIVE') as Profile[]),scope=choice(d.scope,['SELF','DEPARTMENT','COMPANY']),enabled=bool(d.enabled);
      if(profile==='EMPLOYEE'&&scope!=='SELF')invalid('Исполнителю доступны только назначенные проекты и задачи');
      const [result]=await m.query(`INSERT INTO office_access(user_id,profile,scope,enabled,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET profile=$2,scope=$3,enabled=$4,updated_by=$5,revision=office_access.revision+1,updated_at=now() RETURNING *`,[target.id,profile,scope,enabled,user.id]);
      const [org]=await m.query(`INSERT INTO organization_assignments(user_id,unit_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET unit_id=$2,revision=organization_assignments.revision+1,updated_at=now() RETURNING *`,[target.id,unitId]);
      await m.query('INSERT INTO organization_history(actor_id,kind,target_id,label,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)',[user.id,'EMPLOYEE',target.id,target.fullName,assignment?JSON.stringify(assignment):null,JSON.stringify(org)]);
      await this.event(m,a,null,'ACCESS','Рабочий доступ изменён',previous,{...result,unitId});return {...result,unitId};
    });
  }
  async provision(user:User,input:unknown) {
    const d=object(input,['fullName','unitId','positionId','profile','scope']);
    const fullName=text(d.fullName,'ФИО'),unitId=integer(d.unitId),positionId=d.positionId==null?null:integer(d.positionId);
    const profile=choice(d.profile,Object.keys(PROFILES).filter(p=>p!=='EXECUTIVE') as Profile[]),scope=choice(d.scope,['SELF','DEPARTMENT','COMPANY']);
    if(profile==='EMPLOYEE'&&scope!=='SELF')invalid('Исполнителю назначается личный доступ');
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const password=Array.from(randomBytes(16),n=>alphabet[n%alphabet.length]).join(''),username='GP-'+randomBytes(6).toString('hex').toUpperCase();
    const hash=await bcrypt.hash(password,10),expiresAt=new Date(Date.now()+86400000);
    return this.db.transaction(async m=>{
      await m.query('SELECT pg_advisory_xact_lock(1733600000)');await m.query('SELECT pg_advisory_xact_lock(1733500000)');const a=await this.admin(m,user);
      const [unit]=await m.query('SELECT id FROM organization_units WHERE id=$1 AND is_active',[unitId]);if(!unit)invalid('Подразделение недоступно');
      if(positionId){const [position]=await m.query('SELECT id FROM job_positions WHERE id=$1 AND is_active',[positionId]);if(!position)invalid('Должность недоступна');}
      const u=await m.getRepository(User).save(m.getRepository(User).create({fullName,username,passwordHash:hash,role:UserRole.WORKER,accessRoleId:null,positionId,brigadeId:null,isActive:true,mustChangePassword:true,passwordResetAt:new Date(),passwordResetExpiresAt:expiresAt,passwordResetById:user.id,authVersion:0}));
      await m.query('INSERT INTO organization_assignments(user_id,unit_id) VALUES($1,$2)',[u.id,unitId]);
      await m.query('INSERT INTO office_access(user_id,profile,scope,updated_by) VALUES($1,$2,$3,$4)',[u.id,profile,scope,user.id]);
      await this.event(m,a,null,'ACCESS','Создан личный рабочий аккаунт',null,{userId:u.id,fullName,unitId,profile,scope});
      await m.query('INSERT INTO organization_history(actor_id,kind,target_id,label,after_data) VALUES($1,$2,$3,$4,$5)',[user.id,'EMPLOYEE',u.id,fullName,JSON.stringify({user_id:u.id,unit_id:unitId,revision:1})]);
      return {userId:u.id,fullName,username,temporaryPassword:password,expiresAt:expiresAt.toISOString()};
    });
  }
}
