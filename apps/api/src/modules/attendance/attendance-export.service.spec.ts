import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { validate } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../../entities/user.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceExportService } from './attendance-export.service';
import { AttendanceExportQueryDto } from './dto/attendance-export-query.dto';

describe('Attendance Excel and Word downloads', () => {
  const actor = { id: 1, role: UserRole.ADMIN } as User;
  const query = { dateFrom: '2026-09-30', dateTo: '2026-10-02', workerFullName: '=Иванов & Петров' };
  const record = {
    userId: 7, workerFullName: query.workerFullName, workDate: '2026-09-30',
    checkInTime: new Date('2026-09-30T18:00:00Z'), checkOutTime: new Date('2026-10-01T01:45:00Z'),
    workedHours: 7.75, status: 'COMPLETED', late: true, lateExplanation: 'Причина <согласована> & подтверждена\nВторая строка',
  };
  const findAll = jest.fn();
  const service = new AttendanceExportService({ findAll } as unknown as AttendanceService);
  const previousZone = process.env.BUSINESS_TIME_ZONE;
  beforeAll(() => { process.env.BUSINESS_TIME_ZONE = 'Asia/Oral'; });
  afterAll(() => {
    if (previousZone === undefined) delete process.env.BUSINESS_TIME_ZONE;
    else process.env.BUSINESS_TIME_ZONE = previousZone;
  });
  beforeEach(() => {
    findAll.mockReset().mockResolvedValue([
      record,
      { ...record, userId: 8, workedHours: 0, late: false },
      { ...record, workDate: '2026-10-02', status: 'ON_DUTY', workedHours: 99, checkOutTime: null },
    ]);
  });

  it('writes a real workbook with actor-scoped filters, numeric hours, overnight dates and literal user text', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await service.excel(query, actor) as unknown as ExcelJS.Buffer);
    expect(findAll).toHaveBeenCalledWith(query, actor);
    const sheet = workbook.getWorksheet('Табель')!;
    expect(sheet.getCell('A2').value).toContain('30.09.2026 — 02.10.2026');
    expect(sheet.getCell('A3').value).toContain(query.workerFullName);
    expect(sheet.getCell('A5').value).toContain('Сотрудников: 2. Завершённых дней: 2. Открытых дней: 1. Итого часов: 7.75');
    expect(sheet.getCell('C9').value).toBe(query.workerFullName);
    expect(sheet.getCell('C9').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('D9').value).toContain('30.09.2026, 23:00');
    expect(sheet.getCell('E9').value).toContain('01.10.2026, 06:45');
    expect(sheet.getCell('F9').value).toBe(7.75);
    expect(sheet.getCell('F10').value).toBe(0);
    expect(sheet.getCell('F11').value).toBeNull();
    expect(sheet.getCell('E11').value).toBe('—');
    expect(sheet.getCell('G11').value).toBe('На работе');
    expect(sheet.getCell('H9').value).toContain(record.lateExplanation);
    expect(sheet.getCell('F12').value).toBe(7.75);
  });

  it('writes a Word package with escaped Cyrillic, repeated table header and the same totals', async () => {
    const zip = await JSZip.loadAsync(await service.word(query, actor));
    expect(findAll).toHaveBeenCalledWith(query, actor);
    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Сотрудников: 2. Завершённых дней: 2. Открытых дней: 1. Итого часов: 7.75');
    expect(xml).toContain('=Иванов &amp; Петров');
    expect(xml).toContain('Причина &lt;согласована&gt; &amp; подтверждена');
    expect(xml).toContain('Вторая строка');
    expect(xml).toContain('01.10.2026, 06:45');
    expect(xml).toContain('w:orient="landscape"');
    expect(xml).toContain('<w:tblHeader');
    expect(xml).toContain('На работе');
    expect(xml).not.toContain('>99.00<');
  });

  it('makes empty exports explicit and rejects reversed periods before reading attendance', async () => {
    findAll.mockResolvedValue([]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await service.excel(query, actor) as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet('Табель')!.getCell('A9').value).toBe('Записей за выбранный период нет');
    const zip = await JSZip.loadAsync(await service.word(query, actor));
    expect(await zip.file('word/document.xml')!.async('string')).toContain('Записей за выбранный период нет');
    findAll.mockClear();
    await expect(service.excel({ dateFrom: query.dateTo, dateTo: query.dateFrom }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.word({ dateFrom: query.dateTo, dateTo: query.dateFrom }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(findAll).not.toHaveBeenCalled();
  });

  it('requires real ISO dates and a bounded name filter', async () => {
    expect(await validate(Object.assign(new AttendanceExportQueryDto(), query))).toHaveLength(0);
    for (const bad of [{}, { dateFrom: '2026-02-30', dateTo: query.dateTo },
      { ...query, dateFrom: '2026-10-01T00:00:00Z' }, { ...query, dateTo: 'bad\r\nheader' },
      { ...query, workerFullName: 'a'.repeat(256) }]) {
      expect((await validate(Object.assign(new AttendanceExportQueryDto(), bad))).length).toBeGreaterThan(0);
    }
  });

  it.each(['exportExcel', 'exportWord'] as const)('protects %s with admin/director and explicit custom-role permissions', method => {
    const guard = new RolesGuard(new Reflector());
    const context = (user: unknown) => ({ getClass: () => AttendanceController,
      getHandler: () => AttendanceController.prototype[method], switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;
    for (const role of [UserRole.ADMIN, UserRole.DIRECTOR]) expect(guard.canActivate(context({ role }))).toBe(true);
    for (const role of [UserRole.WORKER, UserRole.ACCOUNTANT, UserRole.BRIGADIER, UserRole.AGRONOMIST, UserRole.WATER_CARRIER, UserRole.AKIMAT, UserRole.ANTICOR]) {
      expect(() => guard.canActivate(context({ role }))).toThrow('Недостаточно прав');
    }
    const custom = { role: UserRole.ADMIN, accessRoleId: 11,
      accessPolicy: { isActive: true, baseRole: UserRole.ADMIN, permissions: ['attendance.findAll'] } };
    expect(() => guard.canActivate(context(custom))).toThrow('Это действие не разрешено');
    custom.accessPolicy.permissions.push(`attendance.${method}`);
    expect(guard.canActivate(context(custom))).toBe(true);
  });
});
