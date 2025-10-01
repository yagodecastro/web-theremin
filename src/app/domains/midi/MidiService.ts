import { Note, Output, WebMidi } from 'webmidi'
import { Note as TonalNote } from 'tonal'
import { generateMidiScale } from '@/app/shared/utils/musicTheoryUtils.ts'
import { IMidiService } from '@/app/domains/midi/IMidiService.ts'
import { MidiConfig } from '@/app/domains/midi/index.ts'

/** @description Serviço MIDI que converte gestos em notas musicais usando teoria musical. */
export class MidiService implements IMidiService {
  private output?: Output
  private isConnected = false
  private activeNotes: Set<number> = new Set()
  private midiScale: (number | null)[] = []

  constructor(private config: MidiConfig) {
    this.updateScale()
  }

  /** @description Habilita a API WebMIDI no navegador. */
  static async enableWebMidi(): Promise<void> {
    if (WebMidi.enabled) return
    try {
      await WebMidi.enable()
    } catch (error) {
      throw error
    }
  }

  /** @description Conecta a um dispositivo de saída MIDI. */
  async connect(deviceName?: string): Promise<void> {
    await MidiService.enableWebMidi()
    const targetDevice = deviceName
      ? WebMidi.outputs.find(output => output.name === deviceName)
      : WebMidi.outputs[0]
    if (!targetDevice) {
      throw new Error('Nenhum dispositivo MIDI encontrado')
    }
    this.output = targetDevice
    this.config.outputDevice = targetDevice.name
    this.isConnected = true
  }

  /** @description Converte a posição do gesto em uma nota musical. */
  gestureToNote(
    x: number,
    y: number
  ): { note: number | null; velocity: number; noteValue: number } {
    const noteValue = (1 - x) * this.midiScale.length
    const noteIndex = Math.floor(noteValue)
    const velocity = Math.floor((1 - y) * 100) + 27 // 27-127
    return { note: this.midiScale[noteIndex], velocity, noteValue }
  }

  /** @description Toca uma nota MIDI. */
  playNote(gestureX: number, gestureY: number, intensity: number = 1): void {
    if (!this.isConnected || !this.output) return
    const { note, velocity } = this.gestureToNote(gestureX, gestureY)
    const finalVelocity = Math.floor(velocity * intensity)
    try {
      const midiNote = new Note(note ?? 'C4')
      this.output.sendNoteOn(midiNote, {
        channels: [this.config.channel],
        attack: finalVelocity / 127
      })
      if (note != null) {
        this.activeNotes.add(note)
      }
    } catch (error) {
      throw error
    }
  }

  /** @description Para uma nota MIDI específica. */
  stopNote(gestureX: number, gestureY: number): void {
    if (!this.isConnected || !this.output) return
    const { note } = this.gestureToNote(gestureX, gestureY)
    if (note === null || !this.activeNotes.has(note)) return
    try {
      const midiNote = new Note(note ?? 'C4')
      this.output.sendNoteOff(midiNote, {
        channels: [this.config.channel]
      })
      this.activeNotes.delete(note)
    } catch (error) {
      throw error
    }
  }

  /** @description Para todas as notas MIDI ativas. */
  stopAllNotes(): void {
    if (!this.isConnected || !this.output) return
    try {
      this.output.sendAllNotesOff()
      this.activeNotes.clear()
    } catch (error) {
      throw error
    }
  }

  /** @description Envia comandos de pânico para parar todo o som imediatamente. */
  panicStop(): void {
    if (!this.isConnected || !this.output) {
      console.warn('MIDI não conectado - panic stop ignorado')
      return
    }
    try {
      for (let channel = 1; channel <= 16; channel++) {
        this.output.sendControlChange(123, 0, { channels: [channel] }) // All Notes Off
        this.output.sendControlChange(120, 0, { channels: [channel] }) // All Sound Off
      }
      this.activeNotes.clear()
    } catch (error) {
      throw error
    }
  }

  /** @description Envia uma mensagem de Control Change (CC). */
  sendCC(controller: number, value: number): void {
    if (this.output) {
      const midiValue = Math.max(0, Math.min(127, Math.floor(value)))
      this.output.sendControlChange(controller, midiValue, { channels: this.config.channel })
    }
  }

  /** @description Altera a escala musical utilizada. */
  setScale(scaleName: string): void {
    this.config.scale = scaleName
    this.updateScale()
  }

  /** @description Altera a oitava base para a geração de notas. */
  setBaseOctave(octave: number): void {
    this.config.baseOctave = Math.max(1, Math.min(7, octave))
    this.updateScale()
  }

  /** @description Atualiza a escala MIDI atual com base na configuração. */
  private updateScale(): void {
    this.midiScale = generateMidiScale(this.config.scale, this.config.baseOctave)
  }

  /** @description Testa a conexão MIDI tocando uma nota. */
  testConnection(): void {
    if (!this.isConnected) {
      return
    }
    const testNote = TonalNote.get('C#3').name
    try {
      const midiNotes = [new Note(testNote), new Note('G3')]
      this.output!.playNote(midiNotes, { channels: [this.config.channel], duration: 1000 })
    } catch (error) {
      throw error
    }
  }

  /** @description Desconecta e para o serviço MIDI. */
  async stop(): Promise<void> {
    this.stopAllNotes()
    if (WebMidi.enabled) {
      await WebMidi.disable()
    }
    this.output = undefined
    this.isConnected = false
  }

  /** @description Lista os dispositivos de saída MIDI disponíveis. */
  static getAvailableOutputs(): Output[] {
    return WebMidi.enabled ? WebMidi.outputs : []
  }

  /** @description Retorna se o serviço está conectado a um dispositivo. */
  getIsConnected(): boolean {
    return this.isConnected
  }

  /** @description Retorna o nome do dispositivo de saída atual. */
  getCurrentOutput(): string | undefined {
    return this.output?.name
  }
}