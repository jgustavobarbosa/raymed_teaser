// Script para criar cenários reais que disparem alertas automaticamente
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');

async function createRealAlertScenarios() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🎯 CRIANDO CENÁRIOS REAIS DE ALERTAS');
    console.log('===================================');
    
    // 1. Criar usuários de teste para receber alertas
    const testUsers = [
      { email: 'farmaceutico@raymed.com', name: 'Dr. Farmacêutico' },
      { email: 'gestor@raymed.com', name: 'Gestor Hospitalar' },
      { email: 'usuario@teste.com', name: 'Usuário Teste' }
    ];
    
    const users = [];
    for (const userData of testUsers) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: { name: userData.name },
        create: {
          email: userData.email,
          name: userData.name,
          role: 'user'
        }
      });
      users.push(user);
      console.log(`👤 Usuário criado: ${user.email}`);
    }
    
    // 2. Buscar medicamentos importantes para alertas
    const importantMeds = await prisma.medication.findMany({
      where: {
        OR: [
          { activeIngredient: { contains: 'Rituximab' } },
          { activeIngredient: { contains: 'Trastuzumab' } },
          { activeIngredient: { contains: 'Adalimumab' } },
          { activeIngredient: { contains: 'Paracetamol' } },
          { activeIngredient: { contains: 'Ibuprofeno' } },
          { name: { contains: 'MabThera' } },
          { name: { contains: 'Herceptin' } },
          { name: { contains: 'Humira' } }
        ]
      },
      include: {
        prices: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          include: { lab: true }
        }
      }
    });
    
    console.log(`\n💊 Medicamentos importantes encontrados: ${importantMeds.length}`);
    
    // 3. Criar inscrições de alerta para diferentes cenários
    let alertsConfigured = 0;
    
    for (let i = 0; i < users.length && i < importantMeds.length; i++) {
      const user = users[i];
      const medication = importantMeds[i];
      
      if (medication.prices.length > 0) {
        const currentPrice = parseFloat(medication.prices[0].value.toString());
        const lab = medication.prices[0].lab;
        
        // Configurar alerta com preço alvo acima do atual (para garantir disparo)
        const targetPrice = currentPrice * 1.1; // 10% acima do atual
        
        const subscription = await prisma.subscription.upsert({
          where: {
            userId_medicationId_labId: {
              userId: user.id,
              medicationId: medication.id,
              labId: lab?.id || null
            }
          },
          update: {
            targetPrice: new Prisma.Decimal(targetPrice),
            minDropPct: 0.05, // 5% de queda
            isActive: true
          },
          create: {
            userId: user.id,
            medicationId: medication.id,
            labId: lab?.id || null,
            targetPrice: new Prisma.Decimal(targetPrice),
            minDropPct: 0.05, // 5% de queda
            isActive: true
          }
        });
        
        console.log(`🔔 Alerta configurado: ${user.email} → ${medication.name}`);
        console.log(`   💰 Preço atual: R$ ${currentPrice.toFixed(2)} (${lab?.name || 'N/A'})`);
        console.log(`   🎯 Preço alvo: R$ ${targetPrice.toFixed(2)}`);
        
        alertsConfigured++;
      }
    }
    
    // 4. Criar preços que disparem alertas (preços baixos)
    console.log('\n💰 CRIANDO PREÇOS QUE DISPARARÃO ALERTAS...');
    let triggeredAlerts = 0;
    
    for (const medication of importantMeds.slice(0, 3)) {
      if (medication.prices.length > 0) {
        const currentPrice = parseFloat(medication.prices[0].value.toString());
        const triggerPrice = currentPrice * 0.85; // 15% abaixo do atual
        
        // Criar preço baixo que vai disparar alerta
        await prisma.price.create({
          data: {
            medicationId: medication.id,
            labId: medication.prices[0].labId,
            value: new Prisma.Decimal(triggerPrice),
            capturedAt: new Date(),
            source: 'ALERT_TRIGGER',
            meta: JSON.stringify({
              originalPrice: currentPrice,
              reductionPercent: 15,
              alertTrigger: true,
              purpose: 'demo_alert'
            })
          }
        });
        
        console.log(`🎯 Preço gatilho criado: ${medication.name}`);
        console.log(`   📉 De R$ ${currentPrice.toFixed(2)} → R$ ${triggerPrice.toFixed(2)} (-15%)`);
        
        triggeredAlerts++;
      }
    }
    
    console.log('\n🎉 CENÁRIOS DE ALERTA CRIADOS!');
    console.log('=============================');
    console.log(`👥 Usuários: ${users.length}`);
    console.log(`🔔 Alertas configurados: ${alertsConfigured}`);
    console.log(`💰 Preços gatilho: ${triggeredAlerts}`);
    
    console.log('\n📧 PRÓXIMOS PASSOS:');
    console.log('==================');
    console.log('1. Execute: pnpm analyze:once');
    console.log('2. Execute: pnpm notify:once');
    console.log('3. Verifique URLs do Ethereal nos logs');
    console.log('4. Abra as URLs para ver emails reais');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
createRealAlertScenarios();
