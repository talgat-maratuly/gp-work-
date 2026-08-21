import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { readFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { Repository } from 'typeorm';
import { AiPlantStatus } from '../../common/enums/ai-plant-status.enum';
import { AiAgronomAnalysis } from '../../entities/ai-agronom-analysis.entity';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { Section } from '../../entities/section.entity';
import { User } from '../../entities/user.entity';
import { CreateAiAnalysisDto } from './dto/create-ai-analysis.dto';

type GeneratedAnalysis = {
  status: AiPlantStatus;
  confidence: number;
  healthPercent: number;
  droughtSigns: boolean;
  burnSigns: boolean;
  weedsPresent: boolean;
  diseaseSigns: boolean;
  pestSigns: boolean;
  yellowingLeaves: boolean;
  nutritionDeficiency: boolean;
  mechanicalDamage: boolean;
  fireDamage: boolean;
  severeDrying: boolean;
  massDieOff: boolean;
  growthStage: string | null;
  aiComment: string;
  recommendations: string[];
  rawModelResponse: string;
  modelName: string;
};

type VisionJson = {
  status?: string;
  confidence?: number;
  healthPercent?: number;
  droughtSigns?: boolean;
  burnSigns?: boolean;
  weedsPresent?: boolean;
  diseaseSigns?: boolean;
  pestSigns?: boolean;
  yellowingLeaves?: boolean;
  nutritionDeficiency?: boolean;
  mechanicalDamage?: boolean;
  fireDamage?: boolean;
  severeDrying?: boolean;
  massDieOff?: boolean;
  growthStage?: string;
  aiComment?: string;
  recommendations?: string[];
};

function parseRecommendations(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function clampPercent(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeStatus(value: unknown): AiPlantStatus {
  if (value === AiPlantStatus.EXCELLENT) return AiPlantStatus.EXCELLENT;
  if (value === AiPlantStatus.GOOD) return AiPlantStatus.GOOD;
  if (value === AiPlantStatus.AVERAGE) return AiPlantStatus.AVERAGE;
  if (value === AiPlantStatus.BAD) return AiPlantStatus.BAD;
  if (value === AiPlantStatus.CRITICAL) return AiPlantStatus.CRITICAL;
  return AiPlantStatus.AVERAGE;
}

function enforceCriticalVisualRules(status: AiPlantStatus, analysis: VisionJson): AiPlantStatus {
  const hasSevereDamage =
    asBoolean(analysis.fireDamage) ||
    asBoolean(analysis.severeDrying) ||
    asBoolean(analysis.massDieOff);
  if (!hasSevereDamage) return status;
  if (status === AiPlantStatus.EXCELLENT || status === AiPlantStatus.GOOD) {
    return AiPlantStatus.BAD;
  }
  return status;
}

function mimeFromPath(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

@Injectable()
export class AiAgronomService {
  constructor(
    @InjectRepository(AiAgronomAnalysis)
    private readonly analysisRepo: Repository<AiAgronomAnalysis>,
    @InjectRepository(NurseryObject)
    private readonly objectRepo: Repository<NurseryObject>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    private readonly configService: ConfigService,
  ) {}

  private mapAnalysis(row: AiAgronomAnalysis) {
    return {
      id: row.id,
      createdById: row.createdById,
      objectId: row.objectId,
      sectionId: row.sectionId,
      culture: row.culture,
      photoUrl: row.photoUrl,
      status: row.status,
      confidence: row.confidence,
      healthPercent: row.healthPercent,
      droughtSigns: row.droughtSigns,
      burnSigns: row.burnSigns,
      weedsPresent: row.weedsPresent,
      diseaseSigns: row.diseaseSigns,
      pestSigns: row.pestSigns,
      yellowingLeaves: row.yellowingLeaves,
      nutritionDeficiency: row.nutritionDeficiency,
      mechanicalDamage: row.mechanicalDamage,
      fireDamage: row.fireDamage,
      severeDrying: row.severeDrying,
      massDieOff: row.massDieOff,
      growthStage: row.growthStage,
      aiComment: row.aiComment,
      recommendations: parseRecommendations(row.recommendations),
      agronomistComment: row.agronomistComment,
      modelName: row.modelName,
      createdAt: row.createdAt,
      createdBy: row.createdBy
        ? { id: row.createdBy.id, fullName: row.createdBy.fullName }
        : null,
      object: row.object ? { id: row.object.id, name: row.object.name } : null,
      section: row.section
        ? {
            id: row.section.id,
            name: row.section.name,
            code: row.section.code,
            culture: row.section.culture,
          }
        : null,
    };
  }

  private async imageToDataUrl(photoUrl: string) {
    let pathName = photoUrl;
    try {
      pathName = new URL(photoUrl).pathname;
    } catch {
      pathName = photoUrl;
    }

    if (!pathName.startsWith('/uploads/photos/')) {
      throw new BadRequestException('Фото должно быть загружено через систему');
    }

    const fileName = basename(pathName);
    const filePath = join(process.cwd(), 'uploads', 'photos', fileName);
    const buffer = await readFile(filePath);
    return `data:${mimeFromPath(filePath)};base64,${buffer.toString('base64')}`;
  }

  private parseVisionJson(content: string): VisionJson {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned) as VisionJson;
    } catch {
      throw new BadRequestException('AI вернул некорректный формат анализа');
    }
  }

  private async analyzeWithVision(dto: CreateAiAnalysisDto): Promise<GeneratedAnalysis> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('AI Vision не настроен. Укажите OPENAI_API_KEY на backend.');
    }

    const model = this.configService.get<string>('OPENAI_VISION_MODEL', 'gpt-4o');
    const imageDataUrl = await this.imageToDataUrl(dto.photoUrl);
    const prompt = [
      'Ты профессиональный AI-агроном. Проанализируй именно загруженное изображение растения/участка.',
      'Верни только JSON без markdown.',
      'Поля JSON:',
      'status: один из EXCELLENT, GOOD, AVERAGE, BAD, CRITICAL.',
      'confidence: число 0-100, вероятность определения.',
      'healthPercent: число 0-100, общее здоровье растения.',
      'droughtSigns, burnSigns, weedsPresent, diseaseSigns, pestSigns, yellowingLeaves, nutritionDeficiency, mechanicalDamage, fireDamage, severeDrying, massDieOff: boolean.',
      'growthStage: строка с предполагаемой стадией роста.',
      'aiComment: подробный комментарий на русском языке.',
      'recommendations: массив конкретных рекомендаций по уходу на русском языке.',
      'Важно: если видны признаки пожара, обгоревшей почвы, сильного высыхания или массового отмирания растений, статус НЕ может быть EXCELLENT или GOOD. В таком случае выбери AVERAGE, BAD или CRITICAL и объясни причины.',
      `Культура: ${dto.culture?.trim() || 'не указана'}.`,
      `Комментарий агронома: ${dto.agronomistComment?.trim() || 'не указан'}.`,
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: imageDataUrl, detail: 'high' },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`AI Vision не смог выполнить анализ: ${text}`);
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new BadRequestException('AI Vision не вернул анализ изображения');

    const parsed = this.parseVisionJson(content);
    const status = enforceCriticalVisualRules(normalizeStatus(parsed.status), parsed);
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String).filter(Boolean)
      : [];

    return {
      status,
      confidence: clampPercent(parsed.confidence, 0),
      healthPercent: clampPercent(parsed.healthPercent, 0),
      droughtSigns: asBoolean(parsed.droughtSigns),
      burnSigns: asBoolean(parsed.burnSigns),
      weedsPresent: asBoolean(parsed.weedsPresent),
      diseaseSigns: asBoolean(parsed.diseaseSigns),
      pestSigns: asBoolean(parsed.pestSigns),
      yellowingLeaves: asBoolean(parsed.yellowingLeaves),
      nutritionDeficiency: asBoolean(parsed.nutritionDeficiency),
      mechanicalDamage: asBoolean(parsed.mechanicalDamage),
      fireDamage: asBoolean(parsed.fireDamage),
      severeDrying: asBoolean(parsed.severeDrying),
      massDieOff: asBoolean(parsed.massDieOff),
      growthStage: parsed.growthStage?.trim() || null,
      aiComment: parsed.aiComment?.trim() || 'AI не смог сформировать подробный комментарий.',
      recommendations: recommendations.length
        ? recommendations
        : ['Провести повторный осмотр растения и проверить условия ухода.'],
      rawModelResponse: content,
      modelName: model,
    };
  }

  async create(dto: CreateAiAnalysisDto, user: User) {
    const object = await this.objectRepo.findOne({ where: { id: dto.objectId } });
    if (!object) throw new NotFoundException('Объект не найден');

    if (dto.sectionId) {
      const section = await this.sectionRepo.findOne({ where: { id: dto.sectionId } });
      if (!section) throw new NotFoundException('Участок не найден');
      if (section.objectId !== dto.objectId) {
        throw new BadRequestException('Участок не относится к выбранному объекту');
      }
    }

    const generated = await this.analyzeWithVision(dto);
    const row = await this.analysisRepo.save(
      this.analysisRepo.create({
        createdById: user.id,
        objectId: dto.objectId,
        sectionId: dto.sectionId ?? null,
        culture: dto.culture?.trim() || null,
        photoUrl: dto.photoUrl,
        status: generated.status,
        confidence: generated.confidence,
        healthPercent: generated.healthPercent,
        droughtSigns: generated.droughtSigns,
        burnSigns: generated.burnSigns,
        weedsPresent: generated.weedsPresent,
        diseaseSigns: generated.diseaseSigns,
        pestSigns: generated.pestSigns,
        yellowingLeaves: generated.yellowingLeaves,
        nutritionDeficiency: generated.nutritionDeficiency,
        mechanicalDamage: generated.mechanicalDamage,
        fireDamage: generated.fireDamage,
        severeDrying: generated.severeDrying,
        massDieOff: generated.massDieOff,
        growthStage: generated.growthStage,
        aiComment: generated.aiComment,
        recommendations: JSON.stringify(generated.recommendations),
        agronomistComment: dto.agronomistComment?.trim() || null,
        modelName: generated.modelName,
        rawModelResponse: generated.rawModelResponse,
      }),
    );
    return this.findOne(row.id);
  }

  async findOne(id: number) {
    const row = await this.analysisRepo.findOne({
      where: { id },
      relations: { createdBy: true, object: true, section: true },
    });
    if (!row) throw new NotFoundException('AI-анализ не найден');
    return this.mapAnalysis(row);
  }

  async findAll() {
    const rows = await this.analysisRepo.find({
      relations: { createdBy: true, object: true, section: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.map((row) => this.mapAnalysis(row));
  }

  async getStats() {
    const rows = await this.analysisRepo.find({
      relations: { object: true },
      order: { createdAt: 'DESC' },
    });
    const byStatus = {
      healthy: rows.filter(
        (row) => row.status === AiPlantStatus.EXCELLENT || row.status === AiPlantStatus.GOOD,
      ).length,
      attention: rows.filter((row) => row.status === AiPlantStatus.AVERAGE).length,
      problem: rows.filter(
        (row) => row.status === AiPlantStatus.BAD || row.status === AiPlantStatus.CRITICAL,
      ).length,
    };

    const problemObjects = new Map<string, number>();
    for (const row of rows) {
      if (row.status === AiPlantStatus.EXCELLENT || row.status === AiPlantStatus.GOOD) continue;
      const name = row.object?.name ?? '—';
      problemObjects.set(name, (problemObjects.get(name) ?? 0) + 1);
    }

    return {
      total: rows.length,
      ...byStatus,
      problemObjects: [...problemObjects.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([objectName, count]) => ({ objectName, count })),
    };
  }
}
