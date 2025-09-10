// Script para executar análise de alertas uma vez
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function runAnalysis() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Executando análise de alertas...');
    
    // Buscar inscrições ativas
    const subscriptions = await prisma.subscription.findMany({
      where: { isActive: true },
      include: {
        user: true,
        medication: {
          include: {
            prices: {
              orderBy: { capturedAt: 'desc' },
              take: 100,
            },
          },
        },
      },
    });

    console.log(`📊 Analisando ${subscriptions.length} inscrições ativas...`);
    
    let alertsGenerated = 0;
    
    for (const subscription of subscriptions) {
      const { medication, user } = subscription;
      
      if (medication.prices.length === 0) continue;
      
      const currentPrice = medication.prices[0];
      const currentValue = parseFloat(currentPrice.value.toString());
      
      // Verificar se já foi gerado alerta para este preço
      const existingAlert = await prisma.alert.findFirst({
        where: {
          userId: user.id,
          medicationId: medication.id,
          priceId: currentPrice.id,
        },
      });

      if (existingAlert) continue;
      
      // Verificar preço alvo
      if (subscription.targetPrice && currentValue <= parseFloat(subscription.targetPrice.toString())) {
        await prisma.alert.create({
          data: {
            userId: user.id,
            medicationId: medication.id,
            priceId: currentPrice.id,
            reason: 'TARGET_PRICE',
            snapshot: JSON.stringify({
              currentPrice: currentValue,
              targetPrice: parseFloat(subscription.targetPrice.toString()),
              labName: currentPrice.lab?.name,
              medicationName: medication.name,
            }),
          },
        });
        
        alertsGenerated++;
        console.log(`🎯 Alerta de preço alvo: ${medication.name} - R$ ${currentValue}`);
      }
    }
    
    console.log(`✅ Análise concluída: ${alertsGenerated} alertas gerados`);
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runAnalysis();
