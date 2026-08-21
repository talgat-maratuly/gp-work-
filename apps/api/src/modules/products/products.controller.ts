import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
@Roles(UserRole.ADMIN, UserRole.BRIGADIER)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('import-excel')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  importExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Query('fullSync') fullSync?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Загрузите Excel-файл');
    }
    return this.productsService.importExcel(file.buffer, user, {
      fullSync: fullSync === 'true',
    });
  }

  @Delete('imported')
  @Roles(UserRole.ADMIN)
  clearImportedProducts() {
    return this.productsService.clearImportedProducts();
  }

  @Get('export.xlsx')
  @Roles(UserRole.ADMIN)
  async exportProducts(@Res() res: Response) {
    const buffer = await this.productsService.buildExportXlsx();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="ostatki_sklad.xlsx"');
    res.send(Buffer.from(buffer));
  }

  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOnePublic(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }
}
