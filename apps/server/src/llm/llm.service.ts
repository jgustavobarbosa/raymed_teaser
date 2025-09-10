import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLLMClient, MedicationQueryProcessor } from '@raymed/shared';

@Injectable()
export class LlmService {
  private llmClient: any = null;
  private queryProcessor: any = null;
  private isLLMAvailable = false;

  constructor(private readonly prisma: PrismaService) {
    try {
      // Verificar se temos as chaves necessárias
      const provider = process.env.LLM_PROVIDER;
      const hasApiKey = process.env.OPENAI_API_KEY || 
                       process.env.ANTHROPIC_API_KEY || 
                       process.env.GOOGLE_API_KEY;

      if (provider && hasApiKey) {
        this.llmClient = createLLMClient();
        this.queryProcessor = new MedicationQueryProcessor(this.llmClient);
        this.isLLMAvailable = true;
        console.log('✅ LLM Client inicializado com sucesso');
      } else {
        console.warn('⚠️ LLM indisponível - sem API key configurada');
      }
    } catch (error) {
      console.warn('⚠️ Falha ao inicializar LLM:', error instanceof Error ? error.message : 'Erro desconhecido');
      this.isLLMAvailable = false;
    }
  }

  async processQuery(question: string) {
    // Verificar se LLM está disponível
    if (!this.isLLMAvailable) {
      return {
        question,
        answer: 'LLM indisponível em dev (sem chave)',
        sources: [],
        confidence: 0,
      };
    }

    try {
      // Obter contexto dos medicamentos e labs disponíveis
      const [medications, labs] = await Promise.all([
        this.prisma.medication.findMany({
          select: { name: true, code: true },
          take: 100,
        }),
        this.prisma.lab.findMany({
          select: { name: true },
          take: 20,
        }),
      ]);

      const context = {
        availableMedications: medications.map(m => m.name),
        availableLabs: labs.map(l => l.name),
      };

      // Processar pergunta e gerar consulta
      const queryResult = await this.queryProcessor.processQuery(question, context);
      
      // Executar consulta no banco
      const data = await this.prisma.$queryRawUnsafe(
        queryResult.sql,
        ...Object.values(queryResult.parameters)
      );

      // Gerar resposta com o LLM
      const response = await this.llmClient.chat([
        {
          role: 'user',
          content: `
Pergunta original: ${question}

Dados encontrados: ${JSON.stringify(data, null, 2)}

Por favor, responda à pergunta de forma clara e em português, citando os dados relevantes.`,
        },
      ], {
        systemPrompt: 'Você é um assistente especializado em preços de medicamentos. Responda de forma clara e objetiva, sempre em português.',
        temperature: 0.3,
      });

      return {
        question,
        answer: response.content,
        sources: this.generateSources(Array.isArray(data) ? data : []),
        confidence: response.confidence,
      };
    } catch (error) {
      throw new Error(`Erro ao processar pergunta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  private generateSources(data: any[]): any[] {
    const sources = [];
    
    for (const row of data.slice(0, 5)) { // Limite de 5 fontes
      if (row.medication_code) {
        sources.push({
          type: 'medication',
          id: row.medication_code,
          name: row.medication_name || row.name,
          url: `/medicamentos/${row.medication_code}`,
          relevantData: {
            price: row.price || row.value,
            lab: row.lab_name,
            date: row.captured_at || row.date,
          },
        });
      }
    }
    
    return sources;
  }
}
