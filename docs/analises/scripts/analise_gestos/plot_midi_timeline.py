import argparse
import json
import os
from datetime import datetime

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
import numpy as np


def plot_midi_timeline_per_section(csv_file, plan_file, output_dir, output_format="png"):
    """
    Generates a separate timeline plot for each gesture section defined in the plan.
    Each plot shows only the specific MIDI data type expected for that gesture.

    Args:
        csv_file (str): Path to the input MIDI CSV file.
        plan_file (str): Path to the JSON gesture plan file.
        output_dir (str): Directory to save the output plot images.
    """
    try:
        df = pd.read_csv(csv_file)
        with open(plan_file, "r") as f:
            plan = json.load(f)
    except FileNotFoundError as e:
        print(f"Error: File not found - {e.filename}")
        return

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created output directory: {output_dir}")

    # --- Data Preparation ---
    df = df.dropna(subset=["type", "timestamp_s"])

    # --- Gesture Plan Processing ---
    bpm = plan.get("bpm", 120)
    beat_duration_s = 60.0 / bpm
    gesture_plan = plan.get("gestures", [])
    midi_start_offset = df["timestamp_s"].min()

    # --- Group sections by time range to handle simultaneous gestures ---
    sections_by_time = {}
    for i, item in enumerate(gesture_plan):
        time_range = item["time_range_beats"]
        time_key = f"{time_range['start']}-{time_range['end']}"

        if time_key not in sections_by_time:
            sections_by_time[time_key] = []
        sections_by_time[time_key].append((i, item))

    # --- Generate plots for each time range ---
    for time_key, sections in sections_by_time.items():
        if len(sections) == 1:
            # Single section - use existing logic
            i, item = sections[0]
            time_range = item["time_range_beats"]
            start_s = midi_start_offset + (time_range["start"] - 1) * beat_duration_s
            end_s = midi_start_offset + (time_range["end"] - 1) * beat_duration_s
            gesture_name = item["gesture"]
            expected_midi = item.get("expected_midi", {})

            section_data = df[
                (df["timestamp_s"] >= start_s) & (df["timestamp_s"] <= end_s)
            ]

            if expected_midi.get("type") == "note_on":
                plot_data = section_data[section_data["type"] == "note_on"]
                if plot_data.empty:
                    print(f'⚠️  Section "{gesture_name}" skipped as it contains no note_on events.')
                    continue
                _plot_note_on_section(plot_data, gesture_name, start_s, end_s, output_dir, i, output_format)

            elif expected_midi.get("type") == "control_change":
                control_num = expected_midi.get("control")
                if control_num is not None:
                    plot_data = section_data[
                        (section_data["type"] == "control_change") &
                        (section_data["control"] == control_num)
                    ]
                    if plot_data.empty:
                        print(f'⚠️  Section "{gesture_name}" skipped as it contains no CC{control_num} events.')
                        continue
                    _plot_control_change_section(plot_data, gesture_name, control_num, start_s, end_s, output_dir, i, output_format)
                else:
                    print(f'⚠️  Section "{gesture_name}" skipped - no control number specified.')
                    continue
            else:
                print(f'⚠️  Section "{gesture_name}" skipped - unknown expected MIDI type.')
                continue

        else:
            # Multiple simultaneous sections - combine them
            time_range = sections[0][1]["time_range_beats"]
            start_s = midi_start_offset + (time_range["start"] - 1) * beat_duration_s
            end_s = midi_start_offset + (time_range["end"] - 1) * beat_duration_s

            section_data = df[
                (df["timestamp_s"] >= start_s) & (df["timestamp_s"] <= end_s)
            ]

            _plot_simultaneous_sections(sections, section_data, start_s, end_s, output_dir, output_format)

    print("\nAll sections processed.")


