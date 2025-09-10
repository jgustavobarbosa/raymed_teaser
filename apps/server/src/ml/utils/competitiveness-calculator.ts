import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CompetitivenessResult {
  laboratory: string;
  laboratoryId: string;
  overallScore: number;
  rank: number;
  totalLaboratories: number;
  
  // Componentes do score
  priceScore: number;          // Quão competitivos são os preços
  consistencyScore: number;    // Consistência de preços ao longo do tempo
  marketShareScore: number;    // Participação no mercado
  diversityScore: number;      // Diversidade de medicamentos
  reliabilityScore: number;    // Confiabilidade dos dados
  
  // Detalhes por medicamento
  medications: Array<{
    medication: string;
    medicationCode: string;
    score: number;
    avgPrice: number;
    marketAvgPrice: number;
    priceAdvantage: number;     // Porcentagem abaixo/acima da média
    consistency: number;        // Consistência de preços
    lastUpdate: Date;
  }>;
  
  // Métricas agregadas
  metrics: {
    totalMedications: number;
    avgPriceAdvantage: number;
    bestPerformingCategory: string;
    worstPerformingCategory: string;
    priceVolatility: number;
    marketPosition: 'leader' | 'challenger' | 'follower' | 'niche';
  };
  
  // Tendências
  trends: {
    priceDirection: 'increasing' | 'decreasing' | 'stable';
    competitivenessChange: number; // Mudança nos últimos 30 dias
    marketShareChange: number;
  };
}

