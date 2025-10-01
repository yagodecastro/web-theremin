import argparse
import json
import os
import re
from pathlib import Path
from datetime import datetime

import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np


def get_configured_target_fps():
    """
    Lê o FPS alvo configurado do arquivo defaults.ts.

    Returns:
        int: FPS alvo configurado ou None se não encontrado.
    """
    try:
        script_dir = Path(__file__).parent
        config_path = script_dir / '..' / '..' / '..' / '..' / 'src' / 'app' / 'shared' / 'config' / 'defaults.ts'

        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()

        match = re.search(r'frameRate:\s*{\s*ideal:\s*(\d+)', content)
        if match:
            return int(match.group(1))
    except Exception as e:
        print(f'Erro ao ler o arquivo de configuração: {e}')
        return None

    return None


def analyze_trace(trace_file, configured_target_fps=None):
    """
    Analisa arquivo de trace do Chrome DevTools.

    Args:
        trace_file (str): Caminho para o arquivo de trace JSON.
        configured_target_fps (int): FPS alvo configurado.

    Returns:
        dict: Dicionário com resultados da análise.
    """
    try:
        with open(trace_file, 'r', encoding='utf-8') as f:
            trace = json.load(f)
    except Exception as e:
        print(f'Erro ao ler arquivo de trace: {e}')
        return None

    events = trace.get('traceEvents', [])

    results = {
        'configured_target_fps': configured_target_fps,
        'trace_file': trace_file,
        'monitor_info': {},
        'frame_duration': {},
        'fps_analysis': {},
        'fps_distribution': {},
        'timestamps': [],
        'intervals': [],
        'durations': []
    }

    vsync_events = [
        e for e in events
        if (e.get('name') in ['BeginFrame', 'FireAnimationFrame'])
        and e.get('ts')
        and e.get('ph') == 'I'
    ]

    if len(vsync_events) > 10:
        vsync_timestamps = sorted([e['ts'] / 1000 for e in vsync_events])
        vsync_intervals = [
            vsync_timestamps[i] - vsync_timestamps[i-1]
            for i in range(1, len(vsync_timestamps))
        ]
        avg_vsync_interval = np.mean(vsync_intervals)
        refresh_rate = round(1000 / avg_vsync_interval)

        results['monitor_info'] = {
            'refresh_rate': refresh_rate,
            'avg_vsync_interval': avg_vsync_interval
        }

    measure_events = [
        e for e in events
        if e.get('name') == 'frame-process'
        and (e.get('cat') == 'blink.user_timing' or 'blink.user_timing' in str(e.get('cat', '')))
    ]

    print(f"Eventos 'frame-process' encontrados: {len(measure_events)}")

    if measure_events:
        print('\nUsando marcadores User Timing (frame-process)\n')

        complete_events = [e for e in measure_events if e.get('ph') == 'X' and e.get('dur') is not None]
        durations = []

        if complete_events:
            durations = [e['dur'] / 1000 for e in complete_events]
            print(f'Eventos completos (ph=X): {len(durations)}')
            frame_events = complete_events
        else:
            begin_events = sorted([e for e in measure_events if e.get('ph') == 'b'], key=lambda x: x['ts'])
            end_events = sorted([e for e in measure_events if e.get('ph') == 'e'], key=lambda x: x['ts'])

            print(f'Eventos begin/end: {len(begin_events)} begin, {len(end_events)} end')

            for i in range(min(len(begin_events), len(end_events))):
                duration = (end_events[i]['ts'] - begin_events[i]['ts']) / 1000
                durations.append(duration)

            frame_events = begin_events

        if durations:
            avg_duration = np.mean(durations)
            min_duration = np.min(durations)
            max_duration = np.max(durations)
            theoretical_max_fps = 1000 / avg_duration

            results['frame_duration'] = {
                'avg_duration': avg_duration,
                'min_duration': min_duration,
                'max_duration': max_duration,
                'theoretical_max_fps': theoretical_max_fps
            }
            results['durations'] = durations
    else:
        print('Nenhum marcador User Timing encontrado.')
        print('Usando eventos genéricos de FunctionCall...\n')

        frame_events = [
            e for e in events
            if e.get('name') in ['FunctionCall', 'EvaluateScript', 'v8.run']
            or (e.get('cat') and 'devtools.timeline' in e.get('cat', '') and e.get('name') == 'FunctionCall')
        ]

    timestamps = sorted([e['ts'] / 1000 for e in frame_events if e.get('ts')])

    if len(timestamps) < 2:
        print('Eventos de frame insuficientes para análise')
        print(f'Total de eventos no trace: {len(events)}')
        print(f'Eventos de frame encontrados: {len(frame_events)}')

        event_names = set(e.get('name') for e in events if e.get('name'))
        print(f'\nTipos de eventos únicos (primeiros 20):')
        for name in sorted(event_names)[:20]:
            print(f'  - {name}')
        return None

    intervals = [timestamps[i] - timestamps[i-1] for i in range(1, len(timestamps))]

    avg_interval = np.mean(intervals)
    avg_fps = 1000 / avg_interval

    min_interval = np.min(intervals)
    max_interval = np.max(intervals)
    min_fps = 1000 / max_interval
    max_fps = 1000 / min_interval

    duration = (timestamps[-1] - timestamps[0]) / 1000
    total_frames = len(timestamps)
    effective_fps = total_frames / duration

    results['fps_analysis'] = {
        'duration': duration,
        'total_frames': total_frames,
        'effective_fps': effective_fps,
        'avg_fps': avg_fps,
        'min_fps': min_fps,
        'max_fps': max_fps,
        'avg_interval': avg_interval,
        'min_interval': min_interval,
        'max_interval': max_interval
    }

    buckets = {'<10': 0, '10-15': 0, '15-20': 0, '20-30': 0, '>30': 0}
    for interval in intervals:
        fps = 1000 / interval
        if fps < 10:
            buckets['<10'] += 1
        elif fps < 15:
            buckets['10-15'] += 1
        elif fps < 20:
            buckets['15-20'] += 1
        elif fps < 30:
            buckets['20-30'] += 1
        else:
            buckets['>30'] += 1

    results['fps_distribution'] = buckets
    results['timestamps'] = timestamps
    results['intervals'] = intervals

    return results


