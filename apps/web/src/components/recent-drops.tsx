"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatPercentage, getPriceChangeColor } from '@/lib/utils';
import { TrendingDown } from 'lucide-react';

interface MedicationDrop {
  id: string;
  code: string;
  name: string;
  currentPrice: {
    value: number;
    labName: string;
  };
  variation24h: number;
}

export function RecentDrops() {
  const [drops, setDrops] = useState<MedicationDrop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDrops() {
      try {
        const response = await fetch('/api/server/medications/recent-drops?limit=5');
        if (response.ok) {
          const data = await response.json();
          setDrops(data);
        } else {
          console.warn('API recent-drops não disponível, usando dados mock');
          // Dados mock para demonstração
          setDrops([
            {
              id: '1',
              code: 'PARACETAMOL-500MG',
              name: 'Paracetamol 500mg',
              currentPrice: { value: 8.50, labName: 'EMS' },
              variation24h: -12.5,
            },
            {
              id: '2',
              code: 'DIPIRONA-500MG', 
              name: 'Dipirona Sódica 500mg',
              currentPrice: { value: 6.80, labName: 'Medley' },
              variation24h: -8.3,
            }
          ]);
        }
      } catch (error) {
        console.error('Erro ao buscar quedas recentes:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDrops();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-10 w-10 bg-muted rounded" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-muted rounded mb-2" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
            <div className="h-6 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (drops.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma queda significativa detectada nas últimas 24 horas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {drops.map((drop) => (
        <Link
          key={drop.id}
          href={`/medicamentos/${drop.code}`}
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="h-10 w-10 bg-green-100 dark:bg-green-900/20 rounded flex items-center justify-center">
            <TrendingDown className="h-5 w-5 text-green-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{drop.name}</p>
            <p className="text-sm text-muted-foreground">
              {drop.currentPrice.labName} • {formatCurrency(drop.currentPrice.value)}
            </p>
          </div>
          
          <div className={`text-right ${getPriceChangeColor(drop.variation24h)}`}>
            <p className="font-medium">
              {formatPercentage(Math.abs(drop.variation24h))}
            </p>
            <p className="text-xs">queda</p>
          </div>
        </Link>
      ))}
      
      <div className="pt-2 border-t">
        <Link
          href="/medicamentos?sortBy=variation24h&sortOrder=asc"
          className="text-sm text-primary hover:underline"
        >
          Ver todas as quedas →
        </Link>
      </div>
    </div>
  );
}
