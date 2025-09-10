'use client';

import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingDown, Bell, Search, Building2, MessageSquare, Activity } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { PriceEvolutionChart } from '@/components/price-evolution-chart';
import { AlertConfigurator } from '@/components/alert-configurator';

export default function HomePage() {
  const [activeSection, setActiveSection] = useState('home');
  const [medications, setMedications] = useState([]);
  const [labs, setLabs] = useState([]);
  const [recentDrops, setRecentDrops] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMedicationForChart, setSelectedMedicationForChart] = useState('');

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Carregar medicamentos
      const medsResponse = await fetch('/api/server/medications');
      if (medsResponse.ok) {
        const medsData = await medsResponse.json();
        setMedications(medsData.data || []);
      }

      // Carregar quedas recentes
      const dropsResponse = await fetch('/api/server/medications/recent-drops?limit=5');
      if (dropsResponse.ok) {
        const dropsData = await dropsResponse.json();
        setRecentDrops(dropsData || []);
      }

      // Carregar laboratórios
      const labsResponse = await fetch('/api/server/labs');
      if (labsResponse.ok) {
        const labsData = await labsResponse.json();
        setLabs(labsData.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do sistema');
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    
    try {
      const response = await fetch('/api/server/llm/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: chatInput }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
        toast.success('Resposta recebida!');
      } else {
        throw new Error('Erro na API');
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao processar pergunta. Tente novamente.' }]);
      toast.error('Erro ao enviar mensagem');
    }
    
    setChatInput('');
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'medicamentos':
        return <MedicamentosSection medications={medications} loading={loading} onSelectMedication={setSelectedMedicationForChart} />;
      case 'laboratorios':
        return <LaboratoriosSection labs={labs} loading={loading} />;
      case 'alertas':
        return <AlertasSection />;
      case 'graficos':
        return <GraficosSection selectedMedication={selectedMedicationForChart} medications={medications} />;
      case 'configurar':
        return <ConfigurarSection />;
      case 'chat':
        return <ChatSection messages={chatMessages} input={chatInput} setInput={setChatInput} onSend={sendChatMessage} />;
      default:
        return <HomeSection recentDrops={recentDrops} medications={medications} loading={loading} setActiveSection={setActiveSection} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">R</span>
              </div>
              <span className="font-bold text-xl">RayMed</span>
            </div>
            
            <div className="flex items-center space-x-2">
              {[
                { id: 'home', name: 'Home', icon: Search, color: 'blue' },
                { id: 'medicamentos', name: 'Medicamentos', icon: Search, color: 'purple' },
                { id: 'laboratorios', name: 'Laboratórios', icon: Building2, color: 'indigo' },
                { id: 'graficos', name: 'Gráficos', icon: Activity, color: 'green' },
                { id: 'configurar', name: 'Configurar', icon: Bell, color: 'orange' },
                { id: 'alertas', name: 'Alertas', icon: Bell, color: 'red' },
                { id: 'chat', name: 'Chat', icon: MessageSquare, color: 'teal' },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      isActive 
                        ? 'nav-item-active' 
                        : 'nav-item-inactive'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="hidden md:block">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 min-h-screen">
        {renderSection()}
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Logo e descrição */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">R</span>
                </div>
                <span className="font-bold text-xl">RayMed</span>
              </div>
              <p className="text-gray-600 mb-4">
                Sistema inteligente de monitoramento e alertas de preços de medicamentos. 
                Monitore 131 medicamentos em 35 laboratórios com alertas personalizados.
              </p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>📊 131 medicamentos</span>
                <span>🏥 35 laboratórios</span>
                <span>🤖 IA farmacêutica</span>
              </div>
            </div>

            {/* Links rápidos */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">🚀 Funcionalidades</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>💊 Busca de medicamentos</li>
                <li>📈 Gráficos de evolução</li>
                <li>🔔 Alertas personalizados</li>
                <li>🤖 Chat farmacêutico</li>
                <li>📧 Notificações por email</li>
              </ul>
            </div>

            {/* Informações */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">ℹ️ Informações</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>🌐 Versão: 1.0.0</li>
                <li>📅 Atualizado: {new Date().toLocaleDateString()}</li>
                <li>⚡ Status: Online</li>
                <li>📊 Dados em tempo real</li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-gray-200 mt-8 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="text-sm text-gray-500">
                © 2025 RayMed. Sistema de alertas de preços de medicamentos.
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2 md:mt-0">
                <span>⚡ Powered by</span>
                <span className="font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Rayia
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Seções da aplicação
function HomeSection({ recentDrops, medications, loading, setActiveSection }) {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="text-center py-16 gradient-bg text-white rounded-2xl shadow-xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-3xl">💊</span>
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4">RayMed</h1>
          <p className="text-2xl mb-2 opacity-95">Alertas Inteligentes de Medicamentos</p>
          <p className="text-lg mb-8 opacity-80 max-w-2xl mx-auto">
            Monitore preços de 131 medicamentos em 35 laboratórios brasileiros. 
            Receba alertas personalizados e consulte nossa IA farmacêutica especializada.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <Search className="h-8 w-8 mx-auto mb-2" />
              <div className="font-semibold">131 Medicamentos</div>
              <div className="text-sm opacity-80">Base completa</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <Building2 className="h-8 w-8 mx-auto mb-2" />
              <div className="font-semibold">35 Laboratórios</div>
              <div className="text-sm opacity-80">Preços comparados</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <Bell className="h-8 w-8 mx-auto mb-2" />
              <div className="font-semibold">Alertas Reais</div>
              <div className="text-sm opacity-80">Via Ethereal</div>
            </div>
          </div>
          
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => setActiveSection('medicamentos')}
              className="btn-secondary bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              <Search className="mr-2 h-5 w-5" />
              🔍 Explorar Medicamentos
            </button>
            <button 
              onClick={() => setActiveSection('configurar')}
              className="btn-secondary bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              <Bell className="mr-2 h-5 w-5" />
              🔔 Configurar Alertas
            </button>
          </div>
        </div>
      </section>

      {/* Stats Melhoradas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="raymed-card">
          <CardHeader className="raymed-card-header pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700">💊 Medicamentos</CardTitle>
              <Search className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-800">{medications.length}</div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Base farmacológica completa</p>
            <button 
              onClick={() => setActiveSection('medicamentos')}
              className="text-xs text-purple-600 hover:text-purple-800 mt-1"
            >
              Ver todos →
            </button>
          </CardContent>
        </Card>
        
        <Card className="raymed-card">
          <CardHeader className="raymed-card-header pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700">📉 Quedas Recentes</CardTitle>
              <TrendingDown className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-800">{recentDrops.length}</div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Oportunidades últimas 24h</p>
            <button 
              onClick={() => setActiveSection('graficos')}
              className="text-xs text-green-600 hover:text-green-800 mt-1"
            >
              Ver gráficos →
            </button>
          </CardContent>
        </Card>

        <Card className="raymed-card">
          <CardHeader className="raymed-card-header pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700">🔔 Alertas Ativos</CardTitle>
              <Bell className="h-5 w-5 text-orange-600" />
            </div>
            <div className="text-3xl font-bold text-gray-800">6</div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Emails enviados hoje</p>
            <button 
              onClick={() => setActiveSection('alertas')}
              className="text-xs text-orange-600 hover:text-orange-800 mt-1"
            >
              Ver alertas →
            </button>
          </CardContent>
        </Card>

        <Card className="raymed-card">
          <CardHeader className="raymed-card-header pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700">🏥 Laboratórios</CardTitle>
              <Building2 className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="text-3xl font-bold text-gray-800">35</div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Preços comparados</p>
            <button 
              onClick={() => setActiveSection('laboratorios')}
              className="text-xs text-indigo-600 hover:text-indigo-800 mt-1"
            >
              Ver ranking →
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Drops */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-green-600" />
            Quedas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Carregando...</div>
          ) : (
            <div className="space-y-4">
              {recentDrops.map((drop) => (
                <div key={drop.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <h4 className="font-medium">{drop.name}</h4>
                    <p className="text-sm text-muted-foreground">{drop.currentPrice?.labName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">
                      {formatCurrency(drop.currentPrice?.value || 0)}
                    </p>
                    <p className="text-sm text-green-600">
                      {formatPercentage(Math.abs(drop.variation24h || 0))} ↓
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MedicamentosSection({ medications, loading, onSelectMedication }) {
  const [filteredMedications, setFilteredMedications] = useState(medications);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPriceRange, setSelectedPriceRange] = useState('');
  
  // Atualizar medicamentos filtrados quando dados ou filtros mudarem
  useEffect(() => {
    let filtered = [...medications];
    
    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(med => 
        med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.activeIngredient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtro por categoria
    if (selectedCategory) {
      filtered = filtered.filter(med => 
        med.category?.toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }
    
    // Filtro por faixa de preço
    if (selectedPriceRange && med.currentPrice) {
      filtered = filtered.filter(med => {
        const price = parseFloat(med.currentPrice?.value || 0);
        switch (selectedPriceRange) {
          case '0-50':
            return price >= 0 && price <= 50;
          case '50-500':
            return price > 50 && price <= 500;
          case '500-2000':
            return price > 500 && price <= 2000;
          case '2000+':
            return price > 2000;
          default:
            return true;
        }
      });
    }
    
    setFilteredMedications(filtered);
  }, [medications, searchTerm, selectedCategory, selectedPriceRange]);
  
  const handleSearch = () => {
    // Busca já é automática, mas pode adicionar lógica adicional aqui
    toast.success(`Encontrados ${filteredMedications.length} medicamentos`);
  };
  
  if (loading) return <div>Carregando medicamentos...</div>;
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">💊 Medicamentos ({medications.length})</h1>
        <div className="text-sm text-gray-600">
          {filteredMedications.length !== medications.length && (
            <span>📊 Mostrando {filteredMedications.length} de {medications.length}</span>
          )}
        </div>
      </div>
      
      {/* Filtros Melhorados com Funcionalidade */}
      <Card className="raymed-card mb-6">
        <CardHeader className="raymed-card-header">
          <CardTitle>🔍 Buscar e Filtrar Medicamentos</CardTitle>
          <CardDescription>
            Use os filtros abaixo para encontrar medicamentos específicos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label">🏷️ Categoria:</label>
              <select 
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">Todas as categorias</option>
                <option value="Oncológico">🎗️ Oncológicos</option>
                <option value="Imunobiológico">🧬 Imunobiológicos</option>
                <option value="Analgésico">💊 Analgésicos</option>
                <option value="Antibiótico">🦠 Antibióticos</option>
                <option value="SUS">🏥 SUS - Atenção Básica</option>
                <option value="Cardiovascular">❤️ Cardiovascular</option>
              </select>
            </div>
            
            <div>
              <label className="form-label">🔍 Buscar:</label>
              <input 
                type="text" 
                placeholder="Nome, princípio ativo ou código..."
                className="form-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div>
              <label className="form-label">💰 Faixa de Preço:</label>
              <select 
                className="form-select"
                value={selectedPriceRange}
                onChange={(e) => setSelectedPriceRange(e.target.value)}
              >
                <option value="">Todos os preços</option>
                <option value="0-50">R$ 0 - R$ 50 (SUS/Básicos)</option>
                <option value="50-500">R$ 50 - R$ 500 (Intermediários)</option>
                <option value="500-2000">R$ 500 - R$ 2.000 (Especialidades)</option>
                <option value="2000+">R$ 2.000+ (Alto custo)</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button 
                onClick={handleSearch}
                className="btn-primary w-full"
              >
                <Search className="h-4 w-4 mr-2" />
                🔍 Buscar
              </button>
            </div>
          </div>
          
          {/* Filtros ativos */}
          {(searchTerm || selectedCategory || selectedPriceRange) && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Filtros ativos:</span>
              {searchTerm && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  🔍 "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="ml-1 text-blue-600">×</button>
                </span>
              )}
              {selectedCategory && (
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                  🏷️ {selectedCategory}
                  <button onClick={() => setSelectedCategory('')} className="ml-1 text-purple-600">×</button>
                </span>
              )}
              {selectedPriceRange && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                  💰 {selectedPriceRange}
                  <button onClick={() => setSelectedPriceRange('')} className="ml-1 text-green-600">×</button>
                </span>
              )}
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                  setSelectedPriceRange('');
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                🗑️ Limpar todos
              </button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMedications.map((med) => (
          <Card key={med.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">{med.name}</CardTitle>
              <CardDescription>{med.category?.split(' | ')[0]}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-lg">
                      {formatCurrency(parseFloat(med.currentPrice?.value || 0))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {med.currentPrice?.labName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Código</p>
                    <p className="text-xs font-mono">{med.code}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onSelectMedication(med.code)}
                    className="flex-1"
                  >
                    <Activity className="h-4 w-4 mr-1" />
                    Ver Gráfico
                  </Button>
                  <Button size="sm" className="flex-1">
                    <Bell className="h-4 w-4 mr-1" />
                    Alertar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LaboratoriosSection({ labs, loading }) {
  if (loading) return <div>Carregando laboratórios...</div>;
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Laboratórios</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {labs.map((lab) => (
          <Card key={lab.id}>
            <CardHeader>
              <CardTitle>{lab.name}</CardTitle>
              <CardDescription>CNPJ: {lab.cnpj || 'N/A'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {lab._count?.prices || 0} preços registrados
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AlertasSection() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular busca de alertas para usuário teste
    const mockAlerts = [
      {
        id: '1',
        medicationName: 'Paracetamol 500mg',
        reason: 'TARGET_PRICE',
        createdAt: new Date(),
        sentAt: new Date(),
      },
      {
        id: '2', 
        medicationName: 'Ibuprofeno 400mg',
        reason: 'TARGET_PRICE',
        createdAt: new Date(),
        sentAt: new Date(),
      }
    ];
    
    setTimeout(() => {
      setAlerts(mockAlerts);
      setLoading(false);
    }, 500);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Meus Alertas</h1>
      
      {loading ? (
        <div>Carregando alertas...</div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-green-600" />
                  {alert.medicationName}
                </CardTitle>
                <CardDescription>
                  {alert.reason === 'TARGET_PRICE' ? 'Preço alvo atingido' : 'Alerta de preço'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between">
                  <span>Status: {alert.sentAt ? '✅ Enviado' : '⏳ Pendente'}</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function GraficosSection({ selectedMedication, medications }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Gráficos de Evolução de Preços</h1>
      
      {!selectedMedication ? (
        <Card>
          <CardHeader>
            <CardTitle>Selecione um Medicamento</CardTitle>
            <CardDescription>
              Escolha um medicamento na aba "Medicamentos" para ver sua evolução de preços
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Clique em "Ver Gráfico" em qualquer medicamento para visualizar sua evolução</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <PriceEvolutionChart 
          medicationCode={selectedMedication}
          medicationName={medications.find(m => m.code === selectedMedication)?.name || selectedMedication}
        />
      )}
    </div>
  );
}

function ConfigurarSection() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurar Alertas Personalizados</h1>
      <AlertConfigurator />
    </div>
  );
}

function ChatSection({ messages, input, setInput, onSend }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Chat LLM - Perguntas sobre Medicamentos</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>💬 Chat com IA Farmacêutica</CardTitle>
          <CardDescription>
            Faça perguntas sobre preços, tendências e medicamentos (131 medicamentos disponíveis)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sugestões de perguntas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            {[
              "Quais medicamentos com rituximabe temos?",
              "Compare preços de medicamentos oncológicos",
              "Qual laboratório tem melhores preços?",
              "Medicamentos mais caros para câncer"
            ].map((suggestion, i) => (
              <button
                key={i}
                onClick={() => setInput(suggestion)}
                className="text-left p-2 text-sm border rounded hover:bg-gray-50 text-blue-600"
              >
                "{suggestion}"
              </button>
            ))}
          </div>
          
          {/* Messages */}
          <div className="h-96 border rounded p-4 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Faça uma pergunta sobre medicamentos!</p>
                <p className="text-sm">Base com 131 medicamentos e 7.956 preços</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`p-3 rounded ${
                  msg.role === 'user' 
                    ? 'bg-blue-100 ml-12' 
                    : 'bg-gray-100 mr-12'
                }`}>
                  <p className="text-sm font-medium mb-1">
                    {msg.role === 'user' ? 'Você' : '🤖 RayMed IA Farmacêutica'}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))
            )}
          </div>
          
          {/* Input */}
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && onSend()}
              placeholder="Ex: Quais medicamentos com rituximabe temos disponíveis?"
              className="form-input flex-1"
            />
            <button 
              onClick={onSend} 
              disabled={!input.trim()}
              className="btn-primary px-6"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Enviar
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
