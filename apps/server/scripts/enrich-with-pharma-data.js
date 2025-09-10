// Script para enriquecer medicamentos com dados farmacológicos conhecidos
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');

// Base de dados farmacológicos abrangente
const PHARMA_DATABASE = {
  // Oncológicos de alto custo
  'bevacizumabe': {
    indicacoes: 'Câncer colorretal metastático, câncer de pulmão não pequenas células, câncer de mama, carcinoma renal',
    grupoDoenca: 'Oncologia',
    mecanismo: 'Inibidor de VEGF',
    faixaPreco: { min: 2000, max: 8000 },
    administracao: 'Intravenosa',
    especialidade: 'Alto custo'
  },
  'trastuzumabe': {
    indicacoes: 'Câncer de mama HER2 positivo, câncer gástrico HER2 positivo',
    grupoDoenca: 'Oncologia',
    mecanismo: 'Anticorpo monoclonal anti-HER2',
    faixaPreco: { min: 1500, max: 6000 },
    administracao: 'Intravenosa/Subcutânea',
    especialidade: 'Alto custo'
  },
  'rituximabe': {
    indicacoes: 'Linfoma não-Hodgkin, leucemia linfocítica crônica, artrite reumatoide',
    grupoDoenca: 'Oncologia/Imunologia',
    mecanismo: 'Anticorpo monoclonal anti-CD20',
    faixaPreco: { min: 800, max: 3000 },
    administracao: 'Intravenosa',
    especialidade: 'Alto custo'
  },
  'adalimumabe': {
    indicacoes: 'Artrite reumatoide, doença de Crohn, psoríase, espondilite anquilosante',
    grupoDoenca: 'Imunologia',
    mecanismo: 'Inibidor de TNF-alfa',
    faixaPreco: { min: 1200, max: 4000 },
    administracao: 'Subcutânea',
    especialidade: 'Imunobiológico'
  },
  'imatinibe': {
    indicacoes: 'Leucemia mieloide crônica, tumor estromal gastrointestinal (GIST)',
    grupoDoenca: 'Oncologia',
    mecanismo: 'Inibidor de tirosina quinase',
    faixaPreco: { min: 300, max: 1500 },
    administracao: 'Oral',
    especialidade: 'Oncológico oral'
  },
  'enzalutamida': {
    indicacoes: 'Câncer de próstata resistente à castração',
    grupoDoenca: 'Oncologia',
    mecanismo: 'Antagonista do receptor de andrógeno',
    faixaPreco: { min: 2000, max: 7000 },
    administracao: 'Oral',
    especialidade: 'Hormônio antineoplásico'
  },
  // Medicamentos básicos
  'paracetamol': {
    indicacoes: 'Dor leve a moderada, febre',
    grupoDoenca: 'Analgesia',
    mecanismo: 'Inibição da COX central',
    faixaPreco: { min: 3, max: 25 },
    administracao: 'Oral',
    especialidade: 'Medicamento básico'
  },
  'dipirona': {
    indicacoes: 'Dor, febre, cólicas',
    grupoDoenca: 'Analgesia',
    mecanismo: 'Inibição não seletiva da COX',
    faixaPreco: { min: 4, max: 30 },
    administracao: 'Oral/Intravenosa',
    especialidade: 'Medicamento básico'
  },
  'ibuprofeno': {
    indicacoes: 'Dor, inflamação, febre',
    grupoDoenca: 'Anti-inflamatório',
    mecanismo: 'Inibição da COX-1 e COX-2',
    faixaPreco: { min: 6, max: 40 },
    administracao: 'Oral',
    especialidade: 'AINE'
  },
  'losartana': {
    indicacoes: 'Hipertensão arterial, nefropatia diabética',
    grupoDoenca: 'Cardiovascular',
    mecanismo: 'Antagonista do receptor AT1 da angiotensina II',
    faixaPreco: { min: 8, max: 50 },
    administracao: 'Oral',
    especialidade: 'Anti-hipertensivo'
  },
  'amoxicilina': {
    indicacoes: 'Infecções bacterianas susceptíveis',
    grupoDoenca: 'Infectologia',
    mecanismo: 'Inibição da síntese da parede celular bacteriana',
    faixaPreco: { min: 10, max: 80 },
    administracao: 'Oral',
    especialidade: 'Antibiótico'
  }
};

