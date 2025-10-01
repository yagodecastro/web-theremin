
import argparse
import mido
import numpy as np
import os
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime

# --- Constantes Configuráveis ---
# Valores de nota MIDI para cada evento.
# C0 = 12, C2 = 36, C3 = 48 (padrão General MIDI)
METRONOME_NOTE = 24
KEYBOARD_NOTE = 48
THEREMIN_NOTE = 60

def calculate_deviations(note_times, reference_times):
    """
    Calcula o desvio de cada nota em relação à referência mais próxima.

    Args:
        note_times (np.array): Timestamps dos eventos de nota (em segundos).
        reference_times (np.array): Timestamps dos eventos de referência (metrônomo).

    Returns:
        np.array: Um array com os desvios em milissegundos.
    """
    deviations = []
    if note_times.size == 0 or reference_times.size == 0:
        return np.array(deviations)

    for note_time in note_times:
        # Encontra o índice do clique do metrônomo mais próximo
        closest_ref_idx = np.argmin(np.abs(reference_times - note_time))
        # Calcula a diferença em milissegundos
        deviation = (note_time - reference_times[closest_ref_idx]) * 1000
        deviations.append(deviation)

    return np.array(deviations)

def calculate_precision_metrics(deviations):
    """
    Calcula métricas separadas de offset sistemático e precisão real.

    Args:
        deviations (np.array): Array de desvios em milissegundos.

    Returns:
        dict: Dicionário com métricas de offset e precisão.
    """
    if deviations.size == 0:
        return {
            'offset_sistematico': 0.0,
            'precisao_real': 0.0,
            'desvio_absoluto_medio': 0.0,
            'precisao_corrigida': 0.0,
            'eventos_analisados': 0
        }

    offset_sistematico = np.mean(deviations)
    precisao_real = np.std(deviations)
    desvio_absoluto_medio = np.mean(np.abs(deviations))

    # Precisão corrigida: desvio padrão após remoção do offset
    deviations_corrigidos = deviations - offset_sistematico
    precisao_corrigida = np.std(deviations_corrigidos)

    return {
        'offset_sistematico': offset_sistematico,
        'precisao_real': precisao_real,
        'desvio_absoluto_medio': desvio_absoluto_medio,
        'precisao_corrigida': precisao_corrigida,
        'eventos_analisados': len(deviations)
    }

