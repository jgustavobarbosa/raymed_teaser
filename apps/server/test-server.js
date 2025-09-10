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

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`🚀 Servidor de teste rodando em http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/healthz`);
  console.log(`💊 Medicamentos: http://localhost:${PORT}/api/medications`);
  console.log(`🤖 LLM Chat: POST http://localhost:${PORT}/api/llm/query`);
});

// Teste de conexão com banco
prisma.user.count().then(count => {
  console.log(`🗄️ Conectado ao banco: ${count} usuários`);
}).catch(err => {
  console.error('❌ Erro de conexão com banco:', err.message);
});
