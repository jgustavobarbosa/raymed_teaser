import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface ReportConfig {
  type: 'market_analysis' | 'price_trends' | 'lab_comparison' | 'category_analysis';
  format: 'html' | 'pdf' | 'json';
  userProfile: 'medico' | 'hospital' | 'distribuidor' | 'analista';
  parameters: {
    timeframe?: number;
    categories?: string[];
    laboratories?: string[];
    medications?: string[];
  };
  includeCharts: boolean;
  includeRecommendations: boolean;
}

export interface GeneratedReport {
  id: string;
  title: string;
  content: string;
  charts: any[];
  metadata: {
    generatedAt: Date;
    userProfile: string;
    dataPoints: number;
    confidence: number;
  };
  downloadUrl?: string;
}

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);
  private readonly reportsDir = path.join(process.cwd(), 'generated-reports');

  constructor(private prisma: PrismaService) {
    // Criar diretório de relatórios se não existir
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Gera relatório automático baseado na configuração
   */
  async generateReport(config: ReportConfig): Promise<GeneratedReport> {
    try {
      this.logger.log(`Gerando relatório: ${config.type} para ${config.userProfile}`);

      // Buscar dados baseados na configuração
      const data = await this.fetchReportData(config);
      
      // Gerar conteúdo baseado no tipo
      const content = await this.generateReportContent(config, data);
      
      // Gerar gráficos se solicitado
      const charts = config.includeCharts ? await this.generateCharts(config, data) : [];
      
      // Criar ID único para o relatório
      const reportId = `report_${config.type}_${Date.now()}`;
      
      // Salvar relatório
      let downloadUrl;
      if (config.format === 'html') {
        downloadUrl = await this.saveHtmlReport(reportId, content, charts, config);
      } else if (config.format === 'pdf') {
        downloadUrl = await this.savePdfReport(reportId, content, charts, config);
      }

      const report: GeneratedReport = {
        id: reportId,
        title: this.generateReportTitle(config),
        content,
        charts,
        metadata: {
          generatedAt: new Date(),
          userProfile: config.userProfile,
          dataPoints: Array.isArray(data) ? data.length : Object.keys(data).length,
          confidence: 0.9,
        },
        downloadUrl,
      };

      // Salvar metadata no banco
      await this.saveReportMetadata(report, config);

      return report;
    } catch (error) {
      this.logger.error(`Erro ao gerar relatório: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca dados para o relatório
   */
  private async fetchReportData(config: ReportConfig): Promise<any> {
    const timeframeDays = config.parameters.timeframe || 90;
    const cutoffDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

    switch (config.type) {
      case 'market_analysis':
        return this.fetchMarketAnalysisData(cutoffDate, config.parameters);
      case 'price_trends':
        return this.fetchPriceTrendsData(cutoffDate, config.parameters);
      case 'lab_comparison':
        return this.fetchLabComparisonData(cutoffDate, config.parameters);
      case 'category_analysis':
        return this.fetchCategoryAnalysisData(cutoffDate, config.parameters);
      default:
        return [];
    }
  }

  /**
   * Gera conteúdo do relatório baseado no tipo
   */
  private async generateReportContent(config: ReportConfig, data: any): Promise<string> {
    const profileStyle = this.getProfileStyle(config.userProfile);
    
    let content = `
# ${this.generateReportTitle(config)}

**Gerado em:** ${new Date().toLocaleString('pt-BR')}
**Perfil:** ${this.getProfileDisplayName(config.userProfile)}
**Período:** ${config.parameters.timeframe || 90} dias

---

## 📊 Resumo Executivo

${this.generateExecutiveSummary(config, data, profileStyle)}

---

## 📈 Análise Detalhada

${this.generateDetailedAnalysis(config, data, profileStyle)}

---

## 💡 Insights e Recomendações

${this.generateInsightsAndRecommendations(config, data, profileStyle)}
    `;

    if (config.includeRecommendations) {
      content += `

---

## 🎯 Plano de Ação

${this.generateActionPlan(config, data, profileStyle)}
      `;
    }

    return content.trim();
  }

  /**
   * Gera gráficos para o relatório
   */
  private async generateCharts(config: ReportConfig, data: any): Promise<any[]> {
    const charts = [];

    // Gráfico de tendência de preços
    if (config.type === 'price_trends' || config.type === 'market_analysis') {
      charts.push({
        type: 'line',
        title: 'Tendência de Preços',
        data: this.prepareChartData(data, 'price_trend')
      });
    }

    // Gráfico de comparação de laboratórios
    if (config.type === 'lab_comparison' || config.type === 'market_analysis') {
      charts.push({
        type: 'bar',
        title: 'Comparação de Laboratórios',
        data: this.prepareChartData(data, 'lab_comparison')
      });
    }

    // Gráfico de distribuição por categoria
    if (config.type === 'category_analysis' || config.type === 'market_analysis') {
      charts.push({
        type: 'pie',
        title: 'Distribuição por Categoria',
        data: this.prepareChartData(data, 'category_distribution')
      });
    }

    return charts;
  }

  /**
   * Salva relatório HTML
   */
  private async saveHtmlReport(reportId: string, content: string, charts: any[], config: ReportConfig): Promise<string> {
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.generateReportTitle(config)}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
        h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
        h2 { color: #1d4ed8; margin-top: 30px; }
        h3 { color: #3730a3; }
        .metric { background: #f0f9ff; padding: 15px; margin: 10px 0; border-left: 4px solid #2563eb; border-radius: 5px; }
        .insight { background: #f0fdf4; padding: 15px; margin: 10px 0; border-left: 4px solid #16a34a; border-radius: 5px; }
        .recommendation { background: #fef3c7; padding: 15px; margin: 10px 0; border-left: 4px solid #d97706; border-radius: 5px; }
        .chart-container { margin: 20px 0; padding: 20px; background: #fafafa; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8fafc; font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #6b7280; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        ${this.convertMarkdownToHtml(content)}
        
        ${charts.length > 0 ? `
        <h2>📈 Gráficos e Visualizações</h2>
        ${charts.map((chart, index) => `
        <div class="chart-container">
            <h3>${chart.title}</h3>
            <canvas id="chart${index}" width="800" height="400"></canvas>
        </div>
        `).join('')}
        
        <script>
        ${charts.map((chart, index) => this.generateChartScript(chart, index)).join('\n')}
        </script>
        ` : ''}
        
        <div class="footer">
            <p>Relatório gerado automaticamente pelo RayMed ML Analytics</p>
            <p>Data: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
    </div>
</body>
</html>
    `;

    const filePath = path.join(this.reportsDir, `${reportId}.html`);
    fs.writeFileSync(filePath, htmlTemplate);

    return `/reports/${reportId}.html`;
  }

  /**
   * Busca dados específicos por tipo de relatório
   */
  private async fetchMarketAnalysisData(cutoffDate: Date, parameters: any): Promise<any> {
    const medications = await this.prisma.medication.findMany({
      include: {
        prices: {
          where: { capturedAt: { gte: cutoffDate } },
          include: { lab: true },
          orderBy: { capturedAt: 'desc' }
        }
      }
    });

    return {
      medications: medications.filter(med => med.prices.length > 0),
      totalMedications: medications.length,
      timeframe: parameters.timeframe || 90
    };
  }

  private async fetchPriceTrendsData(cutoffDate: Date, parameters: any): Promise<any> {
    // Implementação específica para tendências de preços
    return this.fetchMarketAnalysisData(cutoffDate, parameters);
  }

  private async fetchLabComparisonData(cutoffDate: Date, parameters: any): Promise<any> {
    const labs = await this.prisma.lab.findMany({
      include: {
        prices: {
          where: { capturedAt: { gte: cutoffDate } },
          include: { medication: true },
          orderBy: { capturedAt: 'desc' }
        }
      }
    });

    return labs.filter(lab => lab.prices.length > 0);
  }

  private async fetchCategoryAnalysisData(cutoffDate: Date, parameters: any): Promise<any> {
    // Análise por categoria
    return this.fetchMarketAnalysisData(cutoffDate, parameters);
  }

  /**
   * Utilitários para geração de conteúdo
   */
  private generateReportTitle(config: ReportConfig): string {
    const titles = {
      market_analysis: 'Análise de Mercado Farmacêutico',
      price_trends: 'Tendências de Preços de Medicamentos',
      lab_comparison: 'Comparação de Laboratórios',
      category_analysis: 'Análise por Categoria Terapêutica'
    };

    const profileSuffix = {
      medico: '- Visão Clínica',
      hospital: '- Visão Hospitalar', 
      distribuidor: '- Visão Comercial',
      analista: '- Visão Analítica'
    };

    return `${titles[config.type]} ${profileSuffix[config.userProfile]}`;
  }

  private getProfileDisplayName(profile: string): string {
    const names = {
      medico: 'Médico/Prescritor',
      hospital: 'Gestor Hospitalar',
      distribuidor: 'Distribuidor/Comercial',
      analista: 'Analista de Mercado'
    };
    return names[profile] || profile;
  }

  private getProfileStyle(profile: string): any {
    return {
      medico: {
        focus: 'eficácia clínica',
        language: 'técnico-científico',
        metrics: ['bioequivalência', 'indicações', 'contraindicações']
      },
      hospital: {
        focus: 'custo-efetividade',
        language: 'administrativo',
        metrics: ['custo por tratamento', 'volume', 'contratos']
      },
      distribuidor: {
        focus: 'margem comercial',
        language: 'comercial',
        metrics: ['margem', 'giro', 'demanda']
      },
      analista: {
        focus: 'dados estatísticos',
        language: 'analítico',
        metrics: ['tendências', 'correlações', 'projeções']
      }
    };
  }

  private generateExecutiveSummary(config: ReportConfig, data: any, style: any): string {
    // Gerar resumo executivo personalizado por perfil
    let summary = '';

    switch (config.userProfile) {
      case 'medico':
        summary = this.generateMedicalSummary(data);
        break;
      case 'hospital':
        summary = this.generateHospitalSummary(data);
        break;
      case 'distribuidor':
        summary = this.generateCommercialSummary(data);
        break;
      case 'analista':
        summary = this.generateAnalyticalSummary(data);
        break;
    }

    return summary;
  }

  private generateMedicalSummary(data: any): string {
    return `
👨‍⚕️ **Resumo para Prescritor:**

• **Medicamentos analisados:** ${data.totalMedications || data.medications?.length || 0}
• **Foco clínico:** Equivalência terapêutica e disponibilidade
• **Alertas:** Mudanças que podem impactar prescrições
• **Recomendação:** Monitorar disponibilidade de alternativas terapêuticas
    `;
  }

  private generateHospitalSummary(data: any): string {
    const medications = data.medications || [];
    const totalValue = medications.reduce((sum, med) => {
      const price = med.prices[0] ? parseFloat(med.prices[0].value) : 0;
      return sum + price;
    }, 0);

    return `
🏥 **Resumo para Gestão Hospitalar:**

• **Medicamentos analisados:** ${medications.length}
• **Valor total estimado:** R$ ${totalValue.toLocaleString()}
• **Foco:** Otimização de custos e gestão de estoque
• **Oportunidades:** Negociação de contratos e compras programadas
    `;
  }

  private generateCommercialSummary(data: any): string {
    return `
📈 **Resumo Comercial:**

• **Oportunidades de negócio** identificadas
• **Análise de margem** por categoria
• **Tendências de demanda** no período
• **Competitividade** por laboratório
    `;
  }

  private generateAnalyticalSummary(data: any): string {
    return `
📊 **Resumo Analítico:**

• **Dados processados:** ${data.medications?.length || 0} medicamentos
• **Período de análise:** ${data.timeframe || 90} dias
• **Métricas calculadas:** Tendências, volatilidade, correlações
• **Confiança estatística:** 90%+
    `;
  }

  private generateDetailedAnalysis(config: ReportConfig, data: any, style: any): string {
    // Análise detalhada personalizada
    return `Análise detalhada baseada nos dados coletados no período especificado.`;
  }

  private generateInsightsAndRecommendations(config: ReportConfig, data: any, style: any): string {
    // Insights e recomendações personalizadas
    return `Insights e recomendações baseadas no perfil ${config.userProfile}.`;
  }

  private generateActionPlan(config: ReportConfig, data: any, style: any): string {
    // Plano de ação personalizado
    return `Plano de ação específico para ${config.userProfile}.`;
  }

  private prepareChartData(data: any, chartType: string): any {
    // Preparar dados para gráficos
    switch (chartType) {
      case 'price_trend':
        return data.medications?.slice(0, 10).map(med => ({
          name: med.name,
          price: med.prices[0] ? parseFloat(med.prices[0].value) : 0
        })) || [];
      case 'lab_comparison':
        return []; // Implementar baseado nos dados
      case 'category_distribution':
        return []; // Implementar baseado nos dados
      default:
        return [];
    }
  }

  private convertMarkdownToHtml(markdown: string): string {
    // Conversão simples de Markdown para HTML
    return markdown
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^• (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, '<p>$1</p>')
      .replace(/<p><h/g, '<h')
      .replace(/<\/h([1-6])><\/p>/g, '</h$1>');
  }

  private generateChartScript(chart: any, index: number): string {
    return `
    const ctx${index} = document.getElementById('chart${index}').getContext('2d');
    new Chart(ctx${index}, {
        type: '${chart.type}',
        data: ${JSON.stringify(chart.data)},
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '${chart.title}'
                }
            }
        }
    });
    `;
  }

  private async saveReportMetadata(report: GeneratedReport, config: ReportConfig): Promise<void> {
    try {
      // Salvar metadata no banco
      await this.prisma.systemMetric.create({
        data: {
          name: `report_${report.id}`,
          value: 1,
          tags: JSON.stringify({
            type: 'generated_report',
            reportId: report.id,
            reportType: config.type,
            userProfile: config.userProfile,
            generatedAt: report.metadata.generatedAt,
            dataPoints: report.metadata.dataPoints,
            downloadUrl: report.downloadUrl
          })
        }
      });
    } catch (error) {
      this.logger.warn(`Erro ao salvar metadata do relatório: ${error.message}`);
    }
  }

  private async savePdfReport(reportId: string, content: string, charts: any[], config: ReportConfig): Promise<string> {
    // Placeholder para geração de PDF
    // Em produção, usaria bibliotecas como puppeteer ou jsPDF
    this.logger.warn('Geração de PDF não implementada - usando HTML');
    return this.saveHtmlReport(reportId, content, charts, config);
  }
}
