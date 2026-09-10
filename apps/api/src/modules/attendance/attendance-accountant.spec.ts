import { AttendanceService } from './attendance.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';

describe('Accountant attendance projection', () => {
  it('keeps hours and worker identity while withholding GPS and custom personal values', async () => {
    const row = { id: 1, workerFullName: 'Worker', userId: 7, workedHours: '8', checkInLatitude: 51, checkInLongitude: 51,
      checkOutLatitude: 52, checkOutLongitude: 52, extraValues: '{"private":"value"}', completionPercent: 100 };
    const query = { orderBy: jest.fn().mockReturnThis(), addOrderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([row]) };
    const service = new AttendanceService({ createQueryBuilder: () => query } as never, {} as never);
    const [accountant] = await service.findAll({}, { role: UserRole.ACCOUNTANT } as User);
    expect(accountant).toMatchObject({ userId: 7, workerFullName: 'Worker', workedHours: 8, completionPercent: 100,
      checkInLatitude: null, checkInLongitude: null, checkOutLatitude: null, checkOutLongitude: null, extraValues: null });
    const [director] = await service.findAll({}, { role: UserRole.DIRECTOR } as User);
    expect(director.checkInLatitude).toBe(51);
  });
});
