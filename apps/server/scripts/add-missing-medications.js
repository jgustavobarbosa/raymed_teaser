// Script para adicionar medicamentos importantes que estavam faltando
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');

const MISSING_MEDICATIONS = [
    ["MabThera 100mg", "Rituximabe"],
    ["MabThera 500mg", "Rituximabe"],
    ["Riximyo 10mg/mL", "Rituximabe"],
    ["Ruxience 10mg/mL", "Rituximabe"],
    ["Truxima 10mg/mL", "Rituximabe"],
    ["Herceptin 440mg", "Trastuzumabe"],
    ["Herceptin SC 600mg", "Trastuzumabe"],
    ["Herzuma 440mg", "Trastuzumabe"],
    ["Kanjinti 150mg", "Trastuzumabe"],
    ["Trazimera 150mg", "Trastuzumabe"],
    ["Trazimera 440mg", "Trastuzumabe"],
    ["Zedora 150mg", "Trastuzumabe"],
    ["Zedora 440mg", "Trastuzumabe"],
    ["Humira Pen AC 40mg/0,4mL", "Adalimumabe"],
    ["Humira Seringa AC 40mg/0,4mL", "Adalimumabe"],
    ["Hyrimoz 40mg", "Adalimumabe"],
    ["Idacio 50mg/mL", "Adalimumabe"],
    ["Remicade 10mg/mL", "Infliximabe"],
    ["Remsima 10mg/mL", "Infliximabe"],
    ["Glivec 400mg", "Mesilato de Imatinibe"],
    ["Glivec 100mg", "Mesilato de Imatinibe"],
    ["Imatinibe 100mg", "Mesilato de Imatinibe"],
    ["Velcade 3,5mg", "Bortezomibe"],
    ["Keytruda 100mg", "Pembrolizumabe"],
    ["Opdivo 100mg", "Nivolumabe"],
    ["Opdivo 40mg", "Nivolumabe"],
    ["Tecentriq 1200mg/20mL", "Atezolizumabe"],
    ["Yervoy 200mg", "Ipilimumabe"],
    ["Yervoy 50mg", "Ipilimumabe"],
    ["Capecitabina 500mg", "Capecitabina"],
    ["Capecitabina 150mg", "Capecitabina"],
    ["Xeloda 500mg", "Capecitabina"],
    ["Taxotere 20mg", "Docetaxel"],
    ["Taxotere 80mg", "Docetaxel"],
    ["Eloxatin 50mg", "Oxaliplatina"],
    ["Eloxatin 100mg", "Oxaliplatina"],
    ["Afinitor 10mg", "Everolimo"],
    ["Afinitor 5mg", "Everolimo"],
    ["Certican 0,5mg", "Everolimo"],
    ["Certican 1mg", "Everolimo"],
    ["Rapamune 2mg", "Sirolimo"],
    ["Rapamune 1mg", "Sirolimo"]
];

