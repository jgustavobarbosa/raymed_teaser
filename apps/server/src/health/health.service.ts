import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createRayClient } from '@raymed/shared';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getHealthStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.config.get('NODE_ENV', 'development'),
    };
  }

  async getDetailedHealthStatus() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRayAPI(),
      this.checkMemoryUsage(),
    ]);

    const database = checks[0].status === 'fulfilled' ? checks[0].value : { status: 'error', error: (checks[0] as PromiseRejectedResult).reason };
    const rayApi = checks[1].status === 'fulfilled' ? checks[1].value : { status: 'error', error: (checks[1] as PromiseRejectedResult).reason };
    const memory = checks[2].status === 'fulfilled' ? checks[2].value : { status: 'error', error: (checks[2] as PromiseRejectedResult).reason };

    const overallStatus = [database, rayApi, memory].every(check => check.status === 'ok') ? 'ok' : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.config.get('NODE_ENV', 'development'),
      checks: {
        database,
        rayApi,
        memory,
      },
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', responseTime: Date.now() };
    } catch (error) {
      return { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Database connection failed' 
      };
    }
  }

  private async checkRayAPI() {
    try {
      const rayClient = createRayClient();
      const startTime = Date.now();
      const result = await rayClient.testConnection();
      const responseTime = Date.now() - startTime;
      
      return {
        status: result.success ? 'ok' : 'error',
        responseTime,
        message: result.message,
      };
    } catch (error) {
      return { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Ray API connection failed' 
      };
    }
  }

  private checkMemoryUsage() {
    const usage = process.memoryUsage();
    const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const usagePercent = Math.round((usedMB / totalMB) * 100);

    return {
      status: usagePercent > 90 ? 'warning' : 'ok',
      totalMB,
      usedMB,
      usagePercent,
    };
  }
}