def generate_sync_graph(theremin_deviations, keyboard_deviations, output_path, graph_format="png"):
    """
    Gera gráfico de análise de sincronização com múltiplas visualizações.

    Args:
        theremin_deviations (np.array): Desvios do theremin em milissegundos.
        keyboard_deviations (np.array): Desvios do teclado em milissegundos.
        output_path (str): Caminho base para salvar o gráfico (sem extensão).
        graph_format (str): Formato(s) do gráfico: "png", "svg", "pdf", ou "both".
    """
    # Configurar estilo
    plt.style.use('default')
    sns.set_palette("husl")

    # Criar figura com subplots
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
    fig.suptitle('Análise de Sincronização Gesto-Música', fontsize=16, fontweight='bold')

    # 1. Gráfico de dispersão temporal
    if len(theremin_deviations) > 0:
        ax1.scatter(range(len(theremin_deviations)), theremin_deviations,
                   alpha=0.7, label='Theremin (Gesto)', color='#e74c3c', s=50)
    if len(keyboard_deviations) > 0:
        ax1.scatter(range(len(keyboard_deviations)), keyboard_deviations,
                   alpha=0.7, label='Teclado MIDI', color='#3498db', s=50)

    ax1.axhline(y=0, color='black', linestyle='--', alpha=0.5, linewidth=1)
    ax1.set_xlabel('Índice do Evento')
    ax1.set_ylabel('Desvio (ms)')
    ax1.set_title('Desvios Temporais por Evento')
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # 2. Histogramas de distribuição
    bins = np.linspace(-200, 200, 30)
    if len(theremin_deviations) > 0:
        ax2.hist(theremin_deviations, bins=bins, alpha=0.6, label='Theremin',
                color='#e74c3c', density=True)
    if len(keyboard_deviations) > 0:
        ax2.hist(keyboard_deviations, bins=bins, alpha=0.6, label='Teclado',
                color='#3498db', density=True)

    ax2.axvline(x=0, color='black', linestyle='--', alpha=0.5, linewidth=1)
    ax2.set_xlabel('Desvio (ms)')
    ax2.set_ylabel('Densidade')
    ax2.set_title('Distribuição dos Desvios')
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    # 3. Box plot comparativo
    data_for_box = []
    labels_for_box = []
    if len(theremin_deviations) > 0:
        data_for_box.append(theremin_deviations)
        labels_for_box.append('Theremin')
    if len(keyboard_deviations) > 0:
        data_for_box.append(keyboard_deviations)
        labels_for_box.append('Teclado')

    if data_for_box:
        bp = ax3.boxplot(data_for_box, tick_labels=labels_for_box, patch_artist=True)
        colors = ['#e74c3c', '#3498db']
        for patch, color in zip(bp['boxes'], colors[:len(bp['boxes'])]):
            patch.set_facecolor(color)
            patch.set_alpha(0.6)

    ax3.axhline(y=0, color='black', linestyle='--', alpha=0.5, linewidth=1)
    ax3.set_ylabel('Desvio (ms)')
    ax3.set_title('Comparação Estatística')
    ax3.grid(True, alpha=0.3)

    # 4. Estatísticas resumo
    ax4.axis('off')
    stats_text = "Estatísticas de Sincronização\n\n"

    theremin_metrics = calculate_precision_metrics(theremin_deviations)
    keyboard_metrics = calculate_precision_metrics(keyboard_deviations)

    if len(theremin_deviations) > 0:
        stats_text += f"THEREMIN (Gesto de Pinça):\n"
        stats_text += f"  • Offset Sistemático: {theremin_metrics['offset_sistematico']:.2f} ms\n"
        stats_text += f"  • Precisão Real: {theremin_metrics['precisao_real']:.2f} ms\n"
        stats_text += f"  • Precisão Corrigida: {theremin_metrics['precisao_corrigida']:.2f} ms\n"
        stats_text += f"  • Eventos Analisados: {theremin_metrics['eventos_analisados']}\n\n"

    if len(keyboard_deviations) > 0:
        stats_text += f"TECLADO MIDI (Controle):\n"
        stats_text += f"  • Offset Sistemático: {keyboard_metrics['offset_sistematico']:.2f} ms\n"
        stats_text += f"  • Precisão Real: {keyboard_metrics['precisao_real']:.2f} ms\n"
        stats_text += f"  • Precisão Corrigida: {keyboard_metrics['precisao_corrigida']:.2f} ms\n"
        stats_text += f"  • Eventos Analisados: {keyboard_metrics['eventos_analisados']}\n\n"

    if len(theremin_deviations) > 0 and len(keyboard_deviations) > 0:
        theremin_precision = theremin_metrics['precisao_real']
        keyboard_precision = keyboard_metrics['precisao_real']
        better_instrument = "Theremin" if theremin_precision < keyboard_precision else "Teclado"
        difference = abs(theremin_precision - keyboard_precision)
        stats_text += f"COMPARAÇÃO (Precisão Real):\n"
        stats_text += f"  • Instrumento mais preciso: {better_instrument}\n"
        stats_text += f"  • Diferença de precisão: {difference:.2f} ms\n"

        # Comparação de offset
        theremin_offset = abs(theremin_metrics['offset_sistematico'])
        keyboard_offset = abs(keyboard_metrics['offset_sistematico'])
        stats_text += f"  • Offset menor: {'Teclado' if keyboard_offset < theremin_offset else 'Theremin'}\n"
        stats_text += f"  • Diferença de offset: {abs(theremin_offset - keyboard_offset):.2f} ms"

    ax4.text(0.05, 0.95, stats_text, transform=ax4.transAxes, fontsize=11,
            verticalalignment='top', fontfamily='monospace',
            bbox=dict(boxstyle='round', facecolor='lightgray', alpha=0.8))

    plt.tight_layout()

    # Determinar formatos para salvar
    formats_to_save = []
    if graph_format == "both":
        formats_to_save = ["png", "svg"]
    else:
        formats_to_save = [graph_format]

    # Remover extensão do caminho base se existir
    base_path = output_path
    if '.' in os.path.basename(output_path):
        base_path = os.path.splitext(output_path)[0]

    # Salvar em cada formato
    for fmt in formats_to_save:
        file_path = f"{base_path}.{fmt}"
        try:
            plt.savefig(file_path, dpi=300, bbox_inches='tight', format=fmt)
            print(f"Gráfico salvo em: {file_path}")
        except Exception as e:
            print(f"Erro ao salvar gráfico como {fmt}: {e}")

