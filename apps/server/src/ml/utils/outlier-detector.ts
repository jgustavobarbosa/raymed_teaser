import { Injectable, Logger } from '@nestjs/common';

export interface PriceDataPoint {
  id: string;
  date: Date;
  price: number;
  medication: string;
  laboratory: string;
  source: string;
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
  detectionMethods: string[];
}

export interface OutlierAnalysis {
  totalPoints: number;
  outliersDetected: number;
  outlierPercentage: number;
  methodsUsed: string[];
  outliers: OutlierResult[];
  statistics: {
    meanPrice: number;
    medianPrice: number;
    standardDeviation: number;
    iqr: number;
    q1: number;
    q3: number;
  };
}

@Injectable()
export class OutlierDetector {
  private readonly logger = new Logger(OutlierDetector.name);

  /**
   * Detecta outliers usando múltiplos métodos
   */
  async detectOutliers(
    data: PriceDataPoint[],
    threshold: number = 2.5,
    methods: string[] = ['zscore', 'iqr', 'isolation', 'contextual']
  ): Promise<OutlierResult[]> {
    try {
      this.logger.log(`Detectando outliers com threshold ${threshold}`);

      if (data.length < 10) {
        this.logger.warn('Dados insuficientes para detecção de outliers');
        return [];
      }

      const outliers: OutlierResult[] = [];

      // Agrupar por medicamento para análise contextual
      const groupedData = this.groupByMedication(data);

      for (const [medicationCode, points] of Object.entries(groupedData)) {
        const medicationOutliers = await this.detectMedicationOutliers(
          points,
          threshold,
          methods
        );
        outliers.push(...medicationOutliers);
      }

      this.logger.log(`Detectados ${outliers.length} outliers de ${data.length} pontos`);
      return outliers;
    } catch (error) {
      this.logger.error(`Erro na detecção de outliers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Análise completa de outliers com estatísticas
   */
  async analyzeOutliers(
    data: PriceDataPoint[],
    threshold: number = 2.5
  ): Promise<OutlierAnalysis> {
    try {
      const outliers = await this.detectOutliers(data, threshold);
      const prices = data.map(d => d.price);
      
      const statistics = this.calculateStatistics(prices);
      
      return {
        totalPoints: data.length,
        outliersDetected: outliers.length,
        outlierPercentage: (outliers.length / data.length) * 100,
        methodsUsed: ['zscore', 'iqr', 'isolation', 'contextual'],
        outliers,
        statistics,
      };
    } catch (error) {
      this.logger.error(`Erro na análise de outliers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detecta outliers para um medicamento específico
   */
  private async detectMedicationOutliers(
    points: PriceDataPoint[],
    threshold: number,
    methods: string[]
  ): Promise<OutlierResult[]> {
    const outliers: OutlierResult[] = [];
    const prices = points.map(p => p.price);
    
    // Estatísticas básicas
    const mean = this.mean(prices);
    const std = this.standardDeviation(prices);
    const median = this.median(prices);
    const q1 = this.percentile(prices, 25);
    const q3 = this.percentile(prices, 75);
    const iqr = q3 - q1;

    for (const point of points) {
      const detectionResults = [];
      const reasons = [];
      let outlierScore = 0;

      // Método 1: Z-Score
      if (methods.includes('zscore')) {
        const zScore = Math.abs((point.price - mean) / std);
        if (zScore > threshold) {
          detectionResults.push('zscore');
          reasons.push(`Z-score alto (${zScore.toFixed(2)})`);
          outlierScore += zScore / threshold;
        }
      }

      // Método 2: IQR (Interquartile Range)
      if (methods.includes('iqr')) {
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        if (point.price < lowerBound || point.price > upperBound) {
          detectionResults.push('iqr');
          reasons.push(`Fora do intervalo IQR (${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)})`);
          outlierScore += 1.5;
        }
      }

      // Método 3: Isolation Forest (simplificado)
      if (methods.includes('isolation')) {
        const isolationScore = this.calculateIsolationScore(point.price, prices);
        if (isolationScore > 0.6) {
          detectionResults.push('isolation');
          reasons.push(`Score de isolamento alto (${isolationScore.toFixed(2)})`);
          outlierScore += isolationScore;
        }
      }

      // Método 4: Análise Contextual
      if (methods.includes('contextual')) {
        const contextualAnalysis = this.analyzeContextualOutlier(point, points);
        if (contextualAnalysis.isOutlier) {
          detectionResults.push('contextual');
          reasons.push(...contextualAnalysis.reasons);
          outlierScore += contextualAnalysis.score;
        }
      }

      // Se detectado por pelo menos um método
      if (detectionResults.length > 0) {
        outliers.push({
          priceId: point.id,
          medication: point.medication,
          laboratory: point.laboratory,
          price: point.price,
          expectedPrice: median, // Usar mediana como valor esperado
          deviation: Math.abs(point.price - median),
          outlierScore: outlierScore / detectionResults.length,
          isOutlier: true,
          reasons,
          detectionMethods: detectionResults,
        });
      }
    }

    return outliers;
  }

  /**
   * Análise contextual de outliers
   */
  private analyzeContextualOutlier(
    point: PriceDataPoint,
    allPoints: PriceDataPoint[]
  ): {
    isOutlier: boolean;
    score: number;
    reasons: string[];
  } {
    const reasons = [];
    let score = 0;

    // Agrupar por laboratório
    const labPrices = allPoints
      .filter(p => p.laboratory === point.laboratory)
      .map(p => p.price);
    
    const otherLabPrices = allPoints
      .filter(p => p.laboratory !== point.laboratory)
      .map(p => p.price);

    // Análise 1: Preço muito diferente do histórico do próprio laboratório
    if (labPrices.length > 1) {
      const labMean = this.mean(labPrices);
      const labStd = this.standardDeviation(labPrices);
      const labZScore = Math.abs((point.price - labMean) / labStd);
      
      if (labZScore > 2.0) {
        reasons.push(`Preço inconsistente com histórico do laboratório`);
        score += labZScore / 2.0;
      }
    }

    // Análise 2: Preço muito diferente de outros laboratórios
    if (otherLabPrices.length > 0) {
      const marketMean = this.mean(otherLabPrices);
      const priceRatio = point.price / marketMean;
      
      if (priceRatio > 3.0) {
        reasons.push(`Preço ${priceRatio.toFixed(1)}x acima da média do mercado`);
        score += Math.min(2.0, priceRatio / 3.0);
      } else if (priceRatio < 0.3) {
        reasons.push(`Preço muito abaixo da média do mercado (${(priceRatio * 100).toFixed(1)}%)`);
        score += Math.min(2.0, (0.3 - priceRatio) / 0.3);
      }
    }

    // Análise 3: Mudança brusca em relação ao preço anterior
    const chronologicalPoints = allPoints
      .filter(p => p.laboratory === point.laboratory)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    const pointIndex = chronologicalPoints.findIndex(p => p.id === point.id);
    if (pointIndex > 0) {
      const previousPrice = chronologicalPoints[pointIndex - 1].price;
      const changePercent = Math.abs((point.price - previousPrice) / previousPrice) * 100;
      
      if (changePercent > 50) {
        reasons.push(`Mudança brusca de ${changePercent.toFixed(1)}% em relação ao preço anterior`);
        score += Math.min(2.0, changePercent / 50);
      }
    }

    // Análise 4: Preços suspeitos (muito baixos ou muito altos)
    if (point.price < 0.01) {
      reasons.push('Preço suspeito: muito próximo de zero');
      score += 3.0;
    } else if (point.price > 10000) {
      reasons.push('Preço suspeito: muito alto (possível erro de cadastro)');
      score += 2.0;
    }

    return {
      isOutlier: score > 1.0,
      score,
      reasons,
    };
  }

  /**
   * Calcula score de isolamento simplificado
   */
  private calculateIsolationScore(value: number, dataset: number[]): number {
    // Implementação simplificada do Isolation Forest
    // Mede quão "isolado" um ponto está do resto dos dados
    
    const sortedData = [...dataset].sort((a, b) => a - b);
    const valueIndex = sortedData.findIndex(v => v >= value);
    
    if (valueIndex === -1) {
      // Valor maior que todos os outros
      return 1.0;
    }
    
    if (valueIndex === 0) {
      // Valor menor que todos os outros
      return 1.0;
    }
    
    // Calcular distância relativa aos vizinhos
    const leftNeighbor = sortedData[valueIndex - 1];
    const rightNeighbor = sortedData[valueIndex];
    const neighborDistance = Math.abs(rightNeighbor - leftNeighbor);
    const valueDistance = Math.min(
      Math.abs(value - leftNeighbor),
      Math.abs(value - rightNeighbor)
    );
    
    // Score baseado na densidade local
    const density = neighborDistance / (sortedData[sortedData.length - 1] - sortedData[0]);
    const isolation = valueDistance / neighborDistance;
    
    return Math.min(1.0, isolation / density);
  }

  /**
   * Agrupa dados por medicamento
   */
  private groupByMedication(data: PriceDataPoint[]): Record<string, PriceDataPoint[]> {
    return data.reduce((groups, point) => {
      if (!groups[point.medication]) {
        groups[point.medication] = [];
      }
      groups[point.medication].push(point);
      return groups;
    }, {} as Record<string, PriceDataPoint[]>);
  }

  /**
   * Calcula estatísticas descritivas
   */
  private calculateStatistics(prices: number[]) {
    const sorted = [...prices].sort((a, b) => a - b);
    
    return {
      meanPrice: this.mean(prices),
      medianPrice: this.median(prices),
      standardDeviation: this.standardDeviation(prices),
      iqr: this.percentile(sorted, 75) - this.percentile(sorted, 25),
      q1: this.percentile(sorted, 25),
      q3: this.percentile(sorted, 75),
    };
  }

  /**
   * Utilitários estatísticos
   */
  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private standardDeviation(values: number[]): number {
    const mean = this.mean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private percentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Detecta outliers temporais (mudanças bruscas)
   */
  async detectTemporalOutliers(
    data: PriceDataPoint[],
    changeThreshold: number = 30 // Porcentagem de mudança
  ): Promise<OutlierResult[]> {
    try {
      const outliers: OutlierResult[] = [];
      
      // Agrupar por medicamento e laboratório
      const groups = this.groupByMedicationAndLab(data);
      
      for (const [key, points] of Object.entries(groups)) {
        const [medication, laboratory] = key.split('|');
        const sortedPoints = points.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        for (let i = 1; i < sortedPoints.length; i++) {
          const current = sortedPoints[i];
          const previous = sortedPoints[i - 1];
          
          const changePercent = Math.abs((current.price - previous.price) / previous.price) * 100;
          
          if (changePercent > changeThreshold) {
            outliers.push({
              priceId: current.id,
              medication,
              laboratory,
              price: current.price,
              expectedPrice: previous.price,
              deviation: Math.abs(current.price - previous.price),
              outlierScore: changePercent / changeThreshold,
              isOutlier: true,
              reasons: [
                `Mudança brusca de ${changePercent.toFixed(1)}% em relação ao preço anterior`,
                `Preço anterior: R$ ${previous.price.toFixed(2)}`,
                `Data anterior: ${previous.date.toLocaleDateString('pt-BR')}`,
              ],
              detectionMethods: ['temporal'],
            });
          }
        }
      }
      
      return outliers;
    } catch (error) {
      this.logger.error(`Erro na detecção temporal: ${error.message}`);
      return [];
    }
  }

  /**
   * Detecta outliers de fonte (possíveis erros de integração)
   */
  async detectSourceOutliers(
    data: PriceDataPoint[]
  ): Promise<OutlierResult[]> {
    try {
      const outliers: OutlierResult[] = [];
      
      // Agrupar por medicamento
      const groupedData = this.groupByMedication(data);
      
      for (const [medicationCode, points] of Object.entries(groupedData)) {
        // Agrupar por fonte
        const sourceGroups = points.reduce((groups, point) => {
          if (!groups[point.source]) {
            groups[point.source] = [];
          }
          groups[point.source].push(point);
          return groups;
        }, {} as Record<string, PriceDataPoint[]>);

        // Comparar preços entre fontes
        const sourceMeans = Object.entries(sourceGroups).map(([source, sourcePoints]) => ({
          source,
          mean: this.mean(sourcePoints.map(p => p.price)),
          count: sourcePoints.length,
          points: sourcePoints,
        }));

        // Detectar fontes com preços muito divergentes
        const overallMean = this.mean(points.map(p => p.price));
        
        for (const sourceData of sourceMeans) {
          const deviation = Math.abs(sourceData.mean - overallMean) / overallMean;
          
          if (deviation > 0.5 && sourceData.count >= 3) { // 50% de desvio
            for (const point of sourceData.points) {
              outliers.push({
                priceId: point.id,
                medication: medicationCode,
                laboratory: point.laboratory,
                price: point.price,
                expectedPrice: overallMean,
                deviation: Math.abs(point.price - overallMean),
                outlierScore: deviation,
                isOutlier: true,
                reasons: [
                  `Fonte "${point.source}" com preços ${deviation > 0 ? 'acima' : 'abaixo'} da média`,
                  `Desvio de ${(deviation * 100).toFixed(1)}% da média geral`,
                  `Média da fonte: R$ ${sourceData.mean.toFixed(2)}`,
                  `Média geral: R$ ${overallMean.toFixed(2)}`,
                ],
                detectionMethods: ['source'],
              });
            }
          }
        }
      }
      
      return outliers;
    } catch (error) {
      this.logger.error(`Erro na detecção por fonte: ${error.message}`);
      return [];
    }
  }

  /**
   * Detecta padrões fraudulentos
   */
  async detectFraudPatterns(
    data: PriceDataPoint[]
  ): Promise<OutlierResult[]> {
    try {
      const outliers: OutlierResult[] = [];
      
      // Padrão 1: Preços idênticos repetidos (possível manipulação)
      const identicalPrices = this.findIdenticalPricePatterns(data);
      outliers.push(...identicalPrices);
      
      // Padrão 2: Progressão artificial de preços
      const artificialProgression = this.findArtificialProgression(data);
      outliers.push(...artificialProgression);
      
      // Padrão 3: Preços "redondos" demais
      const roundNumberBias = this.findRoundNumberBias(data);
      outliers.push(...roundNumberBias);
      
      return outliers;
    } catch (error) {
      this.logger.error(`Erro na detecção de fraudes: ${error.message}`);
      return [];
    }
  }

  /**
   * Encontra padrões de preços idênticos suspeitos
   */
  private findIdenticalPricePatterns(data: PriceDataPoint[]): OutlierResult[] {
    const outliers: OutlierResult[] = [];
    
    // Agrupar por preço exato
    const priceGroups = data.reduce((groups, point) => {
      const price = point.price.toString();
      if (!groups[price]) {
        groups[price] = [];
      }
      groups[price].push(point);
      return groups;
    }, {} as Record<string, PriceDataPoint[]>);

    // Detectar preços com muitas repetições
    for (const [price, points] of Object.entries(priceGroups)) {
      if (points.length >= 5) { // 5 ou mais ocorrências do mesmo preço
        const uniqueLabs = new Set(points.map(p => p.laboratory));
        
        if (uniqueLabs.size >= 3) { // Em 3 ou mais laboratórios diferentes
          for (const point of points) {
            outliers.push({
              priceId: point.id,
              medication: point.medication,
              laboratory: point.laboratory,
              price: point.price,
              expectedPrice: point.price,
              deviation: 0,
              outlierScore: points.length / 5,
              isOutlier: true,
              reasons: [
                `Preço idêntico (R$ ${price}) repetido ${points.length} vezes`,
                `Em ${uniqueLabs.size} laboratórios diferentes`,
                'Possível manipulação ou erro sistêmico',
              ],
              detectionMethods: ['fraud_identical'],
            });
          }
        }
      }
    }
    
    return outliers;
  }

  /**
   * Detecta progressão artificial de preços
   */
  private findArtificialProgression(data: PriceDataPoint[]): OutlierResult[] {
    // Implementação simplificada
    // Em produção, usaria análise mais sofisticada de padrões temporais
    return [];
  }

  /**
   * Detecta viés de números redondos
   */
  private findRoundNumberBias(data: PriceDataPoint[]): OutlierResult[] {
    const outliers: OutlierResult[] = [];
    
    for (const point of data) {
      const price = point.price;
      
      // Verificar se é um número "muito redondo"
      const isRoundNumber = (
        price % 10 === 0 || // Múltiplo de 10
        price % 5 === 0 ||  // Múltiplo de 5
        price === Math.round(price) // Número inteiro
      );
      
      const isVeryRound = price % 100 === 0; // Múltiplo de 100
      
      if (isVeryRound && price > 100) {
        outliers.push({
          priceId: point.id,
          medication: point.medication,
          laboratory: point.laboratory,
          price: point.price,
          expectedPrice: point.price,
          deviation: 0,
          outlierScore: 1.5,
          isOutlier: true,
          reasons: [
            'Preço "muito redondo" (múltiplo de 100)',
            'Possível estimativa ou erro de cadastro',
          ],
          detectionMethods: ['round_number'],
        });
      }
    }
    
    return outliers;
  }

  /**
   * Agrupa dados por medicamento e laboratório
   */
  private groupByMedicationAndLab(data: PriceDataPoint[]): Record<string, PriceDataPoint[]> {
    return data.reduce((groups, point) => {
      const key = `${point.medication}|${point.laboratory}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(point);
      return groups;
    }, {} as Record<string, PriceDataPoint[]>);
  }
}