async function addMissingMedications() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 ADICIONANDO MEDICAMENTOS IMPORTANTES FALTANTES');
    console.log('================================================');
    console.log(`📊 Medicamentos para adicionar: ${MISSING_MEDICATIONS.length}`);
    
    let added = 0;
    let updated = 0;
    let errors = 0;
    
    for (const [nome, principioAtivo] of MISSING_MEDICATIONS) {
      try {
        console.log(`\n🔍 Processando: ${nome}`);
        
        const code = nome.toUpperCase()
          .replace(/[^A-Z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        // Categorizar medicamento
        const category = categorizeMedication(principioAtivo, nome);
        
        // Upsert medicamento
        const medication = await prisma.medication.upsert({
          where: { code },
          update: {
            name: nome,
            activeIngredient: principioAtivo,
            category,
          },
          create: {
            code,
            name: nome,
            activeIngredient: principioAtivo,
            category,
          },
        });
        
        // Verificar se foi criado ou atualizado
        if (medication.createdAt.getTime() > Date.now() - 5000) {
          added++;
          console.log(`✅ Criado: ${nome}`);
          
          // Gerar preços realistas para medicamento novo
          await generatePricesForNewMedication(prisma, medication.id, category, principioAtivo);
          console.log(`   💰 Preços históricos gerados`);
        } else {
          updated++;
          console.log(`🔄 Atualizado: ${nome}`);
        }
        
      } catch (error) {
        errors++;
        console.error(`❌ Erro ao processar ${nome}:`, error.message);
      }
    }
    
    console.log('\n🎉 ADIÇÃO DE MEDICAMENTOS CONCLUÍDA!');
    console.log('===================================');
    console.log(`✅ Adicionados: ${added}`);
    console.log(`🔄 Atualizados: ${updated}`);
    console.log(`❌ Erros: ${errors}`);
    
    // Verificar total final
    const totalMedications = await prisma.medication.count();
    const totalPrices = await prisma.price.count();
    
    console.log('\n📊 BANCO ATUALIZADO:');
    console.log('===================');
    console.log(`💊 Total medicamentos: ${totalMedications}`);
    console.log(`💰 Total preços: ${totalPrices}`);
    
    // Verificar se Rituximabe foi adicionado
    const rituximabCheck = await prisma.medication.findMany({
      where: {
        OR: [
          { activeIngredient: { contains: 'Rituximab' } },
          { name: { contains: 'MabThera' } },
          { name: { contains: 'Riximyo' } }
        ]
      },
      select: { name: true, activeIngredient: true, code: true }
    });
    
    console.log('\n🔍 VERIFICAÇÃO RITUXIMABE:');
    console.log('=========================');
    if (rituximabCheck.length > 0) {
      console.log('✅ Rituximabe encontrado:');
      rituximabCheck.forEach(med => {
        console.log(`  - ${med.name} (${med.code})`);
      });
    } else {
      console.log('❌ Rituximabe ainda não encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function categorizeMedication(principioAtivo, nome) {
  const categoryMap = {
    'Rituximabe': 'Oncológico | Imunobiológico',
    'Trastuzumabe': 'Oncológico | Imunobiológico', 
    'Adalimumabe': 'Imunobiológico | Autoimune',
    'Infliximabe': 'Imunobiológico | Autoimune',
    'Pembrolizumabe': 'Oncológico | Imunoterapia',
    'Nivolumabe': 'Oncológico | Imunoterapia',
    'Atezolizumabe': 'Oncológico | Imunoterapia',
    'Ipilimumabe': 'Oncológico | Imunoterapia',
    'Capecitabina': 'Oncológico | Quimioterápico',
    'Docetaxel': 'Oncológico | Quimioterápico',
    'Oxaliplatina': 'Oncológico | Quimioterápico',
    'Everolimo': 'Oncológico | Imunossupressor',
    'Sirolimo': 'Imunossupressor | Transplante',
    'Mesilato de Imatinibe': 'Oncológico | Inibidor TK',
    'Bortezomibe': 'Oncológico | Inibidor Proteasoma',
  };
  
  return categoryMap[principioAtivo] || 'Especialidade Farmacêutica | Outros';
}

async function generatePricesForNewMedication(prisma, medicationId, category, principioAtivo) {
  const labs = await prisma.lab.findMany();
  
  // Definir faixa de preço baseada no princípio ativo
  let priceRange = { min: 50, max: 300 };
  
  if (principioAtivo.includes('Rituximab') || principioAtivo.includes('Trastuzumab')) {
    priceRange = { min: 1000, max: 4000 };
  } else if (principioAtivo.includes('Adalimumab') || principioAtivo.includes('Infliximab')) {
    priceRange = { min: 1200, max: 3500 };
  } else if (principioAtivo.includes('Pembrolizumab') || principioAtivo.includes('Nivolumab')) {
    priceRange = { min: 2000, max: 6000 };
  } else if (principioAtivo.includes('Imatinib') || principioAtivo.includes('Bortezomib')) {
    priceRange = { min: 800, max: 2500 };
  }
  
  const basePrice = Math.random() * (priceRange.max - priceRange.min) + priceRange.min;
  const prices = [];
  
  // Gerar 20 preços dos últimos 3 meses
  for (let i = 90; i >= 0; i -= 4) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const lab = labs[Math.floor(Math.random() * labs.length)];
    const variation = (Math.random() - 0.5) * 0.2; // ±10%
    const price = basePrice * (1 + variation);
    
    prices.push({
      medicationId,
      labId: lab?.id,
      value: new Prisma.Decimal(Math.round(price * 100) / 100),
      capturedAt: date,
      source: 'ADDED_IMPORTANT_MED',
      meta: JSON.stringify({
        basePrice,
        variation,
        principioAtivo,
        important: true,
        realistic: true,
      }),
    });
  }
  
  await prisma.price.createMany({
    data: prices,
  });
  
  return prices.length;
}

// Executar
addMissingMedications();
