// Script para ingerir medicamentos massivamente da API Ray
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');

const medicamento_meedi_consolidado = [
    ["Abevmy 25mg/mL 16mL", "Bevacizumabe"],
    ["Abevmy 25mg/mL 4mL", "Bevacizumabe"],
    ["Acetato de Abiraterona 250mg", "Acetato de Abiraterona"],
    ["Aclasta 5mg/100mL", "Ácido Zoledrônico"],
    ["Actemra 200mg/10mL", "Tocilizumabe"],
    ["Actemra SC 162mg", "Tocilizumabe"],
    ["Actilyse 20mg", "Alteplase"],
    ["Actilyse 50mg", "Alteplase"],
    ["Adcetris 50mg", "Brentuximabe Vedotina"],
    ["Adempas 0,5mg", "Riociguate"],
    ["Adempas 1,5mg", "Riociguate"],
    ["Adempas 1mg", "Riociguate"],
    ["Adempas 2,5mg", "Riociguate"],
    ["Adempas 2mg", "Riociguate"],
    ["Afinitor 10mg", "Everolimo"],
    ["Afinitor 5mg", "Everolimo"],
    ["Agrastat 0,25mg/mL", "Cloridrato de Tirofibana"],
    ["Agrylin 0,5mg", "Cloridrato de Anagrelida"],
    ["Ajovy 150mg/mL", "Fremanezumabe"],
    ["Aldurazyme 2,9mg/5mL", "Laronidase"],
    ["Alecensa 150mg", "Cloridrato de Alectinibe"],
    ["Alimta 500mg", "Pemetrexede Dissódico"],
    ["AmBisome 50mg", "Anfotericina B"],
    ["Amgevita 50mg/mL", "Adalimumabe"],
    ["Atred 500mg", "Pemetrexede Dissódico"],
    ["Aubagio 14mg", "Teriflunomida"],
    ["Austedo 12mg", "Deutetrabenazine"],
    ["Austedo 6mg", "Deutetrabenazine"],
    ["Avastin 100mg", "Bevacizumabe"],
    ["Avastin 400mg", "Bevacizumabe"],
    ["Avonex 60mcg/0,5mL", "Betainterferona 1A"],
    ["Avsola 10mg/mL", "Infliximabe"],
    ["Azacitidina 100mg/200mg", "Azacitidina"],
    ["Balefio 500mg", "Acetato de Abiraterona"],
    ["Bavencio 200mg", "Avelumabe"],
    ["Beleodaq 500mg", "Belinostate"],
    ["Benlysta 200mg", "Belimumabe"],
    ["Benlysta 400mg", "Belimumabe"],
    ["Berinert 500UI", "Inibidor de C1 Esterase"],
    ["Besponsa 1mg", "Inotuzumab Ozogamicina"],
    ["Blincyto 38,5mcg", "Blinatumomabe"],
    ["Bortezomibe 3,5mg", "Bortezomibe"],
    ["Bosulif 100mg", "Bosutinibe"],
    ["Bosulif 400mg", "Bosutinibe"],
    ["Bosulif 500mg", "Bosutinibe"],
    ["Braftovi 75mg", "Encorafenibe"],
    ["Brukinsa 80mg", "Zanubrutinibe"],
    ["Bylvay 200mcg", "Odevixibate"],
    ["Bylvay 400mcg", "Odevixibate"],
    ["Cabazitaxel 60mg", "Cabazitaxel"],
    ["Cabometyx 20mg", "Levomalato de Cabozantine"],
    ["Cabometyx 40mg", "Levomalato de Cabozantine"],
    ["Cabometyx 60mg", "Levomalato de Cabozantine"],
    ["Calquence 100mg", "Acalabrutinibe"],
    ["Aromasin 25mg", "Exemestano"],
    ["Benlysta 120mg", "Belimumabe"],
    ["Xalkori 250mg", "Crizotinibe"],
    ["Xtandi 40mg", "Enzalutamida"],
    ["Femara 2,5mg", "Letrozol"],
    ["Zelboraf 240mg", "Vemurafenibe"],
    ["Iressa 250mg", "Gefitinibe"],
    ["Valcyte 450mg", "Cloridrato de Valganciclovir"],
    ["Erbitux 5mg/mL", "Cetuximabe"],
    ["Votrient 200mg", "Cloridrato de Pazopanibe"],
    ["Ofev 150mg", "Esilato de Nintedanibe"],
    ["Ofev 100mg", "Esilato de Nintedanibe"],
    ["Xolair 150mg", "Omalizumabe"],
    ["Revolade 50mg", "Eltrombopague Olamina"],
    ["Revolade 25mg", "Eltrombopague Olamina"],
    ["Cimzia 200mg/mL", "Certolizumabe Pegol"],
    ["Mekinist 2mg", "Dimetilsulfóxido de Trametinibe"],
    ["Entyvio 300mg", "Vedolizumabe"],
    ["Esbriet 267mg", "Pirfenidona"],
    ["Mesilato de Imatinibe 400mg", "Mesilato de Imatinibe"],
    ["Mesilato de Imatinibe 100mg", "Mesilato de Imatinibe"],
    ["Jakavi 20mg", "Ruxolitinibe"],
    ["Jakavi 15mg", "Ruxolitinibe"],
    ["Jakavi 10mg", "Ruxolitinibe"],
    ["Jakavi 5mg", "Ruxolitinibe"],
    ["Stivarga 40mg", "Regorafenibe"],
    ["Imbruvica 140mg", "Ibrutinibe"],
    ["Zytiga 250mg", "Acetato de Abiraterona"],
    ["Zytiga 500mg", "Acetato de Abiraterona"],
    ["Paracetamol 500mg", "Paracetamol"], // Medicamentos básicos
    ["Dipirona 500mg", "Dipirona"],
    ["Ibuprofeno 400mg", "Ibuprofeno"],
    ["Amoxicilina 500mg", "Amoxicilina"],
    ["Losartana 50mg", "Losartana"]
];

