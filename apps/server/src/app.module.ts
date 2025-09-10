import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { MedicationsModule } from './medications/medications.module';
import { LabsModule } from './labs/labs.module';
import { PricesModule } from './prices/prices.module';
import { AlertsModule } from './alerts/alerts.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';
import { ProxyModule } from './proxy/proxy.module';
import { LlmModule } from './llm/llm.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationModule } from './notification/notification.module';
import { CacheModule } from './cache/cache.module';
import { MLModule } from './ml/ml.module';

@Module({
  imports: [
    // Configuração
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minuto
        limit: 100, // 100 requests por minuto
      },
    ]),

    // Agendamento de jobs
    ScheduleModule.forRoot(),

    // Módulos da aplicação
    PrismaModule,
    CacheModule,
    HealthModule,
    UsersModule,
    MedicationsModule,
    LabsModule,
    PricesModule,
    SubscriptionsModule,
    AlertsModule,
    ProxyModule,
    LlmModule,
    JobsModule,
    NotificationModule,
    MLModule,
  ],
})
export class AppModule {}
