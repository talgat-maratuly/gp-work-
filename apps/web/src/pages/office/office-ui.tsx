import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'
export const inputClass='w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900'
export const buttonClass='rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50'
export const secondaryClass='rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50'
export function Field({label,children}:{label:string;children:ReactElement<{id?:string}>}){
  const generatedId=useId(),id=children.props.id??generatedId
  return <div className="min-w-0 space-y-1 text-sm font-medium text-slate-700"><label htmlFor={id} className="block">{label}</label>{cloneElement(children,{id})}</div>
}
export function Panel({title,children}:{title:string;children:ReactNode}){return <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6"><h2 className="mb-4 text-xl font-bold">{title}</h2>{children}</section>}
export const moneyLabel=(v:number|string)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'KZT',maximumFractionDigits:2}).format(Number(v)/100)
export const scopeNames:Record<string,string>={SELF:'Только назначенные проекты',DEPARTMENT:'Проекты своего подразделения и назначенные',COMPANY:'Проекты всей компании'}
export const kindNames:Record<string,string>={TASK:'Планы и чек-листы',CONTRACT:'Договоры',BUDGET:'Бюджеты',PURCHASE:'Закупки',RECEIPT:'Приёмка закупок',INVOICE:'Счета и календарь',PAYMENT:'Учёт оплат'}
export const statusNames:Record<string,string>={DRAFT:'Черновик',SUBMITTED:'На согласовании',APPROVED:'Согласовано',SIGNED:'Подписан',TODO:'Запланировано',IN_PROGRESS:'В работе',REWORK:'На доработке',DONE:'Принято',ACTIVE:'В работе',COMPLETED:'Завершён',ARCHIVED:'Архив',CANCELLED:'Отменено',SUPERSEDED:'Заменён новой версией',RECORDED:'Учтено',RECEIVED:'Получено',PAID:'Оплачено',VOID:'Сторнировано'}
export const createRights:Record<string,string>={TASK:'plan',CONTRACT:'contract',BUDGET:'budget',PURCHASE:'purchase',RECEIPT:'receive',INVOICE:'invoice',PAYMENT:'pay'}
export type OfficeRow={id:number;project_id:number;kind:string;code:string;title:string;status:string;parent_id:number|null;assignee_id:number|null;assignee_name:string|null;amount:string;paid_amount?:string;due_date:string|null;data:Record<string,any>;revision:number;created_by:number}
export type Workspace={access:{profile:string;scope:string;enabled:boolean;unitId:number|null;unitName:string|null;rights:string[];views:string[];label:string};projects:any[];records:OfficeRow[];units:any[];employees:any[];memberships:any[];projectUnits:any[];templates:any[];events:any[];documents:any[];contractOptions:any[];financial:{budget:string|null;committed:string}|null;today:string;limits:{projects:number;records:number}}