async function ingestRayMedications() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 Iniciando ingestão massiva de medicamentos da API Ray...');
    console.log(`📊 Total de medicamentos para processar: ${medicamento_meedi_consolidado.length}`);
    
    let processed = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    for (const [medicamentoNome, principioAtivo] of medicamento_meedi_consolidado) {
      try {
        console.log(`\n🔍 Processando: ${medicamentoNome}`);
        
        // 1. Tentar buscar na API Ray (simulado por enquanto)
        const medicamentoData = await fetchMedicationFromRay(medicamentoNome, principioAtivo);
        
        // 2. Upsert no banco
        const medication = await prisma.medication.upsert({
          where: { 
            code: medicamentoData.code 
          },
          update: {
            name: medicamentoData.name,
            activeIngredient: medicamentoData.activeIngredient,
            category: medicamentoData.category,
          },
          create: {
            code: medicamentoData.code,
            name: medicamentoData.name,
            activeIngredient: medicamentoData.activeIngredient,
            category: medicamentoData.category,
          },
        });
        
        // 3. Criar preços simulados (baseados em faixas realistas)
        await createSimulatedPrices(prisma, medication.id, medicamentoData);
        
        if (medication.createdAt.getTime() > Date.now() - 1000) {
          created++;
          console.log(`✅ Criado: ${medicamentoNome}`);
        } else {
          updated++;
          console.log(`🔄 Atualizado: ${medicamentoNome}`);
        }
        
        processed++;
        
        // Delay para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errors++;
        console.error(`❌ Erro ao processar ${medicamentoNome}:`, error.message);
      }
    }
    
    console.log('\n🎉 INGESTÃO CONCLUÍDA!');
    console.log('======================');
    console.log(`📊 Processados: ${processed}`);
    console.log(`✅ Criados: ${created}`);
    console.log(`🔄 Atualizados: ${updated}`);
    console.log(`❌ Erros: ${errors}`);
    
    // Verificar total no banco
    const totalMedications = await prisma.medication.count();
    const totalPrices = await prisma.price.count();
    
    console.log(`\n🗄️ BANCO ATUALIZADO:`);
    console.log(`💊 Total de medicamentos: ${totalMedications}`);
    console.log(`💰 Total de preços: ${totalPrices}`);
    
  } catch (error) {
    console.error('❌ Erro geral na ingestão:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Função para buscar dados do medicamento (simulada por enquanto)
async function fetchMedicationFromRay(nome, principioAtivo) {
  // Por enquanto, vamos simular dados baseados na API Ray
  // TODO: Implementar chamada real para https://api.plataformaray.com.br/medicamentos/{id}/full-info/
  
  const code = nome.toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Categorizar medicamento baseado no princípio ativo
  const category = categorizeMedication(principioAtivo);
  
  return {
    code,
    name: nome,
    activeIngredient: principioAtivo,
    category,
    // Dados que viriam da API Ray
    rayData: {
      fabricante: 'Diversos',
      registro: 'ANVISA',
      concentracao: extractConcentration(nome),
    }
  };
}

// Função para categorizar medicamentos
function categorizeMedication(principioAtivo) {
  const categories = {
    'Paracetamol': 'Analgésico',
    'Dipirona': 'Analgésico',
    'Ibuprofeno': 'Anti-inflamatório',
    'Amoxicilina': 'Antibiótico',
    'Losartana': 'Anti-hipertensivo',
    'Bevacizumabe': 'Oncológico',
    'Adalimumabe': 'Imunobiológico',
    'Rituximabe': 'Oncológico',
    'Trastuzumabe': 'Oncológico',
    'Infliximabe': 'Imunobiológico',
    'Tocilizumabe': 'Imunobiológico',
    'Everolimo': 'Imunossupressor',
    'Bortezomibe': 'Oncológico',
    'Acetato de Abiraterona': 'Hormônio Antineoplásico',
    'Enzalutamida': 'Hormônio Antineoplásico',
    'Remdesivir': 'Antiviral',
  };
  
  // Buscar categoria por princípio ativo
  for (const [key, cat] of Object.entries(categories)) {
    if (principioAtivo.includes(key)) {
      return cat;
    }
  }
  
  // Categorização por padrões
  if (principioAtivo.includes('mabe') || principioAtivo.includes('umabe')) {
    return 'Imunobiológico';
  }
  if (principioAtivo.includes('tinibe') || principioAtivo.includes('nibe')) {
    return 'Oncológico';
  }
  if (principioAtivo.includes('Interferon')) {
    return 'Imunobiológico';
  }
  
  return 'Especialidade Farmacêutica';
}

// Extrair concentração do nome
function extractConcentration(nome) {
  const match = nome.match(/(\d+(?:,\d+)?(?:\.\d+)?)\s*(mg|mcg|mL|UI)/i);
  return match ? match[0] : null;
}

// Criar preços simulados realistas
async function createSimulatedPrices(prisma, medicationId, medicamentoData) {
  const labs = await prisma.lab.findMany();
  
  // Definir faixa de preços baseada na categoria
  const priceRanges = {
    'Oncológico': { min: 500, max: 15000 },
    'Imunobiológico': { min: 800, max: 8000 },
    'Especialidade Farmacêutica': { min: 100, max: 2000 },
    'Analgésico': { min: 5, max: 50 },
    'Antibiótico': { min: 15, max: 150 },
    'Anti-hipertensivo': { min: 10, max: 80 },
    'Anti-inflamatório': { min: 8, max: 60 },
  };
  
  const range = priceRanges[medicamentoData.category] || { min: 20, max: 200 };
  
  // Criar preços para últimos 60 dias
  const prices = [];
  const basePrice = Math.random() * (range.max - range.min) + range.min;
  
  for (let i = 60; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Selecionar laboratório aleatório
    const lab = labs[Math.floor(Math.random() * labs.length)];
    
    // Variação de ±20% do preço base
    const variation = (Math.random() - 0.5) * 0.4;
    const price = basePrice * (1 + variation);
    
    prices.push({
      medicationId,
      labId: lab?.id || null,
      value: new Prisma.Decimal(Math.round(price * 100) / 100),
      capturedAt: date,
      source: 'RAY_API_SIMULATED',
      meta: JSON.stringify({
        basePrice,
        variation,
        category: medicamentoData.category,
        simulated: true,
      }),
    });
  }
  
  // Inserir preços em lotes
  const batchSize = 20;
  for (let i = 0; i < prices.length; i += batchSize) {
    const batch = prices.slice(i, i + batchSize);
    await prisma.price.createMany({
      data: batch,
    });
  }
}

// Executar ingestão
ingestRayMedications();
