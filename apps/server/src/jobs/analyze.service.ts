import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { calculateEWMA } from '@raymed/shared';
import { asNumber, calculatePercentageChange } from '../utils/decimal.util';
import { toJsonValue } from '../utils/json.util';

@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyzeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async analyzeAllSubscriptions() {
    const result = {
      subscriptionsProcessed: 0,
      alertsGenerated: 0,
      errors: [] as string[],
    };

    try {
      // Buscar todas as inscrições ativas
      const subscriptions = await this.prisma.subscription.findMany({
        where: { isActive: true },
        include: {
          user: true,
          medication: {
            include: {
              prices: {
                where: {
                  capturedAt: {
                    gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // últimos 90 dias
                  },
                },
                orderBy: { capturedAt: 'desc' },
                take: 100,
              },
            },
          },
          lab: true,
        },
      });

      this.logger.log(`Analisando ${subscriptions.length} inscrições ativas...`);

      for (const subscription of subscriptions) {
        try {
          await this.analyzeSubscription(subscription, result);
          result.subscriptionsProcessed++;
        } catch (error) {
          const errorMsg = `Erro ao analisar inscrição ${subscription.id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          result.errors.push(errorMsg);
          this.logger.warn(errorMsg);
        }
      }

      this.logger.log(`✅ Análise concluída: ${result.alertsGenerated} alertas gerados`);
    } catch (error) {
      const errorMsg = `Erro geral na análise: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      result.errors.push(errorMsg);
      this.logger.error(errorMsg);
    }

    return result;
  }

  private async analyzeSubscription(subscription: any, result: any) {
    const { medication, lab, user } = subscription;
    
    // Filtrar preços por laboratório se especificado
    let relevantPrices = medication.prices;
    if (lab) {
      relevantPrices = medication.prices.filter(p => p.labId === lab.id);
    }

    if (relevantPrices.length === 0) {
      return;
    }

    // Preço atual (mais recente)
    const currentPrice = relevantPrices[0];
    const currentValue = asNumber(currentPrice.value);

    // Verificar se já foi gerado alerta para este preço
    const existingAlert = await this.prisma.alert.findFirst({
      where: {
        userId: user.id,
        medicationId: medication.id,
        priceId: currentPrice.id,
      },
    });

    if (existingAlert) {
      return; // Já foi processado
    }

    // 1. Verificar alerta de preço alvo
    if (subscription.targetPrice && currentValue <= asNumber(subscription.targetPrice)) {
      await this.createAlert({
        userId: user.id,
        medicationId: medication.id,
        priceId: currentPrice.id,
        reason: 'TARGET_PRICE',
        snapshot: toJsonValue({
          currentPrice: currentValue,
          targetPrice: asNumber(subscription.targetPrice),
          labName: currentPrice.lab?.name,
          medicationName: medication.name,
        }),
      });
      result.alertsGenerated++;
      this.logger.log(`🎯 Alerta de preço alvo: ${medication.name} - R$ ${currentValue}`);
      return;
    }

    // 2. Verificar queda percentual
    if (subscription.minDropPct && relevantPrices.length >= 2) {
      const baseline = await this.calculateBaseline(relevantPrices);
      const dropPercentage = calculatePercentageChange(baseline, currentValue);

      if (dropPercentage <= -(subscription.minDropPct * 100)) {
        await this.createAlert({
          userId: user.id,
          medicationId: medication.id,
          priceId: currentPrice.id,
          reason: 'DROP_PCT',
          diffPct: dropPercentage,
          snapshot: toJsonValue({
            currentPrice: currentValue,
            baseline,
            dropPercentage,
            minDropPct: subscription.minDropPct,
            labName: currentPrice.lab?.name,
            medicationName: medication.name,
          }),
        });
        result.alertsGenerated++;
        this.logger.log(`📉 Alerta de queda: ${medication.name} - ${dropPercentage.toFixed(1)}%`);
        return;
      }
    }

    // 3. Verificar variação diária significativa (spike)
    const prices24h = relevantPrices.filter(p => 
      p.capturedAt >= new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (prices24h.length >= 2) {
      const oldestPrice24h = prices24h[prices24h.length - 1];
      const dailyVariation = Math.abs(
        calculatePercentageChange(asNumber(oldestPrice24h.value), currentValue)
      );

      const spikeThreshold = 5; // 5% de variação diária
      if (dailyVariation >= spikeThreshold) {
        await this.createAlert({
          userId: user.id,
          medicationId: medication.id,
          priceId: currentPrice.id,
          reason: 'SPIKE',
          diffPct: dailyVariation,
          snapshot: toJsonValue({
            currentPrice: currentValue,
            previousPrice: asNumber(oldestPrice24h.value),
            dailyVariation,
            spikeThreshold,
            labName: currentPrice.lab?.name,
            medicationName: medication.name,
          }),
        });
        result.alertsGenerated++;
        this.logger.log(`⚡ Alerta de variação: ${medication.name} - ${dailyVariation.toFixed(1)}%`);
      }
    }
  }

  private async calculateBaseline(prices: any[]): Promise<number> {
    // Usar últimos 30 dias para baseline
    const prices30d = prices.filter(p => 
      p.capturedAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    if (prices30d.length === 0) {
      return asNumber(prices[0]?.value) || 0;
    }

    // Calcular EWMA (Exponential Weighted Moving Average)
    const values = prices30d
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())
      .map(p => asNumber(p.value));
    
    const ewmaValues = calculateEWMA(values, 0.3);
    return ewmaValues[ewmaValues.length - 1] || values[values.length - 1];
  }

  private async createAlert(data: {
    userId: string;
    medicationId: string;
    priceId: string;
    reason: string;
    diffPct?: number;
    snapshot: any;
  }) {
    return this.prisma.alert.create({
      data: {
        userId: data.userId,
        medicationId: data.medicationId,
        priceId: data.priceId,
        reason: data.reason,
        diffPct: data.diffPct,
        snapshot: data.snapshot,
        createdAt: new Date(),
        // sentAt será preenchido pelo NotifyService
      },
    });
  }

  // Método para executar análise manual
  async runManualAnalysis() {
    this.logger.log('🔍 Executando análise manual...');
    return this.analyzeAllSubscriptions();
  }

  // Analisar inscrição específica
  async analyzeSpecificSubscription(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        user: true,
        medication: {
          include: {
            prices: {
              where: {
                capturedAt: {
                  gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                },
              },
              orderBy: { capturedAt: 'desc' },
              take: 100,
            },
          },
        },
        lab: true,
      },
    });

    if (!subscription) {
      throw new Error(`Inscrição ${subscriptionId} não encontrada`);
    }

    const result = {
      subscriptionsProcessed: 0,
      alertsGenerated: 0,
      errors: [] as string[],
    };

    await this.analyzeSubscription(subscription, result);
    result.subscriptionsProcessed = 1;

    return result;
  }

  // Obter estatísticas de alertas
  async getAlertStatistics() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      alertsLast24h,
      alertsLast7d,
      alertsLast30d,
      alertsByReason,
      topMedications,
    ] = await Promise.all([
      this.prisma.alert.count({
        where: { createdAt: { gte: last24h } },
      }),
      this.prisma.alert.count({
        where: { createdAt: { gte: last7d } },
      }),
      this.prisma.alert.count({
        where: { createdAt: { gte: last30d } },
      }),
      this.prisma.alert.groupBy({
        by: ['reason'],
        where: { createdAt: { gte: last30d } },
        _count: { reason: true },
      }),
      this.prisma.alert.groupBy({
        by: ['medicationId'],
        where: { createdAt: { gte: last30d } },
        _count: { medicationId: true },
        orderBy: { _count: { medicationId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      counts: {
        last24h: alertsLast24h,
        last7d: alertsLast7d,
        last30d: alertsLast30d,
      },
      byReason: alertsByReason.reduce((acc, item) => {
        acc[item.reason] = item._count.reason;
        return acc;
      }, {} as Record<string, number>),
      topMedications: topMedications.map(item => ({
        medicationId: item.medicationId,
        alertCount: item._count.medicationId,
      })),
    };
  }
}