def generate_sync_report(midi_path, theremin_deviations, keyboard_deviations, output_path):
    """
    Gera relatório detalhado em formato Markdown da análise de sincronização.

    Args:
        midi_path (str): Caminho do arquivo MIDI analisado.
        theremin_deviations (np.array): Desvios do theremin em milissegundos.
        keyboard_deviations (np.array): Desvios do teclado em milissegundos.
        output_path (str): Caminho para salvar o relatório.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    report_content = f"""# Relatório de Análise de Sincronização Gesto-Música

**Data da Análise:** {timestamp}
**Arquivo MIDI:** `{os.path.basename(midi_path)}`

## Resumo Executivo

Este relatório apresenta a análise comparativa de sincronização entre o controle gestual (Web Theremin) e um controlador MIDI tradicional (teclado), utilizando um metrônomo como referência temporal.

## Metodologia

- **Referência Temporal:** Metrônomo (nota MIDI {METRONOME_NOTE})
- **Gesto de Pinça:** Web Theremin (nota MIDI {THEREMIN_NOTE})
- **Controle Tradicional:** Teclado MIDI (nota MIDI {KEYBOARD_NOTE})
- **Métrica:** Desvio temporal em milissegundos entre eventos musicais e referência

## Resultados Detalhados

"""

    # Análise do Theremin
    if len(theremin_deviations) > 0:
        theremin_metrics = calculate_precision_metrics(theremin_deviations)

        report_content += f"""### Web Theremin (Gesto de Pinça)

| Métrica | Valor |
|---------|-------|
| **Eventos Analisados** | {theremin_metrics['eventos_analisados']} |
| **Offset Sistemático** | {theremin_metrics['offset_sistematico']:.2f} ms |
| **Precisão Real (σ)** | {theremin_metrics['precisao_real']:.2f} ms |
| **Precisão Corrigida** | {theremin_metrics['precisao_corrigida']:.2f} ms |
| **Desvio Médio Absoluto** | {theremin_metrics['desvio_absoluto_medio']:.2f} ms |
| **Maior Atraso** | {np.max(theremin_deviations):.2f} ms |
| **Maior Antecipação** | {np.min(theremin_deviations):.2f} ms |

**Interpretação Corrigida:**
- **Offset Sistemático:** {theremin_metrics['offset_sistematico']:.2f} ms indica {'atraso' if theremin_metrics['offset_sistematico'] > 0 else 'antecipação'} sistemático {'(possível latência de processamento)' if abs(theremin_metrics['offset_sistematico']) > 50 else '(timing adequado)'}
- **Precisão Real:** {theremin_metrics['precisao_real']:.2f} ms representa a variabilidade temporal real (quanto menor, mais preciso)
- **Precisão Corrigida:** {theremin_metrics['precisao_corrigida']:.2f} ms mostra a precisão após correção do offset sistemático
- **Qualidade:** {'Excelente precisão' if theremin_metrics['precisao_real'] < 50 else 'Boa precisão' if theremin_metrics['precisao_real'] < 100 else 'Precisão moderada' if theremin_metrics['precisao_real'] < 150 else 'Precisão baixa'} para interface gestual

