#!/bin/bash

# ===================================
# RayMed - Demo Final ML Melhorado
# ===================================

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}================================================="
    echo "🚀 RayMed - Demo Final: ML Analytics + Otimização Avançada"
    echo "=================================================${NC}"
    echo
}

print_section() {
    echo -e "${BLUE}$1${NC}"
    echo "-----------------------------------------------"
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
    
    print_result "Sistema RayMed conectado"
    echo
    
    # Demo 1: Seleção por Categoria
    print_section "🏷️ Demo 1: Seleção de Medicamentos por Categoria"
    
    echo "Carregando categorias disponíveis..."
    CATEGORIES=$(curl -s "$API_BASE/api/medications/categories")
    
    if echo "$CATEGORIES" | jq -e '.success' > /dev/null 2>&1; then
        TOTAL_CATEGORIES=$(echo "$CATEGORIES" | jq '.data | length')
        print_result "Categorias carregadas: $TOTAL_CATEGORIES"
        
        echo
        echo "📊 Top 5 categorias com mais medicamentos:"
        echo "$CATEGORIES" | jq '.data[0:5] | map({categoria: (.emoji + " " + .name), medicamentos: .count})'
        
        # Testar medicamentos oncológicos
        echo
        echo "🎗️ Carregando medicamentos oncológicos..."
        ONCOLOGICS=$(curl -s "$API_BASE/api/medications/by-category/Oncológico")
        
        if echo "$ONCOLOGICS" | jq -e '.success' > /dev/null 2>&1; then
            ONCO_COUNT=$(echo "$ONCOLOGICS" | jq '.data | length')
            print_result "Medicamentos oncológicos encontrados: $ONCO_COUNT"
            
            echo
            echo "💊 Top 3 medicamentos oncológicos:"
            echo "$ONCOLOGICS" | jq '.data[0:3] | map({nome: .name, preco: .currentPrice.value, laboratorio: .currentPrice.labName})'
        fi
    else
        echo "❌ Erro ao carregar categorias"
    fi
    
    echo
    echo
    
    # Demo 2: Otimização Avançada de Compras
    print_section "💰 Demo 2: Otimização Avançada de Compras"
    
    echo "Analisando Adempas com parâmetros avançados..."
    echo "📊 Cenário: Farmácia hospitalar com consumo variável"
    echo "📦 Estoque atual: 20 unidades"
    echo "📈 Consumo: 60 unidades/mês (2/dia)"
    echo "🛒 Deseja comprar: 200 unidades"
    echo "📅 Lead time: 14 dias"
    echo "🛡️ Estoque segurança: 30 dias"
    echo
    
    ADVANCED_ANALYSIS=$(curl -s -X POST "$API_BASE/api/ml/purchase/recommendations" \
      -H "Content-Type: application/json" \
      -d '{
        "medicationCode": "ADEMPAS-1-5MG",
        "currentStock": 20,
        "monthlyConsumption": 60,
        "desiredQuantity": 200,
        "leadTimeDays": 14,
        "safetyStockDays": 30
      }')
    
    if echo "$ADVANCED_ANALYSIS" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Análise avançada concluída e salva no banco!"
        
        # Análise de estoque
        STOCK_STATUS=$(echo "$ADVANCED_ANALYSIS" | jq -r '.data.stockAnalysis.stockStatus')
        DAYS_OF_STOCK=$(echo "$ADVANCED_ANALYSIS" | jq -r '.data.stockAnalysis.daysOfStock')
        REORDER_POINT=$(echo "$ADVANCED_ANALYSIS" | jq -r '.data.stockAnalysis.reorderPoint')
        IDEAL_STOCK=$(echo "$ADVANCED_ANALYSIS" | jq -r '.data.stockAnalysis.idealStock')
        
        print_info "📊 Status do estoque: $STOCK_STATUS"
        print_info "📅 Dias de estoque atual: $DAYS_OF_STOCK"
        print_info "🎯 Ponto de reposição: $REORDER_POINT unidades"
        print_info "✨ Estoque ideal: $IDEAL_STOCK unidades"
        
        echo
        echo "🏥 Melhor recomendação por laboratório:"
        echo "$ADVANCED_ANALYSIS" | jq '.data.recommendations[0] | {
          laboratorio: .laboratory,
          acao: .action,
          prioridade: .priority,
          preco_unitario: .costPerUnit,
          quantidade: .quantityToBuy,
          custo_total: .totalCost,
          ciclo_dias: .cycleDays,
          economia_esperada: .expectedSavings,
          tendencia: .trendPercent
        }'
        
        echo
        echo "🎯 Recomendações de estoque:"
        echo "$ADVANCED_ANALYSIS" | jq -r '.data.stockAnalysis.recommendations[]' | while read rec; do
            print_info "$rec"
        done
        
    else
        echo "❌ Erro na análise avançada"
    fi
    
    echo
    echo
    
    # Demo 3: Comparação de Múltiplos Cenários
    print_section "📊 Demo 3: Comparação de Cenários de Compra"
    
    echo "Comparando diferentes cenários para Paracetamol..."
    
    # Cenário 1: Estoque baixo, compra urgente
    echo "📋 Cenário 1: Estoque baixo (5 dias)"
    SCENARIO1=$(curl -s -X POST "$API_BASE/api/ml/purchase/recommendations" \
      -H "Content-Type: application/json" \
      -d '{
        "medicationCode": "PARACETAMOL-500MG",
        "currentStock": 10,
        "monthlyConsumption": 60,
        "desiredQuantity": 100,
        "leadTimeDays": 3,
        "safetyStockDays": 7
      }')
    
    if echo "$SCENARIO1" | jq -e '.success' > /dev/null 2>&1; then
        ACTION1=$(echo "$SCENARIO1" | jq -r '.data.recommendations[0].action')
        PRIORITY1=$(echo "$SCENARIO1" | jq -r '.data.recommendations[0].priority')
        print_info "Ação recomendada: $ACTION1 (prioridade: $PRIORITY1)"
    fi
    
    # Cenário 2: Estoque normal, compra planejada
    echo
    echo "📋 Cenário 2: Estoque normal (30 dias)"
    SCENARIO2=$(curl -s -X POST "$API_BASE/api/ml/purchase/recommendations" \
      -H "Content-Type: application/json" \
      -d '{
        "medicationCode": "PARACETAMOL-500MG",
        "currentStock": 60,
        "monthlyConsumption": 60,
        "desiredQuantity": 100,
        "leadTimeDays": 7,
        "safetyStockDays": 15
      }')
    
    if echo "$SCENARIO2" | jq -e '.success' > /dev/null 2>&1; then
        ACTION2=$(echo "$SCENARIO2" | jq -r '.data.recommendations[0].action')
        PRIORITY2=$(echo "$SCENARIO2" | jq -r '.data.recommendations[0].priority')
        print_info "Ação recomendada: $ACTION2 (prioridade: $PRIORITY2)"
    fi
    
    echo
    echo
    
    # Demo 4: Frontend Melhorado
    print_section "🌐 Demo 4: Frontend com Seleção por Categoria"
    
    echo "Verificando se frontend está acessível com melhorias..."
    if curl -s "http://localhost:3000" > /dev/null; then
        print_result "Frontend acessível com melhorias!"
        echo
        print_info "🌐 Acesse: http://localhost:3000"
        print_info "🧠 Vá para aba 'ML Analytics' para testar:"
        echo "     1. 🏷️ Seleção por categoria (Oncológico, Imunobiológico, etc.)"
        echo "     2. 💊 Lista dinâmica de medicamentos por categoria"
        echo "     3. 🔮 Previsões baseadas em dados de 3 meses"
        echo "     4. 💰 Otimização com cálculos avançados de estoque"
        echo "     5. 📊 Consumo diário, ciclos de compra, lead time"
        echo "     6. 🛒 Cálculos por quantidade desejada"
        echo "     7. 💾 Dados salvos no banco para consultas seguras"
    else
        echo "❌ Frontend não acessível"
    fi
    
    echo
    echo
    
    # Demo 5: Teste com Medicamento de Alto Custo
    print_section "💎 Demo 5: Análise de Medicamento de Alto Custo"
    
    echo "Testando análise para Adempas (medicamento corrigido)..."
    HIGH_COST_ANALYSIS=$(curl -s -X POST "$API_BASE/api/ml/purchase/recommendations" \
      -H "Content-Type: application/json" \
      -d '{
        "medicationCode": "ADEMPAS-1-5MG",
        "currentStock": 5,
        "monthlyConsumption": 12,
        "desiredQuantity": 50,
        "leadTimeDays": 21,
        "safetyStockDays": 45
      }')
    
    if echo "$HIGH_COST_ANALYSIS" | jq -e '.success' > /dev/null 2>&1; then
        print_result "Análise de alto custo concluída!"
        
        TOTAL_COST=$(echo "$HIGH_COST_ANALYSIS" | jq -r '.data.recommendations[0].totalCost')
        DAILY_CONSUMPTION=$(echo "$HIGH_COST_ANALYSIS" | jq -r '.data.stockAnalysis.dailyConsumption')
        CYCLE_DAYS=$(echo "$HIGH_COST_ANALYSIS" | jq -r '.data.recommendations[0].cycleDays')
        
        print_info "💰 Custo total estimado: R$ $TOTAL_COST"
        print_info "📊 Consumo diário: $DAILY_CONSUMPTION unidades"
        print_info "🔄 Ciclo de compra: $CYCLE_DAYS dias"
        
        echo
        echo "🏥 Laboratório recomendado:"
        echo "$HIGH_COST_ANALYSIS" | jq '.data.recommendations[0] | {
          laboratorio: .laboratory,
          acao: .action,
          preco_unitario: .costPerUnit,
          custo_total: .totalCost,
          economia: .expectedSavings,
          confianca: .confidence
        }'
    fi
    
    echo
    echo
    
    # Resumo final
    print_section "🎯 Resumo das Melhorias Implementadas"
    
    echo -e "${GREEN}✅ SELEÇÃO POR CATEGORIA:${NC}"
    echo "   • 🏷️ Usuário escolhe categoria (Oncológico, Imunobiológico, etc.)"
    echo "   • 💊 Lista dinâmica de medicamentos da categoria selecionada"
    echo "   • 📊 Informações de preço e laboratório em tempo real"
    echo
    echo -e "${GREEN}✅ OTIMIZAÇÃO AVANÇADA DE COMPRAS:${NC}"
    echo "   • 📅 Consumo diário calculado automaticamente"
    echo "   • 🔄 Ciclos de compra baseados em quantidade desejada"
    echo "   • 📦 Ponto de reposição com lead time e estoque de segurança"
    echo "   • 💰 Cálculos por unidade e total"
    echo "   • 🎯 Recomendações por laboratório com tendências de 3 meses"
    echo
    echo -e "${GREEN}✅ ALGORITMOS DE PREVISÃO:${NC}"
    echo "   • 📈 Análise baseada em preços dos últimos 3 meses"
    echo "   • 📊 Tendências por laboratório (30 vs 60 dias)"
    echo "   • 🎲 Volatilidade e confiança calculadas"
    echo "   • 🔮 Previsões realistas baseadas em dados históricos"
    echo
    echo -e "${GREEN}✅ BANCO DE DADOS SEGURO:${NC}"
    echo "   • 💾 Todas as análises salvas automaticamente"
    echo "   • 🔍 Histórico de análises consultável"
    echo "   • 📊 Métricas do sistema atualizadas"
    echo "   • 🛡️ Dados validados e corrigidos"
    echo
    echo -e "${PURPLE}🔗 APIs Implementadas:${NC}"
    echo "   GET  /api/medications/categories - Listar categorias"
    echo "   GET  /api/medications/by-category/{categoria} - Medicamentos por categoria"
    echo "   POST /api/ml/purchase/recommendations - Otimização avançada"
    echo "   GET  /api/ml/purchase/history/{codigo} - Histórico de análises"
    echo "   GET  /api/data/validate - Validação de qualidade"
    echo
    echo -e "${YELLOW}🌐 Como Usar no Frontend:${NC}"
    echo "   1. Acesse: http://localhost:3000"
    echo "   2. Clique na aba 'ML Analytics'"
    echo "   3. Selecione uma categoria (ex: Oncológico)"
    echo "   4. Escolha um medicamento da lista"
    echo "   5. Configure parâmetros de estoque"
    echo "   6. Gere análises e recomendações"
    echo
    print_result "🎉 Sistema ML completo e otimizado!"
    echo
    echo -e "${YELLOW}📝 Benefícios das melhorias:${NC}"
    echo "• ✅ Acesso a todos os 835+ medicamentos por categoria"
    echo "• ✅ Cálculos precisos de estoque e consumo diário"
    echo "• ✅ Recomendações baseadas em dados reais de 3 meses"
    echo "• ✅ Análises salvas para consultas seguras"
    echo "• ✅ Layout padronizado e intuitivo"
    echo "• ✅ Dados corrigidos (Adempas Bayer R$ 15.000+)"
}

main "$@"
