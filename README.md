# RayMed - Sistema de Alertas de Preços de Medicamentos

Sistema inteligente de monitoramento e alertas de preços de medicamentos integrado com a API Ray. Monitora variações de preços, detecta oportunidades de economia e envia alertas personalizados por email.

## 🚀 Funcionalidades

### 🔍 **Monitoramento Inteligente**
- Consulta automática da API Ray para preços de medicamentos
- Histórico de preços com análise de tendências
- Projeções de preços baseadas em EWMA (Exponential Weighted Moving Average)
- Comparação entre laboratórios

### 📧 **Alertas Personalizados**
- **Queda Percentual**: Alerta quando preço cair X% vs média de 30 dias
- **Preço Alvo**: Notificação quando preço atingir valor definido pelo usuário
- **Variação Diária**: Alerta para mudanças significativas (>5%)
- Deduplicação e rate limiting para evitar spam

### 📊 **Dashboard e Analytics**
- Painel com quedas recentes e tendências
- Gráficos interativos (Recharts) com histórico de preços
- Ranking de laboratórios por custo-benefício
- Métricas de sistema e performance

### 🤖 **Chat LLM Inteligente**
- Perguntas sobre preços e tendências
- Respostas com citabilidade (fontes dos dados)
- Suporte a múltiplos provedores (OpenAI/Anthropic/Gemini)
- Consultas SQL seguras geradas automaticamente

### 👥 **Gestão de Usuários**
- Autenticação via NextAuth (magic link)
- Inscrições por medicamento/laboratório
- Limites por usuário para evitar abuso
- Painel administrativo completo

## 🏗️ Arquitetura

### **Monorepo Structure**
```
├── apps/
│   ├── web/          # Next.js 14 App Router (Frontend)
│   └── server/       # NestJS (Backend API)
├── packages/
│   └── shared/       # Tipos, utilitários e clientes compartilhados
├── docker-compose.yml
└── README.md
```

### **Stack Tecnológica**

#### **Frontend (apps/web)**
- **Next.js 14** com App Router
- **TypeScript** para type safety
- **Tailwind CSS** + **shadcn/ui** para UI moderna
- **Recharts** para visualizações
- **NextAuth** para autenticação
- **Zustand** para gerenciamento de estado
- **Vitest** para testes unitários
- **Playwright** para testes E2E

#### **Backend (apps/server)**
- **NestJS** com TypeScript
- **Prisma** ORM com PostgreSQL
- **Redis** para cache (fallback para memória)
- **node-cron** para jobs agendados
- **Nodemailer** para envio de emails
- **Pino** para logs estruturados
- **Jest** para testes

#### **Shared (packages/shared)**
- **Ray API Client** com retry e circuit breaker
- **LLM Wrapper** agnóstico (OpenAI/Anthropic/Gemini)
- **Tipos TypeScript** compartilhados
- **Utilitários** (cache, rate limiting, projeções)

## 🗄️ Modelo de Dados

### **Principais Entidades**
- **User**: Usuários do sistema (admin/user)
- **Medication**: Catálogo de medicamentos
- **Lab**: Laboratórios farmacêuticos
- **Price**: Histórico de preços com timestamps
- **Subscription**: Inscrições de alerta por usuário
- **Alert**: Alertas gerados pelo sistema
- **JobRun**: Controle de execução de jobs

### **Índices Otimizados**
- Busca por medicamento/data para consultas rápidas
- Índices compostos para análise de tendências
- Particionamento por data para escalabilidade

## ⚙️ Configuração e Execução

### **Pré-requisitos**
- Node.js 18+
- pnpm 8+
- Docker e Docker Compose
- PostgreSQL 15+
- Redis 7+ (opcional)

### **1. Instalação**
```bash
# Clone o repositório
git clone <repository-url>
cd sistema_teste_famrcia_valor

# Instale dependências
pnpm install

# Configure ambiente
cp env.example .env
# Edite .env com suas configurações
```

### **2. Configuração do Banco**
```bash
# Inicie PostgreSQL e Redis
docker compose up -d

# Execute migrations
pnpm db:migrate

# Popule com dados de teste
pnpm db:seed
```

### **3. Desenvolvimento**
```bash
# Inicie todos os serviços
pnpm dev

# Ou individualmente:
pnpm dev:web    # Frontend (porta 3000)
pnpm dev:server # Backend (porta 3001)
```

### **4. Jobs e Monitoramento**
```bash
# Execute jobs manualmente
pnpm cron:all

# Ou jobs específicos:
pnpm --filter @raymed/server cron:ingest  # Ingestão de preços
pnpm --filter @raymed/server cron:analyze # Análise de alertas
pnpm --filter @raymed/server cron:notify  # Envio de emails
```