def print_analysis_results(results):
    """
    Imprime resultados da análise no console.

    Args:
        results (dict): Dicionário com resultados da análise.
    """
    print(f"Analisando: {results['trace_file']}\n")

    if results.get('monitor_info'):
        monitor = results['monitor_info']
        print('=== Monitor Info ===')
        print(f"FPS Alvo Configurado: {results['configured_target_fps']} FPS")
        print(f"Taxa de atualização detectada: ~{monitor['refresh_rate']} Hz ({monitor['avg_vsync_interval']:.2f}ms por frame)")
        print()

    if results.get('frame_duration'):
        dur = results['frame_duration']
        print('=== Análise de Duração de Frame ===')
        print(f"Duração média: {dur['avg_duration']:.2f}ms")
        print(f"Duração mínima: {dur['min_duration']:.2f}ms")
        print(f"Duração máxima: {dur['max_duration']:.2f}ms")
        print(f"FPS máximo teórico: ~{dur['theoretical_max_fps']:.2f} FPS (baseado na duração média)")
        print()

    fps = results['fps_analysis']
    print('=== Análise de FPS ===')
    print(f"Duração total: {fps['duration']:.2f}s")
    print(f"Total de frames: {fps['total_frames']}")
    print(f"\nFPS médio (efetivo): {fps['effective_fps']:.2f}")
    print(f"FPS médio (intervalos): {fps['avg_fps']:.2f}")
    print(f"FPS mínimo: {fps['min_fps']:.2f}")
    print(f"FPS máximo: {fps['max_fps']:.2f}")
    print(f"\nIntervalo médio entre frames: {fps['avg_interval']:.2f}ms")
    print(f"Intervalo mínimo: {fps['min_interval']:.2f}ms")
    print(f"Intervalo máximo: {fps['max_interval']:.2f}ms")

    dist = results['fps_distribution']
    total = sum(dist.values())
    print('\n=== Distribuição de FPS ===')
    for range_label, count in dist.items():
        pct = (count / total) * 100 if total > 0 else 0
        bar = '█' * round((count / total) * 50) if total > 0 else ''
        print(f'{range_label.ljust(8)} FPS: {bar} {pct:.1f}% ({count} frames)')


