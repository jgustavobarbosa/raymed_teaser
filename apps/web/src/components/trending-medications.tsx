"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatPercentage, getPriceChangeColor } from '@/lib/utils';
import { Pill } from 'lucide-react';

interface TrendingMedication {
  id: string;
  code: string;
  name: string;
  category: string;
  currentPrice: {
    value: number;
    labName: string;
  };
  variation30d: number;
}

export function TrendingMedications() {
  const [medications, setMedications] = useState<TrendingMedication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrending() {
      try {
        // Simular dados para demo
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockData: TrendingMedication[] = [
          {
            id: '1',
            code: 'PARACETAMOL-500MG',
            name: 'Paracetamol 500mg',
            category: 'Analgésico',
            currentPrice: { value: 8.50, labName: 'EMS' },
            variation30d: -12.5,
          },
          {
            id: '2',
            code: 'DIPIRONA-500MG',
            name: 'Dipirona Sódica 500mg',
            category: 'Analgésico',
            currentPrice: { value: 6.80, labName: 'Medley' },
            variation30d: -8.3,
          },
          {
            id: '3',
            code: 'IBUPROFENO-400MG',
            name: 'Ibuprofeno 400mg',
            category: 'Anti-inflamatório',
            currentPrice: { value: 15.20, labName: 'Sanofi' },
            variation30d: 5.7,
          },
          {
            id: '4',
            code: 'AMOXICILINA-500MG',
            name: 'Amoxicilina 500mg',
            category: 'Antibiótico',
            currentPrice: { value: 22.40, labName: 'Eurofarma' },
            variation30d: -3.2,
          },
          {
            id: '5',
            code: 'LOSARTANA-50MG',
            name: 'Losartana Potássica 50mg',
            category: 'Anti-hipertensivo',
            currentPrice: { value: 18.90, labName: 'EMS' },
            variation30d: -15.8,
          },
          {
            id: '6',
            code: 'METFORMINA-850MG',
            name: 'Metformina 850mg',
            category: 'Antidiabético',
            currentPrice: { value: 12.30, labName: 'Medley' },
            variation30d: 2.1,
          },
        ];
        
        setMedications(mockData);
      } catch (error) {
        console.error('Erro ao buscar medicamentos em destaque:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTrending();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="border rounded-lg p-4 animate-pulse">
            <div className="h-4 w-32 bg-muted rounded mb-2" />
            <div className="h-6 w-20 bg-muted rounded mb-2" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {medications.map((medication) => (
        <Link
          key={medication.id}
          href={`/medicamentos/${medication.code}`}
          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/20 rounded flex items-center justify-center flex-shrink-0">
              <Pill className="h-5 w-5 text-blue-600" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                {medication.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                {medication.category}
              </p>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {formatCurrency(medication.currentPrice.value)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {medication.currentPrice.labName}
                  </p>
                </div>
                
                <div className={`text-right ${getPriceChangeColor(medication.variation30d)}`}>
                  <p className="text-sm font-medium">
                    {medication.variation30d > 0 ? '+' : ''}{formatPercentage(medication.variation30d)}
                  </p>
                  <p className="text-xs">30 dias</p>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
