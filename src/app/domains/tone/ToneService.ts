import * as Tone from 'tone'
import { Note as TonalNote } from 'tonal'
import { generateMidiScale } from '@/app/shared/utils/musicTheoryUtils.ts'
import { IMidiService } from '@/app/domains/midi/IMidiService.ts'
import { MidiConfig } from '@/app/domains/midi/index.ts'

/**
 * @description Serviço de síntese direta no browser via Tone.js.
 *
 * Signal chain: PolySynth → Distortion → Vibrato → Filter → Delay → Reverb → out
 *
 * CC map (mirrors MidiConfig.controlChanges):
 *   CC71  left.y         → filter cutoff  (80 Hz – 10 kHz, exponential)
 *   CC1   left.openness  → filter Q       (0.5 – 20, self-oscillation territory)
 *   CC11  right.openness → vibrato depth  (0 – 1)
 *   CC20  right.y        → drive          (0 – 0.95)
 *   CC21  right.x        → delay wet      (0 – 0.7)
 *   CC100 pinch          → reverb wet     (0 – 0.8)
 */
export class ToneService implements IMidiService {
  private synth: Tone.MonoSynth
  private distortion: Tone.Distortion
  private vibrato: Tone.Vibrato
  private filter: Tone.Filter
  private delay: Tone.FeedbackDelay
  private reverb: Tone.Reverb
  private limiter: Tone.Limiter
  private midiScale: (number | null)[] = []
  private isConnected = false

  constructor(private config: MidiConfig) {
    this.distortion = new Tone.Distortion(0)
    this.vibrato = new Tone.Vibrato({ frequency: 5, depth: 0 })
    this.filter = new Tone.Filter({ frequency: 4000, type: 'lowpass', Q: 1 })
    this.delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 0 })
    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.15 })
    this.limiter = new Tone.Limiter(-2) // Limiter em -2dB para evitar clipping digital duro

    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.04, decay: 0.1, sustain: 0.7, release: 0.8 },
      filterEnvelope: {
        attack: 0,
        decay: 0,
        sustain: 1,
        release: 0.1,
        baseFrequency: 20000,
        octaves: 0
      }
    })

    this.synth.chain(
      this.distortion,
      this.vibrato,
      this.filter,
      this.delay,
      this.reverb,
      this.limiter,
      Tone.getDestination()
    )

    this.updateScale()
  }

  /** @description Inicializa o AudioContext (requer user gesture). */
  async connect(_deviceName?: string): Promise<void> {
    await Tone.start()
    this.isConnected = true
  }

  /** @description Converte posição do gesto em nota musical. */
  gestureToNote(x: number, _y: number): { note: number | null; noteValue: number } {
    const noteValue = (1 - x) * this.midiScale.length
    const noteIndex = Math.floor(noteValue)
    return { note: this.midiScale[noteIndex] ?? null, noteValue }
  }

  /** @description Toca nota com base na posição do gesto. */
  playNote(gestureX: number, gestureY: number, intensity: number = 1): void {
    if (!this.isConnected) return
    const { note } = this.gestureToNote(gestureX, gestureY)
    if (note === null) return
    const noteName = TonalNote.fromMidi(note)
    const velocity = ((1 - gestureY) * 0.73 + 0.27) * intensity
    try {
      this.synth.triggerAttack(noteName, Tone.now(), velocity)
    } catch {
      // PolySynth pode lançar se a nota já estiver ativa
    }
  }

  /** @description Para a nota ativa. */
  stopNote(_gestureX: number, _gestureY: number): void {
    if (!this.isConnected) return
    try {
      this.synth.triggerRelease(Tone.now())
    } catch {
      // nota pode já ter sido liberada
    }
  }

  /** @description Para a nota ativa. */
  stopAllNotes(): void {
    this.synth.triggerRelease(Tone.now())
  }

  /** @description Mapeia CC MIDI para parâmetros expressivos do synth. */
  sendCC(controller: number, value: number): void {
    if (!this.isConnected) return
    const n = Math.max(0, Math.min(127, value)) / 127
    switch (controller) {
      // left.y → filter cutoff: exponential curve 80 Hz – 10 kHz (inverted: hand up = more cutoff)
      case 71:
        this.filter.frequency.rampTo(80 * Math.pow(10000 / 80, 1 - n), 0.03)
        break
      // left.openness → filter resonance Q: 0.5 – 20
      case 1:
        this.filter.Q.rampTo(0.5 + n * 19.5, 0.05)
        break
      // right.openness → vibrato depth: 0 – 1
      case 11:
        this.vibrato.depth.rampTo(n, 0.05)
        break
      // right.y → distortion drive: 0 – 0.95 (inverted: hand up = more drive)
      case 20:
        this.distortion.distortion = (1 - n) * 0.95
        break
      // right.x → delay wet: 0 – 0.7
      case 21:
        this.delay.wet.rampTo(n * 0.7, 0.05)
        break
      // pinch → reverb wet: 0 – 0.8
      case 100:
        this.reverb.wet.rampTo(n * 0.8, 0.1)
        break
    }
  }

  /** @description Altera a escala musical. */
  setScale(scaleName: string): void {
    this.config.scale = scaleName
    this.updateScale()
  }

  /** @description Altera a tônica da escala. */
  setTonic(tonic: string): void {
    this.config.tonic = tonic
    this.updateScale()
  }

  /** @description Altera a oitava base. */
  setBaseOctave(octave: number): void {
    this.config.baseOctave = Math.max(1, Math.min(7, octave))
    this.updateScale()
  }

  /** @description Altera o número de oitavas cobertas. */
  setOctaveRange(range: number): void {
    this.config.octaveRange = Math.max(1, Math.min(6, range))
    this.updateScale()
  }

  /** @description Toca notas de teste para verificar o áudio e a cadeia de efeitos. */
  testConnection(): void {
    if (!this.isConnected) return
    this.synth.triggerAttackRelease('C4', '8n', Tone.now())
    this.synth.triggerAttackRelease('G4', '8n', Tone.now() + 0.3)
  }

  /** @description Para todo o áudio e reseta os efeitos para valores neutros. */
  panicStop(): void {
    this.synth.triggerRelease(Tone.now())
    this.filter.frequency.rampTo(4000, 0.05)
    this.filter.Q.rampTo(1, 0.05)
    this.distortion.distortion = 0
    this.vibrato.depth.rampTo(0, 0.05)
    this.delay.wet.rampTo(0, 0.05)
    this.reverb.wet.rampTo(0.15, 0.05)
  }

  /** @description Desconecta e libera todos os recursos de áudio. */
  async stop(): Promise<void> {
    this.synth.triggerRelease(Tone.now())
    this.synth.dispose()
    this.distortion.dispose()
    this.vibrato.dispose()
    this.filter.dispose()
    this.delay.dispose()
    this.reverb.dispose()
    this.limiter.dispose()
    this.isConnected = false
  }

  private updateScale(): void {
    this.midiScale = generateMidiScale(
      this.config.scale,
      this.config.tonic,
      this.config.baseOctave,
      this.config.octaveRange
    )
  }
}
