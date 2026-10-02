import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Document, Packer, PageOrientation, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from 'docx';
import { User } from '../../entities/user.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceExportQueryDto } from './dto/attendance-export-query.dto';

const HEADERS = ['№', 'Дата дня', 'ФИО', 'Приход', 'Уход', 'Часов', 'Статус', 'Опоздание / объяснительная'];
const NOTE = 'Период — по дате начала дня. Часы — между отметками, без отдельного вычета перерывов. Незавершённые дни в итог часов не включены.';
const dateLabel = (day: string) => day.split('-').reverse().join('.');

@Injectable()
export class AttendanceExportService {
  constructor(private readonly attendance: AttendanceService) {}

  private async report(query: AttendanceExportQueryDto, user: User) {
    if (query.dateFrom > query.dateTo) throw new BadRequestException('Дата «С» должна быть не позже даты «По»');
    // Use the same actor, date/name filters and projection as the on-screen timesheet.
    const records = await this.attendance.findAll(query, user);
    const timeZone = process.env.BUSINESS_TIME_ZONE || 'Asia/Oral';
    const time = new Intl.DateTimeFormat('ru-RU', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const completed = records.filter(row => row.status === 'COMPLETED');
    const hours = Math.round(completed.reduce((total, row) => total + (row.workedHours ?? 0), 0) * 100) / 100;
    const people = new Set(records.map(row => row.userId != null ? `user:${row.userId}` : `legacy:${row.workerFullName.trim().toLocaleLowerCase('ru')}`)).size;
    return {
      lines: [
        'GP Work — Табель рабочего времени',
        `Период: ${dateLabel(query.dateFrom)} — ${dateLabel(query.dateTo)}`,
        `ФИО: ${query.workerFullName?.trim() || 'Все сотрудники'}`,
        `Сформирован: ${time.format(new Date())}. Часовой пояс: ${timeZone}`,
        `Сотрудников: ${people}. Завершённых дней: ${completed.length}. Открытых дней: ${records.length - completed.length}. Итого часов: ${hours.toFixed(2)}`,
        NOTE,
      ],
      hours,
      rows: records.map((row, index) => [
        index + 1, dateLabel(row.workDate), row.workerFullName,
        time.format(new Date(row.checkInTime)), row.checkOutTime ? time.format(new Date(row.checkOutTime)) : '—',
        row.status === 'COMPLETED' ? row.workedHours : null,
        row.status === 'COMPLETED' ? 'Завершено' : 'На работе',
        row.late ? `Опоздание: ${row.lateExplanation || 'нет объяснительной'}` : '—',
      ]),
    };
  }

  async excel(query: AttendanceExportQueryDto, user: User): Promise<Buffer> {
    const report = await this.report(query, user);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GP Work';
    const sheet = workbook.addWorksheet('Табель', {
      views: [{ state: 'frozen', ySplit: 8 }],
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '8:8' },
    });
    sheet.columns = [6, 14, 30, 22, 22, 12, 16, 40].map(width => ({ width }));
    report.lines.forEach((line, index) => {
      sheet.mergeCells(index + 1, 1, index + 1, HEADERS.length);
      const row = sheet.getRow(index + 1);
      row.getCell(1).value = line;
      row.alignment = { vertical: 'middle', wrapText: true };
      row.height = index === 5 ? 30 : 24;
    });
    sheet.getRow(1).font = { bold: true, size: 16 };
    sheet.getRow(8).values = HEADERS;
    sheet.getRow(8).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
    sheet.getRow(8).alignment = { wrapText: true, vertical: 'middle' };
    sheet.getRow(8).height = 32;
    report.rows.forEach(values => {
      const row = sheet.addRow(values);
      row.alignment = { wrapText: true, vertical: 'top' };
      row.getCell(6).numFmt = '0.00';
    });
    const end = 8 + report.rows.length;
    sheet.autoFilter = { from: 'A8', to: `H${end}` };
    if (!report.rows.length) sheet.addRow(['Записей за выбранный период нет']);
    const total = sheet.addRow(['', '', 'Итого часов по завершённым дням', '', '', report.hours]);
    total.font = { bold: true };
    total.getCell(6).numFmt = '0.00';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async word(query: AttendanceExportQueryDto, user: User): Promise<Buffer> {
    const report = await this.report(query, user);
    // A4 landscape, with repeatable headers and wrapping for names/long explanations.
    const widths = [400, 1300, 2800, 2000, 2000, 800, 1400, 4500];
    const makeRow = (values: (string | number | null)[], header = false) => new TableRow({
      tableHeader: header,
      children: values.map((value, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        shading: header ? { fill: 'E2EFDA' } : undefined,
        children: String(value == null ? '—' : (index === 5 && typeof value === 'number' ? value.toFixed(2) : value))
          .split(/\r?\n/).map(text => new Paragraph({ children: [new TextRun({ text, bold: header, size: 18 })] })),
      })),
    });
    const doc = new Document({
      creator: 'GP Work', title: 'Табель рабочего времени',
      styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
      sections: [{
        properties: { page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        } },
        children: [
          ...report.lines.map((text, index) => new Paragraph({
            spacing: { after: 140 }, children: [new TextRun({ text, bold: index === 0 || index === 4, size: index === 0 ? 28 : 20 })],
          })),
          new Table({
            width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
            layout: TableLayoutType.FIXED, columnWidths: widths,
            rows: [makeRow(HEADERS, true), ...report.rows.map(values => makeRow(values))],
          }),
          ...(!report.rows.length ? [new Paragraph('Записей за выбранный период нет')] : []),
        ],
      }],
    });
    return Packer.toBuffer(doc);
  }
}