"""
    else:
        report_content += """### Web Theremin (Gesto de Pinça)

**Status:** Nenhum evento de gesto detectado no arquivo MIDI.

"""

    # Análise do Teclado
    if len(keyboard_deviations) > 0:
        keyboard_metrics = calculate_precision_metrics(keyboard_deviations)

        report_content += f"""### Teclado MIDI (Controle)

| Métrica | Valor |
|---------|-------|
| **Eventos Analisados** | {keyboard_metrics['eventos_analisados']} |
| **Offset Sistemático** | {keyboard_metrics['offset_sistematico']:.2f} ms |
| **Precisão Real (σ)** | {keyboard_metrics['precisao_real']:.2f} ms |
| **Precisão Corrigida** | {keyboard_metrics['precisao_corrigida']:.2f} ms |
| **Desvio Médio Absoluto** | {keyboard_metrics['desvio_absoluto_medio']:.2f} ms |
| **Maior Atraso** | {np.max(keyboard_deviations):.2f} ms |
| **Maior Antecipação** | {np.min(keyboard_deviations):.2f} ms |

**Interpretação:**
- **Offset Sistemático:** {keyboard_metrics['offset_sistematico']:.2f} ms mostra {'atraso' if keyboard_metrics['offset_sistematico'] > 0 else 'antecipação'} típico de controlador MIDI
- **Precisão Real:** {keyboard_metrics['precisao_real']:.2f} ms representa a baseline de variabilidade para controladores tradicionais
- **Controle Experimental:** Usado como referência para comparação com interface gestual

"""
    else:
        report_content += """### Teclado MIDI (Controle)

**Status:** Nenhum evento de teclado detectado no arquivo MIDI.

"""

    # Análise Comparativa
    if len(theremin_deviations) > 0 and len(keyboard_deviations) > 0:
        theremin_metrics = calculate_precision_metrics(theremin_deviations)
        keyboard_metrics = calculate_precision_metrics(keyboard_deviations)

        # Comparações baseadas em precisão real (não offset)
        theremin_precision = theremin_metrics['precisao_real']
        keyboard_precision = keyboard_metrics['precisao_real']
        precision_diff = abs(theremin_precision - keyboard_precision)
        precision_ratio = (min(theremin_precision, keyboard_precision) / max(theremin_precision, keyboard_precision)) * 100

        # Comparação de offsets
        theremin_offset = abs(theremin_metrics['offset_sistematico'])
        keyboard_offset = abs(keyboard_metrics['offset_sistematico'])
        offset_diff = abs(theremin_offset - keyboard_offset)

        better_precision = "Web Theremin" if theremin_precision < keyboard_precision else "Teclado MIDI"
        better_offset = "Web Theremin" if theremin_offset < keyboard_offset else "Teclado MIDI"

        report_content += f"""## Análise Comparativa

### Comparação de Precisão Real (Variabilidade)

| Métrica | Web Theremin | Teclado MIDI | Melhor |
|---------|--------------|--------------|--------|
| **Precisão Real (σ)** | {theremin_precision:.2f} ms | {keyboard_precision:.2f} ms | {better_precision} |
| **Offset Sistemático** | {theremin_offset:.2f} ms | {keyboard_offset:.2f} ms | {better_offset} |
| **Diferença de Precisão** | {precision_diff:.2f} ms | - | - |
| **Eficiência Relativa** | {precision_ratio:.1f}% | - | - |

### Interpretação Corrigida dos Resultados

"""

        # Análise de precisão real
        if theremin_precision < keyboard_precision:
            improvement = ((keyboard_precision - theremin_precision) / keyboard_precision) * 100
            report_content += f"""**Análise de Precisão (Variabilidade Temporal):**