def _plot_note_on_section(plot_data, gesture_name, start_s, end_s, output_dir, section_index, output_format="png"):
    """Plot section with only note_on events."""
    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(figsize=(15, 8))

    ax.scatter(
        plot_data["timestamp_s"],
        plot_data["note"],
        alpha=0.8,
        label="Note On Events",
        marker="|",
        s=250,
        color="#1f77b4",
        zorder=2,
    )

    ax.set_xlabel("Time (seconds)", fontsize=12)
    ax.set_ylabel("MIDI Note (Pitch)", fontsize=12)
    ax.set_ylim(20, 100)
    ax.set_xlim(start_s - 0.5, end_s + 0.5)
    ax.legend(loc="upper right")

    fig.suptitle(f'Test Section: {gesture_name}', fontsize=18, weight="bold")
    plt.tight_layout(rect=[0, 0, 1, 0.95])

    safe_gesture_name = gesture_name.replace(" ", "_").replace("/", "_").lower()

    formats_to_save = []
    if output_format == "both":
        formats_to_save = ["svg", "png"]
    else:
        formats_to_save = [output_format]

    for fmt in formats_to_save:
        output_file = os.path.join(
            output_dir, f"section_{section_index+1}_{safe_gesture_name}.{fmt}"
        )
        try:
            plt.savefig(output_file, dpi=300, bbox_inches="tight", format=fmt)
            print(f'✅ Chart for section "{gesture_name}" saved to: {output_file}')
        except Exception as e:
            print(f'❌ Error saving chart for section "{gesture_name}" as {fmt}: {e}')

    plt.close(fig)


def _plot_control_change_section(plot_data, gesture_name, control_num, start_s, end_s, output_dir, section_index, output_format="png"):
    """Plot section with only specific control change events."""
    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(figsize=(15, 8))

    ax.plot(
        plot_data["timestamp_s"],
        plot_data["value"],
        label=f"CC {int(control_num)}",
        alpha=0.8,
        color="#ff7f0e",
        linewidth=2,
        zorder=2,
    )

    ax.set_xlabel("Time (seconds)", fontsize=12)
    ax.set_ylabel(f"Control Change {int(control_num)} Value (0-127)", fontsize=12)
    ax.set_ylim(0, 128)
    ax.set_xlim(start_s - 0.5, end_s + 0.5)
    ax.legend(loc="upper right")

    fig.suptitle(f'Test Section: {gesture_name}', fontsize=18, weight="bold")
    plt.tight_layout(rect=[0, 0, 1, 0.95])

    safe_gesture_name = gesture_name.replace(" ", "_").replace("/", "_").lower()

    formats_to_save = []
    if output_format == "both":
        formats_to_save = ["svg", "png"]
    else:
        formats_to_save = [output_format]

    for fmt in formats_to_save:
        output_file = os.path.join(
            output_dir, f"section_{section_index+1}_{safe_gesture_name}.{fmt}"
        )
        try:
            plt.savefig(output_file, dpi=300, bbox_inches="tight", format=fmt)
            print(f'✅ Chart for section "{gesture_name}" saved to: {output_file}')
        except Exception as e:
            print(f'❌ Error saving chart for section "{gesture_name}" as {fmt}: {e}')

    plt.close(fig)


def _plot_simultaneous_sections(sections, section_data, start_s, end_s, output_dir, output_format="png"):
    """Plot multiple simultaneous sections in a single chart."""
    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(figsize=(15, 8))

    # Collect all control change data for simultaneous sections
    cc_data_list = []
    gesture_names = []

    for i, item in sections:
        expected_midi = item.get("expected_midi", {})
        gesture_name = item["gesture"]
        gesture_names.append(gesture_name)

        if expected_midi.get("type") == "control_change":
            control_num = expected_midi.get("control")
            if control_num is not None:
                plot_data = section_data[
                    (section_data["type"] == "control_change") &
                    (section_data["control"] == control_num)
                ]
                if not plot_data.empty:
                    cc_data_list.append((plot_data, control_num, gesture_name))

    if not cc_data_list:
        print(f'⚠️  Simultaneous sections skipped - no valid control change data found.')
        plt.close(fig)
        return

    # Plot each control change with different colors
    colors = ["#ff7f0e", "#2ca02c"]  # Orange for CC1, Green for CC11

    for idx, (plot_data, control_num, gesture_name) in enumerate(cc_data_list):
        color = colors[idx] if idx < len(colors) else f"C{idx}"

        ax.plot(
            plot_data["timestamp_s"],
            plot_data["value"],
            label=f"CC {int(control_num)} ({gesture_name.split(' - ')[1]})",
            alpha=0.8,
            color=color,
            linewidth=2,
            zorder=2,
        )

    ax.set_xlabel("Time (seconds)", fontsize=12)
    ax.set_ylabel("Control Change Value (0-127)", fontsize=12)
    ax.set_ylim(0, 128)
    ax.set_xlim(start_s - 0.5, end_s + 0.5)
    ax.legend(loc="upper right")

    # Create combined title
    combined_title = "Simultaneous Gestures: " + " + ".join([name.split(' - ')[1] for name in gesture_names])
    fig.suptitle(combined_title, fontsize=18, weight="bold")
    plt.tight_layout(rect=[0, 0, 1, 0.95])

    # Save the plot with combined name
    time_range = sections[0][1]["time_range_beats"]
    safe_name = f"section_simultaneous_beats_{time_range['start']}-{time_range['end']}"

    formats_to_save = []
    if output_format == "both":
        formats_to_save = ["svg", "png"]
    else:
        formats_to_save = [output_format]

    for fmt in formats_to_save:
        output_file = os.path.join(output_dir, f"{safe_name}.{fmt}")
        try:
            plt.savefig(output_file, dpi=300, bbox_inches="tight", format=fmt)
            print(f'✅ Chart for simultaneous sections saved to: {output_file}')
        except Exception as e:
            print(f'❌ Error saving chart for simultaneous sections as {fmt}: {e}')

    plt.close(fig)


