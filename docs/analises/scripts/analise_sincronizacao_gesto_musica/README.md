# Análise de Sincronização Gesto-Música

Este diretório contém os recursos para a análise da métrica de **Sincronização Gesto-Música**, conforme descrito na seção 2.1 do documento de sugestões de análise.

## Objetivo

O objetivo desta análise é medir a precisão rítmica da interface gestual em comparação com um controlador MIDI tradicional. Para isso, calculamos o desvio (em milissegundos) entre as notas musicais geradas pelo metrônomo, pelo web theremin (gesto de pinça) e por um teclado MIDI.

## Arquivos

- `gesture_sync_analyzer.py`: Script Python que processa o arquivo MIDI, calcula os desvios de tempo, gera gráficos e relatórios.
- `testes-metronome-theremin-e-teclado.mid`: Arquivo MIDI contendo as gravações dos três instrumentos (metrônomo, theremin e teclado) tocando em sincronia.
- `output/`: Diretório onde são salvos os gráficos e relatórios gerados (criado automaticamente).

## Funcionalidades

### Análise Estatística
- Cálculo de desvios temporais em milissegundos
- Estatísticas descritivas (média, desvio padrão, min/max)
- Comparação entre instrumentos gestuais e tradicionais

### Visualização Gráfica
- **Gráfico de dispersão temporal**: Mostra desvios por evento
- **Histogramas**: Distribuição dos desvios para cada instrumento
- **Box plots**: Comparação estatística visual
- **Painel de estatísticas**: Resumo numérico integrado

### Relatórios Detalhados
- Relatórios em Markdown com análise completa
- Interpretação automática dos resultados
- Recomendações baseadas nos dados
- Comparação de precisão e consistência

## Pré-requisitos

Instale as dependências necessárias:

```bash
pip install mido matplotlib seaborn numpy
```

## Como Executar a Análise

### Uso Básico

Execute o script com configurações padrão (gera gráfico PNG e relatório MD):

```bash
python gesture_sync_analyzer.py testes-metronome-theremin-e-teclado.mid
```

### Opções Avançadas

```bash
# Especificar diretório de saída
python gesture_sync_analyzer.py arquivo.mid --output-dir meus_resultados

# Gerar apenas gráfico (sem relatório)
python gesture_sync_analyzer.py arquivo.mid --no-report

# Gerar apenas relatório (sem gráfico)
python gesture_sync_analyzer.py arquivo.mid --no-graph

# Gráfico em formato SVG
python gesture_sync_analyzer.py arquivo.mid --graph-format svg

# Exibir gráfico interativo além de salvar
python gesture_sync_analyzer.py arquivo.mid --show-graph

# Combinação de opções
python gesture_sync_analyzer.py arquivo.mid --output-dir resultados --graph-format pdf --show-graph
```

### Parâmetros Disponíveis

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `midi_file` | str | - | Caminho para o arquivo MIDI (obrigatório) |
| `--output-dir` | str | `output` | Diretório para salvar os arquivos |
| `--generate-graph` | flag | True | Gerar gráfico de análise |
| `--generate-report` | flag | True | Gerar relatório em markdown |
| `--graph-format` | str | `png` | Formato do gráfico (png, svg, pdf) |
| `--show-graph` | flag | False | Exibir gráfico interativo |
| `--no-graph` | flag | False | Não gerar gráfico |
| `--no-report` | flag | False | Não gerar relatório |

## Estrutura de Saída

Os arquivos são salvos com timestamp no formato `sync_analysis_YYYYMMDD_HHMMSS`:

```
output/
├── sync_analysis_20240928_143022.png  # Gráfico de análise
└── sync_analysis_20240928_143022.md   # Relatório detalhado
```

## Exemplo de Saída

### Console
```
Análise de Sincronização para o arquivo: testes-metronome-theremin-e-teclado.mid

Eventos encontrados: Metrônomo (24), Theremin (18), Teclado (20)

--- Resultados para: Theremin (Gesto de Pinça) ---
  - Desvio Médio (Absoluto): 15.34 ms
  - Desvio Médio (Real):      -2.45 ms (positivo = atrasado, negativo = adiantado)
  - Desvio Padrão:            22.18 ms
  - Desvio Mínimo (Mais adiantado): -45.23 ms
  - Desvio Máximo (Mais atrasado):  38.67 ms

--- Resultados para: Teclado MIDI (Controle) ---
  - Desvio Médio (Absoluto): 12.89 ms
  - Desvio Médio (Real):      1.23 ms (positivo = atrasado, negativo = adiantado)
  - Desvio Padrão:            18.45 ms
  - Desvio Mínimo (Mais adiantado): -32.10 ms
  - Desvio Máximo (Mais atrasado):  41.56 ms

Gráfico salvo em: output/sync_analysis_20240928_143022.png
Relatório salvo em: output/sync_analysis_20240928_143022.md

Análise completa! Arquivos salvos em: output
```

## Interpretação dos Resultados

### Métricas Principais
- **Desvio Médio Absoluto**: Precisão geral (quanto menor, melhor)
- **Desvio Médio Real**: Tendência temporal (positivo = atraso, negativo = antecipação)
- **Desvio Padrão**: Consistência (quanto menor, mais consistente)

### Análise Comparativa
O sistema automaticamente identifica qual instrumento é mais preciso e fornece recomendações baseadas nos dados coletados.

## Configurações MIDI

O script utiliza as seguintes notas MIDI por padrão:
- **Metrônomo**: Nota 24 (C0)
- **Theremin**: Nota 60 (C3)
- **Teclado**: Nota 48 (C2)

Para modificar essas configurações, edite as constantes no início do arquivo `gesture_sync_analyzer.py`.

## Troubleshooting

### Problemas Comuns
1. **"Nenhum evento encontrado"**: Verifique se as notas MIDI estão configuradas corretamente
2. **Erro de dependência**: Instale todas as bibliotecas listadas nos pré-requisitos
3. **Arquivo não encontrado**: Verifique o caminho para o arquivo MIDI

### Logs de Debug
O script fornece informações detalhadas sobre eventos encontrados e erros durante o processamento.
