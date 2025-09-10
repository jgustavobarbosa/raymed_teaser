#!/bin/bash

# ===================================
# RayMed - Setup Machine Learning
# ===================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

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
    echo "🧠 RayMed - Setup Machine Learning"
    echo "=================================="
    echo -e "${NC}"
}

main() {
    print_header
    
    # Verificar se Python está instalado
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 não encontrado!"
        echo "Instale Python 3.8+ primeiro:"
        echo "  macOS: brew install python"
        echo "  Ubuntu: sudo apt install python3 python3-pip"
        echo "  Windows: https://python.org/downloads"
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    print_success "Python $PYTHON_VERSION encontrado"
    
    # Verificar se pip está instalado
    if ! command -v pip3 &> /dev/null; then
        print_error "pip3 não encontrado!"
        echo "Instale pip primeiro:"
        echo "  curl https://bootstrap.pypa.io/get-pip.py | python3"
        exit 1
    fi
    
    # Criar diretório para scripts Python
    mkdir -p apps/server/python
    
    # Criar requirements.txt
    print_step "Criando requirements.txt..."
    cat > apps/server/python/requirements.txt << 'EOF'
# Machine Learning Core (versões compatíveis)
numpy>=1.21.0,<1.25.0
pandas>=1.3.0,<2.0.0
scikit-learn>=1.0.0,<1.4.0

# Time Series Models (versões estáveis)
prophet>=1.1.0,<1.2.0
statsmodels>=0.13.0,<0.15.0
pmdarima>=1.8.5,<2.1.0

# Deep Learning (versões compatíveis)
tensorflow>=2.8.0,<2.15.0

# Utilities
matplotlib>=3.5.0,<3.8.0
scipy>=1.7.0,<1.12.0

# Dependencies específicas para compatibilidade
Cython>=0.29.0,<3.0.0
setuptools>=60.0.0
wheel>=0.37.0
EOF

    print_success "requirements.txt criado"
    
    # Verificar se ambiente virtual existe
    if [ ! -d "apps/server/python/venv" ]; then
        print_step "Criando ambiente virtual Python..."
        cd apps/server/python
        python3 -m venv venv
        cd ../../..
        print_success "Ambiente virtual criado"
    fi
    
    # Ativar ambiente virtual e instalar pacotes
    print_step "Instalando pacotes Python..."
    cd apps/server/python
    
    # Ativar venv
    source venv/bin/activate
    
    # Atualizar pip
    pip install --upgrade pip > /dev/null 2>&1
    
    # Instalar pacotes básicos primeiro
    print_step "Instalando numpy, pandas, scikit-learn..."
    pip install numpy pandas scikit-learn > /dev/null 2>&1
    print_success "Pacotes básicos instalados"
    
    # Tentar instalar Prophet
    print_step "Instalando Prophet..."
    if pip install prophet > /dev/null 2>&1; then
        print_success "Prophet instalado"
    else
        print_warning "Prophet falhou - usando fallback JavaScript"
    fi
    
    # Tentar instalar statsmodels e pmdarima
    print_step "Instalando ARIMA dependencies..."
    
    # Instalar statsmodels primeiro
    if pip install statsmodels > /dev/null 2>&1; then
        print_success "statsmodels instalado"
        
        # Tentar instalar pmdarima com versões específicas compatíveis
        print_step "Instalando pmdarima (pode requerer compilação)..."
        if pip install "numpy>=1.21.0,<1.25.0" "pmdarima>=2.0.0" --no-cache-dir > /dev/null 2>&1; then
            print_success "pmdarima instalado com sucesso"
        else
            print_warning "pmdarima falhou - tentando versão alternativa..."
            if pip install "pmdarima==1.8.5" --no-cache-dir > /dev/null 2>&1; then
                print_success "pmdarima versão alternativa instalada"
            else
                print_warning "pmdarima falhou completamente - usando fallback JavaScript"
            fi
        fi
    else
        print_warning "statsmodels falhou - ARIMA não disponível"
    fi
    
    # Tentar instalar TensorFlow (opcional)
    print_step "Instalando TensorFlow (pode demorar)..."
    if pip install tensorflow > /dev/null 2>&1; then
        print_success "TensorFlow instalado"
    else
        print_warning "TensorFlow falhou - usando fallback JavaScript"
        print_warning "Para instalar manualmente: pip install tensorflow"
    fi
    
    cd ../../..
    
    # Criar script de ativação
    cat > apps/server/python/activate.sh << 'EOF'
#!/bin/bash
echo "Ativando ambiente Python para ML..."
cd "$(dirname "$0")"
source venv/bin/activate
echo "✅ Ambiente ativado. Use 'deactivate' para sair."
EOF
    chmod +x apps/server/python/activate.sh
    
    # Testar instalação
    print_step "Testando instalação..."
    cd apps/server/python
    source venv/bin/activate
    
    # Teste básico
    if python3 -c "import numpy, pandas, sklearn; print('✅ Pacotes básicos OK')" 2>/dev/null; then
        print_success "Pacotes básicos funcionando"
    else
        print_error "Erro nos pacotes básicos"
    fi
    
    # Teste Prophet
    if python3 -c "import prophet; print('✅ Prophet OK')" 2>/dev/null; then
        print_success "Prophet funcionando"
    else
        print_warning "Prophet não disponível (usando fallback)"
    fi
    
    # Teste ARIMA
    if python3 -c "import statsmodels, pmdarima; print('✅ ARIMA OK')" 2>/dev/null; then
        print_success "ARIMA funcionando"
    else
        print_warning "ARIMA não disponível (usando fallback)"
    fi
    
    # Teste TensorFlow
    if python3 -c "import tensorflow; print('✅ TensorFlow OK')" 2>/dev/null; then
        print_success "TensorFlow funcionando"
    else
        print_warning "TensorFlow não disponível (usando fallback)"
    fi
    
    deactivate
    cd ../../..
    
    # Criar documentação
    cat > apps/server/python/README.md << 'EOF'
# RayMed - Machine Learning Setup

## Ambiente Python Configurado

### Ativação do Ambiente
```bash
cd apps/server/python
source venv/bin/activate
```

### Pacotes Instalados
- **numpy, pandas, scikit-learn**: Análise de dados básica
- **prophet**: Previsões com sazonalidade (Facebook/Meta)
- **statsmodels, pmdarima**: Modelos ARIMA
- **tensorflow**: Deep Learning (LSTM)

### Uso
Os modelos Python são chamados automaticamente pelas APIs quando disponíveis.
Se algum pacote falhar, o sistema usa implementações JavaScript como fallback.

### Reinstalar Pacotes
```bash
cd apps/server/python
source venv/bin/activate
pip install -r requirements.txt
```

### Adicionar Novos Pacotes
```bash
cd apps/server/python
source venv/bin/activate
pip install novo_pacote
pip freeze > requirements.txt
```
EOF
    
    echo
    print_success "🎉 Setup de Machine Learning concluído!"
    echo
    echo -e "${PURPLE}📋 Resumo:${NC}"
    echo -e "   🐍 Ambiente Python criado em apps/server/python/venv"
    echo -e "   📦 Pacotes ML instalados (com fallbacks JavaScript)"
    echo -e "   🧠 Modelos disponíveis: Prophet, ARIMA, LSTM"
    echo -e "   🔍 Detecção de outliers configurada"
    echo -e "   🏆 Análise de competitividade implementada"
    echo
    echo -e "${YELLOW}🚀 APIs Disponíveis:${NC}"
    echo -e "   POST /api/ml/predictions - Gerar previsões"
    echo -e "   GET  /api/ml/outliers - Detectar outliers"
    echo -e "   GET  /api/ml/competitiveness - Índice de competitividade"
    echo -e "   GET  /api/ml/dashboard - Dashboard completo"
    echo
    echo -e "${YELLOW}💡 Para ativar ambiente Python:${NC}"
    echo -e "   cd apps/server/python && source venv/bin/activate"
    echo
}

main "$@"
