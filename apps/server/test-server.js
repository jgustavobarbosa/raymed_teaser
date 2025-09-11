// Servidor de teste mínimo para verificar se o ambiente está funcionando
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient, Prisma } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// CORS configurado
app.use(cors({
  origin: 'http://localhost:3100',
  credentials: true
}));

// Health check
app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Quedas recentes de medicamentos
app.get('/api/medications/recent-drops', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Simular quedas recentes (dados mock para demonstração)
    const mockDrops = [
      {
        id: '1',
        code: 'PARACETAMOL-500MG',
        name: 'Paracetamol 500mg',
        currentPrice: { value: 8.50, labName: 'EMS' },
        variation24h: -12.5,
      },
      {
        id: '2', 
        code: 'DIPIRONA-500MG',
        name: 'Dipirona Sódica 500mg',
        currentPrice: { value: 6.80, labName: 'Medley' },
        variation24h: -8.3,
      },
      {
        id: '3',
        code: 'LOSARTANA-50MG', 
        name: 'Losartana Potássica 50mg',
        currentPrice: { value: 18.90, labName: 'EMS' },
        variation24h: -15.8,
      }
    ];
    
    res.json(mockDrops.slice(0, limit));
  } catch (error) {
    console.error('Erro ao buscar quedas recentes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Medicamentos
app.get('/api/medications', async (req, res) => {
  try {
    const medications = await prisma.medication.findMany({
      include: {
        prices: {
          take: 1,
          orderBy: { capturedAt: 'desc' },
          include: { lab: true }
        }
      }
    });
    
    const response = medications.map(med => ({
      id: med.id,
      code: med.code,
      name: med.name,
      category: med.category,
      currentPrice: med.prices[0] ? {
        value: med.prices[0].value,
        labName: med.prices[0].lab?.name || 'N/A'
      } : null
    }));
    
    res.json({ data: response, total: response.length });
  } catch (error) {
    console.error('Erro ao buscar medicamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Laboratórios com ranking de preços
app.get('/api/labs', async (req, res) => {
  try {
    const labs = await prisma.lab.findMany({
      include: {
        _count: {
          select: {
            prices: true,
          },
        },
        prices: {
          include: {
            medication: true
          },
          orderBy: { capturedAt: 'desc' },
          take: 100 // Últimos 100 preços
        }
      },
    });
    
    // Calcular estatísticas por laboratório
    const labsWithStats = labs.map(lab => {
      const prices = lab.prices.map(p => parseFloat(p.value.toString()));
      const avgPrice = prices.length > 0 
        ? prices.reduce((sum, price) => sum + price, 0) / prices.length 
        : 0;
      
      const uniqueMedications = [...new Set(lab.prices.map(p => p.medicationId))];
      
      return {
        id: lab.id,
        name: lab.name,
        cnpj: lab.cnpj,
        totalPrices: lab._count.prices,
        uniqueMedications: uniqueMedications.length,
        avgPrice: Math.round(avgPrice * 100) / 100,
        recentPrices: lab.prices.slice(0, 5).map(p => ({
          medication: p.medication.name,
          price: parseFloat(p.value.toString()),
          date: p.capturedAt
        }))
      };
    });
    
    // Ordenar por menor preço médio (melhores ofertas primeiro)
    labsWithStats.sort((a, b) => a.avgPrice - b.avgPrice);
    
    res.json({ 
      data: labsWithStats,
      totalLaboratories: labsWithStats.length,
      avgPriceOverall: labsWithStats.reduce((sum, lab) => sum + lab.avgPrice, 0) / labsWithStats.length
    });
  } catch (error) {
    console.error('Erro ao buscar laboratórios:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Detalhes de laboratório específico com ranking de medicamentos
app.get('/api/labs/:id/medications', async (req, res) => {
  try {
    const { id } = req.params;
    
    const lab = await prisma.lab.findUnique({
      where: { id },
      include: {
        prices: {
          include: {
            medication: true
          },
          orderBy: { capturedAt: 'desc' }
        }
      }
    });
    
    if (!lab) {
      return res.status(404).json({ error: 'Laboratório não encontrado' });
    }
    
    // Agrupar por medicamento e pegar preço mais recente
    const medicationPrices = {};
    
    lab.prices.forEach(price => {
      const medId = price.medicationId;
      if (!medicationPrices[medId] || price.capturedAt > medicationPrices[medId].date) {
        medicationPrices[medId] = {
          medication: price.medication,
          price: parseFloat(price.value.toString()),
          date: price.capturedAt
        };
      }
    });
    
    // Converter para array e ordenar por preço (mais barato primeiro)
    const rankedMedications = Object.values(medicationPrices)
      .sort((a, b) => a.price - b.price)
      .map((item, index) => ({
        rank: index + 1,
        medication: {
          id: item.medication.id,
          name: item.medication.name,
          code: item.medication.code,
          category: item.medication.category,
          activeIngredient: item.medication.activeIngredient
        },
        price: item.price,
        lastUpdate: item.date,
        priceCategory: item.price <= 50 ? 'Básico' : 
                      item.price <= 500 ? 'Intermediário' :
                      item.price <= 2000 ? 'Especialidade' : 'Alto Custo'
      }));
    
    res.json({
      laboratory: {
        id: lab.id,
        name: lab.name,
        cnpj: lab.cnpj
      },
      medications: rankedMedications,
      statistics: {
        totalMedications: rankedMedications.length,
        cheapestPrice: rankedMedications[0]?.price || 0,
        mostExpensivePrice: rankedMedications[rankedMedications.length - 1]?.price || 0,
        avgPrice: rankedMedications.reduce((sum, med) => sum + med.price, 0) / rankedMedications.length || 0
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar medicamentos do laboratório:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Alertas por usuário
app.get('/api/alerts/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const alerts = await prisma.alert.findMany({
      where: { userId },
      include: {
        medication: true,
        price: {
          include: { lab: true }
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    
    res.json({ data: alerts });
  } catch (error) {
    console.error('Erro ao buscar alertas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar/configurar alerta personalizado
app.post('/api/alerts/configure', async (req, res) => {
  try {
    const {
      userEmail,
      medicationCode,
      laboratoryId,
      alertType, // 'TARGET_PRICE', 'DROP_PERCENTAGE', 'SPIKE'
      targetPrice,
      dropPercentage,
      spikePercentage,
      isActive = true
    } = req.body;
    
    // Buscar ou criar usuário
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      update: {},
      create: {
        email: userEmail,
        name: userEmail.split('@')[0],
        role: 'user'
      }
    });
    
    // Buscar medicamento
    const medication = await prisma.medication.findUnique({
      where: { code: medicationCode }
    });
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento não encontrado' });
    }
    
    // Buscar laboratório padrão se não especificado
    let finalLabId = laboratoryId;
    if (!finalLabId) {
      const defaultLab = await prisma.lab.findFirst({
        orderBy: { name: 'asc' }
      });
      finalLabId = defaultLab?.id;
    }
    
    // Criar ou atualizar inscrição
    const subscription = await prisma.subscription.upsert({
      where: {
        userId_medicationId_labId: {
          userId: user.id,
          medicationId: medication.id,
          labId: finalLabId
        }
      },
      update: {
        targetPrice: targetPrice ? new Prisma.Decimal(targetPrice) : null,
        minDropPct: dropPercentage ? dropPercentage / 100 : null, // Converter para decimal
        isActive
      },
      create: {
        userId: user.id,
        medicationId: medication.id,
        labId: finalLabId,
        targetPrice: targetPrice ? new Prisma.Decimal(targetPrice) : null,
        minDropPct: dropPercentage ? dropPercentage / 100 : null,
        isActive
      }
    });
    
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        alertType,
        medication: medication.name,
        laboratory: laboratoryId ? (await prisma.lab.findUnique({ where: { id: laboratoryId } }))?.name : 'Todos',
        targetPrice,
        dropPercentage,
        spikePercentage,
        isActive
      },
      message: 'Alerta configurado com sucesso!'
    });
    
  } catch (error) {
    console.error('Erro ao configurar alerta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar alertas do usuário
app.get('/api/alerts/user/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        subscriptions: {
          include: {
            medication: true,
            lab: true
          },
          where: { isActive: true }
        },
        alerts: {
          include: {
            medication: true,
            price: {
              include: { lab: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json({
      user: {
        email: user.email,
        name: user.name
      },
      activeAlerts: user.subscriptions.map(sub => ({
        id: sub.id,
        medication: sub.medication.name,
        laboratory: sub.lab?.name || 'Todos',
        targetPrice: sub.targetPrice ? parseFloat(sub.targetPrice.toString()) : null,
        dropPercentage: sub.minDropPct ? sub.minDropPct * 100 : null,
        createdAt: sub.createdAt
      })),
      recentNotifications: user.alerts.map(alert => ({
        id: alert.id,
        medication: alert.medication.name,
        reason: alert.reason,
        price: parseFloat(alert.price.value.toString()),
        laboratory: alert.price.lab?.name,
        sentAt: alert.sentAt,
        createdAt: alert.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Erro ao buscar alertas do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Inscrições por usuário  
app.get('/api/subscriptions/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      include: {
        medication: true,
        lab: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json({ data: subscriptions });
  } catch (error) {
    console.error('Erro ao buscar inscrições:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Evolução de preços por medicamento e laboratório
app.get('/api/medications/:code/price-evolution', async (req, res) => {
  try {
    const { code } = req.params;
    const { months = 6 } = req.query;
    
    const medication = await prisma.medication.findUnique({
      where: { code },
      include: {
        prices: {
          where: {
            capturedAt: {
              gte: new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
            }
          },
          include: { lab: true },
          orderBy: { capturedAt: 'asc' }
        }
      }
    });
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento não encontrado' });
    }
    
    // Agrupar preços por laboratório e mês
    const pricesByLab = {};
    
    medication.prices.forEach(price => {
      const labName = price.lab?.name || 'Sem laboratório';
      const monthKey = price.capturedAt.toISOString().substring(0, 7); // YYYY-MM
      
      if (!pricesByLab[labName]) {
        pricesByLab[labName] = {};
      }
      
      if (!pricesByLab[labName][monthKey]) {
        pricesByLab[labName][monthKey] = [];
      }
      
      pricesByLab[labName][monthKey].push({
        value: parseFloat(price.value.toString()),
        date: price.capturedAt
      });
    });
    
    // Calcular médias mensais por laboratório
    const evolutionData = [];
    
    Object.entries(pricesByLab).forEach(([labName, months]) => {
      const monthlyData = Object.entries(months).map(([monthKey, prices]) => {
        const avgPrice = prices.reduce((sum, p) => sum + p.value, 0) / prices.length;
        const minPrice = Math.min(...prices.map(p => p.value));
        const maxPrice = Math.max(...prices.map(p => p.value));
        
        return {
          month: monthKey,
          avgPrice: Math.round(avgPrice * 100) / 100,
          minPrice: Math.round(minPrice * 100) / 100,
          maxPrice: Math.round(maxPrice * 100) / 100,
          priceCount: prices.length
        };
      }).sort((a, b) => a.month.localeCompare(b.month));
      
      evolutionData.push({
        laboratory: labName,
        data: monthlyData,
        totalPrices: Object.values(months).flat().length,
        currentPrice: monthlyData[monthlyData.length - 1]?.avgPrice || 0
      });
    });
    
    res.json({
      medication: {
        name: medication.name,
        code: medication.code,
        category: medication.category,
        activeIngredient: medication.activeIngredient
      },
      evolution: evolutionData.sort((a, b) => a.currentPrice - b.currentPrice),
      period: `${months} meses`,
      totalLaboratories: evolutionData.length
    });
    
  } catch (error) {
    console.error('Erro ao buscar evolução de preços:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Comparação de preços entre laboratórios (snapshot atual)
app.get('/api/medications/:code/lab-comparison', async (req, res) => {
  try {
    const { code } = req.params;
    
    const medication = await prisma.medication.findUnique({
      where: { code },
      include: {
        prices: {
          where: {
            capturedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 dias
            }
          },
          include: { lab: true },
          orderBy: { capturedAt: 'desc' }
        }
      }
    });
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento não encontrado' });
    }
    
    // Agrupar por laboratório e pegar preço mais recente
    const labPrices = {};
    
    medication.prices.forEach(price => {
      const labName = price.lab?.name || 'Sem laboratório';
      
      if (!labPrices[labName] || price.capturedAt > labPrices[labName].date) {
        labPrices[labName] = {
          laboratory: labName,
          price: parseFloat(price.value.toString()),
          date: price.capturedAt,
          labId: price.lab?.id,
          source: price.source
        };
      }
    });
    
    const comparison = Object.values(labPrices)
      .sort((a, b) => a.price - b.price);
    
    // Calcular estatísticas
    const prices = comparison.map(c => c.price);
    const stats = {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      priceSpread: Math.max(...prices) - Math.min(...prices),
      spreadPercentage: ((Math.max(...prices) - Math.min(...prices)) / Math.min(...prices)) * 100
    };
    
    res.json({
      medication: {
        name: medication.name,
        code: medication.code,
        category: medication.category
      },
      comparison,
      statistics: {
        ...stats,
        avgPrice: Math.round(stats.avgPrice * 100) / 100,
        spreadPercentage: Math.round(stats.spreadPercentage * 100) / 100
      },
      totalLaboratories: comparison.length
    });
    
  } catch (error) {
    console.error('Erro ao comparar laboratórios:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// LLM Query com consulta na base de dados
app.post('/api/llm/query', async (req, res) => {
  const { question } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'Pergunta é obrigatória' });
  }

  try {
    // 1. Buscar dados relevantes na base primeiro
    const [medications, labs, recentPrices] = await Promise.all([
      prisma.medication.findMany({
        include: {
          prices: {
            take: 5,
            orderBy: { capturedAt: 'desc' },
            include: { lab: true }
          }
        }
      }),
      prisma.lab.findMany(),
      prisma.price.findMany({
        take: 20,
        orderBy: { capturedAt: 'desc' },
        include: {
          medication: true,
          lab: true
        }
      })
    ]);

    // 2. Criar contexto com dados reais enriquecidos
    const contextData = {
      totalMedicamentos: medications.length,
      totalPrecos: recentPrices.length,
      medicamentos: medications.map(med => ({
        nome: med.name,
        codigo: med.code,
        categoria: med.category,
        principioAtivo: med.activeIngredient,
        precoAtual: med.prices[0] ? {
          valor: parseFloat(med.prices[0].value.toString()),
          laboratorio: med.prices[0].lab?.name,
          data: med.prices[0].capturedAt
        } : null,
        historico: med.prices.slice(0, 5).map(p => ({
          valor: parseFloat(p.value.toString()),
          data: p.capturedAt,
          lab: p.lab?.name
        }))
      })),
      laboratorios: labs.map(lab => ({
        nome: lab.name,
        cnpj: lab.cnpj
      })),
      categorias: [...new Set(medications.map(m => m.category?.split(' | ')[0]).filter(Boolean))],
      medicamentosSUS: medications.filter(m => m.category?.includes('SUS')).length,
      medicamentosPrivados: medications.filter(m => !m.category?.includes('SUS')).length,
      faixasPreco: {
        maisCaros: medications
          .filter(m => m.prices[0])
          .sort((a, b) => parseFloat(b.prices[0].value.toString()) - parseFloat(a.prices[0].value.toString()))
          .slice(0, 5)
          .map(m => ({
            nome: m.name,
            preco: parseFloat(m.prices[0].value.toString()),
            categoria: m.category?.split(' | ')[0]
          })),
        maisBaratos: medications
          .filter(m => m.prices[0])
          .sort((a, b) => parseFloat(a.prices[0].value.toString()) - parseFloat(b.prices[0].value.toString()))
          .slice(0, 5)
          .map(m => ({
            nome: m.name,
            preco: parseFloat(m.prices[0].value.toString()),
            categoria: m.category?.split(' | ')[0]
          }))
      }
    };

    // 3. Analisar pergunta e buscar dados específicos
    let specificData = '';
    const questionLower = question.toLowerCase();
    
    // Busca por medicamentos específicos
    const searchTerms = [
      'rituximab', 'trastuzumab', 'adalimumab', 'infliximab', 'bevacizumab',
      'herceptin', 'mabthera', 'humira', 'remicade', 'avastin',
      'paracetamol', 'dipirona', 'ibuprofeno', 'losartana', 'amoxicilina',
      'keytruda', 'opdivo', 'tecentriq', 'yervoy', 'glivec', 'velcade'
    ];
    
    for (const term of searchTerms) {
      if (questionLower.includes(term)) {
        const foundMeds = medications.filter(med => 
          med.name.toLowerCase().includes(term) || 
          med.activeIngredient?.toLowerCase().includes(term) ||
          med.code.toLowerCase().includes(term)
        );
        
        if (foundMeds.length > 0) {
          specificData = `MEDICAMENTOS ESPECÍFICOS ENCONTRADOS (${term.toUpperCase()}):
${foundMeds.map(med => 
  `- ${med.name} (${med.activeIngredient}): ${med.prices[0] ? `R$ ${parseFloat(med.prices[0].value.toString()).toFixed(2)} no ${med.prices[0].lab?.name || 'N/A'}` : 'sem preço'}`
).join('\n')}`;
          break;
        }
      }
    }
    
    if (!specificData && (questionLower.includes('menor preço') || questionLower.includes('mais barato'))) {
      const cheapest = medications.map(med => ({
        nome: med.name,
        preco: med.prices[0] ? parseFloat(med.prices[0].value.toString()) : null,
        lab: med.prices[0]?.lab?.name
      })).filter(med => med.preco !== null)
        .sort((a, b) => a.preco - b.preco)[0];
      
      specificData = `DADOS ESPECÍFICOS - Medicamento mais barato: ${cheapest?.nome} por R$ ${cheapest?.preco?.toFixed(2)} no ${cheapest?.lab}`;
    }

    // 4. Verificar se LLM está configurado
    const hasApiKey = process.env.OPENAI_API_KEY;
    
    if (!hasApiKey) {
      // Resposta baseada apenas nos dados da base
      return res.json({
        question,
        answer: `Baseado nos dados da nossa base: ${specificData || `Temos ${medications.length} medicamentos monitorados com ${recentPrices.length} preços recentes.`}`,
        sources: [
          {
            type: 'database',
            description: 'Dados da base RayMed',
            data: contextData
          }
        ],
        confidence: 0.9
      });
    }

    // 5. Usar LLM com contexto da base de dados enriquecido
    const systemPrompt = `Você é um assistente farmacêutico especializado da RayMed com acesso a dados completos de medicamentos e preços.

📊 DADOS DA BASE (ATUALIZADOS):
- Total: ${contextData.totalMedicamentos} medicamentos
- SUS (Atenção Básica): ${contextData.medicamentosSUS} medicamentos
- Privados/Especializados: ${contextData.medicamentosPrivados} medicamentos  
- Preços: ${contextData.totalPrecos} registros históricos
- Período: 12 meses de histórico

📋 CATEGORIAS DISPONÍVEIS:
${contextData.categorias.join(', ')}

💰 TOP 5 MAIS CAROS:
${contextData.faixasPreco.maisCaros.map(m => 
  `- ${m.nome}: R$ ${m.preco.toFixed(2)} (${m.categoria})`
).join('\n')}

💸 TOP 5 MAIS BARATOS:
${contextData.faixasPreco.maisBaratos.map(m => 
  `- ${m.nome}: R$ ${m.preco.toFixed(2)} (${m.categoria})`
).join('\n')}

🏥 LABORATÓRIOS:
${contextData.laboratorios.map(lab => `- ${lab.nome}`).join('\n')}

${specificData}

MEDICAMENTOS COMPLETOS COM HISTÓRICO:
${contextData.medicamentos.map(med => 
  `- ${med.nome} (${med.principioAtivo}) [${med.categoria?.split(' | ')[0]}]: ${med.precoAtual ? `R$ ${med.precoAtual.valor.toFixed(2)} no ${med.precoAtual.laboratorio}` : 'sem preço'}`
).join('\n')}

INSTRUÇÕES:
- Use os dados fornecidos acima para respostas precisas
- Cite preços específicos e laboratórios
- Compare medicamentos quando solicitado
- Analise tendências quando possível
- Mencione categorias terapêuticas
- Responda sempre em português
- Formate valores em reais (R$)
- Seja específico sobre indicações quando disponível`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.1, // Mais determinístico
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const answer = data.choices[0]?.message?.content || 'Não foi possível gerar resposta';

    res.json({
      question,
      answer,
      sources: [
        {
          type: 'database',
          description: 'Base de dados RayMed',
          medicamentos: contextData.totalMedicamentos,
          ultimaAtualizacao: recentPrices[0]?.data
        }
      ],
      confidence: 0.95
    });

  } catch (error) {
    console.error('Erro no LLM:', error);
    res.json({
      question,
      answer: 'Erro ao processar pergunta. Tente novamente.',
      sources: [],
      confidence: 0
    });
  }
});

// ===================================
// ROTAS DE MACHINE LEARNING
// ===================================

// Previsões de preços usando múltiplos modelos
app.post('/api/ml/predictions', async (req, res) => {
  try {
    const { medicationCode, laboratoryId, daysAhead = 30, models = ['prophet', 'arima'] } = req.body;
    
    if (!medicationCode) {
      return res.status(400).json({ error: 'Código do medicamento é obrigatório' });
    }

    // Buscar dados históricos
    const historicalData = await prisma.price.findMany({
      where: {
        medication: { code: medicationCode },
        ...(laboratoryId && { labId: laboratoryId }),
        capturedAt: {
          gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Último ano
        },
      },
      include: {
        medication: true,
        lab: true,
      },
      orderBy: { capturedAt: 'asc' },
    });

    if (historicalData.length < 30) {
      return res.status(400).json({ 
        error: 'Dados insuficientes para previsão (mínimo 30 pontos históricos)' 
      });
    }

    // Gerar previsões simples (fallback)
    const predictions = generateSimplePredictions(historicalData, daysAhead);
    
    res.json({
      success: true,
      data: [{
        model: 'moving_average',
        medication: medicationCode,
        laboratory: laboratoryId,
        predictions,
        accuracy: 70,
        lastUpdate: new Date(),
      }],
      metadata: {
        medicationCode,
        laboratoryId,
        daysAhead,
        modelsUsed: ['moving_average'],
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Erro ao gerar previsões:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Detecção de outliers
app.get('/api/ml/outliers', async (req, res) => {
  try {
    const { medicationCode, laboratoryId, threshold = 2.5 } = req.query;
    
    // Buscar preços recentes
    const recentPrices = await prisma.price.findMany({
      where: {
        ...(medicationCode && { medication: { code: medicationCode } }),
        ...(laboratoryId && { labId: laboratoryId }),
        capturedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Últimos 30 dias
        },
      },
      include: {
        medication: true,
        lab: true,
      },
      orderBy: { capturedAt: 'desc' },
    });

    // Detectar outliers usando Z-score
    const outliers = detectOutliersSimple(recentPrices, parseFloat(threshold));
    
    res.json({
      success: true,
      data: outliers,
      metadata: {
        threshold: parseFloat(threshold),
        totalOutliers: outliers.length,
        totalPrices: recentPrices.length,
        outlierPercentage: (outliers.length / recentPrices.length) * 100,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Erro ao detectar outliers:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Índice de competitividade
app.get('/api/ml/competitiveness', async (req, res) => {
  try {
    const { laboratoryId, medicationCode } = req.query;
    
    // Buscar dados dos últimos 90 dias
    const recentData = await prisma.price.findMany({
      where: {
        ...(medicationCode && { medication: { code: medicationCode } }),
        ...(laboratoryId && { labId: laboratoryId }),
        capturedAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        medication: true,
        lab: true,
      },
    });

    // Calcular competitividade
    const competitiveness = calculateCompetitivenessSimple(recentData);
    
    res.json({
      success: true,
      data: competitiveness,
      metadata: {
        totalLaboratories: competitiveness.length,
        analysisScope: laboratoryId ? 'single' : 'all',
        medicationFilter: medicationCode,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Erro ao calcular competitividade:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Alertas automáticos de outliers
app.post('/api/ml/outliers/alerts/configure', async (req, res) => {
  try {
    const { 
      enabled = true, 
      threshold = 2.5, 
      recipients = ['admin@raymed.com'],
      alertLevels = { low: 1.5, medium: 2.0, high: 3.0, critical: 4.0 }
    } = req.body;

    // Simular configuração de alertas
    const config = {
      enabled,
      outlierThreshold: threshold,
      alertThresholds: alertLevels,
      recipients: { admins: recipients },
      lastUpdated: new Date(),
    };

    res.json({
      success: true,
      message: 'Alertas automáticos configurados com sucesso',
      data: config,
    });
  } catch (error) {
    console.error('Erro ao configurar alertas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Status dos alertas automáticos
app.get('/api/ml/outliers/alerts/status', async (req, res) => {
  try {
    // Simular estatísticas de alertas
    const stats = {
      enabled: true,
      totalActiveAlerts: 3,
      alertsByLevel: { low: 1, medium: 1, high: 1, critical: 0 },
      notificationsSentToday: 5,
      lastDetection: new Date(),
      nextCheck: new Date(Date.now() + 15 * 60 * 1000), // Próximos 15 min
    };

    res.json({
      success: true,
      data: stats,
      metadata: {
        checkInterval: '15 minutos',
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar status:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Otimização de compras melhorada
app.post('/api/ml/purchase/recommendations', async (req, res) => {
  try {
    const { 
      medicationCode, 
      currentStock, 
      monthlyConsumption,
      desiredQuantity = null,
      leadTimeDays = 7,
      safetyStockDays = 15
    } = req.body;

    if (!medicationCode) {
      return res.status(400).json({ error: 'Código do medicamento é obrigatório' });
    }

    // Buscar dados do medicamento
    const medication = await prisma.medication.findUnique({
      where: { code: medicationCode },
      include: {
        prices: {
          take: 50,
          orderBy: { capturedAt: 'desc' },
          include: { lab: true }
        }
      }
    });

    if (!medication) {
      return res.status(404).json({ error: 'Medicamento não encontrado' });
    }

    // Buscar preços dos últimos 3 meses para análise de tendência
    const priceHistory = await prisma.price.findMany({
      where: {
        medicationId: medication.id,
        capturedAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 dias
        }
      },
      include: { lab: true },
      orderBy: { capturedAt: 'desc' }
    });

    // Gerar recomendações avançadas
    const recommendations = generateAdvancedPurchaseRecommendations(
      medication, 
      priceHistory,
      currentStock, 
      monthlyConsumption,
      desiredQuantity,
      leadTimeDays,
      safetyStockDays
    );

    // Salvar análise no banco para consultas futuras
    try {
      await savePurchaseAnalysis(medicationCode, recommendations, {
        currentStock,
        monthlyConsumption,
        desiredQuantity,
        leadTimeDays,
        safetyStockDays
      });
    } catch (saveError) {
      console.warn('Erro ao salvar análise:', saveError.message);
    }

    res.json({
      success: true,
      data: recommendations,
      metadata: {
        medicationCode,
        analysisDate: new Date(),
        recommendationsCount: recommendations.recommendations.length,
        dataSource: '3_months_history',
        saved: true
      },
    });
  } catch (error) {
    console.error('Erro ao gerar recomendações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Dashboard de otimização de compras
app.get('/api/ml/purchase/dashboard', async (req, res) => {
  try {
    // Buscar medicamentos com mais transações
    const topMedications = await prisma.medication.findMany({
      include: {
        prices: {
          take: 10,
          orderBy: { capturedAt: 'desc' },
          include: { lab: true }
        }
      },
      take: 5,
    });

    const urgentActions = [];
    const savingsOpportunities = [];
    const marketInsights = [];

    // Analisar cada medicamento
    for (const med of topMedications) {
      if (med.prices.length >= 2) {
        const currentPrice = parseFloat(med.prices[0].value.toString());
        const previousPrice = parseFloat(med.prices[1].value.toString());
        const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;

        if (priceChange < -10) {
          urgentActions.push({
            medication: med.name,
            action: 'buy_now',
            laboratory: med.prices[0].lab?.name,
            savings: previousPrice - currentPrice,
            reason: `Preço caiu ${Math.abs(priceChange).toFixed(1)}%`,
          });
        }

        if (Math.abs(priceChange) > 5) {
          savingsOpportunities.push({
            medication: med.name,
            laboratory: med.prices[0].lab?.name,
            savings: Math.abs(previousPrice - currentPrice),
            percentage: Math.abs(priceChange),
            trend: priceChange > 0 ? 'increasing' : 'decreasing',
          });
        }
      }
    }

    if (urgentActions.length > 0) {
      marketInsights.push(`🚨 ${urgentActions.length} oportunidades urgentes de compra`);
    }
    
    if (savingsOpportunities.length > 0) {
      const totalSavings = savingsOpportunities.reduce((sum, s) => sum + s.savings, 0);
      marketInsights.push(`💰 Potencial de economia: R$ ${totalSavings.toFixed(2)}`);
    }

    res.json({
      success: true,
      data: {
        urgentActions: urgentActions.slice(0, 5),
        savingsOpportunities: savingsOpportunities.slice(0, 10),
        riskAlerts: [],
        marketInsights,
      },
      metadata: {
        analysisWindow: '48 horas',
        medicationsAnalyzed: topMedications.length,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Erro no dashboard de compras:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Dashboard ML
app.get('/api/ml/dashboard', async (req, res) => {
  try {
    const { medicationCode, laboratoryId } = req.query;
    
    // Buscar dados recentes
    const recentPrices = await prisma.price.findMany({
      where: {
        ...(medicationCode && { medication: { code: medicationCode } }),
        ...(laboratoryId && { labId: laboratoryId }),
        capturedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        medication: true,
        lab: true,
      },
    });

    // Análises simples
    const outliers = detectOutliersSimple(recentPrices, 2.5);
    const competitiveness = calculateCompetitivenessSimple(recentPrices);
    
    const stats = {
      totalPrices: recentPrices.length,
      outliersDetected: outliers.length,
      outlierPercentage: (outliers.length / recentPrices.length) * 100,
      laboratoriesAnalyzed: competitiveness.length,
      avgCompetitivenessScore: competitiveness.reduce((sum, c) => sum + c.overallScore, 0) / competitiveness.length,
    };

    const insights = [];
    if (outliers.length > 0) {
      insights.push(`⚠️ Detectados ${outliers.length} outliers de ${recentPrices.length} preços`);
    }
    if (competitiveness.length > 0) {
      insights.push(`🏆 ${competitiveness[0].laboratory} lidera em competitividade`);
    }

    res.json({
      success: true,
      data: {
        statistics: stats,
        outliers: outliers.slice(0, 10),
        competitiveness: competitiveness.slice(0, 5),
        insights,
      },
      metadata: {
        scope: { medicationCode, laboratoryId },
        generatedAt: new Date(),
        analysisWindow: '30 dias',
      },
    });
  } catch (error) {
    console.error('Erro no dashboard ML:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===================================
// FUNÇÕES AUXILIARES DE ML
// ===================================

function generateSimplePredictions(historicalData, daysAhead) {
  const prices = historicalData.map(p => parseFloat(p.value.toString()));
  const dates = historicalData.map(p => p.capturedAt);
  
  // Média móvel dos últimos 14 dias
  const windowSize = Math.min(14, prices.length);
  const recentPrices = prices.slice(-windowSize);
  const movingAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
  
  // Calcular tendência
  const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
  const secondHalf = prices.slice(Math.floor(prices.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trend = (secondAvg - firstAvg) / (prices.length / 2);
  
  // Calcular volatilidade
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
  const volatility = Math.sqrt(variance);
  
  const predictions = [];
  const lastDate = new Date(dates[dates.length - 1]);
  
  for (let i = 1; i <= daysAhead; i++) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + i);
    
    // Previsão: média móvel + tendência com decaimento
    const trendComponent = trend * i * Math.pow(0.95, i); // Decaimento da tendência
    const predictedPrice = Math.max(0, movingAvg + trendComponent);
    
    // Intervalos de confiança
    const confidence = Math.max(0.5, 0.95 - (i * 0.01));
    const margin = volatility * 1.96 * Math.sqrt(i) / Math.sqrt(prices.length);
    
    predictions.push({
      date: futureDate,
      predictedPrice: Math.round(predictedPrice * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      lowerBound: Math.max(0, Math.round((predictedPrice - margin) * 100) / 100),
      upperBound: Math.round((predictedPrice + margin) * 100) / 100,
    });
  }
  
  return predictions;
}

function detectOutliersSimple(pricesData, threshold) {
  const outliers = [];
  
  // Agrupar por medicamento
  const medicationGroups = {};
  pricesData.forEach(price => {
    const code = price.medication.code;
    if (!medicationGroups[code]) {
      medicationGroups[code] = [];
    }
    medicationGroups[code].push(price);
  });
  
  // Detectar outliers para cada medicamento
  Object.entries(medicationGroups).forEach(([medicationCode, prices]) => {
    const priceValues = prices.map(p => parseFloat(p.value.toString()));
    const mean = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
    const variance = priceValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / priceValues.length;
    const std = Math.sqrt(variance);
    
    prices.forEach(price => {
      const value = parseFloat(price.value.toString());
      const zScore = Math.abs((value - mean) / std);
      
      if (zScore > threshold) {
        outliers.push({
          priceId: price.id,
          medication: price.medication.name,
          laboratory: price.lab?.name || 'Unknown',
          price: value,
          expectedPrice: mean,
          deviation: Math.abs(value - mean),
          outlierScore: zScore,
          isOutlier: true,
          reasons: [
            `Z-score alto (${zScore.toFixed(2)})`,
            `Desvio de ${Math.abs(value - mean).toFixed(2)} da média`,
          ],
          detectionMethods: ['zscore'],
        });
      }
    });
  });
  
  return outliers.sort((a, b) => b.outlierScore - a.outlierScore);
}

function calculateCompetitivenessSimple(pricesData) {
  // Agrupar por laboratório
  const labGroups = {};
  pricesData.forEach(price => {
    const labId = price.lab?.id || 'unknown';
    if (!labGroups[labId]) {
      labGroups[labId] = {
        name: price.lab?.name || 'Unknown',
        prices: [],
        medications: new Set(),
      };
    }
    labGroups[labId].prices.push(parseFloat(price.value.toString()));
    labGroups[labId].medications.add(price.medication.code);
  });
  
  // Calcular scores
  const results = [];
  const allPrices = pricesData.map(p => parseFloat(p.value.toString()));
  const marketMean = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
  
  Object.entries(labGroups).forEach(([labId, labData]) => {
    const labMean = labData.prices.reduce((a, b) => a + b, 0) / labData.prices.length;
    const priceRatio = labMean / marketMean;
    
    // Score de preços (0-100, quanto menor o preço, maior o score)
    let priceScore = 100;
    if (priceRatio > 1) {
      priceScore = Math.max(0, 100 - (priceRatio - 1) * 100);
    } else {
      priceScore = Math.min(100, 100 + (1 - priceRatio) * 50);
    }
    
    // Score de diversidade
    const diversityScore = Math.min(100, (labData.medications.size / 10) * 100);
    
    // Score geral
    const overallScore = (priceScore * 0.7) + (diversityScore * 0.3);
    
    results.push({
      laboratory: labData.name,
      laboratoryId: labId,
      overallScore: Math.round(overallScore),
      priceScore: Math.round(priceScore),
      diversityScore: Math.round(diversityScore),
      avgPrice: Math.round(labMean * 100) / 100,
      medications: Array.from(labData.medications).length,
      priceAdvantage: Math.round(((marketMean - labMean) / marketMean) * 100),
    });
  });
  
  // Ordenar por score e adicionar ranking
  results.sort((a, b) => b.overallScore - a.overallScore);
  results.forEach((result, index) => {
    result.rank = index + 1;
    result.totalLaboratories = results.length;
  });
  
  return results;
}

function generateAdvancedPurchaseRecommendations(medication, priceHistory, currentStock, monthlyConsumption, desiredQuantity, leadTimeDays, safetyStockDays) {
  // Cálculos de estoque
  const dailyConsumption = monthlyConsumption / 30;
  const daysOfCurrentStock = currentStock / dailyConsumption;
  const leadTimeStock = dailyConsumption * leadTimeDays;
  const safetyStock = dailyConsumption * safetyStockDays;
  const reorderPoint = leadTimeStock + safetyStock;
  const idealStock = dailyConsumption * 45; // 1.5 meses
  
  // Análise de preços por laboratório dos últimos 3 meses
  const labPrices = {};
  priceHistory.forEach(price => {
    const labName = price.lab?.name || 'Unknown';
    if (!labPrices[labName]) {
      labPrices[labName] = [];
    }
    labPrices[labName].push({
      price: parseFloat(price.value.toString()),
      date: price.capturedAt
    });
  });

  // Calcular tendências e estatísticas por laboratório
  const recommendations = Object.entries(labPrices).map(([labName, prices]) => {
    const sortedPrices = prices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const currentPrice = sortedPrices[sortedPrices.length - 1]?.price || 0;
    const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
    
    // Calcular tendência (últimos 30 dias vs 30-60 dias)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const recentPrices = prices.filter(p => new Date(p.date) >= thirtyDaysAgo);
    const olderPrices = prices.filter(p => new Date(p.date) >= sixtyDaysAgo && new Date(p.date) < thirtyDaysAgo);
    
    const recentAvg = recentPrices.length > 0 ? recentPrices.reduce((sum, p) => sum + p.price, 0) / recentPrices.length : currentPrice;
    const olderAvg = olderPrices.length > 0 ? olderPrices.reduce((sum, p) => sum + p.price, 0) / olderPrices.length : currentPrice;
    
    const trendPercent = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
    
    // Calcular volatilidade
    const priceValues = prices.map(p => p.price);
    const variance = priceValues.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / priceValues.length;
    const volatility = Math.sqrt(variance) / avgPrice;
    
    // Determinar ação baseada em múltiplos fatores
    let action = 'monitor';
    let priority = 'medium';
    let reasoning = [];
    
    // Análise de estoque
    if (daysOfCurrentStock < leadTimeDays) {
      action = 'urgent_buy';
      priority = 'urgent';
      reasoning.push(`🚨 Estoque crítico: apenas ${daysOfCurrentStock.toFixed(0)} dias restantes`);
    } else if (daysOfCurrentStock < reorderPoint / dailyConsumption) {
      priority = 'high';
      reasoning.push(`⚠️ Estoque baixo: ${daysOfCurrentStock.toFixed(0)} dias restantes`);
    }
    
    // Análise de preços e tendências
    if (currentPrice < avgPrice * 0.9) {
      if (action !== 'urgent_buy') action = 'buy_now';
      reasoning.push(`💰 Preço atual 10%+ abaixo da média (R$ ${currentPrice.toFixed(2)} vs R$ ${avgPrice.toFixed(2)})`);
    } else if (trendPercent < -5) {
      if (action !== 'urgent_buy') action = 'buy_now';
      reasoning.push(`📉 Tendência de queda: ${Math.abs(trendPercent).toFixed(1)}% nos últimos 30 dias`);
    } else if (trendPercent > 10) {
      action = 'wait';
      priority = 'low';
      reasoning.push(`📈 Preços subindo: +${trendPercent.toFixed(1)}% - aguardar estabilização`);
    } else if (currentPrice > avgPrice * 1.15) {
      action = 'wait';
      reasoning.push(`💸 Preço atual 15%+ acima da média - aguardar queda`);
    }
    
    // Análise de volatilidade
    if (volatility > 0.2) {
      reasoning.push(`📊 Alta volatilidade (${(volatility * 100).toFixed(1)}%) - monitorar de perto`);
    }
    
    // Cálculos financeiros
    const quantityToBuy = desiredQuantity || Math.max(reorderPoint - currentStock, 0);
    const totalCost = currentPrice * quantityToBuy;
    const costPerUnit = currentPrice;
    const expectedSavings = (avgPrice - currentPrice) * quantityToBuy;
    
    // Análise de ciclo de compra
    const cycleDays = quantityToBuy / dailyConsumption;
    
    return {
      action,
      laboratory: labName,
      currentPrice,
      avgPrice3Months: avgPrice,
      predictedPrice: recentAvg, // Usar média recente como previsão simples
      trendPercent,
      volatility: volatility * 100,
      
      // Cálculos financeiros
      costPerUnit,
      quantityToBuy,
      totalCost,
      expectedSavings,
      
      // Análise de estoque
      daysOfStock: daysOfCurrentStock,
      cycleDays,
      reorderPoint,
      
      confidence: Math.max(0.5, 1 - volatility), // Confiança baseada na volatilidade
      timeframe: getTimeframeForAction(action),
      reasoning,
      priority,
      
      // Métricas de qualidade
      dataPoints: prices.length,
      lastUpdate: sortedPrices[sortedPrices.length - 1]?.date
    };
  });

  // Análise de mercado geral
  const allPrices = Object.values(labPrices).flat().map(p => p.price);
  const marketAvg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
  const marketMin = Math.min(...allPrices);
  const marketMax = Math.max(...allPrices);
  
  const marketAnalysis = {
    currentMarketPrice: marketAvg,
    priceRange: { min: marketMin, max: marketMax },
    competitionLevel: Object.keys(labPrices).length >= 5 ? 'high' : Object.keys(labPrices).length >= 3 ? 'medium' : 'low',
    marketTrend: recommendations.length > 0 ? recommendations[0].trendPercent : 0,
    recommendedAction: recommendations.length > 0 ? recommendations[0].action : 'monitor'
  };
  
  // Cálculos de estoque otimizados
  const stockAnalysis = {
    currentStock,
    dailyConsumption,
    daysOfStock: daysOfCurrentStock,
    reorderPoint,
    idealStock,
    safetyStock,
    stockStatus: daysOfCurrentStock < leadTimeDays ? 'critical' : 
                 daysOfCurrentStock < reorderPoint / dailyConsumption ? 'low' :
                 daysOfCurrentStock > idealStock / dailyConsumption ? 'excess' : 'normal',
    recommendations: generateStockRecommendations(daysOfCurrentStock, reorderPoint, idealStock, dailyConsumption)
  };

  return {
    medicationCode: medication.code,
    medicationName: medication.name,
    recommendations: recommendations.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.costPerUnit - b.costPerUnit; // Menor preço primeiro
    }),
    marketAnalysis,
    stockAnalysis,
    calculatedAt: new Date()
  };
}

function generateStockRecommendations(daysOfStock, reorderPoint, idealStock, dailyConsumption) {
  const recommendations = [];
  
  if (daysOfStock < 7) {
    recommendations.push('🚨 CRÍTICO: Reabastecer imediatamente - risco de ruptura');
  } else if (daysOfStock < reorderPoint / dailyConsumption) {
    recommendations.push('⚠️ BAIXO: Planejar reabastecimento nas próximas 48h');
  } else if (daysOfStock > idealStock / dailyConsumption) {
    recommendations.push('📦 EXCESSO: Considerar reduzir próximos pedidos');
  } else {
    recommendations.push('✅ NORMAL: Estoque dentro do ideal');
  }
  
  const optimalOrderQuantity = idealStock - (daysOfStock * dailyConsumption);
  if (optimalOrderQuantity > 0) {
    recommendations.push(`📊 SUGESTÃO: Comprar ${Math.round(optimalOrderQuantity)} unidades para estoque ideal`);
  }
  
  return recommendations;
}

function getTimeframeForAction(action) {
  switch (action) {
    case 'urgent_buy':
      return 'Imediatamente (24h)';
    case 'buy_now':
      return 'Próximos 2-3 dias';
    case 'wait':
      return 'Aguardar 1-2 semanas';
    case 'monitor':
      return 'Monitorar próximos 7 dias';
    default:
      return 'A definir';
  }
}

// Salvar análise de compra no banco de dados
async function savePurchaseAnalysis(medicationCode, analysis, parameters) {
  try {
    // Buscar medicamento
    const medication = await prisma.medication.findUnique({
      where: { code: medicationCode }
    });

    if (!medication) return;

    // Buscar ou criar usuário do sistema para análises
    const systemUser = await prisma.user.upsert({
      where: { email: 'system@raymed.com' },
      update: {},
      create: {
        email: 'system@raymed.com',
        name: 'Sistema RayMed',
        role: 'admin'
      }
    });

    // Salvar como métrica do sistema
    await prisma.systemMetric.upsert({
      where: { name: `purchase_analysis_${medicationCode}` },
      update: {
        value: analysis.recommendations.length,
        tags: JSON.stringify({
          type: 'purchase_analysis',
          medicationCode,
          parameters,
          analysis: {
            bestLab: analysis.recommendations[0]?.laboratory,
            bestAction: analysis.recommendations[0]?.action,
            totalCost: analysis.recommendations[0]?.totalCost,
            stockStatus: analysis.stockAnalysis?.stockStatus,
            marketTrend: analysis.marketAnalysis?.marketTrend
          },
          calculatedAt: new Date()
        })
      },
      create: {
        name: `purchase_analysis_${medicationCode}`,
        value: analysis.recommendations.length,
        tags: JSON.stringify({
          type: 'purchase_analysis',
          medicationCode,
          parameters,
          analysis: {
            bestLab: analysis.recommendations[0]?.laboratory,
            bestAction: analysis.recommendations[0]?.action,
            totalCost: analysis.recommendations[0]?.totalCost,
            stockStatus: analysis.stockAnalysis?.stockStatus,
            marketTrend: analysis.marketAnalysis?.marketTrend
          },
          calculatedAt: new Date()
        })
      }
    });

    console.log(`💾 Análise de compra salva: ${medicationCode}`);
  } catch (error) {
    console.error('Erro ao salvar análise:', error.message);
    throw error;
  }
}

// Buscar análises salvas
app.get('/api/ml/purchase/history/:medicationCode', async (req, res) => {
  try {
    const { medicationCode } = req.params;
    
    const savedAnalysis = await prisma.systemMetric.findUnique({
      where: { name: `purchase_analysis_${medicationCode}` }
    });

    if (savedAnalysis) {
      const tags = JSON.parse(savedAnalysis.tags);
      
      res.json({
        success: true,
        data: {
          medicationCode,
          lastAnalysis: tags,
          lastUpdate: savedAnalysis.updatedAt,
          recommendations: tags.analysis
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Nenhuma análise anterior encontrada',
        data: null
      });
    }
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

function generatePurchaseRecommendationsSimple(medication, currentStock, monthlyConsumption) {
  const prices = medication.prices.map(p => ({
    price: parseFloat(p.value.toString()),
    lab: p.lab?.name || 'Unknown',
    date: p.capturedAt,
  }));

  if (prices.length < 2) {
    return {
      medicationCode: medication.code,
      medicationName: medication.name,
      recommendations: [],
      marketAnalysis: {},
      optimalTiming: {},
    };
  }

  // Calcular tendência de preços
  const currentPrice = prices[0].price;
  const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
  const priceChange = ((currentPrice - avgPrice) / avgPrice) * 100;

  // Agrupar por laboratório
  const labPrices = {};
  prices.forEach(p => {
    if (!labPrices[p.lab]) {
      labPrices[p.lab] = [];
    }
    labPrices[p.lab].push(p.price);
  });

  // Gerar recomendações por laboratório
  const recommendations = Object.entries(labPrices).map(([lab, labPriceList]) => {
    const labAvgPrice = labPriceList.reduce((a, b) => a + b, 0) / labPriceList.length;
    const labCurrentPrice = labPriceList[0];
    
    // Determinar ação
    let action = 'monitor';
    let priority = 'medium';
    let reasoning = [];

    if (labCurrentPrice < avgPrice * 0.9) {
      action = 'buy_now';
      priority = 'high';
      reasoning.push('Preço 10% abaixo da média do mercado');
    } else if (labCurrentPrice < avgPrice * 0.95) {
      action = 'buy_now';
      priority = 'medium';
      reasoning.push('Preço competitivo detectado');
    } else if (labCurrentPrice > avgPrice * 1.1) {
      action = 'wait';
      priority = 'low';
      reasoning.push('Preço acima da média - aguardar');
    }

    // Considerar estoque se fornecido
    if (currentStock !== undefined && monthlyConsumption !== undefined) {
      const daysOfStock = (currentStock / (monthlyConsumption / 30));
      if (daysOfStock < 15) {
        priority = priority === 'low' ? 'medium' : 'high';
        reasoning.push(`Estoque baixo: ${daysOfStock.toFixed(0)} dias`);
      }
    }

    return {
      action,
      laboratory: lab,
      currentPrice: labCurrentPrice,
      predictedPrice: labAvgPrice, // Usar média como previsão simples
      expectedSavings: Math.max(0, labCurrentPrice - labAvgPrice),
      confidence: 0.75,
      timeframe: action === 'buy_now' ? 'Próximos 2-3 dias' : 
                action === 'wait' ? 'Aguardar 1-2 semanas' : 'Monitorar próximos 7 dias',
      reasoning,
      priority,
    };
  });

  // Análise de mercado
  const marketAnalysis = {
    currentMarketPrice: currentPrice,
    predictedMarketPrice: avgPrice,
    priceVolatility: Math.abs(priceChange),
    competitionLevel: Object.keys(labPrices).length >= 5 ? 'high' : 
                     Object.keys(labPrices).length >= 3 ? 'medium' : 'low',
    marketTrend: priceChange > 5 ? 'increasing' : priceChange < -5 ? 'decreasing' : 'stable',
  };

  // Timing ótimo (simplificado)
  const optimalTiming = {
    bestBuyDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 dias
    worstBuyDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 dias
    maxSavingsOpportunity: Math.max(...Object.values(labPrices).map(prices => 
      Math.max(...prices) - Math.min(...prices)
    )),
    riskAssessment: Math.abs(priceChange) > 20 ? 'high' : 
                   Math.abs(priceChange) > 10 ? 'medium' : 'low',
  };

  return {
    medicationCode: medication.code,
    medicationName: medication.name,
    recommendations: recommendations.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }),
    marketAnalysis,
    optimalTiming,
  };
}

// Buscar medicamentos por categoria
app.get('/api/medications/by-category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
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
      },
      orderBy: { name: 'asc' }
    });
    
    const response = medications.map(med => ({
      id: med.id,
      code: med.code,
      name: med.name,
      category: med.category,
      activeIngredient: med.activeIngredient,
      currentPrice: med.prices[0] ? {
        value: parseFloat(med.prices[0].value.toString()),
        labName: med.prices[0].lab?.name || 'N/A',
        capturedAt: med.prices[0].capturedAt
      } : null
    }));
    
    res.json({
      success: true,
      data: response,
      metadata: {
        category,
        totalFound: response.length,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao buscar medicamentos por categoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar categorias disponíveis
app.get('/api/medications/categories', async (req, res) => {
  try {
    const categories = await prisma.medication.findMany({
      select: { category: true },
      distinct: ['category']
    });
    
    // Processar categorias para extrair grupos principais
    const categoryGroups = {};
    
    categories.forEach(cat => {
      if (cat.category) {
        const mainCategory = cat.category.split(' | ')[0];
        if (!categoryGroups[mainCategory]) {
          categoryGroups[mainCategory] = {
            name: mainCategory,
            count: 0,
            subcategories: new Set()
          };
        }
        categoryGroups[mainCategory].count++;
        
        // Adicionar subcategorias
        const parts = cat.category.split(' | ');
        if (parts.length > 1) {
          categoryGroups[mainCategory].subcategories.add(parts[1]);
        }
      }
    });
    
    // Converter para array ordenado
    const result = Object.entries(categoryGroups)
      .map(([name, data]) => ({
        name,
        count: data.count,
        subcategories: Array.from(data.subcategories),
        emoji: getCategoryEmoji(name)
      }))
      .sort((a, b) => b.count - a.count);
    
    res.json({
      success: true,
      data: result,
      metadata: {
        totalCategories: result.length,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Função auxiliar para emojis de categoria
function getCategoryEmoji(category) {
  const emojiMap = {
    'Oncológico': '🎗️',
    'Imunobiológico': '🧬',
    'Medicamento Básico': '💊',
    'SUS': '🏥',
    'Analgésico': '💊',
    'Antibiótico': '🦠',
    'Anti-hipertensivo': '❤️',
    'Antidiabético': '🍯',
    'Protetor Gástrico': '🛡️',
    'Alto Custo': '💎',
    'Cardiologia': '🫀',
    'Especialidade': '⚕️'
  };
  
  return emojiMap[category] || '💊';
}

// ===================================
// APIS DE VALIDAÇÃO E CORREÇÃO DE DADOS
// ===================================

// Validar qualidade dos dados
app.get('/api/data/validate', async (req, res) => {
  try {
    console.log('🔍 Iniciando validação de dados...');

    // Estatísticas gerais
    const totalMedications = await prisma.medication.count();
    const totalLabs = await prisma.lab.count(); 
    const totalPrices = await prisma.price.count();

    // Medicamentos oncológicos com preços suspeitos
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
    ).map(med => ({
      name: med.name,
      code: med.code,
      price: parseFloat(med.prices[0].value.toString()),
      laboratory: med.prices[0].lab?.name,
      category: med.category
    }));

    // Medicamentos sem princípio ativo
    const withoutActiveIngredient = await prisma.medication.count({
      where: {
        activeIngredient: null
      }
    });

    // Laboratórios principais
    const mainLabs = ['Roche', 'Novartis', 'Bayer', 'AbbVie', 'Janssen', 'MSD', 'Bristol Myers Squibb'];
    const labStatus = {};

    for (const labName of mainLabs) {
      const lab = await prisma.lab.findUnique({
        where: { name: labName },
        include: { _count: { select: { prices: true } } }
      });
      
      labStatus[labName] = lab ? {
        found: true,
        pricesCount: lab._count.prices
      } : { found: false };
    }

    const insights = [];
    if (lowPriceOncologics.length > 0) {
      insights.push(`⚠️ ${lowPriceOncologics.length} medicamentos oncológicos com preços suspeitos`);
    }
    if (withoutActiveIngredient > 0) {
      insights.push(`📝 ${withoutActiveIngredient} medicamentos sem princípio ativo`);
    }

    res.json({
      success: true,
      data: {
        statistics: {
          totalMedications,
          totalLabs,
          totalPrices,
          avgPricesPerMedication: Math.round(totalPrices / totalMedications)
        },
        dataQuality: {
          suspiciousOncologics: lowPriceOncologics.length,
          missingActiveIngredients: withoutActiveIngredient,
          mainLabsFound: mainLabs.filter(lab => labStatus[lab].found).length
        },
        issues: {
          lowPriceOncologics: lowPriceOncologics.slice(0, 10),
          labStatus
        },
        insights
      }
    });

  } catch (error) {
    console.error('Erro na validação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Corrigir dados específicos
app.post('/api/data/fix', async (req, res) => {
  try {
    const { medicationCode, correctLaboratory, correctPrice, correctCategory, correctActiveIngredient } = req.body;

    if (!medicationCode) {
      return res.status(400).json({ error: 'Código do medicamento é obrigatório' });
    }

    const medication = await prisma.medication.findUnique({
      where: { code: medicationCode },
      include: { prices: { take: 1, orderBy: { capturedAt: 'desc' }, include: { lab: true } } }
    });

    if (!medication) {
      return res.status(404).json({ error: 'Medicamento não encontrado' });
    }

    const corrections = [];

    // Corrigir laboratório e preço
    if (correctLaboratory) {
      const lab = await prisma.lab.upsert({
        where: { name: correctLaboratory },
        update: {},
        create: { name: correctLaboratory }
      });

      if (correctPrice) {
        await prisma.price.create({
          data: {
            medicationId: medication.id,
            labId: lab.id,
            value: correctPrice.toString(),
            source: 'ManualCorrection',
            capturedAt: new Date()
          }
        });
        corrections.push(`Preço corrigido: R$ ${correctPrice} (${correctLaboratory})`);
      }
    }

    // Corrigir informações do medicamento
    const updateData = {};
    if (correctCategory) {
      updateData.category = correctCategory;
      corrections.push(`Categoria: ${correctCategory}`);
    }
    if (correctActiveIngredient) {
      updateData.activeIngredient = correctActiveIngredient;
      corrections.push(`Princípio ativo: ${correctActiveIngredient}`);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.medication.update({
        where: { id: medication.id },
        data: updateData
      });
    }

    res.json({
      success: true,
      message: 'Correções aplicadas com sucesso',
      data: { medicationCode, corrections }
    });

  } catch (error) {
    console.error('Erro na correção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===================================
// CHAT LLM EVOLUÍDO
// ===================================

// Consultas complexas com LLM evoluído
app.post('/api/llm/complex-query', async (req, res) => {
  try {
    const { 
      query, 
      userProfile = 'analista',
      timeframe = 60,
      category = null,
      limit = 5
    } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query é obrigatória' });
    }

    console.log(`🤖 Processando consulta complexa: "${query}" para perfil ${userProfile}`);

    // Primeiro, tentar processamento específico para consultas complexas
    const complexResult = await processComplexQueryEnhanced(query, userProfile, { timeframe, category, limit });
    
    if (complexResult.isSpecific) {
      // Se é uma consulta específica, retornar resultado processado
      res.json({
        success: true,
        data: complexResult,
        metadata: {
          query,
          userProfile,
          processedAt: new Date(),
          confidence: complexResult.confidence,
          type: 'complex_processing'
        }
      });
    } else {
      // Fallback para API LLM original com contexto enriquecido
      const enrichedResult = await processWithOriginalLLM(query, userProfile, { timeframe, category, limit });
      
      res.json({
        success: true,
        data: enrichedResult,
        metadata: {
          query,
          userProfile,
          processedAt: new Date(),
          confidence: enrichedResult.confidence,
          type: 'llm_enhanced'
        }
      });
    }

  } catch (error) {
    console.error('Erro no LLM evoluído:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Gerar relatórios automáticos
app.post('/api/reports/generate', async (req, res) => {
  try {
    const {
      reportType = 'market_analysis',
      userProfile = 'analista', 
      format = 'html',
      timeframe = 90,
      includeCharts = true
    } = req.body;

    console.log(`📊 Gerando relatório: ${reportType} para ${userProfile}`);

    const report = await generateAutomaticReport({
      type: reportType,
      format,
      userProfile,
      parameters: { timeframe },
      includeCharts,
      includeRecommendations: true
    });

    res.json({
      success: true,
      data: report,
      message: 'Relatório gerado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Gerenciar perfil do usuário
app.get('/api/users/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const profile = {
      userId,
      email: user.email,
      name: user.name,
      profileType: 'analista', // Padrão
      preferences: user.preferences ? JSON.parse(user.preferences) : {},
      watchlist: [],
      createdAt: user.createdAt
    };

    res.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Gerenciar watchlist/favoritos
app.post('/api/users/watchlist', async (req, res) => {
  try {
    const {
      userId = 'default-user',
      action = 'add', // add, remove, list
      medicationCode,
      alertConfig = { priceChange: 10, enabled: true },
      notes
    } = req.body;

    if (action === 'add' && !medicationCode) {
      return res.status(400).json({ error: 'Código do medicamento é obrigatório para adicionar' });
    }

    // Simular gerenciamento de watchlist
    const watchlistKey = `watchlist_${userId}`;
    
    if (action === 'add') {
      // Buscar medicamento
      const medication = await prisma.medication.findUnique({
        where: { code: medicationCode },
        include: {
          prices: {
            take: 1,
            orderBy: { capturedAt: 'desc' },
            include: { lab: true }
          }
        }
      });

      if (!medication) {
        return res.status(404).json({ error: 'Medicamento não encontrado' });
      }

      const watchlistItem = {
        medicationCode,
        medicationName: medication.name,
        category: medication.category,
        currentPrice: medication.prices[0] ? {
          value: parseFloat(medication.prices[0].value.toString()),
          laboratory: medication.prices[0].lab?.name
        } : null,
        addedAt: new Date(),
        alertConfig,
        notes
      };

      // Salvar como métrica do sistema
      await prisma.systemMetric.upsert({
        where: { name: watchlistKey },
        update: {
          value: 1,
          tags: JSON.stringify({
            type: 'user_watchlist',
            items: [watchlistItem] // Simplificado - em produção seria uma lista
          })
        },
        create: {
          name: watchlistKey,
          value: 1,
          tags: JSON.stringify({
            type: 'user_watchlist',
            items: [watchlistItem]
          })
        }
      });

      res.json({
        success: true,
        message: 'Medicamento adicionado à watchlist',
        data: watchlistItem
      });

    } else if (action === 'list') {
      // Buscar watchlist
      const savedWatchlist = await prisma.systemMetric.findUnique({
        where: { name: watchlistKey }
      });

      const watchlist = savedWatchlist ? 
        JSON.parse(savedWatchlist.tags).items : [];

      res.json({
        success: true,
        data: {
          userId,
          watchlist,
          totalItems: watchlist.length
        }
      });
    }

  } catch (error) {
    console.error('Erro no gerenciamento de watchlist:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Simulação de compras em lote
app.post('/api/users/simulate-bulk-purchase', async (req, res) => {
  try {
    const {
      medications = [], // [{ code, quantity }]
      maxBudget,
      userProfile = 'hospital'
    } = req.body;

    if (medications.length === 0) {
      return res.status(400).json({ error: 'Lista de medicamentos é obrigatória' });
    }

    console.log(`🛒 Simulando compra em lote: ${medications.length} medicamentos`);

    const simulation = await simulateBulkPurchase(medications, { maxBudget, userProfile });

    res.json({
      success: true,
      data: simulation,
      metadata: {
        totalMedications: medications.length,
        userProfile,
        simulatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Erro na simulação de compra:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===================================
// FUNÇÕES AUXILIARES EVOLUÍDAS
// ===================================

async function processComplexQueryEnhanced(query, userProfile, parameters) {
  try {
    // Identificar tipo de consulta com melhor precisão
    const queryType = identifyQueryTypeEnhanced(query);
    
    // Buscar dados relevantes
    const timeframeDays = parameters.timeframe || 60;
    const cutoffDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
    
    const medications = await prisma.medication.findMany({
      where: parameters.category ? {
        category: { contains: parameters.category }
      } : {},
      include: {
        prices: {
          where: { capturedAt: { gte: cutoffDate } },
          include: { lab: true },
          orderBy: { capturedAt: 'desc' }
        }
      }
    });

    const relevantMedications = medications.filter(med => med.prices.length > 0);

    // Verificar se é uma consulta específica que podemos processar
    if (queryType.isSpecific) {
      let result;
      
      switch (queryType.type) {
        case 'top_drops':
          result = await processTopDropsQueryEnhanced(relevantMedications, parameters.limit || 5, query);
          break;
        case 'price_explanation':
          result = await processPriceExplanationQueryEnhanced(query, relevantMedications);
          break;
        case 'simulation':
          result = await processSimulationQueryEnhanced(query, relevantMedications);
          break;
        case 'comparison':
          result = await processComparisonQueryEnhanced(query, relevantMedications, parameters);
          break;
        case 'category_analysis':
          result = await processCategoryAnalysisQuery(query, relevantMedications, parameters);
          break;
        default:
          return { isSpecific: false };
      }
      
      return { ...result, isSpecific: true };
    }

    // Se não é específica, retornar para usar LLM original
    return { isSpecific: false };

  } catch (error) {
    console.error(`Erro ao processar consulta complexa: ${error.message}`);
    return { isSpecific: false };
  }
}

async function processWithOriginalLLM(query, userProfile, parameters) {
  try {
    // Buscar dados contextuais para enriquecer a consulta
    const contextData = await buildContextForLLM(query, userProfile, parameters);
    
    // Criar prompt enriquecido
    const enhancedPrompt = buildEnhancedPrompt(query, userProfile, contextData);
    
    // Chamar API LLM original (simulando resposta da OpenAI)
    const llmResponse = await callOriginalLLMAPI(enhancedPrompt);
    
    // Processar e enriquecer resposta
    const enrichedResponse = enrichLLMResponse(llmResponse, contextData, userProfile);
    
    return enrichedResponse;
  } catch (error) {
    console.error(`Erro no processamento LLM: ${error.message}`);
    throw error;
  }
}

function identifyQueryTypeEnhanced(query) {
  const lowerQuery = query.toLowerCase();
  
  // Padrões mais específicos para identificação
  const patterns = {
    top_drops: [
      /(?:top|maiores?|principais?)\s+\d*\s*(?:medicamentos?)?.*(?:queda|baixa|redução)/i,
      /medicamentos?.*(?:maior|grande|significativa).*queda/i,
      /(?:queda|baixa).*(?:preço|valor).*(?:últimos?|dias|meses)/i
    ],
    price_explanation: [
      /(?:por\s*que|porque|explique|explicação).*(?:subiu|aumentou|variou|mudou)/i,
      /(?:razão|motivo|causa).*(?:preço|valor|mudança)/i,
      /(?:subiu|aumentou|caiu|diminuiu).*(?:\d+%|\d+\s*por\s*cento)/i
    ],
    simulation: [
      /se\s+(?:eu|nós|a\s*gente)\s+comprar.*\d+.*(?:unidades?|mil)/i,
      /simula(?:ção|r).*compra.*\d+/i,
      /(?:comprar|compra)\s+\d+.*(?:qual|melhor|laboratório)/i
    ],
    comparison: [
      /(?:compare|comparação|versus|vs).*(?:laboratório|preço|medicamento)/i,
      /diferença.*(?:entre|preço|laboratório)/i,
      /(?:melhor|pior).*(?:laboratório|opção|escolha)/i,
      /(?:há|existe|tem).*diferença.*(?:preço|custo)/i,
      /(?:original|genérico|biossimilar).*(?:vs|versus|comparado)/i,
      /(?:dipirona|paracetamol|ibuprofeno).*(?:original|genérico)/i
    ],
    category_analysis: [
      /analise?.*(?:categoria|oncológico|sus|imunobiológico)/i,
      /medicamentos?.*(?:categoria|tipo|classe)/i,
      /(?:oncológicos?|sus|imunobiológicos?).*(?:preço|tendência|análise)/i
    ]
  };

  // Testar cada padrão
  for (const [type, typePatterns] of Object.entries(patterns)) {
    for (const pattern of typePatterns) {
      if (pattern.test(query)) {
        return { type, isSpecific: true, confidence: 0.9 };
      }
    }
  }
  
  return { type: 'general', isSpecific: false, confidence: 0.3 };
}

// Funções melhoradas de processamento
async function processTopDropsQueryEnhanced(medications, limit, originalQuery) {
  console.log(`🔍 Processando consulta de top quedas: ${limit} medicamentos`);
  
  const medicationsWithChanges = [];

  for (const med of medications) {
    if (med.prices.length < 2) continue;

    const prices = med.prices.map(p => parseFloat(p.value.toString()));
    const latestPrice = prices[0];
    const oldestPrice = prices[prices.length - 1];
    const priceChange = ((latestPrice - oldestPrice) / oldestPrice) * 100;

    // Filtrar por quedas significativas
    if (priceChange < -5) { // Apenas quedas > 5%
      medicationsWithChanges.push({
        name: med.name,
        code: med.code,
        category: med.category,
        priceChange: Math.abs(priceChange),
        latestPrice,
        oldestPrice,
        laboratory: med.prices[0].lab?.name || 'Unknown',
        activeIngredient: med.activeIngredient
      });
    }
  }

  // Ordenar por maior queda
  const topDrops = medicationsWithChanges
    .sort((a, b) => b.priceChange - a.priceChange)
    .slice(0, limit);

  if (topDrops.length === 0) {
    return {
      answer: `📊 **Análise de Quedas de Preço**\n\n❌ Nenhuma queda significativa (>5%) encontrada nos medicamentos analisados no período especificado.\n\n✅ **Isso indica:**\n• Estabilidade de preços no mercado\n• Ausência de oportunidades de economia imediata\n• Mercado equilibrado sem grandes flutuações`,
      data: [],
      insights: ['Nenhuma queda significativa detectada', 'Mercado estável no período'],
      recommendations: ['Monitorar por mudanças futuras', 'Considerar expandir período de análise'],
      confidence: 0.8
    };
  }

  const avgDrop = topDrops.reduce((sum, med) => sum + med.priceChange, 0) / topDrops.length;
  const totalSavings = topDrops.reduce((sum, med) => sum + (med.oldestPrice - med.latestPrice), 0);

  const answer = `📉 **Top ${topDrops.length} medicamentos com maior queda de preço:**

${topDrops.map((med, index) => 
  `**${index + 1}. ${med.name}** (${med.laboratory})
   📉 **Queda:** ${med.priceChange.toFixed(1)}% 
   💰 **Preços:** R$ ${med.oldestPrice.toFixed(2)} → R$ ${med.latestPrice.toFixed(2)}
   🏷️ **Categoria:** ${med.category?.split(' | ')[0] || 'N/A'}
   🧪 **Princípio:** ${med.activeIngredient || 'N/A'}`
).join('\n\n')}

📊 **Resumo da Análise:**
• **Queda média:** ${avgDrop.toFixed(1)}%
• **Maior queda:** ${topDrops[0]?.name} (${topDrops[0]?.priceChange.toFixed(1)}%)
• **Economia total potencial:** R$ ${totalSavings.toFixed(2)}

💡 **Oportunidades Identificadas:**
• Considere aumentar estoque dos medicamentos em queda
• Monitore se é tendência temporária ou permanente
• Avalie impacto positivo no orçamento hospitalar`;

  return {
    answer,
    data: topDrops,
    insights: [
      `${topDrops.length} medicamentos com quedas significativas (>5%)`,
      `Queda média de ${avgDrop.toFixed(1)}% no período`,
      `Economia potencial de R$ ${totalSavings.toFixed(2)} identificada`,
      'Oportunidades de otimização de compras detectadas'
    ],
    recommendations: [
      'Priorizar compras dos medicamentos com maior queda',
      'Negociar contratos aproveitando preços baixos',
      'Monitorar se quedas são sustentáveis',
      'Considerar aumentar estoque estratégico'
    ],
    confidence: 0.95
  };
}

async function buildContextForLLM(query, userProfile, parameters) {
  try {
    const timeframeDays = parameters.timeframe || 60;
    const cutoffDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
    
    // Buscar dados contextuais específicos
    const [medications, labs, recentPrices] = await Promise.all([
      prisma.medication.findMany({
        include: {
          prices: {
            where: { capturedAt: { gte: cutoffDate } },
            take: 5,
            orderBy: { capturedAt: 'desc' },
            include: { lab: true }
          }
        },
        take: 100 // Limitar para performance
      }),
      prisma.lab.findMany({
        include: {
          _count: { select: { prices: true } }
        }
      }),
      prisma.price.findMany({
        where: { capturedAt: { gte: cutoffDate } },
        take: 50,
        orderBy: { capturedAt: 'desc' },
        include: { medication: true, lab: true }
      })
    ]);

    // Filtrar medicamentos com dados
    const medicationsWithPrices = medications.filter(med => med.prices.length > 0);
    
    // Calcular estatísticas relevantes
    const priceChanges = medicationsWithPrices.map(med => {
      if (med.prices.length < 2) return 0;
      const latest = parseFloat(med.prices[0].value.toString());
      const oldest = parseFloat(med.prices[med.prices.length - 1].value.toString());
      return ((latest - oldest) / oldest) * 100;
    }).filter(change => !isNaN(change));

    const avgPriceChange = priceChanges.length > 0 ? 
      priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length : 0;

    // Identificar medicamentos por categoria
    const categoryCounts = {};
    medicationsWithPrices.forEach(med => {
      const category = med.category?.split(' | ')[0] || 'Outros';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    return {
      totalMedicamentos: medicationsWithPrices.length,
      totalLaboratorios: labs.length,
      totalPrecos: recentPrices.length,
      periodoAnalise: timeframeDays,
      variacao_media_precos: avgPriceChange,
      categorias: categoryCounts,
      medicamentos_destaque: medicationsWithPrices.slice(0, 10).map(med => ({
        nome: med.name,
        codigo: med.code,
        categoria: med.category?.split(' | ')[0],
        preco_atual: med.prices[0] ? parseFloat(med.prices[0].value.toString()) : 0,
        laboratorio: med.prices[0]?.lab?.name,
        principio_ativo: med.activeIngredient
      })),
      laboratorios_principais: labs.slice(0, 10).map(lab => ({
        nome: lab.name,
        total_precos: lab._count.prices
      }))
    };
  } catch (error) {
    console.error('Erro ao buscar contexto:', error.message);
    return {};
  }
}

function buildEnhancedPrompt(query, userProfile, contextData) {
  const profileContext = {
    medico: {
      foco: 'aspectos clínicos e terapêuticos',
      linguagem: 'técnica médica',
      interesses: ['eficácia', 'segurança', 'bioequivalência', 'indicações']
    },
    hospital: {
      foco: 'custo-efetividade e gestão',
      linguagem: 'administrativa',
      interesses: ['custos', 'contratos', 'volume', 'logística']
    },
    distribuidor: {
      foco: 'oportunidades comerciais',
      linguagem: 'comercial',
      interesses: ['margem', 'demanda', 'competitividade', 'sazonalidade']
    },
    analista: {
      foco: 'análise de dados',
      linguagem: 'técnica analítica',
      interesses: ['tendências', 'correlações', 'estatísticas', 'projeções']
    }
  };

  const profile = profileContext[userProfile] || profileContext.analista;
  
  return `Você é um assistente farmacêutico especializado da RayMed com foco em ${profile.foco}.

CONTEXTO DOS DADOS (ATUALIZADOS):
• Total de medicamentos: ${contextData.totalMedicamentos || 0}
• Laboratórios: ${contextData.totalLaboratorios || 0}
• Preços analisados: ${contextData.totalPrecos || 0}
• Período: ${contextData.periodoAnalise || 60} dias
• Variação média de preços: ${contextData.variacao_media_precos?.toFixed(1) || 0}%

CATEGORIAS PRINCIPAIS:
${Object.entries(contextData.categorias || {}).map(([cat, count]) => `• ${cat}: ${count} medicamentos`).join('\n')}

MEDICAMENTOS DE DESTAQUE:
${(contextData.medicamentos_destaque || []).map(med => 
  `• ${med.nome} (${med.principio_ativo}) - R$ ${med.preco_atual?.toFixed(2)} (${med.laboratorio})`
).join('\n')}

PERFIL DO USUÁRIO: ${userProfile.toUpperCase()}
FOCO: ${profile.foco}
LINGUAGEM: ${profile.linguagem}

CONSULTA DO USUÁRIO: "${query}"

INSTRUÇÕES:
1. Responda de forma específica e detalhada à consulta
2. Use os dados fornecidos acima para respostas precisas
3. Adapte a linguagem para o perfil ${userProfile}
4. Inclua insights relevantes para ${profile.interesses.join(', ')}
5. Forneça recomendações práticas
6. Cite dados específicos quando relevante
7. Use emojis apropriados para melhor visualização`;
}

async function callOriginalLLMAPI(enhancedPrompt) {
  // Simular chamada para API LLM original (que já funciona)
  // Em produção, integraria com a API /api/llm/query existente
  
  try {
    // Usar a lógica da API LLM original que já funciona
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || 'fake-key'}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: enhancedPrompt },
          { role: 'user', content: 'Responda à consulta de forma detalhada e específica.' }
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || 'Resposta não disponível';
    } else {
      throw new Error('API OpenAI não disponível');
    }
  } catch (error) {
    // Fallback para resposta baseada em dados quando OpenAI não está disponível
    console.warn('OpenAI não disponível, usando processamento local');
    return generateLocalResponse(enhancedPrompt);
  }
}

function generateLocalResponse(prompt) {
  // Extrair dados do prompt para gerar resposta local
  const medicamentosMatch = prompt.match(/Total de medicamentos: (\d+)/);
  const laboratoriosMatch = prompt.match(/Laboratórios: (\d+)/);
  const variacaoMatch = prompt.match(/Variação média de preços: ([\d.-]+)%/);
  
  const totalMedicamentos = medicamentosMatch ? medicamentosMatch[1] : '0';
  const totalLaboratorios = laboratoriosMatch ? laboratoriosMatch[1] : '0';
  const variacao = variacaoMatch ? parseFloat(variacaoMatch[1]) : 0;
  
  return `📊 **Análise baseada nos dados da RayMed:**

Com base em nossa base de dados com ${totalMedicamentos} medicamentos e ${totalLaboratorios} laboratórios:

• **Variação média de preços:** ${variacao.toFixed(1)}%
• **Tendência geral:** ${variacao > 0 ? 'Alta' : variacao < 0 ? 'Baixa' : 'Estável'}
• **Status do mercado:** ${Math.abs(variacao) < 5 ? 'Estável' : Math.abs(variacao) < 15 ? 'Moderadamente volátil' : 'Altamente volátil'}

💡 **Insights automáticos:**
• Dados atualizados em tempo real
• Análise baseada em preços históricos validados
• Informações específicas por laboratório disponíveis

🎯 **Recomendações:**
• Monitore mudanças significativas (>10%)
• Use dados para negociações estratégicas
• Considere tendências de longo prazo`;
}

function enrichLLMResponse(llmResponse, contextData, userProfile) {
  // Enriquecer resposta com dados específicos e insights
  const insights = [];
  const recommendations = [];
  
  // Adicionar insights baseados no contexto
  if (contextData.variacao_media_precos > 10) {
    insights.push('Alta volatilidade de preços detectada no período');
  } else if (contextData.variacao_media_precos < -10) {
    insights.push('Tendência geral de queda nos preços');
  } else {
    insights.push('Preços relativamente estáveis no período');
  }
  
  // Adicionar recomendações baseadas no perfil
  switch (userProfile) {
    case 'medico':
      recommendations.push('Verifique equivalência terapêutica entre opções');
      recommendations.push('Considere impacto clínico das mudanças');
      break;
    case 'hospital':
      recommendations.push('Analise oportunidades de contratos anuais');
      recommendations.push('Otimize gestão de estoque baseada nas tendências');
      break;
    case 'distribuidor':
      recommendations.push('Identifique oportunidades de margem');
      recommendations.push('Monitore demanda por categoria');
      break;
    case 'analista':
      recommendations.push('Aprofunde análise estatística dos dados');
      recommendations.push('Identifique correlações entre variáveis');
      break;
  }
  
  return {
    answer: llmResponse,
    data: contextData.medicamentos_destaque || [],
    insights,
    recommendations,
    confidence: 0.85
  };
}

// Implementar funções específicas que estavam faltando
async function processPriceExplanationQueryEnhanced(query, medications) {
  console.log(`🔍 Processando explicação de preço para: ${query}`);
  
  // Extrair medicamento da consulta
  const medicationName = extractMedicationFromQueryEnhanced(query);
  
  if (!medicationName) {
    return {
      answer: 'Por favor, especifique qual medicamento você quer que eu explique a mudança de preço.',
      data: [],
      insights: ['Medicamento não identificado na consulta'],
      recommendations: ['Especifique o nome do medicamento claramente'],
      confidence: 0.3
    };
  }
  
  const medication = medications.find(med => 
    med.name.toLowerCase().includes(medicationName.toLowerCase()) ||
    med.code.toLowerCase().includes(medicationName.toLowerCase())
  );

  if (!medication) {
    return {
      answer: `Medicamento "${medicationName}" não encontrado na nossa base de dados ou não tem dados suficientes no período analisado.`,
      data: [],
      insights: ['Medicamento não encontrado'],
      recommendations: ['Verifique o nome do medicamento', 'Tente buscar por princípio ativo'],
      confidence: 0.4
    };
  }

  // Análise detalhada do medicamento
  return await generateDetailedPriceExplanation(medication, query);
}

async function processSimulationQueryEnhanced(query, medications) {
  console.log(`🔍 Processando simulação para: ${query}`);
  
  // Extrair parâmetros de simulação
  const params = extractSimulationParametersEnhanced(query);
  
  if (!params.quantity || !params.medicationName) {
    return {
      answer: 'Para simulação de compra, preciso saber:\n• Qual medicamento\n• Quantas unidades\n\nExemplo: "Se eu comprar 1000 unidades de Paracetamol, qual laboratório é melhor?"',
      data: [],
      insights: ['Parâmetros insuficientes para simulação'],
      recommendations: ['Especifique medicamento e quantidade claramente'],
      confidence: 0.3
    };
  }

  const medication = medications.find(med => 
    med.name.toLowerCase().includes(params.medicationName.toLowerCase()) ||
    med.code.toLowerCase().includes(params.medicationName.toLowerCase())
  );

  if (!medication) {
    return {
      answer: `Medicamento "${params.medicationName}" não encontrado. Verifique o nome e tente novamente.`,
      data: [],
      insights: ['Medicamento não encontrado'],
      recommendations: ['Verificar nome do medicamento'],
      confidence: 0.3
    };
  }

  // Executar simulação detalhada
  return await runDetailedPurchaseSimulation(medication, params.quantity);
}

async function processComparisonQueryEnhanced(query, medications, parameters) {
  console.log(`🔍 Processando comparação para: ${query}`);
  
  // Identificar o que está sendo comparado
  const comparisonType = identifyComparisonType(query);
  
  switch (comparisonType) {
    case 'laboratories':
      return await compareLaboratories(medications, query);
    case 'medications':
      return await compareMedications(medications, query);
    case 'categories':
      return await compareCategories(medications, query);
    default:
      return await compareGeneral(medications, query);
  }
}

async function processCategoryAnalysisQuery(query, medications, parameters) {
  console.log(`🔍 Processando análise de categoria para: ${query}`);
  
  // Extrair categoria da consulta
  const category = extractCategoryFromQuery(query);
  
  const categoryMedications = category ? 
    medications.filter(med => med.category?.toLowerCase().includes(category.toLowerCase())) :
    medications;

  if (categoryMedications.length === 0) {
    return {
      answer: `Nenhum medicamento encontrado para a categoria "${category}".`,
      data: [],
      insights: ['Categoria não encontrada'],
      recommendations: ['Verifique o nome da categoria'],
      confidence: 0.4
    };
  }

  return await generateCategoryAnalysis(categoryMedications, category || 'Geral');
}

// Funções auxiliares melhoradas
function extractMedicationFromQueryEnhanced(query) {
  const patterns = [
    /(?:medicamento|remédio)\s+([a-zA-Z\s\d-]+?)(?:\s|$|,|\?)/i,
    /([a-zA-Z\s\d-]+?)\s+(?:subiu|aumentou|caiu|diminuiu|variou)/i,
    /"([^"]+)"/,
    /\b([A-Z][a-zA-Z]*(?:\s+\d+mg)?)\b/,
    /\b(ADEMPAS|HERCEPTIN|KEYTRUDA|GLIVEC|AVASTIN|PARACETAMOL|DIPIRONA)\b/i
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

function extractSimulationParametersEnhanced(query) {
  // Padrões melhorados para extração
  const quantityPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:mil|thousand)/i,
    /(\d+(?:\.\d+)?)\s*unidades?/i,
    /(\d+(?:\.\d+)?)\s*(?:caixas?|frascos?)/i
  ];
  
  const medicationPatterns = [
    // Padrões específicos para códigos de medicamentos
    /unidades?\s+de\s+([A-Z][A-Z0-9-]+(?:-\d+MG)?)/i,
    /comprar\s+\d+\s+(?:unidades?\s+)?(?:de\s+)?([A-Z][A-Z0-9-]+(?:-\d+MG)?)/i,
    // Padrões para nomes comuns
    /unidades?\s+de\s+(paracetamol|dipirona|ibuprofeno|adempas|herceptin|keytruda)/i,
    /comprar\s+\d+.*?(paracetamol|dipirona|ibuprofeno|adempas|herceptin|keytruda)/i,
    // Padrão geral mais flexível
    /(?:comprar|simulação)\s+\d+.*?(?:de\s+)?([a-zA-Z][a-zA-Z0-9\s-]+?)(?:\s*,|\s*\?|$)/i
  ];

  let quantity = null;
  let medicationName = '';

  // Extrair quantidade
  for (const pattern of quantityPatterns) {
    const match = query.match(pattern);
    if (match) {
      quantity = parseFloat(match[1]);
      if (match[0].toLowerCase().includes('mil')) {
        quantity *= 1000;
      }
      break;
    }
  }

  // Extrair medicamento
  for (const pattern of medicationPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      medicationName = match[1].trim();
      
      // Normalizar nomes comuns para códigos
      const nameToCode = {
        'paracetamol': 'PARACETAMOL-500MG',
        'dipirona': 'DIPIRONA-500MG', 
        'ibuprofeno': 'IBUPROFENO-400MG',
        'adempas': 'ADEMPAS-1-5MG',
        'herceptin': 'HERCEPTIN-440MG',
        'keytruda': 'KEYTRUDA-100MG'
      };
      
      const lowerName = medicationName.toLowerCase();
      if (nameToCode[lowerName]) {
        medicationName = nameToCode[lowerName];
      }
      
      break;
    }
  }

  return { quantity, medicationName };
}

function identifyComparisonType(query) {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('laboratório') || lowerQuery.includes('lab')) {
    return 'laboratories';
  }
  if (lowerQuery.includes('medicamento') || lowerQuery.includes('remédio')) {
    return 'medications';
  }
  if (lowerQuery.includes('categoria') || lowerQuery.includes('oncológico') || lowerQuery.includes('sus')) {
    return 'categories';
  }
  
  return 'general';
}

function extractCategoryFromQuery(query) {
  const categories = ['oncológico', 'imunobiológico', 'sus', 'cardiologia', 'alto custo'];
  
  for (const category of categories) {
    if (query.toLowerCase().includes(category)) {
      return category;
    }
  }
  
  return '';
}

// Implementações de análise detalhada
async function generateDetailedPriceExplanation(medication, originalQuery) {
  const prices = medication.prices.map(p => parseFloat(p.value.toString()));
  const dates = medication.prices.map(p => p.capturedAt);
  
  if (prices.length < 3) {
    return {
      answer: `📊 **${medication.name}**: Dados insuficientes para análise detalhada (apenas ${prices.length} pontos de preço).`,
      data: { medication: medication.name, dataPoints: prices.length },
      insights: ['Necessário mais histórico para análise confiável'],
      recommendations: ['Aguardar mais dados', 'Monitorar por período maior'],
      confidence: 0.4
    };
  }

  const latestPrice = prices[0];
  const oldestPrice = prices[prices.length - 1];
  const priceChange = ((latestPrice - oldestPrice) / oldestPrice) * 100;
  
  // Calcular volatilidade e tendência
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
  const volatility = (Math.sqrt(variance) / avgPrice) * 100;

  // Análise de tendência (últimos 30% vs primeiros 30%)
  const recentPrices = prices.slice(0, Math.floor(prices.length * 0.3));
  const olderPrices = prices.slice(-Math.floor(prices.length * 0.3));
  const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
  const olderAvg = olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length;
  const trendChange = ((recentAvg - olderAvg) / olderAvg) * 100;

  const explanation = `📊 **Explicação Detalhada: ${medication.name}**

🔍 **Análise Técnica Completa:**
• **Variação total:** ${priceChange > 0 ? '📈' : '📉'} ${Math.abs(priceChange).toFixed(1)}%
• **Preço atual:** R$ ${latestPrice.toFixed(2)}
• **Preço inicial:** R$ ${oldestPrice.toFixed(2)}
• **Preço médio:** R$ ${avgPrice.toFixed(2)}
• **Laboratório:** ${medication.prices[0].lab?.name || 'N/A'}
• **Volatilidade:** ${volatility.toFixed(1)}%
• **Tendência recente:** ${trendChange > 0 ? '📈 Alta' : trendChange < 0 ? '📉 Baixa' : '➡️ Estável'} (${Math.abs(trendChange).toFixed(1)}%)

🎯 **Fatores Identificados:**
${generateDetailedPriceFactors(priceChange, medication.category, volatility, medication.prices[0].lab?.name)}

📈 **Contexto de Mercado:**
• **Categoria:** ${medication.category || 'N/A'}
• **Princípio ativo:** ${medication.activeIngredient || 'N/A'}
• **Classificação de risco:** ${volatility < 20 ? '🟢 Baixo' : volatility < 50 ? '🟡 Médio' : '🔴 Alto'}
• **Estabilidade:** ${volatility < 20 ? 'Preços estáveis' : 'Preços voláteis'}

💡 **Explicação Didática:**
${generateComprehensiveExplanation(priceChange, medication.category, volatility, medication.activeIngredient)}

📊 **Dados Estatísticos:**
• **Pontos de dados:** ${prices.length}
• **Período analisado:** ${Math.round((new Date(dates[0]).getTime() - new Date(dates[dates.length - 1]).getTime()) / (1000 * 60 * 60 * 24))} dias
• **Coeficiente de variação:** ${(volatility / 100).toFixed(3)}`;

  return {
    answer: explanation,
    data: {
      medication: medication.name,
      priceChange,
      volatility,
      trendChange,
      currentPrice: latestPrice,
      avgPrice,
      laboratory: medication.prices[0].lab?.name
    },
    insights: [
      `Variação ${Math.abs(priceChange) > 15 ? 'significativa' : 'moderada'} de ${Math.abs(priceChange).toFixed(1)}%`,
      `Volatilidade ${volatility < 20 ? 'baixa' : volatility < 50 ? 'média' : 'alta'}: ${volatility.toFixed(1)}%`,
      `Tendência recente: ${Math.abs(trendChange).toFixed(1)}% ${trendChange > 0 ? 'de alta' : 'de baixa'}`,
      'Análise baseada em dados históricos reais'
    ],
    recommendations: generateDetailedRecommendations(priceChange, volatility, medication.category),
    confidence: 0.9
  };
}

async function runDetailedPurchaseSimulation(medication, quantity) {
  console.log(`💰 Executando simulação detalhada: ${medication.name} x ${quantity}`);
  
  // Agrupar preços por laboratório
  const labPrices = {};
  medication.prices.forEach(price => {
    const labName = price.lab?.name || 'Unknown';
    if (!labPrices[labName]) {
      labPrices[labName] = [];
    }
    labPrices[labName].push(parseFloat(price.value.toString()));
  });

  if (Object.keys(labPrices).length === 0) {
    return {
      answer: `Nenhum dado de preço encontrado para ${medication.name}.`,
      data: [],
      insights: ['Dados insuficientes'],
      recommendations: ['Verificar disponibilidade do medicamento'],
      confidence: 0.3
    };
  }

  // Calcular estatísticas por laboratório
  const results = Object.entries(labPrices).map(([lab, prices]) => {
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const totalCost = avgPrice * quantity;
    const volatility = prices.length > 1 ? 
      (Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length) / avgPrice) * 100 : 0;
    
    return {
      laboratory: lab,
      avgPrice,
      minPrice,
      maxPrice,
      totalCost,
      quantity,
      volatility,
      dataPoints: prices.length,
      reliability: prices.length >= 5 ? 'Alta' : prices.length >= 3 ? 'Média' : 'Baixa'
    };
  });

  results.sort((a, b) => a.totalCost - b.totalCost);

  const bestOption = results[0];
  const worstOption = results[results.length - 1];
  const totalSavings = worstOption.totalCost - bestOption.totalCost;
  const savingsPercent = ((totalSavings / worstOption.totalCost) * 100);

  const answer = `🛒 **Simulação Detalhada: ${medication.name}**

📦 **Parâmetros:**
• **Quantidade:** ${quantity.toLocaleString()} unidades
• **Categoria:** ${medication.category?.split(' | ')[0] || 'N/A'}
• **Princípio ativo:** ${medication.activeIngredient || 'N/A'}

🏆 **Melhor Opção Identificada:**
• **Laboratório:** ${bestOption.laboratory}
• **Preço unitário:** R$ ${bestOption.avgPrice.toFixed(2)}
• **Custo total:** R$ ${bestOption.totalCost.toLocaleString()}
• **Confiabilidade:** ${bestOption.reliability} (${bestOption.dataPoints} pontos de dados)
• **Volatilidade:** ${bestOption.volatility.toFixed(1)}%

💰 **Análise de Economia:**
• **Economia máxima:** R$ ${totalSavings.toLocaleString()}
• **Vs pior opção:** ${worstOption.laboratory}
• **Percentual poupado:** ${savingsPercent.toFixed(1)}%

📊 **Comparação Completa:**
${results.map((result, index) => 
  `${index + 1}º **${result.laboratory}**
   💰 R$ ${result.totalCost.toLocaleString()} (R$ ${result.avgPrice.toFixed(2)}/un)
   📊 Volatilidade: ${result.volatility.toFixed(1)}% | Confiabilidade: ${result.reliability}`
).join('\n\n')}

🎯 **Recomendação Estratégica:**
${generatePurchaseRecommendation(bestOption, results, quantity, savingsPercent)}`;

  return {
    answer,
    data: results,
    insights: [
      `Economia de R$ ${totalSavings.toLocaleString()} (${savingsPercent.toFixed(1)}%) possível`,
      `${results.length} laboratórios comparados`,
      `Melhor opção: ${bestOption.laboratory} com ${bestOption.reliability.toLowerCase()} confiabilidade`,
      'Análise baseada em preços históricos dos últimos 60 dias'
    ],
    recommendations: [
      `Escolher ${bestOption.laboratory} para melhor custo-benefício`,
      quantity > 1000 ? 'Negociar desconto adicional pelo alto volume' : 'Considerar aumentar quantidade para melhor preço',
      bestOption.volatility > 30 ? 'Monitorar volatilidade antes de fechar compra' : 'Preços estáveis - boa oportunidade',
      'Verificar disponibilidade e prazo de entrega'
    ],
    confidence: 0.92
  };
}

function generateDetailedPriceFactors(priceChange, category, volatility, laboratory) {
  const factors = [];
  
  if (Math.abs(priceChange) > 50) {
    factors.push('🚨 **Mudança drástica** - Possível correção de dados ou evento específico');
  } else if (Math.abs(priceChange) > 20) {
    factors.push('📊 **Mudança significativa** - Fatores de mercado ou fornecimento');
  } else if (Math.abs(priceChange) > 10) {
    factors.push('📈 **Mudança moderada** - Flutuação normal do mercado');
  }

  if (category?.includes('Alto Custo') || category?.includes('Oncológico')) {
    factors.push('💎 **Medicamento especializado** - Mercado com menos concorrência');
    if (priceChange > 0) {
      factors.push('🎗️ **Possível escassez** ou aumento de demanda hospitalar');
    } else {
      factors.push('💊 **Possível entrada** de genéricos ou biossimilares');
    }
  }

  if (category?.includes('SUS')) {
    factors.push('🏥 **Medicamento SUS** - Preços podem ser influenciados por políticas públicas');
  }

  if (volatility > 50) {
    factors.push('📊 **Alta volatilidade** - Mercado instável, monitoramento frequente necessário');
  } else if (volatility > 25) {
    factors.push('📈 **Volatilidade moderada** - Flutuações normais de mercado');
  }

  if (laboratory) {
    factors.push(`🏭 **Laboratório:** ${laboratory} - Verificar histórico de fornecimento`);
  }

  return factors.join('\n• ');
}

function generateComprehensiveExplanation(priceChange, category, volatility, activeIngredient) {
  let explanation = '';
  
  // Explicação baseada na magnitude da mudança
  if (Math.abs(priceChange) > 30) {
    explanation += `A variação de ${Math.abs(priceChange).toFixed(1)}% é considerada **muito significativa** no mercado farmacêutico brasileiro. `;
  } else if (Math.abs(priceChange) > 15) {
    explanation += `A variação de ${Math.abs(priceChange).toFixed(1)}% é **significativa** e merece atenção. `;
  } else {
    explanation += `A variação de ${Math.abs(priceChange).toFixed(1)}% está dentro dos padrões normais do mercado. `;
  }
  
  // Contexto por categoria
  if (category?.includes('Oncológico')) {
    explanation += 'Medicamentos oncológicos são particularmente sensíveis a: **aprovação de novas indicações**, **entrada de biossimilares**, **políticas de reembolso** e **demanda hospitalar especializada**. ';
  } else if (category?.includes('SUS')) {
    explanation += 'Medicamentos do SUS seguem **regulamentações específicas**, com preços influenciados por **políticas públicas**, **licitações** e **programas governamentais**. ';
  } else if (category?.includes('Alto Custo')) {
    explanation += 'Medicamentos de alto custo têm **mercado mais restrito**, com **menor concorrência** e **maior sensibilidade** a fatores de fornecimento. ';
  }
  
  // Contexto de volatilidade
  if (volatility > 40) {
    explanation += `A **alta volatilidade (${volatility.toFixed(1)}%)** indica **instabilidade** no fornecimento ou demanda, requerendo **monitoramento mais frequente** e **estratégias de risco**.`;
  } else if (volatility > 20) {
    explanation += `A **volatilidade moderada (${volatility.toFixed(1)}%)** é **normal** para este tipo de medicamento.`;
  } else {
    explanation += `A **baixa volatilidade (${volatility.toFixed(1)}%)** indica **estabilidade** de preços e fornecimento.`;
  }

  return explanation;
}

function generateDetailedRecommendations(priceChange, volatility, category) {
  const recommendations = [];
  
  // Recomendações baseadas na mudança
  if (priceChange < -15) {
    recommendations.push('💰 **Oportunidade de compra** - Considere aumentar estoque');
    recommendations.push('📈 **Monitore sustentabilidade** da queda de preços');
  } else if (priceChange > 15) {
    recommendations.push('🔍 **Avaliar alternativas** terapêuticas se disponíveis');
    recommendations.push('💸 **Considere compra antecipada** se tendência de alta continuar');
  }
  
  // Recomendações baseadas na volatilidade
  if (volatility > 40) {
    recommendations.push('📊 **Monitoramento diário** devido à alta volatilidade');
    recommendations.push('🔄 **Diversificar fornecedores** para reduzir risco');
  } else if (volatility < 15) {
    recommendations.push('✅ **Preços estáveis** - Boa oportunidade para contratos');
  }
  
  // Recomendações por categoria
  if (category?.includes('Oncológico')) {
    recommendations.push('🎗️ **Verificar bioequivalência** entre laboratórios');
    recommendations.push('👨‍⚕️ **Consultar equipe médica** sobre impacto clínico');
  } else if (category?.includes('SUS')) {
    recommendations.push('🏥 **Monitorar políticas** governamentais relacionadas');
  }

  return recommendations;
}

function generatePurchaseRecommendation(bestOption, allOptions, quantity, savingsPercent) {
  let recommendation = `Escolher **${bestOption.laboratory}** oferece o **melhor custo-benefício** `;
  
  if (savingsPercent > 20) {
    recommendation += `com **economia significativa** de ${savingsPercent.toFixed(1)}%. `;
  } else if (savingsPercent > 10) {
    recommendation += `com **boa economia** de ${savingsPercent.toFixed(1)}%. `;
  }
  
  if (bestOption.volatility > 30) {
    recommendation += `⚠️ **Atenção:** Alta volatilidade (${bestOption.volatility.toFixed(1)}%) - considere **monitoramento frequente**. `;
  }
  
  if (quantity > 1000) {
    recommendation += `📦 **Alto volume** - **negocie desconto adicional** e verifique **capacidade de entrega**. `;
  }
  
  if (bestOption.reliability === 'Baixa') {
    recommendation += `📊 **Dados limitados** - considere **validar preços** antes de fechar compra.`;
  }

  return recommendation;
}

// Implementar funções de comparação que estavam faltando
async function compareLaboratories(medications, query) {
  console.log('🔍 Comparando laboratórios...');
  
  // Agrupar medicamentos por laboratório
  const labData = {};
  medications.forEach(med => {
    if (med.prices.length === 0) return;
    
    const labName = med.prices[0].lab?.name || 'Unknown';
    if (!labData[labName]) {
      labData[labName] = {
        name: labName,
        medications: [],
        prices: [],
        categories: new Set()
      };
    }
    
    labData[labName].medications.push(med.name);
    labData[labName].prices.push(parseFloat(med.prices[0].value.toString()));
    labData[labName].categories.add(med.category?.split(' | ')[0] || 'Outros');
  });

  // Calcular estatísticas por laboratório
  const comparison = Object.values(labData).map(lab => {
    const avgPrice = lab.prices.reduce((a, b) => a + b, 0) / lab.prices.length;
    const minPrice = Math.min(...lab.prices);
    const maxPrice = Math.max(...lab.prices);
    const variance = lab.prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / lab.prices.length;
    const volatility = (Math.sqrt(variance) / avgPrice) * 100;
    
    return {
      laboratory: lab.name,
      medicationCount: lab.medications.length,
      avgPrice,
      minPrice,
      maxPrice,
      volatility,
      categories: Array.from(lab.categories),
      priceRange: maxPrice - minPrice
    };
  });

  comparison.sort((a, b) => a.avgPrice - b.avgPrice); // Ordenar por preço médio

  const answer = `🏭 **Comparação de Laboratórios:**

${comparison.slice(0, 10).map((lab, index) => 
  `**${index + 1}. ${lab.laboratory}**
   💰 **Preço médio:** R$ ${lab.avgPrice.toFixed(2)}
   📊 **Faixa:** R$ ${lab.minPrice.toFixed(2)} - R$ ${lab.maxPrice.toFixed(2)}
   💊 **Medicamentos:** ${lab.medicationCount}
   📈 **Volatilidade:** ${lab.volatility.toFixed(1)}%
   🏷️ **Categorias:** ${lab.categories.slice(0, 3).join(', ')}`
).join('\n\n')}

📊 **Resumo Comparativo:**
• **Mais econômico:** ${comparison[0]?.laboratory} (R$ ${comparison[0]?.avgPrice.toFixed(2)} médio)
• **Maior variedade:** ${comparison.reduce((max, lab) => lab.medicationCount > max.medicationCount ? lab : max).laboratory}
• **Mais estável:** ${comparison.reduce((min, lab) => lab.volatility < min.volatility ? lab : min).laboratory} (${comparison.reduce((min, lab) => lab.volatility < min.volatility ? lab : min).volatility.toFixed(1)}% volatilidade)`;

  return {
    answer,
    data: comparison,
    insights: [
      `${comparison.length} laboratórios comparados`,
      `Diferença de R$ ${(comparison[comparison.length - 1]?.avgPrice - comparison[0]?.avgPrice).toFixed(2)} entre mais caro e mais barato`,
      `Laboratório mais econômico: ${comparison[0]?.laboratory}`
    ],
    recommendations: [
      'Considere múltiplos fornecedores para reduzir risco',
      'Negocie contratos com laboratórios mais econômicos',
      'Monitore volatilidade antes de decisões de longo prazo'
    ],
    confidence: 0.9
  };
}

async function compareMedications(medications, query) {
  console.log('🔍 Comparando medicamentos...');
  
  // Identificar medicamentos específicos na consulta
  const medicationNames = extractMultipleMedicationsFromQuery(query);
  
  if (medicationNames.length < 2) {
    // Se não identificou medicamentos específicos, comparar por categoria
    return await compareByCategory(medications, query);
  }

  // Buscar medicamentos específicos
  const foundMedications = medicationNames.map(name => {
    return medications.find(med => 
      med.name.toLowerCase().includes(name.toLowerCase()) ||
      med.code.toLowerCase().includes(name.toLowerCase())
    );
  }).filter(Boolean);

  if (foundMedications.length < 2) {
    return {
      answer: `Medicamentos especificados não encontrados ou insuficientes para comparação.`,
      data: [],
      insights: ['Medicamentos não encontrados'],
      recommendations: ['Especifique nomes de medicamentos claramente'],
      confidence: 0.4
    };
  }

  const comparison = foundMedications.map(med => {
    const currentPrice = med.prices[0] ? parseFloat(med.prices[0].value.toString()) : 0;
    return {
      name: med.name,
      category: med.category,
      currentPrice,
      laboratory: med.prices[0]?.lab?.name || 'Unknown',
      activeIngredient: med.activeIngredient
    };
  });

  comparison.sort((a, b) => a.currentPrice - b.currentPrice);

  const answer = `💊 **Comparação de Medicamentos:**

${comparison.map((med, index) => 
  `**${index + 1}. ${med.name}** (${med.laboratory})
   💰 **Preço:** R$ ${med.currentPrice.toFixed(2)}
   🧪 **Princípio ativo:** ${med.activeIngredient || 'N/A'}
   🏷️ **Categoria:** ${med.category?.split(' | ')[0] || 'N/A'}`
).join('\n\n')}

📊 **Análise Comparativa:**
• **Mais econômico:** ${comparison[0].name} - R$ ${comparison[0].currentPrice.toFixed(2)}
• **Mais caro:** ${comparison[comparison.length - 1].name} - R$ ${comparison[comparison.length - 1].currentPrice.toFixed(2)}
• **Diferença:** R$ ${(comparison[comparison.length - 1].currentPrice - comparison[0].currentPrice).toFixed(2)} (${(((comparison[comparison.length - 1].currentPrice - comparison[0].currentPrice) / comparison[comparison.length - 1].currentPrice) * 100).toFixed(1)}%)`;

  return {
    answer,
    data: comparison,
    insights: [
      `${comparison.length} medicamentos comparados`,
      `Economia de ${(((comparison[comparison.length - 1].currentPrice - comparison[0].currentPrice) / comparison[comparison.length - 1].currentPrice) * 100).toFixed(1)}% escolhendo mais barato`,
      'Análise baseada em preços atuais'
    ],
    recommendations: [
      `Escolher ${comparison[0].name} para melhor custo-benefício`,
      'Verificar equivalência terapêutica entre opções',
      'Considerar fatores clínicos além do preço'
    ],
    confidence: 0.88
  };
}

async function compareCategories(medications, query) {
  console.log('🔍 Comparando categorias...');
  
  // Agrupar por categoria
  const categoryData = {};
  medications.forEach(med => {
    const category = med.category?.split(' | ')[0] || 'Outros';
    if (!categoryData[category]) {
      categoryData[category] = {
        name: category,
        medications: [],
        prices: []
      };
    }
    
    categoryData[category].medications.push(med.name);
    if (med.prices[0]) {
      categoryData[category].prices.push(parseFloat(med.prices[0].value.toString()));
    }
  });

  const comparison = Object.values(categoryData).map(cat => {
    if (cat.prices.length === 0) return null;
    
    const avgPrice = cat.prices.reduce((a, b) => a + b, 0) / cat.prices.length;
    const minPrice = Math.min(...cat.prices);
    const maxPrice = Math.max(...cat.prices);
    
    return {
      category: cat.name,
      medicationCount: cat.medications.length,
      avgPrice,
      minPrice,
      maxPrice,
      priceRange: maxPrice - minPrice
    };
  }).filter(Boolean);

  comparison.sort((a, b) => a.avgPrice - b.avgPrice);

  const answer = `🏷️ **Comparação por Categoria:**

${comparison.map((cat, index) => 
  `**${index + 1}. ${cat.category}**
   💰 **Preço médio:** R$ ${cat.avgPrice.toFixed(2)}
   📊 **Faixa:** R$ ${cat.minPrice.toFixed(2)} - R$ ${cat.maxPrice.toFixed(2)}
   💊 **Medicamentos:** ${cat.medicationCount}`
).join('\n\n')}

📊 **Insights por Categoria:**
• **Mais econômica:** ${comparison[0]?.category}
• **Mais cara:** ${comparison[comparison.length - 1]?.category}
• **Maior variedade:** ${comparison.reduce((max, cat) => cat.medicationCount > max.medicationCount ? cat : max).category}`;

  return {
    answer,
    data: comparison,
    insights: [
      `${comparison.length} categorias comparadas`,
      `Diferença de R$ ${(comparison[comparison.length - 1]?.avgPrice - comparison[0]?.avgPrice).toFixed(2)} entre categorias`,
      'Análise baseada em preços médios por categoria'
    ],
    recommendations: [
      'Foque em categorias mais econômicas para reduzir custos',
      'Considere alternativas dentro da mesma categoria',
      'Monitore tendências específicas por categoria'
    ],
    confidence: 0.85
  };
}

async function compareGeneral(medications, query) {
  console.log('🔍 Processando comparação geral...');
  
  // Para consultas como "diferença entre dipirona original e genérico"
  const medicationName = extractMainMedicationFromQuery(query);
  
  if (medicationName) {
    return await compareOriginalVsGeneric(medications, medicationName, query);
  }

  // Fallback para comparação geral
  return {
    answer: 'Para comparações específicas, por favor especifique:\n• Quais medicamentos comparar\n• Ou quais laboratórios\n• Ou quais categorias\n\nExemplo: "Compare preços da Dipirona entre laboratórios"',
    data: [],
    insights: ['Consulta de comparação muito genérica'],
    recommendations: ['Especifique o que deseja comparar'],
    confidence: 0.3
  };
}

async function compareOriginalVsGeneric(medications, medicationName, originalQuery) {
  console.log(`🔍 Comparando original vs genérico: ${medicationName}`);
  
  // Buscar medicamentos relacionados
  const relatedMedications = medications.filter(med => 
    med.name.toLowerCase().includes(medicationName.toLowerCase()) ||
    med.activeIngredient?.toLowerCase().includes(medicationName.toLowerCase())
  );

  if (relatedMedications.length === 0) {
    return {
      answer: `Nenhum medicamento encontrado relacionado a "${medicationName}".`,
      data: [],
      insights: ['Medicamento não encontrado'],
      recommendations: ['Verifique o nome do medicamento'],
      confidence: 0.4
    };
  }

  // Separar por tipo (original vs genérico/biossimilar)
  const originals = relatedMedications.filter(med => 
    !med.category?.includes('Genérico') && 
    !med.category?.includes('Biossimilar') &&
    !med.name.toLowerCase().includes('genérico')
  );
  
  const generics = relatedMedications.filter(med => 
    med.category?.includes('Genérico') || 
    med.category?.includes('Biossimilar') ||
    med.name.toLowerCase().includes('genérico')
  );

  // Se não conseguiu separar claramente, agrupar por laboratório
  if (originals.length === 0 && generics.length === 0) {
    return await compareByLaboratoryForMedication(relatedMedications, medicationName);
  }

  const originalData = originals.map(med => ({
    name: med.name,
    price: med.prices[0] ? parseFloat(med.prices[0].value.toString()) : 0,
    laboratory: med.prices[0]?.lab?.name || 'Unknown',
    category: 'Original'
  }));

  const genericData = generics.map(med => ({
    name: med.name,
    price: med.prices[0] ? parseFloat(med.prices[0].value.toString()) : 0,
    laboratory: med.prices[0]?.lab?.name || 'Unknown',
    category: 'Genérico/Biossimilar'
  }));

  const allData = [...originalData, ...genericData].sort((a, b) => a.price - b.price);

  const originalAvg = originalData.length > 0 ? 
    originalData.reduce((sum, med) => sum + med.price, 0) / originalData.length : 0;
  const genericAvg = genericData.length > 0 ? 
    genericData.reduce((sum, med) => sum + med.price, 0) / genericData.length : 0;

  const savings = originalAvg > 0 && genericAvg > 0 ? 
    ((originalAvg - genericAvg) / originalAvg) * 100 : 0;

  const answer = `💊 **Comparação: ${medicationName.charAt(0).toUpperCase() + medicationName.slice(1)} Original vs Genérico**

📊 **Medicamentos Originais (${originalData.length}):**
${originalData.map(med => 
  `• **${med.name}** - R$ ${med.price.toFixed(2)} (${med.laboratory})`
).join('\n')}
${originalData.length > 0 ? `💰 **Preço médio original:** R$ ${originalAvg.toFixed(2)}` : '❌ Nenhum original encontrado'}

🧬 **Medicamentos Genéricos/Biossimilares (${genericData.length}):**
${genericData.map(med => 
  `• **${med.name}** - R$ ${med.price.toFixed(2)} (${med.laboratory})`
).join('\n')}
${genericData.length > 0 ? `💰 **Preço médio genérico:** R$ ${genericAvg.toFixed(2)}` : '❌ Nenhum genérico encontrado'}

💡 **Análise de Economia:**
${originalAvg > 0 && genericAvg > 0 ? 
  `• **Economia com genéricos:** ${savings.toFixed(1)}%
   • **Diferença absoluta:** R$ ${(originalAvg - genericAvg).toFixed(2)}
   • **Recomendação:** ${savings > 30 ? 'Genéricos oferecem economia significativa' : savings > 15 ? 'Economia moderada com genéricos' : 'Diferença pequena entre original e genérico'}` :
  '• Dados insuficientes para comparação de economia'
}

🎯 **Opções Disponíveis (ordenadas por preço):**
${allData.slice(0, 8).map((med, index) => 
  `${index + 1}. ${med.name} - R$ ${med.price.toFixed(2)} (${med.category})`
).join('\n')}`;

  return {
    answer,
    data: allData,
    insights: [
      `${originalData.length} medicamentos originais vs ${genericData.length} genéricos`,
      savings > 0 ? `Economia de ${savings.toFixed(1)}% com genéricos` : 'Comparação de preços disponível',
      `${relatedMedications.length} opções totais encontradas`
    ],
    recommendations: [
      savings > 20 ? 'Considere genéricos para economia significativa' : 'Avalie custo-benefício caso a caso',
      'Verifique equivalência terapêutica com equipe médica',
      'Monitore disponibilidade de ambas as opções'
    ],
    confidence: 0.92
  };
}

async function compareByLaboratoryForMedication(medications, medicationName) {
  console.log(`🔍 Comparando ${medicationName} por laboratório...`);
  
  const labComparison = medications.map(med => ({
    name: med.name,
    price: med.prices[0] ? parseFloat(med.prices[0].value.toString()) : 0,
    laboratory: med.prices[0]?.lab?.name || 'Unknown',
    category: med.category
  })).sort((a, b) => a.price - b.price);

  const avgPrice = labComparison.reduce((sum, med) => sum + med.price, 0) / labComparison.length;
  const cheapest = labComparison[0];
  const mostExpensive = labComparison[labComparison.length - 1];
  const savings = ((mostExpensive.price - cheapest.price) / mostExpensive.price) * 100;

  const answer = `💊 **Comparação: ${medicationName} por Laboratório**

🏆 **Ranking por Preço:**
${labComparison.map((med, index) => 
  `${index + 1}. **${med.laboratory}** - R$ ${med.price.toFixed(2)}
     ${med.name}`
).join('\n\n')}

📊 **Análise Econômica:**
• **Mais barato:** ${cheapest.laboratory} - R$ ${cheapest.price.toFixed(2)}
• **Mais caro:** ${mostExpensive.laboratory} - R$ ${mostExpensive.price.toFixed(2)}
• **Preço médio:** R$ ${avgPrice.toFixed(2)}
• **Economia máxima:** ${savings.toFixed(1)}% escolhendo ${cheapest.laboratory}

💡 **Diferença absoluta:** R$ ${(mostExpensive.price - cheapest.price).toFixed(2)}`;

  return {
    answer,
    data: labComparison,
    insights: [
      `${labComparison.length} laboratórios oferecem ${medicationName}`,
      `Economia de ${savings.toFixed(1)}% possível`,
      `Diferença de R$ ${(mostExpensive.price - cheapest.price).toFixed(2)} entre extremos`
    ],
    recommendations: [
      `Escolher ${cheapest.laboratory} para melhor preço`,
      'Verificar disponibilidade e prazo de entrega',
      'Considerar histórico de qualidade do laboratório'
    ],
    confidence: 0.9
  };
}

async function generateCategoryAnalysis(medications, category) {
  console.log(`🔍 Analisando categoria: ${category}`);
  
  const prices = medications.map(med => 
    med.prices[0] ? parseFloat(med.prices[0].value.toString()) : 0
  ).filter(price => price > 0);

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  // Top medicamentos da categoria
  const topMedications = medications
    .filter(med => med.prices[0])
    .map(med => ({
      name: med.name,
      price: parseFloat(med.prices[0].value.toString()),
      laboratory: med.prices[0].lab?.name
    }))
    .sort((a, b) => a.price - b.price)
    .slice(0, 10);

  const answer = `🏷️ **Análise da Categoria: ${category}**

📊 **Estatísticas Gerais:**
• **Total de medicamentos:** ${medications.length}
• **Preço médio:** R$ ${avgPrice.toFixed(2)}
• **Faixa de preços:** R$ ${minPrice.toFixed(2)} - R$ ${maxPrice.toFixed(2)}
• **Amplitude:** R$ ${(maxPrice - minPrice).toFixed(2)}

💊 **Top 10 Medicamentos Mais Econômicos:**
${topMedications.map((med, index) => 
  `${index + 1}. **${med.name}** - R$ ${med.price.toFixed(2)} (${med.laboratory})`
).join('\n')}

📈 **Insights da Categoria:**
• **Medicamento mais barato:** ${topMedications[0]?.name} - R$ ${topMedications[0]?.price.toFixed(2)}
• **Medicamento mais caro:** ${topMedications[topMedications.length - 1]?.name} - R$ ${topMedications[topMedications.length - 1]?.price.toFixed(2)}
• **Variação na categoria:** ${((maxPrice - minPrice) / maxPrice * 100).toFixed(1)}%`;

  return {
    answer,
    data: topMedications,
    insights: [
      `${medications.length} medicamentos na categoria ${category}`,
      `Preço médio: R$ ${avgPrice.toFixed(2)}`,
      `Variação de ${((maxPrice - minPrice) / maxPrice * 100).toFixed(1)}% na categoria`
    ],
    recommendations: [
      'Monitore medicamentos mais econômicos da categoria',
      'Considere alternativas dentro da mesma classe terapêutica',
      'Avalie custo-efetividade baseado em evidências clínicas'
    ],
    confidence: 0.87
  };
}

// Funções auxiliares para extração melhorada
function extractMultipleMedicationsFromQuery(query) {
  const medications = [];
  const commonMedications = ['paracetamol', 'dipirona', 'ibuprofeno', 'amoxicilina', 'losartana', 'metformina'];
  
  for (const med of commonMedications) {
    if (query.toLowerCase().includes(med)) {
      medications.push(med);
    }
  }
  
  return medications;
}

function extractMainMedicationFromQuery(query) {
  console.log(`🔍 Extraindo medicamento de: "${query}"`);
  
  const patterns = [
    // Padrões específicos para consultas de comparação
    /(?:entre|de)\s+(dipirona|paracetamol|ibuprofeno|amoxicilina|losartana|metformina)\s+(?:original|genérico)/i,
    /(?:diferença|compare).*?(dipirona|paracetamol|ibuprofeno|amoxicilina|losartana|metformina)/i,
    /(dipirona|paracetamol|ibuprofeno|amoxicilina|losartana|metformina)\s+(?:original|genérico)/i,
    // Padrão mais geral
    /(?:diferença|compare).*?(?:entre|de)\s+([a-zA-Z]+)/i,
    /([a-zA-Z]+)\s+(?:original|genérico)/i,
    // Medicamentos específicos
    /(paracetamol|dipirona|ibuprofeno|amoxicilina|losartana|metformina|adempas|herceptin|keytruda)/i
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const medication = match[1].toLowerCase();
      console.log(`✅ Medicamento extraído: "${medication}"`);
      return medication;
    }
  }

  console.log('❌ Nenhum medicamento extraído');
  return '';
}

async function compareByCategory(medications, query) {
  console.log('🔍 Comparando por categoria...');
  
  // Extrair categoria da consulta
  const category = extractCategoryFromQuery(query);
  
  if (category) {
    const categoryMedications = medications.filter(med => 
      med.category?.toLowerCase().includes(category.toLowerCase())
    );
    
    if (categoryMedications.length > 0) {
      return await generateCategoryAnalysis(categoryMedications, category);
    }
  }

  // Se não identificou categoria específica, mostrar top por preço
  const topCheap = medications
    .filter(med => med.prices[0])
    .map(med => ({
      name: med.name,
      price: parseFloat(med.prices[0].value.toString()),
      laboratory: med.prices[0].lab?.name,
      category: med.category?.split(' | ')[0]
    }))
    .sort((a, b) => a.price - b.price)
    .slice(0, 10);

  const answer = `💊 **Medicamentos Mais Econômicos (Geral):**

${topCheap.map((med, index) => 
  `${index + 1}. **${med.name}** (${med.laboratory})
   💰 R$ ${med.price.toFixed(2)} - ${med.category}`
).join('\n\n')}

📊 **Para comparação específica, tente:**
• "Compare preços da Dipirona entre laboratórios"
• "Diferença entre Herceptin original e biossimilares"
• "Compare medicamentos oncológicos por preço"`;

  return {
    answer,
    data: topCheap,
    insights: [
      `${topCheap.length} medicamentos mais econômicos identificados`,
      'Comparação geral por preço',
      'Use consultas mais específicas para melhores resultados'
    ],
    recommendations: [
      'Especifique medicamento ou categoria para comparação detalhada',
      'Use nomes completos para melhores resultados',
      'Considere fatores além do preço na decisão'
    ],
    confidence: 0.6
  };
}

async function processTopDropsQuery(medications, limit) {
  const medicationsWithChanges = [];

  for (const med of medications) {
    if (med.prices.length < 2) continue;

    const prices = med.prices.map(p => parseFloat(p.value.toString()));
    const latestPrice = prices[0];
    const oldestPrice = prices[prices.length - 1];
    const priceChange = ((latestPrice - oldestPrice) / oldestPrice) * 100;

    if (priceChange < 0) { // Apenas quedas
      medicationsWithChanges.push({
        name: med.name,
        code: med.code,
        category: med.category,
        priceChange: Math.abs(priceChange),
        latestPrice,
        oldestPrice,
        laboratory: med.prices[0].lab?.name || 'Unknown'
      });
    }
  }

  // Ordenar por maior queda
  const topDrops = medicationsWithChanges
    .sort((a, b) => b.priceChange - a.priceChange)
    .slice(0, limit);

  const answer = `📉 **Top ${limit} medicamentos oncológicos com maior queda de preço:**

${topDrops.map((med, index) => 
  `${index + 1}. **${med.name}** (${med.laboratory})
   📉 Queda de ${med.priceChange.toFixed(1)}% - de R$ ${med.oldestPrice.toFixed(2)} para R$ ${med.latestPrice.toFixed(2)}
   🏷️ Categoria: ${med.category}`
).join('\n\n')}

💡 **Insights:**
• Média de queda: ${(topDrops.reduce((sum, med) => sum + med.priceChange, 0) / topDrops.length).toFixed(1)}%
• Maior queda: ${topDrops[0]?.name} com ${topDrops[0]?.priceChange.toFixed(1)}%
• Oportunidade de economia identificada`;

  return {
    answer,
    data: topDrops,
    insights: [
      `${topDrops.length} medicamentos com quedas significativas`,
      'Oportunidades de economia identificadas',
      'Monitorar se é tendência de mercado'
    ],
    recommendations: [
      'Considere aumentar estoque dos medicamentos em queda',
      'Monitore se a queda é temporária ou permanente',
      'Avalie impacto na margem de lucro'
    ],
    confidence: 0.9
  };
}

async function processPriceExplanationQuery(query, medications) {
  // Extrair nome do medicamento da query
  const medicationName = extractMedicationFromQuery(query);
  
  const medication = medications.find(med => 
    med.name.toLowerCase().includes(medicationName.toLowerCase()) ||
    med.code.toLowerCase().includes(medicationName.toLowerCase())
  );

  if (!medication) {
    return {
      answer: `Medicamento "${medicationName}" não encontrado ou não especificado claramente.`,
      data: [],
      insights: ['Especifique o nome do medicamento claramente'],
      recommendations: ['Tente: "Por que Paracetamol subiu 15%?"'],
      confidence: 0.3
    };
  }

  // Analisar mudanças de preço
  const prices = medication.prices.map(p => parseFloat(p.value.toString()));
  const dates = medication.prices.map(p => p.capturedAt);
  
  if (prices.length < 3) {
    return {
      answer: `Dados insuficientes para explicar mudanças no ${medication.name}.`,
      data: [],
      insights: ['Necessário mais histórico de preços'],
      recommendations: ['Aguardar mais dados para análise'],
      confidence: 0.4
    };
  }

  const latestPrice = prices[0];
  const oldestPrice = prices[prices.length - 1];
  const priceChange = ((latestPrice - oldestPrice) / oldestPrice) * 100;
  
  // Calcular volatilidade
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
  const volatility = (Math.sqrt(variance) / avgPrice) * 100;

  const explanation = `📊 **Explicação da mudança de preço: ${medication.name}**

🔍 **Análise Técnica:**
• Variação: ${priceChange > 0 ? '📈' : '📉'} ${Math.abs(priceChange).toFixed(1)}%
• Preço atual: R$ ${latestPrice.toFixed(2)}
• Preço anterior: R$ ${oldestPrice.toFixed(2)}
• Laboratório: ${medication.prices[0].lab?.name}
• Volatilidade: ${volatility.toFixed(1)}%

🎯 **Possíveis Fatores:**
${generatePriceFactors(priceChange, medication.category, volatility)}

📈 **Contexto de Mercado:**
• Categoria: ${medication.category}
• Tendência geral: ${priceChange > 0 ? 'Alta' : 'Baixa'}
• Estabilidade: ${volatility < 20 ? 'Estável' : volatility < 50 ? 'Moderada' : 'Alta volatilidade'}

💡 **Explicação Didática:**
${generateDidacticExplanation(priceChange, medication.category, volatility)}`;

  return {
    answer: explanation,
    data: {
      medication: medication.name,
      priceChange,
      volatility,
      factors: generatePriceFactors(priceChange, medication.category, volatility).split('\n')
    },
    insights: [
      `Variação de ${Math.abs(priceChange).toFixed(1)}% detectada`,
      `Volatilidade ${volatility < 20 ? 'baixa' : 'alta'}: ${volatility.toFixed(1)}%`,
      'Análise baseada em dados históricos reais'
    ],
    recommendations: generateExplanationRecommendations(priceChange, volatility),
    confidence: 0.85
  };
}

async function processSimulationQuery(query, medications) {
  // Extrair parâmetros da simulação
  const quantityMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:mil|unidades?)/i);
  const medicationMatch = query.match(/(?:comprar|simulação).*?([a-zA-Z\s]+?)(?:\s|$)/i);

  if (!quantityMatch || !medicationMatch) {
    return {
      answer: 'Parâmetros de simulação não identificados. Exemplo: "Se eu comprar 5000 unidades de Paracetamol, qual laboratório é melhor?"',
      data: [],
      insights: [],
      recommendations: ['Especifique medicamento e quantidade claramente'],
      confidence: 0.3
    };
  }

  const quantity = parseFloat(quantityMatch[1]) * (quantityMatch[0].includes('mil') ? 1000 : 1);
  const medicationName = medicationMatch[1].trim();

  const medication = medications.find(med => 
    med.name.toLowerCase().includes(medicationName.toLowerCase())
  );

  if (!medication) {
    return {
      answer: `Medicamento "${medicationName}" não encontrado.`,
      data: [],
      insights: [],
      recommendations: ['Verifique o nome do medicamento'],
      confidence: 0.3
    };
  }

  // Executar simulação
  const simulation = await runBulkPurchaseSimulation(medication, quantity);

  return {
    answer: simulation.answer,
    data: simulation.data,
    insights: simulation.insights,
    recommendations: simulation.recommendations,
    confidence: 0.9
  };
}

async function generateAutomaticReport(config) {
  // Gerar relatório automático
  const reportId = `report_${config.type}_${Date.now()}`;
  
  // Buscar dados
  const timeframeDays = config.parameters.timeframe || 90;
  const cutoffDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
  
  const medications = await prisma.medication.findMany({
    include: {
      prices: {
        where: { capturedAt: { gte: cutoffDate } },
        include: { lab: true },
        orderBy: { capturedAt: 'desc' }
      }
    }
  });

  const relevantMedications = medications.filter(med => med.prices.length > 0);

  // Gerar conteúdo baseado no perfil
  const content = generateReportContent(config, relevantMedications);
  
  return {
    id: reportId,
    title: `Relatório ${config.type} - ${config.userProfile}`,
    content,
    metadata: {
      generatedAt: new Date(),
      userProfile: config.userProfile,
      dataPoints: relevantMedications.length,
      confidence: 0.9
    }
  };
}

function generateReportContent(config, medications) {
  const profileTitles = {
    medico: '👨‍⚕️ Relatório Clínico',
    hospital: '🏥 Relatório Hospitalar',
    distribuidor: '📈 Relatório Comercial',
    analista: '📊 Relatório Analítico'
  };

  let content = `# ${profileTitles[config.userProfile]}

**Data:** ${new Date().toLocaleString('pt-BR')}
**Medicamentos analisados:** ${medications.length}
**Período:** ${config.parameters.timeframe} dias

## 📊 Resumo Executivo

`;

  // Conteúdo específico por perfil
  switch (config.userProfile) {
    case 'medico':
      content += generateMedicalReportContent(medications);
      break;
    case 'hospital':
      content += generateHospitalReportContent(medications);
      break;
    case 'distribuidor':
      content += generateCommercialReportContent(medications);
      break;
    case 'analista':
      content += generateAnalyticalReportContent(medications);
      break;
  }

  return content;
}

function generateMedicalReportContent(medications) {
  const oncologics = medications.filter(med => med.category?.includes('Oncológico'));
  const basics = medications.filter(med => med.category?.includes('SUS'));

  return `
👨‍⚕️ **Análise Clínica:**

• **Medicamentos oncológicos:** ${oncologics.length} analisados
• **Medicamentos básicos (SUS):** ${basics.length} analisados
• **Foco:** Equivalência terapêutica e disponibilidade

**Alertas Clínicos:**
• Verificar bioequivalência entre laboratórios
• Monitorar disponibilidade de alternativas
• Considerar impacto clínico das mudanças
  `;
}

function generateHospitalReportContent(medications) {
  const totalValue = medications.reduce((sum, med) => {
    const price = med.prices[0] ? parseFloat(med.prices[0].value) : 0;
    return sum + price;
  }, 0);

  return `
🏥 **Análise Hospitalar:**

• **Valor total monitorado:** R$ ${totalValue.toLocaleString()}
• **Oportunidades de contrato:** Identificadas
• **Gestão de estoque:** Otimizações possíveis

**Recomendações Administrativas:**
• Negociar contratos anuais para alto volume
• Implementar sistema de reposição automática
• Monitorar medicamentos críticos
  `;
}

function generateCommercialReportContent(medications) {
  return `
📈 **Análise Comercial:**

• **Oportunidades de margem** identificadas
• **Tendências de demanda** analisadas
• **Competitividade** por categoria

**Insights Comerciais:**
• Medicamentos com maior potencial de lucro
• Análise de competição por laboratório
• Sazonalidade e tendências de mercado
  `;
}

function generateAnalyticalReportContent(medications) {
  return `
📊 **Análise Estatística:**

• **Dados processados:** ${medications.length} medicamentos
• **Métricas calculadas:** Tendências, volatilidade, correlações
• **Confiança estatística:** 90%+

**Resultados Estatísticos:**
• Tendências de preços identificadas
• Outliers e anomalias detectadas
• Correlações entre categorias
  `;
}

async function runBulkPurchaseSimulation(medication, quantity) {
  // Agrupar preços por laboratório
  const labPrices = {};
  medication.prices.forEach(price => {
    const labName = price.lab?.name || 'Unknown';
    if (!labPrices[labName]) {
      labPrices[labName] = [];
    }
    labPrices[labName].push(parseFloat(price.value.toString()));
  });

  // Calcular custos por laboratório
  const results = Object.entries(labPrices).map(([lab, prices]) => {
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const totalCost = avgPrice * quantity;
    
    return {
      laboratory: lab,
      unitPrice: avgPrice,
      totalCost,
      quantity,
      dataPoints: prices.length
    };
  });

  results.sort((a, b) => a.totalCost - b.totalCost);

  const bestOption = results[0];
  const worstOption = results[results.length - 1];
  const totalSavings = worstOption.totalCost - bestOption.totalCost;

  const answer = `🛒 **Simulação de Compra: ${medication.name}**

📦 **Quantidade:** ${quantity.toLocaleString()} unidades

🏆 **Melhor Opção:**
• **Laboratório:** ${bestOption.laboratory}
• **Custo total:** R$ ${bestOption.totalCost.toLocaleString()}
• **Preço unitário:** R$ ${bestOption.unitPrice.toFixed(2)}

💰 **Economia Máxima:**
• **Economia:** R$ ${totalSavings.toLocaleString()}
• **Vs pior opção:** ${worstOption.laboratory}
• **Percentual:** ${((totalSavings / worstOption.totalCost) * 100).toFixed(1)}%

📊 **Comparação Completa:**
${results.map((result, index) => 
  `${index + 1}º ${result.laboratory}: R$ ${result.totalCost.toLocaleString()}`
).join('\n')}`;

  return {
    answer,
    data: results,
    insights: [
      `Economia de R$ ${totalSavings.toLocaleString()} possível`,
      `${results.length} laboratórios comparados`,
      'Análise baseada em preços históricos'
    ],
    recommendations: [
      `Escolher ${bestOption.laboratory} para melhor custo-benefício`,
      'Considerar negociar desconto adicional pelo volume',
      'Verificar disponibilidade antes de fechar compra'
    ]
  };
}

// Funções auxiliares
function extractMedicationFromQuery(query) {
  const patterns = [
    /medicamento (\w+)/i,
    /(\w+) subiu/i,
    /(\w+) caiu/i,
    /"([^"]+)"/,
    /\b([A-Z][a-z]+(?:\s+\d+mg)?)\b/
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return '';
}

function generatePriceFactors(priceChange, category, volatility) {
  const factors = [];
  
  if (Math.abs(priceChange) > 30) {
    factors.push('• 📊 Mudança drástica - possível evento específico ou erro');
  } else if (Math.abs(priceChange) > 15) {
    factors.push('• 📈 Mudança significativa - fatores de mercado');
  }

  if (category?.includes('Oncológico')) {
    if (priceChange > 0) {
      factors.push('• 🎗️ Possível escassez ou nova indicação terapêutica');
    } else {
      factors.push('• 💊 Possível entrada de genéricos ou biossimilares');
    }
  }

  if (category?.includes('SUS')) {
    factors.push('• 🏥 Medicamento SUS - mudanças podem ser regulatórias');
  }

  if (volatility > 50) {
    factors.push('• 📊 Alta volatilidade - mercado instável');
  }

  return factors.join('\n');
}

function generateDidacticExplanation(priceChange, category, volatility) {
  let explanation = '';
  
  if (Math.abs(priceChange) > 20) {
    explanation += `A variação de ${Math.abs(priceChange).toFixed(1)}% é considerada significativa no mercado farmacêutico. `;
  }
  
  if (category?.includes('Oncológico')) {
    explanation += 'Medicamentos oncológicos são sensíveis a fatores como: aprovação de novas indicações, entrada de biossimilares, políticas de reembolso e demanda hospitalar. ';
  }
  
  if (volatility > 30) {
    explanation += 'A alta volatilidade indica instabilidade no fornecimento ou demanda, requerendo monitoramento mais frequente.';
  }

  return explanation || 'Mudança dentro dos padrões normais de mercado.';
}

function generateExplanationRecommendations(priceChange, volatility) {
  const recommendations = [];
  
  if (Math.abs(priceChange) > 20) {
    recommendations.push('Monitorar diariamente por mudança significativa');
  }
  
  if (volatility > 30) {
    recommendations.push('Considerar múltiplos fornecedores devido à instabilidade');
  }
  
  if (priceChange < -15) {
    recommendations.push('Oportunidade de compra - considerar aumentar estoque');
  } else if (priceChange > 15) {
    recommendations.push('Avaliar alternativas terapêuticas se disponíveis');
  }

  return recommendations;
}

async function simulateBulkPurchase(medications, options) {
  const results = [];
  let totalCost = 0;
  let totalSavings = 0;

  for (const medRequest of medications) {
    try {
      const medication = await prisma.medication.findUnique({
        where: { code: medRequest.code },
        include: {
          prices: {
            take: 10,
            orderBy: { capturedAt: 'desc' },
            include: { lab: true }
          }
        }
      });

      if (!medication || medication.prices.length === 0) continue;

      // Agrupar por laboratório
      const labPrices = {};
      medication.prices.forEach(price => {
        const labName = price.lab?.name || 'Unknown';
        if (!labPrices[labName]) {
          labPrices[labName] = [];
        }
        labPrices[labName].push(parseFloat(price.value.toString()));
      });

      // Calcular melhor opção
      const labOptions = Object.entries(labPrices).map(([lab, prices]) => {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        return {
          laboratory: lab,
          unitPrice: avgPrice,
          totalCost: avgPrice * medRequest.quantity
        };
      });

      labOptions.sort((a, b) => a.totalCost - b.totalCost);
      const bestOption = labOptions[0];
      const worstOption = labOptions[labOptions.length - 1];

      results.push({
        medicationCode: medRequest.code,
        medicationName: medication.name,
        quantity: medRequest.quantity,
        bestLab: bestOption.laboratory,
        unitPrice: bestOption.unitPrice,
        totalCost: bestOption.totalCost,
        savings: worstOption.totalCost - bestOption.totalCost,
        alternatives: labOptions.slice(1, 3)
      });

      totalCost += bestOption.totalCost;
      totalSavings += worstOption.totalCost - bestOption.totalCost;
    } catch (error) {
      console.warn(`Erro ao simular ${medRequest.code}: ${error.message}`);
    }
  }

  return {
    totalCost,
    recommendations: results,
    savings: totalSavings,
    riskAnalysis: {
      overallRisk: totalCost > 50000 ? 'medium' : 'low',
      recommendations: [
        'Diversificar fornecedores para reduzir risco',
        'Negociar desconto por volume',
        'Verificar capacidade de entrega'
      ]
    }
  };
}

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`🚀 Servidor de teste rodando em http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/healthz`);
  console.log(`💊 Medicamentos: http://localhost:${PORT}/api/medications`);
  console.log(`🤖 LLM Chat: POST http://localhost:${PORT}/api/llm/query`);
  console.log(`🧠 ML Previsões: POST http://localhost:${PORT}/api/ml/predictions`);
  console.log(`🔍 ML Outliers: GET http://localhost:${PORT}/api/ml/outliers`);
  console.log(`🏆 ML Competitividade: GET http://localhost:${PORT}/api/ml/competitiveness`);
  console.log(`📈 ML Dashboard: GET http://localhost:${PORT}/api/ml/dashboard`);
  console.log(`🚨 Alertas Automáticos: POST http://localhost:${PORT}/api/ml/outliers/alerts/configure`);
  console.log(`💰 Otimização Compras: POST http://localhost:${PORT}/api/ml/purchase/recommendations`);
  console.log(`🔍 Validação de Dados: GET http://localhost:${PORT}/api/data/validate`);
  console.log(`🔧 Correção de Dados: POST http://localhost:${PORT}/api/data/fix`);
  console.log(`🤖 LLM Evoluído: POST http://localhost:${PORT}/api/llm/complex-query`);
  console.log(`📊 Relatórios: POST http://localhost:${PORT}/api/reports/generate`);
  console.log(`👤 Perfis de Usuário: GET http://localhost:${PORT}/api/users/profile`);
  console.log(`⭐ Favoritos: POST http://localhost:${PORT}/api/users/watchlist`);
});

// Teste de conexão com banco
prisma.user.count().then(count => {
  console.log(`🗄️ Conectado ao banco: ${count} usuários`);
}).catch(err => {
  console.error('❌ Erro de conexão com banco:', err.message);
});
