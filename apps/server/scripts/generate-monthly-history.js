// Script para gerar histórico mensal realista de preços para todos os medicamentos
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');

async function generateMonthlyHistory() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📈 GERANDO HISTÓRICO MENSAL DE PREÇOS');
    console.log('====================================');
    
    // Buscar todos os medicamentos
    const medications = await prisma.medication.findMany({
      include: {
        prices: {
          orderBy: { capturedAt: 'desc' },
          take: 1
        }
      }
    });
    
    const labs = await prisma.lab.findMany();
    
    console.log(`📊 Processando ${medications.length} medicamentos...`);
    console.log(`🏥 Usando ${labs.length} laboratórios`);
    
    let totalPricesGenerated = 0;
    let medicationsProcessed = 0;
    
    for (const medication of medications) {
      try {
        console.log(`\n💊 ${medicationsProcessed + 1}/${medications.length}: ${medication.name}`);
        
        // Determinar preço base atual ou estimar
        let basePrice = 0;
        if (medication.prices.length > 0) {
          basePrice = parseFloat(medication.prices[0].value.toString());
        } else {
          basePrice = estimateBasePriceByCategory(medication.category);
        }
        
        console.log(`   💰 Preço base: R$ ${basePrice.toFixed(2)}`);
        
        // Gerar histórico de 12 meses
        const monthlyPrices = generateMonthlyPriceHistory(
          medication.id,
          basePrice,
          medication.category,
          labs
        );
        
        // Inserir preços em lotes
        const batchSize = 50;
        let batchCount = 0;
        
        for (let i = 0; i < monthlyPrices.length; i += batchSize) {
          const batch = monthlyPrices.slice(i, i + batchSize);
          
          await prisma.price.createMany({
            data: batch,
          });
          
          batchCount++;
          totalPricesGenerated += batch.length;
        }
        
        console.log(`   ✅ ${monthlyPrices.length} preços históricos gerados (${batchCount} lotes)`);
        medicationsProcessed++;
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${medication.name}:`, error.message);
      }
    }
    
    // Relatório final
    console.log('\n🎉 GERAÇÃO DE HISTÓRICO CONCLUÍDA!');
    console.log('=================================');
    console.log(`✅ Medicamentos processados: ${medicationsProcessed}`);
    console.log(`💰 Preços históricos gerados: ${totalPricesGenerated}`);
    console.log(`📊 Média por medicamento: ${(totalPricesGenerated / medicationsProcessed).toFixed(1)}`);
    
    // Estatísticas finais
    const finalStats = await getFinalDatabaseStats(prisma);
    console.log('\n📊 BANCO DE DADOS FINAL:');
    console.log('=======================');
    console.log(`💊 Total medicamentos: ${finalStats.medications}`);
    console.log(`🏥 Total laboratórios: ${finalStats.labs}`);
    console.log(`💰 Total preços: ${finalStats.prices}`);
    console.log(`📅 Período: ${finalStats.dateRange.start} → ${finalStats.dateRange.end}`);
    console.log(`📈 Densidade: ${finalStats.avgPricesPerMed} preços/medicamento`);
    
    // Análise por categoria
    console.log('\n📋 PREÇOS POR CATEGORIA:');
    console.log('=======================');
    for (const cat of finalStats.categoriesWithPrices) {
      console.log(`${cat.category}: ${cat.count} preços (R$ ${cat.minPrice} - R$ ${cat.maxPrice})`);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function generateMonthlyPriceHistory(medicationId, basePrice, category, labs) {
  const prices = [];
  
  // Definir tendência geral (alta, baixa, estável)
  const trends = ['up', 'down', 'stable'];
  const trend = trends[Math.floor(Math.random() * trends.length)];
  
  // Parâmetros de volatilidade por categoria
  const volatility = getVolatilityByCategory(category);
  
  console.log(`   📈 Tendência: ${trend}, Volatilidade: ${volatility.toFixed(2)}`);
  
  // Gerar preços para últimos 12 meses
  for (let month = 12; month >= 0; month--) {
    const date = new Date();
    date.setMonth(date.getMonth() - month);
    
    // 3-5 preços por mês
    const pricesThisMonth = Math.floor(Math.random() * 3) + 3;
    
    for (let day = 0; day < pricesThisMonth; day++) {
      const lab = labs[Math.floor(Math.random() * labs.length)];
      
      // Calcular preço com tendência e volatilidade
      const monthProgress = (12 - month) / 12; // 0 a 1
      
      let trendFactor = 1;
      switch (trend) {
        case 'up':
          trendFactor = 1 + (monthProgress * 0.2); // Até 20% de alta
          break;
        case 'down':
          trendFactor = 1 - (monthProgress * 0.15); // Até 15% de queda
          break;
        case 'stable':
          trendFactor = 1 + (Math.sin(monthProgress * Math.PI * 4) * 0.05); // Oscilação ±5%
          break;
      }
      
      // Variação aleatória
      const randomVariation = (Math.random() - 0.5) * volatility;
      
      const finalPrice = basePrice * trendFactor * (1 + randomVariation);
      
      // Data específica do mês
      const specificDate = new Date(date);
      specificDate.setDate(Math.floor(Math.random() * 28) + 1);
      specificDate.setHours(Math.floor(Math.random() * 24));
      
      prices.push({
        medicationId,
        labId: lab?.id,
        value: new Prisma.Decimal(Math.round(finalPrice * 100) / 100),
        capturedAt: specificDate,
        source: 'MONTHLY_HISTORY_GENERATED',
        meta: JSON.stringify({
          basePrice,
          trend,
          trendFactor,
          volatility,
          monthProgress,
          randomVariation,
          month: specificDate.getMonth() + 1,
          year: specificDate.getFullYear(),
          realistic: true,
          historical: true,
        }),
      });
    }
  }
  
  return prices;
}

function getVolatilityByCategory(category) {
  if (category?.includes('Oncolog') || category?.includes('Alto custo')) {
    return 0.1; // 10% volatilidade (mais estáveis)
  }
  if (category?.includes('Imunobiológico')) {
    return 0.15; // 15% volatilidade
  }
  if (category?.includes('Analgésico') || category?.includes('básico')) {
    return 0.3; // 30% volatilidade (mais voláteis)
  }
  
  return 0.2; // 20% volatilidade padrão
}

function estimateBasePriceByCategory(category) {
  if (category?.includes('Oncolog')) {
    return Math.random() * 5000 + 1000; // R$ 1.000 - R$ 6.000
  }
  if (category?.includes('Imunobiológico')) {
    return Math.random() * 3000 + 800; // R$ 800 - R$ 3.800
  }
  if (category?.includes('Analgésico')) {
    return Math.random() * 30 + 5; // R$ 5 - R$ 35
  }
  if (category?.includes('Antibiótico')) {
    return Math.random() * 100 + 15; // R$ 15 - R$ 115
  }
  if (category?.includes('Cardiovascular')) {
    return Math.random() * 60 + 10; // R$ 10 - R$ 70
  }
  
  return Math.random() * 200 + 20; // R$ 20 - R$ 220
}

async function getFinalDatabaseStats(prisma) {
  const [medications, labs, prices, dateRange, categoriesWithPrices] = await Promise.all([
    prisma.medication.count(),
    prisma.lab.count(),
    prisma.price.count(),
    prisma.price.aggregate({
      _min: { capturedAt: true },
      _max: { capturedAt: true },
    }),
    prisma.$queryRaw`
      SELECT 
        m.category,
        COUNT(p.id) as count,
        MIN(CAST(p.value AS REAL)) as minPrice,
        MAX(CAST(p.value AS REAL)) as maxPrice
      FROM medications m
      LEFT JOIN prices p ON m.id = p.medicationId
      WHERE m.category IS NOT NULL
      GROUP BY m.category
      ORDER BY count DESC
    `
  ]);
  
  return {
    medications,
    labs, 
    prices,
    avgPricesPerMed: (prices / medications).toFixed(1),
    dateRange: {
      start: dateRange._min.capturedAt?.toLocaleDateString() || 'N/A',
      end: dateRange._max.capturedAt?.toLocaleDateString() || 'N/A',
    },
    categoriesWithPrices: categoriesWithPrices.map(cat => ({
      category: cat.category?.split(' | ')[0] || 'Sem categoria',
      count: Number(cat.count),
      minPrice: Number(cat.minPrice || 0).toFixed(2),
      maxPrice: Number(cat.maxPrice || 0).toFixed(2),
    }))
  };
}

// Executar
generateMonthlyHistory();
