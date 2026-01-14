import * as Tone from 'tone'

/** @description Serviço de áudio que gerencia a síntese sonora com Tone.js. */
export class SynthService {
  private synth: Tone.PolySynth
  private isInitialized = false

  constructor() {
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle'
      },
      envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.5,
        release: 1
      }
    }).toDestination()
  }

  /** @description Garante que o AudioContext do navegador seja iniciado. */
  async ensureAudioContext(): Promise<void> {
    if (Tone.context.state !== 'running') {
      await Tone.start()
    }
    this.isInitialized = true
  }

  /** @description Toca uma nota com velocidade (intensidade). */
  playNote(midiNote: number, velocity: number): void {
    if (!this.isInitialized) return
    const freq = Tone.Frequency(midiNote, 'midi').toNote()
    const vel = Math.max(0, Math.min(1, velocity / 127))
    this.synth.triggerAttack(freq, Tone.now(), vel)
  }

  /** @description Para uma nota específica. */
  stopNote(midiNote: number): void {
    if (!this.isInitialized) return
    const freq = Tone.Frequency(midiNote, 'midi').toNote()
    this.synth.triggerRelease(freq)
  }

  /** @description Para todas as notas. */
  stopAll(): void {
    if (!this.isInitialized) return
    this.synth.releaseAll()
  }
}
