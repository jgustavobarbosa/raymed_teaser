import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { asNumber } from '../utils/decimal.util';

@Injectable()
export class LabsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll() {
    const cacheKey = 'labs:all';
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        return this.prisma.lab.findMany({
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: {
                prices: true,
                subscriptions: true,
              },
            },
          },
        });
      },
      3600 // 1 hora
    );
  }

  async findById(id: string) {
    const cacheKey = `lab:${id}`;
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        return this.prisma.lab.findUnique({
          where: { id },
          include: {
            prices: {
              include: {
                medication: true,
              },
              orderBy: { capturedAt: 'desc' },
              take: 10,
            },
            _count: {
              select: {
                prices: true,
                subscriptions: true,
              },
            },
          },
        });
      },
      1800 // 30 minutos
    );
  }

  async getLabRanking() {
    const cacheKey = 'labs:ranking';
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Ranking baseado no menor preço médio por medicamento
        const labs = await this.prisma.lab.findMany({
          include: {
            prices: {
              where: {
                capturedAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // últimos 30 dias
                },
              },
              include: {
                medication: true,
              },
            },
          },
        });

        const labStats = labs.map(lab => {
          const prices = lab.prices.map(p => asNumber(p.value));
          const avgPrice = prices.length > 0 
            ? prices.reduce((sum, price) => sum + price, 0) / prices.length 
            : 0;
          
          const medicationCount = new Set(lab.prices.map(p => p.medicationId)).size;
          
          return {
            id: lab.id,
            name: lab.name,
            cnpj: lab.cnpj,
            avgPrice,
            medicationCount,
            priceCount: prices.length,
          };
        });

        return labStats
          .filter(lab => lab.priceCount > 0)
          .sort((a, b) => a.avgPrice - b.avgPrice);
      },
      1800 // 30 minutos
    );
  }
}
