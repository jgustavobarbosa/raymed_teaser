import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { IngestService } from './ingest.service';
import { AnalyzeService } from './analyze.service';
import { NotifyService } from './notify.service';
import { MedicationsModule } from '../medications/medications.module';
import { AlertsModule } from '../alerts/alerts.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [MedicationsModule, AlertsModule, NotificationModule],
  providers: [JobsService, IngestService, AnalyzeService, NotifyService],
  exports: [JobsService, IngestService, AnalyzeService, NotifyService],
})
export class JobsModule {}
