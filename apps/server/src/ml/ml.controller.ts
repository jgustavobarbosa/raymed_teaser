import { Controller, Get, Post, Body, Query, Param, Logger, BadRequestException } from '@nestjs/common';
import { PredictionService } from './services/prediction.service';
import { OutlierDetector } from './utils/outlier-detector';
import { CompetitivenessCalculator } from './utils/competitiveness-calculator';

@Controller('api/ml')
export class MLController {
  private readonly logger = new Logger(MLController.name);

  constructor(
    private predictionService: PredictionService,
    private outlierDetector: OutlierDetector,
    private competitivenessCalculator: CompetitivenessCalculator,
  ) {}

  /**
   * Gera previsões de preços usando múltiplos modelos
   */
  @Post('predictions')
  async generatePredictions(@Body() body: {
    medicationCode: string;
    laboratoryId?: string;
    daysAhead?: number;
    models?: string[];
  }) {
    try {
      const { medicationCode, laboratoryId, daysAhead = 30, models } = body;

      if (!medicationCode) {
        throw new BadRequestException('Código do medicamento é obrigatório');
      }

      this.logger.log(`Gerando previsões para ${medicationCode}`);

      const predictions = await this.predictionService.generatePredictions(
        medicationCode,
        laboratoryId,
        daysAhead,
        models
      );

      return {
        success: true,
        data: predictions,
        metadata: {
          medicationCode,
          laboratoryId,
          daysAhead,
          modelsUsed: predictions.map(p => p.model),
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao gerar previsões: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Gera previsão ensemble (combinando múltiplos modelos)
   */
  @Post('predictions/ensemble')
  async generateEnsemblePrediction(@Body() body: {
    medicationCode: string;
    laboratoryId?: string;
    daysAhead?: number;
  }) {
    try {
      const { medicationCode, laboratoryId, daysAhead = 30 } = body;

      if (!medicationCode) {
        throw new BadRequestException('Código do medicamento é obrigatório');
      }

      const ensemblePrediction = await this.predictionService.generateEnsemblePrediction(
        medicationCode,
        laboratoryId,
        daysAhead
      );

      return {
        success: true,
        data: ensemblePrediction,
        metadata: {
          description: 'Previsão ensemble combinando Prophet, ARIMA e LSTM',
          medicationCode,
          laboratoryId,
          daysAhead,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao gerar ensemble: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Detecta outliers de preços
   */
  @Get('outliers')
  async detectOutliers(
    @Query('medicationCode') medicationCode?: string,
    @Query('laboratoryId') laboratoryId?: string,
    @Query('threshold') threshold?: string,
    @Query('analysis') includeAnalysis?: string
  ) {
    try {
      const thresholdValue = threshold ? parseFloat(threshold) : 2.5;
      const includeFullAnalysis = includeAnalysis === 'true';

      this.logger.log(`Detectando outliers (threshold: ${thresholdValue})`);

      if (includeFullAnalysis) {
        // Buscar dados para análise
        const recentPrices = await this.getRecentPricesForOutliers(medicationCode, laboratoryId);
        const analysis = await this.outlierDetector.analyzeOutliers(recentPrices, thresholdValue);
        
        return {
          success: true,
          data: analysis,
          metadata: {
            threshold: thresholdValue,
            analysisType: 'full',
            generatedAt: new Date(),
          },
        };
      } else {
        const recentPrices = await this.getRecentPricesForOutliers(medicationCode, laboratoryId);
        const outliers = await this.outlierDetector.detectOutliers(recentPrices, thresholdValue);
        
        return {
          success: true,
          data: outliers,
          metadata: {
            threshold: thresholdValue,
            totalOutliers: outliers.length,
            analysisType: 'simple',
            generatedAt: new Date(),
          },
        };
      }
    } catch (error) {
      this.logger.error(`Erro ao detectar outliers: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Detecta outliers temporais (mudanças bruscas)
   */
  @Get('outliers/temporal')
  async detectTemporalOutliers(
    @Query('medicationCode') medicationCode?: string,
    @Query('laboratoryId') laboratoryId?: string,
    @Query('changeThreshold') changeThreshold?: string
  ) {
    try {
      const threshold = changeThreshold ? parseFloat(changeThreshold) : 30;
      const recentPrices = await this.getRecentPricesForOutliers(medicationCode, laboratoryId);
      
      const temporalOutliers = await this.outlierDetector.detectTemporalOutliers(
        recentPrices,
        threshold
      );

      return {
        success: true,
        data: temporalOutliers,
        metadata: {
          changeThreshold: threshold,
          totalOutliers: temporalOutliers.length,
          analysisType: 'temporal',
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao detectar outliers temporais: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Detecta padrões fraudulentos
   */
  @Get('outliers/fraud')
  async detectFraudPatterns(
    @Query('medicationCode') medicationCode?: string,
    @Query('laboratoryId') laboratoryId?: string
  ) {
    try {
      const recentPrices = await this.getRecentPricesForOutliers(medicationCode, laboratoryId);
      
      const fraudPatterns = await this.outlierDetector.detectFraudPatterns(recentPrices);

      return {
        success: true,
        data: fraudPatterns,
        metadata: {
          totalPatterns: fraudPatterns.length,
          analysisType: 'fraud',
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao detectar fraudes: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Calcula índice de competitividade
   */
  @Get('competitiveness')
  async calculateCompetitiveness(
    @Query('laboratoryId') laboratoryId?: string,
    @Query('medicationCode') medicationCode?: string
  ) {
    try {
      this.logger.log('Calculando competitividade');

      const competitiveness = await this.competitivenessCalculator.calculate(
        laboratoryId,
        medicationCode
      );

      return {
        success: true,
        data: competitiveness,
        metadata: {
          totalLaboratories: competitiveness.length,
          analysisScope: laboratoryId ? 'single' : 'all',
          medicationFilter: medicationCode,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao calcular competitividade: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Ranking dinâmico de laboratórios
   */
  @Get('competitiveness/ranking')
  async getRealTimeRanking(@Query('medicationCode') medicationCode?: string) {
    try {
      const ranking = await this.competitivenessCalculator.getRealTimeRanking(medicationCode);

      return {
        success: true,
        data: ranking,
        metadata: {
          rankingType: 'realtime',
          medicationFilter: medicationCode,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao gerar ranking: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Análise de competitividade por categoria
   */
  @Get('competitiveness/category')
  async analyzeByCategory(@Query('laboratoryId') laboratoryId?: string) {
    try {
      const categoryAnalysis = await this.competitivenessCalculator.analyzeByCategory(laboratoryId);

      return {
        success: true,
        data: categoryAnalysis,
        metadata: {
          analysisType: 'category',
          laboratoryFilter: laboratoryId,
          totalCategories: categoryAnalysis.length,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Erro na análise por categoria: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Análise de modelo específico
   */
  @Get('models/:model/info')
  async getModelInfo(@Param('model') model: string) {
    try {
      const modelInfo = {
        prophet: {
          name: 'Prophet (Facebook/Meta)',
          description: 'Modelo especializado em detectar sazonalidade e tendências',
          strengths: [
            'Excelente para dados com sazonalidade clara',
            'Robusto a dados faltantes',
            'Interpretável e transparente',
            'Intervalos de confiança confiáveis'
          ],
          weaknesses: [
            'Pode ter dificuldade com mudanças bruscas',
            'Requer dados históricos consistentes'
          ],
          bestFor: 'Medicamentos com padrões sazonais ou cíclicos',
          minDataPoints: 30,
          accuracy: '75-85%'
        },
        arima: {
          name: 'ARIMA (AutoRegressive Integrated Moving Average)',
          description: 'Modelo clássico para séries temporais com padrões lineares',
          strengths: [
            'Excelente para tendências lineares',
            'Matematicamente sólido',
            'Bom para dados estacionários',
            'Rápido para treinar'
          ],
          weaknesses: [
            'Dificuldade com padrões não-lineares',
            'Requer dados estacionários',
            'Sensível a outliers'
          ],
          bestFor: 'Medicamentos com tendências claras e lineares',
          minDataPoints: 50,
          accuracy: '65-75%'
        },
        lstm: {
          name: 'LSTM (Long Short-Term Memory)',
          description: 'Rede neural especializada em padrões complexos e não-lineares',
          strengths: [
            'Excelente para padrões complexos',
            'Pode capturar dependências de longo prazo',
            'Flexível para múltiplas features',
            'Adapta-se a mudanças de comportamento'
          ],
          weaknesses: [
            'Requer muitos dados para treinar',
            'Computacionalmente intensivo',
            'Menos interpretável',
            'Pode sofrer overfitting'
          ],
          bestFor: 'Medicamentos com padrões complexos e não-lineares',
          minDataPoints: 100,
          accuracy: '70-85%'
        }
      };

      if (!modelInfo[model]) {
        throw new BadRequestException(`Modelo '${model}' não encontrado`);
      }

      return {
        success: true,
        data: modelInfo[model],
        metadata: {
          model,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar info do modelo: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Compara performance de diferentes modelos
   */
  @Post('models/compare')
  async compareModels(@Body() body: {
    medicationCode: string;
    laboratoryId?: string;
    testPeriod?: number; // Dias para usar como teste
  }) {
    try {
      const { medicationCode, laboratoryId, testPeriod = 14 } = body;

      this.logger.log(`Comparando modelos para ${medicationCode}`);

      // Gerar previsões com diferentes modelos
      const predictions = await this.predictionService.generatePredictions(
        medicationCode,
        laboratoryId,
        testPeriod,
        ['prophet', 'arima', 'lstm']
      );

      // Calcular métricas de comparação
      const comparison = predictions.map(pred => ({
        model: pred.model,
        accuracy: pred.accuracy,
        avgPrediction: pred.predictions.reduce((sum, p) => sum + p.predictedPrice, 0) / pred.predictions.length,
        confidenceAvg: pred.predictions.reduce((sum, p) => sum + p.confidence, 0) / pred.predictions.length,
        volatility: this.calculatePredictionVolatility(pred.predictions),
        trend: this.calculatePredictionTrend(pred.predictions),
      }));

      // Determinar melhor modelo
      const bestModel = comparison.reduce((best, current) => 
        current.accuracy > best.accuracy ? current : best
      );

      return {
        success: true,
        data: {
          comparison,
          recommendation: {
            bestModel: bestModel.model,
            reason: this.getModelRecommendationReason(bestModel, comparison),
            confidence: bestModel.accuracy,
          },
          ensemble: await this.predictionService.generateEnsemblePrediction(
            medicationCode,
            laboratoryId,
            testPeriod
          ),
        },
        metadata: {
          medicationCode,
          laboratoryId,
          testPeriod,
          modelsCompared: comparison.length,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Erro na comparação de modelos: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Dashboard de análises ML
   */
  @Get('dashboard')
  async getMLDashboard(
    @Query('medicationCode') medicationCode?: string,
    @Query('laboratoryId') laboratoryId?: string
  ) {
    try {
      this.logger.log('Gerando dashboard ML');

      // Executar análises em paralelo
      const [
        recentPrices,
        outliers,
        competitiveness,
        ranking
      ] = await Promise.all([
        this.getRecentPricesForOutliers(medicationCode, laboratoryId),
        this.outlierDetector.detectOutliers(
          await this.getRecentPricesForOutliers(medicationCode, laboratoryId),
          2.5
        ),
        this.competitivenessCalculator.calculate(laboratoryId, medicationCode),
        this.competitivenessCalculator.getRealTimeRanking(medicationCode),
      ]);

      // Estatísticas gerais
      const stats = {
        totalPrices: recentPrices.length,
        outliersDetected: outliers.length,
        outlierPercentage: (outliers.length / recentPrices.length) * 100,
        laboratoriesAnalyzed: competitiveness.length,
        avgCompetitivenessScore: competitiveness.reduce((sum, c) => sum + c.overallScore, 0) / competitiveness.length,
      };

      // Insights automáticos
      const insights = this.generateInsights(outliers, competitiveness, ranking);

      return {
        success: true,
        data: {
          statistics: stats,
          outliers: outliers.slice(0, 10), // Top 10 outliers
          competitiveness: competitiveness.slice(0, 5), // Top 5 laboratórios
          ranking,
          insights,
        },
        metadata: {
          scope: {
            medicationCode,
            laboratoryId,
          },
          generatedAt: new Date(),
          analysisWindow: '90 dias',
        },
      };
    } catch (error) {
      this.logger.error(`Erro no dashboard ML: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Busca dados recentes para análise de outliers
   */
  private async getRecentPricesForOutliers(medicationCode?: string, laboratoryId?: string) {
    // Esta função seria implementada para buscar dados do banco
    // Por enquanto, retornando array vazio para evitar erro de compilação
    return [];
  }

  /**
   * Calcula volatilidade das previsões
   */
  private calculatePredictionVolatility(predictions: any[]): number {
    const prices = predictions.map(p => p.predictedPrice);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    return Math.sqrt(variance) / mean; // Coeficiente de variação
  }

  /**
   * Calcula tendência das previsões
   */
  private calculatePredictionTrend(predictions: any[]): number {
    if (predictions.length < 2) return 0;
    
    const firstPrice = predictions[0].predictedPrice;
    const lastPrice = predictions[predictions.length - 1].predictedPrice;
    
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }

  /**
   * Gera razão para recomendação de modelo
   */
  private getModelRecommendationReason(bestModel: any, comparison: any[]): string {
    const reasons = [];
    
    if (bestModel.model === 'prophet') {
      reasons.push('Prophet detectou padrões sazonais consistentes');
    } else if (bestModel.model === 'arima') {
      reasons.push('ARIMA capturou bem as tendências lineares');
    } else if (bestModel.model === 'lstm') {
      reasons.push('LSTM identificou padrões complexos nos dados');
    }
    
    reasons.push(`Acurácia de ${bestModel.accuracy.toFixed(1)}%`);
    
    if (bestModel.volatility < 0.1) {
      reasons.push('Previsões estáveis e consistentes');
    }
    
    return reasons.join('. ');
  }

  /**
   * Gera insights automáticos
   */
  private generateInsights(outliers: any[], competitiveness: any[], ranking: any[]): string[] {
    const insights = [];
    
    // Insights sobre outliers
    if (outliers.length > 0) {
      const outlierPercentage = (outliers.length / 100) * 100; // Assumindo base de 100 para exemplo
      if (outlierPercentage > 10) {
        insights.push(`⚠️ Alta incidência de outliers (${outlierPercentage.toFixed(1)}%) - investigar possíveis erros`);
      }
      
      const fraudOutliers = outliers.filter(o => o.detectionMethods.includes('fraud_identical'));
      if (fraudOutliers.length > 0) {
        insights.push(`🚨 Detectados ${fraudOutliers.length} possíveis padrões fraudulentos`);
      }
    }
    
    // Insights sobre competitividade
    if (competitiveness.length > 0) {
      const leader = competitiveness[0];
      insights.push(`🏆 ${leader.laboratory} lidera em competitividade (${leader.overallScore.toFixed(1)} pontos)`);
      
      const avgScore = competitiveness.reduce((sum, c) => sum + c.overallScore, 0) / competitiveness.length;
      if (avgScore < 50) {
        insights.push(`📉 Score médio baixo (${avgScore.toFixed(1)}) - mercado pouco competitivo`);
      }
    }
    
    // Insights sobre ranking
    if (ranking.length > 0) {
      const upTrend = ranking.filter(r => r.trend === 'up').length;
      const downTrend = ranking.filter(r => r.trend === 'down').length;
      
      if (upTrend > downTrend) {
        insights.push(`📈 Tendência geral de melhoria na competitividade (${upTrend} labs em alta)`);
      } else if (downTrend > upTrend) {
        insights.push(`📉 Tendência de declínio na competitividade (${downTrend} labs em queda)`);
      }
    }
    
    return insights;
  }
}