O Web Theremin demonstrou **melhor precisão real** que o teclado MIDI:
- Variabilidade {improvement:.1f}% menor que o controle tradicional
- Diferença de {precision_diff:.2f} ms na consistência temporal
- Interface gestual mais estável que esperado para este tipo de tecnologia

"""
        elif precision_diff < 20:  # Diferença pequena
            report_content += f"""**Análise de Precisão (Variabilidade Temporal):**

Ambos os instrumentos apresentaram **precisão similar**:
- Diferença de apenas {precision_diff:.2f} ms na variabilidade
- Web Theremin ({theremin_precision:.2f} ms) vs Teclado ({keyboard_precision:.2f} ms)
- Performance comparável entre interface gestual e controle tradicional

"""
        else:
            improvement = ((theremin_precision - keyboard_precision) / keyboard_precision) * 100
            report_content += f"""**Análise de Precisão (Variabilidade Temporal):**

O teclado MIDI apresentou **melhor precisão real**:
- Variabilidade {improvement:.1f}% menor que a interface gestual
- Diferença de {precision_diff:.2f} ms pode ser otimizada
- Oportunidade de melhoria no processamento de gestos

"""

        # Análise de offset sistemático
        report_content += f"""**Análise de Offset Sistemático:**

"""
        if offset_diff < 20:
            report_content += f"""Ambos os instrumentos apresentam offsets similares ({theremin_offset:.2f} ms vs {keyboard_offset:.2f} ms), indicando latências comparáveis de processamento.

"""
        elif theremin_offset > keyboard_offset:
            latency_factor = theremin_offset / keyboard_offset if keyboard_offset > 0 else float('inf')
            report_content += f"""O Web Theremin apresenta offset sistemático maior ({theremin_offset:.2f} ms vs {keyboard_offset:.2f} ms):
- Diferença de {offset_diff:.2f} ms pode indicar latência de processamento gestual
- **Importante:** Este offset é corrigível via calibração de software
- Não afeta a qualidade da precisão relativa do instrumento

"""
        else:
            report_content += f"""O Web Theremin apresenta offset sistemático menor ({theremin_offset:.2f} ms vs {keyboard_offset:.2f} ms), demonstrando eficiência temporal superior.

"""

        # Conclusão integrada
        if theremin_precision < keyboard_precision and theremin_offset < keyboard_offset:
            report_content += f"""### Conclusão da Comparação

O Web Theremin demonstrou **performance superior** em ambas as métricas: melhor precisão ({theremin_precision:.2f} ms vs {keyboard_precision:.2f} ms) e menor offset ({theremin_offset:.2f} ms vs {keyboard_offset:.2f} ms).

"""
        elif theremin_precision < keyboard_precision:
            report_content += f"""### Conclusão da Comparação

O Web Theremin apresentou **precisão superior** ({theremin_precision:.2f} ms vs {keyboard_precision:.2f} ms), mas maior offset sistemático. Com calibração adequada, pode superar controladores tradicionais.

"""
        elif theremin_offset < keyboard_offset:
            report_content += f"""### Conclusão da Comparação

O Web Theremin demonstrou **melhor timing sistemático**, mas precisão ligeiramente inferior. Representa alternativa viável a controladores tradicionais.

"""
        else:
            report_content += f"""### Conclusão da Comparação

O teclado MIDI apresentou performance superior em ambas as métricas, mas o Web Theremin demonstra potencial significativo como interface gestual, especialmente considerando a complexidade da tecnologia envolvida.

"""

    # Recomendações
    report_content += """## Recomendações

### Para Desenvolvimento da Interface Gestual

