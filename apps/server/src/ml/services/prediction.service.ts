import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProphetModel } from '../models/prophet.model';
import { ArimaModel } from '../models/arima.model';
import { LstmModel } from '../models/lstm.model';
import { OutlierDetector } from '../utils/outlier-detector';
import { CompetitivenessCalculator } from '../utils/competitiveness-calculator';

export interface PredictionResult {
  model: string;
  medication: string;
  laboratory?: string;
  predictions: Array<{
    date: Date;
    predictedPrice: number;
    confidence: number;
    lowerBound: number;
    upperBound: number;
  }>;
  accuracy: number;
  lastUpdate: Date;
}

export interface OutlierResult {
  priceId: string;
  medication: string;
  laboratory: string;
  price: number;
  expectedPrice: number;
  deviation: number;
  outlierScore: number;
  isOutlier: boolean;
  reasons: string[];
}

export interface CompetitivenessResult {
  laboratory: string;
  overallScore: number;
  priceScore: number;
  consistencyScore: number;
  marketShareScore: number;
  rank: number;
  totalLaboratories: number;
  medications: Array<{
    medication: string;
    score: number;
    avgPrice: number;
    marketAvgPrice: number;
    priceAdvantage: number;
  }>;
}

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  
  constructor(
    private prisma: PrismaService,
    private prophetModel: ProphetModel,
    private arimaModel: ArimaModel,
    private lstmModel: LstmModel,
    private outlierDetector: OutlierDetector,
    private competitivenessCalculator: CompetitivenessCalculator,
  ) {}

  /**
   * Gera previsões usando múltiplos modelos
   */
  async generatePredictions(
    medicationCode: string,
    laboratoryId?: string,
    daysAhead: number = 30,
    models: string[] = ['prophet', 'arima', 'lstm']
  ): Promise<PredictionResult[]> {
    try {
      this.logger.log(`Gerando previsões para ${medicationCode}, ${daysAhead} dias à frente`);

      // Buscar dados históricos
      const historicalData = await this.getHistoricalData(medicationCode, laboratoryId);
      
      if (historicalData.length < 30) {
        throw new Error('Dados insuficientes para previsão (mínimo 30 pontos)');
      }

      const results: PredictionResult[] = [];

      // Prophet - Melhor para sazonalidade
      if (models.includes('prophet')) {
        try {
          const prophetResult = await this.prophetModel.predict(historicalData, daysAhead);
          results.push({
            model: 'prophet',
            medication: medicationCode,
            laboratory: laboratoryId,
            predictions: prophetResult.predictions,
            accuracy: prophetResult.accuracy,
            lastUpdate: new Date(),
          });
        } catch (error) {
          this.logger.warn(`Prophet falhou para ${medicationCode}: ${error.message}`);
        }
      }

      // ARIMA - Melhor para padrões lineares
      if (models.includes('arima')) {
        try {
          const arimaResult = await this.arimaModel.predict(historicalData, daysAhead);
          results.push({
            model: 'arima',
            medication: medicationCode,
            laboratory: laboratoryId,
            predictions: arimaResult.predictions,
            accuracy: arimaResult.accuracy,
            lastUpdate: new Date(),
          });
        } catch (error) {
          this.logger.warn(`ARIMA falhou para ${medicationCode}: ${error.message}`);
        }
      }

      // LSTM - Melhor para padrões complexos não-lineares
      if (models.includes('lstm')) {
        try {
          const lstmResult = await this.lstmModel.predict(historicalData, daysAhead);
          results.push({
            model: 'lstm',
            medication: medicationCode,
            laboratory: laboratoryId,
            predictions: lstmResult.predictions,
            accuracy: lstmResult.accuracy,
            lastUpdate: new Date(),
          });
        } catch (error) {
          this.logger.warn(`LSTM falhou para ${medicationCode}: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Erro ao gerar previsões: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detecta outliers de preço
   */
  async detectOutliers(
    medicationCode?: string,
    laboratoryId?: string,
    threshold: number = 2.5
  ): Promise<OutlierResult[]> {
    try {
      this.logger.log(`Detectando outliers (threshold: ${threshold})`);

      // Buscar preços recentes
      const recentPrices = await this.getRecentPrices(medicationCode, laboratoryId);
      
      const outliers = await this.outlierDetector.detectOutliers(
        recentPrices,
        threshold
      );

      return outliers;
    } catch (error) {
      this.logger.error(`Erro ao detectar outliers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calcula índice de competitividade por laboratório
   */
  async calculateCompetitiveness(
    laboratoryId?: string,
    medicationCode?: string
  ): Promise<CompetitivenessResult[]> {
    try {
      this.logger.log('Calculando índice de competitividade');

      const competitivenessData = await this.competitivenessCalculator.calculate(
        laboratoryId,
        medicationCode
      );

      return competitivenessData;
    } catch (error) {
      this.logger.error(`Erro ao calcular competitividade: ${error.message}`);
      throw error;
    }
  }

  /**
   * Combina previsões de múltiplos modelos (ensemble)
   */
  async generateEnsemblePrediction(
    medicationCode: string,
    laboratoryId?: string,
    daysAhead: number = 30
  ): Promise<PredictionResult> {
    try {
      const predictions = await this.generatePredictions(
        medicationCode,
        laboratoryId,
        daysAhead
      );

      if (predictions.length === 0) {
        throw new Error('Nenhuma previsão foi gerada');
      }

      // Combinar previsões usando média ponderada baseada na acurácia
      const ensemblePredictions = this.combineModels(predictions);

      return {
        model: 'ensemble',
        medication: medicationCode,
        laboratory: laboratoryId,
        predictions: ensemblePredictions,
        accuracy: this.calculateEnsembleAccuracy(predictions),
        lastUpdate: new Date(),
      };
    } catch (error) {
      this.logger.error(`Erro ao gerar ensemble: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca dados históricos para um medicamento
   */
  private async getHistoricalData(medicationCode: string, laboratoryId?: string) {
    const whereClause: any = {
      medication: { code: medicationCode },
      capturedAt: {
        gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Último ano
      },
    };

    if (laboratoryId) {
      whereClause.labId = laboratoryId;
    }

    const prices = await this.prisma.price.findMany({
      where: whereClause,
      include: {
        medication: true,
        lab: true,
      },
      orderBy: { capturedAt: 'asc' },
    });

    return prices.map(price => ({
      date: price.capturedAt,
      price: parseFloat(price.value.toString()),
      medication: price.medication.code,
      laboratory: price.lab?.name || 'Unknown',
    }));
  }

  /**
   * Busca preços recentes para detecção de outliers
   */
  private async getRecentPrices(medicationCode?: string, laboratoryId?: string) {
    const whereClause: any = {
      capturedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Últimos 30 dias
      },
    };

    if (medicationCode) {
      whereClause.medication = { code: medicationCode };
    }

    if (laboratoryId) {
      whereClause.labId = laboratoryId;
    }

    const prices = await this.prisma.price.findMany({
      where: whereClause,
      include: {
        medication: true,
        lab: true,
      },
      orderBy: { capturedAt: 'desc' },
    });

    return prices.map(price => ({
      id: price.id,
      date: price.capturedAt,
      price: parseFloat(price.value.toString()),
      medication: price.medication.code,
      laboratory: price.lab?.name || 'Unknown',
      source: price.source,
    }));
  }

  /**
   * Combina previsões de múltiplos modelos
   */
  private combineModels(predictions: PredictionResult[]) {
    const totalAccuracy = predictions.reduce((sum, p) => sum + p.accuracy, 0);
    const weights = predictions.map(p => p.accuracy / totalAccuracy);

    const maxLength = Math.max(...predictions.map(p => p.predictions.length));
    const combined = [];

    for (let i = 0; i < maxLength; i++) {
      let weightedPrice = 0;
      let weightedLower = 0;
      let weightedUpper = 0;
      let weightedConfidence = 0;
      let date = new Date();

      predictions.forEach((prediction, modelIndex) => {
        if (i < prediction.predictions.length) {
          const pred = prediction.predictions[i];
          const weight = weights[modelIndex];
          
          weightedPrice += pred.predictedPrice * weight;
          weightedLower += pred.lowerBound * weight;
          weightedUpper += pred.upperBound * weight;
          weightedConfidence += pred.confidence * weight;
          date = pred.date;
        }
      });

      combined.push({
        date,
        predictedPrice: weightedPrice,
        confidence: weightedConfidence,
        lowerBound: weightedLower,
        upperBound: weightedUpper,
      });
    }

    return combined;
  }

  /**
   * Calcula acurácia do ensemble
   */
  private calculateEnsembleAccuracy(predictions: PredictionResult[]): number {
    const totalAccuracy = predictions.reduce((sum, p) => sum + p.accuracy, 0);
    return totalAccuracy / predictions.length;
  }
}
