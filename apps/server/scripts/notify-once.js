// Script para enviar notificações pendentes uma vez
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

async function sendNotifications() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📧 Enviando notificações pendentes...');
    
    // Buscar alertas não enviados
    const pendingAlerts = await prisma.alert.findMany({
      where: { sentAt: null },
      include: {
        user: true,
        medication: true,
        price: {
          include: { lab: true }
        },
      },
      take: 10, // Limite para teste
    });

    if (pendingAlerts.length === 0) {
      console.log('📭 Nenhum alerta pendente para envio');
      return;
    }

    console.log(`📮 Processando ${pendingAlerts.length} alertas pendentes...`);

    // Criar transporter Ethereal para desenvolvimento
    let transporter;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔧 Criando conta Ethereal para teste...');
      const testAccount = await nodemailer.createTestAccount();
      
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      
      console.log('📧 Conta Ethereal criada:', testAccount.user);
    } else {
      // Usar SMTP real em produção
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'janioguga@gmail.com',
          pass: process.env.SMTP_PASS,
        },
      });
    }

    // Agrupar alertas por usuário
    const alertsByUser = {};
    for (const alert of pendingAlerts) {
      const userId = alert.userId;
      if (!alertsByUser[userId]) {
        alertsByUser[userId] = [];
      }
      alertsByUser[userId].push(alert);
    }

    let emailsSent = 0;

    for (const [userId, userAlerts] of Object.entries(alertsByUser)) {
      const user = userAlerts[0].user;
      
      // Gerar HTML do email
      const alertsHtml = userAlerts.map(alert => {
        const snapshot = JSON.parse(alert.snapshot || '{}');
        return `
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="color: #10b981; margin: 0 0 8px 0;">🎯 ${alert.medication.name}</h3>
            <p><strong>Laboratório:</strong> ${alert.price.lab?.name || 'N/A'}</p>
            <p><strong>Preço atual:</strong> R$ ${snapshot.currentPrice?.toFixed(2) || 'N/A'}</p>
            <p><strong>Motivo:</strong> ${alert.reason === 'TARGET_PRICE' ? 'Preço alvo atingido' : 'Alerta de preço'}</p>
          </div>
        `;
      }).join('');

      const emailHtml = `
        <h2>🔔 RayMed - Alertas de Preços</h2>
        <p>Olá, ${user.name || user.email}!</p>
        <p>Detectamos ${userAlerts.length} novo(s) alerta(s) para seus medicamentos:</p>
        ${alertsHtml}
        <p>Acesse <a href="http://localhost:3000">RayMed</a> para mais detalhes.</p>
      `;

      try {
        const info = await transporter.sendMail({
          from: '"RayMed Alertas" <noreply@raymed.com>',
          to: user.email,
          subject: `🔔 ${userAlerts.length} Novo(s) Alerta(s) de Preços - RayMed`,
          html: emailHtml,
        });

        // Marcar alertas como enviados
        const alertIds = userAlerts.map(alert => alert.id);
        await prisma.alert.updateMany({
          where: { id: { in: alertIds } },
          data: { sentAt: new Date() },
        });

        emailsSent++;
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('📧 Email enviado! Preview URL:', nodemailer.getTestMessageUrl(info));
        } else {
          console.log(`📧 Email enviado para ${user.email}`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao enviar email para ${user.email}:`, error.message);
      }
    }

    console.log(`✅ Notificações enviadas: ${emailsSent} emails`);
    
  } catch (error) {
    console.error('❌ Erro no envio de notificações:', error);
  } finally {
    await prisma.$disconnect();
  }
}

sendNotifications();