def generate_plots(results, output_path, output_format='png'):
    """
    Gera gráficos de análise de performance.

    Args:
        results (dict): Dicionário com resultados da análise.
        output_path (str): Caminho base para salvar gráficos.
        output_format (str): Formato de saída: 'png', 'svg', ou 'both'.
    """
    sns.set_theme(style='whitegrid')

    intervals = results['intervals']
    fps_values = [1000 / interval for interval in intervals]
    frame_indices = list(range(len(fps_values)))

    configured_fps = results.get('configured_target_fps', 30)
    fps_analysis = results['fps_analysis']
    buckets = results['fps_distribution']
    durations = results.get('durations', [])

    fig1, ax1 = plt.subplots(figsize=(12, 8))
    ax1.plot(frame_indices, fps_values, color='#1f77b4', linewidth=2, label='FPS')
    ax1.axhline(y=configured_fps, color='#d62728', linestyle='--', linewidth=2,
                label=f'FPS Alvo ({configured_fps})')
    ax1.set_xlabel('Índice do Frame', fontsize=12)
    ax1.set_ylabel('FPS', fontsize=12)
    ax1.set_title('FPS ao Longo do Tempo', fontsize=16, fontweight='bold')
    ax1.legend(loc='upper right')
    ax1.grid(True, alpha=0.3)
    plt.tight_layout()

    fig2, ax2 = plt.subplots(figsize=(12, 8))
    ax2.hist(fps_values, bins=30, color='#ff7f0e', alpha=0.7, edgecolor='black')
    ax2.set_xlabel('FPS', fontsize=12)
    ax2.set_ylabel('Frequência', fontsize=12)
    ax2.set_title('Distribuição de FPS', fontsize=16, fontweight='bold')
    ax2.grid(True, alpha=0.3)
    plt.tight_layout()

    fig3, ax3 = plt.subplots(figsize=(12, 8))
    bucket_labels = list(buckets.keys())
    bucket_values = list(buckets.values())
    bars = ax3.bar(bucket_labels, bucket_values, color='#2ca02c', alpha=0.7, edgecolor='black')
    for i, bar in enumerate(bars):
        height = bar.get_height()
        ax3.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(height)} frames',
                ha='center', va='bottom', fontsize=10)
    ax3.set_xlabel('Faixa de FPS', fontsize=12)
    ax3.set_ylabel('Número de Frames', fontsize=12)
    ax3.set_title('Distribuição por Buckets', fontsize=16, fontweight='bold')
    ax3.grid(True, alpha=0.3, axis='y')
    plt.tight_layout()

    figures = [
        (fig1, 'fps_timeline'),
        (fig2, 'fps_distribution'),
        (fig3, 'fps_buckets')
    ]

    if durations:
        fig4, ax4 = plt.subplots(figsize=(12, 8))
        duration_indices = list(range(len(durations)))
        ax4.plot(duration_indices, durations, color='#9467bd', linewidth=2, label='Duração (ms)')
        ax4.set_xlabel('Índice do Frame', fontsize=12)
        ax4.set_ylabel('Duração (ms)', fontsize=12)
        ax4.set_title('Duração de Processamento por Frame', fontsize=16, fontweight='bold')
        ax4.legend(loc='upper right')
        ax4.grid(True, alpha=0.3)
        plt.tight_layout()
        figures.append((fig4, 'frame_duration'))

    base_path = Path(output_path)
    base_dir = base_path.parent
    base_name = base_path.stem

    os.makedirs(base_dir, exist_ok=True)

    formats_to_save = ['png', 'svg'] if output_format == 'both' else [output_format]

    for fig, name in figures:
        for fmt in formats_to_save:
            file_path = base_dir / f"{base_name}_{name}.{fmt}"
            try:
                fig.savefig(file_path, dpi=300, bbox_inches='tight', format=fmt)
                print(f'Gráfico {name} salvo: {file_path}')
            except Exception as e:
                print(f'Erro ao salvar gráfico {name} como {fmt}: {e}')
        plt.close(fig)


