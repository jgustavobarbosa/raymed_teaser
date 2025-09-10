#!/bin/bash

# ===================================
# RayMed - Demonstração ML
# ===================================

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}=================================="
    echo "🧠 RayMed - Demo Machine Learning"
    echo "==================================${NC}"
    echo
}

print_section() {
    echo -e "${BLUE}$1${NC}"
    echo "-----------------------------------"
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
        echo "❌ Servidor não está rodando!"
        echo "Execute: ./start.sh"
        exit 1
    fi
    
    print_result "Servidor RayMed conectado"
    echo
    
    # Demo 1: Previsões de Preços
    print_section "🔮 Demo 1: Previsões de Preços"
    
    echo "Gerando previsões para Paracetamol (próximos 7 dias)..."
    PREDICTION_RESULT=$(curl -s -X POST "$API_BASE/api/ml/predictions" \
      -H "Content-Type: application/json" \
      -d '{"medicationCode":"PARACETAMOL-500MG","daysAhead":7}')
    
    if echo "$PREDICTION_RESULT" | jq -e '.success' > /dev/null 2>&1; then
        ACCURACY=$(echo "$PREDICTION_RESULT" | jq -r '.data[0].accuracy')
        FIRST_PREDICTION=$(echo "$PREDICTION_RESULT" | jq -r '.data[0].predictions[0].predictedPrice')
        MODEL_USED=$(echo "$PREDICTION_RESULT" | jq -r '.data[0].model')
        
        print_result "Previsões geradas com sucesso!"
        print_info "Modelo usado: $MODEL_USED"
        print_info "Acurácia: $ACCURACY%"
        print_info "Primeira previsão: R$ $FIRST_PREDICTION"
        
        echo
        echo "📊 Previsões completas:"
        echo "$PREDICTION_RESULT" | jq '.data[0].predictions[0:3] | map({date: .date[0:10], price: .predictedPrice, confidence: .confidence})'
    else
        echo "❌ Erro ao gerar previsões"
        echo "$PREDICTION_RESULT" | jq '.error'
    fi
    
    echo
    echo
    
    # Demo 2: Detecção de Outliers
    print_section "🔍 Demo 2: Detecção de Outliers"
    
    echo "Detectando outliers com threshold 2.0..."
    OUTLIER_RESULT=$(curl -s "$API_BASE/api/ml/outliers?threshold=2.0")
    
    if echo "$OUTLIER_RESULT" | jq -e '.success' > /dev/null 2>&1; then
        TOTAL_OUTLIERS=$(echo "$OUTLIER_RESULT" | jq -r '.metadata.totalOutliers')
        TOTAL_PRICES=$(echo "$OUTLIER_RESULT" | jq -r '.metadata.totalPrices')
        OUTLIER_PERCENTAGE=$(echo "$OUTLIER_RESULT" | jq -r '.metadata.outlierPercentage')
        
        print_result "Análise de outliers concluída!"
        print_info "Total de preços analisados: $TOTAL_PRICES"
        print_info "Outliers detectados: $TOTAL_OUTLIERS"
        print_info "Porcentagem: ${OUTLIER_PERCENTAGE}%"
        
        if [ "$TOTAL_OUTLIERS" -gt "0" ]; then
            echo
            echo "🚨 Top 3 Outliers mais críticos:"
            echo "$OUTLIER_RESULT" | jq '.data[0:3] | map({medication, laboratory, price, expectedPrice, score: .outlierScore})'
        else
            print_info "Nenhum outlier detectado - todos os preços estão normais"
        fi
    else
        echo "❌ Erro ao detectar outliers"
    fi
    
    echo
    echo
    
    # Demo 3: Competitividade
    print_section "🏆 Demo 3: Análise de Competitividade"
    
    echo "Calculando índice de competitividade..."
    COMP_RESULT=$(curl -s "$API_BASE/api/ml/competitiveness")
    
    if echo "$COMP_RESULT" | jq -e '.success' > /dev/null 2>&1; then
        TOTAL_LABS=$(echo "$COMP_RESULT" | jq -r '.metadata.totalLaboratories')
        
        print_result "Análise de competitividade concluída!"
        print_info "Laboratórios analisados: $TOTAL_LABS"
        
        echo
        echo "🥇 Top 5 Laboratórios mais competitivos:"
        echo "$COMP_RESULT" | jq '.data[0:5] | map({rank, laboratory, score: .overallScore, avgPrice, advantage: .priceAdvantage})'
        
        # Líder do mercado
        MARKET_LEADER=$(echo "$COMP_RESULT" | jq -r '.data[0].laboratory')
        LEADER_SCORE=$(echo "$COMP_RESULT" | jq -r '.data[0].overallScore')
        LEADER_ADVANTAGE=$(echo "$COMP_RESULT" | jq -r '.data[0].priceAdvantage')
        
        echo
        print_info "🏆 Líder: $MARKET_LEADER (Score: $LEADER_SCORE)"
        if [ "$LEADER_ADVANTAGE" -gt "0" ]; then
            print_info "💰 Vantagem de preço: $LEADER_ADVANTAGE% abaixo da média"
        fi
    else
        echo "❌ Erro ao calcular competitividade"
    fi
    
    echo
    echo
    
    # Demo 4: Dashboard Completo
    print_section "📈 Demo 4: Dashboard ML Completo"
    
    echo "Carregando dashboard com insights automáticos..."
    DASHBOARD_RESULT=$(curl -s "$API_BASE/api/ml/dashboard")
    
    if echo "$DASHBOARD_RESULT" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Dashboard ML carregado!"
        
        echo
        echo "📊 Estatísticas Gerais:"
        echo "$DASHBOARD_RESULT" | jq '.data.statistics'
        
        echo
        echo "💡 Insights Automáticos:"
        echo "$DASHBOARD_RESULT" | jq -r '.data.insights[]' | while read insight; do
            print_info "$insight"
        done
        
    else
        echo "❌ Erro ao carregar dashboard"
    fi
    
    echo
    echo
    
    # Resumo final
    print_section "🎯 Resumo da Demonstração"
    
    echo "✅ APIs de Machine Learning testadas com sucesso!"
    echo
    echo -e "${PURPLE}🔗 URLs para teste manual:${NC}"
    echo "   🔮 Previsões: POST $API_BASE/api/ml/predictions"
    echo "   🔍 Outliers:  GET  $API_BASE/api/ml/outliers"
    echo "   🏆 Ranking:   GET  $API_BASE/api/ml/competitiveness"
    echo "   📈 Dashboard: GET  $API_BASE/api/ml/dashboard"
    echo
    echo -e "${YELLOW}💡 Próximos passos:${NC}"
    echo "   1. Execute ./scripts/setup-ml.sh para modelos avançados"
    echo "   2. Configure APIs no frontend com o componente MLDashboard"
    echo "   3. Integre alertas automáticos baseados em outliers"
    echo "   4. Use previsões para otimização de compras"
    echo
    print_result "Demo concluída! 🎉"
}

main "$@"
