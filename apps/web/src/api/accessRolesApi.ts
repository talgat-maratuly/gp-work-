import { apiRequest } from './client'
import type { UserRole } from '@/lib/auth'
export type AccessRole = {
  id:number; name:string; baseRole:UserRole; systemKey:UserRole|null;
  permissions:string[]|null; pages:string[]; canJoinBrigade:boolean; isActive:boolean; revision:number
}
export type AccessCatalog = {pages:Record<string,string>; pageRoles:Record<string,UserRole[]>; operations:Array<{
  key:string; resource:string; section:string; label:string; method:number; path:string; roles:UserRole[]
}>}
export const fetchAccessRoles = () => apiRequest<AccessRole[]>('/access-roles')
export const fetchAccessCatalog = () => apiRequest<AccessCatalog>('/access-roles/catalog')
export const saveAccessRole = (role: Omit<AccessRole,'id'|'systemKey'|'revision'> & {revision?:number}, id?:number) => {
  const {name,baseRole,permissions,pages,canJoinBrigade,isActive,revision}=role
  return apiRequest<AccessRole>(`/access-roles${id ? `/${id}` : ''}`,{method:id?'PUT':'POST',body:JSON.stringify({name,baseRole,permissions,pages,canJoinBrigade,isActive,revision})})
}
