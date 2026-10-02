import { apiRequest } from './client'

export const UNIT_KINDS = { MANAGEMENT:'Руководство', DEPARTMENT:'Отдел', FUNCTION:'Функция', TERRITORY:'Территория', OBJECT:'Объект', TEAM:'Команда' } as const
export type UnitKind = keyof typeof UNIT_KINDS
export type OrgUnit = {
  id:number; name:string; kind:UnitKind; parent_id:number|null; head_user_id:number|null; object_id:number|null; brigade_id:number|null;
  purpose:string; is_active:boolean; revision:number; parent_name:string|null; head_name:string|null; head_active:boolean|null;
  object_name:string|null; brigade_name:string|null
}
export type OrgEmployee = {
  user_id:number; full_name:string; is_active:boolean; position_id:number|null; position_name:string|null; position_active:boolean|null;
  brigade_id:number|null; brigade_name:string|null; unit_id:number|null; unit_name:string|null; manager_id:number|null;
  manager_name:string|null; manager_active:boolean|null; duties:string; revision:number
}
export type OrgProcess = { process_id:number; title:string; archived:boolean; unit_id:number|null; unit_name:string|null; owner_user_id:number|null; owner_name:string|null; owner_active:boolean|null; revision:number }
export type OrgDirectory = { units:OrgUnit[]; employees:OrgEmployee[]; processes:OrgProcess[]; objects:{id:number;name:string;is_active:boolean}[]; brigades:{id:number;name:string;is_active:boolean}[] }
export type OrgHistory = { id:number; label:string; actor_name:string|null; created_at:string; before_data:Record<string,unknown>|null; after_data:Record<string,unknown> }
export type UnitInput = { name:string;kind:UnitKind;parentId:number|null;headUserId:number|null;objectId:number|null;brigadeId:number|null;purpose:string;isActive:boolean;revision:number }
export type AssignmentInput = { unitId:number|null;managerId:number|null;duties:string;revision:number }
export type OwnerInput = { unitId:number|null;ownerUserId:number|null;revision:number }
export const getOrganization = () => apiRequest<OrgDirectory>('/organization')
export const getOrganizationHistory = (before?:number) => apiRequest<{items:OrgHistory[];next:number|null}>(`/organization/history${before ? `?before=${before}` : ''}`)
export const saveOrgUnit = (id:number|null,data:UnitInput) => apiRequest<OrgUnit>(id == null ? '/organization/units' : `/organization/units/${id}`,{method:id == null?'POST':'PUT',body:JSON.stringify(data)})
export const saveOrgEmployee = (id:number,data:AssignmentInput) => apiRequest<OrgEmployee>(`/organization/employees/${id}`,{method:'PUT',body:JSON.stringify(data)})
export const saveOrgProcess = (id:number,data:OwnerInput) => apiRequest<OrgProcess>(`/organization/processes/${id}`,{method:'PUT',body:JSON.stringify(data)})