def analyze_gesture_detection(csv_file, plan_file):
    """
    Analyzes gesture detection performance by section.

    Args:
        csv_file (str): Path to the input MIDI CSV file.
        plan_file (str): Path to the JSON gesture plan file.

    Returns:
        dict: Analysis results with detection metrics per section.
    """
    try:
        df = pd.read_csv(csv_file)
        with open(plan_file, "r") as f:
            plan = json.load(f)
    except FileNotFoundError as e:
        print(f"Error: File not found - {e.filename}")
        return {}

    # Data preparation
    df = df.dropna(subset=["type", "timestamp_s"])

    # Gesture plan processing
    bpm = plan.get("bpm", 120)
    beat_duration_s = 60.0 / bpm
    gesture_plan = plan.get("gestures", [])
    midi_start_offset = df["timestamp_s"].min()

    analysis_results = {
        "total_events": len(df),
        "total_duration_s": df["timestamp_s"].max() - df["timestamp_s"].min(),
        "bpm": bpm,
        "sections": [],
        "summary": {}
    }

    # Group sections by time range
    sections_by_time = {}
    for i, item in enumerate(gesture_plan):
        time_range = item["time_range_beats"]
        time_key = f"{time_range['start']}-{time_range['end']}"

        if time_key not in sections_by_time:
            sections_by_time[time_key] = []
        sections_by_time[time_key].append((i, item))

    # Analyze each section
    for time_key, sections in sections_by_time.items():
        if len(sections) == 1:
            i, item = sections[0]
            time_range = item["time_range_beats"]
            start_s = midi_start_offset + (time_range["start"] - 1) * beat_duration_s
            end_s = midi_start_offset + (time_range["end"] - 1) * beat_duration_s
            gesture_name = item["gesture"]
            expected_midi = item.get("expected_midi", {})
            attempts = item.get("attempts", 16)

            section_data = df[
                (df["timestamp_s"] >= start_s) & (df["timestamp_s"] <= end_s)
            ]

            section_analysis = {
                "section_index": i + 1,
                "gesture_name": gesture_name,
                "time_range_beats": time_range,
                "time_range_s": {"start": start_s, "end": end_s},
                "expected_attempts": attempts,
                "total_events": len(section_data),
                "detected_events": 0,
                "detection_rate": 0.0,
                "event_type": expected_midi.get("type", "unknown"),
                "value_range": {},
                "notes": []
            }

            if expected_midi.get("type") == "note_on":
                note_events = section_data[section_data["type"] == "note_on"]
                section_analysis["detected_events"] = len(note_events)
                section_analysis["detection_rate"] = len(note_events) / attempts if attempts > 0 else 0

                if not note_events.empty:
                    unique_notes = note_events["note"].unique()
                    section_analysis["value_range"] = {
                        "notes": unique_notes.tolist(),
                        "min_note": int(unique_notes.min()),
                        "max_note": int(unique_notes.max())
                    }

            elif expected_midi.get("type") == "control_change":
                control_num = expected_midi.get("control")
                if control_num is not None:
                    cc_events = section_data[
                        (section_data["type"] == "control_change") &
                        (section_data["control"] == control_num)
                    ]
                    section_analysis["detected_events"] = len(cc_events)
                    section_analysis["control_number"] = control_num

                    if not cc_events.empty:
                        values = cc_events["value"].values
                        section_analysis["value_range"] = {
                            "min_value": int(values.min()),
                            "max_value": int(values.max()),
                            "mean_value": float(values.mean()),
                            "std_value": float(values.std()),
                            "coverage_percentage": ((values.max() - values.min()) / 127) * 100
                        }

                        # Calculate detection rate based on value changes
                        value_changes = len(np.where(np.diff(values) != 0)[0]) + 1
                        section_analysis["detection_rate"] = min(value_changes / attempts, 1.0) if attempts > 0 else 0

            analysis_results["sections"].append(section_analysis)

        else:
            # Handle simultaneous sections
            time_range = sections[0][1]["time_range_beats"]
            start_s = midi_start_offset + (time_range["start"] - 1) * beat_duration_s
            end_s = midi_start_offset + (time_range["end"] - 1) * beat_duration_s

            section_data = df[
                (df["timestamp_s"] >= start_s) & (df["timestamp_s"] <= end_s)
            ]

            combined_analysis = {
                "section_index": f"simultaneous_{time_range['start']}-{time_range['end']}",
                "gesture_name": "Simultaneous: " + " + ".join([item[1]["gesture"].split(" - ")[1] for item in sections]),
                "time_range_beats": time_range,
                "time_range_s": {"start": start_s, "end": end_s},
                "total_events": len(section_data),
                "subsections": [],
                "event_type": "multiple"
            }

            for i, item in sections:
                expected_midi = item.get("expected_midi", {})
                attempts = item.get("attempts", 16)

                subsection_analysis = {
                    "gesture_name": item["gesture"],
                    "expected_attempts": attempts,
                    "detected_events": 0,
                    "detection_rate": 0.0
                }

                if expected_midi.get("type") == "control_change":
                    control_num = expected_midi.get("control")
                    if control_num is not None:
                        cc_events = section_data[
                            (section_data["type"] == "control_change") &
                            (section_data["control"] == control_num)
                        ]
                        subsection_analysis["detected_events"] = len(cc_events)
                        subsection_analysis["control_number"] = control_num

                        if not cc_events.empty:
                            values = cc_events["value"].values
                            value_changes = len(np.where(np.diff(values) != 0)[0]) + 1
                            subsection_analysis["detection_rate"] = min(value_changes / attempts, 1.0) if attempts > 0 else 0

                combined_analysis["subsections"].append(subsection_analysis)

            analysis_results["sections"].append(combined_analysis)

    # Calculate summary statistics
    total_attempts = sum(section.get("expected_attempts", 0) for section in analysis_results["sections"] if "expected_attempts" in section)
    total_attempts += sum(sub.get("expected_attempts", 0) for section in analysis_results["sections"] if "subsections" in section for sub in section["subsections"])

    detection_rates = []
    for section in analysis_results["sections"]:
        if "detection_rate" in section:
            detection_rates.append(section["detection_rate"])
        if "subsections" in section:
            detection_rates.extend([sub["detection_rate"] for sub in section["subsections"]])

    analysis_results["summary"] = {
        "total_planned_attempts": total_attempts,
        "average_detection_rate": np.mean(detection_rates) if detection_rates else 0,
        "sections_analyzed": len(analysis_results["sections"]),
        "best_detection_rate": max(detection_rates) if detection_rates else 0,
        "worst_detection_rate": min(detection_rates) if detection_rates else 0
    }

    return analysis_results


