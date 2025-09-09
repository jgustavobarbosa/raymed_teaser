"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatRelativeDate } from '@/lib/utils';
import { Bell, BellOff, Target, TrendingDown, Zap } from 'lucide-react';

interface AlertSummary {
  id: string;
  medicationName: string;
  reason: 'TARGET_PRICE' | 'DROP_PCT' | 'SPIKE';
  createdAt: Date;
  snapshot: {
    currentPrice: number;
    labName?: string;
  };
}

const alertIcons = {
  TARGET_PRICE: Target,
  DROP_PCT: TrendingDown,
  SPIKE: Zap,
};

const alertLabels = {
  TARGET_PRICE: 'Preço alvo atingido',
  DROP_PCT: 'Queda significativa',
  SPIKE: 'Variação elevada',
};

const alertColors = {
  TARGET_PRICE: 'text-green-600',
  DROP_PCT: 'text-green-600', 
  SPIKE: 'text-orange-600',
};

export function AlertsSummary() {
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        // Simular dados para demo
        await new Promise(resolve => setTimeout(resolve, 600));
        
        const mockAlerts: AlertSummary[] = [
          {
            id: '1',
            medicationName: 'Paracetamol 500mg',
            reason: 'DROP_PCT',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
            snapshot: {
              currentPrice: 8.50,
              labName: 'EMS',
            },
          },
          {
            id: '2',
            medicationName: 'Losartana 50mg',
            reason: 'TARGET_PRICE',
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 horas atrás
            snapshot: {
              currentPrice: 18.90,
              labName: 'Medley',
            },
          },
          {
            id: '3',
            medicationName: 'Ibuprofeno 400mg',
            reason: 'SPIKE',
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 horas atrás
            snapshot: {
              currentPrice: 15.20,
              labName: 'Sanofi',
            },
          },
        ];
        
        setAlerts(mockAlerts);
        setActiveSubscriptions(7);
      } catch (error) {
        console.error('Erro ao buscar resumo de alertas:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
        </div>
        
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-8 w-8 bg-muted rounded" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-muted rounded mb-2" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
            <div className="h-3 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status das inscrições */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">
            {activeSubscriptions} inscrições ativas
          </span>
        </div>
        <Link
          href="/inscricoes"
          className="text-sm text-primary hover:underline"
        >
          Gerenciar
        </Link>
      </div>

      {/* Alertas recentes */}
      {alerts.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Alertas Recentes
          </h4>
          
          {alerts.map((alert) => {
            const Icon = alertIcons[alert.reason];
            const color = alertColors[alert.reason];
            const label = alertLabels[alert.reason];
            
            return (
              <Link
                key={alert.id}
                href={`/alertas/${alert.id}`}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors"
              >
                <div className={`h-8 w-8 rounded flex items-center justify-center bg-muted`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {alert.medicationName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {label} • {alert.snapshot.labName}
                  </p>
                </div>
                
                <div className="text-xs text-muted-foreground text-right">
                  {formatRelativeDate(alert.createdAt)}
                </div>
              </Link>
            );
          })}
          
          <div className="pt-2 border-t">
            <Link
              href="/alertas"
              className="text-sm text-primary hover:underline"
            >
              Ver todos os alertas →
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Nenhum alerta recente
          </p>
          <Link
            href="/inscricoes"
            className="text-sm text-primary hover:underline"
          >
            Configurar primeiro alerta
          </Link>
        </div>
      )}
    </div>
  );
}
