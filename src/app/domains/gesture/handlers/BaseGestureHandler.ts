import type { HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { MidiConfig } from '@/app/domains/midi'
import { GestureConfig } from '@/app/domains/gesture'
import { IMidiService } from '@/app/domains/midi/IMidiService.ts'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService.ts'
import { HandednessType } from '@/app/domains/gesture/utils/gestureUtils.ts'

export type HandlerPriority = 'high' | 'medium' | 'low'

/** @description Interface para manipuladores de gestos. */
export interface GestureHandler {
  priority: HandlerPriority
  frameSkipInterval: number
  process(handData: HandLandmarkerResult): void
  stop?(): void
}

/** @description Classe base abstrata para todos os manipuladores de gestos. */
export abstract class BaseGestureHandler implements GestureHandler {
  abstract priority: HandlerPriority
  public frameSkipInterval = 1

  protected constructor(
    protected readonly midiService: IMidiService,
    protected readonly visualsService: IVisualsService,
    protected readonly midiConfig: MidiConfig,
    protected readonly gestureConfig: GestureConfig
  ) {
    this.setPriorityConfig()
  }

  /** @description Processa os dados de gestos da mão. */
  abstract process(handData: HandLandmarkerResult): void

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