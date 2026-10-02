import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums/user-role.enum';
import { AttendanceController } from '../attendance/attendance.controller';
import { WorkflowController } from '../workflow/workflow.controller';

describe('Personal work day for custom employee roles', () => {
  const guard = new RolesGuard(new Reflector());
  const actor = (baseRole = UserRole.ADMIN, changes = {}) => ({
    role: baseRole, accessRoleId: 10,
    accessPolicy: { baseRole, isActive: true, pages: ['/my-work-day'], permissions: [], ...changes },
  });
  const check = (user: any, name: keyof AttendanceController) => guard.canActivate({
    getClass: () => AttendanceController, getHandler: () => AttendanceController.prototype[name],
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any);

  it.each([UserRole.ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRIGADIER,
    UserRole.AGRONOMIST, UserRole.WORKER, UserRole.WATER_CARRIER])(
    'allows the complete personal clock when its page is granted (%s)', role => {
      for (const action of ['mine', 'start', 'finish', 'explanation'] as const) {
        expect(check(actor(role), action)).toBe(true);
      }
    });

  it('does not grant company attendance, exports or workflow through a personal page', () => {
    for (const action of ['findAll', 'exportExcel', 'exportWord'] as const) {
      expect(() => check(actor(), action)).toThrow('Это действие не разрешено');
    }
    expect(() => guard.canActivate({
      getClass: () => WorkflowController, getHandler: () => WorkflowController.prototype.myFocus,
      switchToHttp: () => ({ getRequest: () => ({ user: actor() }) }),
    } as any)).toThrow('Это действие не разрешено');
  });

  it('fails closed for revoked pages, missing/inactive policies, role mismatches and observers', () => {
    for (const user of [actor(UserRole.ADMIN, { pages: [] }), actor(UserRole.ADMIN, { isActive: false }),
      actor(UserRole.ADMIN, { baseRole: UserRole.WORKER }), { ...actor(), accessPolicy: undefined },
      actor(UserRole.AKIMAT), actor(UserRole.ANTICOR)]) {
      for (const action of ['mine', 'start', 'finish', 'explanation'] as const) {
        expect(() => check(user, action)).toThrow();
      }
    }
    expect(check(actor(UserRole.WORKER, { pages: [], permissions: ['attendance.mine'] }), 'mine')).toBe(true);
    expect(() => check(actor(UserRole.WORKER, { pages: [], permissions: ['attendance.mine'] }), 'start')).toThrow();
  });
});
