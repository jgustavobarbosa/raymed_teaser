// Script para criar condição que gere um alerta
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');

async function createAlertCondition() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🎯 Criando condição para gerar alerta...');
    
    // Buscar um usuário e medicamento
    const user = await prisma.user.findFirst({
      where: { email: 'teste@raymed.com' }
    });
    
    const medication = await prisma.medication.findFirst({
      where: { code: 'PARACETAMOL-500MG' }
    });
    
    if (!user || !medication) {
      throw new Error('Usuário ou medicamento não encontrado');
    }
    
    console.log(`👤 Usuário: ${user.email}`);
    console.log(`💊 Medicamento: ${medication.name}`);
    
    // Buscar primeiro laboratório
    const lab = await prisma.lab.findFirst();
    
    // Criar/atualizar inscrição com preço alvo alto para garantir alerta
    const subscription = await prisma.subscription.upsert({
      where: {
        userId_medicationId_labId: {
          userId: user.id,
          medicationId: medication.id,
          labId: lab?.id || null
        }
      },
      update: {
        targetPrice: new Prisma.Decimal(50.00), // Preço alvo alto
        isActive: true,
      },
      create: {
        userId: user.id,
        medicationId: medication.id,
        labId: lab?.id || null,
        targetPrice: new Prisma.Decimal(50.00), // Preço alvo alto
        isActive: true,
      },
    });
    
    console.log(`📋 Inscrição criada/atualizada com preço alvo: R$ 50,00`);
    
    // Inserir um preço baixo que vai disparar o alerta
    const alertPrice = await prisma.price.create({
      data: {
        medicationId: medication.id,
        value: new Prisma.Decimal(25.90), // Preço baixo que vai disparar alerta
        capturedAt: new Date(),
        source: 'TEST_ALERT',
        meta: JSON.stringify({
          test: true,
          purpose: 'trigger_alert'
        }),
      },
    });
    
    console.log(`💰 Preço de teste inserido: R$ 25,90 (abaixo do alvo R$ 50,00)`);
    console.log(`✅ Condição criada! Execute 'pnpm analyze:once' para gerar o alerta.`);
    
  } catch (error) {
    console.error('❌ Erro ao criar condição:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAlertCondition();
