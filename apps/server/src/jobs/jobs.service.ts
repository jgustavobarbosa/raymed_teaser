import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IngestService } from './ingest.service';
import { AnalyzeService } from './analyze.service';
import { NotifyService } from './notify.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ingestService: IngestService,
    private readonly analyzeService: AnalyzeService,
    private readonly notifyService: NotifyService,
  ) {}

  // Job de ingestão - a cada 10 minutos
  @Cron('*/10 * * * *', {
    name: 'ingest-prices',
    timeZone: 'America/Sao_Paulo',
  })
  async runIngestJob() {
    if (!this.config.get('CRON_INGEST_ENABLED', 'true')) {
      return;
    }

    const jobRun = await this.startJobRun('ingest');
    
    try {
      this.logger.log('🔄 Iniciando job de ingestão de preços...');
      
      const result = await this.ingestService.ingestLatestPrices();
      
      await this.completeJobRun(jobRun.id, {
        medicationsProcessed: result.medicationsProcessed,
        pricesIngested: result.pricesIngested,
        errors: result.errors,
      });
      
      this.logger.log(`✅ Job de ingestão concluído: ${result.pricesIngested} preços processados`);
    } catch (error) {
      this.logger.error('❌ Erro no job de ingestão:', error);
      await this.failJobRun(jobRun.id, error instanceof Error ? error.message : 'Erro desconhecido');
    }
  }

  // Job de análise - a cada 10 minutos, offset de 2 minutos
  @Cron('2-59/10 * * * *', {
    name: 'analyze-alerts',
    timeZone: 'America/Sao_Paulo',
  })
  async runAnalyzeJob() {
    if (!this.config.get('CRON_ANALYZE_ENABLED', 'true')) {
      return;
    }

    const jobRun = await this.startJobRun('analyze');
    
    try {
      this.logger.log('🔍 Iniciando job de análise de alertas...');
      
      const result = await this.analyzeService.analyzeAllSubscriptions();
      
      await this.completeJobRun(jobRun.id, {
        subscriptionsProcessed: result.subscriptionsProcessed,
        alertsGenerated: result.alertsGenerated,
        errors: result.errors,
      });
      
      this.logger.log(`✅ Job de análise concluído: ${result.alertsGenerated} alertas gerados`);
    } catch (error) {
      this.logger.error('❌ Erro no job de análise:', error);
      await this.failJobRun(jobRun.id, error instanceof Error ? error.message : 'Erro desconhecido');
    }
  }

  // Job de notificação - a cada 5 minutos
  @Cron('*/5 * * * *', {
    name: 'send-notifications',
    timeZone: 'America/Sao_Paulo',
  })
  async runNotifyJob() {
    if (!this.config.get('CRON_NOTIFY_ENABLED', 'true')) {
      return;
    }

    const jobRun = await this.startJobRun('notify');
    
    try {
      this.logger.log('📧 Iniciando job de envio de notificações...');
      
      const result = await this.notifyService.sendPendingAlerts();
      
      await this.completeJobRun(jobRun.id, {
        alertsProcessed: result.alertsProcessed,
        emailsSent: result.emailsSent,
        errors: result.errors,
      });
      
      this.logger.log(`✅ Job de notificação concluído: ${result.emailsSent} emails enviados`);
    } catch (error) {
      this.logger.error('❌ Erro no job de notificação:', error);
      await this.failJobRun(jobRun.id, error instanceof Error ? error.message : 'Erro desconhecido');
    }
  }

  // Executar todos os jobs manualmente (para testes)
  async runAllJobs() {
    this.logger.log('🚀 Executando todos os jobs manualmente...');
    
    await this.runIngestJob();
    // Aguardar um pouco antes de executar análise
    await new Promise(resolve => setTimeout(resolve, 5000));
    await this.runAnalyzeJob();
    // Aguardar um pouco antes de enviar notificações
    await new Promise(resolve => setTimeout(resolve, 3000));
    await this.runNotifyJob();
    
    this.logger.log('✅ Todos os jobs executados');
  }

  // Obter status dos jobs
  async getJobsStatus() {
    const recentRuns = await this.prisma.jobRun.findMany({
      where: {
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // últimas 24h
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 50,
    });

    const jobStats = recentRuns.reduce((acc, run) => {
      if (!acc[run.jobName]) {
        acc[run.jobName] = {
          name: run.jobName,
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          lastRun: null as Date | null,
          lastSuccess: null as Date | null,
          lastError: null as string | null,
          avgDuration: 0,
        };
      }

      const job = acc[run.jobName];
      job.totalRuns++;
      
      if (run.status === 'completed') {
        job.successfulRuns++;
        if (!job.lastSuccess || run.startedAt > job.lastSuccess) {
          job.lastSuccess = run.startedAt;
        }
      } else if (run.status === 'failed') {
        job.failedRuns++;
        if (run.error) {
          job.lastError = run.error;
        }
      }

      if (!job.lastRun || run.startedAt > job.lastRun) {
        job.lastRun = run.startedAt;
      }

      if (run.duration) {
        job.avgDuration = (job.avgDuration + run.duration) / 2;
      }

      return acc;
    }, {} as Record<string, any>);

    return {
      jobs: Object.values(jobStats),
      recentRuns: recentRuns.slice(0, 10),
      systemHealth: {
        totalJobsLast24h: recentRuns.length,
        successRate: recentRuns.length > 0 
          ? (recentRuns.filter(r => r.status === 'completed').length / recentRuns.length) * 100 
          : 0,
        avgDuration: recentRuns.reduce((sum, r) => sum + (r.duration || 0), 0) / recentRuns.length,
      },
    };
  }

  private async startJobRun(jobName: string) {
    return this.prisma.jobRun.create({
      data: {
        jobName,
        status: 'running',
        startedAt: new Date(),
      },
    });
  }

  private async completeJobRun(jobRunId: string, meta?: any) {
    const endedAt = new Date();
    const jobRun = await this.prisma.jobRun.findUnique({
      where: { id: jobRunId },
    });

    const duration = jobRun ? endedAt.getTime() - jobRun.startedAt.getTime() : 0;

    return this.prisma.jobRun.update({
      where: { id: jobRunId },
      data: {
        status: 'completed',
        endedAt,
        duration,
        meta,
      },
    });
  }

  private async failJobRun(jobRunId: string, error: string) {
    const endedAt = new Date();
    const jobRun = await this.prisma.jobRun.findUnique({
      where: { id: jobRunId },
    });

    const duration = jobRun ? endedAt.getTime() - jobRun.startedAt.getTime() : 0;

    return this.prisma.jobRun.update({
      where: { id: jobRunId },
      data: {
        status: 'failed',
        endedAt,
        duration,
        error,
      },
    });
  }
}
