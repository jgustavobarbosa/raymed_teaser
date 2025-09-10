// Cliente real para API Ray com captura de dados completos
require('dotenv').config();
const axios = require('axios');

class RayAPIClient {
  constructor() {
    this.baseURL = process.env.RAY_API_BASE || 'https://api.plataformaray.com.br';
    this.apiKey = process.env.RAY_API_KEY;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      },
    });

    // Interceptor para logs
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🔍 Ray API: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ Ray API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ Ray API: ${response.status} from ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`❌ Ray API Error: ${error.response?.status || error.code} - ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Busca lista de medicamentos
   */
  async listMedicamentos(params = {}) {
    try {
      const response = await this.client.get('/medicamentos', { params });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Erro ao listar medicamentos:', error.message);
      return [];
    }
  }

  /**
   * Busca informações completas de um medicamento
   */
  async getMedicamentoFullInfo(medicamentoId) {
    try {
      const response = await this.client.get(`/medicamentos/${medicamentoId}/full-info/`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`Erro ao buscar info completa de ${medicamentoId}:`, error.message);
      return null;
    }
  }

  /**
   * Busca preços históricos de um medicamento
   */
  async getMedicamentoPrices(medicamentoId, options = {}) {
    try {
      const params = {
        medicamento_id: medicamentoId,
        ...options
      };
      
      const response = await this.client.get('/precos', { params });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error(`Erro ao buscar preços de ${medicamentoId}:`, error.message);
      return [];
    }
  }

  /**
   * Busca laboratórios
   */
  async listLaboratorios() {
    try {
      const response = await this.client.get('/laboratorios');
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Erro ao listar laboratórios:', error.message);
      return [];
    }
  }

  /**
   * Busca medicamentos por nome ou princípio ativo
   */
  async searchMedicamentos(query) {
    try {
      const response = await this.client.get('/medicamentos/search', {
        params: { q: query }
      });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error(`Erro ao buscar medicamentos com query "${query}":`, error.message);
      return [];
    }
  }

  /**
   * Teste de conectividade
   */
  async testConnection() {
    try {
      const response = await this.client.get('/health');
      return {
        success: true,
        status: response.status,
        message: 'Conexão com API Ray estabelecida'
      };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || 0,
        message: `Falha na conexão: ${error.message}`
      };
    }
  }
}

module.exports = { RayAPIClient };
