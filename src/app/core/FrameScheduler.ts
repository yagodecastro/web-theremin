import type { AppStore } from '@/stores/appStore.ts'
import type { AppConfig } from '@/app/core/index.ts'

/**
 * @description Gerencia o loop de renderização baseado em requestAnimationFrame.
 * Controla a taxa de frames, calcula FPS e reporta métricas ao store.
 */
export class FrameScheduler {
  private animationFrameId: number | null = null
  private lastFrameTime = 0
  private frameCount = 0
  private fpsLastUpdate = 0
  private readonly targetFrameTime: number
  private readonly fpsUpdateInterval = 1000

  /**
   * @description Constrói o scheduler de frames.
   * @param config Configuração da aplicação com targetFPS
   * @param store Store para reportar métricas
   * @param onFrame Callback executado a cada frame processado
   */
  constructor(
    private readonly config: AppConfig,
    private readonly store: AppStore,
    private readonly onFrame: () => Promise<void>
  ) {
    this.targetFrameTime = 1000 / (this.config.core.webcam.frameRate.ideal ?? 30)
  }

  /** @description Inicia o loop de processamento. */
  start(): void {
    if (!this.animationFrameId) {
      this.lastFrameTime = performance.now()
      this.fpsLastUpdate = performance.now()
      this.frameCount = 0
      this.animationFrameId = requestAnimationFrame(this.loop)
    }
  }

  /** @description Para o loop de processamento. */
  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /** @description Verifica se o loop está em execução. */
  isRunning(): boolean {
    return this.animationFrameId !== null
  }

  /**
   * @description Loop principal que processa frames em frequência controlada.
   */
  private readonly loop = async (): Promise<void> => {
    if (!this.store.isRunning) {
      this.animationFrameId = null
      return
    }

    const now = performance.now()
    const elapsed = now - this.lastFrameTime

    if (elapsed >= this.targetFrameTime) {
      this.lastFrameTime = now

      performance.mark('frame-start')
      await this.onFrame()
      performance.mark('frame-end')
      performance.measure('frame-process', 'frame-start', 'frame-end')

      this.frameCount++
      const fpsDelta = now - this.fpsLastUpdate
      if (fpsDelta >= this.fpsUpdateInterval) {
        const currentFps = Math.round((this.frameCount * 1000) / fpsDelta)
        this.store.addDebugInfo(
          'targetFps',
          `${currentFps} / ${this.config.core.systemPerformance.targetFPS}`
        )
        this.store.addDebugInfo(
          'webcamFps',
          `${currentFps} / ${this.config.core.systemPerformance.targetFPS}`
        )
        this.frameCount = 0
        this.fpsLastUpdate = now
      }
    }

    this.animationFrameId = requestAnimationFrame(this.loop)
  }
}
