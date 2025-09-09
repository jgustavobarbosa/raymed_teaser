"use client"

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Activity } from 'lucide-react';

interface Stats {
  totalMedications: number;
  avgPriceChange24h: number;
  activeAlerts: number;
}

export function PriceStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Simular dados para demo
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setStats({
          totalMedications: 1247,
          avgPriceChange24h: -2.3,
          activeAlerts: 89,
        });
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </>
    );
  }

  const statCards = [
    {
      title: "Medicamentos",
      value: stats.totalMedications.toLocaleString(),
      description: "Total monitorado",
      icon: Activity,
      color: "text-blue-600",
    },
    {
      title: "Variação Média",
      value: `${stats.avgPriceChange24h > 0 ? '+' : ''}${stats.avgPriceChange24h.toFixed(1)}%`,
      description: "Últimas 24 horas",
      icon: stats.avgPriceChange24h >= 0 ? TrendingUp : TrendingDown,
      color: stats.avgPriceChange24h >= 0 ? "text-red-600" : "text-green-600",
    },
    {
      title: "Alertas Ativos",
      value: stats.activeAlerts.toString(),
      description: "Inscrições ativas",
      icon: Activity,
      color: "text-orange-600",
    },
  ];

  return (
    <>
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
