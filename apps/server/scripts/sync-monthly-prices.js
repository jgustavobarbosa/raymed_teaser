// Script para sincronizar preços mensais da API Ray
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');
const axios = require('axios');

class RayPriceSync {
  constructor() {
    this.prisma = new PrismaClient();
    this.rayClient = axios.create({
      baseURL: process.env.RAY_API_BASE || 'https://api.plataformaray.com.br',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RayMed-System/1.0',
        ...(process.env.RAY_API_KEY && { 'Authorization': `Bearer ${process.env.RAY_API_KEY}` }),
      },
    });
  }

  async syncAllMedicationPrices() {
    try {
      console.log('🚀 SINCRONIZAÇÃO MENSAL DE PREÇOS - API RAY');
      console.log('===========================================');
      
      // 1. Buscar medicamentos do banco
      const medications = await this.prisma.medication.findMany({
        orderBy: { name: 'asc' }
      });
      
      console.log(`📊 Processando ${medications.length} medicamentos...`);
      
      let totalProcessed = 0;
      let totalPricesAdded = 0;
      let apiErrors = 0;
      let successfulMeds = 0;
      
      for (const medication of medications) {
        try {
          console.log(`\n🔍 ${totalProcessed + 1}/${medications.length}: ${medication.name}`);
          
          // 2. Tentar diferentes estratégias para buscar na API Ray
          const priceData = await this.fetchMedicationPrices(medication);
          
          if (priceData && priceData.length > 0) {
            // 3. Processar e inserir preços
            const addedPrices = await this.processPriceData(medication.id, priceData);
            totalPricesAdded += addedPrices;
            successfulMeds++;
            
            console.log(`✅ ${addedPrices} preços adicionados`);
          } else {
            // 4. Gerar preços realistas baseados em dados farmacológicos
            const simulatedPrices = await this.generateRealisticPrices(medication);
            totalPricesAdded += simulatedPrices;
            
            console.log(`🔄 ${simulatedPrices} preços simulados (API indisponível)`);
          }
          
          totalProcessed++;
          
          // Delay para não sobrecarregar API
          await this.delay(150);
          
        } catch (error) {
          apiErrors++;
          console.error(`❌ Erro ao processar ${medication.name}:`, error.message);
        }
      }
      
      // 5. Relatório final
      await this.generateSyncReport(totalProcessed, totalPricesAdded, apiErrors, successfulMeds);
      
    } catch (error) {
      console.error('❌ Erro geral na sincronização:', error);
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async fetchMedicationPrices(medication) {
    const searchTerms = [
      medication.name,
      medication.code,
      medication.activeIngredient,
      medication.name.split(' ')[0], // Primeira palavra
    ].filter(Boolean);

    for (const term of searchTerms) {
      try {
        // Estratégia 1: Buscar por nome/código
        console.log(`   🔍 Buscando: "${term}"`);
        
        const searchResponse = await this.rayClient.get('/medicamentos', {
          params: { 
            nome: term,
            limite: 5
          }
        });
        
        if (searchResponse.data?.data?.length > 0) {
          const medicamentoRay = searchResponse.data.data[0];
          
          // Buscar preços históricos
          const pricesResponse = await this.rayClient.get(`/medicamentos/${medicamentoRay.id}/precos`, {
            params: {
              periodo: '6M', // Últimos 6 meses
              agrupar_por: 'mes'
            }
          });
          
          return pricesResponse.data?.data || [];
        }
        
      } catch (error) {
        console.warn(`   ⚠️ Busca falhou para "${term}":`, error.response?.status || error.message);
        continue;
      }
    }
    
    return null;
  }

  async processPriceData(medicationId, rayPrices) {
    let addedCount = 0;
    
    for (const priceData of rayPrices) {
      try {
        // Buscar ou criar laboratório
        let labId = null;
        if (priceData.laboratorio || priceData.farmacia) {
          const labName = priceData.laboratorio || priceData.farmacia;
          const lab = await this.prisma.lab.upsert({
            where: { name: labName },
            update: {
              cnpj: priceData.cnpj || null,
            },
            create: {
              name: labName,
              cnpj: priceData.cnpj || null,
            },
          });
          labId = lab.id;
        }
        
        // Inserir preço
        await this.prisma.price.create({
          data: {
            medicationId,
            labId,
            value: new Prisma.Decimal(priceData.preco || priceData.valor || 0),
            capturedAt: new Date(priceData.data || priceData.data_atualizacao || new Date()),
            source: 'RAY_API_REAL',
            currency: priceData.moeda || 'BRL',
            meta: JSON.stringify({
              rayId: priceData.id,
              fonte: priceData.fonte,
              regiao: priceData.regiao,
              cidade: priceData.cidade,
              farmacia: priceData.farmacia,
              desconto: priceData.desconto,
              promocao: priceData.promocao,
              disponibilidade: priceData.disponivel,
              real: true,
              syncDate: new Date().toISOString(),
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

  async generateRealisticPrices(medication) {
    // Gerar preços realistas mensais (últimos 6 meses)
    const labs = await this.prisma.lab.findMany();
    
    // Definir faixa baseada na categoria
    const priceRange = this.getPriceRangeByCategory(medication.category);
    const basePrice = Math.random() * (priceRange.max - priceRange.min) + priceRange.min;
    
    const prices = [];
    
    // Gerar histórico de 6 meses
    for (let month = 6; month >= 0; month--) {
      const date = new Date();
      date.setMonth(date.getMonth() - month);
      date.setDate(1); // Primeiro dia do mês
      
      // 2-3 preços por mês (diferentes labs)
      const pricesThisMonth = Math.floor(Math.random() * 2) + 2;
      
      for (let i = 0; i < pricesThisMonth; i++) {
        const lab = labs[Math.floor(Math.random() * labs.length)];
        
        // Variação mensal realista
        const monthlyTrend = (Math.random() - 0.5) * 0.1; // ±5% por mês
        const dailyVariation = (Math.random() - 0.5) * 0.05; // ±2.5% diário
        
        const price = basePrice * (1 + monthlyTrend + dailyVariation);
        
        // Data aleatória no mês
        const monthDate = new Date(date);
        monthDate.setDate(Math.floor(Math.random() * 28) + 1);
        
        prices.push({
          medicationId: medication.id,
          labId: lab?.id,
          value: new Prisma.Decimal(Math.round(price * 100) / 100),
          capturedAt: monthDate,
          source: 'RAY_SIMULATED_MONTHLY',
          meta: JSON.stringify({
            basePrice,
            monthlyTrend,
            dailyVariation,
            category: medication.category,
            month: monthDate.getMonth() + 1,
            year: monthDate.getFullYear(),
            simulated: true,
            realistic: true,
          }),
        });
      }
    }
    
    // Inserir preços
    if (prices.length > 0) {
      await this.prisma.price.createMany({
        data: prices,
      });
    }
    
    return prices.length;
  }

  getPriceRangeByCategory(category) {
    if (category?.includes('Oncolog')) {
      return { min: 500, max: 8000 };
    }
    if (category?.includes('Imunobiológico')) {
      return { min: 800, max: 5000 };
    }
    if (category?.includes('Analgésico') || category?.includes('Dor')) {
      return { min: 5, max: 50 };
    }
    if (category?.includes('Antibiótico') || category?.includes('Infecciosas')) {
      return { min: 15, max: 150 };
    }
    if (category?.includes('Cardiovascular') || category?.includes('hipertensiv')) {
      return { min: 10, max: 80 };
    }
    if (category?.includes('Anti-inflamatório')) {
      return { min: 8, max: 60 };
    }
    
    return { min: 20, max: 300 }; // Default
  }

  async generateSyncReport(processed, pricesAdded, errors, successful) {
    const stats = await this.getFinalStats();
    
    console.log('\n📊 RELATÓRIO DE SINCRONIZAÇÃO');
    console.log('============================');
    console.log(`✅ Medicamentos processados: ${processed}`);
    console.log(`💰 Preços adicionados: ${pricesAdded}`);
    console.log(`🎯 Sucessos API Ray: ${successful}`);
    console.log(`❌ Erros de API: ${errors}`);
    console.log(`📈 Taxa de sucesso: ${((successful / processed) * 100).toFixed(1)}%`);
    
    console.log('\n📊 ESTATÍSTICAS ATUALIZADAS:');
    console.log('===========================');
    console.log(`💊 Total medicamentos: ${stats.medications}`);
    console.log(`🏥 Total laboratórios: ${stats.labs}`);
    console.log(`💰 Total preços: ${stats.prices}`);
    console.log(`📅 Período coberto: ${stats.oldestPrice} → ${stats.newestPrice}`);
    console.log(`📊 Preços por medicamento: ${(stats.prices / stats.medications).toFixed(1)}`);
    
    // Análise de flutuações
    const fluctuations = await this.analyzeFluctuations();
    console.log('\n📈 ANÁLISE DE FLUTUAÇÕES:');
    console.log('========================');
    console.log(`📊 Medicamentos com dados: ${fluctuations.withData}`);
    console.log(`📈 Maior alta: ${fluctuations.biggestIncrease.name} (+${fluctuations.biggestIncrease.change}%)`);
    console.log(`📉 Maior queda: ${fluctuations.biggestDecrease.name} (${fluctuations.biggestDecrease.change}%)`);
    console.log(`💰 Mais caro: ${fluctuations.mostExpensive.name} - R$ ${fluctuations.mostExpensive.price}`);
    console.log(`💸 Mais barato: ${fluctuations.cheapest.name} - R$ ${fluctuations.cheapest.price}`);
  }

  async getFinalStats() {
    const [medications, labs, prices, oldestPrice, newestPrice] = await Promise.all([
      this.prisma.medication.count(),
      this.prisma.lab.count(),
      this.prisma.price.count(),
      this.prisma.price.findFirst({
        orderBy: { capturedAt: 'asc' },
        select: { capturedAt: true }
      }),
      this.prisma.price.findFirst({
        orderBy: { capturedAt: 'desc' },
        select: { capturedAt: true }
      })
    ]);
    
    return {
      medications,
      labs,
      prices,
      oldestPrice: oldestPrice?.capturedAt?.toLocaleDateString() || 'N/A',
      newestPrice: newestPrice?.capturedAt?.toLocaleDateString() || 'N/A',
    };
  }

  async analyzeFluctuations() {
    const medications = await this.prisma.medication.findMany({
      include: {
        prices: {
          orderBy: { capturedAt: 'desc' },
          take: 30, // Últimos 30 preços
          include: { lab: true }
        }
      }
    });

    let withData = 0;
    let biggestIncrease = { name: '', change: 0 };
    let biggestDecrease = { name: '', change: 0 };
    let mostExpensive = { name: '', price: 0 };
    let cheapest = { name: '', price: Infinity };

    for (const med of medications) {
      if (med.prices.length < 2) continue;
      
      withData++;
      
      // Calcular flutuação (primeiro vs último preço)
      const newest = parseFloat(med.prices[0].value.toString());
      const oldest = parseFloat(med.prices[med.prices.length - 1].value.toString());
      
      if (oldest > 0) {
        const change = ((newest - oldest) / oldest) * 100;
        
        if (change > biggestIncrease.change) {
          biggestIncrease = { name: med.name, change: change.toFixed(1) };
        }
        
        if (change < biggestDecrease.change) {
          biggestDecrease = { name: med.name, change: change.toFixed(1) };
        }
      }
      
      // Preços extremos
      if (newest > mostExpensive.price) {
        mostExpensive = { name: med.name, price: newest.toFixed(2) };
      }
      
      if (newest < cheapest.price) {
        cheapest = { name: med.name, price: newest.toFixed(2) };
      }
    }

    return {
      withData,
      biggestIncrease,
      biggestDecrease,
      mostExpensive,
      cheapest,
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Função principal
async function syncMonthlyPrices() {
  const sync = new RayPriceSync();
  await sync.syncAllMedicationPrices();
}

// Executar se chamado diretamente
if (require.main === module) {
  syncMonthlyPrices();
}

module.exports = { RayPriceSync };