"""

    if len(theremin_deviations) > 0:
        avg_delay = np.mean(theremin_deviations)
        if abs(avg_delay) > 20:
            if avg_delay > 0:
                report_content += f"- **Otimizar latência:** Atraso médio de {avg_delay:.2f} ms sugere necessidade de otimização no pipeline de processamento\n"
            else:
                report_content += f"- **Calibrar antecipação:** Antecipação média de {abs(avg_delay):.2f} ms pode indicar sobre-compensação temporal\n"

        if np.std(theremin_deviations) > 30:
            report_content += f"- **Melhorar consistência:** Desvio padrão de {np.std(theremin_deviations):.2f} ms indica variabilidade temporal elevada\n"

        if len(theremin_deviations) < 10:
            report_content += "- **Aumentar amostra:** Número limitado de eventos gestuais detectados - considerar sessões de teste mais longas\n"

    report_content += """
### Para Futuras Análises

- Expandir dataset com múltiplos usuários e sessões
- Analisar performance em diferentes BPMs do metrônomo
- Comparar com outros tipos de controladores gestuais
- Implementar análise de fadiga temporal em sessões estendidas

## Conclusão

"""

    if len(theremin_deviations) > 0 and len(keyboard_deviations) > 0:
        if theremin_precision < keyboard_precision:
            report_content += "A interface gestual demonstrou performance superior ao controle tradicional, validando a eficácia da tecnologia de reconhecimento de gestos para aplicações musicais em tempo real."
        else:
            report_content += "Embora o controle tradicional tenha demonstrado maior precisão, a interface gestual apresenta resultados promissores com potencial para otimização e melhorias futuras."
    else:
        report_content += "Análise limitada devido à ausência de eventos em uma ou ambas as modalidades de controle. Recomenda-se nova coleta de dados com protocolo experimental revisado."

    report_content += f"""

---
*Relatório gerado automaticamente pelo gesture_sync_analyzer.py em {timestamp}*
"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report_content)

    print(f"Relatório salvo em: {output_path}")

def analyze_synchronization(midi_path, output_dir="output", generate_graph=True,
                          generate_report=True, graph_format="png", show_graph=False):
    """
    Analisa um arquivo MIDI para calcular a sincronização entre gestos,
    teclado e um metrônomo.

    Args:
        midi_path (str): O caminho para o arquivo .mid.
        output_dir (str): Diretório para salvar os arquivos de saída.
        generate_graph (bool): Se deve gerar gráfico de análise.
        generate_report (bool): Se deve gerar relatório em markdown.
        graph_format (str): Formato do gráfico (png, svg, pdf).
        show_graph (bool): Se deve exibir gráfico interativo.
    """
    if not os.path.exists(midi_path):
        print(f"Erro: Arquivo não encontrado em '{midi_path}'")
        return

    # Criar diretório de output se necessário
    if generate_graph or generate_report:
        os.makedirs(output_dir, exist_ok=True)
        print(f"Usando diretório de saída: {output_dir}")

    try:
        mid = mido.MidiFile(midi_path)
    except Exception as e:
        print(f"Erro ao ler o arquivo MIDI: {e}")
        return

    metronome_times = []
    theremin_times = []
    keyboard_times = []

    # Acumula o tempo para lidar com múltiplos tracks
    absolute_time = 0.0
    for msg in mid:
        absolute_time += msg.time
        if msg.type == 'note_on' and msg.velocity > 0:
            if msg.note == METRONOME_NOTE:
                metronome_times.append(absolute_time)
            elif msg.note == THEREMIN_NOTE:
                theremin_times.append(absolute_time)
            elif msg.note == KEYBOARD_NOTE:
                keyboard_times.append(absolute_time)

    # Converte para arrays numpy para cálculos eficientes
    metronome_times = np.array(metronome_times)
    theremin_times = np.array(theremin_times)
    keyboard_times = np.array(keyboard_times)

    print(f"Análise de Sincronização para o arquivo: {os.path.basename(midi_path)}\n")
    print(f"Eventos encontrados: Metrônomo ({len(metronome_times)}), Theremin ({len(theremin_times)}), Teclado ({len(keyboard_times)})\n")

    # Calcula desvios para o Theremin e Teclado
    theremin_deviations = calculate_deviations(theremin_times, metronome_times)
    keyboard_deviations = calculate_deviations(keyboard_times, metronome_times)

    # Apresenta os resultados no console
    print_results("Theremin (Gesto de Pinça)", theremin_deviations)
    print_results("Teclado MIDI (Controle)", keyboard_deviations)

    # Gerar timestamp para nomes de arquivo
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_filename = f"sync_analysis_{timestamp}"

    # Gerar gráfico se solicitado
    if generate_graph:
        if graph_format == "both":
            graph_path = os.path.join(output_dir, base_filename)
        else:
            graph_path = os.path.join(output_dir, f"{base_filename}.{graph_format}")
        try:
            generate_sync_graph(theremin_deviations, keyboard_deviations, graph_path, graph_format)
            if show_graph:
                plt.show()
        except Exception as e:
            print(f"Erro ao gerar gráfico: {e}")

    # Gerar relatório se solicitado
    if generate_report:
        report_path = os.path.join(output_dir, f"{base_filename}.md")
        try:
            generate_sync_report(midi_path, theremin_deviations, keyboard_deviations, report_path)
        except Exception as e:
            print(f"Erro ao gerar relatório: {e}")

    # Resumo final
    if generate_graph or generate_report:
        print(f"\nAnálise completa! Arquivos salvos em: {output_dir}")

