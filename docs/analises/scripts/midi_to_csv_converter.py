
import argparse
import mido
import csv
import os

def convert_midi_to_csv(input_path, output_path):
    """
    Converte um arquivo MIDI para um formato CSV detalhado, capturando os eventos mais comuns.
    """
    if not os.path.exists(input_path):
        print(f"Erro: Arquivo de entrada não encontrado em '{input_path}'")
        return

    try:
        mid = mido.MidiFile(input_path)
    except Exception as e:
        print(f"Erro ao ler o arquivo MIDI: {e}")
        return

    header = [
        'timestamp_s', 'type', 'channel', 'note', 'velocity', 
        'control', 'value', 'program'
    ]

    with open(output_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()

        absolute_time = 0.0
        for msg in mid:
            absolute_time += msg.time
            
            row = {
                'timestamp_s': round(absolute_time, 6),
                'type': msg.type,
                'channel': None,
                'note': None,
                'velocity': None,
                'control': None,
                'value': None,
                'program': None
            }

            if hasattr(msg, 'channel'):
                row['channel'] = msg.channel

            if msg.type in ['note_on', 'note_off']:
                row['note'] = msg.note
                row['velocity'] = msg.velocity
            elif msg.type == 'control_change':
                row['control'] = msg.control
                row['value'] = msg.value
            elif msg.type == 'program_change':
                row['program'] = msg.program
            
            writer.writerow(row)
            
    print(f"Conversão concluída com sucesso! Arquivo salvo em: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Converte um arquivo MIDI (.mid) para um arquivo CSV."
    )
    parser.add_argument(
        "input_file",
        help="Caminho para o arquivo .mid de entrada."
    )
    parser.add_argument(
        "-o", "--output",
        help="(Opcional) Caminho para o arquivo .csv de saída. Se não for fornecido, será criado na mesma pasta do arquivo de entrada."
    )
    args = parser.parse_args()

    # Define o nome do arquivo de saída se não for fornecido
    if args.output:
        output_file_path = args.output
    else:
        base_name = os.path.splitext(args.input_file)[0]
        output_file_path = f"{base_name}.csv"

    convert_midi_to_csv(args.input_file, output_file_path)
