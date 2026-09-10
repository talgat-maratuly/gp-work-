import * as ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { AttendanceRecord } from '../../entities/attendance-record.entity';
import { User } from '../../entities/user.entity';
import { WorkLogsService } from '../work-logs/work-logs.service';
import { ExportService } from './export.service';

describe('work log export boundaries', () => {
  const actor = { id: 9, role: UserRole.BRIGADIER, brigadeId: null } as User;

  it('passes the actual actor to scoped work logs and exports only a header for an empty scope', async () => {
    const findAll = jest.fn().mockResolvedValue([]);
    const find = jest.fn();
    const service = new ExportService({ findAll } as unknown as WorkLogsService, { find } as unknown as Repository<AttendanceRecord>);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await service.buildWorkLogsXlsx({}, actor));
    expect(findAll).toHaveBeenCalledWith({}, actor);
    expect(find).not.toHaveBeenCalled();
    expect(workbook.worksheets[0].rowCount).toBe(1);
  });

  it('matches percentage by user ID and Oral date when employees have identical names', async () => {
    process.env.BUSINESS_TIME_ZONE = 'Asia/Oral';
    const findAll = jest.fn().mockResolvedValue([{
      userId: 1, workerFullName: 'Одинаковое имя', submittedAt: '2026-09-09T21:30:00Z',
      section: { name: 'Участок', object: { name: 'Объект' } },
      workType: { name: 'Полив' }, workVolume: '75%', photoUrls: [],
    }]);
    const find = jest.fn().mockResolvedValue([
      { userId: 1, workerFullName: 'Одинаковое имя', workDate: '2026-09-10', completionPercent: 75 },
      { userId: 2, workerFullName: 'Одинаковое имя', workDate: '2026-09-10', completionPercent: 100 },
    ]);
    const service = new ExportService({ findAll } as unknown as WorkLogsService, { find } as unknown as Repository<AttendanceRecord>);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await service.buildWorkLogsXlsx({}, actor));
    expect(workbook.worksheets[0].getRow(2).getCell(9).value).toBe('75%');
  });
});