def print_results(source_name, deviations):
    """
    Imprime as estatísticas de desvio de forma formatada.
    """
    print(f"--- Resultados para: {source_name} ---")
    if deviations.size == 0:
        print("Nenhum evento encontrado para análise.")
        return

    mean_dev = np.mean(deviations)
    std_dev = np.std(deviations)
    abs_mean_dev = np.mean(np.abs(deviations))
    min_dev = np.min(deviations)
    max_dev = np.max(deviations)

    print(f"  - Desvio Médio (Absoluto): {abs_mean_dev:.2f} ms")
    print(f"  - Desvio Médio (Real):      {mean_dev:.2f} ms (positivo = atrasado, negativo = adiantado)")
    print(f"  - Desvio Padrão:            {std_dev:.2f} ms")
    print(f"  - Desvio Mínimo (Mais adiantado): {min_dev:.2f} ms")
    print(f"  - Desvio Máximo (Mais atrasado):  {max_dev:.2f} ms")
    print("-" * (len(source_name) + 22) + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Analisa a sincronização rítmica de notas MIDI em relação a um metrônomo."
    )
    parser.add_argument(
        "midi_file",
        help="Caminho para o arquivo .mid a ser analisado"
    )
    parser.add_argument(
        "--output-dir",
        default="output",
        help="Diretório para salvar os arquivos de saída (padrão: output)"
    )
    parser.add_argument(
        "--generate-graph",
        action="store_true",
        default=True,
        help="Gerar gráfico de análise (padrão: True)"
    )
    parser.add_argument(
        "--generate-report",
        action="store_true",
        default=True,
        help="Gerar relatório em markdown (padrão: True)"
    )
    parser.add_argument(
        "--graph-format",
        choices=["png", "svg", "pdf", "both"],
        default="png",
        help="Formato do gráfico: png, svg, pdf, ou both (png+svg). Padrão: png"
    )
    parser.add_argument(
        "--show-graph",
        action="store_true",
        help="Exibir gráfico interativo (além de salvar)"
    )
    parser.add_argument(
        "--no-graph",
        action="store_true",
        help="Não gerar gráfico"
    )
    parser.add_argument(
        "--no-report",
        action="store_true",
        help="Não gerar relatório"
    )

    args = parser.parse_args()

    # Ajustar flags baseado nos argumentos
    generate_graph = args.generate_graph and not args.no_graph
    generate_report = args.generate_report and not args.no_report

    analyze_synchronization(args.midi_file, args.output_dir, generate_graph,
                          generate_report, args.graph_format, args.show_graph)