def generate_detection_report(analysis_results, csv_file, plan_file, output_path):
    """
    Generates a detailed Markdown report of gesture detection analysis.

    Args:
        analysis_results (dict): Results from analyze_gesture_detection.
        csv_file (str): Path to the original CSV file.
        plan_file (str): Path to the original plan file.
        output_path (str): Path to save the report.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    report_content = f"""# Relatório de Detecção de Gestos - Web Theremin

**Data da Análise:** {timestamp}
**Arquivo MIDI:** `{os.path.basename(csv_file)}`
**Plano de Gestos:** `{os.path.basename(plan_file)}`

## Resumo Executivo

Este relatório analisa a capacidade de detecção de gestos do Web Theremin, focando na quantidade e qualidade dos eventos MIDI detectados durante os testes estruturados de interação gestual.

## Metodologia de Detecção

- **BPM de Teste:** {analysis_results['bpm']}
- **Duração Total:** {analysis_results['total_duration_s']:.2f} segundos
- **Eventos MIDI Totais:** {analysis_results['total_events']:,}
- **Seções Analisadas:** {analysis_results['summary']['sections_analyzed']}
- **Tentativas Planejadas:** {analysis_results['summary']['total_planned_attempts']}

## Resultados por Seção

"""

    for section in analysis_results["sections"]:
        if "subsections" not in section:
            # Single section
            report_content += f"""### Seção {section['section_index']}: {section['gesture_name']}

