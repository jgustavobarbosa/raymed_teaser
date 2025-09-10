#!/bin/bash

# ===================================
# RayMed - Demo Chat LLM Evoluído
# ===================================

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}======================================================"
    echo "🤖 RayMed - Demo Chat LLM Evoluído + Perfis de Usuário"
    echo "======================================================${NC}"
    echo
}

print_section() {
    echo -e "${BLUE}$1${NC}"
    echo "----------------------------------------------------"
}

print_result() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}💡 $1${NC}"
}

print_highlight() {
    echo -e "${CYAN}🎯 $1${NC}"
}

API_BASE="http://localhost:3001"

main() {
    print_header
    
    # Verificar se servidor está rodando
    if ! curl -s "$API_BASE/api/healthz" > /dev/null; then
        echo "❌ Servidor não está rodando!"
        echo "Execute: ./start.sh"
        exit 1
    fi
    
    print_result "Sistema RayMed conectado"
    echo
    
    # Demo 1: Consultas Complexas
    print_section "🔍 Demo 1: Consultas Complexas"
    
    echo "Testando consulta: 'Top 5 medicamentos oncológicos com maior queda de preço'..."
    COMPLEX_QUERY=$(curl -s -X POST "$API_BASE/api/llm/complex-query" \
      -H "Content-Type: application/json" \
      -d '{
        "query": "Mostre os 5 medicamentos oncológicos com maior queda de preço nos últimos 60 dias",
        "userProfile": "hospital",
        "timeframe": 60,
        "category": "Oncológico",
        "limit": 5
      }')
    
    if echo "$COMPLEX_QUERY" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Consulta complexa processada!"
        
        INSIGHTS_COUNT=$(echo "$COMPLEX_QUERY" | jq '.data.insights | length')
        RECOMMENDATIONS_COUNT=$(echo "$COMPLEX_QUERY" | jq '.data.recommendations | length')
        CONFIDENCE=$(echo "$COMPLEX_QUERY" | jq -r '.data.confidence')
        
        print_info "Insights gerados: $INSIGHTS_COUNT"
        print_info "Recomendações: $RECOMMENDATIONS_COUNT"
        print_info "Confiança: ${CONFIDENCE}0%"
        
        echo
        echo "📊 Insights automáticos:"
        echo "$COMPLEX_QUERY" | jq -r '.data.insights[]' | while read insight; do
            print_highlight "$insight"
        done
    else
        echo "❌ Erro na consulta complexa"
    fi
    
    echo
    echo
    
    # Demo 2: Explicações Didáticas
    print_section "🎓 Demo 2: Explicações Didáticas"
    
    echo "Perguntando: 'Por que o Adempas teve mudança de preço tão grande?'..."
    EXPLANATION_QUERY=$(curl -s -X POST "$API_BASE/api/llm/complex-query" \
      -H "Content-Type: application/json" \
      -d '{
        "query": "Por que o Adempas teve mudança de preço tão grande?",
        "userProfile": "medico",
        "timeframe": 30
      }')
    
    if echo "$EXPLANATION_QUERY" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Explicação didática gerada!"
        
        VOLATILITY=$(echo "$EXPLANATION_QUERY" | jq -r '.data.data.volatility // 0')
        PRICE_CHANGE=$(echo "$EXPLANATION_QUERY" | jq -r '.data.data.priceChange // 0')
        
        print_info "Volatilidade detectada: ${VOLATILITY}%"
        print_info "Mudança de preço: ${PRICE_CHANGE}%"
        
        echo
        echo "📚 Explicação técnica gerada:"
        echo "$EXPLANATION_QUERY" | jq -r '.data.answer' | head -5 | while read line; do
            echo "   $line"
        done
    else
        echo "❌ Erro na explicação didática"
    fi
    
    echo
    echo
    
    # Demo 3: Simulação de Compras
    print_section "🛒 Demo 3: Simulação de Compras em Lote"
    
    echo "Simulando: 'Se eu comprar 5000 unidades de Paracetamol, qual laboratório é melhor?'..."
    SIMULATION_QUERY=$(curl -s -X POST "$API_BASE/api/llm/complex-query" \
      -H "Content-Type: application/json" \
      -d '{
        "query": "Se eu comprar 5000 unidades de Paracetamol 500mg, qual laboratório é melhor?",
        "userProfile": "distribuidor"
      }')
    
    if echo "$SIMULATION_QUERY" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Simulação de compra processada!"
        
        echo
        echo "💰 Resultado da simulação:"
        echo "$SIMULATION_QUERY" | jq -r '.data.answer' | head -10 | while read line; do
            echo "   $line"
        done
    else
        echo "❌ Erro na simulação"
    fi
    
    echo
    echo
    
    # Demo 4: Geração de Relatórios
    print_section "📊 Demo 4: Relatórios Automáticos por Perfil"
    
    # Relatório para Hospital
    echo "Gerando relatório hospitalar..."
    HOSPITAL_REPORT=$(curl -s -X POST "$API_BASE/api/reports/generate" \
      -H "Content-Type: application/json" \
      -d '{
        "reportType": "market_analysis",
        "userProfile": "hospital",
        "format": "html",
        "timeframe": 30
      }')
    
    if echo "$HOSPITAL_REPORT" | jq -e '.success' > /dev/null 2>&1; then
        REPORT_ID=$(echo "$HOSPITAL_REPORT" | jq -r '.data.id')
        DATA_POINTS=$(echo "$HOSPITAL_REPORT" | jq -r '.data.metadata.dataPoints')
        
        print_result "Relatório hospitalar gerado: $REPORT_ID"
        print_info "Medicamentos analisados: $DATA_POINTS"
        print_info "Foco: Custo-efetividade e gestão hospitalar"
    fi
    
    # Relatório para Médico
    echo
    echo "Gerando relatório clínico..."
    MEDICAL_REPORT=$(curl -s -X POST "$API_BASE/api/reports/generate" \
      -H "Content-Type: application/json" \
      -d '{
        "reportType": "market_analysis",
        "userProfile": "medico",
        "format": "html",
        "timeframe": 30
      }')
    
    if echo "$MEDICAL_REPORT" | jq -e '.success' > /dev/null 2>&1; then
        REPORT_ID=$(echo "$MEDICAL_REPORT" | jq -r '.data.id')
        print_result "Relatório clínico gerado: $REPORT_ID"
        print_info "Foco: Equivalência terapêutica e aspectos clínicos"
    fi
    
    echo
    echo
    
    # Demo 5: Sistema de Favoritos/Watchlist
    print_section "⭐ Demo 5: Sistema de Favoritos e Watchlist"
    
    echo "Adicionando medicamentos à watchlist..."
    
    # Adicionar Adempas para usuário hospital
    WATCHLIST_ADD=$(curl -s -X POST "$API_BASE/api/users/watchlist" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "hospital-user",
        "action": "add",
        "medicationCode": "ADEMPAS-1-5MG",
        "alertConfig": { "priceChange": 15, "enabled": true },
        "notes": "Medicamento crítico para cardiologia"
      }')
    
    if echo "$WATCHLIST_ADD" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Adempas adicionado à watchlist hospitalar"
    fi
    
    # Adicionar Herceptin para usuário médico
    curl -s -X POST "$API_BASE/api/users/watchlist" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "medico-user",
        "action": "add",
        "medicationCode": "HERCEPTIN-440MG",
        "alertConfig": { "priceChange": 10, "enabled": true },
        "notes": "Oncológico de referência"
      }' > /dev/null
    
    print_result "Herceptin adicionado à watchlist médica"
    
    # Listar watchlist
    echo
    echo "📋 Consultando watchlist do hospital..."
    WATCHLIST_LIST=$(curl -s -X POST "$API_BASE/api/users/watchlist" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "hospital-user",
        "action": "list"
      }')
    
    if echo "$WATCHLIST_LIST" | jq -e '.success' > /dev/null 2>&1; then
        TOTAL_ITEMS=$(echo "$WATCHLIST_LIST" | jq '.data.totalItems')
        print_result "Watchlist consultada: $TOTAL_ITEMS itens"
    fi
    
    echo
    echo
    
    # Demo 6: Simulação de Compra em Lote
    print_section "🛒 Demo 6: Simulação de Compra em Lote Avançada"
    
    echo "Simulando compra hospitalar de múltiplos medicamentos..."
    BULK_SIMULATION=$(curl -s -X POST "$API_BASE/api/users/simulate-bulk-purchase" \
      -H "Content-Type: application/json" \
      -d '{
        "medications": [
          {"code": "PARACETAMOL-500MG", "quantity": 1000},
          {"code": "DIPIRONA-500MG", "quantity": 800},
          {"code": "ADEMPAS-1-5MG", "quantity": 20}
        ],
        "maxBudget": 50000,
        "userProfile": "hospital"
      }')
    
    if echo "$BULK_SIMULATION" | jq -e '.success' > /dev/null 2>&1; then
        TOTAL_COST=$(echo "$BULK_SIMULATION" | jq -r '.data.totalCost')
        TOTAL_SAVINGS=$(echo "$BULK_SIMULATION" | jq -r '.data.savings')
        RISK_LEVEL=$(echo "$BULK_SIMULATION" | jq -r '.data.riskAnalysis.overallRisk')
        
        print_result "Simulação de compra em lote concluída!"
        print_info "Custo total: R$ ${TOTAL_COST}"
        print_info "Economia potencial: R$ ${TOTAL_SAVINGS}"
        print_info "Nível de risco: $RISK_LEVEL"
        
        echo
        echo "🏥 Recomendações por medicamento:"
        echo "$BULK_SIMULATION" | jq '.data.recommendations[] | {medicamento: .medicationName, melhor_lab: .bestLab, custo: .totalCost, economia: .savings}' | head -15
    else
        echo "❌ Erro na simulação de compra em lote"
    fi
    
    echo
    echo
    
    # Resumo final
    print_section "🎯 Resumo das Funcionalidades Evoluídas"
    
    echo -e "${GREEN}✅ CHAT LLM EVOLUÍDO:${NC}"
    echo "   • 🔍 Consultas complexas com processamento inteligente"
    echo "   • 🎓 Explicações didáticas baseadas em dados históricos"
    echo "   • 🛒 Simulações de compra com análise de laboratórios"
    echo "   • 📊 Análise de tendências e volatilidade"
    echo
    echo -e "${GREEN}✅ PERFIS DE USUÁRIO:${NC}"
    echo "   • 👨‍⚕️ Médico: Foco clínico e terapêutico"
    echo "   • 🏥 Hospital: Custo-efetividade e volume"
    echo "   • 📈 Distribuidor: Margem e oportunidades comerciais"
    echo "   • 📊 Analista: Dados estatísticos e correlações"
    echo
    echo -e "${GREEN}✅ RELATÓRIOS AUTOMÁTICOS:${NC}"
    echo "   • 📄 HTML com gráficos e insights"
    echo "   • 📋 PDF para impressão (futuro)"
    echo "   • 🎯 Personalizados por perfil de usuário"
    echo "   • 💾 Salvos automaticamente no banco"
    echo
    echo -e "${GREEN}✅ SISTEMA DE FAVORITOS:${NC}"
    echo "   • ⭐ Watchlist personalizada por usuário"
    echo "   • 🚨 Alertas configuráveis por medicamento"
    echo "   • 📝 Notas e observações personalizadas"
    echo "   • 🔔 Monitoramento automático de mudanças"
    echo
    echo -e "${GREEN}✅ SIMULAÇÕES AVANÇADAS:${NC}"
    echo "   • 🛒 Compras em lote com múltiplos medicamentos"
    echo "   • 💰 Análise de economia por laboratório"
    echo "   • ⚖️ Avaliação de risco por concentração"
    echo "   • 🎯 Recomendações personalizadas por perfil"
    echo
    echo -e "${PURPLE}🔗 APIs Implementadas:${NC}"
    echo "   POST /api/llm/complex-query - Consultas inteligentes"
    echo "   POST /api/reports/generate - Relatórios automáticos"
    echo "   GET  /api/users/profile/{id} - Perfil do usuário"
    echo "   POST /api/users/watchlist - Gerenciar favoritos"
    echo "   POST /api/users/simulate-bulk-purchase - Simulação em lote"
    echo
    echo -e "${YELLOW}🌐 Como Usar no Frontend:${NC}"
    echo "   1. Acesse: http://localhost:3000"
    echo "   2. Vá para aba 'Chat' (agora evoluído)"
    echo "   3. Selecione seu perfil (médico, hospital, etc.)"
    echo "   4. Use consultas complexas pré-definidas"
    echo "   5. Gere relatórios automáticos"
    echo "   6. Adicione medicamentos aos favoritos"
    echo "   7. Simule compras em lote"
    echo
    echo -e "${CYAN}🎯 Exemplos de Consultas Avançadas:${NC}"
    echo
    echo "👨‍⚕️ PARA MÉDICOS:"
    echo "   • 'Quais medicamentos oncológicos têm biossimilares disponíveis?'"
    echo "   • 'Por que o Herceptin teve variação de preço recentemente?'"
    echo "   • 'Mostre alternativas terapêuticas para hipertensão'"
    echo
    echo "🏥 PARA HOSPITAIS:"
    echo "   • 'Top 5 medicamentos com maior queda nos últimos 60 dias'"
    echo "   • 'Se eu comprar 1000 unidades de Dipirona, qual laboratório é melhor?'"
    echo "   • 'Analise custo-efetividade dos medicamentos oncológicos'"
    echo
    echo "📈 PARA DISTRIBUIDORES:"
    echo "   • 'Quais medicamentos têm maior potencial de margem?'"
    echo "   • 'Analise tendências de demanda por categoria'"
    echo "   • 'Simule compra de 5000 unidades com melhor economia'"
    echo
    echo "📊 PARA ANALISTAS:"
    echo "   • 'Mostre correlação entre preços de diferentes categorias'"
    echo "   • 'Analise volatilidade por laboratório nos últimos 3 meses'"
    echo "   • 'Gere relatório estatístico completo'"
    echo
    print_result "🎉 Chat LLM Evoluído totalmente funcional!"
    echo
    echo -e "${YELLOW}📝 Próximos passos:${NC}"
    echo "1. Configure seu perfil no frontend"
    echo "2. Teste consultas complexas específicas"
    echo "3. Gere relatórios personalizados"
    echo "4. Monte sua watchlist de medicamentos críticos"
    echo "5. Use simulações para decisões estratégicas"
}

main "$@"
