import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ComplexQuery {
  query: string;
  userProfile: 'medico' | 'hospital' | 'distribuidor' | 'analista';
  queryType: 'analysis' | 'comparison' | 'trend' | 'recommendation' | 'explanation';
  parameters?: {
    timeframe?: number; // dias
    category?: string;
    laboratory?: string;
    priceRange?: { min: number; max: number };
    limit?: number;
  };
}

export interface QueryResult {
  answer: string;
  data: any[];
  insights: string[];
  recommendations: string[];
  charts?: any[];
  confidence: number;
  sources: string[];
}

export interface UserProfile {
  type: 'medico' | 'hospital' | 'distribuidor' | 'analista';
  name: string;
  specialties?: string[];
  interests: string[];
  favoriteCategories: string[];
  watchlist: string[];
}

@Injectable()
export class AdvancedLLMService {
  private readonly logger = new Logger(AdvancedLLMService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Processa consultas complexas baseadas no perfil do usuário
   */
  async processComplexQuery(query: ComplexQuery): Promise<QueryResult> {
    try {
      this.logger.log(`Processando consulta complexa: ${query.queryType} para ${query.userProfile}`);

      // Identificar tipo de consulta
      const queryType = this.identifyQueryType(query.query);
      
      // Buscar dados relevantes
      const data = await this.fetchRelevantData(query);
      
      // Processar baseado no tipo de consulta
      let result: QueryResult;
      
      switch (queryType) {
        case 'top_medications':
          result = await this.processTopMedicationsQuery(query, data);
          break;
        case 'price_changes':
          result = await this.processPriceChangesQuery(query, data);
          break;
        case 'comparison':
          result = await this.processComparisonQuery(query, data);
          break;
        case 'explanation':
          result = await this.processExplanationQuery(query, data);
          break;
        case 'simulation':
          result = await this.processSimulationQuery(query, data);
          break;
        default:
          result = await this.processGeneralQuery(query, data);
      }

      // Personalizar resposta baseada no perfil
      result = this.personalizeForProfile(result, query.userProfile);

      return result;
    } catch (error) {
      this.logger.error(`Erro ao processar consulta: ${error.message}`);
      throw error;
    }
  }

  /**
   * Identifica o tipo de consulta baseado no texto
   */
  private identifyQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('top') || lowerQuery.includes('maiores') || lowerQuery.includes('melhores')) {
      return 'top_medications';
    }
    if (lowerQuery.includes('queda') || lowerQuery.includes('subiu') || lowerQuery.includes('variação')) {
      return 'price_changes';
    }
    if (lowerQuery.includes('compare') || lowerQuery.includes('versus') || lowerQuery.includes('diferença')) {
      return 'comparison';
    }
    if (lowerQuery.includes('por que') || lowerQuery.includes('porque') || lowerQuery.includes('explique')) {
      return 'explanation';
    }
    if (lowerQuery.includes('se eu comprar') || lowerQuery.includes('simulação') || lowerQuery.includes('cenário')) {
      return 'simulation';
    }
    
