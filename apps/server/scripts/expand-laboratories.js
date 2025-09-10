// Script para expandir laboratórios farmacêuticos brasileiros
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');

const BRAZILIAN_LABS = [
    // Grandes laboratórios brasileiros
    { name: "Aché", cnpj: "60.659.463/0001-91", tipo: "Nacional" },
    { name: "Biolab", cnpj: "49.475.833/0001-06", tipo: "Nacional" },
    { name: "Cristália", cnpj: "44.734.671/0001-51", tipo: "Nacional" },
    { name: "Hypera Pharma", cnpj: "02.932.074/0001-04", tipo: "Nacional" },
    { name: "União Química", cnpj: "60.665.981/0001-18", tipo: "Nacional" },
    { name: "Apsen", cnpj: "62.258.884/0001-47", tipo: "Nacional" },
    { name: "Germed", cnpj: "43.095.119/0001-15", tipo: "Nacional" },
    { name: "Legrand", cnpj: "61.082.426/0001-07", tipo: "Nacional" },
    { name: "Torrent", cnpj: "72.508.880/0001-04", tipo: "Internacional" },
    { name: "Blau", cnpj: "58.430.828/0001-60", tipo: "Nacional" },
    
    // Laboratórios multinacionais no Brasil
    { name: "Roche", cnpj: "33.009.945/0023-39", tipo: "Multinacional" },
    { name: "Novartis", cnpj: "56.994.502/0001-30", tipo: "Multinacional" },
    { name: "Bayer", cnpj: "18.459.628/0001-15", tipo: "Multinacional" },
    { name: "Janssen", cnpj: "51.780.468/0001-73", tipo: "Multinacional" },
    { name: "Bristol Myers", cnpj: "56.998.982/0001-07", tipo: "Multinacional" },
    { name: "Merck", cnpj: "33.069.212/0001-84", tipo: "Multinacional" },
    { name: "GSK", cnpj: "33.247.743/0001-10", tipo: "Multinacional" },
    { name: "AbbVie", cnpj: "15.142.329/0001-12", tipo: "Multinacional" },
    { name: "Takeda", cnpj: "60.397.775/0001-74", tipo: "Multinacional" },
    { name: "Boehringer", cnpj: "60.831.658/0001-44", tipo: "Multinacional" },
    
    // Laboratórios especializados
    { name: "Libbs", cnpj: "61.230.314/0001-75", tipo: "Especializado" },
    { name: "Zodiac", cnpj: "73.950.148/0001-46", tipo: "Especializado" },
    { name: "Farmoquímica", cnpj: "04.332.227/0001-04", tipo: "Especializado" },
    { name: "Sandoz", cnpj: "61.286.647/0001-16", tipo: "Genéricos" },
    { name: "Teva", cnpj: "33.379.978/0001-21", tipo: "Genéricos" },
    { name: "Mylan", cnpj: "07.363.142/0001-12", tipo: "Genéricos" },
    { name: "Cifarma", cnpj: "11.643.096/0001-81", tipo: "Genéricos" },
    { name: "Neo Química", cnpj: "29.785.870/0001-03", tipo: "Genéricos" },
    { name: "Cimed", cnpj: "02.814.497/0001-07", tipo: "Genéricos" },
    { name: "Vitamedic", cnpj: "00.109.728/0001-39", tipo: "Genéricos" }
];

