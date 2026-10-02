import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AssignmentDto, ProcessOwnerDto, UnitDto } from './organization.dto';

const unitsSql = `SELECT n.*, p.name parent_name, h.full_name head_name, h.is_active head_active,
  o.name object_name, b.name brigade_name FROM organization_units n
  LEFT JOIN organization_units p ON p.id=n.parent_id LEFT JOIN users h ON h.id=n.head_user_id
  LEFT JOIN objects o ON o.id=n.object_id LEFT JOIN brigades b ON b.id=n.brigade_id`;
const peopleSql = `SELECT u.id user_id,u.full_name,u.is_active,u.position_id,p.name position_name,p.is_active position_active,
  u.brigade_id,b.name brigade_name,a.unit_id,n.name unit_name,a.manager_id,m.full_name manager_name,m.is_active manager_active,
  COALESCE(a.duties,'') duties,COALESCE(a.revision,0) revision
  FROM users u LEFT JOIN job_positions p ON p.id=u.position_id LEFT JOIN brigades b ON b.id=u.brigade_id
  LEFT JOIN organization_assignments a ON a.user_id=u.id LEFT JOIN organization_units n ON n.id=a.unit_id
  LEFT JOIN users m ON m.id=a.manager_id`;
const processesSql = `SELECT p.id process_id,p.archived,d.schema->>'title' title,a.unit_id,n.name unit_name,
  a.owner_user_id,u.full_name owner_name,u.is_active owner_active,COALESCE(a.revision,0) revision
  FROM business_processes p JOIN LATERAL (SELECT schema FROM business_process_definitions
    WHERE process_id=p.id ORDER BY version DESC LIMIT 1) d ON true
  LEFT JOIN organization_process_owners a ON a.process_id=p.id
  LEFT JOIN organization_units n ON n.id=a.unit_id LEFT JOIN users u ON u.id=a.owner_user_id`;

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DataSource) {}

  async overview() {
    // One snapshot: selectors, hierarchy and membership cannot describe different revisions.
    return this.db.transaction('REPEATABLE READ', async q => ({
      units: await q.query(`${unitsSql} ORDER BY n.id`),
      employees: await q.query(`${peopleSql} ORDER BY u.is_active DESC,u.full_name,u.id`),
      processes: await q.query(`${processesSql} ORDER BY p.archived,p.id`),
      objects: await q.query('SELECT id,name,is_active FROM objects ORDER BY name,id'),
      brigades: await q.query('SELECT id,name,is_active FROM brigades ORDER BY name,id'),
    }));
  }
  async history(before?: number) {
    const rows = await this.db.query(`SELECT h.*,u.full_name actor_name FROM organization_history h
      LEFT JOIN users u ON u.id=h.actor_id WHERE ($1::int IS NULL OR h.id<$1) ORDER BY h.id DESC LIMIT 51`, [before ?? null]);
    return { items: rows.slice(0,50), next: rows.length > 50 ? rows[49].id : null };
  }
  private revision(actual: number, expected: number) {
    if (actual !== expected) throw new ConflictException('Запись уже изменена. Обновите структуру и повторите изменение');
  }
  private async lock(q: EntityManager) {
    // Hierarchies need a common lock, including absent assignment rows. Two parallel
    // A->B / B->A saves must never each validate against the previous graph.
    await q.query('SELECT pg_advisory_xact_lock(1733500000)');
  }
  private async active(q: EntityManager, table: 'users'|'organization_units'|'objects'|'brigades', id: number|null, previous: number|null, label: string) {
    if (id == null) return;
    const [row] = await q.query(`SELECT id,is_active FROM ${table} WHERE id=$1 FOR SHARE`, [id]);
    if (!row || (!row.is_active && id !== previous)) throw new BadRequestException(`Выберите действующую запись: ${label}`);
  }
  private async audit(q: EntityManager, actor: number, kind: string, id: number, label: string, before: unknown, after: unknown) {
    await q.query(`INSERT INTO organization_history(actor_id,kind,target_id,label,before_data,after_data)
      VALUES($1,$2,$3,$4,$5,$6)`, [actor,kind,id,label,before == null ? null : JSON.stringify(before),JSON.stringify(after)]);
  }
  private assertTree(id: number, parent: number|null, nodes: {id:number; parent_id:number|null}[]) {
    const links = new Map(nodes.map(n => [n.id,n.parent_id]));
    const visited = new Set<number>([id]);
    let cursor = parent;
    while (cursor != null) {
      if (visited.has(cursor)) throw new BadRequestException('Подчинение по кругу недопустимо');
      visited.add(cursor);
      cursor = links.get(cursor) ?? null;
    }
  }
  async saveUnit(id: number|null, dto: UnitDto, actor: number) {
    return this.db.transaction(async q => {
      await this.lock(q);
      const [before] = id == null ? [] : await q.query(`${unitsSql} WHERE n.id=$1`, [id]);
      if (id != null && !before) throw new NotFoundException('Подразделение не найдено');
      this.revision(before?.revision ?? 0,dto.revision);
      await this.active(q,'organization_units',dto.parentId,null,'вышестоящее подразделение');
      await this.active(q,'users',dto.headUserId,before?.head_user_id ?? null,'руководитель');
      await this.active(q,'objects',dto.objectId,before?.object_id ?? null,'объект');
      await this.active(q,'brigades',dto.brigadeId,before?.brigade_id ?? null,'бригада');
      if (id != null) this.assertTree(id,dto.parentId,await q.query('SELECT id,parent_id FROM organization_units'));
      const [duplicate] = await q.query(`SELECT id FROM organization_units WHERE COALESCE(parent_id,0)=COALESCE($1::int,0)
        AND lower(name)=lower($2) AND ($3::int IS NULL OR id<>$3)`, [dto.parentId,dto.name,id]);
      if (duplicate) throw new ConflictException('В этой ветке уже есть подразделение с таким названием, включая архив');
      if (before?.is_active && !dto.isActive) {
        const [used] = await q.query(`SELECT
          EXISTS(SELECT 1 FROM organization_units WHERE parent_id=$1 AND is_active) OR
          EXISTS(SELECT 1 FROM organization_assignments WHERE unit_id=$1) OR
          EXISTS(SELECT 1 FROM organization_process_owners WHERE unit_id=$1) used`, [id]);
        if (used.used) throw new BadRequestException('Перед архивированием переведите сотрудников, процессы и действующие подразделения');
      }
      if (!dto.isActive && id == null) throw new BadRequestException('Создайте действующее подразделение');
      const values = [dto.name,dto.kind,dto.parentId,dto.headUserId,dto.objectId,dto.brigadeId,dto.purpose,dto.isActive];
      if (id == null) {
        const [created] = await q.query(`INSERT INTO organization_units(name,kind,parent_id,head_user_id,object_id,brigade_id,purpose,is_active)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, values);
        id = created.id;
      } else {
        await q.query(`UPDATE organization_units SET name=$1,kind=$2,parent_id=$3,head_user_id=$4,object_id=$5,
          brigade_id=$6,purpose=$7,is_active=$8,revision=revision+1,updated_at=now() WHERE id=$9`, [...values,id]);
      }
      const [after] = await q.query(`${unitsSql} WHERE n.id=$1`, [id]);
      await this.audit(q,actor,'UNIT',id!,`${before ? 'Изменение' : 'Создание'} подразделения: ${after.name}`,before,after);
      return after;
    });
  }
  async assign(id: number, dto: AssignmentDto, actor: number) {
    return this.db.transaction(async q => {
      await this.lock(q);
      const [employee] = await q.query('SELECT id,is_active FROM users WHERE id=$1 FOR SHARE',[id]);
      if (!employee) throw new NotFoundException('Сотрудник не найден');
      const [before] = await q.query(`${peopleSql} WHERE u.id=$1`,[id]);
      this.revision(before.revision,dto.revision);
      if (!employee.is_active && (dto.unitId !== null || dto.managerId !== null)) throw new BadRequestException('Для отключённого сотрудника можно только снять назначение');
      await this.active(q,'organization_units',dto.unitId,before.unit_id,'подразделение');
      await this.active(q,'users',dto.managerId,before.manager_id,'прямой руководитель');
      this.assertTree(id,dto.managerId,await q.query('SELECT user_id id,manager_id parent_id FROM organization_assignments'));
      await q.query(`INSERT INTO organization_assignments(user_id,unit_id,manager_id,duties) VALUES($1,$2,$3,$4)
        ON CONFLICT(user_id) DO UPDATE SET unit_id=EXCLUDED.unit_id,manager_id=EXCLUDED.manager_id,duties=EXCLUDED.duties,
        revision=organization_assignments.revision+1,updated_at=now()`, [id,dto.unitId,dto.managerId,dto.duties]);
      const [after] = await q.query(`${peopleSql} WHERE u.id=$1`,[id]);
      await this.audit(q,actor,'EMPLOYEE',id,`Назначение сотрудника: ${after.full_name}`,before,after);
      return after;
    });
  }
  async assignProcess(id: number, dto: ProcessOwnerDto, actor: number) {
    return this.db.transaction(async q => {
      await this.lock(q);
      const [process] = await q.query('SELECT id,archived FROM business_processes WHERE id=$1 FOR SHARE',[id]);
      if (!process) throw new NotFoundException('Процесс не найден');
      const [before] = await q.query(`${processesSql} WHERE p.id=$1`,[id]);
      if (!before) throw new BadRequestException('Сначала опубликуйте процесс');
      this.revision(before.revision,dto.revision);
      if (process.archived && (dto.unitId !== null || dto.ownerUserId !== null)) throw new BadRequestException('Для архивного процесса можно только снять ответственность');
      await this.active(q,'organization_units',dto.unitId,before.unit_id,'подразделение');
      await this.active(q,'users',dto.ownerUserId,before.owner_user_id,'владелец процесса');
      await q.query(`INSERT INTO organization_process_owners(process_id,unit_id,owner_user_id) VALUES($1,$2,$3)
        ON CONFLICT(process_id) DO UPDATE SET unit_id=EXCLUDED.unit_id,owner_user_id=EXCLUDED.owner_user_id,
        revision=organization_process_owners.revision+1,updated_at=now()`, [id,dto.unitId,dto.ownerUserId]);
      const [after] = await q.query(`${processesSql} WHERE p.id=$1`,[id]);
      await this.audit(q,actor,'PROCESS',id,`Ответственность за процесс: ${after.title}`,before,after);
      return after;
    });
  }
}
