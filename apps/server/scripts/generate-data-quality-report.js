// Script para gerar relatório de qualidade dos dados
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function generateReport() {
  console.log('📊 Gerando relatório de qualidade dos dados...\n');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {},
    corrections: {},
    quality: {},
    recommendations: []
  };

  try {
    // 1. Estatísticas gerais
    const totalMedications = await prisma.medication.count();
    const totalLabs = await prisma.lab.count();
    const totalPrices = await prisma.price.count();

    report.summary = {
      totalMedications,
      totalLabs,
      totalPrices,
      avgPricesPerMedication: Math.round(totalPrices / totalMedications)
    };

    console.log('📈 Estatísticas Gerais:');
    console.log(`  • Medicamentos: ${totalMedications}`);
    console.log(`  • Laboratórios: ${totalLabs}`);
    console.log(`  • Preços: ${totalPrices}`);

    // 2. Análise de correções aplicadas
    const correctionsApplied = await prisma.price.count({
      where: {
        OR: [
          { source: 'DataCorrection' },
          { source: 'PriceCorrection' },
          { source: 'DataEnrichment' }
        ]
      }
    });

    report.corrections = {
      totalCorrections: correctionsApplied,
      correctionSources: await getCorrectionBreakdown()
    };

    console.log(`\n🔧 Correções Aplicadas: ${correctionsApplied}`);

    // 3. Análise de qualidade por categoria
    const qualityByCategory = await analyzeQualityByCategory();
    report.quality = qualityByCategory;

    // 4. Medicamentos de alto valor corrigidos
    const highValueMedications = await getHighValueMedicationsStatus();
    report.highValueStatus = highValueMedications;

    // 5. Laboratórios principais
    const mainLabsStatus = await getMainLabsStatus();
    report.labsStatus = mainLabsStatus;

    // 6. Recomendações
    report.recommendations = await generateRecommendations();

    // Salvar relatório
    const reportPath = 'data-quality-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Relatório salvo em: ${reportPath}`);
    
    // Exibir resumo
    displayReportSummary(report);

  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function getCorrectionBreakdown() {
  try {
    const breakdown = await prisma.price.groupBy({
      by: ['source'],
      _count: true,
      where: {
        source: {
          in: ['DataCorrection', 'PriceCorrection', 'DataEnrichment']
        }
      }
    });

    return breakdown.reduce((acc, item) => {
      acc[item.source] = item._count;
      return acc;
    }, {});
  } catch (error) {
    return {};
  }
}

async function analyzeQualityByCategory() {
  try {
    const categories = [
      'Oncológico',
      'Imunobiológico', 
      'Alto Custo',
      'SUS',
      'Cardiologia'
    ];

    const quality = {};

    for (const category of categories) {
      const medications = await prisma.medication.findMany({
        where: {
          category: { contains: category }
        },
        include: {
          prices: {
            take: 1,
            orderBy: { capturedAt: 'desc' },
            include: { lab: true }
          }
        }
      });

      const prices = medications
        .filter(m => m.prices[0])
        .map(m => parseFloat(m.prices[0].value.toString()));

      if (prices.length > 0) {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        quality[category] = {
          count: medications.length,
          avgPrice: Math.round(avgPrice * 100) / 100,
          minPrice: Math.round(minPrice * 100) / 100,
          maxPrice: Math.round(maxPrice * 100) / 100,
          priceRange: Math.round((maxPrice - minPrice) * 100) / 100
        };

        console.log(`\n📊 ${category}:`);
        console.log(`  • Medicamentos: ${medications.length}`);
        console.log(`  • Preço médio: R$ ${quality[category].avgPrice}`);
        console.log(`  • Faixa: R$ ${quality[category].minPrice} - R$ ${quality[category].maxPrice}`);
      }
    }

    return quality;
  } catch (error) {
    console.error('❌ Erro na análise por categoria:', error);
    return {};
  }
}

async function getHighValueMedicationsStatus() {
  try {
    const highValueMeds = [
      'ADEMPAS', 'GLIVEC', 'KEYTRUDA', 'OPDIVO', 'HERCEPTIN', 
      'AVASTIN', 'HUMIRA', 'IMBRUVICA', 'TECENTRIQ', 'YERVOY'
    ];

    const status = {};

    for (const medName of highValueMeds) {
      const medications = await prisma.medication.findMany({
        where: {
          OR: [
            { name: { contains: medName } },
            { code: { contains: medName } }
          ]
        },
        include: {
          prices: {
            take: 2,
            orderBy: { capturedAt: 'desc' },
            include: { lab: true }
          }
        }
      });

      if (medications.length > 0) {
        const med = medications[0];
        const currentPrice = med.prices[0];
        const previousPrice = med.prices[1];

        status[medName] = {
          found: true,
          name: med.name,
          laboratory: currentPrice?.lab?.name || 'Unknown',
          currentPrice: currentPrice ? parseFloat(currentPrice.value.toString()) : 0,
          previousPrice: previousPrice ? parseFloat(previousPrice.value.toString()) : 0,
          corrected: currentPrice?.source === 'PriceCorrection',
          category: med.category
        };
      } else {
        status[medName] = { found: false };
      }
    }

    console.log(`\n💊 Status dos Medicamentos de Alto Valor:`);
    Object.entries(status).forEach(([name, data]) => {
      if (data.found) {
        const priceChange = data.previousPrice > 0 ? 
          `(${data.corrected ? '✅ corrigido' : 'original'})` : '';
        console.log(`  • ${name}: R$ ${data.currentPrice.toFixed(2)} - ${data.laboratory} ${priceChange}`);
      } else {
        console.log(`  • ${name}: ❌ não encontrado`);
      }
    });

    return status;
  } catch (error) {
    console.error('❌ Erro na análise de alto valor:', error);
    return {};
  }
}

async function getMainLabsStatus() {
  try {
    const mainLabs = [
      'Roche', 'Novartis', 'Bayer', 'AbbVie', 'Janssen', 
      'MSD', 'Bristol Myers Squibb', 'Pfizer', 'Sanofi'
    ];

    const status = {};

    for (const labName of mainLabs) {
      const lab = await prisma.lab.findUnique({
        where: { name: labName },
        include: {
          _count: {
            select: { prices: true }
          },
          prices: {
            take: 5,
            orderBy: { capturedAt: 'desc' },
            include: { medication: true }
          }
        }
      });

      if (lab) {
        const recentPrices = lab.prices.map(p => parseFloat(p.value.toString()));
        const avgPrice = recentPrices.length > 0 ? 
          recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length : 0;

        status[labName] = {
          found: true,
          totalPrices: lab._count.prices,
          avgRecentPrice: Math.round(avgPrice * 100) / 100,
          recentMedications: lab.prices.map(p => p.medication.name).slice(0, 3)
        };
      } else {
        status[labName] = { found: false };
      }
    }

    console.log(`\n🏭 Status dos Laboratórios Principais:`);
    Object.entries(status).forEach(([name, data]) => {
      if (data.found) {
        console.log(`  • ${name}: ${data.totalPrices} preços (média: R$ ${data.avgRecentPrice})`);
      } else {
        console.log(`  • ${name}: ❌ não encontrado`);
      }
    });

    return status;
  } catch (error) {
    console.error('❌ Erro na análise de laboratórios:', error);
    return {};
  }
}

async function generateRecommendations() {
  const recommendations = [];

  try {
    // Verificar medicamentos oncológicos com preços ainda baixos
    const suspiciousOncologics = await prisma.medication.findMany({
      where: {
        category: { contains: 'Oncológico' }
      },
      include: {
        prices: {
          take: 1,
          orderBy: { capturedAt: 'desc' }
        }
      }
    });

    const lowPriceOncologics = suspiciousOncologics.filter(med => 
      med.prices[0] && parseFloat(med.prices[0].value.toString()) < 500
    );

    if (lowPriceOncologics.length > 0) {
      recommendations.push({
        type: 'price_validation',
        priority: 'high',
        message: `${lowPriceOncologics.length} medicamentos oncológicos ainda com preços suspeitos (< R$ 500)`,
        action: 'Revisar e corrigir preços manualmente ou via API'
      });
    }

    // Verificar medicamentos sem princípio ativo
    const withoutActiveIngredient = await prisma.medication.count({
      where: {
        activeIngredient: null
      }
    });

    if (withoutActiveIngredient > 0) {
      recommendations.push({
        type: 'data_completeness',
        priority: 'medium', 
        message: `${withoutActiveIngredient} medicamentos sem princípio ativo definido`,
        action: 'Completar informações de princípios ativos'
      });
    }

    // Verificar laboratórios com poucos medicamentos
    const labsWithFewMeds = await prisma.lab.findMany({
      include: {
        _count: {
          select: { prices: true }
        }
      },
      having: {
        prices: {
          _count: {
            lt: 10
          }
        }
      }
    });

    if (labsWithFewMeds.length > 0) {
      recommendations.push({
        type: 'data_coverage',
        priority: 'low',
        message: `${labsWithFewMeds.length} laboratórios com poucos dados (< 10 preços)`,
        action: 'Verificar se são laboratórios válidos ou consolidar dados'
      });
    }

    console.log(`\n💡 Recomendações (${recommendations.length}):`);
    recommendations.forEach(rec => {
      const priorityEmoji = rec.priority === 'high' ? '🔴' : 
                           rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`  ${priorityEmoji} ${rec.message}`);
      console.log(`     Ação: ${rec.action}`);
    });

    return recommendations;
  } catch (error) {
    console.error('❌ Erro ao gerar recomendações:', error);
    return [];
  }
}

