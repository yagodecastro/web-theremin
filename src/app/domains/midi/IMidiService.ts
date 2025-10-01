/** @description Interface para o serviço MIDI. */
export interface IMidiService {
  /** @description Toca uma nota baseada na posição do gesto. */
  playNote(gestureX: number, gestureY: number, intensity?: number): void
  /** @description Para uma nota baseada na posição do gesto. */
  stopNote(gestureX: number, gestureY: number): void
  /** @description Para todas as notas ativas. */
  stopAllNotes(): void
  /** @description Envia uma mensagem de Control Change (CC). */
  sendCC(controller: number, value: number): void
  /** @description Converte a posição do gesto em uma nota MIDI. */
  gestureToNote(x: number, y: number): { note: number | null; noteValue: number }
  /** @description Para o serviço MIDI. */
  stop(): Promise<void>
  /** @description Conecta a um dispositivo MIDI. */
  connect(deviceName: string | undefined): Promise<void>
  /** @description Define a escala musical. */
  setScale(scaleName: string): void
  /** @description Define a oitava base. */
  setBaseOctave(octave: number): void
  /** @description Testa a conexão MIDI. */
  testConnection(): void
  /** @description Envia um comando de pânico para parar todo o som. */
  panicStop(): void
}