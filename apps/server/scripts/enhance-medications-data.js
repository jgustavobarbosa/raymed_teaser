// Script para enriquecer dados dos medicamentos com informações da API Ray
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');
const { RayAPIClient } = require('./ray-api-client');

async function enhanceMedicationsData() {
  const prisma = new PrismaClient();
  const rayClient = new RayAPIClient();
  
  try {
    console.log('🚀 ENRIQUECENDO DADOS DOS MEDICAMENTOS');
    console.log('=====================================');
    
    // 1. Testar conexão com API Ray
    console.log('\n1. Testando conexão com API Ray...');
    const connectionTest = await rayClient.testConnection();
    console.log(`${connectionTest.success ? '✅' : '❌'} ${connectionTest.message}`);
    
    // 2. Buscar medicamentos do banco
    const medications = await prisma.medication.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n2. Processando ${medications.length} medicamentos...`);
    
    let processed = 0;
    let enhanced = 0;
    let pricesAdded = 0;
    let errors = 0;
    
    for (const medication of medications) {
      try {
        console.log(`\n🔍 Processando: ${medication.name}`);
        
        // 3. Buscar dados completos na API Ray
        const fullInfo = await searchMedicationInRay(rayClient, medication);
        
        if (fullInfo) {
          // 4. Atualizar medicamento com dados enriquecidos
          const updatedMedication = await prisma.medication.update({
            where: { id: medication.id },
            data: {
              // Manter dados existentes e adicionar novos
              activeIngredient: fullInfo.principioAtivo || medication.activeIngredient,
              category: fullInfo.categoria || medication.category,
              // Adicionar metadados como JSON string (compatível SQLite)
              // Note: Vamos usar um campo que já existe ou criar um novo
            }
          });
          
          // 5. Buscar e inserir preços reais
          if (fullInfo.medicamento_id) {
            const realPrices = await rayClient.getMedicamentoPrices(fullInfo.medicamento_id, {
              limit: 30, // Últimos 30 registros
              ordenar_por: 'data_atualizacao'
            });
            
            if (realPrices.length > 0) {
              const priceRecords = await processPrices(prisma, medication.id, realPrices);
              pricesAdded += priceRecords;
              console.log(`💰 ${priceRecords} preços reais adicionados`);
            }
          }
          
          enhanced++;
          console.log(`✅ Enriquecido: ${medication.name}`);
        } else {
          // Simular dados enriquecidos baseados no nome
          const enrichedData = enrichMedicationFromName(medication);
          
          await prisma.medication.update({
            where: { id: medication.id },
            data: enrichedData
          });
          
          console.log(`🔄 Dados simulados: ${medication.name}`);
        }
        
        processed++;
        
        // Delay para não sobrecarregar API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        errors++;
        console.error(`❌ Erro ao processar ${medication.name}:`, error.message);
      }
    }
    
    console.log('\n🎉 ENRIQUECIMENTO CONCLUÍDO!');
    console.log('============================');
    console.log(`📊 Processados: ${processed}`);
    console.log(`✅ Enriquecidos: ${enhanced}`);
    console.log(`💰 Preços adicionados: ${pricesAdded}`);
    console.log(`❌ Erros: ${errors}`);
    
    // Verificar resultado final
    const finalStats = await getFinalStats(prisma);
    console.log('\n📈 ESTATÍSTICAS FINAIS:');
    console.log('======================');
    console.log(`💊 Medicamentos: ${finalStats.medications}`);
    console.log(`🏥 Laboratórios: ${finalStats.labs}`);
    console.log(`💰 Preços: ${finalStats.prices}`);
    console.log(`📊 Categorias: ${finalStats.categories.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Buscar medicamento na API Ray por nome/princípio ativo
async function searchMedicationInRay(rayClient, medication) {
  try {
    // Tentar buscar por nome
    let results = await rayClient.searchMedicamentos(medication.name);
    
    if (results.length === 0 && medication.activeIngredient) {
      // Tentar buscar por princípio ativo
      results = await rayClient.searchMedicamentos(medication.activeIngredient);
    }
    
    if (results.length > 0) {
      // Pegar o primeiro resultado e buscar info completa
      const medicamentoId = results[0].id || results[0].medicamento_id;
      return await rayClient.getMedicamentoFullInfo(medicamentoId);
    }
    
    return null;
  } catch (error) {
    console.warn(`⚠️ Busca na Ray falhou para ${medication.name}:`, error.message);
    return null;
  }
}

// Processar preços da API Ray
async function processPrices(prisma, medicationId, rayPrices) {
  let addedCount = 0;
  
  for (const priceData of rayPrices) {
    try {
      // Buscar ou criar laboratório
      let labId = null;
      if (priceData.laboratorio) {
        const lab = await prisma.lab.upsert({
          where: { name: priceData.laboratorio },
          update: {},
          create: {
            name: priceData.laboratorio,
            cnpj: priceData.cnpj_laboratorio || null,
          },
        });
        labId = lab.id;
      }
      
      // Criar registro de preço
      await prisma.price.create({
        data: {
          medicationId,
          labId,
          value: new Prisma.Decimal(priceData.preco || priceData.valor || 0),
          capturedAt: new Date(priceData.data_captura || priceData.data_atualizacao || new Date()),
          source: 'RAY_API_REAL',
          currency: priceData.moeda || 'BRL',
          meta: JSON.stringify({
            rayId: priceData.id,
            fonte: priceData.fonte,
            regiao: priceData.regiao,
            farmacia: priceData.farmacia,
            desconto: priceData.desconto,
            promocao: priceData.promocao,
            real: true,
          }),
        },
      });
      
      addedCount++;
    } catch (error) {
      console.warn(`⚠️ Erro ao inserir preço:`, error.message);
    }
  }
  
  return addedCount;
}

// Enriquecer medicamento baseado no nome (fallback)
function enrichMedicationFromName(medication) {
  const name = medication.name.toLowerCase();
  
  // Detectar indicações baseadas no princípio ativo
  const indicacoes = detectIndicacoes(medication.activeIngredient, name);
  
  // Detectar grupo de doenças
  const grupoDoen = detectGrupoDoenca(medication.activeIngredient, medication.category);
  
  // Detectar características especiais
  const caracteristicas = detectCaracteristicas(name, medication.activeIngredient);
  
  return {
    // Manter dados existentes e adicionar novos via campo meta (se existir)
    // Como não temos campo específico, vamos usar category expandida
    category: `${medication.category} | ${grupoDoen}`,
    // Dados enriquecidos seriam salvos em um campo JSON se tivéssemos
  };
}

// Detectar indicações terapêuticas
function detectIndicacoes(principioAtivo, nome) {
  const indicacoesMap = {
    'bevacizumabe': 'Câncer colorretal, pulmão, mama, rim',
    'adalimumabe': 'Artrite reumatoide, Crohn, psoríase',
    'rituximabe': 'Linfoma, leucemia, artrite reumatoide',
    'trastuzumabe': 'Câncer de mama HER2+',
    'infliximabe': 'Doença de Crohn, artrite reumatoide',
    'tocilizumabe': 'Artrite reumatoide, arterite de células gigantes',
    'everolimo': 'Câncer renal, mama, neuroendócrino',
    'bortezomibe': 'Mieloma múltiplo, linfoma de manto',
    'imatinibe': 'Leucemia mieloide crônica, GIST',
    'enzalutamida': 'Câncer de próstata resistente à castração',
    'abiraterona': 'Câncer de próstata metastático',
    'paracetamol': 'Dor, febre',
    'dipirona': 'Dor, febre, cólicas',
    'ibuprofeno': 'Dor, inflamação, febre',
    'amoxicilina': 'Infecções bacterianas',
    'losartana': 'Hipertensão arterial, proteção renal',
  };
  
  const principio = principioAtivo?.toLowerCase() || '';
  
  for (const [key, indicacao] of Object.entries(indicacoesMap)) {
    if (principio.includes(key)) {
      return indicacao;
    }
  }
  
  return 'Conforme bula médica';
}

// Detectar grupo de doença
function detectGrupoDoenca(principioAtivo, categoria) {
  const gruposMap = {
    'Oncológico': 'Oncologia',
    'Imunobiológico': 'Autoimune/Inflamatório',
    'Analgésico': 'Dor e Febre',
    'Antibiótico': 'Infecciosas',
    'Anti-hipertensivo': 'Cardiovascular',
    'Anti-inflamatório': 'Inflamação',
    'Hormônio Antineoplásico': 'Oncologia Hormonal',
    'Especialidade Farmacêutica': 'Especialidades',
  };
  
  return gruposMap[categoria] || 'Outros';
}

// Detectar características especiais
function detectCaracteristicas(nome, principioAtivo) {
  const caracteristicas = [];
  
  if (nome.includes('mg/ml') || nome.includes('injetável')) {
    caracteristicas.push('Injetável');
  }
  
  if (nome.includes('sc ') || nome.includes('subcutâneo')) {
    caracteristicas.push('Subcutâneo');
  }
  
  if (principioAtivo?.includes('mabe')) {
    caracteristicas.push('Anticorpo Monoclonal');
  }
  
  if (nome.includes('pen') || nome.includes('caneta')) {
    caracteristicas.push('Caneta Aplicadora');
  }
  
  const preco = extractPrecoEstimado(nome, principioAtivo);
  if (preco) {
    caracteristicas.push(`Faixa: ${preco}`);
  }
  
  return caracteristicas;
}

// Estimar faixa de preço baseada em características
function extractPrecoEstimado(nome, principioAtivo) {
  // Medicamentos oncológicos de alto custo
  const altoCusto = ['bevacizumabe', 'trastuzumabe', 'rituximabe', 'adalimumabe', 'infliximabe'];
  
  if (altoCusto.some(med => principioAtivo?.toLowerCase().includes(med))) {
    return 'R$ 1.000 - R$ 15.000';
  }
  
  // Medicamentos básicos
  const basicos = ['paracetamol', 'dipirona', 'ibuprofeno'];
  
  if (basicos.some(med => principioAtivo?.toLowerCase().includes(med))) {
    return 'R$ 5 - R$ 50';
  }
  
  // Antibióticos
  if (principioAtivo?.toLowerCase().includes('cilina')) {
    return 'R$ 15 - R$ 150';
  }
  
  return 'R$ 50 - R$ 500';
}

// Obter estatísticas finais
async function getFinalStats(prisma) {
  const [medications, labs, prices, categories] = await Promise.all([
    prisma.medication.count(),
    prisma.lab.count(),
    prisma.price.count(),
    prisma.medication.findMany({
      select: { category: true },
      distinct: ['category'],
    })
  ]);
  
  return {
    medications,
    labs,
    prices,
    categories: categories.map(c => c.category).filter(Boolean),
  };
}

// Executar enriquecimento
enhanceMedicationsData();
