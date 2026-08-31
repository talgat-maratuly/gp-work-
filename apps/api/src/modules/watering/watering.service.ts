import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { parsePhotoUrls, serializePhotoUrls } from '../../common/photo-urls';
import {
  WateringShift,
  WateringStatus,
  WateringType,
} from '../../common/enums/watering.enums';
import { User } from '../../entities/user.entity';
import { WateringRecord } from '../../entities/watering-record.entity';
import { CreateWateringDto } from './dto/create-watering.dto';
import { QueryWateringDto } from './dto/query-watering.dto';
import { ReviewWateringDto } from './dto/review-watering.dto';
import { UpdateWateringDto } from './dto/update-watering.dto';

function mapUser(user: User | null) {
  if (!user) return null;
  return { id: user.id, fullName: user.fullName, role: user.role };
}

@Injectable()
export class WateringService {
  constructor(
    @InjectRepository(WateringRecord)
    private readonly wateringRepo: Repository<WateringRecord>,
  ) {}

  private baseQuery(): SelectQueryBuilder<WateringRecord> {
    return this.wateringRepo
      .createQueryBuilder('w')
      .leftJoinAndSelect('w.object', 'object')
      .leftJoinAndSelect('w.section', 'section')
      .leftJoinAndSelect('section.object', 'sectionObject')
      .leftJoinAndSelect('w.waterCarrier', 'waterCarrier')
      .leftJoinAndSelect('w.createdBy', 'createdBy')
      .leftJoinAndSelect('w.reviewedBy', 'reviewedBy');
  }

