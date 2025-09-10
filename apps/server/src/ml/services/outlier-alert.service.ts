import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { OutlierDetector, OutlierResult } from '../utils/outlier-detector';
import { EmailService } from '../../notification/email.service';

export interface OutlierAlert {
  id: string;
  outlierResult: OutlierResult;
  alertLevel: 'low' | 'medium' | 'high' | 'critical';
  notificationsSent: number;
  lastNotificationAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface OutlierNotificationConfig {
  enabled: boolean;
  outlierThreshold: number;
  alertThresholds: {
    low: number;      // Score 1.5-2.0
    medium: number;   // Score 2.0-3.0
    high: number;     // Score 3.0-4.0
    critical: number; // Score 4.0+
  };
  notificationLimits: {
    maxPerHour: number;
    maxPerDay: number;
    cooldownMinutes: number;
  };
  recipients: {
    admins: string[];
    pharmacists: string[];
    analysts: string[];
  };
}

@Injectable()
export class OutlierAlertService {
  private readonly logger = new Logger(OutlierAlertService.name);
  private activeAlerts = new Map<string, OutlierAlert>();
  
  private config: OutlierNotificationConfig = {
    enabled: true,
    outlierThreshold: 2.5,
    alertThresholds: {
      low: 1.5,
      medium: 2.0,
      high: 3.0,
      critical: 4.0,
    },
    notificationLimits: {
      maxPerHour: 10,
      maxPerDay: 50,
      cooldownMinutes: 30,
    },
    recipients: {
      admins: ['admin@raymed.com'],
      pharmacists: ['farmaceutico@raymed.com'],
      analysts: ['analista@raymed.com'],
    },
  };

  constructor(
    private prisma: PrismaService,
    private outlierDetector: OutlierDetector,
    private emailService: EmailService,
  ) {}

  /**
   * Job automático para detectar e alertar sobre outliers
   * Executa a cada 15 minutos
   */
  @Cron(CronExpression.EVERY_15_MINUTES)
  async monitorOutliers() {
    if (!this.config.enabled) {
      return;
    }

    try {
      this.logger.log('Iniciando monitoramento de outliers automático');

      // Buscar preços das últimas 2 horas
      const recentPrices = await this.getRecentPrices(2);
      
      if (recentPrices.length === 0) {
        this.logger.log('Nenhum preço recente encontrado');
        return;
      }

      // Detectar outliers
      const outliers = await this.outlierDetector.detectOutliers(
        recentPrices,
        this.config.outlierThreshold
      );

      this.logger.log(`Detectados ${outliers.length} outliers de ${recentPrices.length} preços`);

      // Processar cada outlier
      for (const outlier of outliers) {
        await this.processOutlier(outlier);
      }

      // Limpar alertas antigos
      await this.cleanupOldAlerts();

    } catch (error) {
      this.logger.error(`Erro no monitoramento de outliers: ${error.message}`);
    }
  }

  /**
   * Processa um outlier detectado
   */
  private async processOutlier(outlier: OutlierResult) {
    try {
      const alertLevel = this.determineAlertLevel(outlier.outlierScore);
      const alertKey = `${outlier.priceId}_${outlier.medication}_${outlier.laboratory}`;

      // Verificar se já existe alerta ativo
      const existingAlert = this.activeAlerts.get(alertKey);
      
      if (existingAlert) {
        // Verificar cooldown
        const timeSinceLastNotification = existingAlert.lastNotificationAt
          ? Date.now() - existingAlert.lastNotificationAt.getTime()
          : Infinity;
        
        const cooldownMs = this.config.notificationLimits.cooldownMinutes * 60 * 1000;
        
        if (timeSinceLastNotification < cooldownMs) {
          this.logger.debug(`Alerta em cooldown: ${alertKey}`);
          return;
        }
      }

      // Verificar limites de notificação
      if (await this.isNotificationLimitReached()) {
        this.logger.warn('Limite de notificações atingido');
        return;
      }

      // Criar/atualizar alerta
      const alert: OutlierAlert = {
        id: alertKey,
        outlierResult: outlier,
        alertLevel,
        notificationsSent: existingAlert ? existingAlert.notificationsSent + 1 : 1,
        lastNotificationAt: new Date(),
        isActive: true,
        createdAt: existingAlert ? existingAlert.createdAt : new Date(),
      };

      this.activeAlerts.set(alertKey, alert);

      // Enviar notificações
      await this.sendOutlierNotifications(alert);

      // Salvar no banco de dados
      await this.saveOutlierAlert(alert);

    } catch (error) {
      this.logger.error(`Erro ao processar outlier: ${error.message}`);
    }
  }

