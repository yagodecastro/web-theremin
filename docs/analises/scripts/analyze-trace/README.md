# Analyze Trace

Script Python para análise de performance de traces do Chrome DevTools com geração de gráficos e relatórios detalhados.

## Descrição

Analisa arquivos de trace do Chrome para extrair métricas de FPS e performance do processamento de frames. O script identifica:

- Taxa de atualização do monitor
- FPS médio, mínimo e máximo
- Duração de processamento de frames
- Distribuição de FPS por faixas

Gera gráficos visuais:
- Timeline de FPS ao longo do tempo com linha de FPS alvo
- Histograma de distribuição de FPS
- Gráfico de barras com buckets de FPS
- Timeline de duração de processamento por frame

Gera relatório detalhado em Markdown com:
- Análise completa de métricas de FPS
- Interpretação de resultados
- Recomendações de otimização
- Avaliação de performance

## Instalação

Instale as dependências Python necessárias:

```bash
pip install matplotlib seaborn numpy
```

Ou usando requirements.txt:

```bash
pip install -r requirements.txt
```

## Uso

```bash
python analyze-trace.py <caminho-para-trace.json> [opções]
```

### Opções

- `--output <dir>` ou `-o <dir>` - Diretório para salvar os gráficos e relatório (padrão: `output`)
- `--format <formato>` - Formato dos gráficos: `png`, `svg`, ou `both` (padrão: `png`)
- `--no-plot` - Desabilita geração de gráficos (apenas análise textual)
- `--no-report` - Não gerar relatório em markdown

## Exemplos

Análise básica com gráficos em PNG:
```bash
python analyze-trace.py trace-20250930.json
```

Gerar gráficos em SVG:
```bash
python analyze-trace.py trace-20250930.json --format svg
```

Gerar em PNG e SVG:
```bash
python analyze-trace.py trace-20250930.json --format both
```

Especificar diretório de saída:
```bash
python analyze-trace.py trace-20250930.json --output ./resultados
```

Apenas análise textual (sem gráficos e relatório):
```bash
python analyze-trace.py trace-20250930.json --no-plot --no-report
```

Gerar apenas relatório sem gráficos:
```bash
python analyze-trace.py trace-20250930.json --no-plot
```

## Como Capturar Traces

1. Abra o Chrome DevTools (F12)
2. Vá para a aba "Performance"
3. Clique no botão de gravação
4. Execute as ações que deseja analisar
5. Pare a gravação
6. Clique em "Save profile" para exportar o arquivo JSON

## Saída

### Saída no Terminal

O script exibe:

- Informações do monitor e FPS alvo configurado
- Análise de duração de processamento de frames
- Métricas de FPS (médio, mínimo, máximo)
- Distribuição visual de FPS por faixas

### Gráficos Gerados

Os gráficos são salvos no diretório especificado (padrão: `output/`) com os seguintes nomes:

- `trace_analysis_TIMESTAMP_fps_timeline.png` - Linha temporal de FPS com FPS alvo
- `trace_analysis_TIMESTAMP_fps_distribution.png` - Histograma de distribuição
- `trace_analysis_TIMESTAMP_fps_buckets.png` - Gráfico de barras com buckets
- `trace_analysis_TIMESTAMP_frame_duration.png` - Duração de processamento por frame

Se usar `--format svg` ou `--format both`, os arquivos serão salvos também em formato SVG.

### Relatório Markdown

Por padrão, o script gera um relatório detalhado em Markdown:

- `trace_analysis_TIMESTAMP.md` - Relatório completo com:
  - Resumo executivo
  - Informações do monitor e FPS alvo
  - Análise detalhada de duração de frames
  - Métricas de FPS com tabelas
  - Avaliação de performance
  - Distribuição de FPS por faixas
  - Recomendações de otimização
  - Conclusões e próximos passos
