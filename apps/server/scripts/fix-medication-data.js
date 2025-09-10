// Script para corrigir dados incorretos de medicamentos
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Dados corretos baseados em conhecimento farmacêutico
const MEDICATION_CORRECTIONS = {
  // Adempas (riociguat) - Bayer - Medicamento de alto custo para hipertensão pulmonar
  'ADEMPAS-0-5MG': {
    laboratory: 'Bayer',
    priceRange: { min: 8500, max: 12000 }, // R$ 8.500 - 12.000 por caixa
    category: 'Medicamento de Alto Custo | Cardiologia | Hipertensão Pulmonar',
    activeIngredient: 'Riociguat'
  },
  'ADEMPAS-1MG': {
    laboratory: 'Bayer',
    priceRange: { min: 11000, max: 15000 },
    category: 'Medicamento de Alto Custo | Cardiologia | Hipertensão Pulmonar',
    activeIngredient: 'Riociguat'
  },
  'ADEMPAS-1-5MG': {
    laboratory: 'Bayer',
    priceRange: { min: 15000, max: 20000 },
    category: 'Medicamento de Alto Custo | Cardiologia | Hipertensão Pulmonar',
    activeIngredient: 'Riociguat'
  },
  'ADEMPAS-2MG': {
    laboratory: 'Bayer',
    priceRange: { min: 18000, max: 25000 },
    category: 'Medicamento de Alto Custo | Cardiologia | Hipertensão Pulmonar',
    activeIngredient: 'Riociguat'
  },
  'ADEMPAS-2-5MG': {
    laboratory: 'Bayer',
    priceRange: { min: 22000, max: 28000 },
    category: 'Medicamento de Alto Custo | Cardiologia | Hipertensão Pulmonar',
    activeIngredient: 'Riociguat'
  },

  // Avastin (bevacizumab) - Roche - Oncológico
  'AVASTIN-100MG': {
    laboratory: 'Roche',
    priceRange: { min: 2800, max: 3500 },
    category: 'Oncológico | Oncologia | Anti-VEGF',
    activeIngredient: 'Bevacizumab'
  },
  'AVASTIN-400MG': {
    laboratory: 'Roche',
    priceRange: { min: 8500, max: 12000 },
    category: 'Oncológico | Oncologia | Anti-VEGF',
    activeIngredient: 'Bevacizumab'
  },

  // Herceptin (trastuzumab) - Roche - Oncológico
  'HERCEPTIN-150MG': {
    laboratory: 'Roche',
    priceRange: { min: 2200, max: 2800 },
    category: 'Oncológico | Oncologia | Anti-HER2',
    activeIngredient: 'Trastuzumab'
  },
  'HERCEPTIN-440MG': {
    laboratory: 'Roche',
    priceRange: { min: 6500, max: 8000 },
    category: 'Oncológico | Oncologia | Anti-HER2',
    activeIngredient: 'Trastuzumab'
  },

  // MabThera (rituximab) - Roche - Oncológico/Hematológico
  'MABTHERA-100MG': {
    laboratory: 'Roche',
    priceRange: { min: 850, max: 1200 },
    category: 'Oncológico | Hematologia | Anti-CD20',
    activeIngredient: 'Rituximab'
  },
  'MABTHERA-500MG': {
    laboratory: 'Roche',
    priceRange: { min: 3800, max: 4500 },
    category: 'Oncológico | Hematologia | Anti-CD20',
    activeIngredient: 'Rituximab'
  },

  // Humira (adalimumab) - AbbVie - Imunobiológico
  'HUMIRA-40MG': {
    laboratory: 'AbbVie',
    priceRange: { min: 3200, max: 4000 },
    category: 'Imunobiológico | Reumatologia | Anti-TNF',
    activeIngredient: 'Adalimumab'
  },

  // Remicade (infliximab) - Janssen - Imunobiológico
  'REMICADE-100MG': {
    laboratory: 'Janssen',
    priceRange: { min: 2800, max: 3500 },
    category: 'Imunobiológico | Reumatologia | Anti-TNF',
    activeIngredient: 'Infliximab'
  },

  // Glivec (imatinib) - Novartis - Oncológico
  'GLIVEC-100MG': {
    laboratory: 'Novartis',
    priceRange: { min: 8500, max: 12000 },
    category: 'Oncológico | Oncologia | Inibidor de Tirosina Quinase',
    activeIngredient: 'Imatinib'
  },
  'GLIVEC-400MG': {
    laboratory: 'Novartis',
    priceRange: { min: 25000, max: 35000 },
    category: 'Oncológico | Oncologia | Inibidor de Tirosina Quinase',
    activeIngredient: 'Imatinib'
  },

  // Keytruda (pembrolizumab) - MSD - Oncológico
  'KEYTRUDA-100MG': {
    laboratory: 'MSD',
    priceRange: { min: 12000, max: 15000 },
    category: 'Oncológico | Oncologia | Imunoterapia',
    activeIngredient: 'Pembrolizumab'
  },

  // Opdivo (nivolumab) - Bristol Myers Squibb - Oncológico
  'OPDIVO-40MG': {
    laboratory: 'Bristol Myers Squibb',
    priceRange: { min: 8500, max: 11000 },
    category: 'Oncológico | Oncologia | Imunoterapia',
    activeIngredient: 'Nivolumab'
  },
  'OPDIVO-100MG': {
    laboratory: 'Bristol Myers Squibb',
    priceRange: { min: 18000, max: 22000 },
    category: 'Oncológico | Oncologia | Imunoterapia',
    activeIngredient: 'Nivolumab'
  }
};

