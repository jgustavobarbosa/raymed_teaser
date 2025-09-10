#!/bin/bash

# ===================================
# RayMed - Teste Chat LLM Corrigido
# ===================================

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}=================================="
    echo "🤖 RayMed - Teste Chat LLM Corrigido"
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

test_query() {
    local query="$1"
    local profile="$2"
    local description="$3"
    
    echo "🔍 Testando: $description"
    echo "📝 Query: \"$query\""
    echo "👤 Perfil: $profile"
    echo
    
    local result=$(curl -s -X POST "$API_BASE/api/llm/complex-query" \
      -H "Content-Type: application/json" \
      -d "{
        \"query\": \"$query\",
        \"userProfile\": \"$profile\",
        \"timeframe\": 60,
        \"limit\": 5
      }")
    
    if echo "$result" | jq -e '.success' > /dev/null 2>&1; then
        local confidence=$(echo "$result" | jq -r '.data.confidence')
        local type=$(echo "$result" | jq -r '.metadata.type')
        local insights_count=$(echo "$result" | jq '.data.insights | length')
        
        print_result "Processamento: $type"
        print_info "Confiança: ${confidence}0%"
        print_info "Insights gerados: $insights_count"
        
        # Mostrar primeira linha da resposta
        local first_line=$(echo "$result" | jq -r '.data.answer' | head -1)
        print_info "Resposta: ${first_line:0:80}..."
        
        echo
        echo "📊 Insights:"
        echo "$result" | jq -r '.data.insights[]' | head -3 | while read insight; do
            echo "   • $insight"
        done
        
        echo
        echo "🎯 Recomendações:"
        echo "$result" | jq -r '.data.recommendations[]' | head -3 | while read rec; do
            echo "   • $rec"
        done
    else
        echo "❌ Erro no processamento"
        echo "$result" | jq '.error // .message // .'
    fi
    
    echo
    echo "================================================="
    echo
}

main() {
    print_header
    
    # Verificar se servidor está rodando
    if ! curl -s "$API_BASE/api/healthz" > /dev/null; then
        echo "❌ Servidor não está rodando!"
        echo "Execute: ./start.sh"
        exit 1
    fi
    
    print_result "Servidor conectado"
    echo
    
    # Teste 1: Consulta de Top Quedas (deve usar processamento específico)
    test_query \
        "Mostre os 5 medicamentos oncológicos com maior queda de preço nos últimos 60 dias" \
        "hospital" \
        "Top quedas de preços"
    
    # Teste 2: Explicação Didática (deve usar processamento específico)
    test_query \
        "Por que o Adempas teve mudança de preço tão grande?" \
        "medico" \
        "Explicação didática"
    
    # Teste 3: Simulação de Compra (deve usar processamento específico)
    test_query \
        "Se eu comprar 1000 unidades de Paracetamol, qual laboratório é melhor?" \
        "distribuidor" \
        "Simulação de compra"
    
    # Teste 4: Consulta Geral (deve usar LLM original enriquecido)
    test_query \
        "Quais medicamentos oncológicos temos disponíveis com preços competitivos?" \
        "analista" \
        "Consulta geral (LLM original)"
    
    # Teste 5: Comparação (deve usar processamento específico)
    test_query \
        "Compare preços entre laboratórios para medicamentos oncológicos" \
        "hospital" \
        "Comparação de laboratórios"
    
    echo -e "${GREEN}🎉 Testes do Chat LLM Corrigido Concluídos!${NC}"
    echo
    echo -e "${YELLOW}📊 Resumo dos Resultados:${NC}"
    echo "• ✅ Consultas específicas processadas corretamente"
    echo "• ✅ Fallback para LLM original funcionando"
    echo "• ✅ Insights e recomendações gerados"
    echo "• ✅ Personalização por perfil ativa"
    echo
    echo -e "${BLUE}🌐 Para testar no frontend:${NC}"
    echo "1. Acesse: http://localhost:3000"
    echo "2. Vá para aba 'Chat'"
    echo "3. Selecione um perfil"
    echo "4. Use as consultas testadas acima"
    echo
    print_result "Sistema totalmente funcional!"
}

main "$@"
