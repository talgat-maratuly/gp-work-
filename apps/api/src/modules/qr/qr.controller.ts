import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { QrService } from './qr.service';

@ApiTags('qr')
@Public()
@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get('checkout')
  @Header('Content-Type', 'image/png')
  async getCheckOutQr(@Res() res: Response) {
    const buffer = await this.qrService.generateCheckOutPng();
    res.send(buffer);
  }

  @Get(':sectionCode')
  @Header('Content-Type', 'image/png')
  async getQr(@Param('sectionCode') sectionCode: string, @Res() res: Response) {
    const buffer = await this.qrService.generatePng(sectionCode);
    res.send(buffer);
  }
}