def generate_report(results, output_path):
    """
    Gera relatório detalhado em formato Markdown da análise de trace.

    Args:
        results (dict): Dicionário com resultados da análise.
        output_path (str): Caminho para salvar o relatório.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    trace_file = os.path.basename(results['trace_file'])

    report_content = f"""# Relatório de Análise de Performance - Chrome Trace

**Data da Análise:** {timestamp}
**Arquivo de Trace:** `{trace_file}`

## Resumo Executivo

Este relatório apresenta a análise de performance de frames capturados via Chrome DevTools Performance Trace, com foco em métricas de FPS (Frames Per Second) e tempo de processamento.

## Configuração do Sistema

"""

    fps_target = results.get('configured_target_fps', 'N/A')
    report_content += f"**FPS Alvo Configurado:** {fps_target} FPS\n\n"

    if results.get('monitor_info'):
        monitor = results['monitor_info']
        report_content += f"""### Informações do Monitor

| Métrica | Valor |
|---------|-------|
| **Taxa de Atualização** | ~{monitor['refresh_rate']} Hz |
| **Intervalo Médio VSync** | {monitor['avg_vsync_interval']:.2f} ms |

"""

    if results.get('frame_duration'):
        dur = results['frame_duration']
        report_content += f"""## Análise de Duração de Processamento

### Métricas de Duração de Frame

| Métrica | Valor |
|---------|-------|
| **Duração Média** | {dur['avg_duration']:.2f} ms |
| **Duração Mínima** | {dur['min_duration']:.2f} ms |
| **Duração Máxima** | {dur['max_duration']:.2f} ms |
| **FPS Máximo Teórico** | ~{dur['theoretical_max_fps']:.2f} FPS |

**Interpretação:**
- A duração média de {dur['avg_duration']:.2f} ms por frame permite teoricamente até {dur['theoretical_max_fps']:.2f} FPS
- Variação de duração: {dur['min_duration']:.2f} ms a {dur['max_duration']:.2f} ms indica {'consistência alta' if (dur['max_duration'] - dur['min_duration']) < 20 else 'variabilidade moderada' if (dur['max_duration'] - dur['min_duration']) < 50 else 'variabilidade alta'}
- {'Performance otimizada' if dur['avg_duration'] < 16.67 else 'Performance adequada para 30 FPS' if dur['avg_duration'] < 33.33 else 'Possível gargalo de performance detectado'}

"""

    fps = results['fps_analysis']
    report_content += f"""## Análise de FPS (Frames Per Second)

### Métricas Gerais

| Métrica | Valor |
|---------|-------|
| **Duração Total da Captura** | {fps['duration']:.2f} segundos |
| **Total de Frames Processados** | {fps['total_frames']:,} |
| **FPS Médio (Efetivo)** | {fps['effective_fps']:.2f} |
| **FPS Médio (por Intervalos)** | {fps['avg_fps']:.2f} |
| **FPS Mínimo** | {fps['min_fps']:.2f} |
| **FPS Máximo** | {fps['max_fps']:.2f} |

### Intervalos Entre Frames

| Métrica | Valor |
|---------|-------|
| **Intervalo Médio** | {fps['avg_interval']:.2f} ms |
| **Intervalo Mínimo** | {fps['min_interval']:.2f} ms |
| **Intervalo Máximo** | {fps['max_interval']:.2f} ms |

### Avaliação de Performance

