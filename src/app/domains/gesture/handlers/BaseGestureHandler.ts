import type { HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { MidiConfig } from '@/app/domains/midi'
import { GestureConfig } from '@/app/domains/gesture'
import { IMidiService } from '@/app/domains/midi/IMidiService.ts'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService.ts'
import { HandednessType } from '@/app/domains/gesture/utils/gestureUtils.ts'
import { EffectQueue } from '@/app/shared/EffectQueue.ts'

export type HandlerPriority = 'high' | 'medium' | 'low'

/** @description Interface para manipuladores de gestos. */
export interface GestureHandler {
  priority: HandlerPriority
  frameSkipInterval: number
  process(handData: HandLandmarkerResult, timestamp: number): void
  updateMidiService(midiService: IMidiService): void
  stop?(): void
}

/** @description Classe base abstrata para todos os manipuladores de gestos. */
export abstract class BaseGestureHandler implements GestureHandler {
  abstract priority: HandlerPriority
  public frameSkipInterval = 1

  protected constructor(
    // Não-readonly para permitir troca de serviço de áudio sem recriar o handler (#7)
    protected midiService: IMidiService,
    protected readonly visualsService: IVisualsService,
    protected readonly midiConfig: MidiConfig,
    protected readonly gestureConfig: GestureConfig,
    // Fila plain (não-reativa) para emissão de efeitos visuais
    protected readonly effectQueue: EffectQueue
  ) {
    this.setPriorityConfig()
  }

  /** @description Troca o serviço de áudio sem recriar o handler. */
  updateMidiService(midiService: IMidiService): void {
    this.midiService = midiService
  }

  /** @description Processa os dados de gestos da mão com o timestamp do rAF. */
  abstract process(handData: HandLandmarkerResult, timestamp: number): void

  /** @description Define a configuração de prioridade e o intervalo de frames. */
  protected setPriorityConfig(): void {
    switch (this.priority) {
      case 'high':
        this.frameSkipInterval = 1 // Processa todo frame
        break
      case 'medium':
        this.frameSkipInterval = 2 // A cada 2 frames
        break
      case 'low':
        this.frameSkipInterval = 3 // A cada 3 frames
        break
    }
  }

  /** @description Obtém os landmarks para uma mão específica (direita ou esquerda). */
  protected getLandmarksByHand(
    handData: HandLandmarkerResult,
    hand: HandednessType
  ): NormalizedLandmark[] | null {
    const handIndex = handData.handednesses.findIndex(h => h[0]?.categoryName === hand)
    return handIndex !== -1 ? handData.landmarks[handIndex] : null
  }
}