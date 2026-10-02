import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

export const PROFILES = {
  EXECUTIVE: 'Руководитель компании', PROJECT_MANAGER: 'Менеджер проектов', SUPPLY: 'Снабжение',
  FINANCE: 'Финансы и планирование', ACCOUNTANT: 'Бухгалтерия', QUALITY: 'Качество', LEGAL: 'Договоры', EMPLOYEE: 'Исполнитель',
};
export type Profile = keyof typeof PROFILES;
export type OfficeAccess = {profile: Profile; scope: 'SELF'|'DEPARTMENT'|'COMPANY'; enabled: boolean; revision: number; unitId: number|null; unitName: string|null};
export const RIGHTS: Record<Profile,string[]> = {
  EXECUTIVE: ['project','plan','work','quality','contract','sign','template','budget','approve','purchase','receive','invoice','pay','reverse'],
  PROJECT_MANAGER: ['project','plan','work','contract','budget','purchase'],
  SUPPLY: ['purchase','receive'], FINANCE: ['budget','approve','reverse'],
  ACCOUNTANT: ['invoice','pay'], QUALITY: ['quality'], LEGAL: ['contract','template','sign'], EMPLOYEE: ['work'],
};
export const VIEWS: Record<Profile,string[]> = {
  EXECUTIVE: ['TASK','CONTRACT','BUDGET','PURCHASE','RECEIPT','INVOICE','PAYMENT'],
  PROJECT_MANAGER: ['TASK','CONTRACT','BUDGET','PURCHASE','RECEIPT','INVOICE','PAYMENT'],
  SUPPLY: ['PURCHASE','RECEIPT'], FINANCE: ['CONTRACT','BUDGET','PURCHASE','RECEIPT','INVOICE','PAYMENT'],
  ACCOUNTANT: ['CONTRACT','BUDGET','PURCHASE','RECEIPT','INVOICE','PAYMENT'], QUALITY: ['TASK'], LEGAL: ['CONTRACT'], EMPLOYEE: ['TASK'],
};
export function executive(user: Pick<User,'role'|'accessRoleId'>) {
  return user.accessRoleId == null && [UserRole.ADMIN,UserRole.DIRECTOR].includes(user.role);
}
export async function loadOfficeAccess(m:EntityManager, user:User):Promise<OfficeAccess|null> {
  if(executive(user))return {profile:'EXECUTIVE',scope:'COMPANY',enabled:true,revision:0,unitId:null,unitName:null};
  const [row]=await m.query(`SELECT a.profile,a.scope,a.enabled,a.revision,o.unit_id AS "unitId",u.name AS "unitName",u.is_active
    FROM office_access a LEFT JOIN organization_assignments o ON o.user_id=a.user_id
    LEFT JOIN organization_units u ON u.id=o.unit_id WHERE a.user_id=$1`,[user.id]);
  if(!row)return null;
  return {profile:row.profile,scope:row.scope,enabled:row.enabled&&row.is_active===true,revision:row.revision,unitId:row.unitId,unitName:row.unitName};
}
export function requireRight(access:OfficeAccess, right:string) {
  if(!access.enabled || !RIGHTS[access.profile].includes(right))throw new ForbiddenException('Это действие недоступно вашему рабочему профилю');
}
export function legacyOfficeAllowed(resource:string, action:string) {
  return resource==='auth'||resource==='office'||(resource==='attendance'&&['mine','start','finish','explanation'].includes(action));
}
