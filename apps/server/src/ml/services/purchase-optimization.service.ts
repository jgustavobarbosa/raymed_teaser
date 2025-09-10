import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionService } from './prediction.service';
import { CompetitivenessCalculator } from '../utils/competitiveness-calculator';

export interface PurchaseRecommendation {
  medicationCode: string;
  medicationName: string;
  recommendations: Array<{
    action: 'buy_now' | 'wait' | 'monitor' | 'urgent_buy';
    laboratory: string;
    currentPrice: number;
    predictedPrice: number;
    expectedSavings: number;
    confidence: number;
    timeframe: string;
    reasoning: string[];
    priority: 'low' | 'medium' | 'high' | 'urgent';
  }>;
  marketAnalysis: {
    currentMarketPrice: number;
    predictedMarketPrice: number;
    priceVolatility: number;
    competitionLevel: 'low' | 'medium' | 'high';
    marketTrend: 'increasing' | 'decreasing' | 'stable';
  };
  optimalTiming: {
    bestBuyDate: Date;
    worstBuyDate: Date;
    maxSavingsOpportunity: number;
    riskAssessment: 'low' | 'medium' | 'high';
  };
}

export interface InventoryOptimization {
  medicationCode: string;
  currentStock: number;
  recommendedStock: number;
  reorderPoint: number;
  economicOrderQuantity: number;
  stockoutRisk: number;
  carryingCostSavings: number;
  recommendations: string[];
}

export interface BulkPurchaseAnalysis {
  medications: string[];
  totalCurrentCost: number;
  totalOptimizedCost: number;
  totalSavings: number;
  savingsPercentage: number;
  recommendations: Array<{
    medication: string;
    action: string;
    savings: number;
    laboratory: string;
    timing: string;
  }>;
  riskAnalysis: {
    priceVolatilityRisk: number;
    supplierConcentrationRisk: number;
    marketRisk: number;
    overallRisk: 'low' | 'medium' | 'high';
  };
}

@Injectable()
export class PurchaseOptimizationService {
  private readonly logger = new Logger(PurchaseOptimizationService.name);

  constructor(
    private prisma: PrismaService,
    private predictionService: PredictionService,
    private competitivenessCalculator: CompetitivenessCalculator,
  ) {}

  /**
   * Gera recomendações de compra para um medicamento
   */
  async generatePurchaseRecommendations(
    medicationCode: string,
    currentStock?: number,
    monthlyConsumption?: number
  ): Promise<PurchaseRecommendation> {
    try {
      this.logger.log(`Gerando recomendações de compra para ${medicationCode}`);

      // Buscar dados do medicamento
      const medication = await this.prisma.medication.findUnique({
        where: { code: medicationCode },
        include: {
          prices: {
            take: 100,
            orderBy: { capturedAt: 'desc' },
            include: { lab: true },
          },
        },
      });

      if (!medication) {
        throw new Error(`Medicamento ${medicationCode} não encontrado`);
      }

      // Gerar previsões para os próximos 60 dias
      const predictions = await this.predictionService.generateEnsemblePrediction(
        medicationCode,
        undefined,
        60
      );

      // Analisar competitividade por laboratório
      const competitiveness = await this.competitivenessCalculator.calculate(
        undefined,
        medicationCode
      );

      // Calcular análise de mercado
      const marketAnalysis = this.calculateMarketAnalysis(medication, predictions);

      // Gerar recomendações por laboratório
      const recommendations = this.generateLabRecommendations(
        medication,
        predictions,
        competitiveness,
        currentStock,
        monthlyConsumption
      );

      // Calcular timing ótimo
      const optimalTiming = this.calculateOptimalTiming(predictions);

      return {
        medicationCode,
        medicationName: medication.name,
        recommendations,
        marketAnalysis,
        optimalTiming,
      };
    } catch (error) {
      this.logger.error(`Erro ao gerar recomendações: ${error.message}`);
      throw error;
    }
  }