  /**
   * Determina o nível de alerta baseado no score
   */
  private determineAlertLevel(outlierScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (outlierScore >= this.config.alertThresholds.critical) return 'critical';
    if (outlierScore >= this.config.alertThresholds.high) return 'high';
    if (outlierScore >= this.config.alertThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Envia notificações baseadas no nível de alerta
   */
  private async sendOutlierNotifications(alert: OutlierAlert) {
    try {
      const recipients = this.getRecipientsForLevel(alert.alertLevel);
      const emailTemplate = this.generateOutlierEmailTemplate(alert);

      for (const recipient of recipients) {
        await this.emailService.sendEmail({
          to: recipient,
          subject: `🚨 RayMed: Outlier ${alert.alertLevel.toUpperCase()} detectado`,
          html: emailTemplate,
        });
      }

      this.logger.log(`Notificações enviadas para ${recipients.length} destinatários (nível: ${alert.alertLevel})`);
    } catch (error) {
      this.logger.error(`Erro ao enviar notificações: ${error.message}`);
    }
  }

  /**
   * Determina destinatários baseado no nível de alerta
   */
  private getRecipientsForLevel(level: string): string[] {
    switch (level) {
      case 'critical':
        return [
          ...this.config.recipients.admins,
          ...this.config.recipients.pharmacists,
          ...this.config.recipients.analysts,
        ];
      case 'high':
        return [
          ...this.config.recipients.admins,
          ...this.config.recipients.pharmacists,
        ];
      case 'medium':
        return this.config.recipients.pharmacists;
      case 'low':
        return this.config.recipients.analysts;
      default:
        return this.config.recipients.analysts;
    }
  }

  /**
   * Gera template de email para outlier
   */
  private generateOutlierEmailTemplate(alert: OutlierAlert): string {
    const { outlierResult, alertLevel } = alert;
    
    const levelEmojis = {
      low: '⚠️',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    };

    const levelColors = {
      low: '#fbbf24',
      medium: '#f59e0b',
      high: '#ea580c',
      critical: '#dc2626',
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>RayMed - Outlier Detectado</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">${levelEmojis[alertLevel]} RayMed - Outlier Detectado</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Nível: ${alertLevel.toUpperCase()}</p>
            </div>
            
            <!-- Alert Details -->
            <div style="background: #f8fafc; border-left: 4px solid ${levelColors[alertLevel]}; padding: 20px; margin: 20px 0;">
                <h2 style="margin-top: 0; color: ${levelColors[alertLevel]};">Detalhes do Outlier</h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">💊 Medicamento:</td>
                        <td style="padding: 8px 0;">${outlierResult.medication}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">🏥 Laboratório:</td>
                        <td style="padding: 8px 0;">${outlierResult.laboratory}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">💰 Preço Detectado:</td>
                        <td style="padding: 8px 0; color: ${levelColors[alertLevel]}; font-weight: bold;">
                            R$ ${outlierResult.price.toFixed(2)}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">📊 Preço Esperado:</td>
                        <td style="padding: 8px 0;">R$ ${outlierResult.expectedPrice.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">📈 Score de Outlier:</td>
                        <td style="padding: 8px 0; font-weight: bold;">${outlierResult.outlierScore.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">📏 Desvio:</td>
                        <td style="padding: 8px 0;">R$ ${outlierResult.deviation.toFixed(2)}</td>
                    </tr>
                </table>
            </div>
            
            <!-- Reasons -->
            <div style="margin: 20px 0;">
                <h3 style="color: #374151;">🔍 Razões da Detecção:</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    ${outlierResult.reasons.map(reason => `<li style="margin: 5px 0;">${reason}</li>`).join('')}
                </ul>
            </div>
            
            <!-- Detection Methods -->
            <div style="margin: 20px 0;">
                <h3 style="color: #374151;">🛠️ Métodos de Detecção:</h3>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${outlierResult.detectionMethods.map(method => 
                        `<span style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${method}</span>`
                    ).join('')}
                </div>
            </div>
            
            <!-- Actions -->
            <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #374151;">🎯 Ações Recomendadas:</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    ${this.getRecommendedActions(alert).map(action => `<li style="margin: 5px 0;">${action}</li>`).join('')}
                </ul>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px;">
                    Este alerta foi gerado automaticamente pelo sistema RayMed ML<br>
                    Data: ${new Date().toLocaleString('pt-BR')}<br>
                    Alerta ID: ${alert.id}
                </p>
                <div style="margin-top: 15px;">
                    <a href="http://localhost:3000/#ml" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        🧠 Ver Dashboard ML
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Gera ações recomendadas baseadas no outlier
   */
  private getRecommendedActions(alert: OutlierAlert): string[] {
    const { outlierResult, alertLevel } = alert;
    const actions = [];

    // Ações baseadas no nível
    if (alertLevel === 'critical') {
      actions.push('🚨 Investigação imediata necessária');
      actions.push('📞 Contatar laboratório para verificação');
      actions.push('⏸️ Considerar suspender dados desta fonte temporariamente');
    } else if (alertLevel === 'high') {
      actions.push('🔍 Investigar nas próximas 2 horas');
      actions.push('📧 Solicitar confirmação do laboratório');
    } else if (alertLevel === 'medium') {
      actions.push('📊 Monitorar nas próximas 24 horas');
      actions.push('📝 Documentar para análise posterior');
    } else {
      actions.push('👁️ Manter em observação');
    }

    // Ações baseadas no tipo de outlier
    if (outlierResult.detectionMethods.includes('fraud_identical')) {
      actions.push('🕵️ Verificar possível manipulação de preços');
    }
    
    if (outlierResult.detectionMethods.includes('temporal')) {
      actions.push('📅 Verificar mudanças recentes no mercado');
    }

    // Ações específicas por desvio
    const deviationPercent = (outlierResult.deviation / outlierResult.expectedPrice) * 100;
    if (deviationPercent > 100) {
      actions.push('💸 Preço pode estar com erro de digitação (muito alto)');
    } else if (deviationPercent > 50) {
      actions.push('🔄 Verificar se houve mudança de apresentação/dosagem');
    }

    return actions;
  }

  /**
   * Busca preços recentes para monitoramento
   */
  private async getRecentPrices(hoursBack: number = 2) {
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    const prices = await this.prisma.price.findMany({
      where: {
        capturedAt: {
          gte: cutoffDate,
        },
      },
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
   * Verifica se o limite de notificações foi atingido
   */
  private async isNotificationLimitReached(): Promise<boolean> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Contar notificações na última hora
    const hourlyCount = Array.from(this.activeAlerts.values())
      .filter(alert => 
        alert.lastNotificationAt && 
        alert.lastNotificationAt > oneHourAgo
      ).length;

    // Contar notificações no último dia
    const dailyCount = Array.from(this.activeAlerts.values())
      .filter(alert => 
        alert.lastNotificationAt && 
        alert.lastNotificationAt > oneDayAgo
      ).length;

    return (
      hourlyCount >= this.config.notificationLimits.maxPerHour ||
      dailyCount >= this.config.notificationLimits.maxPerDay
    );
  }

  /**
   * Salva alerta de outlier no banco de dados
   */
  private async saveOutlierAlert(alert: OutlierAlert) {
    try {
      // Buscar IDs necessários
      const medication = await this.prisma.medication.findUnique({
        where: { code: alert.outlierResult.medication },
      });

      const price = await this.prisma.price.findUnique({
        where: { id: alert.outlierResult.priceId },
      });

      if (!medication || !price) {
        this.logger.warn(`Medicamento ou preço não encontrado para alerta ${alert.id}`);
        return;
      }

      // Buscar usuário admin para associar o alerta
      const adminUser = await this.prisma.user.findFirst({
        where: { role: 'admin' },
      });

      if (!adminUser) {
        this.logger.warn('Usuário admin não encontrado para salvar alerta');
        return;
      }

      // Salvar alerta no banco
      await this.prisma.alert.create({
        data: {
          userId: adminUser.id,
          medicationId: medication.id,
          priceId: price.id,
          reason: `OUTLIER_${alert.alertLevel.toUpperCase()}`,
          diffPct: (alert.outlierResult.deviation / alert.outlierResult.expectedPrice) * 100,
          snapshot: JSON.stringify({
            outlierScore: alert.outlierResult.outlierScore,
            expectedPrice: alert.outlierResult.expectedPrice,
            detectionMethods: alert.outlierResult.detectionMethods,
            reasons: alert.outlierResult.reasons,
            alertLevel: alert.alertLevel,
            notificationsSent: alert.notificationsSent,
          }),
          sentAt: alert.lastNotificationAt,
        },
      });

      this.logger.log(`Alerta salvo no banco: ${alert.id}`);
    } catch (error) {
      this.logger.error(`Erro ao salvar alerta: ${error.message}`);
    }
  }

  /**
   * Remove alertas antigos da memória
   */
  private async cleanupOldAlerts() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.createdAt < oneDayAgo) {
        this.activeAlerts.delete(key);
      }
    }
  }

  /**
   * Configura parâmetros do sistema de alertas
   */
  async updateConfig(newConfig: Partial<OutlierNotificationConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Configuração de alertas atualizada');
  }

  /**
   * Obtém estatísticas dos alertas
   */
  async getAlertStats(): Promise<{
    totalActiveAlerts: number;
    alertsByLevel: Record<string, number>;
    notificationsSentToday: number;
    lastDetection: Date | null;
  }> {
    const activeAlerts = Array.from(this.activeAlerts.values());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alertsByLevel = activeAlerts.reduce((acc, alert) => {
      acc[alert.alertLevel] = (acc[alert.alertLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const notificationsToday = activeAlerts.filter(alert =>
      alert.lastNotificationAt && alert.lastNotificationAt > today
    ).length;

    const lastDetection = activeAlerts.length > 0
      ? new Date(Math.max(...activeAlerts.map(a => a.createdAt.getTime())))
      : null;

    return {
      totalActiveAlerts: activeAlerts.length,
      alertsByLevel,
      notificationsSentToday: notificationsToday,
      lastDetection,
    };
  }

  /**
   * Força verificação manual de outliers
   */
  async runManualCheck(
    medicationCode?: string,
    laboratoryId?: string,
    threshold?: number
  ): Promise<{
    outliersFound: number;
    alertsGenerated: number;
    notificationsSent: number;
  }> {
    try {
      this.logger.log('Executando verificação manual de outliers');

      // Buscar preços das últimas 24 horas
      const recentPrices = await this.getRecentPrices(24);
      
      // Filtrar se necessário
      let filteredPrices = recentPrices;
      if (medicationCode) {
        filteredPrices = filteredPrices.filter(p => p.medication === medicationCode);
      }
      if (laboratoryId) {
        // Buscar nome do laboratório
        const lab = await this.prisma.lab.findUnique({ where: { id: laboratoryId } });
        if (lab) {
          filteredPrices = filteredPrices.filter(p => p.laboratory === lab.name);
        }
      }

      // Detectar outliers
      const outliers = await this.outlierDetector.detectOutliers(
        filteredPrices,
        threshold || this.config.outlierThreshold
      );

      let alertsGenerated = 0;
      let notificationsSent = 0;

      // Processar outliers
      for (const outlier of outliers) {
        const initialCount = this.activeAlerts.size;
        await this.processOutlier(outlier);
        
        if (this.activeAlerts.size > initialCount) {
          alertsGenerated++;
          notificationsSent += this.getRecipientsForLevel(
            this.determineAlertLevel(outlier.outlierScore)
          ).length;
        }
      }

      return {
        outliersFound: outliers.length,
        alertsGenerated,
        notificationsSent,
      };
    } catch (error) {
      this.logger.error(`Erro na verificação manual: ${error.message}`);
      throw error;
    }
  }
}
