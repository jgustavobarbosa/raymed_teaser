import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MLController } from './ml.controller';
import { PredictionService } from './services/prediction.service';
import { ProphetModel } from './models/prophet.model';
import { ArimaModel } from './models/arima.model';
import { LstmModel } from './models/lstm.model';
import { OutlierDetector } from './utils/outlier-detector';
import { CompetitivenessCalculator } from './utils/competitiveness-calculator';

@Module({
  imports: [PrismaModule],
  controllers: [MLController],
  providers: [
    PredictionService,
    ProphetModel,
    ArimaModel,
    LstmModel,
    OutlierDetector,
    CompetitivenessCalculator,
  ],
  exports: [
    PredictionService,
    OutlierDetector,
    CompetitivenessCalculator,
  ],
})
export class MLModule {}