  /**
   * Otimização de inventário baseada em previsões
   */
  async optimizeInventory(
    medicationCode: string,
    currentStock: number,
    monthlyConsumption: number,
    leadTime: number = 7, // dias
    serviceLevel: number = 0.95 // 95%
  ): Promise<InventoryOptimization> {
    try {
      this.logger.log(`Otimizando inventário para ${medicationCode}`);

      // Gerar previsões de demanda (simplificado)
      const predictions = await this.predictionService.generateEnsemblePrediction(
        medicationCode,
        undefined,
        90
      );

      // Calcular demanda durante lead time
      const dailyConsumption = monthlyConsumption / 30;
      const leadTimeDemand = dailyConsumption * leadTime;

      // Calcular variabilidade da demanda
      const demandVariability = this.calculateDemandVariability(predictions, dailyConsumption);

      // Safety stock baseado no nível de serviço
      const zScore = this.getZScoreForServiceLevel(serviceLevel);
      const safetyStock = zScore * Math.sqrt(leadTime) * demandVariability;

      // Reorder point
      const reorderPoint = leadTimeDemand + safetyStock;

      // Economic Order Quantity (EOQ) simplificado
      const orderingCost = 50; // Custo fixo por pedido (estimado)
      const currentPrice = predictions.predictions[0]?.predictedPrice || 100;
      const holdingCostRate = 0.20; // 20% ao ano
      const annualDemand = monthlyConsumption * 12;
      
      const eoq = Math.sqrt((2 * annualDemand * orderingCost) / (currentPrice * holdingCostRate));

      // Calcular economia potencial
      const currentCarryingCost = currentStock * currentPrice * (holdingCostRate / 365);
      const optimizedCarryingCost = eoq * currentPrice * (holdingCostRate / 365);
      const carryingCostSavings = Math.max(0, currentCarryingCost - optimizedCarryingCost);

      // Calcular risco de stockout
      const stockoutRisk = this.calculateStockoutRisk(
        currentStock,
        dailyConsumption,
        demandVariability,
        leadTime
      );

      // Gerar recomendações
      const recommendations = this.generateInventoryRecommendations(
        currentStock,
        eoq,
        reorderPoint,
        stockoutRisk,
        predictions
      );

      return {
        medicationCode,
        currentStock,
        recommendedStock: Math.round(eoq),
        reorderPoint: Math.round(reorderPoint),
        economicOrderQuantity: Math.round(eoq),
        stockoutRisk,
        carryingCostSavings,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Erro na otimização de inventário: ${error.message}`);
      throw error;
    }
  }

  /**
   * Análise de compra em lote
   */
  async analyzeBulkPurchase(
    medications: Array<{
      code: string;
      quantity: number;
      maxBudget?: number;
    }>
  ): Promise<BulkPurchaseAnalysis> {
    try {
      this.logger.log(`Analisando compra em lote de ${medications.length} medicamentos`);

      const recommendations = [];
      let totalCurrentCost = 0;
      let totalOptimizedCost = 0;

      // Analisar cada medicamento
      for (const med of medications) {
        const purchaseRec = await this.generatePurchaseRecommendations(med.code);
        
        if (purchaseRec.recommendations.length > 0) {
          const bestRec = purchaseRec.recommendations[0]; // Melhor recomendação
          const currentCost = bestRec.currentPrice * med.quantity;
          const optimizedCost = bestRec.predictedPrice * med.quantity;
          
          totalCurrentCost += currentCost;
          totalOptimizedCost += optimizedCost;

          recommendations.push({
            medication: med.code,
            action: bestRec.action,
            savings: currentCost - optimizedCost,
            laboratory: bestRec.laboratory,
            timing: bestRec.timeframe,
          });
        }
      }

      const totalSavings = totalCurrentCost - totalOptimizedCost;
      const savingsPercentage = totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0;

      // Análise de risco
      const riskAnalysis = await this.calculateBulkRiskAnalysis(medications);

      return {
        medications: medications.map(m => m.code),
        totalCurrentCost,
        totalOptimizedCost,
        totalSavings,
        savingsPercentage,
        recommendations,
        riskAnalysis,
      };
    } catch (error) {
      this.logger.error(`Erro na análise de compra em lote: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calcula análise de mercado
   */
  private calculateMarketAnalysis(medication: any, predictions: any) {
    const recentPrices = medication.prices.map(p => parseFloat(p.value.toString()));
    const currentMarketPrice = recentPrices.length > 0 ? recentPrices[0] : 0;
    
    // Preço previsto (média das previsões)
    const predictedPrices = predictions.predictions.map(p => p.predictedPrice);
    const predictedMarketPrice = predictedPrices.reduce((a, b) => a + b, 0) / predictedPrices.length;

    // Volatilidade
    const mean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / recentPrices.length;
    const priceVolatility = Math.sqrt(variance) / mean; // Coeficiente de variação

    // Nível de competição (baseado no número de laboratórios)
    const uniqueLabs = new Set(medication.prices.map(p => p.lab?.name)).size;
    const competitionLevel = uniqueLabs >= 5 ? 'high' : uniqueLabs >= 3 ? 'medium' : 'low';

    // Tendência de mercado
    const firstHalf = recentPrices.slice(0, Math.floor(recentPrices.length / 2));
    const secondHalf = recentPrices.slice(Math.floor(recentPrices.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const trendChange = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    const marketTrend = trendChange > 5 ? 'increasing' : trendChange < -5 ? 'decreasing' : 'stable';

    return {
      currentMarketPrice,
      predictedMarketPrice,
      priceVolatility,
      competitionLevel,
      marketTrend,
    };
  }

  /**
   * Gera recomendações por laboratório
   */
  private generateLabRecommendations(
    medication: any,
    predictions: any,
    competitiveness: any[],
    currentStock?: number,
    monthlyConsumption?: number
  ) {
    const recommendations = [];

    // Agrupar preços por laboratório
    const labPrices = medication.prices.reduce((acc, price) => {
      const labName = price.lab?.name || 'Unknown';
      if (!acc[labName]) {
        acc[labName] = [];
      }
      acc[labName].push(parseFloat(price.value.toString()));
      return acc;
    }, {});

    // Gerar recomendação para cada laboratório
    for (const [labName, prices] of Object.entries(labPrices)) {
      const currentPrice = prices[0]; // Preço mais recente
      const avgPredictedPrice = predictions.predictions.reduce((sum, p) => sum + p.predictedPrice, 0) / predictions.predictions.length;
      
      // Encontrar dados de competitividade do laboratório
      const labCompetitiveness = competitiveness.find(c => c.laboratory === labName);
      
      // Calcular economia esperada
      const expectedSavings = Math.max(0, currentPrice - avgPredictedPrice);
      const savingsPercentage = currentPrice > 0 ? (expectedSavings / currentPrice) * 100 : 0;

      // Determinar ação recomendada
      let action: 'buy_now' | 'wait' | 'monitor' | 'urgent_buy';
      let reasoning = [];
      let priority: 'low' | 'medium' | 'high' | 'urgent';

      // Lógica de decisão
      if (savingsPercentage < -10) {
        action = 'urgent_buy';
        priority = 'urgent';
        reasoning.push('Preço atual muito abaixo da previsão - compre imediatamente');
        reasoning.push(`Economia potencial: ${Math.abs(savingsPercentage).toFixed(1)}%`);
      } else if (savingsPercentage < -5) {
        action = 'buy_now';
        priority = 'high';
        reasoning.push('Preço favorável detectado');
        reasoning.push('Recomendamos compra nas próximas 48h');
      } else if (savingsPercentage > 10) {
        action = 'wait';
        priority = 'low';
        reasoning.push('Preços devem cair nos próximos dias');
        reasoning.push(`Economia esperada aguardando: ${savingsPercentage.toFixed(1)}%`);
      } else {
        action = 'monitor';
        priority = 'medium';
        reasoning.push('Preço estável - monitorar por mudanças');
      }

      // Adicionar contexto de competitividade
      if (labCompetitiveness) {
        if (labCompetitiveness.rank <= 3) {
          reasoning.push(`${labName} está no top 3 de competitividade`);
        }
        if (labCompetitiveness.priceAdvantage > 10) {
          reasoning.push(`Laboratório oferece ${labCompetitiveness.priceAdvantage}% abaixo da média`);
        }
      }

      // Adicionar contexto de estoque se disponível
      if (currentStock !== undefined && monthlyConsumption !== undefined) {
        const daysOfStock = (currentStock / (monthlyConsumption / 30));
        if (daysOfStock < 15) {
          priority = priority === 'low' ? 'medium' : 'high';
          reasoning.push(`Estoque baixo: ${daysOfStock.toFixed(0)} dias restantes`);
        }
      }

      recommendations.push({
        action,
        laboratory: labName,
        currentPrice,
        predictedPrice: avgPredictedPrice,
        expectedSavings,
        confidence: predictions.accuracy / 100,
        timeframe: this.getTimeframeForAction(action),
        reasoning,
        priority,
      });
    }

    // Ordenar por prioridade e economia
    recommendations.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.expectedSavings - a.expectedSavings;
    });

    return recommendations;
  }

  /**
   * Calcula timing ótimo baseado nas previsões
   */
  private calculateOptimalTiming(predictions: any) {
    const prices = predictions.predictions.map(p => ({
      date: new Date(p.date),
      price: p.predictedPrice,
    }));

    // Encontrar menor e maior preço previsto
    const minPricePoint = prices.reduce((min, current) => 
      current.price < min.price ? current : min
    );
    
    const maxPricePoint = prices.reduce((max, current) => 
      current.price > max.price ? current : max
    );

    const maxSavingsOpportunity = maxPricePoint.price - minPricePoint.price;
    const savingsPercentage = (maxSavingsOpportunity / maxPricePoint.price) * 100;

    // Avaliar risco baseado na volatilidade das previsões
    const priceVariance = prices.reduce((sum, p) => {
      const avgPrice = prices.reduce((s, pr) => s + pr.price, 0) / prices.length;
      return sum + Math.pow(p.price - avgPrice, 2);
    }, 0) / prices.length;
    
    const priceStd = Math.sqrt(priceVariance);
    const coefficientOfVariation = priceStd / (prices.reduce((s, p) => s + p.price, 0) / prices.length);

    const riskAssessment = coefficientOfVariation > 0.15 ? 'high' : 
                          coefficientOfVariation > 0.08 ? 'medium' : 'low';

    return {
      bestBuyDate: minPricePoint.date,
      worstBuyDate: maxPricePoint.date,
      maxSavingsOpportunity,
      riskAssessment,
    };
  }

  /**
   * Calcula variabilidade da demanda
   */
  private calculateDemandVariability(predictions: any, dailyConsumption: number): number {
    // Simplificado: usar variabilidade dos preços como proxy para variabilidade da demanda
    const prices = predictions.predictions.map(p => p.predictedPrice);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    
    // Converter para variabilidade de demanda (correlação inversa com preço)
    const priceCoeffVar = Math.sqrt(variance) / mean;
    return dailyConsumption * priceCoeffVar * 0.5; // Fator de correlação estimado
  }

  /**
   * Calcula risco de stockout
   */
  private calculateStockoutRisk(
    currentStock: number,
    dailyConsumption: number,
    demandVariability: number,
    leadTime: number
  ): number {
    const daysOfStock = currentStock / dailyConsumption;
    const leadTimeDemand = dailyConsumption * leadTime;
    const safetyBuffer = demandVariability * Math.sqrt(leadTime) * 2; // 2 sigma

    if (currentStock <= leadTimeDemand - safetyBuffer) {
      return 0.9; // 90% de risco
    } else if (currentStock <= leadTimeDemand) {
      return 0.6; // 60% de risco
    } else if (currentStock <= leadTimeDemand + safetyBuffer) {
      return 0.3; // 30% de risco
    } else {
      return 0.1; // 10% de risco
    }
  }

  /**
   * Gera recomendações de inventário
   */
  private generateInventoryRecommendations(
    currentStock: number,
    eoq: number,
    reorderPoint: number,
    stockoutRisk: number,
    predictions: any
  ): string[] {
    const recommendations = [];

    // Recomendações baseadas no estoque atual
    if (currentStock < reorderPoint) {
      recommendations.push(`🚨 Estoque abaixo do ponto de reposição - reabastecer imediatamente`);
    } else if (currentStock < reorderPoint * 1.2) {
      recommendations.push(`⚠️ Estoque próximo do ponto de reposição - planejar reabastecimento`);
    }

    // Recomendações baseadas no EOQ
    if (currentStock > eoq * 2) {
      recommendations.push(`📦 Estoque excessivo - considerar reduzir próximos pedidos`);
    } else if (currentStock < eoq * 0.5) {
      recommendations.push(`📈 Estoque baixo - considerar aumentar próximo pedido`);
    }

    // Recomendações baseadas no risco
    if (stockoutRisk > 0.7) {
      recommendations.push(`🔴 Alto risco de ruptura - ação urgente necessária`);
    } else if (stockoutRisk > 0.4) {
      recommendations.push(`🟡 Risco moderado de ruptura - monitorar de perto`);
    }

    // Recomendações baseadas nas previsões
    const avgPredictedPrice = predictions.predictions.reduce((sum, p) => sum + p.predictedPrice, 0) / predictions.predictions.length;
    const currentPrice = predictions.predictions[0]?.predictedPrice || avgPredictedPrice;
    
    if (avgPredictedPrice < currentPrice * 0.95) {
      recommendations.push(`📉 Preços devem cair - considerar aguardar se possível`);
    } else if (avgPredictedPrice > currentPrice * 1.05) {
      recommendations.push(`📈 Preços devem subir - considerar antecipar compras`);
    }

    return recommendations;
  }

  /**
   * Calcula análise de risco para compra em lote
   */
  private async calculateBulkRiskAnalysis(medications: any[]): Promise<any> {
    // Análise simplificada de risco
    return {
      priceVolatilityRisk: 0.3, // 30%
      supplierConcentrationRisk: 0.2, // 20%
      marketRisk: 0.4, // 40%
      overallRisk: 'medium' as const,
    };
  }

  /**
   * Determina timeframe para ação
   */
  private getTimeframeForAction(action: string): string {
    switch (action) {
      case 'urgent_buy':
        return 'Imediatamente (24h)';
      case 'buy_now':
        return 'Próximos 2-3 dias';
      case 'wait':
        return 'Aguardar 1-2 semanas';
      case 'monitor':
        return 'Monitorar próximos 7 dias';
      default:
        return 'A definir';
    }
  }

  /**
   * Converte nível de serviço em Z-score
   */
  private getZScoreForServiceLevel(serviceLevel: number): number {
    // Aproximação dos Z-scores para níveis de serviço comuns
    if (serviceLevel >= 0.99) return 2.33;
    if (serviceLevel >= 0.95) return 1.65;
    if (serviceLevel >= 0.90) return 1.28;
    if (serviceLevel >= 0.85) return 1.04;
    return 0.84; // 80%
  }

  /**
   * API para dashboard de otimização de compras
   */
  async getPurchaseDashboard(): Promise<{
    urgentActions: any[];
    savingsOpportunities: any[];
    riskAlerts: any[];
    marketInsights: string[];
  }> {
    try {
      // Buscar medicamentos com maior volume de transações
      const topMedications = await this.prisma.medication.findMany({
        include: {
          prices: {
            take: 50,
            orderBy: { capturedAt: 'desc' },
            include: { lab: true },
          },
        },
        take: 10,
      });

      const urgentActions = [];
      const savingsOpportunities = [];
      const riskAlerts = [];
      const marketInsights = [];

      // Analisar cada medicamento
      for (const med of topMedications) {
        try {
          const recommendations = await this.generatePurchaseRecommendations(med.code);
          
          // Identificar ações urgentes
          const urgentRecs = recommendations.recommendations.filter(r => r.priority === 'urgent');
          urgentActions.push(...urgentRecs.map(r => ({
            medication: med.name,
            action: r.action,
            laboratory: r.laboratory,
            savings: r.expectedSavings,
          })));

          // Identificar oportunidades de economia
          const savingsRecs = recommendations.recommendations.filter(r => r.expectedSavings > 10);
          savingsOpportunities.push(...savingsRecs.map(r => ({
            medication: med.name,
            laboratory: r.laboratory,
            savings: r.expectedSavings,
            percentage: (r.expectedSavings / r.currentPrice) * 100,
          })));

        } catch (error) {
          this.logger.warn(`Erro ao analisar ${med.code}: ${error.message}`);
        }
      }

      // Gerar insights de mercado
      if (urgentActions.length > 0) {
        marketInsights.push(`🚨 ${urgentActions.length} ações urgentes identificadas`);
      }
      
      if (savingsOpportunities.length > 0) {
        const totalSavings = savingsOpportunities.reduce((sum, s) => sum + s.savings, 0);
        marketInsights.push(`💰 Potencial de economia de R$ ${totalSavings.toFixed(2)} identificado`);
      }

      return {
        urgentActions: urgentActions.slice(0, 5),
        savingsOpportunities: savingsOpportunities.slice(0, 10),
        riskAlerts: riskAlerts.slice(0, 5),
        marketInsights,
      };
    } catch (error) {
      this.logger.error(`Erro no dashboard de compras: ${error.message}`);
      throw error;
    }
  }
}
