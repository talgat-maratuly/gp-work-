import type { AuthUser } from './auth'
import { isSectionFormPath, resolvePostLoginPath } from './roleRoutes'

export function canOpenPage(user:AuthUser|null, path:string) {
  if (!user) return false
  if (user.officeAccess && user.officeAccess.profile !== 'EXECUTIVE') {
    const clean = path.split(/[?#]/)[0].replace(/\/$/,'')
    if (!['/office','/my-work-day','/change-password'].includes(clean)) return false
    if (clean === '/office' || clean === '/change-password') return true
  }
  if (user.accessRoleId == null) return true
  const clean=path.split(/[?#]/)[0].replace(/\/$/,'')
  if (['/access-home','/change-password'].includes(clean)) return true
  if (clean==='/field/more') return user.pages?.some(p=>p.startsWith('/field/'))??false
  if (clean.startsWith('/workflow/tasks/')) return !!user.pages?.some(p=>p.endsWith('/workflow'))
  if (clean.startsWith('/field/executions/')) return !!user.pages?.includes('/field/tasks')
  return user.pages?.some(page=>clean===page||clean.startsWith(page+'/'))??false
}
export function userHome(user:AuthUser, legacy:string) {return user.officeAccess&&user.officeAccess.profile!=='EXECUTIVE'?'/office':user.accessRoleId!=null?'/access-home':legacy}
export function canPerform(user:AuthUser|null,key:string) {
  return !!user&&(user.accessRoleId==null||!!user.permissions?.includes(key))
}
export function loginTarget(user:AuthUser,from?:string) {
  if(user.officeAccess&&user.officeAccess.profile!=='EXECUTIVE') return from==='/my-work-day'&&canOpenPage(user,from)?from:'/office'
  if(user.accessRoleId==null)return resolvePostLoginPath(user.role,from)
  if(from?.startsWith('/')&&!from.startsWith('//')&&(isSectionFormPath(from)||canOpenPage(user,from)))return from
  return '/access-home'
}
