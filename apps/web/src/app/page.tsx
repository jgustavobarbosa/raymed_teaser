import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RecentDrops } from '@/components/recent-drops';
import { PriceStats } from '@/components/price-stats';
import { TrendingMedications } from '@/components/trending-medications';
import { AlertsSummary } from '@/components/alerts-summary';
import { Button } from '@/components/ui/button';
import { Plus, TrendingDown, Bell, Search } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="text-center py-12 gradient-bg text-white rounded-lg">
        <h1 className="text-4xl font-bold mb-4">
          RayMed - Alertas Inteligentes
        </h1>
        <p className="text-xl mb-8 opacity-90">
          Monitore preços de medicamentos e receba alertas quando houver quedas significativas
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg" variant="secondary">
            <Link href="/medicamentos">
              <Search className="mr-2 h-4 w-4" />
              Buscar Medicamentos
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/inscricoes">
              <Plus className="mr-2 h-4 w-4" />
              Criar Alerta
            </Link>
          </Button>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Suspense fallback={<StatsCardSkeleton />}>
          <PriceStats />
        </Suspense>
      </section>

      {/* Main Content Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Drops */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-green-600" />
              Quedas Recentes
            </CardTitle>
            <CardDescription>
              Medicamentos com maiores quedas de preço nas últimas 24 horas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ListSkeleton />}>
              <RecentDrops />
            </Suspense>
          </CardContent>
        </Card>

        {/* Alerts Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              Resumo de Alertas
            </CardTitle>
            <CardDescription>
              Seus alertas ativos e notificações recentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ListSkeleton />}>
              <AlertsSummary />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      {/* Trending Medications */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Medicamentos em Destaque</CardTitle>
            <CardDescription>
              Medicamentos com maior variação de preços e interesse dos usuários
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<GridSkeleton />}>
              <TrendingMedications />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="text-center py-12 bg-muted rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">
          Nunca mais perca uma oportunidade de economia
        </h2>
        <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
          Configure alertas personalizados para seus medicamentos e seja notificado 
          instantaneamente quando os preços caírem ou atingirem seu valor alvo.
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/inscricoes">
              Configurar Alertas
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/medicamentos">
              Ver Todos os Medicamentos
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

// Loading Skeletons
function StatsCardSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="skeleton h-4 w-24 mb-2" />
            <div className="skeleton h-8 w-16" />
          </CardHeader>
          <CardContent>
            <div className="skeleton h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded" />
          <div className="flex-1">
            <div className="skeleton h-4 w-32 mb-2" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="border rounded-lg p-4">
          <div className="skeleton h-4 w-32 mb-2" />
          <div className="skeleton h-6 w-20 mb-2" />
          <div className="skeleton h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
