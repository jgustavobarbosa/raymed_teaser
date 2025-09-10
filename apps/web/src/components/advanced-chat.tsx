'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Brain, FileText, Star, Settings, Send, Download } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  insights?: string[];
  recommendations?: string[];
  confidence?: number;
  timestamp: Date;
}

interface UserProfile {
  type: 'medico' | 'hospital' | 'distribuidor' | 'analista';
  name: string;
  watchlist: any[];
}

export default function AdvancedChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    type: 'analista',
    name: 'Usuário',
    watchlist: []
  });
  const [selectedQueryType, setSelectedQueryType] = useState('');

  // Consultas predefinidas por perfil
  const predefinedQueries = {
    medico: [
      "Quais medicamentos oncológicos têm biossimilares disponíveis?",
      "Mostre alternativas terapêuticas para hipertensão com menor custo",
      "Por que o Herceptin teve variação de preço recentemente?"
    ],
    hospital: [
      "Mostre os 5 medicamentos oncológicos com maior queda de preço nos últimos 60 dias",
      "Quais medicamentos de alto custo têm melhor custo-benefício?",
      "Se eu comprar 1000 unidades de Dipirona, qual laboratório é melhor?"
    ],
    distribuidor: [
      "Quais medicamentos têm maior potencial de margem comercial?",
      "Analise tendências de demanda por categoria nos últimos 3 meses",
      "Se eu comprar 5000 unidades de Paracetamol, qual a economia máxima?"
    ],
    analista: [
      "Mostre correlação entre preços de medicamentos oncológicos",
      "Analise volatilidade de preços por laboratório",
      "Gere relatório de tendências do mercado farmacêutico"
    ]
  };

  const sendComplexQuery = async () => {
    if (!input.trim()) return;
    
    const userMessage: ChatMessage = { 
      role: 'user', 
      content: input,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    
    try {
      const response = await fetch('/api/server/llm/complex-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
          userProfile: userProfile.type,
          timeframe: 60,
          limit: 5
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: result.data.answer,
          data: result.data.data,
          insights: result.data.insights,
          recommendations: result.data.recommendations,
          confidence: result.data.confidence,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Erro na API');
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Erro ao processar consulta complexa. Tente novamente.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const generateReport = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/server/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'market_analysis',
          userProfile: userProfile.type,
          format: 'html',
          timeframe: 90,
          includeCharts: true
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        const reportMessage: ChatMessage = {
          role: 'assistant',
          content: `📊 **Relatório gerado com sucesso!**\n\n${result.data.content.substring(0, 500)}...`,
          data: result.data,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, reportMessage]);
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToWatchlist = async (medicationCode: string) => {
    try {
      const response = await fetch('/api/server/users/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default-user',
          action: 'add',
          medicationCode,
          alertConfig: { priceChange: 10, enabled: true }
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        const watchlistMessage: ChatMessage = {
          role: 'assistant',
          content: `⭐ ${result.data.medicationName} adicionado à sua watchlist!`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, watchlistMessage]);
      }
    } catch (error) {
      console.error('Erro ao adicionar à watchlist:', error);
    }
  };

  const getProfileIcon = (type: string) => {
    switch (type) {
      case 'medico': return '👨‍⚕️';
      case 'hospital': return '🏥';
      case 'distribuidor': return '📈';
      case 'analista': return '📊';
      default: return '👤';
    }
  };

  const getProfileColor = (type: string) => {
    switch (type) {
      case 'medico': return 'bg-blue-100 text-blue-800';
      case 'hospital': return 'bg-green-100 text-green-800';
      case 'distribuidor': return 'bg-purple-100 text-purple-800';
      case 'analista': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold mb-2">🤖 Chat LLM Evoluído</h1>
        <p className="opacity-90">Consultas complexas, explicações didáticas e relatórios automáticos</p>
      </div>

      {/* Seletor de Perfil */}
      <Card className="raymed-card">
        <CardHeader className="raymed-card-header">
          <CardTitle>👤 Perfil do Usuário</CardTitle>
          <CardDescription>
            Selecione seu perfil para receber insights personalizados
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { type: 'medico', name: 'Médico/Prescritor', desc: 'Foco clínico e terapêutico' },
              { type: 'hospital', name: 'Gestor Hospitalar', desc: 'Custo-efetividade e volume' },
              { type: 'distribuidor', name: 'Distribuidor', desc: 'Margem e oportunidades' },
              { type: 'analista', name: 'Analista', desc: 'Dados e estatísticas' }
            ].map((profile) => (
              <button
                key={profile.type}
                onClick={() => setUserProfile({...userProfile, type: profile.type as any, name: profile.name})}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  userProfile.type === profile.type 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="text-2xl mb-2">{getProfileIcon(profile.type)}</div>
                <div className="font-semibold">{profile.name}</div>
                <div className="text-xs text-gray-600">{profile.desc}</div>
              </button>
            ))}
          </div>
          
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Perfil ativo:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getProfileColor(userProfile.type)}`}>
              {getProfileIcon(userProfile.type)} {userProfile.name}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="raymed-card">
        <CardHeader className="raymed-card-header">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            💬 Chat Inteligente
          </CardTitle>
          <CardDescription>
            Faça consultas complexas e receba análises personalizadas para seu perfil
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {/* Consultas Sugeridas */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">💡 Consultas sugeridas para {userProfile.name}:</h3>
            <div className="grid grid-cols-1 gap-2">
              {predefinedQueries[userProfile.type]?.map((query, index) => (
                <button
                  key={index}
                  onClick={() => setInput(query)}
                  className="text-left p-3 text-sm border rounded-lg hover:bg-blue-50 text-blue-700 transition-colors"
                >
                  "{query}"
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="h-96 border-2 border-gray-200 rounded-lg p-4 overflow-y-auto space-y-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Chat LLM Evoluído Ativo!</p>
                <p className="text-sm">Faça consultas complexas como:</p>
                <p className="text-sm italic">"Mostre os 5 medicamentos com maior queda de preço"</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`p-4 rounded-lg ${
                  msg.role === 'user' 
                    ? 'bg-blue-100 ml-8 border-l-4 border-blue-500' 
                    : 'bg-white mr-8 border-l-4 border-green-500 shadow-sm'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">
                      {msg.role === 'user' ? `${getProfileIcon(userProfile.type)} Você` : '🤖 RayMed IA Evoluída'}
                    </p>
                    <span className="text-xs text-gray-500">
                      {msg.timestamp.toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                  
                  {/* Insights e Recomendações */}
                  {msg.insights && msg.insights.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                      <p className="text-xs font-semibold text-blue-800 mb-1">💡 Insights:</p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        {msg.insights.map((insight, idx) => (
                          <li key={idx}>• {insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="mt-2 p-3 bg-green-50 rounded border-l-4 border-green-400">
                      <p className="text-xs font-semibold text-green-800 mb-1">🎯 Recomendações:</p>
                      <ul className="text-xs text-green-700 space-y-1">
                        {msg.recommendations.map((rec, idx) => (
                          <li key={idx}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Ações Rápidas */}
                  {msg.data && msg.role === 'assistant' && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={generateReport}
                        className="text-xs"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Gerar Relatório
                      </Button>
                      {msg.data.length > 0 && msg.data[0].code && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => addToWatchlist(msg.data[0].code)}
                          className="text-xs"
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Adicionar aos Favoritos
                        </Button>
                      )}
                      {msg.confidence && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          Confiança: {(msg.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          {/* Input */}
          <div className="mt-4 space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !loading && sendComplexQuery()}
                placeholder={`Ex: "Mostre os 5 medicamentos oncológicos com maior queda de preço nos últimos 60 dias"`}
                className="form-input flex-1"
                disabled={loading}
              />
              <Button 
                onClick={sendComplexQuery} 
                disabled={!input.trim() || loading}
                className="btn-primary px-6"
              >
                {loading ? '⏳' : <Send className="h-4 w-4" />}
                {loading ? 'Processando...' : 'Enviar'}
              </Button>
            </div>
            
            {/* Ações Rápidas */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                size="sm" 
                variant="outline"
                onClick={generateReport}
                disabled={loading}
              >
                <FileText className="h-4 w-4 mr-2" />
                Gerar Relatório Automático
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setInput("Mostre os medicamentos da minha watchlist com alertas")}
              >
                <Star className="h-4 w-4 mr-2" />
                Ver Favoritos
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setInput("Simule uma compra em lote otimizada")}
              >
                <Settings className="h-4 w-4 mr-2" />
                Simulação de Compra
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Watchlist/Favoritos */}
      <Card className="raymed-card">
        <CardHeader className="raymed-card-header">
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            ⭐ Minha Watchlist
          </CardTitle>
          <CardDescription>
            Medicamentos favoritos com alertas personalizados
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {userProfile.watchlist.length > 0 ? (
            <div className="space-y-3">
              {userProfile.watchlist.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded border">
                  <div>
                    <p className="font-medium">{item.medicationName}</p>
                    <p className="text-sm text-gray-600">{item.category}</p>
                    <p className="text-xs text-gray-500">
                      Alerta: {item.alertConfig.priceChange}% de mudança
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      R$ {item.currentPrice?.value.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{item.currentPrice?.laboratory}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum medicamento na watchlist</p>
              <p className="text-sm">Use o chat para adicionar medicamentos favoritos</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Simulador de Compras */}
      <Card className="raymed-card">
        <CardHeader className="raymed-card-header">
          <CardTitle>🛒 Simulador de Compras em Lote</CardTitle>
          <CardDescription>
            Simule compras de múltiplos medicamentos e encontre a melhor estratégia
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-blue-600">Exemplo 1</div>
              <div className="text-sm text-blue-700">Farmácia Básica</div>
              <div className="text-xs text-blue-600 mt-2">
                • 1.000 Paracetamol
                • 800 Dipirona  
                • 500 Ibuprofeno
              </div>
              <Button 
                size="sm" 
                className="mt-3 w-full"
                onClick={() => setInput("Simule compra: 1000 Paracetamol, 800 Dipirona, 500 Ibuprofeno")}
              >
                Simular
              </Button>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-green-600">Exemplo 2</div>
              <div className="text-sm text-green-700">Hospital Oncológico</div>
              <div className="text-xs text-green-600 mt-2">
                • 50 Herceptin
                • 30 Keytruda
                • 20 Avastin
              </div>
              <Button 
                size="sm" 
                className="mt-3 w-full"
                onClick={() => setInput("Simule compra hospitalar: 50 Herceptin, 30 Keytruda, 20 Avastin")}
              >
                Simular
              </Button>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-purple-600">Personalizado</div>
              <div className="text-sm text-purple-700">Sua Simulação</div>
              <div className="text-xs text-purple-600 mt-2">
                Configure medicamentos
                e quantidades
              </div>
              <Button 
                size="sm" 
                className="mt-3 w-full"
                onClick={() => setInput("Se eu comprar [quantidade] de [medicamento], qual laboratório é melhor?")}
              >
                Configurar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exemplos de Consultas por Perfil */}
      <Card className="raymed-card">
        <CardHeader className="raymed-card-header">
          <CardTitle>🎯 Consultas Avançadas por Perfil</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">🔍 Análises de Tendências:</h3>
              <div className="space-y-2">
                <button 
                  className="w-full text-left p-2 text-sm border rounded hover:bg-gray-50"
                  onClick={() => setInput("Mostre os 5 medicamentos oncológicos com maior queda de preço nos últimos 60 dias")}
                >
                  📉 Top quedas de preço (60 dias)
                </button>
                <button 
                  className="w-full text-left p-2 text-sm border rounded hover:bg-gray-50"
                  onClick={() => setInput("Analise volatilidade de preços por laboratório nos últimos 3 meses")}
                >
                  📊 Volatilidade por laboratório
                </button>
                <button 
                  className="w-full text-left p-2 text-sm border rounded hover:bg-gray-50"
                  onClick={() => setInput("Compare tendências entre medicamentos oncológicos e SUS")}
                >
                  🔄 Comparação de categorias
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">💡 Explicações Didáticas:</h3>
              <div className="space-y-2">
                <button 
                  className="w-full text-left p-2 text-sm border rounded hover:bg-gray-50"
                  onClick={() => setInput("Por que o Adempas teve correção de preço tão grande?")}
                >
                  🤔 Explicar mudança do Adempas
                </button>
                <button 
                  className="w-full text-left p-2 text-sm border rounded hover:bg-gray-50"
                  onClick={() => setInput("Explique a diferença de preços entre Herceptin original e biossimilares")}
                >
                  🧬 Original vs Biossimilar
                </button>
                <button 
                  className="w-full text-left p-2 text-sm border rounded hover:bg-gray-50"
                  onClick={() => setInput("Por que medicamentos oncológicos são mais voláteis?")}
                >
                  🎗️ Volatilidade oncológicos
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