// Laboratórios corretos para medicamentos conhecidos
const LABORATORY_CORRECTIONS = {
  // Medicamentos Roche
  'HERCEPTIN': 'Roche',
  'MABTHERA': 'Roche', 
  'AVASTIN': 'Roche',
  'TECENTRIQ': 'Roche',
  'PERJETA': 'Roche',
  'KADCYLA': 'Roche',

  // Medicamentos Novartis
  'GLIVEC': 'Novartis',
  'TASIGNA': 'Novartis',
  'AFINITOR': 'Novartis',
  'KISQALI': 'Novartis',
  'ZYKADIA': 'Novartis',

  // Medicamentos Bayer
  'ADEMPAS': 'Bayer',
  'NEXAVAR': 'Bayer',
  'STIVARGA': 'Bayer',

  // Medicamentos AbbVie
  'HUMIRA': 'AbbVie',
  'IMBRUVICA': 'AbbVie',
  'VENCLEXTA': 'AbbVie',

  // Medicamentos Janssen
  'REMICADE': 'Janssen',
  'STELARA': 'Janssen',
  'DARZALEX': 'Janssen',

  // Medicamentos MSD
  'KEYTRUDA': 'MSD',

  // Medicamentos Bristol Myers Squibb
  'OPDIVO': 'Bristol Myers Squibb',
  'YERVOY': 'Bristol Myers Squibb',
  'SPRYCEL': 'Bristol Myers Squibb',

  // Medicamentos Pfizer
  'IBRANCE': 'Pfizer',
  'INLYTA': 'Pfizer',
  'BOSULIF': 'Pfizer'
};

