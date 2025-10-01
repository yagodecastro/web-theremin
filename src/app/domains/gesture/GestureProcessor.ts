import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { PinchGestureHandler } from '@/app/domains/gesture/handlers/PinchGestureHandler.ts'
import { HandModulationHandler } from '@/app/domains/gesture/handlers/HandModulationHandler.ts'
import type {
  GestureHandler,
  HandlerPriority
} from '@/app/domains/gesture/handlers/BaseGestureHandler.ts'
import { IMidiService } from '@/app/domains/midi/IMidiService.ts'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService.ts'
import { AppConfig } from '@/app/core'
import { AppStore } from '@/stores/appStore.ts'

/** @description Processa os dados de gestos da mão e os distribui para os manipuladores apropriados. */
export class GestureProcessor {
  private readonly handlers: GestureHandler[]
  private frameCounter = 0

  /** @description Constrói o processador de gestos com seus manipuladores. */
  constructor(
    private appConfig: AppConfig,
    private midiService: IMidiService,
    private visualsService: IVisualsService,
    private store: AppStore
  ) {
    this.handlers = [
      new PinchGestureHandler(
        this.midiService,
        this.visualsService,
        this.appConfig.domains.midi,
        this.appConfig.domains.gestures,
        this.store
      ),
      new HandModulationHandler(
        this.midiService,
        this.visualsService,
        this.appConfig.domains.midi,
        this.appConfig.domains.gestures,
        this.store
      )
    ].sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority))
  }

  /** @description Processa os gestos detectados em um frame. */
  processGestures(handData: HandLandmarkerResult): void {
    this.frameCounter++
    for (const handler of this.handlers) {
      if (this.shouldProcessHandler(handler)) {
        handler.process(handData)
      }
    }
  }

  /** @description Obtém o valor numérico de uma prioridade de handler. */
  private getPriorityValue(priority: HandlerPriority): number {
    switch (priority) {
      case 'high':
        return 3
      case 'medium':
        return 2
      case 'low':
        return 1
      default:
        return 0
    }
  }

  /** @description Verifica se um manipulador deve ser processado neste frame com base em seu intervalo. */
  private shouldProcessHandler(handler: GestureHandler): boolean {
    return this.frameCounter % handler.frameSkipInterval === 0
  }

  /** @description Para todos os gestos e reseta o estado dos manipuladores. */
  stopAllGestures(): void {
    for (const handler of this.handlers) {
      handler.stop?.()
    }
  }
}
