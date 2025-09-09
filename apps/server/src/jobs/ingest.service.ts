import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { createRayClient, RayMedication, RayPrice } from '@raymed/shared';
import { createManyWithOptions } from '../utils/dedupe.util';
import { toJsonValue } from '../utils/json.util';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async ingestLatestPrices() {
    const rayClient = createRayClient();
    const result = {
      medicationsProcessed: 0,
      pricesIngested: 0,
      errors: [] as string[],
    };

    try {
      // Buscar timestamp da última ingestão
      const lastIngest = await this.getLastIngestTimestamp();
      this.logger.log(`Última ingestão: ${lastIngest?.toISOString() || 'nunca'}`);

      // 1. Sincronizar medicamentos
      await this.syncMedications(rayClient, result);

      // 2. Sincronizar laboratórios
      await this.syncLabs(rayClient, result);

      // 3. Ingerir preços mais recentes
      await this.ingestPrices(rayClient, lastIngest, result);

      // Atualizar timestamp da última ingestão
      await this.updateLastIngestTimestamp();

      // Invalidar caches relacionados
      await this.cache.invalidatePattern('medications:*');
      await this.cache.invalidatePattern('prices:*');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(`Erro geral na ingestão: ${errorMsg}`);
      this.logger.error('Erro na ingestão:', error);
    }

    return result;
  }

  private async syncMedications(rayClient: any, result: any) {
    try {
      this.logger.log('Sincronizando medicamentos...');
      
      const rayMedications = await rayClient.listMedications({ limit: 1000 });
      
      for (const rayMed of rayMedications) {
        try {
          await this.upsertMedication(rayMed);
          result.medicationsProcessed++;
        } catch (error) {
          const errorMsg = `Erro ao processar medicamento ${rayMed.codigo}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          result.errors.push(errorMsg);
          this.logger.warn(errorMsg);
        }
      }

      this.logger.log(`✅ ${result.medicationsProcessed} medicamentos processados`);
    } catch (error) {
      const errorMsg = `Erro ao sincronizar medicamentos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      result.errors.push(errorMsg);
      this.logger.error(errorMsg);
    }
  }

  private async syncLabs(rayClient: any, result: any) {
    try {
      this.logger.log('Sincronizando laboratórios...');
      
      const rayLabs = await rayClient.listLabs();
      
      for (const rayLab of rayLabs) {
        try {
          await this.prisma.lab.upsert({
            where: { name: rayLab.nome },
            update: {
              cnpj: rayLab.cnpj,
            },
            create: {
              name: rayLab.nome,
              cnpj: rayLab.cnpj,
            },
          });
        } catch (error) {
          const errorMsg = `Erro ao processar laboratório ${rayLab.nome}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          result.errors.push(errorMsg);
          this.logger.warn(errorMsg);
        }
      }

      this.logger.log(`✅ Laboratórios sincronizados`);
    } catch (error) {
      const errorMsg = `Erro ao sincronizar laboratórios: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      result.errors.push(errorMsg);
      this.logger.error(errorMsg);
    }
  }

  private async ingestPrices(rayClient: any, since: Date | null, result: any) {
    try {
      this.logger.log('Ingerindo preços...');
      
      // Buscar preços mais recentes
      const rayPrices = await rayClient.getLatestPrices(since);
      
      // Processar em lotes
      const batchSize = 100;
      for (let i = 0; i < rayPrices.length; i += batchSize) {
        const batch = rayPrices.slice(i, i + batchSize);
        await this.processPriceBatch(batch, result);
      }

      this.logger.log(`✅ ${result.pricesIngested} preços ingeridos`);
    } catch (error) {
      const errorMsg = `Erro ao ingerir preços: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      result.errors.push(errorMsg);
      this.logger.error(errorMsg);
    }
  }

  private async processPriceBatch(rayPrices: RayPrice[], result: any) {
    const pricesData = [];

    for (const rayPrice of rayPrices) {
      try {
        // Buscar medicamento
        const medication = await this.prisma.medication.findUnique({
          where: { code: rayPrice.medicamentoCodigo },
        });

        if (!medication) {
          result.errors.push(`Medicamento não encontrado: ${rayPrice.medicamentoCodigo}`);
          continue;
        }

        // Buscar laboratório (opcional)
        let labId = null;
        if (rayPrice.laboratorioId) {
          const lab = await this.prisma.lab.findFirst({
            where: { 
              OR: [
                { id: rayPrice.laboratorioId },
                { name: rayPrice.laboratorioId }, // Fallback se vier nome
              ]
            },
          });
          labId = lab?.id || null;
        }

        pricesData.push({
          medicationId: medication.id,
          labId,
          source: 'RayAPI',
          currency: rayPrice.moeda || 'BRL',
          value: rayPrice.preco,
          capturedAt: new Date(rayPrice.dataCaptura),
          meta: toJsonValue({
            fonte: rayPrice.fonte,
            metadados: rayPrice.metadados,
          }),
        });
      } catch (error) {
        result.errors.push(`Erro ao processar preço: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }

    // Inserir lote no banco
    if (pricesData.length > 0) {
      try {
        // Usar função que trata SQLite vs PostgreSQL automaticamente
        await createManyWithOptions(this.prisma.price, pricesData);
        result.pricesIngested += pricesData.length;
      } catch (error) {
        result.errors.push(`Erro ao inserir lote de preços: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }
  }

  private async upsertMedication(rayMed: RayMedication) {
    return this.prisma.medication.upsert({
      where: { code: rayMed.codigo },
      update: {
        name: rayMed.nome,
        activeIngredient: rayMed.principioAtivo,
        category: rayMed.categoria,
      },
      create: {
        code: rayMed.codigo,
        name: rayMed.nome,
        activeIngredient: rayMed.principioAtivo,
        category: rayMed.categoria,
      },
    });
  }

  private async getLastIngestTimestamp(): Promise<Date | null> {
    const lastJob = await this.prisma.jobRun.findFirst({
      where: {
        jobName: 'ingest',
        status: 'completed',
      },
      orderBy: {
        endedAt: 'desc',
      },
    });

    return lastJob?.endedAt || null;
  }

  private async updateLastIngestTimestamp() {
    await this.prisma.systemMetric.upsert({
      where: { name: 'last_ingest_timestamp' },
      update: { 
        value: Date.now(),
      },
      create: { 
        name: 'last_ingest_timestamp', 
        value: Date.now(),
        tags: toJsonValue({ type: 'timestamp' }),
      },
    });
  }

  // Método para executar ingestão manual
  async runManualIngest() {
    this.logger.log('🔄 Executando ingestão manual...');
    return this.ingestLatestPrices();
  }

  // Método para ingerir dados históricos
  async ingestHistoricalData(medicationCode: string, days: number = 90) {
    const rayClient = createRayClient();
    const result = {
      pricesIngested: 0,
      errors: [] as string[],
    };

    try {
      const medication = await this.prisma.medication.findUnique({
        where: { code: medicationCode },
      });

      if (!medication) {
        throw new Error(`Medicamento não encontrado: ${medicationCode}`);
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      this.logger.log(`Ingerindo dados históricos de ${medicationCode} (${days} dias)`);

      const priceHistory = await rayClient.getPriceHistory(medicationCode, {
        from: startDate,
        to: endDate,
      });

      if (priceHistory.historico) {
        const pricesData = priceHistory.historico.map(item => ({
          medicationId: medication.id,
          labId: null, // Será preenchido se encontrarmos o lab
          source: 'RayAPI_Historical',
          currency: 'BRL',
          value: item.preco,
          capturedAt: new Date(item.data),
          meta: toJsonValue({
            laboratorio: item.laboratorio,
            tipo: 'historico',
          }),
        }));

        // Usar função que trata SQLite vs PostgreSQL automaticamente
        await createManyWithOptions(this.prisma.price, pricesData);

        result.pricesIngested = pricesData.length;
      }

      this.logger.log(`✅ ${result.pricesIngested} preços históricos ingeridos para ${medicationCode}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      result.errors.push(errorMsg);
      this.logger.error('Erro na ingestão histórica:', error);
    }

    return result;
  }
}
