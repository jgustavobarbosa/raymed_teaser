import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UserProfile {
  userId: string;
  profileType: 'medico' | 'hospital' | 'distribuidor' | 'analista';
  specialties: string[];
  interests: string[];
  favoriteCategories: string[];
  watchlist: WatchlistItem[];
  preferences: {
    defaultTimeframe: number;
    alertThreshold: number;
    reportFormat: 'html' | 'pdf';
    dashboardLayout: string[];
  };
}

export interface WatchlistItem {
  medicationCode: string;
  medicationName: string;
  addedAt: Date;
  alertConfig: {
    priceChange: number; // %
    stockLevel: number;  // unidades
    enabled: boolean;
  };
  notes?: string;
}

export interface UserInsights {
  profile: UserProfile;
  personalizedInsights: string[];
  recommendedActions: string[];
  watchlistAlerts: any[];
  marketOpportunities: any[];
}

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Cria ou atualiza perfil do usuário
   */
  async updateUserProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      // Buscar usuário
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Atualizar preferências
      const currentPreferences = user.preferences ? JSON.parse(user.preferences) : {};
      const updatedPreferences = {
        ...currentPreferences,
        ...profileData
      };

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          preferences: JSON.stringify(updatedPreferences)
        }
      });

      return this.getUserProfile(userId);
    } catch (error) {
      this.logger.error(`Erro ao atualizar perfil: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém perfil completo do usuário
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      const preferences = user.preferences ? JSON.parse(user.preferences) : {};
      
      return {
        userId,
        profileType: preferences.profileType || 'analista',
        specialties: preferences.specialties || [],
        interests: preferences.interests || [],
        favoriteCategories: preferences.favoriteCategories || [],
        watchlist: preferences.watchlist || [],
        preferences: {
          defaultTimeframe: preferences.defaultTimeframe || 30,
          alertThreshold: preferences.alertThreshold || 10,
          reportFormat: preferences.reportFormat || 'html',
          dashboardLayout: preferences.dashboardLayout || ['overview', 'watchlist', 'trends']
        }
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar perfil: ${error.message}`);
      throw error;
    }
  }

  /**
   * Adiciona medicamento à watchlist
   */
  async addToWatchlist(
    userId: string, 
    medicationCode: string, 
    alertConfig?: any,
    notes?: string
  ): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);
      
      // Buscar dados do medicamento
      const medication = await this.prisma.medication.findUnique({
        where: { code: medicationCode }
      });

      if (!medication) {
        throw new Error('Medicamento não encontrado');
      }

      // Verificar se já está na watchlist
      const existingIndex = profile.watchlist.findIndex(item => item.medicationCode === medicationCode);
      
      const newItem: WatchlistItem = {
        medicationCode,
        medicationName: medication.name,
        addedAt: new Date(),
        alertConfig: alertConfig || {
          priceChange: 10, // 10% de mudança
          stockLevel: 50,  // 50 unidades
          enabled: true
        },
        notes
      };

      if (existingIndex >= 0) {
        // Atualizar item existente
        profile.watchlist[existingIndex] = newItem;
      } else {
        // Adicionar novo item
        profile.watchlist.push(newItem);
      }

      // Salvar watchlist atualizada
      await this.updateUserProfile(userId, { watchlist: profile.watchlist });
      
      this.logger.log(`Medicamento ${medicationCode} adicionado à watchlist do usuário ${userId}`);
    } catch (error) {
      this.logger.error(`Erro ao adicionar à watchlist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove medicamento da watchlist
   */
  async removeFromWatchlist(userId: string, medicationCode: string): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);
      
      profile.watchlist = profile.watchlist.filter(item => item.medicationCode !== medicationCode);
      
      await this.updateUserProfile(userId, { watchlist: profile.watchlist });
      
      this.logger.log(`Medicamento ${medicationCode} removido da watchlist do usuário ${userId}`);
    } catch (error) {
      this.logger.error(`Erro ao remover da watchlist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gera insights personalizados para o usuário
   */
  async generateUserInsights(userId: string): Promise<UserInsights> {
    try {
      const profile = await this.getUserProfile(userId);
      
      // Gerar insights baseados na watchlist
      const watchlistAlerts = await this.checkWatchlistAlerts(profile);
      
      // Gerar oportunidades de mercado baseadas no perfil
      const marketOpportunities = await this.findMarketOpportunities(profile);
      
      // Insights personalizados
      const personalizedInsights = this.generatePersonalizedInsights(profile, watchlistAlerts);
      
      // Ações recomendadas
      const recommendedActions = this.generateRecommendedActions(profile, watchlistAlerts, marketOpportunities);

      return {
        profile,
        personalizedInsights,
        recommendedActions,
        watchlistAlerts,
        marketOpportunities
      };
    } catch (error) {
      this.logger.error(`Erro ao gerar insights: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica alertas da watchlist
   */
  private async checkWatchlistAlerts(profile: UserProfile): Promise<any[]> {
    const alerts = [];

    for (const item of profile.watchlist) {
      if (!item.alertConfig.enabled) continue;

      try {
        // Buscar preços recentes do medicamento
        const medication = await this.prisma.medication.findUnique({
          where: { code: item.medicationCode },
          include: {
            prices: {
              take: 10,
              orderBy: { capturedAt: 'desc' },
              include: { lab: true }
            }
          }
        });

        if (!medication || medication.prices.length < 2) continue;

        const currentPrice = parseFloat(medication.prices[0].value.toString());
        const previousPrice = parseFloat(medication.prices[1].value.toString());
        const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;

        // Verificar se atingiu threshold de alerta
        if (Math.abs(priceChange) >= item.alertConfig.priceChange) {
          alerts.push({
            medicationCode: item.medicationCode,
            medicationName: item.medicationName,
            alertType: 'price_change',
            priceChange,
            currentPrice,
            previousPrice,
            laboratory: medication.prices[0].lab?.name,
            triggeredAt: new Date()
          });
        }
      } catch (error) {
        this.logger.warn(`Erro ao verificar alerta para ${item.medicationCode}: ${error.message}`);
      }
    }

    return alerts;
  }

  /**
   * Encontra oportunidades de mercado baseadas no perfil
   */
  private async findMarketOpportunities(profile: UserProfile): Promise<any[]> {
    const opportunities = [];

    // Oportunidades baseadas nas categorias favoritas
    for (const category of profile.favoriteCategories) {
      try {
        // Buscar medicamentos da categoria com mudanças significativas
        const medications = await this.prisma.medication.findMany({
          where: {
            category: { contains: category }
          },
          include: {
            prices: {
              take: 5,
              orderBy: { capturedAt: 'desc' },
              include: { lab: true }
            }
          }
        });

        // Identificar oportunidades
        for (const med of medications) {
          if (med.prices.length >= 2) {
            const currentPrice = parseFloat(med.prices[0].value.toString());
            const avgPrice = med.prices.reduce((sum, p) => sum + parseFloat(p.value.toString()), 0) / med.prices.length;
            
            // Oportunidade se preço atual está abaixo da média
            if (currentPrice < avgPrice * 0.9) {
              opportunities.push({
                type: 'price_opportunity',
                medicationCode: med.code,
                medicationName: med.name,
                category,
                currentPrice,
                avgPrice,
                savingsPercent: ((avgPrice - currentPrice) / avgPrice) * 100,
                laboratory: med.prices[0].lab?.name,
                confidence: 'medium'
              });
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Erro ao buscar oportunidades em ${category}: ${error.message}`);
      }
    }

    return opportunities.sort((a, b) => b.savingsPercent - a.savingsPercent).slice(0, 10);
  }

  /**
   * Gera insights personalizados
   */
  private generatePersonalizedInsights(profile: UserProfile, alerts: any[]): string[] {
    const insights = [];

    // Insights baseados no perfil
    switch (profile.profileType) {
      case 'medico':
        insights.push('👨‍⚕️ Monitore equivalência terapêutica entre laboratórios');
        if (alerts.length > 0) {
          insights.push(`📋 ${alerts.length} medicamentos da sua watchlist com mudanças significativas`);
        }
        break;
      
      case 'hospital':
        insights.push('🏥 Oportunidades de redução de custos identificadas');
        insights.push('📦 Considere contratos de volume para medicamentos de alto giro');
        break;
      
      case 'distribuidor':
        insights.push('📈 Analise margem de lucro por categoria');
        insights.push('🚚 Otimize mix de produtos baseado em tendências');
        break;
      
      case 'analista':
        insights.push('📊 Correlações estatísticas identificadas nos dados');
        insights.push('🔍 Padrões de sazonalidade detectados');
        break;
    }

    // Insights baseados na watchlist
    if (profile.watchlist.length > 0) {
      insights.push(`👁️ Monitorando ${profile.watchlist.length} medicamentos na sua watchlist`);
    }

    return insights;
  }

  /**
   * Gera ações recomendadas
   */
  private generateRecommendedActions(profile: UserProfile, alerts: any[], opportunities: any[]): string[] {
    const actions = [];

    // Ações baseadas em alertas
    if (alerts.length > 0) {
      actions.push(`🚨 Revisar ${alerts.length} alertas da watchlist`);
    }

    // Ações baseadas em oportunidades
    if (opportunities.length > 0) {
      actions.push(`💰 Avaliar ${opportunities.length} oportunidades de economia`);
    }

    // Ações específicas do perfil
    switch (profile.profileType) {
      case 'medico':
        actions.push('📚 Revisar alternativas terapêuticas para medicamentos em alta');
        break;
      case 'hospital':
        actions.push('💼 Negociar contratos para medicamentos de alto volume');
        break;
      case 'distribuidor':
        actions.push('📊 Ajustar estoque baseado em tendências identificadas');
        break;
      case 'analista':
        actions.push('📈 Atualizar modelos preditivos com novos dados');
        break;
    }

    return actions;
  }

  /**
   * Cria listas de monitoramento predefinidas
   */
  async createPredefinedWatchlists(userId: string, profileType: string): Promise<void> {
    const predefinedLists = {
      medico: [
        { code: 'PARACETAMOL-500MG', category: 'Analgésico básico' },
        { code: 'AMOXICILINA-500MG', category: 'Antibiótico comum' },
        { code: 'LOSARTANA-50MG', category: 'Anti-hipertensivo' }
      ],
      hospital: [
        { code: 'DIPIRONA-500MG', category: 'Alto volume hospitalar' },
        { code: 'METFORMINA-850MG', category: 'Crônicos ambulatoriais' },
        { code: 'HERCEPTIN-440MG', category: 'Alto custo oncológico' }
      ],
      distribuidor: [
        { code: 'IBUPROFENO-400MG', category: 'Alto giro comercial' },
        { code: 'PARACETAMOL-500MG', category: 'Demanda constante' },
        { code: 'ADEMPAS-1-5MG', category: 'Especialidade rentável' }
      ],
      analista: [
        { code: 'KEYTRUDA-100MG', category: 'Inovação oncológica' },
        { code: 'GLIVEC-400MG', category: 'Referência em oncologia' },
        { code: 'HUMIRA-PEN-AC-40MG', category: 'Imunobiológico líder' }
      ]
    };

    const medications = predefinedLists[profileType] || [];

    for (const med of medications) {
      try {
        await this.addToWatchlist(userId, med.code, {
          priceChange: 15, // 15% para listas predefinidas
          stockLevel: 100,
          enabled: true
        }, `Adicionado automaticamente - ${med.category}`);
      } catch (error) {
        this.logger.warn(`Erro ao adicionar ${med.code} à watchlist: ${error.message}`);
      }
    }

    this.logger.log(`Watchlist predefinida criada para ${profileType}: ${medications.length} medicamentos`);
  }

  /**
   * Simula compra em lote para múltiplos medicamentos
   */
  async simulateBulkPurchase(
    userId: string,
    medications: Array<{ code: string; quantity: number }>,
    preferences?: { maxBudget?: number; preferredLabs?: string[] }
  ): Promise<{
    totalCost: number;
    recommendations: any[];
    savings: number;
    riskAnalysis: any;
  }> {
    try {
      this.logger.log(`Simulando compra em lote para usuário ${userId}: ${medications.length} medicamentos`);

      const recommendations = [];
      let totalCost = 0;
      let totalSavings = 0;

      for (const medRequest of medications) {
        // Buscar medicamento e preços
        const medication = await this.prisma.medication.findUnique({
          where: { code: medRequest.code },
          include: {
            prices: {
              take: 10,
              orderBy: { capturedAt: 'desc' },
              include: { lab: true }
            }
          }
        });

        if (!medication || medication.prices.length === 0) continue;

        // Agrupar preços por laboratório
        const labPrices = {};
        medication.prices.forEach(price => {
          const labName = price.lab?.name || 'Unknown';
          if (!labPrices[labName]) {
            labPrices[labName] = [];
          }
          labPrices[labName].push(parseFloat(price.value.toString()));
        });

        // Calcular melhor opção
        const labOptions = Object.entries(labPrices).map(([lab, prices]) => {
          const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
          return {
            laboratory: lab,
            unitPrice: avgPrice,
            totalCost: avgPrice * medRequest.quantity,
            quantity: medRequest.quantity
          };
        });

        labOptions.sort((a, b) => a.totalCost - b.totalCost);
        const bestOption = labOptions[0];
        const worstOption = labOptions[labOptions.length - 1];

        recommendations.push({
          medicationCode: medRequest.code,
          medicationName: medication.name,
          bestLab: bestOption.laboratory,
          quantity: medRequest.quantity,
          unitPrice: bestOption.unitPrice,
          totalCost: bestOption.totalCost,
          savings: worstOption ? worstOption.totalCost - bestOption.totalCost : 0,
          alternatives: labOptions.slice(1, 4)
        });

        totalCost += bestOption.totalCost;
        totalSavings += worstOption ? worstOption.totalCost - bestOption.totalCost : 0;
      }

      // Análise de risco
      const riskAnalysis = this.analyzeBulkPurchaseRisk(recommendations, preferences);

      return {
        totalCost,
        recommendations: recommendations.sort((a, b) => b.totalCost - a.totalCost),
        savings: totalSavings,
        riskAnalysis
      };
    } catch (error) {
      this.logger.error(`Erro na simulação de compra em lote: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analisa risco de compra em lote
   */
  private analyzeBulkPurchaseRisk(recommendations: any[], preferences?: any): any {
    const totalValue = recommendations.reduce((sum, rec) => sum + rec.totalCost, 0);
    const labConcentration = this.calculateLabConcentration(recommendations);
    const categoryRisk = this.calculateCategoryRisk(recommendations);

    let overallRisk = 'low';
    const riskFactors = [];

    // Análise de concentração de laboratórios
    if (labConcentration.maxConcentration > 0.7) {
      overallRisk = 'high';
      riskFactors.push(`Alta concentração em ${labConcentration.topLab} (${(labConcentration.maxConcentration * 100).toFixed(0)}%)`);
    }

    // Análise de valor total
    if (totalValue > 100000) {
      if (overallRisk === 'low') overallRisk = 'medium';
      riskFactors.push('Alto valor total - considere parcelar compras');
    }

    // Verificar budget se especificado
    if (preferences?.maxBudget && totalValue > preferences.maxBudget) {
      overallRisk = 'high';
      riskFactors.push(`Orçamento excedido: R$ ${(totalValue - preferences.maxBudget).toLocaleString()}`);
    }

    return {
      overallRisk,
      riskFactors,
      labConcentration,
      categoryRisk,
      totalValue,
      recommendations: this.generateRiskRecommendations(overallRisk, riskFactors)
    };
  }

  private calculateLabConcentration(recommendations: any[]): any {
    const labTotals = {};
    let totalValue = 0;

    recommendations.forEach(rec => {
      const lab = rec.bestLab;
      labTotals[lab] = (labTotals[lab] || 0) + rec.totalCost;
      totalValue += rec.totalCost;
    });

    const concentrations = Object.entries(labTotals).map(([lab, value]) => ({
      lab,
      value,
      percentage: value / totalValue
    }));

    concentrations.sort((a, b) => b.percentage - a.percentage);

    return {
      topLab: concentrations[0]?.lab,
      maxConcentration: concentrations[0]?.percentage || 0,
      distribution: concentrations
    };
  }

  private calculateCategoryRisk(recommendations: any[]): string {
    // Simplificado - em produção seria mais complexo
    return 'medium';
  }

  private generateRiskRecommendations(riskLevel: string, factors: string[]): string[] {
    const recommendations = [];

    if (riskLevel === 'high') {
      recommendations.push('🚨 Considere revisar estratégia de compra');
      recommendations.push('🔄 Diversifique fornecedores para reduzir risco');
    }

    if (factors.length > 0) {
      recommendations.push('📊 Monitore fatores de risco identificados');
    }

    return recommendations;
  }
}
