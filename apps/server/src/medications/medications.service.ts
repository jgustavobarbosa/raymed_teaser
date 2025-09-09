import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { GetMedicationsQueryDto, MedicationResponseDto, MedicationDetailDto } from './dto/medication.dto';
import { calculateLinearProjection } from '@raymed/shared';
import { asNumber, calculatePercentageChange } from '../utils/decimal.util';

@Injectable()
export class MedicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll(query: GetMedicationsQueryDto) {
    const cacheKey = `medications:list:${JSON.stringify(query)}`;
    
    return this.cache.getOrSet(
      cacheKey,
      () => this._findAllFromDB(query),
      300 // 5 minutos
    );
  }

  private async _findAllFromDB(query: GetMedicationsQueryDto) {
    const {
      search,
      category,
      labId,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
      minPrice,
      maxPrice,
    } = query;

    const skip = (page - 1) * limit;

    // Construir filtros
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { activeIngredient: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    // Query principal
    const medications = await this.prisma.medication.findMany({
      where,
      include: {
        prices: {
          where: {
            ...(labId && { labId }),
            capturedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // últimos 30 dias
            },
          },
          include: {
            lab: true,
          },
          orderBy: {
            capturedAt: 'desc',
          },
        },
      },
      skip,
      take: limit,
    });

    // Processar dados
    const processedMedications: MedicationResponseDto[] = [];

    for (const medication of medications) {
      if (medication.prices.length === 0) continue;

      // Preço atual (mais recente)
      const latestPrice = medication.prices[0];
      
      // Aplicar filtro de preço se especificado
      const currentValue = asNumber(latestPrice.value);
      if (minPrice && currentValue < minPrice) continue;
      if (maxPrice && currentValue > maxPrice) continue;

      // Calcular variações
      const prices24h = medication.prices.filter(p => 
        p.capturedAt >= new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      const prices30d = medication.prices.filter(p => 
        p.capturedAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );

      const variation24h = prices24h.length > 1 
        ? calculatePercentageChange(
            prices24h[prices24h.length - 1].value,
            prices24h[0].value          )
        : 0;

      const variation30d = prices30d.length > 1
        ? calculatePercentageChange(
            prices30d[prices30d.length - 1].value,
            prices30d[0].value          )
        : 0;

      // Laboratório com menor preço
      const labPrices = new Map<string, { price: number; labName: string; labId: string }>();
      
      medication.prices.forEach(price => {
        if (!price.lab) return;
        
        const labId = price.lab.id;
        const current = labPrices.get(labId);
        
        const priceValue = asNumber(price.value);
        if (!current || priceValue < current.price) {
          labPrices.set(labId, {
            price: priceValue,
            labName: price.lab.name,
            labId: price.lab.id,
          });
        }
      });

      const lowestPriceLab = Array.from(labPrices.values())
        .sort((a, b) => a.price - b.price)[0];

      processedMedications.push({
        id: medication.id,
        code: medication.code,
        name: medication.name,
        activeIngredient: medication.activeIngredient,
        category: medication.category,
        createdAt: medication.createdAt,
        currentPrice: {
          value: currentValue,
          labName: latestPrice.lab?.name || 'N/A',
          labId: latestPrice.lab?.id || '',
          capturedAt: latestPrice.capturedAt,
        },
        variation24h,
        variation30d,
        lowestPriceLab,
      });
    }

    // Ordenação
    processedMedications.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'price':
          aValue = a.currentPrice?.value || 0;
          bValue = b.currentPrice?.value || 0;
          break;
        case 'variation24h':
          aValue = a.variation24h || 0;
          bValue = b.variation24h || 0;
          break;
        case 'variation30d':
          aValue = a.variation30d || 0;
          bValue = b.variation30d || 0;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    // Contar total
    const total = await this.prisma.medication.count({ where });

    return {
      data: processedMedications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByCode(code: string): Promise<MedicationDetailDto | null> {
    const cacheKey = `medication:detail:${code}`;
    
    return this.cache.getOrSet(
      cacheKey,
      () => this._findByCodeFromDB(code),
      300 // 5 minutos
    );
  }

  private async _findByCodeFromDB(code: string): Promise<MedicationDetailDto | null> {
    const medication = await this.prisma.medication.findUnique({
      where: { code },
      include: {
        prices: {
          where: {
            capturedAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // últimos 90 dias
            },
          },
          include: {
            lab: true,
          },
          orderBy: {
            capturedAt: 'desc',
          },
        },
      },
    });

    if (!medication) return null;

    // Histórico de preços
    const priceHistory = medication.prices.map(price => ({
      date: price.capturedAt,
      price: asNumber(price.value),
      labName: price.lab?.name,
      labId: price.lab?.id,
    }));

    // Preços por laboratório
    const labPricesMap = new Map<string, {
      labId: string;
      labName: string;
      prices: Array<{ price: number; date: Date }>;
    }>();

    medication.prices.forEach(price => {
      if (!price.lab) return;
      
      const labId = price.lab.id;
      if (!labPricesMap.has(labId)) {
        labPricesMap.set(labId, {
          labId: price.lab.id,
          labName: price.lab.name,
          prices: [],
        });
      }
      
      labPricesMap.get(labId)!.prices.push({
        price: asNumber(price.value),
        date: price.capturedAt,
      });
    });

    const labPrices = Array.from(labPricesMap.values()).map(lab => {
      const sortedPrices = lab.prices.sort((a, b) => b.date.getTime() - a.date.getTime());
      const currentPrice = sortedPrices[0]?.price || 0;
      const lastUpdate = sortedPrices[0]?.date || new Date();
      
      // Variação 24h
      const prices24h = lab.prices.filter(p => 
        p.date >= new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      const variation24h = prices24h.length > 1
        ? calculatePercentageChange(
            prices24h[prices24h.length - 1].price,
            prices24h[0].price
          )
        : undefined;

      return {
        labId: lab.labId,
        labName: lab.labName,
        currentPrice,
        lastUpdate,
        variation24h,
      };
    });

    // Estatísticas
    const allPrices = medication.prices.map(p => asNumber(p.value));
    const statistics = {
      minPrice: Math.min(...allPrices),
      maxPrice: Math.max(...allPrices),
      avgPrice: allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length,
      medianPrice: this.calculateMedian(allPrices),
      lastUpdate: medication.prices[0]?.capturedAt || new Date(),
    };

    // Projeção simples (últimos 30 dias)
    const recentPrices = medication.prices
      .filter(p => p.capturedAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

    const projection = recentPrices.length > 2
      ? calculateLinearProjection(
          recentPrices.map(p => asNumber(p.value)),
          recentPrices.map(p => p.capturedAt),
          30
        ).map(p => ({
          date: p.date,
          predictedPrice: p.value,
          confidence: p.confidence,
        }))
      : undefined;

    return {
      id: medication.id,
      code: medication.code,
      name: medication.name,
      activeIngredient: medication.activeIngredient,
      category: medication.category,
      createdAt: medication.createdAt,
      priceHistory,
      labPrices,
      statistics,
      projection,
    };
  }

  async getCategories(): Promise<string[]> {
    const cacheKey = 'medications:categories';
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const result = await this.prisma.medication.findMany({
          select: { category: true },
          where: { category: { not: null } },
          distinct: ['category'],
        });
        
        return result
          .map(item => item.category!)
          .filter(Boolean)
          .sort();
      },
      3600 // 1 hora
    );
  }

  async getRecentDrops(limit: number = 10): Promise<MedicationResponseDto[]> {
    const cacheKey = `medications:recent_drops:${limit}`;
    
    return this.cache.getOrSet(
      cacheKey,
      () => this._getRecentDropsFromDB(limit),
      300 // 5 minutos
    );
  }

  private async _getRecentDropsFromDB(limit: number): Promise<MedicationResponseDto[]> {
    // Buscar medicamentos com preços dos últimos 7 dias
    const medications = await this.prisma.medication.findMany({
      include: {
        prices: {
          where: {
            capturedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
          include: {
            lab: true,
          },
          orderBy: {
            capturedAt: 'desc',
          },
        },
      },
    });

    const dropsData: Array<MedicationResponseDto & { dropPercentage: number }> = [];

    for (const medication of medications) {
      if (medication.prices.length < 2) continue;

      const latestPrice = medication.prices[0];
      const prices7d = medication.prices.filter(p => 
        p.capturedAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      if (prices7d.length < 2) continue;

      const oldestPrice = prices7d[prices7d.length - 1];
      const dropPercentage = calculatePercentageChange(
        oldestPrice.value,
        latestPrice.value      );

      // Apenas quedas significativas (> 5%)
      if (dropPercentage >= -5) continue;

        dropsData.push({
          id: medication.id,
          code: medication.code,
          name: medication.name,
          activeIngredient: medication.activeIngredient,
          category: medication.category,
          createdAt: medication.createdAt,
          currentPrice: {
            value: asNumber(latestPrice.value),
            labName: latestPrice.lab?.name || 'N/A',
            labId: latestPrice.lab?.id || '',
            capturedAt: latestPrice.capturedAt,
          },
          variation24h: dropPercentage,
          dropPercentage,
        });
    }

    // Ordenar por maior queda
    dropsData.sort((a, b) => a.dropPercentage - b.dropPercentage);

    return dropsData.slice(0, limit);
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }
}
