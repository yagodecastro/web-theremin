import { Note as TonalNote, Range, Scale } from 'tonal'

/** @description Escalas curadas para uso no theremin. */
export const AVAILABLE_SCALES = [
  { value: 'minor pentatonic', label: 'Minor Pentatonic' },
  { value: 'major pentatonic', label: 'Major Pentatonic' },
  { value: 'minor', label: 'Natural Minor' },
  { value: 'major', label: 'Major' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'phrygian', label: 'Phrygian' },
  { value: 'lydian', label: 'Lydian' },
  { value: 'mixolydian', label: 'Mixolydian' },
  { value: 'blues', label: 'Blues' },
  { value: 'harmonic minor', label: 'Harmonic Minor' },
  { value: 'whole tone', label: 'Whole Tone' },
  { value: 'chromatic', label: 'Chromatic' }
]

/** @description 12 notas cromáticas para seleção de tônica. */
export const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** @description Gera uma escala MIDI a partir de tônica, escala, oitava central e número de oitavas. */
export function generateMidiScale(
  scaleName: string,
  tonic: string,
  baseOctave: number,
  octaveRange: number
): (number | null)[] {
  try {
    const scaleFullName = `${tonic}${baseOctave} ${scaleName}`
    const scale = Scale.get(scaleFullName)
    if (!scale.notes || scale.notes.length === 0) {
      throw new Error(`Escala inválida: ${scaleFullName}`)
    }
    const stepsPerOctave = scale.intervals.length
    const range = Math.ceil((stepsPerOctave * octaveRange) / 2)
    const notes = Range.numeric([-range, range]).map(Scale.steps(scale.name))
    const midiNotes = notes.map(note => TonalNote.get(note).midi)
    const validNotes = midiNotes.filter(note => note !== null)
    if (validNotes.length === 0) {
      throw new Error('Nenhuma nota MIDI válida gerada')
    }
    return midiNotes
  } catch (error) {
    console.error(
      `Erro ao gerar escala MIDI para "${tonic}${baseOctave} ${scaleName}", usando fallback.`,
      error
    )
    const fallbackScale = Scale.get(`A${baseOctave} minor pentatonic`)
    const stepsPerOctave = fallbackScale.intervals.length
    const range = Math.ceil((stepsPerOctave * octaveRange) / 2)
    const notes = Range.numeric([-range, range]).map(Scale.steps(fallbackScale.name))
    return notes.map(note => TonalNote.get(note).midi)
  }
}
