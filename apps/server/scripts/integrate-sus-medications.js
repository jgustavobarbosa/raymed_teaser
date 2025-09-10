// Script para integrar medicamentos da atenção básica do SUS
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

async function integrateSUSMedications() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🏥 INTEGRANDO MEDICAMENTOS DA ATENÇÃO BÁSICA DO SUS');
    console.log('=================================================');
    
    // 1. Ler arquivo Excel
    const excelPath = path.join(__dirname, '../../../Resultadosdabaseb2_medicamentosv2comRename.xlsx');
    console.log(`📊 Lendo arquivo: ${excelPath}`);
    
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Converter para JSON
    const susMedications = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📋 Medicamentos SUS encontrados: ${susMedications.length}`);
    console.log('📊 Primeiros 5 registros:');
    susMedications.slice(0, 5).forEach((med, i) => {
      console.log(`${i + 1}. ${JSON.stringify(med)}`);
    });
    
    // 2. Processar e normalizar dados
    let processed = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    for (const susData of susMedications) {
      try {
        // Normalizar dados do Excel (adaptar conforme estrutura real)
        const medicationData = normalizeSUSData(susData);
        
        if (!medicationData.name || !medicationData.code) {
          console.warn(`⚠️ Dados incompletos, pulando:`, susData);
          continue;
        }
        
        console.log(`\n🔍 Processando: ${medicationData.name}`);
        
        // 3. Upsert medicamento
        const medication = await prisma.medication.upsert({
          where: { code: medicationData.code },
          update: {
            name: medicationData.name,
            activeIngredient: medicationData.activeIngredient,
            category: medicationData.category,
          },
          create: {
            code: medicationData.code,
            name: medicationData.name,
            activeIngredient: medicationData.activeIngredient,
            category: medicationData.category,
          },
        });
        
        // 4. Buscar preços na API Ray (se disponível)
        const priceData = await fetchSUSMedicationPrices(medicationData);
        
        if (priceData && priceData.length > 0) {
          const addedPrices = await processSUSPrices(prisma, medication.id, priceData);
          console.log(`   💰 ${addedPrices} preços da API Ray adicionados`);
        } else {
          // 5. Gerar preços realistas para SUS (mais baratos)
          const simulatedPrices = await generateSUSPrices(prisma, medication.id, medicationData);
          console.log(`   🔄 ${simulatedPrices} preços SUS simulados`);
        }
        
        if (medication.createdAt.getTime() > Date.now() - 5000) {
          created++;
          console.log(`✅ Criado: ${medicationData.name}`);
        } else {
          updated++;
          console.log(`🔄 Atualizado: ${medicationData.name}`);
        }
        
        processed++;
        
        // Delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errors++;
        console.error(`❌ Erro ao processar:`, error.message);
      }
    }
    
    // 6. Relatório final
    await generateSUSIntegrationReport(prisma, processed, created, updated, errors);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Normalizar dados do Excel SUS
function normalizeSUSData(excelRow) {
  // Adaptar conforme estrutura real do Excel
  // Assumindo colunas comuns de medicamentos SUS
  const possibleNames = [
    excelRow['Nome'] || excelRow['NOME'] || excelRow['nome'] ||
    excelRow['Medicamento'] || excelRow['MEDICAMENTO'] || excelRow['medicamento'] ||
    excelRow['Denominação'] || excelRow['denominacao'] ||
    Object.values(excelRow)[0] // Primeira coluna como fallback
  ].filter(Boolean)[0];
  
  const possibleIngredients = [
    excelRow['Princípio Ativo'] || excelRow['PRINCIPIO_ATIVO'] || excelRow['principio_ativo'] ||
    excelRow['Substância'] || excelRow['substancia'] ||
    excelRow['Ativo'] || excelRow['ativo'] ||
    Object.values(excelRow)[1] // Segunda coluna como fallback
  ].filter(Boolean)[0];
  
  const possibleConcentration = [
    excelRow['Concentração'] || excelRow['CONCENTRACAO'] || excelRow['concentracao'] ||
    excelRow['Dosagem'] || excelRow['dosagem'] ||
    excelRow['Forma'] || excelRow['forma'] ||
    Object.values(excelRow)[2] // Terceira coluna como fallback
  ].filter(Boolean)[0];
  
  // Gerar código único
  const code = (possibleNames || 'UNKNOWN')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50); // Limitar tamanho
  
  // Categorizar como medicamento SUS
  const category = categorizeSUSMedication(possibleIngredients, possibleNames);
  
  return {
    name: possibleNames || 'Medicamento SUS',
    code: `SUS-${code}`,
    activeIngredient: possibleIngredients || 'Não especificado',
    category: `${category} | SUS | Atenção Básica`,
    concentration: possibleConcentration,
    source: 'SUS_ATENCAO_BASICA',
    originalData: excelRow
  };
}

// Categorizar medicamentos SUS
function categorizeSUSMedication(ingredient, name) {
  const susCategories = {
    // Analgésicos e anti-inflamatórios
    'paracetamol': 'Analgésico',
    'dipirona': 'Analgésico', 
    'ibuprofeno': 'Anti-inflamatório',
    'diclofenaco': 'Anti-inflamatório',
    'ácido acetilsalicílico': 'Analgésico',
    
    // Antibióticos
    'amoxicilina': 'Antibiótico',
    'azitromicina': 'Antibiótico',
    'cefalexina': 'Antibiótico',
    'penicilina': 'Antibiótico',
    'sulfametoxazol': 'Antibiótico',
    
    // Cardiovasculares
    'losartana': 'Anti-hipertensivo',
    'enalapril': 'Anti-hipertensivo',
    'hidroclorotiazida': 'Diurético',
    'atenolol': 'Beta-bloqueador',
    'anlodipino': 'Bloqueador de canal',
    
    // Diabetes
    'metformina': 'Antidiabético',
    'glibenclamida': 'Antidiabético',
    'insulina': 'Hormônio',
    
    // Outros comuns no SUS
    'omeprazol': 'Protetor Gástrico',
    'sinvastatina': 'Hipolipemiante',
    'levotiroxina': 'Hormônio Tireoidiano',
    'salbutamol': 'Broncodilatador',
    'prednisolona': 'Corticosteroide',
  };
  
  const ingredientLower = (ingredient || '').toLowerCase();
  const nameLower = (name || '').toLowerCase();
  
  // Buscar por princípio ativo
  for (const [key, category] of Object.entries(susCategories)) {
    if (ingredientLower.includes(key) || nameLower.includes(key)) {
      return category;
    }
  }
  
  // Categorização por padrões
  if (ingredientLower.includes('cilina') || ingredientLower.includes('micina')) {
    return 'Antibiótico';
  }
  if (ingredientLower.includes('pril') || ingredientLower.includes('artana')) {
    return 'Anti-hipertensivo';
  }
  if (ingredientLower.includes('tiazida')) {
    return 'Diurético';
  }
  
  return 'Medicamento Básico';
}

// Buscar preços na API Ray para medicamentos SUS
async function fetchSUSMedicationPrices(medicationData) {
  try {
    // Simular busca na API Ray por medicamentos SUS
    // Em produção, usar endpoints reais da API Ray
    
    console.log(`   🔍 Buscando preços para: ${medicationData.name}`);
    
    // Por enquanto, retornar null para usar preços simulados
    // TODO: Implementar chamada real para API Ray
    return null;
    
  } catch (error) {
    console.warn(`   ⚠️ Erro ao buscar preços para ${medicationData.name}:`, error.message);
    return null;
  }
}

// Processar preços da API Ray
async function processSUSPrices(prisma, medicationId, priceData) {
  let addedCount = 0;
  
  for (const price of priceData) {
    try {
      // Buscar ou criar laboratório
      let labId = null;
      if (price.laboratorio) {
        const lab = await prisma.lab.upsert({
          where: { name: price.laboratorio },
          update: {},
          create: {
            name: price.laboratorio,
            cnpj: price.cnpj || null,
          },
        });
        labId = lab.id;
      }
      
      await prisma.price.create({
        data: {
          medicationId,
          labId,
          value: new Prisma.Decimal(price.valor || price.preco || 0),
          capturedAt: new Date(price.data || new Date()),
          source: 'RAY_API_SUS',
          meta: JSON.stringify({
            rayId: price.id,
            fonte: 'API_Ray_SUS',
            susProgram: true,
            atencaoBasica: true,
          }),
        },
      });
      
      addedCount++;
    } catch (error) {
      console.warn(`   ⚠️ Erro ao inserir preço:`, error.message);
    }
  }
  
  return addedCount;
}

// Gerar preços realistas para medicamentos SUS (mais baratos)
async function generateSUSPrices(prisma, medicationId, medicationData) {
  const labs = await prisma.lab.findMany();
  
  // Preços SUS são tipicamente mais baixos
  const susPriceRanges = {
    'Analgésico': { min: 2, max: 15 },
    'Anti-inflamatório': { min: 3, max: 20 },
    'Antibiótico': { min: 5, max: 40 },
    'Anti-hipertensivo': { min: 4, max: 25 },
    'Antidiabético': { min: 3, max: 18 },
    'Protetor Gástrico': { min: 3, max: 22 },
    'Hipolipemiante': { min: 4, max: 30 },
    'Medicamento Básico': { min: 2, max: 20 },
  };
  
  const category = medicationData.category.split(' | ')[0];
  const priceRange = susPriceRanges[category] || { min: 2, max: 25 };
  
  const basePrice = Math.random() * (priceRange.max - priceRange.min) + priceRange.min;
  const prices = [];
  
  console.log(`   💰 Faixa SUS: R$ ${priceRange.min} - R$ ${priceRange.max}`);
  
  // Gerar histórico de 6 meses (SUS tem menos variação)
  for (let month = 6; month >= 0; month--) {
    const date = new Date();
    date.setMonth(date.getMonth() - month);
    
    // 2-3 preços por mês (SUS tem menos fornecedores)
    const pricesThisMonth = Math.floor(Math.random() * 2) + 2;
    
    for (let i = 0; i < pricesThisMonth; i++) {
      const lab = labs[Math.floor(Math.random() * Math.min(labs.length, 10))]; // Só primeiros 10 labs
      
      // Variação menor para SUS (preços mais estáveis)
      const variation = (Math.random() - 0.5) * 0.15; // ±7.5%
      const price = basePrice * (1 + variation);
      
      const specificDate = new Date(date);
      specificDate.setDate(Math.floor(Math.random() * 28) + 1);
      
      prices.push({
        medicationId,
        labId: lab?.id,
        value: new Prisma.Decimal(Math.round(price * 100) / 100),
        capturedAt: specificDate,
        source: 'SUS_SIMULATED',
        meta: JSON.stringify({
          basePrice,
          variation,
          susProgram: true,
          atencaoBasica: true,
          category: category,
          priceRange,
          month: specificDate.getMonth() + 1,
          year: specificDate.getFullYear(),
        }),
      });
    }
  }
  
  // Inserir preços
  if (prices.length > 0) {
    await prisma.price.createMany({
      data: prices,
    });
  }
  
  return prices.length;
}

// Relatório de integração
async function generateSUSIntegrationReport(prisma, processed, created, updated, errors) {
  const [totalMeds, totalPrices, susCount, categories] = await Promise.all([
    prisma.medication.count(),
    prisma.price.count(),
    prisma.medication.count({
      where: { category: { contains: 'SUS' } }
    }),
    prisma.medication.findMany({
      where: { category: { contains: 'SUS' } },
      select: { category: true },
      distinct: ['category']
    })
  ]);
  
  console.log('\n🎉 INTEGRAÇÃO SUS CONCLUÍDA!');
  console.log('===========================');
  console.log(`📊 Medicamentos processados: ${processed}`);
  console.log(`✅ Criados: ${created}`);
  console.log(`🔄 Atualizados: ${updated}`);
  console.log(`❌ Erros: ${errors}`);
  
  console.log('\n📊 BANCO ATUALIZADO:');
  console.log('===================');
  console.log(`💊 Total medicamentos: ${totalMeds}`);
  console.log(`🏥 Medicamentos SUS: ${susCount}`);
  console.log(`💰 Total preços: ${totalPrices}`);
  
  console.log('\n🏥 CATEGORIAS SUS ADICIONADAS:');
  console.log('=============================');
  categories.forEach(cat => {
    if (cat.category?.includes('SUS')) {
      console.log(`- ${cat.category}`);
    }
  });
  
  // Análise de preços SUS vs Privados
  const priceAnalysis = await analyzeSUSvsPricatePrice(prisma);
  console.log('\n💰 ANÁLISE SUS vs PRIVADO:');
  console.log('=========================');
  console.log(`📊 Preço médio SUS: R$ ${priceAnalysis.avgSUS.toFixed(2)}`);
  console.log(`📊 Preço médio Privado: R$ ${priceAnalysis.avgPrivate.toFixed(2)}`);
  console.log(`📈 Diferença: ${priceAnalysis.difference.toFixed(1)}%`);
}

// Analisar diferença de preços SUS vs Privado
async function analyzeSUSvsPricatePrice(prisma) {
  const [susAvg, privateAvg] = await Promise.all([
    prisma.price.aggregate({
      where: {
        medication: {
          category: { contains: 'SUS' }
        }
      },
      _avg: { value: true }
    }),
    prisma.price.aggregate({
      where: {
        medication: {
          category: { not: { contains: 'SUS' } }
        }
      },
      _avg: { value: true }
    })
  ]);
  
  const avgSUS = parseFloat(susAvg._avg.value?.toString() || '0');
  const avgPrivate = parseFloat(privateAvg._avg.value?.toString() || '0');
  const difference = avgPrivate > 0 ? ((avgPrivate - avgSUS) / avgPrivate) * 100 : 0;
  
  return {
    avgSUS,
    avgPrivate, 
    difference
  };
}

// Executar integração
integrateSUSMedications();
