#!/bin/bash

echo "🚀 Configurando RayMed - Sistema de Alertas de Medicamentos"
echo "=========================================================="

# Verificar se pnpm está instalado
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm não encontrado. Instalando..."
    npm install -g pnpm
fi

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker Desktop."
    exit 1
fi

echo "📦 Instalando dependências..."
pnpm install

echo "🗄️  Iniciando banco de dados..."
docker compose up -d postgres redis

# Aguardar postgres inicializar
echo "⏳ Aguardando PostgreSQL inicializar..."
sleep 10

echo "🔧 Configurando banco de dados..."
pnpm --filter @raymed/server db:generate
pnpm --filter @raymed/server db:migrate
pnpm --filter @raymed/server db:seed

echo "✅ Setup concluído!"
echo ""
echo "Para iniciar o desenvolvimento:"
echo "  pnpm dev"
echo ""
echo "URLs importantes:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"
echo "  Health:   http://localhost:3001/api/health"
echo ""
echo "Para executar jobs manualmente:"
echo "  pnpm cron:all"
echo ""
echo "🎉 RayMed está pronto para uso!"
