import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ProphetPrediction {
  predictions: Array<{
    date: Date;
    predictedPrice: number;
    confidence: number;
    lowerBound: number;
    upperBound: number;
  }>;
  accuracy: number;
  seasonalityComponents?: {
    trend: number[];
    weekly: number[];
    yearly: number[];
  };
}

export interface HistoricalDataPoint {
  date: Date;
  price: number;
  medication: string;
  laboratory: string;
}

@Injectable()
export class ProphetModel {
  private readonly logger = new Logger(ProphetModel.name);
  private readonly pythonScriptPath = path.join(__dirname, '..', '..', '..', 'python', 'prophet_model.py');

  /**
   * Gera previsões usando Prophet (Facebook/Meta)
   * Excelente para detectar sazonalidade e tendências
   */
  async predict(
    historicalData: HistoricalDataPoint[],
    daysAhead: number = 30
  ): Promise<ProphetPrediction> {
    try {
      this.logger.log(`Iniciando previsão Prophet para ${daysAhead} dias`);

      // Preparar dados para o Prophet
      const preparedData = this.prepareDataForProphet(historicalData);
      
      // Criar arquivo temporário com os dados
      const tempDir = os.tmpdir();
      const inputFile = path.join(tempDir, `prophet_input_${Date.now()}.json`);
      const outputFile = path.join(tempDir, `prophet_output_${Date.now()}.json`);

      fs.writeFileSync(inputFile, JSON.stringify({
        data: preparedData,
        periods: daysAhead,
        freq: 'D', // Daily frequency
        include_history: true,
        uncertainty_samples: 1000,
      }));

      // Executar script Python
      const result = await this.runPythonScript(inputFile, outputFile);
      
      // Limpar arquivos temporários
      this.cleanup([inputFile, outputFile]);

      return result;
    } catch (error) {
      this.logger.error(`Erro no modelo Prophet: ${error.message}`);
      throw new Error(`Prophet prediction failed: ${error.message}`);
    }
  }

  /**
   * Avalia a qualidade da previsão usando dados de teste
   */
  async evaluateModel(
    trainingData: HistoricalDataPoint[],
    testData: HistoricalDataPoint[]
  ): Promise<{
    mape: number; // Mean Absolute Percentage Error
    mae: number;  // Mean Absolute Error
    rmse: number; // Root Mean Square Error
  }> {
    try {
      const prediction = await this.predict(trainingData, testData.length);
      
      let totalAbsError = 0;
      let totalAbsPercentError = 0;
      let totalSquaredError = 0;

      for (let i = 0; i < Math.min(prediction.predictions.length, testData.length); i++) {
        const predicted = prediction.predictions[i].predictedPrice;
        const actual = testData[i].price;
        
        const absError = Math.abs(predicted - actual);
        const absPercentError = Math.abs((predicted - actual) / actual) * 100;
        const squaredError = Math.pow(predicted - actual, 2);

        totalAbsError += absError;
        totalAbsPercentError += absPercentError;
        totalSquaredError += squaredError;
      }

      const n = Math.min(prediction.predictions.length, testData.length);
      
      return {
        mape: totalAbsPercentError / n,
        mae: totalAbsError / n,
        rmse: Math.sqrt(totalSquaredError / n),
      };
    } catch (error) {
      this.logger.error(`Erro na avaliação do modelo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detecta sazonalidade nos dados
   */
  async detectSeasonality(data: HistoricalDataPoint[]): Promise<{
    hasWeeklySeasonality: boolean;
    hasMonthlySeasonality: boolean;
    hasYearlySeasonality: boolean;
    seasonalityStrength: number;
  }> {
    try {
      // Implementação simplificada de detecção de sazonalidade
      // Em produção, usaria análise espectral mais sofisticada
      
      const prices = data.map(d => d.price);
      const dates = data.map(d => d.date);

      // Detectar padrões semanais (7 dias)
      const weeklyCorrelation = this.calculateSeasonalCorrelation(prices, 7);
      
      // Detectar padrões mensais (30 dias)
      const monthlyCorrelation = this.calculateSeasonalCorrelation(prices, 30);
      
      // Detectar padrões anuais (365 dias)
      const yearlyCorrelation = this.calculateSeasonalCorrelation(prices, 365);

      return {
        hasWeeklySeasonality: weeklyCorrelation > 0.3,
        hasMonthlySeasonality: monthlyCorrelation > 0.3,
        hasYearlySeasonality: yearlyCorrelation > 0.3,
        seasonalityStrength: Math.max(weeklyCorrelation, monthlyCorrelation, yearlyCorrelation),
      };
    } catch (error) {
      this.logger.error(`Erro na detecção de sazonalidade: ${error.message}`);
      return {
        hasWeeklySeasonality: false,
        hasMonthlySeasonality: false,
        hasYearlySeasonality: false,
        seasonalityStrength: 0,
      };
    }
  }

  /**
   * Prepara dados no formato esperado pelo Prophet
   */
  private prepareDataForProphet(data: HistoricalDataPoint[]) {
    return data.map(point => ({
      ds: point.date.toISOString().split('T')[0], // Prophet espera formato YYYY-MM-DD
      y: point.price,
    }));
  }

  /**
   * Executa o script Python do Prophet
   */
  private async runPythonScript(inputFile: string, outputFile: string): Promise<ProphetPrediction> {
    return new Promise((resolve, reject) => {
      // Primeiro, tentar criar o script Python se não existir
      this.ensurePythonScript();

      const python = spawn('python3', [this.pythonScriptPath, inputFile, outputFile]);
      
      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${stderr}`));
          return;
        }

