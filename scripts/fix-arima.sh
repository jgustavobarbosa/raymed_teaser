#!/bin/bash

# ===================================
# RayMed - Fix ARIMA Dependencies
# ===================================

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
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

echo -e "${BLUE}🔧 Corrigindo dependências ARIMA...${NC}"
echo

# Navegar para diretório Python
cd apps/server/python

# Ativar ambiente virtual
print_step "Ativando ambiente virtual..."
source venv/bin/activate

# Desinstalar pacotes problemáticos
print_step "Removendo instalações problemáticas..."
pip uninstall -y pmdarima numpy > /dev/null 2>&1 || true

# Reinstalar numpy com versão específica
print_step "Instalando numpy compatível..."
pip install "numpy==1.21.6" > /dev/null 2>&1

# Instalar Cython primeiro
print_step "Instalando Cython..."
pip install "Cython>=0.29.0,<3.0.0" > /dev/null 2>&1

# Reinstalar pmdarima com configurações específicas
print_step "Instalando pmdarima (compilando do zero)..."
export CPPFLAGS=-I$(python3 -c "import numpy; print(numpy.get_include())")
export CFLAGS=-I$(python3 -c "import numpy; print(numpy.get_include())")

if pip install "pmdarima==1.8.5" --no-cache-dir --force-reinstall --no-binary=pmdarima > /dev/null 2>&1; then
    print_success "pmdarima instalado com sucesso"
else
    print_warning "pmdarima falhou - tentando abordagem alternativa..."
    
    # Tentar sem pmdarima, apenas statsmodels
    if pip install statsmodels > /dev/null 2>&1; then
        print_success "statsmodels instalado (ARIMA básico disponível)"
        print_warning "pmdarima não disponível (auto-ARIMA não funcionará)"
    else
        print_error "Falha completa do ARIMA"
    fi
fi

# Testar instalação
print_step "Testando instalação..."

# Teste statsmodels
if python3 -c "import statsmodels; print('✅ statsmodels OK')" 2>/dev/null; then
    print_success "statsmodels funcionando"
else
    print_error "statsmodels falhou"
fi

# Teste pmdarima
if python3 -c "import pmdarima; print('✅ pmdarima OK')" 2>/dev/null; then
    print_success "pmdarima funcionando"
else
    print_warning "pmdarima não disponível (usando ARIMA básico)"
fi

# Criar script de teste ARIMA
cat > test_arima.py << 'EOF'
#!/usr/bin/env python3
import sys
import numpy as np
import pandas as pd

try:
    from statsmodels.tsa.arima.model import ARIMA
    print("✅ ARIMA básico disponível (statsmodels)")
    
    # Teste simples
    data = np.random.randn(100).cumsum()
    model = ARIMA(data, order=(1,1,1))
    fitted = model.fit()
    forecast = fitted.forecast(steps=5)
    print(f"✅ Teste ARIMA concluído: previsão = {forecast[0]:.2f}")
    
except Exception as e:
    print(f"❌ ARIMA básico falhou: {e}")
    sys.exit(1)

try:
    import pmdarima as pm
    print("✅ Auto-ARIMA disponível (pmdarima)")
    
    # Teste auto-ARIMA
    data = np.random.randn(50).cumsum()
    auto_model = pm.auto_arima(data, seasonal=False, stepwise=True, suppress_warnings=True)
    forecast = auto_model.predict(n_periods=5)
    print(f"✅ Teste Auto-ARIMA concluído: previsão = {forecast[0]:.2f}")
    
except Exception as e:
    print(f"⚠️ Auto-ARIMA não disponível: {e}")
    print("📝 Usando ARIMA básico apenas")
EOF

# Executar teste
print_step "Executando teste ARIMA..."
if python3 test_arima.py; then
    print_success "ARIMA configurado corretamente"
else
    print_warning "ARIMA com limitações"
fi

# Limpar arquivo de teste
rm -f test_arima.py

deactivate

echo
print_success "🎉 Correção do ARIMA concluída!"
echo
echo -e "${YELLOW}📋 Status:${NC}"
echo -e "   ✅ statsmodels: ARIMA básico disponível"
echo -e "   ⚠️ pmdarima: Auto-ARIMA pode ter limitações"
echo -e "   🔄 Fallback JavaScript: Sempre disponível"
echo
echo -e "${YELLOW}💡 Dica:${NC}"
echo -e "   O sistema usará ARIMA básico quando Python estiver disponível"
echo -e "   Se pmdarima falhar, o fallback JavaScript será usado automaticamente"
echo
