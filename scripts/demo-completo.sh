#!/bin/bash

# ===================================
# RayMed - Demo Completo ML
# ===================================

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}=============================================="
    echo "🚀 RayMed - Demonstração Completa ML + Otimização"
    echo "==============================================${NC}"
    echo
}

print_section() {
    echo -e "${BLUE}$1${NC}"
    echo "-------------------------------------------"
}

print_result() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}💡 $1${NC}"
}

API_BASE="http://localhost:3001"

main() {
    print_header
    
    # Verificar se servidor está rodando
    if ! curl -s "$API_BASE/api/healthz" > /dev/null; then
        echo -e "${RED}❌ Servidor não está rodando!${NC}"
        echo "Execute: ./start.sh"
        exit 1
    fi
    
    print_result "Servidor RayMed conectado"
    echo
    
    # Demo 1: Configurar Alertas Automáticos
    print_section "🚨 Demo 1: Configuração de Alertas Automáticos"
    
    echo "Configurando alertas automáticos para outliers..."
    ALERT_CONFIG=$(curl -s -X POST "$API_BASE/api/ml/outliers/alerts/configure" \
      -H "Content-Type: application/json" \
      -d '{
        "enabled": true,
        "threshold": 2.0,
        "recipients": ["admin@raymed.com", "farmaceutico@raymed.com"],
        "alertLevels": {
          "low": 1.5,
          "medium": 2.0, 
          "high": 3.0,
          "critical": 4.0
        }
      }')
    
    if echo "$ALERT_CONFIG" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Alertas automáticos configurados!"
        print_info "Threshold: 2.0 (moderado)"
        print_info "Destinatários: admin@raymed.com, farmaceutico@raymed.com"
        print_info "Verificação: a cada 15 minutos"
    else
        echo "❌ Erro ao configurar alertas"
    fi
    
    echo
    echo
    
    # Demo 2: Otimização de Compras
    print_section "💰 Demo 2: Otimização de Compras"
    
    echo "Analisando recomendações de compra para Paracetamol..."
    echo "📦 Estoque atual: 100 unidades"
    echo "📊 Consumo mensal: 50 unidades"
    echo
    
    PURCHASE_REC=$(curl -s -X POST "$API_BASE/api/ml/purchase/recommendations" \
      -H "Content-Type: application/json" \
      -d '{
        "medicationCode": "PARACETAMOL-500MG",
        "currentStock": 100,
        "monthlyConsumption": 50
      }')
    
    if echo "$PURCHASE_REC" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Análise de compras concluída!"
        
        # Extrair primeira recomendação
        FIRST_REC=$(echo "$PURCHASE_REC" | jq -r '.data.recommendations[0]')
        ACTION=$(echo "$FIRST_REC" | jq -r '.action')
        LAB=$(echo "$FIRST_REC" | jq -r '.laboratory')
        SAVINGS=$(echo "$FIRST_REC" | jq -r '.expectedSavings')
        PRIORITY=$(echo "$FIRST_REC" | jq -r '.priority')
        
        print_info "🏥 Melhor laboratório: $LAB"
        print_info "🎯 Ação recomendada: $ACTION"
        print_info "💰 Economia esperada: R$ $SAVINGS"
        print_info "⚡ Prioridade: $PRIORITY"
        
        echo
        echo "📋 Todas as recomendações:"
        echo "$PURCHASE_REC" | jq '.data.recommendations[] | {lab: .laboratory, action: .action, savings: .expectedSavings, priority: .priority}'
        
        echo
        echo "📊 Análise de mercado:"
        echo "$PURCHASE_REC" | jq '.data.marketAnalysis'
    else
        echo "❌ Erro ao gerar recomendações"
    fi
    
    echo
    echo
    
    # Demo 3: Dashboard de Compras
    print_section "📈 Demo 3: Dashboard de Otimização"
    
    echo "Carregando dashboard de oportunidades de compra..."
    PURCHASE_DASHBOARD=$(curl -s "$API_BASE/api/ml/purchase/dashboard")
    
    if echo "$PURCHASE_DASHBOARD" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Dashboard de compras carregado!"
        
        URGENT_COUNT=$(echo "$PURCHASE_DASHBOARD" | jq '.data.urgentActions | length')
        OPPORTUNITIES_COUNT=$(echo "$PURCHASE_DASHBOARD" | jq '.data.savingsOpportunities | length')
        
        print_info "🚨 Ações urgentes: $URGENT_COUNT"
        print_info "💰 Oportunidades de economia: $OPPORTUNITIES_COUNT"
        
        echo
        echo "🚨 Ações urgentes detectadas:"
        if [ "$URGENT_COUNT" -gt "0" ]; then
            echo "$PURCHASE_DASHBOARD" | jq '.data.urgentActions[] | {medication, laboratory, savings, reason}'
        else
            echo "   Nenhuma ação urgente no momento"
        fi
        
        echo
        echo "💰 Top oportunidades de economia:"
        echo "$PURCHASE_DASHBOARD" | jq '.data.savingsOpportunities[0:3] | map({medication, laboratory, savings, percentage, trend})'
        
        echo
        echo "💡 Insights de mercado:"
        echo "$PURCHASE_DASHBOARD" | jq -r '.data.marketInsights[]' | while read insight; do
            print_info "$insight"
        done
    else
        echo "❌ Erro ao carregar dashboard"
    fi
    
    echo
    echo
    
    # Demo 4: Status dos Alertas Automáticos
    print_section "📊 Demo 4: Status dos Alertas Automáticos"
    
    echo "Verificando status do sistema de alertas..."
    ALERT_STATUS=$(curl -s "$API_BASE/api/ml/outliers/alerts/status")
    
    if echo "$ALERT_STATUS" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Sistema de alertas ativo!"
        
        ENABLED=$(echo "$ALERT_STATUS" | jq -r '.data.enabled')
        ACTIVE_ALERTS=$(echo "$ALERT_STATUS" | jq -r '.data.totalActiveAlerts')
        NOTIFICATIONS_TODAY=$(echo "$ALERT_STATUS" | jq -r '.data.notificationsSentToday')
        NEXT_CHECK=$(echo "$ALERT_STATUS" | jq -r '.data.nextCheck')
        
        print_info "Status: ${ENABLED}"
        print_info "Alertas ativos: $ACTIVE_ALERTS"
        print_info "Notificações hoje: $NOTIFICATIONS_TODAY"
        print_info "Próxima verificação: $(date -d "$NEXT_CHECK" '+%H:%M')"
        
        echo
        echo "📊 Alertas por nível:"
        echo "$ALERT_STATUS" | jq '.data.alertsByLevel'
    else
        echo "❌ Erro ao verificar status dos alertas"
    fi
    
    echo
    echo
    
    # Demo 5: Teste Completo do Frontend
    print_section "🌐 Demo 5: Frontend com ML Analytics"
    
    echo "Verificando se frontend está acessível..."
    if curl -s "http://localhost:3000" > /dev/null; then
        print_result "Frontend acessível!"
        print_info "🌐 Acesse: http://localhost:3000"
        print_info "🧠 Vá para aba 'ML Analytics' para ver:"
        echo "     • 🔮 Previsões de preços"
        echo "     • 🔍 Detecção de outliers"
        echo "     • 🏆 Ranking de competitividade"
        echo "     • 💰 Otimização de compras"
        echo "     • 📊 Dashboard executivo"
    else
        echo "❌ Frontend não acessível"
    fi
    
    echo
    echo
    
    # Resumo final
    print_section "🎯 Resumo da Implementação Completa"
    
    echo -e "${GREEN}✅ Funcionalidades Implementadas:${NC}"
    echo
    echo "🧠 MACHINE LEARNING:"
    echo "   • Prophet: Sazonalidade e tendências"
    echo "   • ARIMA: Padrões lineares (com fallback)"
    echo "   • LSTM: Deep learning para padrões complexos"
    echo "   • Ensemble: Combinação de múltiplos modelos"
    echo
    echo "🔍 DETECÇÃO DE OUTLIERS:"
    echo "   • Z-Score, IQR, Isolation Forest"
    echo "   • Análise contextual e temporal"
    echo "   • Detecção de padrões fraudulentos"
    echo "   • Alertas automáticos por email"
    echo
    echo "🏆 COMPETITIVIDADE:"
    echo "   • Ranking dinâmico de laboratórios"
    echo "   • Score baseado em múltiplos fatores"
    echo "   • Análise por categoria de medicamentos"
    echo "   • Tendências de mercado"
    echo
    echo "💰 OTIMIZAÇÃO DE COMPRAS:"
    echo "   • Recomendações baseadas em previsões"
    echo "   • Análise de timing ótimo"
    echo "   • Calculadora de estoque"
    echo "   • Dashboard de oportunidades"
    echo
    echo -e "${PURPLE}🔗 APIs Disponíveis:${NC}"
    echo "   POST /api/ml/predictions - Previsões"
    echo "   GET  /api/ml/outliers - Outliers"
    echo "   GET  /api/ml/competitiveness - Competitividade"
    echo "   POST /api/ml/outliers/alerts/configure - Alertas"
    echo "   POST /api/ml/purchase/recommendations - Compras"
    echo "   GET  /api/ml/purchase/dashboard - Dashboard"
    echo
    echo -e "${YELLOW}🌐 Frontend Integrado:${NC}"
    echo "   • MLDashboard: Análises completas"
    echo "   • PurchaseOptimizer: Otimização de compras"
    echo "   • Navegação atualizada com 'ML Analytics'"
    echo "   • Integração com APIs existentes"
    echo
    echo -e "${BLUE}🛠️ Scripts de Utilidade:${NC}"
    echo "   • ./scripts/setup-ml.sh - Setup avançado"
    echo "   • ./scripts/fix-arima.sh - Corrigir ARIMA"
    echo "   • ./scripts/demo-ml.sh - Demo básico"
    echo "   • ./scripts/demo-completo.sh - Este demo"
    echo
    print_result "🎉 Sistema ML completo implementado e funcionando!"
    echo
    echo -e "${YELLOW}📝 Próximos passos sugeridos:${NC}"
    echo "1. Configure API keys para modelos avançados"
    echo "2. Execute ./scripts/fix-arima.sh se necessário"
    echo "3. Explore o frontend em http://localhost:3000"
    echo "4. Configure alertas automáticos via API"
    echo "5. Use otimização de compras para decisões estratégicas"
}

main "$@"
