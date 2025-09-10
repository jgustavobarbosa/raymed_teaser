#!/bin/bash

# ===================================
# RayMed - Script de Inicialização
# ===================================

set -e  # Parar se houver erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Função para imprimir com cores
print_step() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}"
    echo "=================================="
    echo "🚀 RayMed - Sistema de Alertas"
    echo "=================================="
    echo -e "${NC}"
}

# Função para verificar se uma porta está em uso
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Porta em uso
    else
        return 1  # Porta livre
    fi
}

# Função para encontrar porta livre
find_free_port() {
    local start_port=$1
    local port=$start_port
    
    while check_port $port; do
        port=$((port + 1))
    done
    
    echo $port
}

# Função para parar processos existentes
cleanup_processes() {
    print_step "Parando processos existentes..."
    
    # Parar processos Next.js
    pkill -f "next dev" 2>/dev/null || true
    
    # Parar processos Node.js do servidor
    pkill -f "test-server.js" 2>/dev/null || true
    pkill -f "PORT=.*node" 2>/dev/null || true
    
    sleep 2
    print_success "Processos limpos"
}

# Função principal
main() {
    print_header
    
    # Verificar se estamos no diretório correto
    if [ ! -f "package.json" ]; then
        print_error "Execute este script no diretório raiz do projeto!"
        exit 1
    fi
    
    # Verificar dependências
    print_step "Verificando dependências..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js não encontrado! Instale Node.js 18+ primeiro."
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm não encontrado! Instale com: npm install -g pnpm"
        exit 1
    fi
    
    print_success "Dependências OK"
    
    # Limpar processos existentes
    cleanup_processes
    
    # Encontrar portas livres
    BACKEND_PORT=$(find_free_port 3001)
    FRONTEND_PORT=$(find_free_port 3000)
    
    if [ $BACKEND_PORT -ne 3001 ]; then
        print_warning "Porta 3001 ocupada, usando porta $BACKEND_PORT para o backend"
    fi
    
    if [ $FRONTEND_PORT -ne 3000 ]; then
        print_warning "Porta 3000 ocupada, usando porta $FRONTEND_PORT para o frontend"
    fi
    
    # Instalar dependências se necessário
    if [ ! -d "node_modules" ]; then
        print_step "Instalando dependências..."
        pnpm install
        print_success "Dependências instaladas"
    fi
    
    # Configurar backend
    print_step "Configurando backend..."
    
    # Criar .env para o servidor se não existir
    if [ ! -f "apps/server/.env" ]; then
        cat > apps/server/.env << EOF
DATABASE_URL="file:./prisma/dev.db"
PORT=$BACKEND_PORT
NODE_ENV=development
LOG_LEVEL=info
EOF
        print_success "Arquivo .env do servidor criado"
    else
        # Atualizar porta no .env existente
        if grep -q "PORT=" apps/server/.env; then
            sed -i.bak "s/PORT=.*/PORT=$BACKEND_PORT/" apps/server/.env
        else
            echo "PORT=$BACKEND_PORT" >> apps/server/.env
        fi
    fi
    
    # Configurar frontend
    print_step "Configurando frontend..."
    
    # Atualizar next.config.js com a porta correta do backend
    cat > apps/web/next.config.js << EOF
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@raymed/shared'],
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:$FRONTEND_PORT',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  },
  async rewrites() {
    return [
      {
        source: '/api/server/:path*',
        destination: \`\${process.env.SERVER_URL || 'http://localhost:$BACKEND_PORT'}/api/:path*\`,
      },
    ];
  },
  images: {
    domains: ['localhost'],
  },
};

module.exports = nextConfig;
EOF
    
    # Criar .env.local para o frontend
    cat > apps/web/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:$BACKEND_PORT
SERVER_URL=http://localhost:$BACKEND_PORT
PORT=$FRONTEND_PORT
EOF
    
    print_success "Frontend configurado"
    
    # Configurar banco de dados
    print_step "Configurando banco de dados..."
    
    cd apps/server
    
    # Gerar cliente Prisma
    npx prisma generate > /dev/null 2>&1
    
    # Verificar se o banco já existe e tem dados
    if [ -f "prisma/dev.db" ]; then
        print_success "Banco de dados já existe"
        # Tentar verificar se tem dados, mas não falhar se der erro
        MEDICATION_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM Medication;" 2>/dev/null || echo "0")
        if [ "$MEDICATION_COUNT" -gt "0" ] 2>/dev/null; then
            print_success "Banco já tem $MEDICATION_COUNT medicamentos"
        else
            print_step "Populando banco de dados..."
            if npx prisma db seed > /dev/null 2>&1; then
                print_success "Banco de dados populado"
            else
                print_warning "Erro ao popular banco, mas continuando..."
            fi
        fi
    else
        print_step "Criando e populando banco de dados..."
        npx prisma migrate deploy > /dev/null 2>&1 || print_warning "Migrate falhou, mas continuando..."
        if npx prisma db seed > /dev/null 2>&1; then
            print_success "Banco de dados criado e populado"
        else
            print_warning "Erro ao popular banco, mas continuando..."
        fi
    fi
    
    cd ../..
    
    # Setup opcional de Machine Learning
    if [ -f "scripts/setup-ml.sh" ]; then
        print_step "Configurando Machine Learning (opcional)..."
        if ./scripts/setup-ml.sh > /dev/null 2>&1; then
            print_success "Machine Learning configurado com modelos avançados"
        else
            print_warning "ML setup falhou - usando modelos JavaScript fallback"
        fi
    fi
    
    # Criar script de parada
    cat > stop.sh << 'EOF'
#!/bin/bash
echo "🛑 Parando RayMed..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "test-server.js" 2>/dev/null || true
pkill -f "PORT=.*node" 2>/dev/null || true
echo "✅ Processos parados"
EOF
    chmod +x stop.sh
    
    # Iniciar serviços
    print_step "Iniciando backend na porta $BACKEND_PORT..."
    
    cd apps/server
    PORT=$BACKEND_PORT node test-server.js &
    BACKEND_PID=$!
    cd ../..
    
    # Aguardar backend iniciar
    sleep 3
    
    # Verificar se backend está rodando
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Falha ao iniciar backend"
        exit 1
    fi
    
    # Testar backend
    if curl -s "http://localhost:$BACKEND_PORT/api/healthz" > /dev/null; then
        print_success "Backend iniciado com sucesso"
    else
        print_error "Backend não está respondendo"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    
    print_step "Iniciando frontend na porta $FRONTEND_PORT..."
    
    cd apps/web
    PORT=$FRONTEND_PORT pnpm dev &
    FRONTEND_PID=$!
    cd ../..
    
    # Aguardar frontend iniciar
    sleep 5
    
    # Salvar PIDs para o script de parada
    echo $BACKEND_PID > .backend_pid
    echo $FRONTEND_PID > .frontend_pid
    
    # Verificar se frontend está rodando
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Falha ao iniciar frontend"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    
    # Mostrar informações finais
    echo
    print_success "🎉 RayMed iniciado com sucesso!"
    echo
    echo -e "${CYAN}📊 URLs de Acesso:${NC}"
    echo -e "   🌐 Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "   🔧 Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}"
    echo -e "   ❤️  Health:   ${GREEN}http://localhost:$BACKEND_PORT/api/healthz${NC}"
    echo
    echo -e "${CYAN}📋 Funcionalidades Disponíveis:${NC}"
    echo -e "   💊 832 medicamentos monitorados"
    echo -e "   🏥 35 laboratórios brasileiros"
    echo -e "   🔔 Sistema de alertas personalizados"
    echo -e "   🤖 Chat IA farmacêutica (configure API key)"
    echo -e "   📧 Notificações por email"
    echo
    echo -e "${YELLOW}🛑 Para parar os serviços:${NC}"
    echo -e "   ./stop.sh"
    echo
    echo -e "${YELLOW}💡 Dica:${NC}"
    echo -e "   Configure sua API key OpenAI em apps/server/.env para usar o chat IA"
    echo -e "   OPENAI_API_KEY=sua_chave_aqui"
    echo
    
    # Manter o script rodando para mostrar logs
    print_step "Serviços rodando... Pressione Ctrl+C para parar"
    
    # Função para cleanup ao receber SIGINT
    cleanup() {
        echo
        print_step "Parando serviços..."
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        rm -f .backend_pid .frontend_pid
        print_success "Serviços parados"
        exit 0
    }
    
    trap cleanup SIGINT SIGTERM
    
    # Aguardar indefinidamente
    wait
}

# Executar função principal
main "$@"
