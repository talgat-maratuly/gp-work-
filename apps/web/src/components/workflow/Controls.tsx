import type { ReactNode } from 'react'
export const inputClass='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base'
export const buttonClass='rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50'
export const panelClass='space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6'
export function Label({name,children}:{name:string;children:ReactNode}) {return <label className="block space-y-1 text-sm font-medium"><span>{name}</span>{children}</label>}
export function CheckList({title,labels,checked,onChange,disabled}:{title:string;labels:string[];checked:number[];onChange:(v:number[])=>void;disabled:boolean}) {
  return <fieldset disabled={disabled} className="space-y-2"><legend className="mb-2 font-bold">{title}</legend>{labels.map((label,i)=><label key={i} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={checked.includes(i)} onChange={e=>onChange(e.target.checked?[...checked,i]:checked.filter(n=>n!==i))}/><span>{label}</span></label>)}</fieldset>
}