## 🔧 Configuração Avançada

### **Variáveis de Ambiente**
```bash
# API Ray
RAY_API_BASE=https://api.plataformaray.com.br
RAY_API_KEY=sua_chave_aqui
RAY_API_TIMEOUT=30000

# LLM (escolha um provider)
LLM_PROVIDER=openai
OPENAI_API_KEY=sua_chave_openai
# OU
ANTHROPIC_API_KEY=sua_chave_anthropic
# OU  
GOOGLE_API_KEY=sua_chave_gemini

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_app

# Cache e Rate Limiting
REDIS_URL=redis://localhost:6379
RATE_LIMIT_MAX_REQUESTS=100
CACHE_TTL_MEDICATIONS=900000
```

### **Personalização de Endpoints**
A API Ray pode alterar caminhos. Configure via env:
```bash
RAY_ENDPOINT_MEDICATIONS=/medicamentos
RAY_ENDPOINT_LABS=/laboratorios  
RAY_ENDPOINT_PRICES=/precos
RAY_ENDPOINT_PRICE_HISTORY=/precos/historico
```

## 🧪 Testes

### **Testes Unitários**
```bash
# Frontend
pnpm --filter @raymed/web test

# Backend  
pnpm --filter @raymed/server test

# Com coverage
pnpm --filter @raymed/server test:cov
```

### **Testes E2E**
```bash
# Configure ambiente de teste
cp .env.example .env.test

# Execute testes E2E
pnpm test:e2e

# Com interface visual
pnpm test:e2e:ui
```

### **Critérios de Aceite**
✅ Usuário consegue se inscrever para alertas de medicamentos  
✅ Sistema detecta quedas de preço e gera alertas  
✅ Emails são enviados quando critérios são atendidos  
✅ Página de medicamento exibe histórico e projeções  
✅ Chat LLM responde perguntas com fontes citadas  
✅ Tudo funciona com `pnpm i && docker compose up -d && pnpm dev`

## 📊 Jobs e Automação

### **Cronograma de Execução**
- **Ingestão**: A cada 10 minutos (busca novos preços)
- **Análise**: A cada 10 minutos, offset 2min (detecta alertas)  
- **Notificação**: A cada 5 minutos (envia emails)

### **Monitoramento**
- Logs estruturados com Pino
- Métricas de performance no banco
- Health checks em `/api/health`
- Dashboard admin com status dos jobs

## 🚀 Deploy

### **Docker**
```bash
# Build das imagens
docker build -f apps/web/Dockerfile -t raymed-web .
docker build -f apps/server/Dockerfile -t raymed-server .

# Deploy com compose
docker compose -f docker-compose.prod.yml up -d
```

### **Vercel + Railway**
- Frontend: Deploy no Vercel com env vars
- Backend: Deploy no Railway/Render
- Banco: PostgreSQL gerenciado (Neon/Supabase)

## 🔒 Segurança

### **Implementadas**
- Rate limiting por IP/usuário
- Sanitização de inputs
- Consultas SQL parametrizadas
- Validação com Zod
- Headers de segurança
- Logs de auditoria

### **Proteção Admin**
- Rotas protegidas por role
- Métricas sensíveis restritas
- Logs de ações administrativas

## 📈 Performance

### **Otimizações**
- Cache Redis com fallback
- Índices de banco otimizados
- ISR/SSR híbrido no Next.js
- Lazy loading de componentes
- Compressão de assets
- CDN para imagens

### **Escalabilidade**
- Jobs distribuídos
- Cache distribuído
- Particionamento de dados
- Rate limiting inteligente

## 🤝 Contribuição

### **Desenvolvimento**
1. Fork o repositório
2. Crie feature branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit mudanças (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. Push para branch (`git push origin feature/nova-funcionalidade`)
5. Abra Pull Request

### **Padrões de Código**
- ESLint + Prettier configurados
- Husky para pre-commit hooks
- Conventional Commits
- TypeScript strict mode
- Testes obrigatórios para novas features

## 📞 Suporte

### **Documentação**
- Swagger API: `http://localhost:3001/api/docs`
- Storybook: `http://localhost:6006`
- Prisma Studio: `pnpm db:studio`

### **Troubleshooting**
- **API Ray offline**: Sistema usa dados cacheados
- **Redis indisponível**: Fallback para cache em memória  
- **Jobs travados**: Restart via `/api/admin/jobs/restart`
- **Emails não enviando**: Verificar configuração SMTP

### **Logs**
```bash
# Logs estruturados do servidor
docker compose logs -f server

# Logs do frontend (dev)
pnpm --filter @raymed/web dev
```

---

## 📄 Licença

Este projeto está sob licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

---

**RayMed Team** - Sistema inteligente de alertas de preços de medicamentos 💊📊
