import { Controller, Get, Header, Param, ParseIntPipe, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { QrService } from './qr.service';

@ApiTags('qr')
@Public()
@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get('form/:sectionCode')
  @Header('Cache-Control', 'no-store')
  publicForm(@Param('sectionCode') code: string) {
    return this.qrService.publicForm({ code: code.trim() });
  }

  @Get('form-by-id/:id')
  @Header('Cache-Control', 'no-store')
  legacyForm(@Param('id', ParseIntPipe) id: number) {
    return this.qrService.publicForm({ id });
  }

  @Get(':sectionCode')
  @Header('Content-Type', 'image/png')
  async getQr(@Param('sectionCode') sectionCode: string, @Res() res: Response) {
    const buffer = await this.qrService.generatePng(sectionCode);
    res.send(buffer);
  }
}
