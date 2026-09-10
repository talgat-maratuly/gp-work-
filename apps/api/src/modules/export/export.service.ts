import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { format } from 'date-fns';
import * as ExcelJS from 'exceljs';
import { In, Repository } from 'typeorm';
import { buildMapLink, getApiPublicUrl } from '../../common/app-url';
import { businessDateString } from '../../common/business-date';
import { AttendanceRecord } from '../../entities/attendance-record.entity';
import { User } from '../../entities/user.entity';
import { WorkLogsService } from '../work-logs/work-logs.service';
import { WorkLogQueryDto } from '../work-logs/dto/work-log-query.dto';

function normalizeName(name: string): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

@Injectable()
export class ExportService {
  constructor(
    private readonly workLogsService: WorkLogsService,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
  ) {}

  private workTypeLabel(log: {
    customWorkType: string | null;
    workType: { name: string } | null;
  }): string {
    if (log.customWorkType) return log.customWorkType;
    return log.workType?.name ?? '—';
  }

  private photoLinks(urls: string[]): string {
    const base = getApiPublicUrl();
    return urls
      .map((u) => (u.startsWith('http') ? u : `${base}${u}`))
      .join('; ');
  }

  private geoLabel(log: {
    latitude: number | null;
    longitude: number | null;
    locationAccuracy: number | null;
    locationAllowed: boolean;
  }): string {
    if (log.latitude != null && log.longitude != null) {
      const link = buildMapLink(log.latitude, log.longitude);
      const acc =
        log.locationAccuracy != null
          ? `, точность ±${Math.round(log.locationAccuracy)} м`
          : '';
      return `${link}${acc}`;
    }
    return log.locationAllowed === false
      ? 'Геолокация не разрешена'
      : 'Геолокация не разрешена';
  }

  private async buildCheckoutPercentMap(dates: string[]): Promise<Map<string, number | null>> {
    if (!dates.length) return new Map();
    const rows = await this.attendanceRepo.find({ where: { workDate: In(dates) } });
    const map = new Map<string, number | null>();
    for (const r of rows) {
      const identity = r.userId != null ? `user:${r.userId}` : `legacy:${normalizeName(r.workerFullName)}`;
      const key = `${identity}__${r.workDate}`;
      // An ambiguous historical name/date must never inherit another person's percentage.
      map.set(key, map.has(key) ? null : r.completionPercent);
    }
    return map;
  }

  async buildWorkLogsXlsx(query: WorkLogQueryDto, user: User): Promise<ExcelJS.Buffer> {
    const logs = await this.workLogsService.findAll(query, user);
    const checkoutPercent = await this.buildCheckoutPercentMap([...new Set(logs.map(log => businessDateString(new Date(log.submittedAt))))]);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Журнал работ');

    sheet.columns = [
      { header: 'Дата', key: 'date', width: 12 },
      { header: 'Время', key: 'time', width: 8 },
      { header: 'ФИО', key: 'worker', width: 22 },
      { header: 'Объект', key: 'object', width: 18 },
      { header: 'Участок', key: 'section', width: 18 },
      { header: 'Культура', key: 'culture', width: 14 },
      { header: 'Вид работы', key: 'workType', width: 18 },
      { header: 'Процент выполнения', key: 'volume', width: 20 },
      { header: 'Процент выполненной работы (уход)', key: 'checkoutPercent', width: 30 },
      { header: 'Комментарий', key: 'comment', width: 24 },
      { header: 'Фото', key: 'photos', width: 40 },
      { header: 'Геолокация', key: 'geo', width: 36 },
      { header: 'Ссылка на карту', key: 'map', width: 36 },
    ];

    for (const log of logs) {
      const submitted = new Date(log.submittedAt);
      const mapLink =
        log.latitude != null && log.longitude != null
          ? buildMapLink(log.latitude, log.longitude)
          : '—';
      const identity = log.userId != null ? `user:${log.userId}` : `legacy:${normalizeName(log.workerFullName)}`;
      const percentKey = `${identity}__${businessDateString(submitted)}`;
      const coPercent = checkoutPercent.get(percentKey);

      sheet.addRow({
        date: format(submitted, 'dd.MM.yyyy'),
        time: format(submitted, 'HH:mm'),
        worker: log.workerFullName,
        object: log.section.object.name,
        section: log.section.name,
        culture: log.section.culture ?? '—',
        workType: this.workTypeLabel(log),
        volume: log.workVolume,
        checkoutPercent: coPercent != null ? `${coPercent}%` : '—',
        comment: log.comment,
        photos: this.photoLinks(log.photoUrls),
        geo: this.geoLabel(log),
        map: mapLink,
      });
    }

    sheet.getRow(1).font = { bold: true };
    return workbook.xlsx.writeBuffer() as Promise<ExcelJS.Buffer>;
  }
}
