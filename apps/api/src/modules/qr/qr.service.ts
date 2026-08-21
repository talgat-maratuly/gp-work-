import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as QRCode from 'qrcode';
import { Repository } from 'typeorm';
import { buildCheckOutUrl, buildFormUrl } from '../../common/app-url';
import { Section } from '../../entities/section.entity';

@Injectable()
export class QrService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
  ) {}

  async getFormUrlBySectionCode(sectionCode: string): Promise<string> {
    const section = await this.sectionRepo.findOne({ where: { code: sectionCode } });
    if (!section) throw new NotFoundException('Участок не найден');
    return section.formUrl ?? buildFormUrl(sectionCode);
  }

  async generatePng(sectionCode: string): Promise<Buffer> {
    const url = await this.getFormUrlBySectionCode(sectionCode);
    return QRCode.toBuffer(url, { type: 'png', width: 400, margin: 2 });
  }

  async generateCheckOutPng(): Promise<Buffer> {
    const url = buildCheckOutUrl();
    return QRCode.toBuffer(url, { type: 'png', width: 400, margin: 2 });
  }
}
