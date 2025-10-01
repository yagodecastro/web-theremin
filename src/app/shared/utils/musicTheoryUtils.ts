import { Note as TonalNote, Range, Scale } from 'tonal'

/** @description Gera uma escala MIDI a partir de um nome de escala, oitava e alcance. */
export function generateMidiScale(
  scaleName: string,
  baseOctave: number,
  range: number = 12
): (number | null)[] {
  try {
    const scaleFullName = `C${baseOctave} ${scaleName}`
    const scale = Scale.get(scaleFullName)
    if (!scale.notes || scale.notes.length === 0) {
      throw new Error(`Escala inválida: ${scaleFullName}`)
    }
    const notes = Range.numeric([-range, range]).map(Scale.steps(scale.name))
    const midiNotes = notes.map(note => TonalNote.get(note).midi)
    const validNotes = midiNotes.filter(note => note !== null)
    if (validNotes.length === 0) {
      throw new Error('Nenhuma nota MIDI válida gerada')
    }
    return midiNotes
  } catch (error) {
    console.error(`Erro ao gerar escala MIDI para "${scaleName}", usando fallback.`, error)
    const fallbackScale = Scale.get(`C${baseOctave} major`)
    const notes = Range.numeric([-12, 12]).map(Scale.steps(fallbackScale.name))
    return notes.map(note => TonalNote.get(note).midi)
  }
}