        try {
          // Ler resultado do arquivo
          if (fs.existsSync(outputFile)) {
            const result = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
            resolve(this.parseProphetOutput(result));
          } else {
            // Fallback: usar implementação JavaScript simplificada
            this.logger.warn('Python Prophet não disponível, usando fallback');
            resolve(this.fallbackPrediction(inputFile));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Prophet output: ${error.message}`));
        }
      });

      python.on('error', (error) => {
        this.logger.warn(`Python Prophet não disponível: ${error.message}`);
        // Usar implementação fallback
        resolve(this.fallbackPrediction(inputFile));
      });
    });
  }

  /**
   * Cria o script Python do Prophet se não existir
   */
  private ensurePythonScript() {
    const scriptDir = path.dirname(this.pythonScriptPath);
    if (!fs.existsSync(scriptDir)) {
      fs.mkdirSync(scriptDir, { recursive: true });
    }

    if (!fs.existsSync(this.pythonScriptPath)) {
      const pythonScript = `#!/usr/bin/env python3
import sys
import json
import pandas as pd
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

def main():
    if len(sys.argv) != 3:
        print("Usage: python prophet_model.py <input_file> <output_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not PROPHET_AVAILABLE:
        print("Prophet not available, install with: pip install prophet")
        sys.exit(1)
    
    try:
        # Carregar dados
        with open(input_file, 'r') as f:
            config = json.load(f)
        
        # Preparar DataFrame
        df = pd.DataFrame(config['data'])
        df['ds'] = pd.to_datetime(df['ds'])
        
        # Configurar modelo Prophet
        model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=True,
            uncertainty_samples=config.get('uncertainty_samples', 1000)
        )
        
        # Treinar modelo
        model.fit(df)
        
        # Criar datas futuras
        future = model.make_future_dataframe(periods=config['periods'], freq=config.get('freq', 'D'))
        
        # Fazer previsões
        forecast = model.predict(future)
        
        # Calcular acurácia usando dados históricos
        accuracy = calculate_accuracy(df, forecast)
        
        # Preparar saída
        predictions = []
        start_idx = len(df) if not config.get('include_history', False) else 0
        
        for idx in range(start_idx, len(forecast)):
            row = forecast.iloc[idx]
            predictions.append({
                'date': row['ds'].isoformat(),
                'predictedPrice': float(row['yhat']),
                'confidence': 0.95,  # Prophet usa 95% de confiança por padrão
                'lowerBound': float(row['yhat_lower']),
                'upperBound': float(row['yhat_upper'])
            })
        
        result = {
            'predictions': predictions,
            'accuracy': accuracy,
            'components': {
                'trend': forecast['trend'].tail(config['periods']).tolist(),
                'weekly': forecast['weekly'].tail(config['periods']).tolist() if 'weekly' in forecast.columns else [],
                'yearly': forecast['yearly'].tail(config['periods']).tolist() if 'yearly' in forecast.columns else []
            }
        }
        
        # Salvar resultado
        with open(output_file, 'w') as f:
            json.dump(result, f)
        
        print("Prophet prediction completed successfully")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

def calculate_accuracy(df, forecast):
    """Calcula MAPE (Mean Absolute Percentage Error)"""
    try:
        # Usar apenas os dados históricos para calcular acurácia
        historical_forecast = forecast.head(len(df))
        actual = df['y'].values
        predicted = historical_forecast['yhat'].values
        
        mape = 100 * sum(abs((actual - predicted) / actual)) / len(actual)
        return max(0, 100 - mape)  # Converter para porcentagem de acurácia
    except:
        return 75.0  # Valor padrão

if __name__ == "__main__":
    main()
`;

      fs.writeFileSync(this.pythonScriptPath, pythonScript);
      fs.chmodSync(this.pythonScriptPath, 0o755);
    }
  }

  /**
   * Implementação fallback quando Prophet não está disponível
   */
  private fallbackPrediction(inputFile: string): ProphetPrediction {
    try {
      const config = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
      const data = config.data;
      
      // Implementação simplificada usando média móvel com tendência
      const prices = data.map((d: any) => d.y);
      const trend = this.calculateTrend(prices);
      const seasonality = this.detectSimpleSeasonality(prices);
      
      const predictions = [];
      const lastPrice = prices[prices.length - 1];
      const lastDate = new Date(data[data.length - 1].ds);

      for (let i = 1; i <= config.periods; i++) {
        const futureDate = new Date(lastDate);
        futureDate.setDate(futureDate.getDate() + i);
        
        // Previsão simples: último preço + tendência + sazonalidade
        const trendComponent = trend * i;
        const seasonalComponent = seasonality * Math.sin((2 * Math.PI * i) / 7); // Sazonalidade semanal
        const predictedPrice = lastPrice + trendComponent + seasonalComponent;
        
        // Calcular intervalos de confiança (±10%)
        const confidence = Math.max(0.6, 1 - (i * 0.01)); // Confiança diminui com o tempo
        const margin = predictedPrice * 0.1;

        predictions.push({
          date: futureDate,
          predictedPrice: Math.max(0, predictedPrice),
          confidence,
          lowerBound: Math.max(0, predictedPrice - margin),
          upperBound: predictedPrice + margin,
        });
      }

      return {
        predictions,
        accuracy: 70, // Acurácia estimada para o fallback
      };
    } catch (error) {
      throw new Error(`Fallback prediction failed: ${error.message}`);
    }
  }

  /**
   * Converte saída do Prophet para formato interno
   */
  private parseProphetOutput(result: any): ProphetPrediction {
    return {
      predictions: result.predictions.map((pred: any) => ({
        date: new Date(pred.date),
        predictedPrice: pred.predictedPrice,
        confidence: pred.confidence,
        lowerBound: pred.lowerBound,
        upperBound: pred.upperBound,
      })),
      accuracy: result.accuracy,
      seasonalityComponents: result.components,
    };
  }

  /**
   * Calcula correlação sazonal simples
   */
  private calculateSeasonalCorrelation(prices: number[], period: number): number {
    if (prices.length < period * 2) return 0;

    let correlation = 0;
    let count = 0;

    for (let i = period; i < prices.length; i++) {
      const current = prices[i];
      const seasonal = prices[i - period];
      correlation += Math.abs(current - seasonal) / Math.max(current, seasonal);
      count++;
    }

    return count > 0 ? 1 - (correlation / count) : 0;
  }

  /**
   * Calcula tendência simples
   */
  private calculateTrend(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
    const secondHalf = prices.slice(Math.floor(prices.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    return (secondAvg - firstAvg) / (prices.length / 2);
  }

  /**
   * Detecta sazonalidade simples
   */
  private detectSimpleSeasonality(prices: number[]): number {
    const weeklyCorrelation = this.calculateSeasonalCorrelation(prices, 7);
    return weeklyCorrelation * (prices[prices.length - 1] * 0.05); // 5% do preço atual
  }

  /**
   * Limpa arquivos temporários
   */
  private cleanup(files: string[]) {
    files.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error) {
        this.logger.warn(`Falha ao limpar arquivo ${file}: ${error.message}`);
      }
    });
  }
}
