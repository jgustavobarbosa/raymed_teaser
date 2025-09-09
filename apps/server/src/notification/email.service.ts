import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export function createTransporter(config: EmailConfig) {
  return nodemailer.createTransport(config);
}

export function createEmailTemplate(data: {
  userName: string;
  alerts: string;
  alertCount: number;
  dashboardUrl: string;
  unsubscribeUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RayMed - Alertas de Preços</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #495057;
        }
        .summary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 30px;
        }
        .summary h2 {
            margin: 0 0 10px 0;
            font-size: 20px;
        }
        .alerts-section {
            margin-bottom: 30px;
        }
        .alert-item {
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            background: #fff;
        }
        .cta-section {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .btn {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 10px;
        }
        .btn:hover {
            background: #5a67d8;
        }
        .btn-secondary {
            background: #6c757d;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #6c757d;
            font-size: 14px;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .container {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">💊 RayMed</div>
            <div style="color: #6c757d;">Sistema de Alertas de Preços de Medicamentos</div>
        </div>

        <div class="greeting">
            Olá, ${data.userName}!
        </div>

        <div class="summary">
            <h2>🔔 ${data.alertCount === 1 ? 'Novo Alerta' : `${data.alertCount} Novos Alertas`}</h2>
            <p>Detectamos mudanças importantes nos preços dos seus medicamentos monitorados</p>
        </div>

        <div class="alerts-section">
            ${data.alerts}
        </div>

        <div class="cta-section">
            <h3>Acompanhe suas economias</h3>
            <p>Acesse seu painel para ver mais detalhes e configurar novos alertas</p>
            
            <a href="${data.dashboardUrl}" class="btn">
                📊 Ver Dashboard
            </a>
            
            <a href="${data.unsubscribeUrl}" class="btn btn-secondary">
                ⚙️ Gerenciar Alertas
            </a>
        </div>

        <div class="footer">
            <p>
                <strong>RayMed</strong> - Nunca mais perca uma oportunidade de economia<br>
                Este email foi enviado porque você tem alertas ativos configurados.
            </p>
            <p>
                <a href="${data.unsubscribeUrl}">Gerenciar preferências</a> | 
                <a href="mailto:suporte@raymed.com">Suporte</a>
            </p>
            <p style="font-size: 12px; color: #adb5bd;">
                © ${new Date().getFullYear()} RayMed. Todos os direitos reservados.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

@Injectable()
export class EmailService {
  // Serviço placeholder - lógica principal está nas funções exportadas
}
