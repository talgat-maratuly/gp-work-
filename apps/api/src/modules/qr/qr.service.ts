import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as QRCode from 'qrcode';
import { Repository } from 'typeorm';
import { buildFormUrl } from '../../common/app-url';
import { Section } from '../../entities/section.entity';
import { FormSettingsService } from '../form-settings/form-settings.service';

@Injectable()
export class QrService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    private readonly forms: FormSettingsService,
  ) {}

  async publicForm(lookup: { code: string } | { id: number }) {
    const section = await this.sectionRepo.findOne({
      where: { ...lookup, isActive: true, object: { isActive: true } },
      relations: { object: true },
    });
    if (!section) throw new NotFoundException('Участок не найден');
    const settings = await this.forms.getSettings('field_day_form');
    // Public QR is a form, not a staff directory or an execution capability.
    // Never serialize the entity, tasks, coordinates, evidence or saved values.
    return {
      section: { code: section.code, name: section.name, objectName: section.object.name },
      formSettings: { ...settings, fields: settings.fields.filter(field => field.visible) },
    };
  }

  async getFormUrlBySectionCode(sectionCode: string): Promise<string> {
    const section = await this.sectionRepo.findOne({
      where: { code: sectionCode.trim(), isActive: true, object: { isActive: true } },
      relations: { object: true },
    });
    if (!section) throw new NotFoundException('Участок не найден');
    return section.formUrl ?? buildFormUrl(sectionCode);
  }

  async generatePng(sectionCode: string): Promise<Buffer> {
    const url = await this.getFormUrlBySectionCode(sectionCode);
    return QRCode.toBuffer(url, { type: 'png', width: 400, margin: 2 });
  }

}
