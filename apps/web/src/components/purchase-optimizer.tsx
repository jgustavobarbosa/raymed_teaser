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
  const [selectedMedication, setSelectedMedication] = useState('PARACETAMOL-500MG');
  const [currentStock, setCurrentStock] = useState(100);
  const [monthlyConsumption, setMonthlyConsumption] = useState(50);
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

      {/* Analisador Individual */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 Análise Individual de Medicamento</CardTitle>
          <CardDescription>
            Obtenha recomendações específicas considerando seu estoque atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Medicamento</label>
              <select
                value={selectedMedication}
                onChange={(e) => setSelectedMedication(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                <option value="PARACETAMOL-500MG">Paracetamol 500mg</option>
                <option value="DIPIRONA-500MG">Dipirona 500mg</option>
                <option value="IBUPROFENO-400MG">Ibuprofeno 400mg</option>
                <option value="AMOXICILINA-500MG">Amoxicilina 500mg</option>
                <option value="METFORMINA-850MG">Metformina 850mg</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Estoque Atual</label>
              <input
                type="number"
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full p-2 border rounded-lg"
                placeholder="Unidades"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Consumo Mensal</label>
              <input
                type="number"
                value={monthlyConsumption}
                onChange={(e) => setMonthlyConsumption(Number(e.target.value))}
                className="w-full p-2 border rounded-lg"
                placeholder="Unidades/mês"
              />
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={generateRecommendations}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Analisando...' : '🔮 Analisar'}
              </Button>
            </div>
          </div>

          {/* Recomendações */}
          {recommendations.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">📋 Recomendações por Laboratório</h3>
              
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
          )}
        </CardContent>
      </Card>

      {/* Calculadora de Estoque */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            Calculadora de Estoque
          </CardTitle>
          <CardDescription>
            Análise baseada no estoque e consumo informados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentStock > 0 && monthlyConsumption > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((currentStock / (monthlyConsumption / 30)))}
                </div>
                <div className="text-sm text-blue-700">Dias de Estoque</div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(monthlyConsumption * 1.5)}
                </div>
                <div className="text-sm text-green-700">Estoque Recomendado</div>
                <div className="text-xs text-green-600">1.5 meses</div>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round(monthlyConsumption / 2)}
                </div>
                <div className="text-sm text-orange-700">Ponto de Reposição</div>
                <div className="text-xs text-orange-600">15 dias</div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {currentStock < (monthlyConsumption / 2) ? 'ALTO' : 
                   currentStock < monthlyConsumption ? 'MÉDIO' : 'BAIXO'}
                </div>
                <div className="text-sm text-purple-700">Risco de Ruptura</div>
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
      <Card>
        <CardHeader>
          <CardTitle>📚 Guia de Ações Recomendadas</CardTitle>
        </CardHeader>
        <CardContent>
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