function displayReportSummary(report) {
  console.log('\n📋 RESUMO DO RELATÓRIO DE QUALIDADE:');
  console.log('=====================================');
  
  console.log(`\n✅ CORREÇÕES APLICADAS:`);
  console.log(`  • Total de correções: ${report.corrections.totalCorrections || 0}`);
  console.log(`  • Laboratórios corrigidos: ${report.corrections.correctionSources?.DataCorrection || 0}`);
  console.log(`  • Preços corrigidos: ${report.corrections.correctionSources?.PriceCorrection || 0}`);
  console.log(`  • Dados enriquecidos: ${report.corrections.correctionSources?.DataEnrichment || 0}`);

  console.log(`\n📊 QUALIDADE POR CATEGORIA:`);
  Object.entries(report.quality).forEach(([category, data]) => {
    console.log(`  • ${category}: ${data.count} medicamentos (R$ ${data.avgPrice} média)`);
  });

  console.log(`\n🏆 MEDICAMENTOS DE ALTO VALOR:`);
  Object.entries(report.highValueStatus || {}).forEach(([name, data]) => {
    if (data.found) {
      const status = data.corrected ? '✅' : '⚠️';
      console.log(`  ${status} ${name}: R$ ${data.currentPrice.toFixed(2)} (${data.laboratory})`);
    }
  });

  console.log(`\n💡 PRÓXIMAS AÇÕES RECOMENDADAS:`);
  (report.recommendations || []).forEach((rec, index) => {
    const priorityEmoji = rec.priority === 'high' ? '🔴' : 
                         rec.priority === 'medium' ? '🟡' : '🟢';
    console.log(`  ${index + 1}. ${priorityEmoji} ${rec.message}`);
  });

  console.log('\n=====================================');
  console.log('📄 Relatório completo salvo em: data-quality-report.json');
}

// Executar geração do relatório
generateReport();