async function enrichWithPharmaData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧬 ENRIQUECENDO COM DADOS FARMACOLÓGICOS');
    console.log('========================================');
    
    const medications = await prisma.medication.findMany();
    
    let enhanced = 0;
    let pricesEnhanced = 0;
    
    for (const medication of medications) {
      try {
        console.log(`\n🔍 Analisando: ${medication.name}`);
        
        // Buscar dados farmacológicos
        const pharmaData = findPharmaData(medication.activeIngredient, medication.name);
        
        if (pharmaData) {
          // Atualizar categoria com informações enriquecidas
          const enhancedCategory = `${medication.category} | ${pharmaData.grupoDoenca}`;
          
          await prisma.medication.update({
            where: { id: medication.id },
            data: {
              category: enhancedCategory
            }
          });
          
          // Ajustar preços existentes baseado na faixa farmacológica
          const currentPrices = await prisma.price.findMany({
            where: { medicationId: medication.id },
            take: 5,
            orderBy: { capturedAt: 'desc' }
          });
          
          if (currentPrices.length > 0) {
            // Criar preços mais realistas baseados na faixa farmacológica
            await createRealisticPrices(prisma, medication.id, pharmaData);
            pricesEnhanced++;
          }
          
          enhanced++;
          console.log(`✅ Enriquecido: ${medication.name}`);
          console.log(`   📋 Indicações: ${pharmaData.indicacoes}`);
          console.log(`   💰 Faixa: R$ ${pharmaData.faixaPreco.min} - R$ ${pharmaData.faixaPreco.max}`);
          console.log(`   🎯 Mecanismo: ${pharmaData.mecanismo}`);
        } else {
          console.log(`⚠️ Sem dados farmacológicos para: ${medication.name}`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao enriquecer ${medication.name}:`, error.message);
      }
    }
    
    console.log('\n🎉 ENRIQUECIMENTO FARMACOLÓGICO CONCLUÍDO!');
    console.log('==========================================');
    console.log(`✅ Medicamentos enriquecidos: ${enhanced}`);
    console.log(`💰 Preços ajustados: ${pricesEnhanced}`);
    
    // Estatísticas finais
    const stats = await getEnhancedStats(prisma);
    console.log('\n📊 ESTATÍSTICAS ENRIQUECIDAS:');
    console.log('=============================');
    console.log(`💊 Total medicamentos: ${stats.totalMedications}`);
    console.log(`🏥 Laboratórios: ${stats.totalLabs}`);
    console.log(`💰 Preços: ${stats.totalPrices}`);
    console.log(`📋 Categorias: ${stats.categories.length}`);
    console.log(`🎯 Especialidades: ${stats.specialties.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Buscar dados farmacológicos por princípio ativo
function findPharmaData(activeIngredient, medicationName) {
  if (!activeIngredient) return null;
  
  const ingredient = activeIngredient.toLowerCase();
  
  // Busca exata
  for (const [key, data] of Object.entries(PHARMA_DATABASE)) {
    if (ingredient.includes(key)) {
      return data;
    }
  }
  
  // Busca por padrões
  if (ingredient.includes('mabe')) {
    return {
      indicacoes: 'Conforme especialidade médica',
      grupoDoenca: 'Imunobiológico',
      mecanismo: 'Anticorpo monoclonal',
      faixaPreco: { min: 800, max: 5000 },
      administracao: 'Intravenosa/Subcutânea',
      especialidade: 'Imunobiológico'
    };
  }
  
  if (ingredient.includes('tinibe') || ingredient.includes('nibe')) {
    return {
      indicacoes: 'Neoplasias conforme protocolo',
      grupoDoenca: 'Oncologia',
      mecanismo: 'Inibidor de tirosina quinase',
      faixaPreco: { min: 500, max: 3000 },
      administracao: 'Oral',
      especialidade: 'Oncológico oral'
    };
  }
  
  if (ingredient.includes('cilina')) {
    return {
      indicacoes: 'Infecções bacterianas susceptíveis',
      grupoDoenca: 'Infectologia', 
      mecanismo: 'Inibição da síntese da parede celular',
      faixaPreco: { min: 15, max: 120 },
      administracao: 'Oral/Intravenosa',
      especialidade: 'Antibiótico'
    };
  }
  
  return null;
}

// Criar preços mais realistas baseados em dados farmacológicos
async function createRealisticPrices(prisma, medicationId, pharmaData) {
  const labs = await prisma.lab.findMany();
  
  // Criar 10 preços recentes mais realistas
  const prices = [];
  const { min, max } = pharmaData.faixaPreco;
  const basePrice = Math.random() * (max - min) + min;
  
  for (let i = 10; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const lab = labs[Math.floor(Math.random() * labs.length)];
    
    // Variação menor para medicamentos de alto custo (mais estáveis)
    const variationRange = pharmaData.especialidade === 'Alto custo' ? 0.1 : 0.3;
    const variation = (Math.random() - 0.5) * variationRange;
    const price = basePrice * (1 + variation);
    
    prices.push({
      medicationId,
      labId: lab?.id,
      value: new Prisma.Decimal(Math.round(price * 100) / 100),
      capturedAt: date,
      source: 'PHARMA_ENHANCED',
      meta: JSON.stringify({
        basePrice,
        variation,
        pharmaCategory: pharmaData.grupoDoenca,
        mechanism: pharmaData.mecanismo,
        administration: pharmaData.administracao,
        specialty: pharmaData.especialidade,
        enhanced: true,
      }),
    });
  }
  
  // Inserir novos preços
  await prisma.price.createMany({
    data: prices,
  });
  
  return prices.length;
}

// Obter estatísticas enriquecidas
async function getEnhancedStats(prisma) {
  const [medications, labs, prices, categories] = await Promise.all([
    prisma.medication.count(),
    prisma.lab.count(), 
    prisma.price.count(),
    prisma.medication.findMany({
      select: { category: true },
      distinct: ['category'],
    })
  ]);
  
  const specialties = [...new Set(
    categories
      .map(c => c.category?.split(' | ')[1])
      .filter(Boolean)
  )];
  
  return {
    totalMedications: medications,
    totalLabs: labs,
    totalPrices: prices,
    categories,
    specialties,
  };
}

// Executar enriquecimento
enrichWithPharmaData();