**Configuração:**
- **Tipo de Evento:** {section['event_type'].replace('_', ' ').title()}
- **Período:** Beats {section['time_range_beats']['start']}-{section['time_range_beats']['end']} ({section['time_range_s']['start']:.2f}s - {section['time_range_s']['end']:.2f}s)
- **Tentativas Esperadas:** {section['expected_attempts']}

**Resultados de Detecção:**
- **Eventos Detectados:** {section['detected_events']}
- **Taxa de Detecção:** {section['detection_rate']:.1%}
- **Eventos Totais na Seção:** {section['total_events']}

"""

            if section['event_type'] == 'note_on' and section['value_range']:
                report_content += f"""**Análise de Notas MIDI:**
- **Notas Detectadas:** {section['value_range']['notes']}
- **Faixa de Notas:** {section['value_range']['min_note']} - {section['value_range']['max_note']}

"""
            elif section['event_type'] == 'control_change' and section['value_range']:
                report_content += f"""**Análise de Control Change (CC{section['control_number']}):**
- **Faixa de Valores:** {section['value_range']['min_value']} - {section['value_range']['max_value']} (de 0-127)
- **Valor Médio:** {section['value_range']['mean_value']:.1f}
- **Desvio Padrão:** {section['value_range']['std_value']:.1f}
- **Cobertura da Faixa MIDI:** {section['value_range']['coverage_percentage']:.1f}%

"""

            # Performance assessment
            if section['detection_rate'] >= 0.8:
                assessment = "Excelente - Detecção consistente e confiável"
            elif section['detection_rate'] >= 0.6:
                assessment = "Boa - Detecção adequada com potencial para otimização"
            elif section['detection_rate'] >= 0.4:
                assessment = "Moderada - Requer ajustes de calibração"
            else:
                assessment = "Baixa - Necessita revisão de sensibilidade"

            report_content += f"""**Avaliação:** {assessment}

"""

        else:
            # Simultaneous sections
            report_content += f"""### {section['section_index'].replace('_', ' ').title()}: {section['gesture_name']}

**Configuração:**
- **Período:** Beats {section['time_range_beats']['start']}-{section['time_range_beats']['end']} ({section['time_range_s']['start']:.2f}s - {section['time_range_s']['end']:.2f}s)
- **Eventos Totais na Seção:** {section['total_events']}

**Detecção por Gesto:**

"""
            for subsection in section['subsections']:
                cc_num = subsection.get('control_number', 'N/A')
                report_content += f"""- **{subsection['gesture_name']}** (CC{cc_num}):
  - Eventos Detectados: {subsection['detected_events']}
  - Taxa de Detecção: {subsection['detection_rate']:.1%}
  - Tentativas Esperadas: {subsection['expected_attempts']}

"""

    # Summary analysis
    summary = analysis_results['summary']
    report_content += f"""## Análise de Performance Geral

### Estatísticas de Detecção

| Métrica | Valor |
|---------|-------|
| **Taxa Média de Detecção** | {summary['average_detection_rate']:.1%} |
| **Melhor Performance** | {summary['best_detection_rate']:.1%} |
| **Pior Performance** | {summary['worst_detection_rate']:.1%} |
| **Tentativas Totais Planejadas** | {summary['total_planned_attempts']} |
| **Eventos MIDI Processados** | {analysis_results['total_events']:,} |

### Interpretação dos Resultados