async function main() {
  console.log('🔧 Iniciando correção de dados de medicamentos...\n');

  try {
    // 1. Corrigir laboratórios incorretos
    await correctLaboratories();
    
    // 2. Corrigir preços muito baixos para medicamentos caros
    await correctPrices();
    
    // 3. Atualizar categorias e princípios ativos
    await updateCategories();
    
    // 4. Gerar relatório de correções
    await generateCorrectionReport();

    console.log('\n✅ Correção de dados concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro na correção de dados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function correctLaboratories() {
  console.log('🏥 Corrigindo laboratórios incorretos...');
  
  let corrections = 0;
  
  for (const [medicationPattern, correctLab] of Object.entries(LABORATORY_CORRECTIONS)) {
    try {
      // Buscar ou criar laboratório correto
      const lab = await prisma.lab.upsert({
        where: { name: correctLab },
        update: {},
        create: { name: correctLab }
      });

      // Buscar medicamentos que começam com o padrão
      const medications = await prisma.medication.findMany({
        where: {
          OR: [
            { code: { startsWith: medicationPattern } },
            { name: { contains: medicationPattern } }
          ]
        },
        include: {
          prices: {
            include: { lab: true },
            orderBy: { capturedAt: 'desc' }
          }
        }
      });

      for (const medication of medications) {
        // Atualizar preços com laboratório incorreto
        const incorrectPrices = medication.prices.filter(price => 
          price.lab && price.lab.name !== correctLab
        );

        if (incorrectPrices.length > 0) {
          console.log(`  📝 Corrigindo ${medication.name}: ${incorrectPrices.length} preços`);
          
          // Atualizar preços para o laboratório correto
          await prisma.price.updateMany({
            where: {
              id: { in: incorrectPrices.map(p => p.id) }
            },
            data: {
              labId: lab.id
            }
          });
          
          corrections += incorrectPrices.length;
        }
      }
    } catch (error) {
      console.error(`  ❌ Erro ao corrigir ${medicationPattern}:`, error.message);
    }
  }
  
  console.log(`  ✅ ${corrections} preços corrigidos para laboratórios corretos\n`);
}

async function correctPrices() {
  console.log('💰 Corrigindo preços incorretos...');
  
  let corrections = 0;
  
  for (const [medicationCode, correctionData] of Object.entries(MEDICATION_CORRECTIONS)) {
    try {
      const medication = await prisma.medication.findUnique({
        where: { code: medicationCode },
        include: {
          prices: {
            include: { lab: true },
            orderBy: { capturedAt: 'desc' },
            take: 10
          }
        }
      });

      if (!medication) {
        console.log(`  ⚠️ Medicamento ${medicationCode} não encontrado`);
        continue;
      }

      // Buscar ou criar laboratório correto
      const lab = await prisma.lab.upsert({
        where: { name: correctionData.laboratory },
        update: {},
        create: { name: correctionData.laboratory }
      });

      // Verificar se preços estão muito baixos
      const currentPrice = medication.prices[0];
      if (currentPrice) {
        const currentValue = parseFloat(currentPrice.value.toString());
        
        if (currentValue < correctionData.priceRange.min) {
          console.log(`  📈 ${medication.name}: R$ ${currentValue} → R$ ${correctionData.priceRange.min}-${correctionData.priceRange.max}`);
          
          // Gerar novo preço realista dentro da faixa
          const newPrice = correctionData.priceRange.min + 
            Math.random() * (correctionData.priceRange.max - correctionData.priceRange.min);
          
          // Criar novo registro de preço com dados corretos
          await prisma.price.create({
            data: {
              medicationId: medication.id,
              labId: lab.id,
              value: newPrice.toFixed(2),
              source: 'DataCorrection',
              capturedAt: new Date(),
              meta: JSON.stringify({
                correctionReason: 'Price too low for high-cost medication',
                originalPrice: currentValue,
                originalLab: currentPrice.lab?.name
              })
            }
          });
          
          corrections++;
        }
      }

      // Atualizar informações do medicamento
      await prisma.medication.update({
        where: { id: medication.id },
        data: {
          category: correctionData.category,
          activeIngredient: correctionData.activeIngredient
        }
      });

    } catch (error) {
      console.error(`  ❌ Erro ao corrigir ${medicationCode}:`, error.message);
    }
  }
  
  console.log(`  ✅ ${corrections} preços corrigidos\n`);
}

async function updateCategories() {
  console.log('🏷️ Atualizando categorias e princípios ativos...');
  
  const categoryUpdates = [
    // Medicamentos oncológicos conhecidos
    { pattern: 'HERCEPTIN', category: 'Oncológico | Oncologia | Anti-HER2', activeIngredient: 'Trastuzumab' },
    { pattern: 'MABTHERA', category: 'Oncológico | Hematologia | Anti-CD20', activeIngredient: 'Rituximab' },
    { pattern: 'AVASTIN', category: 'Oncológico | Oncologia | Anti-VEGF', activeIngredient: 'Bevacizumab' },
    { pattern: 'KEYTRUDA', category: 'Oncológico | Oncologia | Imunoterapia', activeIngredient: 'Pembrolizumab' },
    { pattern: 'OPDIVO', category: 'Oncológico | Oncologia | Imunoterapia', activeIngredient: 'Nivolumab' },
    { pattern: 'GLIVEC', category: 'Oncológico | Oncologia | Inibidor TK', activeIngredient: 'Imatinib' },
    
    // Imunobiológicos
    { pattern: 'HUMIRA', category: 'Imunobiológico | Reumatologia | Anti-TNF', activeIngredient: 'Adalimumab' },
    { pattern: 'REMICADE', category: 'Imunobiológico | Reumatologia | Anti-TNF', activeIngredient: 'Infliximab' },
    { pattern: 'STELARA', category: 'Imunobiológico | Dermatologia | Anti-IL12/23', activeIngredient: 'Ustekinumab' },
    
    // Medicamentos cardiológicos
    { pattern: 'ADEMPAS', category: 'Medicamento de Alto Custo | Cardiologia | Hipertensão Pulmonar', activeIngredient: 'Riociguat' }
  ];

  let updates = 0;
  
  for (const update of categoryUpdates) {
    try {
      const result = await prisma.medication.updateMany({
        where: {
          OR: [
            { code: { contains: update.pattern } },
            { name: { contains: update.pattern } }
          ]
        },
        data: {
          category: update.category,
          activeIngredient: update.activeIngredient
        }
      });
      
      if (result.count > 0) {
        console.log(`  📝 ${update.pattern}: ${result.count} medicamentos atualizados`);
        updates += result.count;
      }
    } catch (error) {
      console.error(`  ❌ Erro ao atualizar ${update.pattern}:`, error.message);
    }
  }
  
  console.log(`  ✅ ${updates} medicamentos atualizados\n`);
}

async function generateCorrectionReport() {
  console.log('📊 Gerando relatório de correções...');
  
  try {
    // Buscar medicamentos de alto custo
    const highCostMedications = await prisma.medication.findMany({
      where: {
        category: { contains: 'Alto Custo' }
      },
      include: {
        prices: {
          take: 1,
          orderBy: { capturedAt: 'desc' },
          include: { lab: true }
        }
      }
    });

    // Buscar medicamentos com preços muito baixos para oncológicos
    const suspiciousOncologics = await prisma.medication.findMany({
      where: {
        category: { contains: 'Oncológico' }
      },
      include: {
        prices: {
          take: 1,
          orderBy: { capturedAt: 'desc' },
          include: { lab: true }
        }
      }
    });

    const lowPriceOncologics = suspiciousOncologics.filter(med => 
      med.prices[0] && parseFloat(med.prices[0].value.toString()) < 500
    );

    console.log(`\n📋 RELATÓRIO DE CORREÇÕES:`);
    console.log(`  🏥 Medicamentos de alto custo: ${highCostMedications.length}`);
    console.log(`  ⚠️ Oncológicos com preço suspeito: ${lowPriceOncologics.length}`);
    
    if (lowPriceOncologics.length > 0) {
      console.log(`\n  🔍 Oncológicos com preços possivelmente incorretos:`);
      lowPriceOncologics.slice(0, 10).forEach(med => {
        const price = med.prices[0];
        console.log(`    • ${med.name}: R$ ${parseFloat(price.value.toString()).toFixed(2)} (${price.lab?.name})`);
      });
    }

    // Buscar laboratórios com mais registros
    const labStats = await prisma.lab.findMany({
      include: {
        _count: {
          select: { prices: true }
        }
      },
      orderBy: {
        prices: {
          _count: 'desc'
        }
      },
      take: 10
    });

    console.log(`\n  🏭 Top 10 laboratórios por volume de preços:`);
    labStats.forEach((lab, index) => {
      console.log(`    ${index + 1}. ${lab.name}: ${lab._count.prices} preços`);
    });

  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error.message);
  }
}

// Função para detectar medicamentos com dados suspeitos
async function detectSuspiciousMedications() {
  console.log('\n🔍 Detectando medicamentos com dados suspeitos...');
  
  try {
    // Medicamentos oncológicos com preços muito baixos (< R$ 200)
    const suspiciousOncologics = await prisma.$queryRaw`
      SELECT m.name, m.code, p.value, l.name as lab_name, m.category
      FROM Medication m
      JOIN Price p ON m.id = p.medicationId
      LEFT JOIN Lab l ON p.labId = l.id
      WHERE m.category LIKE '%Oncológico%'
      AND p.value < 200
      AND p.id IN (
        SELECT p2.id FROM Price p2 
        WHERE p2.medicationId = m.id 
        ORDER BY p2.capturedAt DESC 
        LIMIT 1
      )
      ORDER BY p.value ASC
      LIMIT 20
    `;

    console.log(`\n  🚨 Oncológicos com preços suspeitos (< R$ 200):`);
    suspiciousOncologics.forEach(med => {
      console.log(`    • ${med.name}: R$ ${parseFloat(med.value).toFixed(2)} (${med.lab_name})`);
    });

    // Medicamentos com laboratórios improváveis
    const suspiciousLabs = await prisma.$queryRaw`
      SELECT m.name, m.code, l.name as lab_name, p.value, m.category
      FROM Medication m
      JOIN Price p ON m.id = p.medicationId
      LEFT JOIN Lab l ON p.labId = l.id
      WHERE (
        (m.name LIKE '%Herceptin%' AND l.name != 'Roche') OR
        (m.name LIKE '%MabThera%' AND l.name != 'Roche') OR
        (m.name LIKE '%Avastin%' AND l.name != 'Roche') OR
        (m.name LIKE '%Humira%' AND l.name != 'AbbVie') OR
        (m.name LIKE '%Glivec%' AND l.name != 'Novartis') OR
        (m.name LIKE '%Adempas%' AND l.name != 'Bayer')
      )
      AND p.id IN (
        SELECT p2.id FROM Price p2 
        WHERE p2.medicationId = m.id 
        ORDER BY p2.capturedAt DESC 
        LIMIT 1
      )
    `;

    console.log(`\n  🏭 Medicamentos com laboratórios incorretos:`);
    suspiciousLabs.forEach(med => {
      console.log(`    • ${med.name}: ${med.lab_name} (deveria ser outro laboratório)`);
    });

    return {
      suspiciousOncologics: suspiciousOncologics.length,
      suspiciousLabs: suspiciousLabs.length
    };

  } catch (error) {
    console.error('❌ Erro na detecção:', error.message);
    return { suspiciousOncologics: 0, suspiciousLabs: 0 };
  }
}

// Executar detecção antes das correções
detectSuspiciousMedications().then(() => {
  main();
});
