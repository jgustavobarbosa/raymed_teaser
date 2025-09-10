// Monitor em tempo real de alertas e notificações
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function monitorAlerts() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📊 MONITOR DE ALERTAS EM TEMPO REAL');
    console.log('===================================');
    console.log('Pressione Ctrl+C para parar\n');
    
    let lastCheck = new Date();
    
    setInterval(async () => {
      try {
        // Verificar novos alertas
        const newAlerts = await prisma.alert.findMany({
          where: {
            createdAt: {
              gte: lastCheck
            }
          },
          include: {
            user: true,
            medication: true,
            price: {
              include: { lab: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        
        if (newAlerts.length > 0) {
          console.log(`\n🔔 ${newAlerts.length} NOVOS ALERTAS DETECTADOS:`);
          console.log('=' .repeat(40));
          
          newAlerts.forEach((alert, i) => {
            const price = parseFloat(alert.price.value.toString());
            const sent = alert.sentAt ? '✅ Enviado' : '⏳ Pendente';
            
            console.log(`${i + 1}. 💊 ${alert.medication.name}`);
            console.log(`   👤 Para: ${alert.user.email}`);
            console.log(`   💰 Preço: R$ ${price.toFixed(2)} (${alert.price.lab?.name || 'N/A'})`);
            console.log(`   🔔 Motivo: ${alert.reason}`);
            console.log(`   📧 Status: ${sent}`);
            console.log(`   ⏰ ${alert.createdAt.toLocaleString()}`);
            console.log('');
          });
        }
        
        // Estatísticas em tempo real
        const [totalAlerts, pendingAlerts, activeSubscriptions] = await Promise.all([
          prisma.alert.count(),
          prisma.alert.count({ where: { sentAt: null } }),
          prisma.subscription.count({ where: { isActive: true } })
        ]);
        
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] 📊 Alertas: ${totalAlerts} total | ${pendingAlerts} pendentes | ${activeSubscriptions} inscrições ativas`);
        
        lastCheck = new Date();
        
      } catch (error) {
        console.error('❌ Erro no monitor:', error.message);
      }
    }, 5000); // Verificar a cada 5 segundos
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar monitor
monitorAlerts();
