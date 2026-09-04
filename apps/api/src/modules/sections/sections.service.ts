import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { nextSectionCode } from '../../common/section-code';
import { buildFormUrl, buildQrApiUrl } from '../../common/app-url';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { Section } from '../../entities/section.entity';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(NurseryObject)
    private readonly objectRepo: Repository<NurseryObject>,
    private readonly dataSource: DataSource,
  ) {}

  findAll() {
    return this.sectionRepo.find({
      relations: { object: true },
      order: { code: 'ASC' },
    });
  }

  async findOne(id: number) {
    const row = await this.sectionRepo.findOne({
      where: { id },
      relations: { object: true },
    });
    if (!row) throw new NotFoundException('Участок не найден');
    return row;
  }

  async findByCode(code: string) {
    const row = await this.sectionRepo.findOne({
      where: { code },
      relations: { object: true },
    });
    if (!row) throw new NotFoundException('Участок не найден');
    return row;
  }

  async create(dto: CreateSectionDto) {
    const object = await this.objectRepo.findOne({ where: { id: dto.objectId } });
    if (!object || !object.isActive) throw new BadRequestException('Активный объект не найден');

    const code = await nextSectionCode(this.dataSource);
    const formUrl = buildFormUrl(code);
    const qrCodeUrl = buildQrApiUrl(code);

    const row = this.sectionRepo.create({
      objectId: dto.objectId,
      code,
      name: dto.name.trim(),
      area: dto.area?.trim() || null,
      culture: dto.culture?.trim() || null,
      customText: dto.customText?.trim() || null,
      formUrl,
      qrCodeUrl,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.sectionRepo.save(row);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateSectionDto) {
    const row = await this.findOne(id);
    let targetObject = row.object;
    if (dto.objectId !== undefined) {
      const object = await this.objectRepo.findOne({ where: { id: dto.objectId } });
      if (!object || !object.isActive) throw new BadRequestException('Активный объект не найден');
      row.objectId = dto.objectId;
      targetObject = object;
    }
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.area !== undefined) row.area = dto.area?.trim() || null;
    if (dto.culture !== undefined) row.culture = dto.culture?.trim() || null;
    if (dto.customText !== undefined) row.customText = dto.customText?.trim() || null;
    if (dto.latitude !== undefined) row.latitude = dto.latitude;
    if (dto.longitude !== undefined) row.longitude = dto.longitude;
    if (dto.radiusMeters !== undefined) row.radiusMeters = dto.radiusMeters;
    if (dto.isActive !== undefined) {
      if (dto.isActive && !targetObject.isActive) {
        throw new BadRequestException('Нельзя активировать участок архивного объекта');
      }
      row.isActive = dto.isActive;
    }
    await this.sectionRepo.save(row);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const row = await this.findOne(id);
    row.isActive = false;
    await this.sectionRepo.save(row);
  }
}
