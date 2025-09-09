# 🚀 RayMed - Início Rápido

Sistema completo de alertas de preços de medicamentos pronto para execução.

## ⚡ Execução Rápida (5 minutos)

### 1. **Pré-requisitos**
- Node.js 18+ 
- pnpm 8+
- Docker Desktop rodando

### 2. **Setup Automático**
```bash
# Clone ou navegue até o diretório
cd sistema_teste_famrcia_valor

# Execute o script de setup
./scripts/setup.sh
```

### 3. **Iniciar Desenvolvimento**
```bash
# Inicia frontend e backend simultaneamente
pnpm dev
```

**Pronto! 🎉**
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **Health**: http://localhost:3001/api/health

---

## 🔧 Configuração Manual (se necessário)

### 1. Instalar Dependências
```bash
pnpm install
```

### 2. Configurar Ambiente
```bash
# Copiar arquivo de configuração
cp env.example .env

# Editar configurações (opcional)
# As configurações padrão funcionam para desenvolvimento local
```

### 3. Banco de Dados
```bash
# Iniciar PostgreSQL e Redis
docker compose up -d

# Configurar banco
pnpm db:migrate
pnpm db:seed
```

### 4. Executar
```bash
# Desenvolvimento
pnpm dev

# Ou separadamente:
pnpm dev:web      # Frontend (porta 3000)
pnpm dev:server   # Backend (porta 3001)
```

---

## 🧪 Testando o Sistema

### 1. **Verificar Saúde**
```bash
curl http://localhost:3001/api/health
```

### 2. **Executar Jobs Manualmente**
```bash
# Todos os jobs (ingestão, análise, notificação)
pnpm cron:all

# Jobs individuais:
pnpm --filter @raymed/server cron:ingest   # Buscar preços
pnpm --filter @raymed/server cron:analyze  # Detectar alertas
pnpm --filter @raymed/server cron:notify   # Enviar emails
```

### 3. **Acessar Aplicação**
- Navegue para http://localhost:3000
- Explore medicamentos, configure alertas
- Teste o chat LLM (requer API key)

---

## 📊 Dados de Demonstração

O seed cria automaticamente:
- **8 medicamentos** com preços históricos (90 dias)
- **5 laboratórios** farmacêuticos
- **2 usuários** (admin@raymed.com, teste@raymed.com)
- **3 inscrições** de exemplo
- **Preços simulados** com variações realistas

---

## 🔑 Configurações Importantes

### **API Ray** (Opcional)
```bash
RAY_API_BASE=https://api.plataformaray.com.br
RAY_API_KEY=sua_chave_aqui
```

### **LLM Chat** (Opcional)
```bash
# Escolha um provider
LLM_PROVIDER=openai
OPENAI_API_KEY=sua_chave

# OU
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sua_chave

# OU
LLM_PROVIDER=gemini  
GOOGLE_API_KEY=sua_chave
```

### **Email SMTP** (Para alertas)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_app
```

---

## 🛠️ Comandos Úteis

```bash
# Visualizar banco
pnpm db:studio

# Reset completo
pnpm db:reset

# Logs do servidor
docker compose logs -f server

# Build para produção
pnpm build

# Executar testes
pnpm test
```

---

## 🎯 Funcionalidades Principais

✅ **Monitoramento de Preços**
- Ingestão automática via API Ray
- Histórico de 90 dias por padrão
- Cache inteligente (Redis/memória)

✅ **Alertas Inteligentes**  
- Queda percentual configurável
- Preço alvo personalizado
- Variação diária significativa

✅ **Interface Moderna**
- Next.js 14 + Tailwind CSS
- Gráficos interativos (Recharts)
- Design responsivo

✅ **Chat LLM**
- Perguntas sobre preços/tendências
- Múltiplos provedores (OpenAI/Anthropic/Gemini)
- Respostas com fontes citadas

✅ **Jobs Automatizados**
- Cron jobs para ingestão/análise
- Rate limiting e retry logic
- Logs estruturados

---

## 🚨 Solução de Problemas

### **Porta em uso**
```bash
# Alterar portas no .env
PORT=3002  # Backend
# Frontend usa 3000 por padrão
```

### **Banco não conecta**
```bash
# Verificar Docker
docker compose ps

# Reiniciar serviços
docker compose restart postgres redis
```

### **Jobs não executam**
```bash
# Verificar configuração
CRON_INGEST_ENABLED=true
CRON_ANALYZE_ENABLED=true  
CRON_NOTIFY_ENABLED=true
```

### **Cache issues**
```bash
# Limpar cache Redis
docker compose exec redis redis-cli FLUSHALL
```

---

## 📞 Suporte

- **Documentação**: README.md completo
- **Logs**: `docker compose logs -f`
- **Health Check**: http://localhost:3001/api/health
- **Banco Visual**: `pnpm db:studio`

---

**🎉 Bem-vindo ao RayMed!**  
Sistema inteligente de alertas de preços de medicamentos.
