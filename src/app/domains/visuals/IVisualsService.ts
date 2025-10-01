import { EffectOptions } from '@/app/domains/visuals/visualEffects'
import { PinchBurstEffectData } from '@/app/domains/visuals/index.ts'

/** @description Interface para o serviço de visuais. */
export interface IVisualsService {
  /** @description Emite um efeito de modulação da mão. */
  emitHandModulation(options: EffectOptions): void
  /** @description Emite um efeito de explosão de pinça. */
  emitPinchBurst(options: Omit<PinchBurstEffectData, 'type'>): void
  /** @description Limpa todos os efeitos visuais. */
  clear(): void
  /** @description Inicializa o serviço de visuais. */
  initialize(visualsCanvas: HTMLCanvasElement): Promise<void>
  /** @description Para o serviço de visuais. */
  stop(): Promise<void>

  render(): void
}
