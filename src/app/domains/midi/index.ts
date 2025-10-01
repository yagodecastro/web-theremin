export * from './MidiService'

/** @description Configurações relacionadas ao MIDI. */
export interface MidiConfig {
  outputDevice?: string
  channel: number
  scale: string
  baseOctave: number
  readonly maxValue: number
  readonly defaultThreshold: number
  readonly controlChanges: {
    readonly left: {
      readonly x: number | null
      readonly y: number
      readonly handOpenness: number
      readonly pinch: number | null
    }
    readonly right: {
      readonly x: number
      readonly y: number
      readonly handOpenness: number
      readonly pinch: number | null
    }
  }
}