"""

    avg_fps = fps['effective_fps']
    target_fps = results.get('configured_target_fps', 30)

    if avg_fps >= target_fps * 1.5:
        assessment = f"**Excelente**: FPS médio ({avg_fps:.2f}) está significativamente acima do alvo ({target_fps})"
    elif avg_fps >= target_fps:
        assessment = f"**Bom**: FPS médio ({avg_fps:.2f}) atende ou supera o alvo ({target_fps})"
    elif avg_fps >= target_fps * 0.8:
        assessment = f"**Adequado**: FPS médio ({avg_fps:.2f}) está próximo do alvo ({target_fps}), com margem de otimização"
    else:
        assessment = f"**Abaixo do Esperado**: FPS médio ({avg_fps:.2f}) está significativamente abaixo do alvo ({target_fps})"

    report_content += f"{assessment}\n\n"

    dist = results['fps_distribution']
    total_frames = sum(dist.values())

    report_content += f"""## Distribuição de FPS

### Por Faixas

| Faixa de FPS | Frames | Percentual |
|--------------|--------|------------|
| **< 10 FPS** | {dist['<10']:,} | {(dist['<10']/total_frames*100):.1f}% |
| **10-15 FPS** | {dist['10-15']:,} | {(dist['10-15']/total_frames*100):.1f}% |
| **15-20 FPS** | {dist['15-20']:,} | {(dist['15-20']/total_frames*100):.1f}% |
| **20-30 FPS** | {dist['20-30']:,} | {(dist['20-30']/total_frames*100):.1f}% |
| **> 30 FPS** | {dist['>30']:,} | {(dist['>30']/total_frames*100):.1f}% |

### Análise da Distribuição

"""

    high_fps_pct = (dist['>30'] / total_frames * 100) if total_frames > 0 else 0
    low_fps_pct = ((dist['<10'] + dist['10-15']) / total_frames * 100) if total_frames > 0 else 0

    if high_fps_pct >= 95:
        dist_assessment = f"Distribuição excelente com {high_fps_pct:.1f}% dos frames acima de 30 FPS"
    elif high_fps_pct >= 80:
        dist_assessment = f"Boa distribuição com {high_fps_pct:.1f}% dos frames acima de 30 FPS"
    elif high_fps_pct >= 60:
        dist_assessment = f"Distribuição moderada com {high_fps_pct:.1f}% dos frames acima de 30 FPS"
    else:
        dist_assessment = f"Distribuição irregular - apenas {high_fps_pct:.1f}% dos frames acima de 30 FPS"

    report_content += f"- {dist_assessment}\n"

    if low_fps_pct > 5:
        report_content += f"- **Atenção**: {low_fps_pct:.1f}% dos frames abaixo de 15 FPS podem causar percepção de travamentos\n"

    report_content += f"\n"

    report_content += f"""## Recomendações

### Otimização de Performance

"""

    if avg_fps < target_fps:
        report_content += f"- **Prioridade Alta**: FPS médio abaixo do alvo - investigar gargalos de processamento\n"

    if fps.get('max_interval', 0) > 100:
        report_content += f"- **Frame Drops Detectados**: Intervalo máximo de {fps['max_interval']:.2f} ms indica travamentos pontuais\n"

    if results.get('frame_duration'):
        dur = results['frame_duration']
        if dur['max_duration'] > dur['avg_duration'] * 2:
            report_content += f"- **Variabilidade Alta**: Picos de duração até {dur['max_duration']:.2f} ms - considerar otimização de código assíncrono\n"

    if high_fps_pct < 90:
        report_content += f"- Melhorar consistência do frame rate - atualmente {high_fps_pct:.1f}% acima de 30 FPS\n"

    report_content += f"""
### Próximos Passos

1. Revisar código de processamento de frames para identificar gargalos
2. Analisar traces adicionais em diferentes condições de carga
3. Implementar throttling ou frame skipping se necessário
4. Monitorar métricas após otimizações

## Gráficos Gerados

Os seguintes gráficos foram gerados para visualização detalhada:

