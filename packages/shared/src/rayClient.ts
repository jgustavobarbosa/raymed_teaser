import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { RayMedication, RayLab, RayPrice, RayPriceHistory } from './types';

export interface RayClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface RayApiEndpoints {
  medications: string;
  labs: string;
  prices: string;
  priceHistory: string;
}

export class RayClient {
  private client: AxiosInstance;
  private config: RayClientConfig;
  private endpoints: RayApiEndpoints;

  constructor(config: RayClientConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    // Endpoints configuráveis via env
    this.endpoints = {
      medications: process.env.RAY_ENDPOINT_MEDICATIONS || '/medicamentos',
      labs: process.env.RAY_ENDPOINT_LABS || '/laboratorios',
      prices: process.env.RAY_ENDPOINT_PRICES || '/precos',
      priceHistory: process.env.RAY_ENDPOINT_PRICE_HISTORY || '/precos/historico',
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[RayClient] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[RayClient] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor com retry logic
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[RayClient] Response ${response.status} from ${response.config.url}`);
        return response;
      },
      async (error) => {
        const config = error.config as AxiosRequestConfig & { _retryCount?: number };
        
        if (!config || !config._retryCount) {
          config._retryCount = 0;
        }

        const shouldRetry = 
          config._retryCount < (this.config.retryAttempts || 3) &&
          (error.response?.status >= 500 || error.code === 'ECONNABORTED' || !error.response);

        if (shouldRetry) {
          config._retryCount++;
          const delay = this.config.retryDelay! * Math.pow(2, config._retryCount - 1); // Exponential backoff
          
          console.warn(`[RayClient] Retry ${config._retryCount}/${this.config.retryAttempts} after ${delay}ms for ${config.url}`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.client.request(config);
        }

        console.error(`[RayClient] Request failed after ${config._retryCount} retries:`, {
          url: config.url,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });

        return Promise.reject(error);
      }
    );
  }

  /**
   * Lista medicamentos com filtros opcionais
   */
  async listMedications(params?: {
    search?: string;
    category?: string;
    lab?: string;
    limit?: number;
    offset?: number;
  }): Promise<RayMedication[]> {
    try {
      const response: AxiosResponse<{ data: RayMedication[] }> = await this.client.get(
        this.endpoints.medications,
        { params }
      );
      
      return response.data.data || response.data;
    } catch (error) {
      console.error('[RayClient] Error listing medications:', error);
      throw new Error(`Falha ao listar medicamentos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Busca detalhes de um medicamento específico
   */
  async getMedication(code: string): Promise<RayMedication | null> {
    try {
      const response: AxiosResponse<{ data: RayMedication }> = await this.client.get(
        `${this.endpoints.medications}/${code}`
      );
      
      return response.data.data || response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      
      console.error('[RayClient] Error getting medication:', error);
      throw new Error(`Falha ao buscar medicamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Lista laboratórios
   */
  async listLabs(): Promise<RayLab[]> {
    try {
      const response: AxiosResponse<{ data: RayLab[] }> = await this.client.get(
        this.endpoints.labs
      );
      
      return response.data.data || response.data;
    } catch (error) {
      console.error('[RayClient] Error listing labs:', error);
      throw new Error(`Falha ao listar laboratórios: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Busca preços atuais de medicamentos
   */
  async getMedicationPrices(
    medicationCode: string,
    options?: {
      from?: Date;
      to?: Date;
      lab?: string;
      limit?: number;
    }
  ): Promise<RayPrice[]> {
    try {
      const params: Record<string, any> = {
        medicamento: medicationCode,
      };

      if (options?.from) {
        params.dataInicio = options.from.toISOString().split('T')[0];
      }
      
      if (options?.to) {
        params.dataFim = options.to.toISOString().split('T')[0];
      }
      
      if (options?.lab) {
        params.laboratorio = options.lab;
      }
      
      if (options?.limit) {
        params.limit = options.limit;
      }

      const response: AxiosResponse<{ data: RayPrice[] }> = await this.client.get(
        this.endpoints.prices,
        { params }
      );
      
      return response.data.data || response.data;
    } catch (error) {
      console.error('[RayClient] Error getting medication prices:', error);
      throw new Error(`Falha ao buscar preços: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Busca histórico de preços
   */
  async getPriceHistory(
    medicationCode: string,
    options?: {
      from?: Date;
      to?: Date;
      lab?: string;
      interval?: 'daily' | 'weekly' | 'monthly';
    }
  ): Promise<RayPriceHistory> {
    try {
      const params: Record<string, any> = {
        medicamento: medicationCode,
      };

      if (options?.from) {
        params.dataInicio = options.from.toISOString().split('T')[0];
      }
      
      if (options?.to) {
        params.dataFim = options.to.toISOString().split('T')[0];
      }
      
      if (options?.lab) {
        params.laboratorio = options.lab;
      }
      
      if (options?.interval) {
        params.intervalo = options.interval;
      }

      const response: AxiosResponse<{ data: RayPriceHistory }> = await this.client.get(
        this.endpoints.priceHistory,
        { params }
      );
      
      return response.data.data || response.data;
    } catch (error) {
      console.error('[RayClient] Error getting price history:', error);
      throw new Error(`Falha ao buscar histórico: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Busca preços mais recentes (para jobs de ingestão)
   */
  async getLatestPrices(since?: Date): Promise<RayPrice[]> {
    try {
      const params: Record<string, any> = {};
      
      if (since) {
        params.desde = since.toISOString();
      }

      const response: AxiosResponse<{ data: RayPrice[] }> = await this.client.get(
        `${this.endpoints.prices}/recentes`,
        { params }
      );
      
      return response.data.data || response.data;
    } catch (error) {
      console.error('[RayClient] Error getting latest prices:', error);
      throw new Error(`Falha ao buscar preços recentes: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Health check da API Ray
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', {
        timeout: 5000,
      });
      
      return response.status === 200;
    } catch (error) {
      console.warn('[RayClient] Health check failed:', error);
      return false;
    }
  }

  /**
   * Testa conectividade com a API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const isHealthy = await this.healthCheck();
      
      if (!isHealthy) {
        return {
          success: false,
          message: 'API Ray não está respondendo'
        };
      }

      // Tenta uma chamada simples
      await this.listMedications({ limit: 1 });
      
      return {
        success: true,
        message: 'Conexão com API Ray estabelecida com sucesso'
      };
    } catch (error) {
      return {
        success: false,
        message: `Falha na conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }
}

// Factory function para criar instância do cliente
export function createRayClient(config?: Partial<RayClientConfig>): RayClient {
  const defaultConfig: RayClientConfig = {
    baseUrl: process.env.RAY_API_BASE || 'https://api.plataformaray.com.br',
    apiKey: process.env.RAY_API_KEY,
    timeout: parseInt(process.env.RAY_API_TIMEOUT || '30000'),
    retryAttempts: parseInt(process.env.RAY_API_RETRY_ATTEMPTS || '3'),
    retryDelay: 1000,
  };

  return new RayClient({ ...defaultConfig, ...config });
}