  private applyFilters(
    qb: SelectQueryBuilder<WateringRecord>,
    query: QueryWateringDto,
  ) {
    if (query.date) {
      qb.andWhere('w.work_date = :date', { date: query.date });
    }
    if (query.dateFrom) {
      qb.andWhere('w.work_date >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('w.work_date <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.shift) {
      qb.andWhere('w.shift = :shift', { shift: query.shift });
    }
    if (query.type) {
      qb.andWhere('w.type = :type', { type: query.type });
    }
    if (query.status) {
      qb.andWhere('w.status = :status', { status: query.status });
    }
    if (query.waterCarrierId) {
      qb.andWhere('w.water_carrier_id = :wcId', { wcId: query.waterCarrierId });
    }
    if (query.objectId) {
      qb.andWhere(
        '(w.object_id = :objId OR section.object_id = :objId)',
        { objId: query.objectId },
      );
    }
    if (query.sectionId) {
      qb.andWhere('w.section_id = :secId', { secId: query.sectionId });
    }
    if (query.search) {
      qb.andWhere(
        `(
          LOWER(COALESCE(object.name, '')) LIKE :s
          OR LOWER(COALESCE(section.name, '')) LIKE :s
          OR LOWER(COALESCE(sectionObject.name, '')) LIKE :s
          OR LOWER(COALESCE(w.performer_name, '')) LIKE :s
          OR LOWER(COALESCE(waterCarrier.full_name, '')) LIKE :s
          OR LOWER(COALESCE(w.comment, '')) LIKE :s
        )`,
        { s: `%${query.search.toLowerCase()}%` },
      );
    }
    return qb;
  }

  private mapRecord(row: WateringRecord) {
    const objectName = row.object?.name ?? row.section?.object?.name ?? null;
    return {
      id: row.id,
      workDate: row.workDate,
      shift: row.shift,
      type: row.type,
      objectId: row.objectId,
      sectionId: row.sectionId,
      waterCarrierId: row.waterCarrierId,
      performerName: row.performerName,
      plannedLiters: row.plannedLiters,
      actualLiters: row.actualLiters,
      litersDiff:
        row.actualLiters != null && row.plannedLiters != null
          ? row.actualLiters - row.plannedLiters
          : null,
      startTime: row.startTime,
      endTime: row.endTime,
      comment: row.comment,
      photoUrls: parsePhotoUrls(row.photoUrls),
      latitude: row.latitude,
      longitude: row.longitude,
      qrConfirmed: row.qrConfirmed,
      status: row.status,
      createdById: row.createdById,
      reviewedById: row.reviewedById,
      reviewedAt: row.reviewedAt,
      reviewComment: row.reviewComment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      objectName,
      sectionName: row.section?.name ?? null,
      sectionCode: row.section?.code ?? null,
      object: row.object
        ? { id: row.object.id, name: row.object.name }
        : null,
      section: row.section
        ? { id: row.section.id, name: row.section.name, code: row.section.code }
        : null,
      waterCarrier: mapUser(row.waterCarrier),
      createdBy: mapUser(row.createdBy),
      reviewedBy: mapUser(row.reviewedBy),
    };
  }

  async findAll(query: QueryWateringDto) {
    const qb = this.applyFilters(this.baseQuery(), query)
      .orderBy('w.work_date', 'DESC')
      .addOrderBy('w.created_at', 'DESC');
    const rows = await qb.getMany();
    return rows.map((r) => this.mapRecord(r));
  }

  async findOne(id: number) {
    const row = await this.baseQuery().where('w.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException('Запись полива не найдена');
    return this.mapRecord(row);
  }

  async stats(query: QueryWateringDto) {
    const rows = await this.applyFilters(this.baseQuery(), query).getMany();

    const countBy = (status: WateringStatus) =>
      rows.filter((r) => r.status === status).length;

    const plannedLiters = rows.reduce(
      (sum, r) => sum + (r.plannedLiters ?? 0),
      0,
    );
    const actualLiters = rows.reduce(
      (sum, r) => sum + (r.actualLiters ?? 0),
      0,
    );

    // Объекты без подтверждённого полива: есть записи, но ни одна не DONE
    const objectsMap = new Map<number, boolean>();
    for (const r of rows) {
      const objId = r.objectId ?? r.section?.object?.id ?? null;
      if (objId == null) continue;
      const confirmed = r.status === WateringStatus.DONE;
      objectsMap.set(objId, (objectsMap.get(objId) ?? false) || confirmed);
    }
    const objectsWithoutConfirmed = Array.from(objectsMap.values()).filter(
      (confirmed) => !confirmed,
    ).length;

    return {
      total: rows.length,
      planned: countBy(WateringStatus.PLANNED),
      inProgress: countBy(WateringStatus.IN_PROGRESS),
      done: countBy(WateringStatus.DONE),
      skipped: countBy(WateringStatus.SKIPPED),
      needsReview: countBy(WateringStatus.NEEDS_REVIEW),
      plannedLiters,
      actualLiters,
      litersDiff: actualLiters - plannedLiters,
      objectsWithoutConfirmed,
      waterCarrierCount: new Set(
        rows
          .filter((r) => r.type === WateringType.WATER_CARRIER && r.waterCarrierId)
          .map((r) => r.waterCarrierId),
      ).size,
    };
  }

  async create(dto: CreateWateringDto, user: User) {
    const isCarrier = dto.type === WateringType.WATER_CARRIER;
    const row = this.wateringRepo.create({
      workDate: dto.workDate,
      shift: dto.shift,
      type: dto.type,
      objectId: dto.objectId ?? null,
      sectionId: dto.sectionId ?? null,
      waterCarrierId: isCarrier ? dto.waterCarrierId ?? null : null,
      performerName: dto.performerName?.trim() || null,
      plannedLiters: dto.plannedLiters ?? null,
      actualLiters: dto.actualLiters ?? null,
      startTime: dto.startTime?.trim() || null,
      endTime: dto.endTime?.trim() || null,
      comment: dto.comment?.trim() || null,
      photoUrls: serializePhotoUrls(dto.photoUrls ?? []),
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      qrConfirmed: dto.qrConfirmed ?? false,
      status: dto.status ?? WateringStatus.PLANNED,
      createdById: user.id,
    });
    const saved = await this.wateringRepo.save(row);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateWateringDto) {
    const row = await this.wateringRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Запись полива не найдена');

    if (dto.workDate !== undefined) row.workDate = dto.workDate;
    if (dto.shift !== undefined) row.shift = dto.shift;
    if (dto.type !== undefined) {
      row.type = dto.type;
      if (dto.type !== WateringType.WATER_CARRIER) row.waterCarrierId = null;
    }
    if (dto.objectId !== undefined) row.objectId = dto.objectId;
    if (dto.sectionId !== undefined) row.sectionId = dto.sectionId;
    if (dto.waterCarrierId !== undefined) row.waterCarrierId = dto.waterCarrierId;
    if (dto.performerName !== undefined)
      row.performerName = dto.performerName?.trim() || null;
    if (dto.plannedLiters !== undefined) row.plannedLiters = dto.plannedLiters;
    if (dto.actualLiters !== undefined) row.actualLiters = dto.actualLiters;
    if (dto.startTime !== undefined) row.startTime = dto.startTime?.trim() || null;
    if (dto.endTime !== undefined) row.endTime = dto.endTime?.trim() || null;
    if (dto.comment !== undefined) row.comment = dto.comment?.trim() || null;
    if (dto.photoUrls !== undefined)
      row.photoUrls = serializePhotoUrls(dto.photoUrls);
    if (dto.latitude !== undefined) row.latitude = dto.latitude;
    if (dto.longitude !== undefined) row.longitude = dto.longitude;
    if (dto.qrConfirmed !== undefined) row.qrConfirmed = dto.qrConfirmed;
    if (dto.status !== undefined) row.status = dto.status;

    await this.wateringRepo.save(row);
    return this.findOne(id);
  }

  async review(id: number, reviewer: User, dto: ReviewWateringDto) {
    const row = await this.wateringRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Запись полива не найдена');

    row.status = dto.status;
    row.reviewedById = reviewer.id;
    row.reviewedAt = new Date();
    row.reviewComment = dto.reviewComment?.trim() || null;
    await this.wateringRepo.save(row);
    return this.findOne(id);
  }

  async remove(id: number) {
    const row = await this.wateringRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Запись полива не найдена');
    await this.wateringRepo.remove(row);
  }
}
