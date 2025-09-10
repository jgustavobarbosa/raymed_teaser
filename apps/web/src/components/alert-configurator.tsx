'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Target, TrendingDown, Zap } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';

interface AlertConfiguratorProps {
  medicationCode?: string;
  medicationName?: string;
}

export function AlertConfigurator({ medicationCode, medicationName }: AlertConfiguratorProps) {
  const [medications, setMedications] = useState([]);
  const [laboratories, setLaboratories] = useState([]);
  const [selectedMedication, setSelectedMedication] = useState(medicationCode || '');
  const [selectedLab, setSelectedLab] = useState('');
  const [alertType, setAlertType] = useState('TARGET_PRICE');
  const [targetPrice, setTargetPrice] = useState('');
  const [dropPercentage, setDropPercentage] = useState('10');
  const [userEmail, setUserEmail] = useState('usuario@teste.com');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Carregar medicamentos
      const medsResponse = await fetch('/api/server/medications');
      if (medsResponse.ok) {
        const medsData = await medsResponse.json();
        setMedications(medsData.data || []);
      }

      // Carregar laboratórios
      const labsResponse = await fetch('/api/server/labs');
      if (labsResponse.ok) {
        const labsData = await labsResponse.json();
        setLaboratories(labsData.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const configureAlert = async () => {
    if (!selectedMedication || !userEmail) {
      toast.error('Medicamento e email são obrigatórios');
      return;
    }

    if (alertType === 'TARGET_PRICE' && !targetPrice) {
      toast.error('Preço alvo é obrigatório para este tipo de alerta');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/server/alerts/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          medicationCode: selectedMedication,
          laboratoryId: selectedLab || null,
          alertType,
          targetPrice: targetPrice ? parseFloat(targetPrice) : null,
          dropPercentage: alertType === 'DROP_PERCENTAGE' ? parseInt(dropPercentage) : null,
          spikePercentage: alertType === 'SPIKE' ? parseInt(dropPercentage) : null,
          isActive: true
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Alerta configurado com sucesso!');
        
        // Limpar formulário
        setTargetPrice('');
        setDropPercentage('10');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao configurar alerta');
      }
    } catch (error) {
      console.error('Erro ao configurar alerta:', error);
      toast.error('Erro ao configurar alerta');
    } finally {
      setLoading(false);
    }
  };

  const selectedMed = medications.find(m => m.code === selectedMedication);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" />
          Configurar Alerta de Preço
        </CardTitle>
        <CardDescription>
          Configure alertas personalizados para receber notificações quando os preços atenderem seus critérios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email do usuário */}
        <div>
          <label className="form-label">📧 Email para notificações:</label>
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            className="form-input"
            placeholder="seu@email.com"
          />
        </div>

        {/* Seleção de medicamento */}
        <div>
          <label className="form-label">💊 Medicamento:</label>
          <select
            value={selectedMedication}
            onChange={(e) => setSelectedMedication(e.target.value)}
            className="form-select"
          >
            <option value="">Selecione um medicamento...</option>
            {medications.map((med) => (
              <option key={med.code} value={med.code}>
                {med.name} - {med.currentPrice ? formatCurrency(parseFloat(med.currentPrice.value)) : 'Sem preço'}
              </option>
            ))}
          </select>
        </div>

        {/* Seleção de laboratório (opcional) */}
        <div>
          <label className="form-label">🏥 Laboratório (opcional):</label>
          <select
            value={selectedLab}
            onChange={(e) => setSelectedLab(e.target.value)}
            className="form-select"
          >
            <option value="">Todos os laboratórios</option>
            {laboratories.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de alerta */}
        <div>
          <label className="form-label">🔔 Tipo de Alerta:</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setAlertType('TARGET_PRICE')}
              className={`p-4 border-2 rounded-xl text-left transition-all duration-200 ${
                alertType === 'TARGET_PRICE' 
                  ? 'border-green-500 bg-green-50 shadow-md' 
                  : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-25'
              }`}
            >
              <Target className="h-6 w-6 text-green-600 mb-2" />
              <div className="font-semibold text-gray-800">🎯 Preço Alvo</div>
              <div className="text-sm text-gray-600">Alerta quando atingir preço específico</div>
            </button>
            
            <button
              type="button"
              onClick={() => setAlertType('DROP_PERCENTAGE')}
              className={`p-4 border-2 rounded-xl text-left transition-all duration-200 ${
                alertType === 'DROP_PERCENTAGE' 
                  ? 'border-blue-500 bg-blue-50 shadow-md' 
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-25'
              }`}
            >
              <TrendingDown className="h-6 w-6 text-blue-600 mb-2" />
              <div className="font-semibold text-gray-800">📉 Queda Percentual</div>
              <div className="text-sm text-gray-600">Alerta quando cair X%</div>
            </button>
            
            <button
              type="button"
              onClick={() => setAlertType('SPIKE')}
              className={`p-4 border-2 rounded-xl text-left transition-all duration-200 ${
                alertType === 'SPIKE' 
                  ? 'border-orange-500 bg-orange-50 shadow-md' 
                  : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-25'
              }`}
            >
              <Zap className="h-6 w-6 text-orange-600 mb-2" />
              <div className="font-semibold text-gray-800">⚡ Variação Elevada</div>
              <div className="text-sm text-gray-600">Alerta para mudanças bruscas</div>
            </button>
          </div>
        </div>

        {/* Configurações específicas do alerta */}
        {alertType === 'TARGET_PRICE' && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <label className="form-label">💰 Preço Alvo (R$):</label>
            <input
              type="number"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="form-input"
              placeholder="Ex: 25.00"
            />
            {selectedMed?.currentPrice && (
              <div className="text-sm text-green-700 mt-2 p-2 bg-green-100 rounded">
                💊 Preço atual: {formatCurrency(parseFloat(selectedMed.currentPrice.value))} ({selectedMed.currentPrice.labName})
              </div>
            )}
          </div>
        )}

        {(alertType === 'DROP_PERCENTAGE' || alertType === 'SPIKE') && (
          <div className={`p-4 rounded-lg border ${
            alertType === 'DROP_PERCENTAGE' ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
          }`}>
            <label className="form-label">
              📊 {alertType === 'DROP_PERCENTAGE' ? 'Percentual de Queda (%)' : 'Percentual de Variação (%)'}:
            </label>
            <select
              value={dropPercentage}
              onChange={(e) => setDropPercentage(e.target.value)}
              className="form-select"
            >
              <option value="5">5% - Sensível (mais alertas)</option>
              <option value="10">10% - Moderado (recomendado)</option>
              <option value="15">15% - Conservador</option>
              <option value="20">20% - Apenas grandes mudanças</option>
            </select>
          </div>
        )}

        {/* Botão de configurar */}
        <Button 
          onClick={configureAlert} 
          disabled={loading || !selectedMedication || !userEmail}
          className="w-full"
        >
          {loading ? 'Configurando...' : 'Configurar Alerta'}
        </Button>

        {/* Preview do alerta */}
        {selectedMedication && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm font-medium text-blue-800">Preview do Alerta:</div>
            <div className="text-sm text-blue-700 mt-1">
              📧 <strong>{userEmail}</strong> receberá alerta quando{' '}
              <strong>{selectedMed?.name}</strong>
              {selectedLab && (
                <span> no laboratório <strong>{laboratories.find(l => l.id === selectedLab)?.name}</strong></span>
              )}
              {alertType === 'TARGET_PRICE' && targetPrice && (
                <span> atingir o preço de <strong>{formatCurrency(parseFloat(targetPrice))}</strong></span>
              )}
              {alertType === 'DROP_PERCENTAGE' && (
                <span> cair <strong>{dropPercentage}%</strong> ou mais</span>
              )}
              {alertType === 'SPIKE' && (
                <span> variar <strong>{dropPercentage}%</strong> ou mais em 24h</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