    return 'general';
  }

  /**
   * Busca dados relevantes baseados na consulta
   */
  private async fetchRelevantData(query: ComplexQuery): Promise<any> {
    const timeframeDays = query.parameters?.timeframe || 60;
    const cutoffDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

    // Buscar medicamentos com preços recentes
    const medications = await this.prisma.medication.findMany({
      where: query.parameters?.category ? {
        category: { contains: query.parameters.category }
      } : {},
      include: {
        prices: {
          where: {
            capturedAt: { gte: cutoffDate }
          },
          include: { lab: true },
          orderBy: { capturedAt: 'desc' }
        }
      }
    });

    return medications.filter(med => med.prices.length > 0);
  }

  /**
   * Processa consultas sobre top medicamentos
   */
  private async processTopMedicationsQuery(query: ComplexQuery, data: any[]): Promise<QueryResult> {
    const limit = query.parameters?.limit || 5;
    
    // Calcular variações de preço
    const medicationsWithChanges = data.map(med => {
      const prices = med.prices.map(p => parseFloat(p.value.toString()));
      const dates = med.prices.map(p => p.capturedAt);
      
      if (prices.length < 2) return null;
      
      const latestPrice = prices[0];
      const oldestPrice = prices[prices.length - 1];
      const priceChange = ((latestPrice - oldestPrice) / oldestPrice) * 100;
      
      return {
        medication: med,
        latestPrice,
        oldestPrice,
        priceChange,
        laboratory: med.prices[0].lab?.name || 'Unknown'
      };
    }).filter(Boolean);

    // Ordenar por maior queda (ou subida, dependendo da consulta)
    const isLookingForDrops = query.query.toLowerCase().includes('queda') || 
                             query.query.toLowerCase().includes('menor');
    
    const sorted = medicationsWithChanges.sort((a, b) => 
      isLookingForDrops ? a.priceChange - b.priceChange : b.priceChange - a.priceChange
    );

    const topMedications = sorted.slice(0, limit);

    const answer = this.generateTopMedicationsAnswer(topMedications, query, isLookingForDrops);
    const insights = this.generateTopMedicationsInsights(topMedications, isLookingForDrops);
    const recommendations = this.generateRecommendationsForProfile(topMedications, query.userProfile);

    return {
      answer,
      data: topMedications.map(item => ({
        name: item.medication.name,
        category: item.medication.category,
        priceChange: item.priceChange,
        latestPrice: item.latestPrice,
        laboratory: item.laboratory
      })),
      insights,
      recommendations,
      confidence: 0.9,
      sources: ['price_history', 'market_data']
    };
  }

  /**
   * Processa consultas sobre mudanças de preços
   */
  private async processPriceChangesQuery(query: ComplexQuery, data: any[]): Promise<QueryResult> {
    // Análise detalhada de mudanças de preços
    const priceAnalysis = await this.analyzePriceChanges(data, query.parameters?.timeframe || 60);
    
    const answer = this.generatePriceChangesAnswer(priceAnalysis, query);
    const insights = this.generatePriceChangesInsights(priceAnalysis);
    
    return {
      answer,
      data: priceAnalysis.significantChanges,
      insights,
      recommendations: [],
      confidence: 0.85,
      sources: ['price_history', 'market_analysis']
    };
  }

  /**
   * Processa explicações didáticas
   */
  private async processExplanationQuery(query: ComplexQuery, data: any[]): Promise<QueryResult> {
    // Extrair medicamento específico da consulta
    const medicationName = this.extractMedicationFromQuery(query.query);
    const medication = data.find(med => 
      med.name.toLowerCase().includes(medicationName.toLowerCase()) ||
      med.code.toLowerCase().includes(medicationName.toLowerCase())
    );

    if (!medication) {
      return {
        answer: 'Medicamento não encontrado ou não especificado claramente.',
        data: [],
        insights: [],
        recommendations: [],
        confidence: 0.3,
        sources: []
      };
    }

    // Analisar histórico detalhado
    const explanation = await this.generateDetailedExplanation(medication, query.parameters?.timeframe || 30);
    
    return {
      answer: explanation.answer,
      data: explanation.data,
      insights: explanation.insights,
      recommendations: explanation.recommendations,
      confidence: 0.9,
      sources: ['price_history', 'market_factors', 'statistical_analysis']
    };
  }

  /**
   * Processa simulações de compra
   */
  private async processSimulationQuery(query: ComplexQuery, data: any[]): Promise<QueryResult> {
    // Extrair parâmetros da simulação
    const simulation = this.extractSimulationParameters(query.query);
    
    if (!simulation.quantity || !simulation.medicationName) {
      return {
        answer: 'Parâmetros de simulação não identificados. Especifique medicamento e quantidade.',
        data: [],
        insights: [],
        recommendations: [],
        confidence: 0.3,
        sources: []
      };
    }

    const medication = data.find(med => 
      med.name.toLowerCase().includes(simulation.medicationName.toLowerCase())
    );

    if (!medication) {
      return {
        answer: `Medicamento "${simulation.medicationName}" não encontrado.`,
        data: [],
        insights: [],
        recommendations: [],
        confidence: 0.3,
        sources: []
      };
    }

    // Executar simulação
    const simulationResult = await this.runPurchaseSimulation(medication, simulation.quantity);
    
    return {
      answer: simulationResult.answer,
      data: simulationResult.data,
      insights: simulationResult.insights,
      recommendations: simulationResult.recommendations,
      confidence: 0.85,
      sources: ['price_simulation', 'market_analysis', 'cost_optimization']
    };
  }

  /**
   * Analisa mudanças de preços em detalhes
   */
  private async analyzePriceChanges(medications: any[], timeframeDays: number): Promise<any> {
    const significantChanges = [];
    const marketFactors = [];

    for (const med of medications) {
      const prices = med.prices.map(p => ({
        value: parseFloat(p.value.toString()),
        date: p.capturedAt,
        lab: p.lab?.name
      }));

      if (prices.length < 5) continue; // Precisa de dados suficientes

      // Calcular mudança significativa
      const recentPrices = prices.slice(0, Math.floor(prices.length / 3));
      const olderPrices = prices.slice(Math.floor(prices.length * 2 / 3));

      const recentAvg = recentPrices.reduce((sum, p) => sum + p.value, 0) / recentPrices.length;
      const olderAvg = olderPrices.reduce((sum, p) => sum + p.value, 0) / olderPrices.length;

      const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

      if (Math.abs(changePercent) > 10) { // Mudança significativa > 10%
        significantChanges.push({
          medication: med.name,
          category: med.category,
          changePercent,
          recentAvg,
          olderAvg,
          laboratory: recentPrices[0]?.lab,
          volatility: this.calculateVolatility(prices.map(p => p.value)),
          factors: this.identifyPriceFactors(changePercent, med.category)
        });
      }
    }

    return {
      significantChanges: significantChanges.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)),
      marketFactors,
      timeframe: timeframeDays
    };
  }

  /**
   * Gera explicação detalhada para mudança de preço
   */
  private async generateDetailedExplanation(medication: any, timeframeDays: number): Promise<any> {
    const prices = medication.prices.map(p => ({
      value: parseFloat(p.value.toString()),
      date: p.capturedAt,
      lab: p.lab?.name
    }));

    // Análise temporal detalhada
    const timeAnalysis = this.analyzeTemporalPatterns(prices);
    const factorAnalysis = this.analyzePriceFactors(medication, timeAnalysis);
    
    const answer = `
📊 **Análise Detalhada: ${medication.name}**

**Mudança de Preço:**
${timeAnalysis.changePercent > 0 ? '📈' : '📉'} Variação de ${Math.abs(timeAnalysis.changePercent).toFixed(1)}% nos últimos ${timeframeDays} dias
• Preço atual: R$ ${timeAnalysis.currentPrice.toFixed(2)}
• Preço anterior: R$ ${timeAnalysis.previousPrice.toFixed(2)}
• Laboratório: ${timeAnalysis.currentLab}

**Fatores Identificados:**
${factorAnalysis.factors.map(f => `• ${f}`).join('\n')}

**Contexto de Mercado:**
• Categoria: ${medication.category}
• Volatilidade: ${timeAnalysis.volatility.toFixed(1)}%
• Tendência: ${timeAnalysis.trend}

**Explicação Técnica:**
${factorAnalysis.technicalExplanation}
    `;

    return {
      answer,
      data: timeAnalysis,
      insights: factorAnalysis.insights,
      recommendations: factorAnalysis.recommendations
    };
  }

  /**
   * Executa simulação de compra em lote
   */
  private async runPurchaseSimulation(medication: any, quantity: number): Promise<any> {
    // Agrupar preços por laboratório
    const labPrices = {};
    medication.prices.forEach(price => {
      const labName = price.lab?.name || 'Unknown';
      if (!labPrices[labName]) {
        labPrices[labName] = [];
      }
      labPrices[labName].push(parseFloat(price.value.toString()));
    });

    // Calcular custos por laboratório
    const simulationResults = Object.entries(labPrices).map(([lab, prices]) => {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const totalCost = avgPrice * quantity;
      
      return {
        laboratory: lab,
        avgPrice,
        minPrice,
        maxPrice,
        totalCost,
        quantity,
        savings: 0, // Será calculado depois
        riskLevel: this.calculateRiskLevel(prices),
        recommendation: this.getLabRecommendation(avgPrice, prices.length)
      };
    });

    // Calcular economia relativa
    const cheapestTotal = Math.min(...simulationResults.map(r => r.totalCost));
    simulationResults.forEach(result => {
      result.savings = result.totalCost - cheapestTotal;
    });

    // Ordenar por melhor custo-benefício
    const sorted = simulationResults.sort((a, b) => a.totalCost - b.totalCost);

    const answer = `
🛒 **Simulação de Compra: ${medication.name}**

**Quantidade:** ${quantity.toLocaleString()} unidades

**Melhor Opção:**
🏆 ${sorted[0].laboratory}
• Custo total: R$ ${sorted[0].totalCost.toLocaleString()}
• Preço unitário: R$ ${sorted[0].avgPrice.toFixed(2)}
• Risco: ${sorted[0].riskLevel}

**Comparação com Outros:**
${sorted.slice(1, 4).map((result, index) => 
  `${index + 2}º ${result.laboratory}: R$ ${result.totalCost.toLocaleString()} (+R$ ${result.savings.toLocaleString()})`
).join('\n')}

**Economia Máxima:**
💰 Escolhendo ${sorted[0].laboratory} vs ${sorted[sorted.length - 1].laboratory}: 
R$ ${(sorted[sorted.length - 1].totalCost - sorted[0].totalCost).toLocaleString()} de economia
    `;

    return {
      answer,
      data: sorted,
      insights: this.generateSimulationInsights(sorted, quantity),
      recommendations: this.generateSimulationRecommendations(sorted, medication.category)
    };
  }

  /**
   * Personaliza resposta baseada no perfil do usuário
   */
  private personalizeForProfile(result: QueryResult, profile: string): QueryResult {
    const profileCustomizations = {
      medico: {
        focus: 'eficácia clínica',
        additionalInfo: ['indicações terapêuticas', 'contraindicações', 'posologia'],
        tone: 'técnico-científico'
      },
      hospital: {
        focus: 'custo-efetividade',
        additionalInfo: ['volume de compra', 'logística', 'contratos'],
        tone: 'administrativo'
      },
      distribuidor: {
        focus: 'margem de lucro',
        additionalInfo: ['demanda de mercado', 'competitividade', 'sazonalidade'],
        tone: 'comercial'
      },
      analista: {
        focus: 'dados estatísticos',
        additionalInfo: ['tendências', 'correlações', 'projeções'],
        tone: 'analítico'
      }
    };

    const customization = profileCustomizations[profile];
    
    // Adicionar insights específicos do perfil
    const profileInsights = this.generateProfileSpecificInsights(result.data, profile);
    result.insights = [...result.insights, ...profileInsights];

    // Adicionar recomendações específicas
    const profileRecommendations = this.generateProfileRecommendations(result.data, profile);
    result.recommendations = [...result.recommendations, ...profileRecommendations];

    return result;
  }

  /**
   * Gera insights específicos por perfil
   */
  private generateProfileSpecificInsights(data: any[], profile: string): string[] {
    const insights = [];

    switch (profile) {
      case 'medico':
        insights.push('👨‍⚕️ Considere impacto clínico na escolha do laboratório');
        insights.push('📋 Verifique equivalência terapêutica entre genéricos');
        break;
      case 'hospital':
        insights.push('🏥 Analise volume mínimo para contratos especiais');
        insights.push('📦 Considere capacidade de armazenamento');
        break;
      case 'distribuidor':
        insights.push('📈 Monitore demanda regional para estes medicamentos');
        insights.push('🚚 Otimize logística para medicamentos de maior giro');
        break;
      case 'analista':
        insights.push('📊 Correlacione com índices econômicos do setor');
        insights.push('🔍 Analise padrões sazonais nos dados');
        break;
    }

    return insights;
  }

  /**
   * Gera recomendações específicas por perfil
   */
  private generateProfileRecommendations(data: any[], profile: string): string[] {
    const recommendations = [];

    switch (profile) {
      case 'medico':
        recommendations.push('Consulte bula para verificar bioequivalência');
        recommendations.push('Monitore resposta clínica ao trocar laboratórios');
        break;
      case 'hospital':
        recommendations.push('Negocie contratos anuais para medicamentos de alto giro');
        recommendations.push('Implemente sistema de reposição automática');
        break;
      case 'distribuidor':
        recommendations.push('Diversifique fornecedores para reduzir riscos');
        recommendations.push('Monitore concorrência regional');
        break;
      case 'analista':
        recommendations.push('Crie dashboards automatizados para monitoramento');
        recommendations.push('Implemente alertas para mudanças > 15%');
        break;
    }

    return recommendations;
  }

  /**
   * Utilitários auxiliares
   */
  private generateTopMedicationsAnswer(medications: any[], query: ComplexQuery, isDrops: boolean): string {
    const action = isDrops ? 'queda' : 'alta';
    const emoji = isDrops ? '📉' : '📈';
    
    let answer = `${emoji} **Top ${medications.length} medicamentos com maior ${action} de preço:**\n\n`;
    
    medications.forEach((med, index) => {
      const changeEmoji = med.priceChange < 0 ? '📉' : '📈';
      answer += `${index + 1}. **${med.medication.name}** (${med.laboratory})\n`;
      answer += `   ${changeEmoji} ${Math.abs(med.priceChange).toFixed(1)}% - R$ ${med.latestPrice.toFixed(2)}\n`;
      answer += `   Categoria: ${med.medication.category}\n\n`;
    });

    return answer;
  }

  private generateTopMedicationsInsights(medications: any[], isDrops: boolean): string[] {
    const insights = [];
    
    const avgChange = medications.reduce((sum, med) => sum + Math.abs(med.priceChange), 0) / medications.length;
    insights.push(`Variação média: ${avgChange.toFixed(1)}%`);
    
    const categories = [...new Set(medications.map(med => med.medication.category))];
    if (categories.length > 1) {
      insights.push(`Categorias afetadas: ${categories.length}`);
    }

    if (isDrops) {
      insights.push('💰 Oportunidades de economia identificadas');
    } else {
      insights.push('⚠️ Possível pressão inflacionária no setor');
    }

    return insights;
  }

  private calculateVolatility(prices: number[]): number {
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    return (Math.sqrt(variance) / mean) * 100;
  }

  private analyzeTemporalPatterns(prices: any[]): any {
    const currentPrice = prices[0]?.value || 0;
    const previousPrice = prices[prices.length - 1]?.value || currentPrice;
    const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
    
    return {
      currentPrice,
      previousPrice,
      changePercent,
      currentLab: prices[0]?.lab,
      volatility: this.calculateVolatility(prices.map(p => p.value)),
      trend: changePercent > 5 ? 'alta' : changePercent < -5 ? 'queda' : 'estável'
    };
  }

  private analyzePriceFactors(medication: any, timeAnalysis: any): any {
    const factors = [];
    const insights = [];
    const recommendations = [];

    // Fatores baseados na categoria
    if (medication.category?.includes('Oncológico')) {
      factors.push('🎗️ Medicamento oncológico - sujeito a políticas de saúde');
      factors.push('💊 Possível impacto de novos tratamentos no mercado');
    }
    
    if (medication.category?.includes('SUS')) {
      factors.push('🏥 Medicamento SUS - preços regulamentados');
    }

    // Fatores baseados na mudança
    if (Math.abs(timeAnalysis.changePercent) > 20) {
      factors.push('📊 Mudança significativa - investigar causas específicas');
      insights.push('Mudança acima de 20% pode indicar fatores externos');
    }

    if (timeAnalysis.volatility > 30) {
      factors.push('📈 Alta volatilidade - mercado instável');
      recommendations.push('Monitorar diariamente por instabilidade');
    }

    const technicalExplanation = `
A variação de ${timeAnalysis.changePercent.toFixed(1)}% pode ser explicada por:
1. Dinâmica de oferta e demanda no período
2. Políticas de precificação dos laboratórios
3. Fatores econômicos gerais (inflação, câmbio)
4. Sazonalidade específica da categoria
5. Mudanças regulatórias ou de mercado
    `;

    return {
      factors,
      insights,
      recommendations,
      technicalExplanation: technicalExplanation.trim()
    };
  }

  private identifyPriceFactors(changePercent: number, category: string): string[] {
    const factors = [];
    
    if (Math.abs(changePercent) > 30) {
      factors.push('Mudança drástica - possível erro ou evento específico');
    } else if (Math.abs(changePercent) > 15) {
      factors.push('Mudança significativa - fatores de mercado');
    }

    if (category?.includes('Oncológico') && changePercent > 0) {
      factors.push('Possível escassez ou nova indicação terapêutica');
    }

    return factors;
  }

  private extractMedicationFromQuery(query: string): string {
    // Regex simples para extrair nome de medicamento
    const medicationPatterns = [
      /medicamento (\w+)/i,
      /(\w+) subiu/i,
      /(\w+) caiu/i,
      /"([^"]+)"/,
      /\b([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\b/
    ];

    for (const pattern of medicationPatterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return '';
  }

  private extractSimulationParameters(query: string): any {
    const quantityMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:mil|thousand|unidades?)/i);
    const medicationMatch = query.match(/(?:medicamento|comprar)\s+([a-zA-Z\s]+)/i);

    return {
      quantity: quantityMatch ? parseFloat(quantityMatch[1]) * (quantityMatch[0].includes('mil') ? 1000 : 1) : null,
      medicationName: medicationMatch ? medicationMatch[1].trim() : ''
    };
  }

  private calculateRiskLevel(prices: number[]): string {
    const volatility = this.calculateVolatility(prices);
    
    if (volatility > 50) return 'Alto';
    if (volatility > 25) return 'Médio';
    return 'Baixo';
  }

  private getLabRecommendation(avgPrice: number, dataPoints: number): string {
    if (dataPoints < 5) return 'Dados insuficientes';
    if (avgPrice < 100) return 'Boa opção para volume';
    if (avgPrice > 1000) return 'Verificar qualidade/especificidade';
    return 'Opção equilibrada';
  }

  private generateSimulationInsights(results: any[], quantity: number): string[] {
    const insights = [];
    
    const totalRange = results[results.length - 1].totalCost - results[0].totalCost;
    const percentSavings = (totalRange / results[results.length - 1].totalCost) * 100;
    
    insights.push(`💰 Economia potencial: ${percentSavings.toFixed(1)}% escolhendo melhor laboratório`);
    insights.push(`📊 Diferença de R$ ${totalRange.toLocaleString()} entre melhor e pior opção`);
    
    if (quantity > 1000) {
      insights.push('📦 Volume alto - considere negociar desconto adicional');
    }

    return insights;
  }

  private generateSimulationRecommendations(results: any[], category: string): string[] {
    const recommendations = [];
    
    recommendations.push(`Escolher ${results[0].laboratory} para melhor custo-benefício`);
    
    if (results[0].riskLevel === 'Alto') {
      recommendations.push('⚠️ Considere diversificar fornecedores devido ao risco');
    }

    if (category?.includes('Oncológico')) {
      recommendations.push('🎗️ Verificar equivalência terapêutica para oncológicos');
    }

    return recommendations;
  }

  private generatePriceChangesAnswer(analysis: any, query: ComplexQuery): string {
    const { significantChanges } = analysis;
    
    let answer = `📊 **Análise de Mudanças de Preços (${analysis.timeframe} dias):**\n\n`;
    
    if (significantChanges.length === 0) {
      answer += '✅ Nenhuma mudança significativa detectada no período.\n';
      answer += 'Os preços estão estáveis dentro da normalidade.';
    } else {
      answer += `⚠️ ${significantChanges.length} medicamentos com mudanças significativas:\n\n`;
      
      significantChanges.slice(0, 10).forEach((change, index) => {
        const emoji = change.changePercent < 0 ? '📉' : '📈';
        answer += `${index + 1}. **${change.medication}** (${change.laboratory})\n`;
        answer += `   ${emoji} ${Math.abs(change.changePercent).toFixed(1)}% - R$ ${change.recentAvg.toFixed(2)}\n`;
        answer += `   Fatores: ${change.factors.join(', ')}\n\n`;
      });
    }

    return answer;
  }

  private generatePriceChangesInsights(analysis: any): string[] {
    const insights = [];
    const { significantChanges } = analysis;
    
    if (significantChanges.length > 0) {
      const avgChange = significantChanges.reduce((sum, c) => sum + Math.abs(c.changePercent), 0) / significantChanges.length;
      insights.push(`Variação média: ${avgChange.toFixed(1)}%`);
      
      const increases = significantChanges.filter(c => c.changePercent > 0).length;
      const decreases = significantChanges.filter(c => c.changePercent < 0).length;
      
      if (increases > decreases) {
        insights.push('📈 Tendência geral de alta nos preços');
      } else if (decreases > increases) {
        insights.push('📉 Tendência geral de queda nos preços');
      } else {
        insights.push('⚖️ Mercado equilibrado com altas e baixas');
      }
    }

    return insights;
  }

  private async processGeneralQuery(query: ComplexQuery, data: any[]): Promise<QueryResult> {
    // Fallback para consultas gerais
    return {
      answer: 'Consulta geral processada. Para melhor resultado, use consultas específicas como "top 5 medicamentos oncológicos com maior queda".',
      data: data.slice(0, 5),
      insights: ['Use consultas mais específicas para melhores resultados'],
      recommendations: ['Tente: "Compare preços de X vs Y" ou "Por que medicamento X subiu?"'],
      confidence: 0.6,
      sources: ['general_database']
    };
  }
}
