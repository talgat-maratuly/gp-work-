import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { QueryFailedError, Repository } from 'typeorm';
import { ProductSource } from '../../common/enums/product-source.enum';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { Product } from '../../entities/product.entity';
import { Section } from '../../entities/section.entity';
import { StockMovement } from '../../entities/stock-movement.entity';
import { User } from '../../entities/user.entity';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ParsedExcelProduct = {
  code: string | null;
  article: string | null;
  name: string;
  unit: string | null;
  accountingPrice: number;
  salePrice: number;
  ourPrice: number;
  markupPercent: number | null;
  quantity: number;
  totalAmount: number;
};

function cleanString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object' && 'result' in value) {
    return cleanString((value as { result?: unknown }).result);
  }
  if (typeof value === 'object' && 'richText' in value) {
    const richText = (value as { richText?: { text?: string }[] }).richText ?? [];
    return cleanString(richText.map((part) => part.text ?? '').join(''));
  }
  const raw =
    typeof value === 'object' && 'text' in value
      ? String((value as { text?: unknown }).text ?? '')
      : String(value);
  const cleaned = raw.trim();
  return cleaned.length ? cleaned : null;
}

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = cleanString(value)?.replace(/\s/g, '').replace(',', '.') ?? '';
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: number): string {
  return value.toFixed(2);
}

function toQuantity(value: number): string {
  return value.toFixed(3);
}

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHeader(value: unknown): string {
  return (cleanString(value) ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '');
}