"""

    avg_rate = summary['average_detection_rate']
    if avg_rate >= 0.8:
        interpretation = """O sistema demonstrou **excelente capacidade de detecção**, com alta consistência na captura de gestos planejados. A interface gestual está bem calibrada e responsiva."""
    elif avg_rate >= 0.6:
        interpretation = """O sistema apresentou **boa performance de detecção**, com resultados satisfatórios mas com espaço para otimização na sensibilidade de alguns tipos de gesto."""
    elif avg_rate >= 0.4:
        interpretation = """O sistema mostrou **performance moderada**, necessitando ajustes de calibração para melhorar a consistência na detecção de gestos."""
    else:
        interpretation = """O sistema apresentou **baixa performance de detecção**, requerendo revisão significativa dos parâmetros de sensibilidade e calibração."""

    report_content += f"""{interpretation}

## Recomendações de Calibração

### Para Melhoria da Detecção

"""

    # Analyze sections for specific recommendations
    note_on_sections = [s for s in analysis_results["sections"] if s.get("event_type") == "note_on"]
    cc_sections = [s for s in analysis_results["sections"] if s.get("event_type") == "control_change"]

    if note_on_sections:
        avg_note_detection = np.mean([s["detection_rate"] for s in note_on_sections])
        if avg_note_detection < 0.5:
            report_content += "- **Gestos de Pinça:** Aumentar sensibilidade de detecção para melhorar captura de eventos Note On\n"

    if cc_sections:
        for section in cc_sections:
            if section["detection_rate"] < 0.6:
                report_content += f"- **{section['gesture_name']}:** Ajustar parâmetros de Control Change para melhor responsividade\n"

    # General recommendations
    report_content += f"""
### Para Futuras Análises

- Testar com diferentes configurações de sensibilidade
- Analisar performance com múltiplos usuários
- Documentar configurações ótimas para reprodutibilidade
- Implementar calibração automática baseada em gestos de referência

## Conclusão

"""

    if avg_rate >= 0.7:
        conclusion = "A interface gestual demonstrou capacidade adequada de detecção, validando a eficácia da tecnologia para aplicações musicais interativas."
    else:
        conclusion = "A análise revela oportunidades significativas de melhoria na detecção gestual, com potencial para otimização através de ajustes de calibração."

    report_content += f"""{conclusion}

### Próximos Passos

1. Implementar ajustes baseados nas recomendações específicas
2. Realizar testes de validação com as novas configurações
3. Integrar resultados com análises de sincronização temporal
4. Documentar configurações finais para uso em produção

---
*Relatório gerado automaticamente pelo plot_midi_timeline.py em {timestamp}*
"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report_content)

    print(f"Relatório de detecção salvo em: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Generates timeline diagrams and detection analysis report for MIDI gesture data."
    )
    parser.add_argument("csv_file", help="Path to the .csv file with MIDI data.")
    parser.add_argument(
        "plan_file", help="Path to the .json file with the gesture plan."
    )
    parser.add_argument(
        "-o",
        "--output",
        default="plots",
        help="Directory to save the chart image files. Default: 'plots'",
    )
    parser.add_argument(
        "--format",
        choices=["png", "svg", "both"],
        default="png",
        help="Output format: png, svg, or both. Default: png",
    )
    parser.add_argument(
        "--generate-report",
        action="store_true",
        default=True,
        help="Generate detection analysis report in markdown format. Default: True",
    )
    parser.add_argument(
        "--no-report",
        action="store_true",
        help="Skip generating the detection report",
    )
    parser.add_argument(
        "--no-plots",
        action="store_true",
        help="Skip generating plot images",
    )

    args = parser.parse_args()

    # Determine what to generate
    generate_plots = not args.no_plots
    generate_report = args.generate_report and not args.no_report

    # Generate plots if requested
    if generate_plots:
        print("Generating timeline plots...")
        plot_midi_timeline_per_section(args.csv_file, args.plan_file, args.output, args.format)

    # Generate detection report if requested
    if generate_report:
        print("Analyzing gesture detection...")
        analysis_results = analyze_gesture_detection(args.csv_file, args.plan_file)

        if analysis_results:
            # Generate timestamp for report filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_filename = f"detection_analysis_{timestamp}.md"
            report_path = os.path.join(args.output, report_filename)

            # Ensure output directory exists
            os.makedirs(args.output, exist_ok=True)

            print("Generating detection analysis report...")
            generate_detection_report(analysis_results, args.csv_file, args.plan_file, report_path)
        else:
            print("Failed to analyze gesture detection data.")

    if generate_plots or generate_report:
        print(f"\nAll outputs saved to: {args.output}")
    else:
        print("No outputs generated. Use --help to see available options.")


if __name__ == "__main__":
    main()
