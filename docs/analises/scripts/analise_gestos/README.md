# Análise e Visualização de Gestos MIDI

Esta pasta contém scripts e dados para analisar gestos musicais a partir de uma gravação MIDI de teste e gerar visualizações específicas para cada tipo de gesto.

## Estrutura

- `gesture_plan.json`: Arquivo de configuração que define os gestos a serem analisados, incluindo o tipo de evento MIDI esperado e o intervalo de tempo (em batidas) de cada gesto.
- `maos_test.csv`: Os dados brutos da gravação `testes-web-theremin-maos.mid`, convertidos para o formato CSV.
- `plots/`: Diretório com os gráficos SVG gerados para cada seção de teste.

---

## Script Principal

### `plot_midi_timeline.py`

Gera gráficos separados para cada seção de gesto definida no plano. Cada gráfico mostra apenas os dados MIDI específicos esperados para aquele tipo de gesto.

**Características:**
- **Gestos individuais**: Gera um gráfico separado para cada gesto com dados específicos
- **Gestos simultâneos**: Combina automaticamente seções que ocorrem no mesmo intervalo de tempo
- **Tipos de dados plotados**:
  - `note_on`: Eventos de pinça (scatter plot de notas MIDI)
  - `control_change`: Valores de controle específicos (line plot 0-127)

**Como usar:**

```bash
# Execute dentro do diretório analise_gestos/
python3 plot_midi_timeline.py maos_test.csv gesture_plan.json -o plots

# Ou especifique um diretório personalizado para os gráficos
python3 plot_midi_timeline.py maos_test.csv gesture_plan.json -o meus_graficos
```

**Gráficos gerados:**
- `section_1_pinça_esquerda_(beats_1-17).svg` - Apenas eventos note_on
- `section_2_mão_aberta_esquerda_(beats_33-49).svg` - Apenas CC1
- `section_3_mão_aberta_direita_(beats_65-81).svg` - Apenas CC11
- `section_simultaneous_beats_97-113.svg` - CC1 e CC11 combinados
