import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createTransporter, createEmailTemplate } from '../notification/email.service';

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async sendPendingAlerts() {
    const result = {
      alertsProcessed: 0,
      emailsSent: 0,
      errors: [] as string[],
    };

    try {
      // Buscar alertas pendentes (não enviados)
      const pendingAlerts = await this.prisma.alert.findMany({
        where: { sentAt: null },
        include: {
          user: true,
          medication: true,
          price: {
            include: {
              lab: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: parseInt(this.config.get('ALERT_BATCH_SIZE', '50')),
      });

      if (pendingAlerts.length === 0) {
        this.logger.log('Nenhum alerta pendente para envio');
        return result;
      }

      this.logger.log(`Processando ${pendingAlerts.length} alertas pendentes...`);

      // Agrupar alertas por usuário para envio em lote
      const alertsByUser = this.groupAlertsByUser(pendingAlerts);

      for (const [userId, userAlerts] of Object.entries(alertsByUser)) {
        try {
          await this.sendUserAlerts(userAlerts, result);
          result.emailsSent++;
        } catch (error) {
          const errorMsg = `Erro ao enviar alertas para usuário ${userId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          result.errors.push(errorMsg);
          this.logger.warn(errorMsg);
        }
      }

      this.logger.log(`✅ Notificações enviadas: ${result.emailsSent} emails`);
    } catch (error) {
      const errorMsg = `Erro geral no envio de notificações: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      result.errors.push(errorMsg);
      this.logger.error(errorMsg);
    }

    return result;
  }

  private groupAlertsByUser(alerts: any[]): Record<string, any[]> {
    return alerts.reduce((groups, alert) => {
      const userId = alert.userId;
      if (!groups[userId]) {
        groups[userId] = [];
      }
      groups[userId].push(alert);
      return groups;
    }, {} as Record<string, any[]>);
  }

  private async sendUserAlerts(userAlerts: any[], result: any) {
    const user = userAlerts[0].user;
    const alertCount = userAlerts.length;

    this.logger.log(`Enviando ${alertCount} alertas para ${user.email}`);

    // Criar transporter de email
    const transporter = createTransporter({
      host: this.config.get('SMTP_HOST'),
      port: parseInt(this.config.get('SMTP_PORT', '587')),
      secure: false,
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });

    // Gerar conteúdo do email
    const emailContent = await this.generateEmailContent(user, userAlerts);

    try {
      // Enviar email
      await transporter.sendMail({
        from: `"RayMed Alertas" <${this.config.get('SMTP_USER')}>`,
        to: user.email,
        subject: alertCount === 1 
          ? `🔔 Alerta de Preço - ${userAlerts[0].medication.name}`
          : `🔔 ${alertCount} Alertas de Preços - RayMed`,
        html: emailContent,
      });

      // Marcar alertas como enviados
      const alertIds = userAlerts.map(alert => alert.id);
      await this.prisma.alert.updateMany({
        where: { id: { in: alertIds } },
        data: { sentAt: new Date() },
      });

      result.alertsProcessed += alertCount;
      this.logger.log(`✅ Email enviado para ${user.email} (${alertCount} alertas)`);

    } catch (error) {
      this.logger.error(`Falha ao enviar email para ${user.email}:`, error);
      throw error;
    }
  }

  private async generateEmailContent(user: any, alerts: any[]): Promise<string> {
    const alertsHtml = alerts.map(alert => this.formatAlertHtml(alert)).join('');
    
    return createEmailTemplate({
      userName: user.name || 'Usuário',
      alerts: alertsHtml,
      alertCount: alerts.length,
      dashboardUrl: `${this.config.get('NEXTAUTH_URL', 'http://localhost:3000')}/alertas`,
      unsubscribeUrl: `${this.config.get('NEXTAUTH_URL', 'http://localhost:3000')}/inscricoes`,
    });
  }

  private formatAlertHtml(alert: any): string {
    const { medication, price, reason, snapshot } = alert;
    const labName = price.lab?.name || 'N/A';
    const currentPrice = snapshot.currentPrice || price.value.toNumber();

    let alertMessage = '';
    let alertIcon = '🔔';
    let alertColor = '#3B82F6';

    switch (reason) {
      case 'TARGET_PRICE':
        alertIcon = '🎯';
        alertColor = '#10B981';
        alertMessage = `Preço alvo atingido! De R$ ${snapshot.targetPrice?.toFixed(2)} para R$ ${currentPrice.toFixed(2)}`;
        break;
      
      case 'DROP_PCT':
        alertIcon = '📉';
        alertColor = '#10B981';
        const dropPct = Math.abs(snapshot.dropPercentage || 0);
        alertMessage = `Queda de ${dropPct.toFixed(1)}% no preço! Agora por R$ ${currentPrice.toFixed(2)}`;
        break;
      
      case 'SPIKE':
        alertIcon = '⚡';
        alertColor = '#F59E0B';
        const variation = snapshot.dailyVariation || 0;
        alertMessage = `Variação significativa de ${variation.toFixed(1)}% em 24h`;
        break;
      
      default:
        alertMessage = `Alteração no preço para R$ ${currentPrice.toFixed(2)}`;
    }

    return `
      <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: white;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 24px; margin-right: 8px;">${alertIcon}</span>
          <h3 style="margin: 0; color: ${alertColor}; font-size: 18px;">${medication.name}</h3>
        </div>
        <p style="margin: 8px 0; color: #374151; font-size: 14px;">
          <strong>Laboratório:</strong> ${labName}
        </p>
        <p style="margin: 8px 0; color: #374151; font-size: 16px;">
          ${alertMessage}
        </p>
        <div style="margin-top: 12px;">
          <a href="${this.config.get('NEXTAUTH_URL', 'http://localhost:3000')}/medicamentos/${medication.code}" 
             style="background: ${alertColor}; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px;">
            Ver Detalhes
          </a>
        </div>
      </div>
    `;
  }

  // Método para envio manual de alerta específico
  async sendSpecificAlert(alertId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        user: true,
        medication: true,
        price: {
          include: {
            lab: true,
          },
        },
      },
    });

    if (!alert) {
      throw new Error(`Alerta ${alertId} não encontrado`);
    }

    if (alert.sentAt) {
      throw new Error(`Alerta ${alertId} já foi enviado`);
    }

    const result = {
      alertsProcessed: 0,
      emailsSent: 0,
      errors: [] as string[],
    };

    await this.sendUserAlerts([alert], result);
    
    return result;
  }

  // Reenviar alertas falhados
  async retryFailedAlerts() {
    const result = {
      alertsProcessed: 0,
      emailsSent: 0,
      errors: [] as string[],
    };

    // Buscar alertas criados há mais de 1 hora mas não enviados
    const failedAlerts = await this.prisma.alert.findMany({
      where: {
        sentAt: null,
        createdAt: {
          lt: new Date(Date.now() - 60 * 60 * 1000), // 1 hora atrás
        },
      },
      include: {
        user: true,
        medication: true,
        price: {
          include: {
            lab: true,
          },
        },
      },
      take: 20, // Limite para retry
    });

    if (failedAlerts.length === 0) {
      this.logger.log('Nenhum alerta falhado para reenvio');
      return result;
    }

    this.logger.log(`Reenviando ${failedAlerts.length} alertas falhados...`);

    const alertsByUser = this.groupAlertsByUser(failedAlerts);

    for (const [userId, userAlerts] of Object.entries(alertsByUser)) {
      try {
        await this.sendUserAlerts(userAlerts, result);
        result.emailsSent++;
      } catch (error) {
        const errorMsg = `Erro ao reenviar alertas para usuário ${userId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        result.errors.push(errorMsg);
        this.logger.warn(errorMsg);
      }
    }

    return result;
  }

  // Obter estatísticas de envio
  async getNotificationStatistics() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalAlerts,
      sentAlerts,
      pendingAlerts,
      sentLast24h,
      sentLast7d,
    ] = await Promise.all([
      this.prisma.alert.count(),
      this.prisma.alert.count({ where: { sentAt: { not: null } } }),
      this.prisma.alert.count({ where: { sentAt: null } }),
      this.prisma.alert.count({ 
        where: { 
          sentAt: { 
            gte: last24h,
            not: null,
          } 
        } 
      }),
      this.prisma.alert.count({ 
        where: { 
          sentAt: { 
            gte: last7d,
            not: null,
          } 
        } 
      }),
    ]);

    const deliveryRate = totalAlerts > 0 ? (sentAlerts / totalAlerts) * 100 : 0;

    return {
      totalAlerts,
      sentAlerts,
      pendingAlerts,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      sentLast24h,
      sentLast7d,
    };
  }
}
