import * as Tone from 'tone'

/** @description Serviço de áudio que gerencia a síntese sonora com Tone.js. */
export class SynthService {
  private synth: Tone.MonoSynth
  private isInitialized = false
  private filter: Tone.Filter
  private vibrato: Tone.Vibrato

  constructor() {
    // Cria um filtro separado para termos mais controle
    this.filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 2000,
      rolloff: -24,
      Q: 1
    }).toDestination()

    // Cria efeito de vibrato
    this.vibrato = new Tone.Vibrato({
      frequency: 5, // 5Hz rate
      depth: 0, // Inicia sem vibrato
      type: 'sine'
    }).connect(this.filter)

    this.synth = new Tone.MonoSynth({
      oscillator: {
        type: 'sawtooth'
      },
      envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.8,
        release: 1
      },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.5,
        sustain: 0.5,
        release: 1,
        baseFrequency: 200,
        octaves: 4
      },
      portamento: 0.05 // Portamento suave para sensação de Theremin
    }).connect(this.vibrato)
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
    // MonoSynth triggerAttack muda a nota se já estiver tocando
    this.synth.triggerAttack(freq, Tone.now(), vel)
  }

  /** @description Para uma nota específica. */
  stopNote(_midiNote: number): void {
    if (!this.isInitialized) return
    // MonoSynth ignora o argumento de nota no triggerRelease (para a nota atual)
    this.synth.triggerRelease()
  }

  /** @description Para todas as notas. */
  stopAll(): void {
    if (!this.isInitialized) return
    this.synth.triggerRelease()
  }

  /**
   * @description Define o volume do sintetizador.
   * @param midiValue Valor MIDI (0-127)
   */
  setVolume(midiValue: number): void {
    if (!this.isInitialized) return
    // Mapeia 0-127 para -60dB a 0dB
    const volumeDb = midiValue === 0 ? -Infinity : Tone.gainToDb(midiValue / 127)
    this.synth.volume.rampTo(volumeDb, 0.1)
  }

  /**
   * @description Define a frequência de corte do filtro.
   * @param midiValue Valor MIDI (0-127)
   */
  setFilterFrequency(midiValue: number): void {
    if (!this.isInitialized) return
    // Mapeia 0-127 para 100Hz - 10000Hz (escala exponencial seria melhor, mas linear simples funciona)
    const minFreq = 100
    const maxFreq = 10000
    const frequency = minFreq + (midiValue / 127) * (maxFreq - minFreq)
    this.filter.frequency.rampTo(frequency, 0.1)
  }

  /**
   * @description Define a quantidade de vibrato.
   * @param midiValue Valor MIDI (0-127)
   */
  setVibratoAmount(midiValue: number): void {
    if (!this.isInitialized) return
    // Mapeia 0-127 para 0-1 (depth do Tone.Vibrato)
    const amount = midiValue / 127
    this.vibrato.depth.rampTo(amount, 0.1)
  }
}