- **fps_timeline**: Linha temporal de FPS ao longo da execução com linha de FPS alvo
- **fps_distribution**: Histograma de distribuição de FPS
- **fps_buckets**: Distribuição por faixas de FPS
"""

    if results.get('durations'):
        report_content += "- **frame_duration**: Duração de processamento por frame\n"

    report_content += f"""
## Conclusão

"""

    if avg_fps >= target_fps and high_fps_pct >= 90:
        conclusion = f"A aplicação demonstra performance excelente, mantendo consistentemente FPS acima do alvo de {target_fps}. O sistema está bem otimizado para a carga atual."
    elif avg_fps >= target_fps * 0.9:
        conclusion = f"A aplicação apresenta performance adequada, com FPS médio próximo ao alvo de {target_fps}. Existem oportunidades de otimização para maior consistência."
    else:
        conclusion = f"A aplicação apresenta performance abaixo do esperado, com FPS médio de {avg_fps:.2f} contra alvo de {target_fps}. Recomenda-se investigação e otimização prioritária."

    report_content += f"{conclusion}\n\n"

    report_content += f"""---
*Relatório gerado automaticamente pelo analyze-trace.py em {timestamp}*
"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report_content)

    print(f"Relatório salvo em: {output_path}")


def parse_args():
    """
    Parser de argumentos CLI.

    Returns:
        argparse.Namespace: Argumentos parseados.
    """
    parser = argparse.ArgumentParser(
        description='Analisa arquivos de trace do Chrome DevTools para métricas de FPS e performance.'
    )
    parser.add_argument(
        'trace_file',
        help='Caminho para o arquivo de trace JSON'
    )
    parser.add_argument(
        '--output', '-o',
        default='output',
        help='Diretório para salvar os gráficos (padrão: output)'
    )
    parser.add_argument(
        '--format',
        choices=['png', 'svg', 'both'],
        default='png',
        help='Formato dos gráficos: png, svg, ou both (padrão: png)'
    )
    parser.add_argument(
        '--no-plot',
        action='store_true',
        help='Desabilita geração de gráficos (apenas análise textual)'
    )
    parser.add_argument(
        '--generate-report',
        action='store_true',
        default=True,
        help='Gerar relatório em markdown (padrão: True)'
    )
    parser.add_argument(
        '--no-report',
        action='store_true',
        help='Não gerar relatório em markdown'
    )

    return parser.parse_args()


def main():
    """
    Função principal do script.
    """
    args = parse_args()

    if not os.path.exists(args.trace_file):
        print(f'Erro: Arquivo não encontrado: {args.trace_file}')
        return 1

    configured_target_fps = get_configured_target_fps()
    if configured_target_fps is None:
        print('Aviso: Não foi possível ler o FPS alvo configurado. Usando 30 FPS como padrão.')
        configured_target_fps = 30

    results = analyze_trace(args.trace_file, configured_target_fps)

    if results is None:
        return 1

    print_analysis_results(results)

    timestamp = datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
    base_filename = f'trace_analysis_{timestamp}'
    output_dir = Path(args.output)

    os.makedirs(output_dir, exist_ok=True)

    generate_report_flag = args.generate_report and not args.no_report

    if not args.no_plot:
        print('\n=== Gerando Plots ===')
        output_path = output_dir / base_filename

        try:
            generate_plots(results, str(output_path), args.format)
            print(f'\nPlots salvos em: {args.output}')
        except Exception as e:
            print(f'Erro ao gerar plots: {e}')
            return 1

    if generate_report_flag:
        print('\n=== Gerando Relatório ===')
        report_path = output_dir / f'{base_filename}.md'

        try:
            generate_report(results, str(report_path))
        except Exception as e:
            print(f'Erro ao gerar relatório: {e}')
            return 1

    if not args.no_plot or generate_report_flag:
        print(f'\nAnálise completa! Arquivos salvos em: {args.output}')

    return 0


if __name__ == '__main__':
    exit(main())
