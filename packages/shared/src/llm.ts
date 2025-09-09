import { LLMMessage, LLMResponse, LLMProvider } from './types';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Wrapper agnóstico para provedores de LLM
 */
export class LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = {
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Envia mensagens para o LLM e recebe resposta
   */
  async chat(
    messages: LLMMessage[],
    options?: {
      tools?: LLMTool[];
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<LLMResponse> {
    const finalMessages = options?.systemPrompt 
      ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
      : messages;

    switch (this.config.provider) {
      case 'openai':
        return this.chatOpenAI(finalMessages, options);
      case 'anthropic':
        return this.chatAnthropic(finalMessages, options);
      case 'gemini':
        return this.chatGemini(finalMessages, options);
      default:
        throw new Error(`Provider ${this.config.provider} não suportado`);
    }
  }

  private async chatOpenAI(
    messages: LLMMessage[],
    options?: { tools?: LLMTool[]; temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: options?.temperature ?? this.config.temperature,
          max_tokens: options?.maxTokens ?? this.config.maxTokens,
          ...(options?.tools && {
            tools: options.tools.map(tool => ({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
          }),
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.choices[0]?.message?.content || '';

      return {
        content,
        confidence: this.calculateConfidence(data.choices[0]?.finish_reason),
      };
    } catch (error) {
      console.error('[LLM] OpenAI error:', error);
      throw new Error(`Falha na comunicação com OpenAI: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  private async chatAnthropic(
    messages: LLMMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    try {
      // Separar system message das outras mensagens
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: conversationMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content,
          })),
          ...(systemMessage && { system: systemMessage.content }),
          temperature: options?.temperature ?? this.config.temperature,
          max_tokens: options?.maxTokens ?? this.config.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.content[0]?.text || '';

      return {
        content,
        confidence: this.calculateConfidence(data.stop_reason),
      };
    } catch (error) {
      console.error('[LLM] Anthropic error:', error);
      throw new Error(`Falha na comunicação com Anthropic: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  private async chatGemini(
    messages: LLMMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: messages.map(msg => ({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }],
            })),
            generationConfig: {
              temperature: options?.temperature ?? this.config.temperature,
              maxOutputTokens: options?.maxTokens ?? this.config.maxTokens,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.candidates[0]?.content?.parts[0]?.text || '';

      return {
        content,
        confidence: this.calculateConfidence(data.candidates[0]?.finishReason),
      };
    } catch (error) {
      console.error('[LLM] Gemini error:', error);
      throw new Error(`Falha na comunicação com Gemini: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  private calculateConfidence(finishReason?: string): number {
    switch (finishReason) {
      case 'stop':
      case 'end_turn':
        return 0.9;
      case 'length':
      case 'max_tokens':
        return 0.7;
      case 'content_filter':
        return 0.3;
      default:
        return 0.5;
    }
  }
}

/**
 * Query processor para converter perguntas em consultas estruturadas
 */
export class MedicationQueryProcessor {
  private llm: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llm = llmClient;
  }

  /**
   * Processa pergunta do usuário e gera consulta SQL segura
   */
  async processQuery(question: string, context?: {
    availableMedications?: string[];
    availableLabs?: string[];
  }): Promise<{
    sql: string;
    parameters: Record<string, any>;
    explanation: string;
  }> {
    const systemPrompt = `
Você é um especialista em análise de dados de medicamentos. Sua função é converter perguntas em português para consultas SQL seguras.

TABELAS DISPONÍVEIS:
- Medication (id, code, name, activeIngredient, category)
- Lab (id, name, cnpj)
- Price (id, medicationId, labId, value, capturedAt, currency)
- Subscription (id, userId, medicationId, labId, targetPrice, minDropPct)
- Alert (id, userId, medicationId, reason, diffPct, createdAt)

REGRAS:
1. SEMPRE use prepared statements com parâmetros ($1, $2, etc.)
2. NUNCA execute consultas que modificam dados (INSERT, UPDATE, DELETE)
3. Limite resultados a 100 registros com LIMIT
4. Use JOINs para relacionar tabelas
5. Para datas, use intervalos como "capturedAt >= NOW() - INTERVAL '30 days'"
6. Para preços, considere apenas os mais recentes por medicamento/lab

EXEMPLOS:
- "Qual o menor preço do paracetamol?" → SELECT com MIN(value) e JOIN
- "Laboratório mais barato para dipirona?" → SELECT com ORDER BY value
- "Variação de preço nos últimos 30 dias" → SELECT com date range e cálculos

Responda APENAS com JSON válido:
{
  "sql": "SELECT ...",
  "parameters": {"param1": "value1"},
  "explanation": "Esta consulta busca..."
}
`;

    const contextInfo = context ? `
CONTEXTO ADICIONAL:
- Medicamentos disponíveis: ${context.availableMedications?.slice(0, 20).join(', ')}
- Laboratórios disponíveis: ${context.availableLabs?.slice(0, 10).join(', ')}
` : '';

    const response = await this.llm.chat([
      {
        role: 'user',
        content: `${contextInfo}

PERGUNTA: ${question}

Gere uma consulta SQL segura para responder esta pergunta.`
      }
    ], { 
      systemPrompt,
      temperature: 0.1,
      maxTokens: 1000 
    });

    try {
      const result = JSON.parse(response.content);
      
      // Validações de segurança
      this.validateQuery(result.sql);
      
      return result;
    } catch (error) {
      throw new Error(`Falha ao processar pergunta: ${error instanceof Error ? error.message : 'Resposta inválida do LLM'}`);
    }
  }

  private validateQuery(sql: string): void {
    const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE'];
    const upperSql = sql.toUpperCase();
    
    for (const keyword of dangerous) {
      if (upperSql.includes(keyword)) {
        throw new Error(`Consulta não permitida: contém ${keyword}`);
      }
    }

    // Verificar se tem LIMIT
    if (!upperSql.includes('LIMIT')) {
      throw new Error('Consulta deve conter LIMIT para evitar sobrecarga');
    }
  }
}

/**
 * Factory function para criar cliente LLM
 */
export function createLLMClient(config?: Partial<LLMConfig>): LLMClient {
  const provider = (config?.provider || process.env.LLM_PROVIDER || 'openai') as LLMConfig['provider'];
  
  const apiKeys = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GOOGLE_API_KEY,
  };

  const models = {
    openai: config?.model || process.env.LLM_MODEL || 'gpt-4o-mini',
    anthropic: config?.model || process.env.LLM_MODEL || 'claude-3-haiku-20240307',
    gemini: config?.model || process.env.LLM_MODEL || 'gemini-1.5-flash',
  };

  const apiKey = apiKeys[provider];
  if (!apiKey) {
    throw new Error(`API key não encontrada para provider ${provider}`);
  }

  return new LLMClient({
    provider,
    model: models[provider],
    apiKey,
    ...config,
  });
}
