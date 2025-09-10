# 🚀 RayMed - Início Rápido

## ⚡ Uso Simples

### Para iniciar o sistema completo:

```bash
./start.sh
```

### Para parar o sistema:

```bash
./stop.sh
```

## 🎯 O que o script faz automaticamente:

✅ **Detecta portas livres** - Evita conflitos de porta automaticamente  
✅ **Instala dependências** - Se necessário  
✅ **Configura banco SQLite** - Cria e popula com 832 medicamentos  
✅ **Ajusta configurações** - Proxy, portas, variáveis de ambiente  
✅ **Inicia backend e frontend** - Com configurações corretas  
✅ **Mostra URLs de acesso** - Para fácil navegação  
✅ **Cleanup automático** - Para parada limpa

## 🌐 URLs de Acesso

Após executar `./start.sh`, você verá as URLs disponíveis:

- **Frontend**: http://localhost:3000 (ou próxima porta livre)
- **Backend**: http://localhost:3001 (ou próxima porta livre)
- **Health Check**: http://localhost:3001/api/healthz

## 💡 Funcionalidades Disponíveis

- 💊 **832 medicamentos** monitorados
- 🏥 **35 laboratórios** brasileiros
- 🔔 **Sistema de alertas** personalizados
- 🤖 **Chat IA farmacêutica** (configure API key)
- 📧 **Notificações por email**

## 🔑 Configuração Opcional da IA

Para usar o chat IA, adicione sua API key OpenAI:

1. Abra `apps/server/.env`
2. Adicione: `OPENAI_API_KEY=sua_chave_aqui`
3. Reinicie: `./stop.sh && ./start.sh`

## 🛠️ Resolução de Problemas

### Se algo der errado:

```bash
# Parar tudo
./stop.sh

# Limpar processos manualmente se necessário
pkill -f "next dev"
pkill -f "test-server.js"

# Iniciar novamente
./start.sh
```

### Se precisar resetar o banco:

```bash
rm apps/server/prisma/dev.db*
./start.sh
```

## 📋 Requisitos

- **Node.js** 18+
- **pnpm** 8+
- **Sistema**: macOS, Linux, Windows (WSL)

### Instalar pnpm se necessário:

```bash
npm install -g pnpm
```

---

**Pronto para usar! Execute `./start.sh` e comece a explorar o RayMed! 🎉**