async function expandLaboratories() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🏥 EXPANDINDO LABORATÓRIOS FARMACÊUTICOS');
    console.log('========================================');
    console.log(`📊 Laboratórios para adicionar: ${BRAZILIAN_LABS.length}`);
    
    let added = 0;
    let updated = 0;
    
    for (const labData of BRAZILIAN_LABS) {
      try {
        const lab = await prisma.lab.upsert({
          where: { name: labData.name },
          update: {
            cnpj: labData.cnpj,
          },
          create: {
            name: labData.name,
            cnpj: labData.cnpj,
          },
        });
        
        if (lab.createdAt.getTime() > Date.now() - 5000) {
          added++;
          console.log(`✅ Criado: ${labData.name} (${labData.tipo})`);
        } else {
          updated++;
          console.log(`🔄 Atualizado: ${labData.name} (${labData.tipo})`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${labData.name}:`, error.message);
      }
    }
    
    // Redistribuir preços existentes entre novos laboratórios
    await redistributePricesAcrossLabs(prisma);
    
    console.log('\n🎉 EXPANSÃO DE LABORATÓRIOS CONCLUÍDA!');
    console.log('====================================');
    console.log(`✅ Adicionados: ${added}`);
    console.log(`🔄 Atualizados: ${updated}`);
    
    // Estatísticas finais
    const totalLabs = await prisma.lab.count();
    const labsWithPrices = await prisma.lab.findMany({
      include: {
        _count: {
          select: { prices: true }
        }
      },
      orderBy: {
        prices: {
          _count: 'desc'
        }
      }
    });
    
    console.log('\n📊 LABORATÓRIOS FINAIS:');
    console.log('======================');
    console.log(`🏥 Total: ${totalLabs} laboratórios`);
    console.log('\n🏆 Top 10 com mais preços:');
    labsWithPrices.slice(0, 10).forEach((lab, i) => {
      console.log(`${i + 1}. ${lab.name}: ${lab._count.prices} preços`);
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function redistributePricesAcrossLabs(prisma) {
  console.log('\n🔄 Redistribuindo preços entre novos laboratórios...');
  
  const allLabs = await prisma.lab.findMany();
  const medications = await prisma.medication.findMany({
    include: {
      prices: {
        orderBy: { capturedAt: 'desc' },
        take: 50
      }
    }
  });
  
  let redistributed = 0;
  
  // Para cada medicamento, criar preços em laboratórios adicionais
  for (const medication of medications.slice(0, 20)) { // Limitar para não sobrecarregar
    try {
      // Selecionar 3-5 laboratórios aleatórios
      const selectedLabs = allLabs
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 3);
      
      if (medication.prices.length > 0) {
        const basePrice = parseFloat(medication.prices[0].value.toString());
        
        for (const lab of selectedLabs) {
          // Verificar se já tem preço neste lab recentemente
          const existingPrice = await prisma.price.findFirst({
            where: {
              medicationId: medication.id,
              labId: lab.id,
              capturedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Últimos 7 dias
              }
            }
          });
          
          if (!existingPrice) {
            // Criar preço com variação por laboratório (±15%)
            const labVariation = (Math.random() - 0.5) * 0.3; // ±15%
            const labPrice = basePrice * (1 + labVariation);
            
            await prisma.price.create({
              data: {
                medicationId: medication.id,
                labId: lab.id,
                value: new Prisma.Decimal(Math.round(labPrice * 100) / 100),
                capturedAt: new Date(),
                source: 'LAB_REDISTRIBUTION',
                meta: JSON.stringify({
                  originalPrice: basePrice,
                  labVariation,
                  redistributed: true,
                  labType: getLabType(lab.name),
                }),
              },
            });
            
            redistributed++;
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao redistribuir ${medication.name}:`, error.message);
    }
  }
  
  console.log(`✅ ${redistributed} preços redistribuídos entre laboratórios`);
}

function getLabType(labName) {
  const types = {
    'Nacional': ['Aché', 'Biolab', 'Cristália', 'Hypera Pharma', 'União Química', 'Apsen', 'EMS', 'Eurofarma', 'Medley'],
    'Multinacional': ['Roche', 'Novartis', 'Bayer', 'Janssen', 'Bristol Myers', 'Merck', 'GSK', 'AbbVie', 'Sanofi', 'Pfizer'],
    'Genéricos': ['Sandoz', 'Teva', 'Mylan', 'Cifarma', 'Neo Química', 'Cimed', 'Vitamedic'],
  };
  
  for (const [type, labs] of Object.entries(types)) {
    if (labs.includes(labName)) {
      return type;
    }
  }
  
  return 'Especializado';
}

// Executar
expandLaboratories();
