import { Controller, Get, Post } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { operationKey, pageAllowed } from './access-policy';

@Controller('objects') @Roles(UserRole.ADMIN)
class Example { @Get() findAll() {} @Post() create() {} }
describe('Custom access policy is an additional mandatory guard',()=>{
  const guard=new RolesGuard(new Reflector());
  const user:any={role:UserRole.ADMIN,accessRoleId:11,accessPolicy:{isActive:true,baseRole:UserRole.ADMIN,permissions:['objects.findAll']}};
  const context=(actor:any,method:keyof Example)=>({getClass:()=>Example,getHandler:()=>Example.prototype[method],switchToHttp:()=>({getRequest:()=>({user:actor})})}) as any;
  it('allows an explicitly permitted read, not an implicit write',()=>{
    expect(operationKey(Example,Example.prototype.findAll)).toBe('objects.findAll');
    expect(guard.canActivate(context(user,'findAll'))).toBe(true);
    expect(()=>guard.canActivate(context(user,'create'))).toThrow('Это действие не разрешено');
  });
  it('fails closed for missing policy and keeps legacy director inheritance',()=>{
    expect(()=>guard.canActivate(context({...user,accessPolicy:undefined},'findAll'))).toThrow();
    expect(guard.canActivate(context({role:UserRole.DIRECTOR},'create'))).toBe(true);
    expect(()=>guard.canActivate(context({role:UserRole.WORKER},'findAll'))).toThrow();
  });
  it('does not extend a template beyond existing section access',()=>{
    expect(pageAllowed(UserRole.WORKER,'/admin/objects')).toBe(false);
    expect(pageAllowed(UserRole.ADMIN,'/admin/director')).toBe(false);
    expect(pageAllowed(UserRole.ACCOUNTANT,'/admin/attendance')).toBe(true);
  });
});
