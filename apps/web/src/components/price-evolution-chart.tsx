'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

interface PriceEvolutionProps {
  medicationCode: string;
  medicationName: string;
}

export function PriceEvolutionChart({ medicationCode, medicationName }: PriceEvolutionProps) {
  const [evolutionData, setEvolutionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    fetchEvolutionData();
  }, [medicationCode, months]);

  const fetchEvolutionData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/server/medications/${medicationCode}/price-evolution?months=${months}`);
      
      if (response.ok) {
        const data = await response.json();
        setEvolutionData(data);
      }
    } catch (error) {
      console.error('Erro ao buscar evolução de preços:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Preços por Laboratório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div>Carregando dados de evolução...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!evolutionData || !evolutionData.evolution || evolutionData.evolution.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Preços por Laboratório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div>Sem dados de evolução disponíveis</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preparar dados para o gráfico
  const chartData = {};
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#ffb347'];
  
  // Agrupar dados por mês
  evolutionData.evolution.forEach((labData) => {
    labData.data.forEach((monthData) => {
      if (!chartData[monthData.month]) {
        chartData[monthData.month] = { month: monthData.month };
      }
      chartData[monthData.month][labData.laboratory] = monthData.avgPrice;
    });
  });

  const chartArray = Object.values(chartData).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Preços - {medicationName}</CardTitle>
          <CardDescription>
            Comparação de preços entre laboratórios nos últimos {months} meses
          </CardDescription>
          <div className="flex gap-2">
            {[3, 6, 12].map((m) => (
              <Button
                key={m}
                variant={months === m ? "default" : "outline"}
                size="sm"
                onClick={() => setMonths(m)}
              >
                {m} meses
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const [year, month] = value.split('-');
                    return `${month}/${year.slice(2)}`;
                  }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
                />
                <Tooltip 
                  labelFormatter={(value) => `Mês: ${value}`}
                  formatter={(value, name) => [formatCurrency(value), name]}
                />
                <Legend />
                {evolutionData.evolution.map((labData, index) => (
                  <Line
                    key={labData.laboratory}
                    type="monotone"
                    dataKey={labData.laboratory}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de comparação atual */}
      <Card>
        <CardHeader>
          <CardTitle>Comparação Atual de Preços</CardTitle>
          <CardDescription>
            Preços mais recentes por laboratório ({evolutionData.totalLaboratories} laboratórios)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-2 text-left">Laboratório</th>
                  <th className="border border-gray-200 px-4 py-2 text-right">Preço Atual</th>
                  <th className="border border-gray-200 px-4 py-2 text-center">Total de Preços</th>
                  <th className="border border-gray-200 px-4 py-2 text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {evolutionData.evolution.map((labData, index) => (
                  <tr key={labData.laboratory} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-4 py-2 font-medium">
                      {labData.laboratory}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right font-semibold">
                      {formatCurrency(labData.currentPrice)}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-center">
                      {labData.totalPrices}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-center">
                      <Button size="sm" variant="outline">
                        Criar Alerta
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