@Injectable()
export class CompetitivenessCalculator {
  private readonly logger = new Logger(CompetitivenessCalculator.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calcula índice de competitividade para laboratórios
   */
  async calculate(
    laboratoryId?: string,
    medicationCode?: string
  ): Promise<CompetitivenessResult[]> {
    try {
      this.logger.log('Calculando índice de competitividade');

      // Buscar dados de preços dos últimos 90 dias
      const recentPrices = await this.getRecentPricesData(laboratoryId, medicationCode);
      
      if (recentPrices.length === 0) {
        throw new Error('Nenhum dado de preço encontrado');
      }

      // Agrupar por laboratório
      const labGroups = this.groupByLaboratory(recentPrices);
      
      // Calcular scores para cada laboratório
      const results: CompetitivenessResult[] = [];
      
      for (const [labId, labData] of Object.entries(labGroups)) {
        const competitiveness = await this.calculateLaboratoryCompetitiveness(
          labId,
          labData,
          recentPrices
        );
        results.push(competitiveness);
      }

      // Ordenar por score e adicionar ranking
      results.sort((a, b) => b.overallScore - a.overallScore);
      results.forEach((result, index) => {
        result.rank = index + 1;
        result.totalLaboratories = results.length;
      });

      return results;
    } catch (error) {
      this.logger.error(`Erro no cálculo de competitividade: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calcula competitividade para um laboratório específico
   */
  private async calculateLaboratoryCompetitiveness(
    labId: string,
    labData: any[],
    allData: any[]
  ): Promise<CompetitivenessResult> {
    try {
      // Buscar informações do laboratório
      const lab = await this.prisma.lab.findUnique({
        where: { id: labId },
      });

      if (!lab) {
        throw new Error(`Laboratório ${labId} não encontrado`);
      }

      // Calcular componentes do score
      const priceScore = this.calculatePriceScore(labData, allData);
      const consistencyScore = this.calculateConsistencyScore(labData);
      const marketShareScore = this.calculateMarketShareScore(labData, allData);
      const diversityScore = this.calculateDiversityScore(labData);
      const reliabilityScore = this.calculateReliabilityScore(labData);

      // Score geral (média ponderada)
      const weights = {
        price: 0.35,      // Preço é o mais importante
        consistency: 0.25, // Consistência é crucial
        marketShare: 0.20, // Participação no mercado
        diversity: 0.10,   // Diversidade de produtos
        reliability: 0.10, // Confiabilidade dos dados
      };

      const overallScore = 
        priceScore * weights.price +
        consistencyScore * weights.consistency +
        marketShareScore * weights.marketShare +
        diversityScore * weights.diversity +
        reliabilityScore * weights.reliability;

      // Calcular métricas por medicamento
      const medicationMetrics = this.calculateMedicationMetrics(labData, allData);
      
      // Calcular métricas agregadas
      const metrics = this.calculateAggregatedMetrics(labData, allData);
      
      // Calcular tendências
      const trends = this.calculateTrends(labData, allData);

      return {
        laboratory: lab.name,
        laboratoryId: lab.id,
        overallScore,
        rank: 0, // Será preenchido depois
        totalLaboratories: 0, // Será preenchido depois
        priceScore,
        consistencyScore,
        marketShareScore,
        diversityScore,
        reliabilityScore,
        medications: medicationMetrics,
        metrics,
        trends,
      };
    } catch (error) {
      this.logger.error(`Erro no cálculo para laboratório ${labId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calcula score de preços (quanto mais baixo, melhor)
   */
  private calculatePriceScore(labData: any[], allData: any[]): number {
    try {
      const labPrices = labData.map(d => d.price);
      const allPrices = allData.map(d => d.price);
      
      const labMean = this.mean(labPrices);
      const marketMean = this.mean(allPrices);
      
      // Score baseado na posição relativa ao mercado
      const priceRatio = labMean / marketMean;
      
      // Score de 0 a 100 (100 = preços muito competitivos)
      if (priceRatio <= 0.8) return 100; // 20% abaixo da média
      if (priceRatio <= 0.9) return 90;  // 10% abaixo da média
      if (priceRatio <= 1.0) return 80;  // Na média
      if (priceRatio <= 1.1) return 70;  // 10% acima da média
      if (priceRatio <= 1.2) return 50;  // 20% acima da média
      return Math.max(0, 100 - (priceRatio - 1) * 100); // Acima de 20%
    } catch (error) {
      return 50; // Score neutro em caso de erro
    }
  }

  /**
   * Calcula score de consistência
   */
  private calculateConsistencyScore(labData: any[]): number {
    try {
      const prices = labData.map(d => d.price);
      
      if (prices.length < 2) return 50;
      
      // Calcular coeficiente de variação
      const mean = this.mean(prices);
      const std = this.standardDeviation(prices);
      const cv = std / mean; // Coeficiente de variação
      
      // Score baseado na consistência (menor variação = melhor)
      if (cv <= 0.1) return 100; // Muito consistente
      if (cv <= 0.2) return 90;  // Consistente
      if (cv <= 0.3) return 70;  // Moderadamente consistente
      if (cv <= 0.5) return 50;  // Pouco consistente
      return Math.max(0, 100 - cv * 100); // Inconsistente
    } catch (error) {
      return 50;
    }
  }

  /**
   * Calcula score de participação no mercado
   */
  private calculateMarketShareScore(labData: any[], allData: any[]): number {
    try {
      // Calcular participação baseada no número de medicamentos e preços
      const labMedications = new Set(labData.map(d => d.medication));
      const allMedications = new Set(allData.map(d => d.medication));
      
      const medicationShare = labMedications.size / allMedications.size;
      const priceShare = labData.length / allData.length;
      
      // Combinar participação em medicamentos e volume de preços
      const marketShare = (medicationShare + priceShare) / 2;
      
      return Math.min(100, marketShare * 200); // Score de 0 a 100
    } catch (error) {
      return 50;
    }
  }

  /**
   * Calcula score de diversidade
   */
  private calculateDiversityScore(labData: any[]): number {
    try {
      const categories = new Set(labData.map(d => d.category));
      const medications = new Set(labData.map(d => d.medication));
      
      // Score baseado na diversidade de categorias e medicamentos
      const categoryDiversity = Math.min(categories.size / 10, 1); // Máximo 10 categorias
      const medicationDiversity = Math.min(medications.size / 50, 1); // Máximo 50 medicamentos
      
      return (categoryDiversity + medicationDiversity) * 50;
    } catch (error) {
      return 50;
    }
  }

  /**
   * Calcula score de confiabilidade
   */
  private calculateReliabilityScore(labData: any[]): number {
    try {
      // Fatores de confiabilidade
      let score = 100;
      
      // Penalizar se há muitas lacunas nos dados
      const daysCovered = this.calculateDaysCovered(labData);
      if (daysCovered < 30) {
        score -= (30 - daysCovered) * 2;
      }
      
      // Penalizar preços suspeitos (muito baixos ou altos)
      const suspiciousPrices = labData.filter(d => d.price < 0.01 || d.price > 10000);
      score -= suspiciousPrices.length * 10;
      
      // Bonificar por atualizações frequentes
      const recentUpdates = labData.filter(d => 
        new Date(d.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );
      const updateFrequency = recentUpdates.length / labData.length;
      score += updateFrequency * 20;
      
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      return 50;
    }
  }

  /**
   * Calcula métricas por medicamento
   */
  private calculateMedicationMetrics(labData: any[], allData: any[]) {
    const medicationGroups = this.groupByMedication(labData);
    const allMedicationGroups = this.groupByMedication(allData);
    
    return Object.entries(medicationGroups).map(([medicationCode, medData]) => {
      const labPrices = medData.map(d => d.price);
      const allMedPrices = allMedicationGroups[medicationCode]?.map(d => d.price) || [];
      
      const labAvg = this.mean(labPrices);
      const marketAvg = this.mean(allMedPrices);
      const priceAdvantage = ((marketAvg - labAvg) / marketAvg) * 100;
      
      return {
        medication: medData[0].medicationName || medicationCode,
        medicationCode,
        score: this.calculateMedicationScore(labPrices, allMedPrices),
        avgPrice: labAvg,
        marketAvgPrice: marketAvg,
        priceAdvantage,
        consistency: this.calculateConsistencyScore(medData),
        lastUpdate: new Date(Math.max(...medData.map(d => new Date(d.date).getTime()))),
      };
    });
  }

  /**
   * Calcula métricas agregadas
   */
  private calculateAggregatedMetrics(labData: any[], allData: any[]) {
    const medications = new Set(labData.map(d => d.medication));
    const categories = labData.reduce((acc, d) => {
      const category = d.category?.split(' | ')[0] || 'Outros';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bestCategory = Object.entries(categories).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const worstCategory = Object.entries(categories).reduce((a, b) => a[1] < b[1] ? a : b)[0];

    const labPrices = labData.map(d => d.price);
    const allPrices = allData.map(d => d.price);
    const avgPriceAdvantage = ((this.mean(allPrices) - this.mean(labPrices)) / this.mean(allPrices)) * 100;

    return {
      totalMedications: medications.size,
      avgPriceAdvantage,
      bestPerformingCategory: bestCategory,
      worstPerformingCategory: worstCategory,
      priceVolatility: this.standardDeviation(labPrices) / this.mean(labPrices),
      marketPosition: this.determineMarketPosition(labData, allData),
    };
  }

  /**
   * Calcula tendências
   */
  private calculateTrends(labData: any[], allData: any[]) {
    // Dividir dados em dois períodos
    const sortedData = labData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const midPoint = Math.floor(sortedData.length / 2);
    
    const firstHalf = sortedData.slice(0, midPoint);
    const secondHalf = sortedData.slice(midPoint);
    
    const firstAvg = this.mean(firstHalf.map(d => d.price));
    const secondAvg = this.mean(secondHalf.map(d => d.price));
    
    const priceChange = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    let priceDirection: 'increasing' | 'decreasing' | 'stable';
    if (priceChange > 5) priceDirection = 'increasing';
    else if (priceChange < -5) priceDirection = 'decreasing';
    else priceDirection = 'stable';

    return {
      priceDirection,
      competitivenessChange: priceChange,
      marketShareChange: 0, // Simplificado para o exemplo
    };
  }

  /**
   * Determina posição no mercado
   */
  private determineMarketPosition(labData: any[], allData: any[]): 'leader' | 'challenger' | 'follower' | 'niche' {
    const labMedications = new Set(labData.map(d => d.medication)).size;
    const labPrices = labData.map(d => d.price);
    const allPrices = allData.map(d => d.price);
    
    const marketShare = labData.length / allData.length;
    const priceCompetitiveness = this.mean(allPrices) / this.mean(labPrices);
    
    if (marketShare > 0.25 && priceCompetitiveness > 1.1) return 'leader';
    if (marketShare > 0.15 && priceCompetitiveness > 1.05) return 'challenger';
    if (marketShare > 0.05) return 'follower';
    return 'niche';
  }

  /**
   * Busca dados recentes de preços
   */
  private async getRecentPricesData(laboratoryId?: string, medicationCode?: string) {
    const whereClause: any = {
      capturedAt: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Últimos 90 dias
      },
    };

    if (laboratoryId) {
      whereClause.labId = laboratoryId;
    }

    if (medicationCode) {
      whereClause.medication = { code: medicationCode };
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
      medicationName: price.medication.name,
      category: price.medication.category,
      laboratory: price.lab?.name || 'Unknown',
      laboratoryId: price.lab?.id || 'unknown',
      source: price.source,
    }));
  }

  /**
   * Agrupa dados por laboratório
   */
  private groupByLaboratory(data: any[]): Record<string, any[]> {
    return data.reduce((groups, point) => {
      const labId = point.laboratoryId;
      if (!groups[labId]) {
        groups[labId] = [];
      }
      groups[labId].push(point);
      return groups;
    }, {} as Record<string, any[]>);
  }

  /**
   * Agrupa dados por medicamento
   */
  private groupByMedication(data: any[]): Record<string, any[]> {
    return data.reduce((groups, point) => {
      const medication = point.medication;
      if (!groups[medication]) {
        groups[medication] = [];
      }
      groups[medication].push(point);
      return groups;
    }, {} as Record<string, any[]>);
  }

  /**
   * Calcula score para um medicamento específico
   */
  private calculateMedicationScore(labPrices: number[], marketPrices: number[]): number {
    if (labPrices.length === 0 || marketPrices.length === 0) return 50;
    
    const labAvg = this.mean(labPrices);
    const marketAvg = this.mean(marketPrices);
    
    // Score baseado na competitividade de preços
    const ratio = labAvg / marketAvg;
    
    if (ratio <= 0.8) return 100;
    if (ratio <= 0.9) return 90;
    if (ratio <= 1.0) return 80;
    if (ratio <= 1.1) return 70;
    if (ratio <= 1.2) return 50;
    return Math.max(0, 100 - (ratio - 1) * 100);
  }

  /**
   * Calcula quantos dias únicos têm dados
   */
  private calculateDaysCovered(data: any[]): number {
    const uniqueDates = new Set(
      data.map(d => new Date(d.date).toISOString().split('T')[0])
    );
    return uniqueDates.size;
  }

  /**
   * Análise de competitividade por categoria
   */
  async analyzeByCategory(laboratoryId?: string): Promise<Array<{
    category: string;
    laboratories: Array<{
      name: string;
      score: number;
      avgPrice: number;
      medications: number;
    }>;
    marketLeader: string;
    avgScore: number;
  }>> {
    try {
      const data = await this.getRecentPricesData(laboratoryId);
      
      // Agrupar por categoria
      const categoryGroups = data.reduce((groups, point) => {
        const category = point.category?.split(' | ')[0] || 'Outros';
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(point);
        return groups;
      }, {} as Record<string, any[]>);

      const results = [];

      for (const [category, categoryData] of Object.entries(categoryGroups)) {
        const labGroups = this.groupByLaboratory(categoryData);
        const labScores = [];

        for (const [labId, labData] of Object.entries(labGroups)) {
          const score = this.calculatePriceScore(
            labData.map(d => d.price),
            categoryData.map(d => d.price)
          );
          
          labScores.push({
            name: labData[0].laboratory,
            score,
            avgPrice: this.mean(labData.map(d => d.price)),
            medications: new Set(labData.map(d => d.medication)).size,
          });
        }

        labScores.sort((a, b) => b.score - a.score);

        results.push({
          category,
          laboratories: labScores,
          marketLeader: labScores[0]?.name || 'N/A',
          avgScore: this.mean(labScores.map(l => l.score)),
        });
      }

      return results.sort((a, b) => b.avgScore - a.avgScore);
    } catch (error) {
      this.logger.error(`Erro na análise por categoria: ${error.message}`);
      throw error;
    }
  }

  /**
   * Utilitários estatísticos
   */
  private mean(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private standardDeviation(values: number[]): number {
    const mean = this.mean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Ranking dinâmico em tempo real
   */
  async getRealTimeRanking(medicationCode?: string): Promise<Array<{
    rank: number;
    laboratory: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
    change24h: number;
    avgPrice: number;
  }>> {
    try {
      const competitiveness = await this.calculate(undefined, medicationCode);
      
      // Calcular mudanças nas últimas 24h
      const ranking = competitiveness.map((comp, index) => ({
        rank: index + 1,
        laboratory: comp.laboratory,
        score: comp.overallScore,
        trend: comp.trends.competitivenessChange > 2 ? 'up' : 
               comp.trends.competitivenessChange < -2 ? 'down' : 'stable',
        change24h: comp.trends.competitivenessChange,
        avgPrice: this.mean(comp.medications.map(m => m.avgPrice)),
      }));

      return ranking;
    } catch (error) {
      this.logger.error(`Erro no ranking em tempo real: ${error.message}`);
      throw error;
    }
  }
}
