import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { AccessRole } from '../../entities/access-role.entity';
import { User } from '../../entities/user.entity';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { lockBrigadeMembership } from '../../common/brigade-membership';
import { nonDelegable, operationInfo, PAGE_NAMES, pageAllowed, roleAllowed } from './access-policy';
import { SaveAccessRoleDto } from './access-roles.dto';

@Injectable()
export class AccessRolesService {
  constructor(private readonly db: DataSource, private readonly discovery: DiscoveryService, private readonly reflector: Reflector) {}
  list() { return this.db.getRepository(AccessRole).find({order:{id:'ASC'}}); }
  catalog() {
    const operations: Array<ReturnType<typeof operationInfo> & {roles:UserRole[]}> = [];
    for (const wrapper of this.discovery.getControllers()) {
      const cls = wrapper.metatype;
      if (!cls?.prototype) continue;
      for (const name of Object.getOwnPropertyNames(cls.prototype)) {
        if (name === 'constructor') continue;
        const handler = cls.prototype[name];
        if (typeof handler !== 'function') continue;
        const info = operationInfo(cls, handler);
        if (info.method === undefined || !info.section || nonDelegable(info.resource,name)) continue;
        if (this.reflector.getAllAndOverride(IS_PUBLIC_KEY,[handler,cls])) continue;
        const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY,[handler,cls]);
        operations.push({...info, roles:Object.values(UserRole).filter(role=>roleAllowed(role,required))});
      }
    }
    return { operations, pages:PAGE_NAMES, pageRoles:Object.fromEntries(Object.keys(PAGE_NAMES).map(path=>[path,Object.values(UserRole).filter(role=>pageAllowed(role,path))])) };
  }
  async save(dto: SaveAccessRoleDto, id?: number) {
    const catalog = this.catalog();
    const valid = new Set(catalog.operations.filter(op=>op.roles.includes(dto.baseRole)).map(op=>op.key));
    if (dto.permissions.some(key=>!valid.has(key)) || dto.pages.some(path=>!Object.prototype.hasOwnProperty.call(PAGE_NAMES,path)||!pageAllowed(dto.baseRole,path))) {
      throw new BadRequestException('Недопустимое разрешение или раздел для выбранного типа роли');
    }
    try {
      return await this.db.transaction(async manager=>{
        await lockBrigadeMembership(manager);
        const repo=manager.getRepository(AccessRole);
        const row=id ? await repo.findOneBy({id}) : repo.create({systemKey:null});
        if (!row) throw new NotFoundException('Роль не найдена');
        if (id && dto.revision !== row.revision) throw new ConflictException('Роль уже изменена. Обновите список и повторите.');
        if (id && dto.baseRole !== row.baseRole) throw new BadRequestException('Тип существующей роли менять нельзя. Создайте новую роль.');
        if (row.systemKey && (dto.name!==row.name || !dto.isActive || dto.permissions.length || dto.pages.length)) {
          throw new BadRequestException('Название и права системной роли сохранены. Для других прав создайте новую роль.');
        }
        if (id && (!dto.canJoinBrigade || !dto.isActive)) {
          const assigned=await manager.getRepository(User).count({where:row.systemKey
            ? {role:row.systemKey,accessRoleId:IsNull()}
            : {accessRoleId:row.id}});
          if (!dto.isActive && assigned) throw new ConflictException('Сначала назначьте сотрудникам другую роль');
          const members=await manager.getRepository(User).createQueryBuilder('u')
            .where(row.systemKey ? 'u.role=:key AND u.access_role_id IS NULL' : 'u.access_role_id=:id',{key:row.systemKey,id:row.id})
            .andWhere('u.brigade_id IS NOT NULL').getCount();
          if (!dto.canJoinBrigade && members) throw new ConflictException('Сначала снимите привязку сотрудников этой роли к бригадам');
        }
        Object.assign(row,{name:dto.name,baseRole:dto.baseRole,canJoinBrigade:dto.canJoinBrigade,isActive:dto.isActive,
          permissions:row.systemKey ? null : dto.permissions,pages:row.systemKey ? [] : dto.pages,revision:(row.revision ?? 0)+1});
        return repo.save(row);
      });
    } catch(e) {
      if ((e as {code?:string}).code==='23505') throw new ConflictException('Роль с таким названием уже существует');
      throw e;
    }
  }
}

export async function resolveAccessRole(manager: EntityManager, user: Pick<User,'role'|'accessRoleId'>) {
  return manager.getRepository(AccessRole).findOneBy(user.accessRoleId != null ? {id:user.accessRoleId} : {systemKey:user.role});
}
