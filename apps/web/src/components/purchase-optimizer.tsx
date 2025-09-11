'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, TrendingDown, TrendingUp, AlertTriangle, DollarSign, Calendar, Package } from 'lucide-react';

interface PurchaseRecommendation {
  action: 'buy_now' | 'wait' | 'monitor' | 'urgent_buy';
  laboratory: string;
  currentPrice: number;
  predictedPrice: number;
  expectedSavings: number;
  confidence: number;
  timeframe: string;
  reasoning: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface PurchaseDashboardData {
  urgentActions: Array<{
    medication: string;
    action: string;
    laboratory: string;
    savings: number;
    reason: string;
  }>;
  savingsOpportunities: Array<{
    medication: string;
    laboratory: string;
    savings: number;
    percentage: number;
    trend: 'increasing' | 'decreasing';
  }>;
  marketInsights: string[];
}

export default function PurchaseOptimizer() {
  const [selectedMedication, setSelectedMedication] = useState('');
  const [currentStock, setCurrentStock] = useState(100);
  const [monthlyConsumption, setMonthlyConsumption] = useState(50);
  const [desiredQuantity, setDesiredQuantity] = useState(100);
  const [leadTimeDays, setLeadTimeDays] = useState(7);
  const [safetyStockDays, setSafetyStockDays] = useState(15);
  const [recommendations, setRecommendations] = useState<PurchaseRecommendation[]>([]);
  const [dashboardData, setDashboardData] = useState<PurchaseDashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/server/ml/purchase/dashboard');
      const result = await response.json();
      
      if (result.success) {
        setDashboardData(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/server/ml/purchase/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicationCode: selectedMedication,
          currentStock,
          monthlyConsumption,
          desiredQuantity,
          leadTimeDays,
          safetyStockDays,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setRecommendations(result.data.recommendations || []);
      }
    } catch (error) {
      console.error('Erro ao gerar recomendações:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'urgent_buy':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'buy_now':
        return <ShoppingCart className="h-5 w-5 text-green-600" />;
      case 'wait':
        return <Calendar className="h-5 w-5 text-yellow-600" />;
      default:
        return <Package className="h-5 w-5 text-blue-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'urgent_buy':
        return 'bg-red-50 border-red-200';
      case 'buy_now':
        return 'bg-green-50 border-green-200';
      case 'wait':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority]}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold mb-2">💰 Otimização de Compras</h1>
        <p className="opacity-90">Recomendações inteligentes baseadas em previsões de ML</p>
      </div>

      {/* Dashboard de Oportunidades */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ações Urgentes */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Ações Urgentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.urgentActions.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.urgentActions.map((action, index) => (
                    <div key={index} className="bg-red-50 p-3 rounded border-l-4 border-red-400">
                      <p className="font-medium text-red-800">{action.medication}</p>
                      <p className="text-sm text-red-600">{action.laboratory}</p>
                      <p className="text-xs text-red-500">{action.reason}</p>
                      <p className="text-sm font-bold text-red-700">
                        Economia: R$ {action.savings.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Nenhuma ação urgente</p>
              )}
            </CardContent>
          </Card>

          {/* Oportunidades de Economia */}
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <DollarSign className="h-5 w-5" />
                Oportunidades
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.savingsOpportunities.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.savingsOpportunities.slice(0, 3).map((opp, index) => (
                    <div key={index} className="bg-green-50 p-3 rounded">
                      <p className="font-medium text-green-800">{opp.medication}</p>
                      <p className="text-sm text-green-600">{opp.laboratory}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm font-bold text-green-700">
                          R$ {opp.savings.toFixed(2)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          opp.trend === 'decreasing' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {opp.trend === 'decreasing' ? '↓' : '↑'} {opp.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Nenhuma oportunidade</p>
              )}
            </CardContent>
          </Card>

          {/* Insights de Mercado */}
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <TrendingUp className="h-5 w-5" />
                Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.marketInsights.length > 0 ? (
                <div className="space-y-2">
                  {dashboardData.marketInsights.map((insight, index) => (
                    <div key={index} className="bg-blue-50 p-2 rounded text-sm text-blue-800">
                      {insight}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Carregando insights...</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analisador Individual com Layout Padronizado */}
      <Card className="raymed-card">
        <CardHeader className="raymed-card-header">
          <CardTitle>🔍 Análise Individual de Medicamento</CardTitle>
          <CardDescription>
            Configure estoque e consumo para obter recomendações personalizadas de compra
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {/* Primeira linha - Medicamento e Consumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="form-label">💊 Medicamento:</label>
              <select
                value={selectedMedication}
                onChange={(e) => setSelectedMedication(e.target.value)}
                className="form-select"
              >
                <option value="">Selecione um medicamento</option>
                <option value="PARACETAMOL-500MG">💊 Paracetamol 500mg</option>
                <option value="DIPIRONA-500MG">💊 Dipirona 500mg</option>
                <option value="IBUPROFENO-400MG">💊 Ibuprofeno 400mg</option>
                <option value="ADEMPAS-1-5MG">🫀 Adempas 1,5mg (Alto Custo)</option>
                <option value="HERCEPTIN-440MG">🎗️ Herceptin 440mg (Oncológico)</option>
                <option value="KEYTRUDA-100MG">🧬 Keytruda 100mg (Imunoterapia)</option>
                <option value="AMOXICILINA-500MG">🦠 Amoxicilina 500mg</option>
                <option value="METFORMINA-850MG">💊 Metformina 850mg</option>
              </select>
            </div>
            
            <div>
              <label className="form-label">📊 Consumo Mensal:</label>
              <input
                type="number"
                value={monthlyConsumption}
                onChange={(e) => setMonthlyConsumption(Number(e.target.value))}
                className="form-input"
                placeholder="Ex: 50 unidades/mês"
                min="1"
              />
            </div>
            
            <div>
              <label className="form-label">📦 Estoque Atual:</label>
              <input
                type="number"
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="form-input"
                placeholder="Ex: 100 unidades"
                min="0"
              />
            </div>
          </div>
          
          {/* Segunda linha - Parâmetros de Compra */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="form-label">🛒 Quantidade Desejada:</label>
              <input
                type="number"
                value={desiredQuantity}
                onChange={(e) => setDesiredQuantity(Number(e.target.value))}
                className="form-input"
                placeholder="Ex: 100 unidades"
                min="1"
              />
            </div>
            
            <div>
              <label className="form-label">📅 Lead Time:</label>
              <select
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                className="form-select"
              >
                <option value={3}>3 dias (Urgente)</option>
                <option value={7}>7 dias (Padrão)</option>
                <option value={14}>14 dias (Normal)</option>
                <option value={21}>21 dias (Importação)</option>
              </select>
            </div>
            
            <div>
              <label className="form-label">🛡️ Estoque de Segurança:</label>
              <select
                value={safetyStockDays}
                onChange={(e) => setSafetyStockDays(Number(e.target.value))}
                className="form-select"
              >
                <option value={7}>7 dias (Baixo)</option>
                <option value={15}>15 dias (Padrão)</option>
                <option value={30}>30 dias (Alto)</option>
                <option value={45}>45 dias (Crítico)</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={generateRecommendations}
                disabled={loading || !selectedMedication}
                className="btn-primary w-full"
              >
                {loading ? '⏳ Analisando...' : '🔮 Analisar Compra'}
              </Button>
            </div>
          </div>
          
          {/* Configuração ativa */}
          {selectedMedication && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Configuração atual:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                💊 {selectedMedication.replace('-', ' ').toLowerCase()}
                <button onClick={() => setSelectedMedication('')} className="ml-1 text-blue-600">×</button>
              </span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                📦 Estoque: {currentStock} un
              </span>
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                📊 Consumo: {monthlyConsumption}/mês ({(monthlyConsumption/30).toFixed(1)}/dia)
              </span>
              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                🛒 Comprar: {desiredQuantity} un
              </span>
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                📅 Lead: {leadTimeDays}d | Segurança: {safetyStockDays}d
              </span>
              <button 
                onClick={() => {
                  setSelectedMedication('');
                  setCurrentStock(100);
                  setMonthlyConsumption(50);
                  setDesiredQuantity(100);
                  setLeadTimeDays(7);
                  setSafetyStockDays(15);
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                🗑️ Limpar configuração
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recomendações */}
      {recommendations.length > 0 && (
        <Card className="raymed-card">
          <CardHeader className="raymed-card-header">
            <CardTitle>📋 Recomendações por Laboratório</CardTitle>
            <CardDescription>
              Análise detalhada com ações recomendadas para cada laboratório
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              
              {recommendations.map((rec, index) => (
                <div key={index} className={`p-4 rounded-lg border-2 ${getActionColor(rec.action)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getActionIcon(rec.action)}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{rec.laboratory}</h4>
                          {getPriorityBadge(rec.priority)}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{rec.timeframe}</p>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Preço Atual:</span>
                            <span className="font-medium ml-1">R$ {rec.currentPrice.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Preço Previsto:</span>
                            <span className="font-medium ml-1">R$ {rec.predictedPrice.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Economia:</span>
                            <span className={`font-medium ml-1 ${rec.expectedSavings > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              R$ {rec.expectedSavings.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Confiança:</span>
                            <span className="font-medium ml-1">{(rec.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <p className="text-xs text-gray-600 font-medium mb-1">Justificativas:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {rec.reasoning.map((reason, i) => (
                              <li key={i}>• {reason}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <Button
                        size="sm"
                        variant={rec.action === 'buy_now' || rec.action === 'urgent_buy' ? 'default' : 'outline'}
                        className={
                          rec.action === 'urgent_buy' ? 'bg-red-600 hover:bg-red-700' :
                          rec.action === 'buy_now' ? 'bg-green-600 hover:bg-green-700' :
                          ''
                        }
                      >
                        {rec.action === 'urgent_buy' ? '🚨 Comprar Agora' :
                         rec.action === 'buy_now' ? '✅ Comprar' :
                         rec.action === 'wait' ? '⏳ Aguardar' :
                         '👁️ Monitorar'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calculadora de Estoque */}
      <Card className="raymed-card">
        <CardHeader className="raymed-card-header">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            📊 Calculadora de Estoque
          </CardTitle>
          <CardDescription>
            Análise baseada no estoque e consumo informados acima
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {currentStock > 0 && monthlyConsumption > 0 ? (
            <div className="space-y-4">
              {/* Primeira linha - Métricas básicas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round((currentStock / (monthlyConsumption / 30)))}
                  </div>
                  <div className="text-sm text-blue-700">Dias de Estoque</div>
                  <div className="text-xs text-blue-600">
                    {(monthlyConsumption / 30).toFixed(1)}/dia consumo
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round((monthlyConsumption / 30) * (leadTimeDays + safetyStockDays))}
                  </div>
                  <div className="text-sm text-green-700">Ponto de Reposição</div>
                  <div className="text-xs text-green-600">
                    {leadTimeDays}d lead + {safetyStockDays}d segurança
                  </div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round((monthlyConsumption / 30) * 45)}
                  </div>
                  <div className="text-sm text-orange-700">Estoque Ideal</div>
                  <div className="text-xs text-orange-600">45 dias (1.5 meses)</div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {currentStock < (monthlyConsumption / 30) * leadTimeDays ? 'CRÍTICO' :
                     currentStock < (monthlyConsumption / 30) * (leadTimeDays + safetyStockDays) ? 'BAIXO' :
                     currentStock > (monthlyConsumption / 30) * 60 ? 'EXCESSO' : 'NORMAL'}
                  </div>
                  <div className="text-sm text-purple-700">Status do Estoque</div>
                </div>
              </div>
              
              {/* Segunda linha - Cálculos de compra */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="text-lg font-bold text-indigo-600">
                    R$ {((desiredQuantity * 100) / monthlyConsumption * (monthlyConsumption / 30)).toFixed(2)}
                  </div>
                  <div className="text-sm text-indigo-700">Custo Estimado Total</div>
                  <div className="text-xs text-indigo-600">
                    {desiredQuantity} unidades × preço médio
                  </div>
                </div>
                
                <div className="bg-teal-50 p-4 rounded-lg">
                  <div className="text-lg font-bold text-teal-600">
                    {Math.round(desiredQuantity / (monthlyConsumption / 30))}
                  </div>
                  <div className="text-sm text-teal-700">Ciclo de Compra</div>
                  <div className="text-xs text-teal-600">
                    dias de duração
                  </div>
                </div>
                
                <div className="bg-pink-50 p-4 rounded-lg">
                  <div className="text-lg font-bold text-pink-600">
                    {Math.round(Math.max(0, (monthlyConsumption / 30) * (leadTimeDays + safetyStockDays) - currentStock))}
                  </div>
                  <div className="text-sm text-pink-700">Quantidade Mínima</div>
                  <div className="text-xs text-pink-600">
                    para atingir ponto de reposição
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Informe o estoque atual e consumo mensal para ver análise</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guia de Ações */}
      <Card className="raymed-card">
        <CardHeader className="raymed-card-header">
          <CardTitle>📚 Guia de Ações Recomendadas</CardTitle>
          <CardDescription>
            Entenda o significado de cada recomendação do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">🚨 Compra Urgente</p>
                  <p className="text-xs text-red-600">Preço muito abaixo do esperado ou estoque crítico</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded">
                <ShoppingCart className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">✅ Comprar Agora</p>
                  <p className="text-xs text-green-600">Preço favorável detectado - boa oportunidade</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded">
                <Calendar className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">⏳ Aguardar</p>
                  <p className="text-xs text-yellow-600">Preços devem cair - aguardar momento melhor</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded">
                <Package className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">👁️ Monitorar</p>
                  <p className="text-xs text-blue-600">Preço estável - acompanhar mudanças</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
