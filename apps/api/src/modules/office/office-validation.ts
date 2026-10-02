import { BadRequestException } from '@nestjs/common';
export function invalid(message:string):never {throw new BadRequestException(message);}
export function object(value:unknown, keys:string[]):Record<string,any> {
  if(!value||typeof value!=='object'||Array.isArray(value))invalid('Ожидается объект');
  const row=value as Record<string,any>;
  if(Object.keys(row).some(k=>!keys.includes(k)))invalid('Неизвестное поле');
  return row;
}
export function text(value:unknown,label:string,max=240,optional=false):string {
  if(optional&&(value==null||value===''))return '';
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)invalid(`${label}: заполните поле (до ${max} символов)`);
  return (value as string).trim();
}
export function integer(value:unknown,label='Идентификатор',min=1):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>2147483647)invalid(`${label}: неверное число`);
  return value as number;
}
export function ids(value:unknown):number[] {
  if(!Array.isArray(value)||value.length>200)invalid('Укажите список (до 200 записей)');
  return [...new Set((value as unknown[]).map(v=>integer(v)))];
}
export function choice<T extends string>(value:unknown,options:readonly T[]):T {
  if(typeof value!=='string'||!options.includes(value as T))invalid('Недопустимое значение');return value as T;
}
export function bool(value:unknown):boolean {if(typeof value!=='boolean')invalid('Ожидается да/нет');return value as boolean;}
export function day(value:unknown):string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)invalid('Укажите существующую дату');
  return value as string;
}
// Decimal strings only. No binary floating-point rounding of financial amounts.
export function money(value:unknown):number {
  if(typeof value!=='string'||!/^\d{1,10}(\.\d{1,2})?$/.test(value))invalid('Сумма: положительное число в тенге, до двух знаков после точки');
  const [whole,fraction='']= (value as string).split('.');const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(result<=0||result>9000000000000)invalid('Сумма вне допустимого диапазона');return result;
}
export function canonical(value:any):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function today():string {return new Date(Date.now()+5*3600000).toISOString().slice(0,10);}
export function escapeHtml(value:unknown):string {return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