function productStatus(product: Product): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'INACTIVE' {
  if (!product.isActual) return 'INACTIVE';
  const current = num(product.currentQuantity);
  if (current <= 0) return 'OUT_OF_STOCK';
  if (current <= 5) return 'LOW_STOCK';
  return 'IN_STOCK';
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,
    @InjectRepository(NurseryObject)
    private readonly objectRepo: Repository<NurseryObject>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
  ) {}

  private mapProduct(product: Product) {
    return {
      id: product.id,
      code: product.code,
      article: product.article,
      name: product.name,
      unit: product.unit,
      accountingPrice: num(product.accountingPrice),
      salePrice: num(product.salePrice),
      ourPrice: num(product.ourPrice),
      markupPercent: product.markupPercent == null ? null : num(product.markupPercent),
      initialQuantity: num(product.initialQuantity),
      incomingQuantity: num(product.incomingQuantity),
      outgoingQuantity: num(product.outgoingQuantity),
      currentQuantity: num(product.currentQuantity),
      totalAmount: num(product.totalAmount),
      externalId1C: product.externalId1C,
      code1C: product.code1C,
      source: product.source,
      lastSyncAt: product.lastSyncAt,
      isActual: product.isActual,
      status: productStatus(product),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private mapMovement(row: StockMovement) {
    return {
      id: row.id,
      productId: row.productId,
      type: row.type,
      quantity: num(row.quantity),
      createdById: row.createdById,
      workerName: row.workerName,
      objectId: row.objectId,
      sectionId: row.sectionId,
      purpose: row.purpose,
      comment: row.comment,
      balanceAfter: num(row.balanceAfter),
      createdAt: row.createdAt,
      product: row.product ? this.mapProduct(row.product) : undefined,
      createdBy: row.createdBy
        ? { id: row.createdBy.id, fullName: row.createdBy.fullName }
        : null,
      object: row.object ? { id: row.object.id, name: row.object.name } : null,
      section: row.section ? { id: row.section.id, name: row.section.name, code: row.section.code } : null,
    };
  }

  private recalcProduct(product: Product) {
    const current =
      num(product.initialQuantity) + num(product.incomingQuantity) - num(product.outgoingQuantity);
    product.currentQuantity = toQuantity(current);
    product.totalAmount = toMoney(current * num(product.accountingPrice));
  }

  private async findExisting(parsed: ParsedExcelProduct): Promise<Product | null> {
    if (!parsed.code && !parsed.article) return null;

    const [byCode, byArticle] = await Promise.all([
      parsed.code ? this.productRepo.findOne({ where: { code: parsed.code } }) : null,
      parsed.article ? this.productRepo.findOne({ where: { article: parsed.article } }) : null,
    ]);

    // Same Excel row points to two different products by unique keys.
    if (byCode && byArticle && byCode.id !== byArticle.id) {
      throw new BadRequestException(
        `Конфликт данных импорта: код "${parsed.code}" и артикул "${parsed.article}" относятся к разным товарам`,
      );
    }

    // Article has stricter business meaning during sync, so prefer it.
    return byArticle ?? byCode;
  }

  async findAll(query: ProductQueryDto) {
    const qb = this.productRepo.createQueryBuilder('product').orderBy('product.name', 'ASC');
    if (query.search?.trim()) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.code ILIKE :search OR product.article ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }
    const rows = await qb.getMany();
    return rows.map((p) => this.mapProduct(p));
  }

  async findOne(id: number) {
    const row = await this.productRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Товар не найден');
    return row;
  }

  async findOnePublic(id: number) {
    return this.mapProduct(await this.findOne(id));
  }

  async update(id: number, dto: UpdateProductDto) {
    const row = await this.findOne(id);

    if (dto.code !== undefined) row.code = dto.code?.trim() || null;
    if (dto.article !== undefined) row.article = dto.article?.trim() || null;
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.unit !== undefined) row.unit = dto.unit?.trim() || null;
    if (dto.accountingPrice !== undefined) row.accountingPrice = toMoney(dto.accountingPrice);
    if (dto.salePrice !== undefined) row.salePrice = toMoney(dto.salePrice);
    if (dto.ourPrice !== undefined) row.ourPrice = toMoney(dto.ourPrice);
    if (dto.initialQuantity !== undefined) row.initialQuantity = toQuantity(dto.initialQuantity);
    if (dto.externalId1C !== undefined) row.externalId1C = dto.externalId1C?.trim() || null;
    if (dto.code1C !== undefined) row.code1C = dto.code1C?.trim() || null;
    row.source = ProductSource.MANUAL;
    this.recalcProduct(row);

    try {
      return this.mapProduct(await this.productRepo.save(row));
    } catch (err) {
      if (err instanceof Error && err.message.includes('duplicate')) {
        throw new ConflictException('Товар с таким кодом или артикулом уже существует');
      }
      throw err;
    }
  }

  private detectHeader(row: ExcelJS.Row): Map<string, number> {
    const headers = new Map<string, number>();
    row.eachCell((cell, colNumber) => {
      const normalized = normalizeHeader(cell.value);
      if (normalized) headers.set(normalized, colNumber);
    });
    return headers;
  }

  private getCell(row: ExcelJS.Row, headers: Map<string, number>, aliases: string[]) {
    for (const alias of aliases) {
      const col = headers.get(alias);
      if (col) return row.getCell(col).value;
    }
    return null;
  }

  private parseRow(row: ExcelJS.Row, headers: Map<string, number>): ParsedExcelProduct | null {
    const code = cleanString(this.getCell(row, headers, ['код', 'code']));
    const article = cleanString(this.getCell(row, headers, ['артикул', 'article']));
    const name =
      cleanString(
        this.getCell(row, headers, ['товар', 'название', 'наименование', 'номенклатура', 'name']),
      ) ?? article ?? code;
    if (!name) return null;

    const unit = cleanString(this.getCell(row, headers, ['едизм', 'единицаизмерения', 'unit']));
    const quantity = toNumber(this.getCell(row, headers, ['количество', 'остаток', 'quantity']));
    const accountingPrice = toNumber(
      this.getCell(row, headers, ['учетнаяцена', 'учетнаястоимость', 'accountingprice']),
    );
    const salePrice = toNumber(this.getCell(row, headers, ['ценапродажи', 'saleprice']));
    const ourPrice = toNumber(this.getCell(row, headers, ['нашацена', 'ourprice']));
    const totalAmount = toNumber(this.getCell(row, headers, ['сумма', 'amount', 'total']));
    const markup = this.getCell(row, headers, ['процентынаценка', 'наценка', 'markup']);
    const markupPercent = markup == null ? null : toNumber(markup);

    return {
      code,
      article,
      name,
      unit,
      quantity,
      accountingPrice,
      salePrice,
      ourPrice,
      totalAmount,
      markupPercent,
    };
  }

  private applyExcelProduct(product: Product, parsed: ParsedExcelProduct) {
    product.code = parsed.code;
    product.article = parsed.article;
    product.name = parsed.name;
    product.unit = parsed.unit;
    product.accountingPrice = toMoney(parsed.accountingPrice);
    product.salePrice = toMoney(parsed.salePrice);
    product.ourPrice = toMoney(parsed.ourPrice);
    product.markupPercent = parsed.markupPercent == null ? null : toMoney(parsed.markupPercent);

    // Excel is the source of truth for the stock balance during import.
    product.currentQuantity = toQuantity(parsed.quantity);
    product.initialQuantity = toQuantity(
      parsed.quantity - num(product.incomingQuantity) + num(product.outgoingQuantity),
    );
    product.totalAmount =
      parsed.totalAmount > 0 ? toMoney(parsed.totalAmount) : toMoney(parsed.quantity * parsed.accountingPrice);
    product.source = ProductSource.EXCEL;
    product.lastSyncAt = new Date();
    product.isActual = true;
  }

  async importExcel(buffer: Buffer, user: User, options: { fullSync?: boolean } = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('В Excel-файле нет листов');

    let headerRowNumber = 1;
    let headers = new Map<string, number>();
    for (let i = 1; i <= Math.min(10, worksheet.rowCount); i += 1) {
      const detected = this.detectHeader(worksheet.getRow(i));
      if (detected.has('код') || detected.has('артикул') || detected.has('количество')) {
        headerRowNumber = i;
        headers = detected;
        break;
      }
    }
    if (!headers.size) throw new BadRequestException('Не найдена строка заголовков Excel');

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let markedInactive = 0;
    const seenProductIds = new Set<number>();

    for (let i = headerRowNumber + 1; i <= worksheet.rowCount; i += 1) {
      const parsed = this.parseRow(worksheet.getRow(i), headers);
      if (!parsed || (!parsed.code && !parsed.article)) {
        skipped += 1;
        continue;
      }

      let product: Product | null;
      try {
        product = await this.findExisting(parsed);
      } catch (error) {
        if (error instanceof BadRequestException) {
          skipped += 1;
          continue;
        }
        throw error;
      }
      const isNew = !product;
      product ??= this.productRepo.create({
        incomingQuantity: '0',
        outgoingQuantity: '0',
      });

      this.applyExcelProduct(product, parsed);

      let saved: Product;
      try {
        saved = await this.productRepo.save(product);
      } catch (error) {
        if (error instanceof QueryFailedError && (error as { driverError?: { code?: string } }).driverError?.code === '23505') {
          // Duplicate unique key in source file or race condition: skip this row and continue import.
          skipped += 1;
          continue;
        }
        throw error;
      }
      seenProductIds.add(saved.id);
      await this.movementRepo.save(
        this.movementRepo.create({
          productId: saved.id,
          type: StockMovementType.IMPORT,
          quantity: toQuantity(parsed.quantity),
          createdById: user.id,
          comment: 'Импорт Excel',
          balanceAfter: saved.currentQuantity,
        }),
      );
      if (isNew) created += 1;
      else updated += 1;
    }

    if (options.fullSync) {
      const qb = this.productRepo
        .createQueryBuilder()
        .update(Product)
        .set({ isActual: false })
        .where('source = :source', { source: ProductSource.EXCEL })
        .andWhere('is_actual = true');
      if (seenProductIds.size > 0) {
        qb.andWhere('id NOT IN (:...ids)', { ids: [...seenProductIds] });
      }
      const result = await qb.execute();
      markedInactive = result.affected ?? 0;
    }

    return { created, updated, skipped, markedInactive, total: created + updated };
  }

  async clearImportedProducts() {
    const result = await this.productRepo.delete({ source: ProductSource.EXCEL });
    return { deleted: result.affected ?? 0 };
  }

  async createMovement(dto: CreateStockMovementDto, user: User) {
    if (dto.quantity <= 0) throw new BadRequestException('Количество должно быть больше 0');
    const product = await this.findOne(dto.productId);

    if (dto.objectId) {
      const object = await this.objectRepo.findOne({ where: { id: dto.objectId } });
      if (!object) throw new NotFoundException('Объект не найден');
    }
    if (dto.sectionId) {
      const section = await this.sectionRepo.findOne({ where: { id: dto.sectionId } });
      if (!section) throw new NotFoundException('Участок не найден');
      if (dto.objectId && section.objectId !== dto.objectId) {
        throw new BadRequestException('Участок не относится к выбранному объекту');
      }
    }

    if (dto.type === StockMovementType.INCOME) {
      product.incomingQuantity = toQuantity(num(product.incomingQuantity) + dto.quantity);
    } else if (dto.type === StockMovementType.OUTCOME || dto.type === StockMovementType.WRITE_OFF) {
      const next = num(product.currentQuantity) - dto.quantity;
      if (next < 0) throw new BadRequestException('Недостаточно товара на складе');
      product.outgoingQuantity = toQuantity(num(product.outgoingQuantity) + dto.quantity);
    } else if (dto.type === StockMovementType.CORRECTION) {
      product.initialQuantity = toQuantity(
        dto.quantity - num(product.incomingQuantity) + num(product.outgoingQuantity),
      );
    } else {
      throw new BadRequestException('Этот тип движения создаётся автоматически');
    }

    this.recalcProduct(product);
    const savedProduct = await this.productRepo.save(product);
    const movement = await this.movementRepo.save(
      this.movementRepo.create({
        productId: savedProduct.id,
        type: dto.type,
        quantity: toQuantity(dto.quantity),
        createdById: user.id,
        workerName: dto.workerName?.trim() || null,
        objectId: dto.objectId ?? null,
        sectionId: dto.sectionId ?? null,
        purpose: dto.purpose?.trim() || null,
        comment: dto.comment?.trim() || null,
        balanceAfter: savedProduct.currentQuantity,
      }),
    );
    return this.findMovement(movement.id);
  }

  async findMovement(id: number) {
    const row = await this.movementRepo.findOne({
      where: { id },
      relations: { product: true, createdBy: true, object: true, section: true },
    });
    if (!row) throw new NotFoundException('Движение товара не найдено');
    return this.mapMovement(row);
  }

  async findMovements(query: StockMovementQueryDto, user?: User) {
    const qb = this.movementRepo
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .leftJoinAndSelect('movement.createdBy', 'createdBy')
      .leftJoinAndSelect('movement.object', 'object')
      .leftJoinAndSelect('movement.section', 'section')
      .orderBy('movement.createdAt', 'DESC');
    if (query.productId) {
      qb.andWhere('movement.productId = :productId', { productId: query.productId });
    }
    if (user?.role === UserRole.BRIGADIER) {
      qb.andWhere('movement.createdById = :userId', { userId: user.id });
    }
    const rows = await qb.getMany();
    return rows.map((r) => this.mapMovement(r));
  }

  async buildExportXlsx() {
    const products = await this.productRepo.find({ order: { name: 'ASC' } });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Остатки');
    sheet.columns = [
      { header: 'Код', key: 'code', width: 16 },
      { header: 'Артикул', key: 'article', width: 18 },
      { header: 'Товар', key: 'name', width: 40 },
      { header: 'Ед. изм.', key: 'unit', width: 12 },
      { header: 'Начальный остаток', key: 'initialQuantity', width: 18 },
      { header: 'Приход', key: 'incomingQuantity', width: 14 },
      { header: 'Расход', key: 'outgoingQuantity', width: 14 },
      { header: 'Остаток', key: 'currentQuantity', width: 14 },
      { header: 'Учетная цена', key: 'accountingPrice', width: 16 },
      { header: 'Сумма', key: 'totalAmount', width: 16 },
    ];

    for (const product of products) {
      sheet.addRow(this.mapProduct(product));
    }
    sheet.getRow(1).font = { bold: true };
    return workbook.xlsx.writeBuffer();
  }
}
