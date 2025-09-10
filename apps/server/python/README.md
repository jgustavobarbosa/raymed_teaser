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
