import type { AppStore } from '@/stores/appStore.ts'
import { IGestureService } from '@/app/domains/gesture/IGestureService'
import { AppConfig } from '@/app/core/index.ts'
import { IMidiService } from '@/app/domains/midi/IMidiService.ts'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService.ts'
import { FrameScheduler } from '@/app/core/FrameScheduler.ts'

/** @description Orquestra a coordenação entre todos os serviços da aplicação. */
export class ServiceOrchestrator {
  private readonly frameScheduler: FrameScheduler

  /** @description Constrói o orquestrador de serviços. */
  constructor(
    private readonly config: AppConfig,
    private gestureService: IGestureService,
    private midiService: IMidiService,
    private visualsService: IVisualsService,
    private store: AppStore
  ) {
    this.frameScheduler = new FrameScheduler(this.config, this.store, () => this.processFrame())
  }

  /** @description Inicia o processamento de gestos e o loop principal. */
  start(): void {
    if (this.store.status !== 'ready') {
      throw new Error('Sistema não está pronto para iniciar')
    }
    this.store.setStatus('running')
    this.frameScheduler.start()
  }

  /** @description Para o processamento de gestos e o loop principal. */
  stop(): void {
    this.frameScheduler.stop()
    this.gestureService.stopAllGestures()
    this.midiService.stopAllNotes()
    this.visualsService.clear()
    this.store.setStatus('ready')
  }

  /**
   * @description Processa um único frame de detecção e processamento de gestos.
   * Chamado pelo FrameScheduler a cada frame.
   */
  private async processFrame(): Promise<void> {
    if (!this.store.isRunning) return
    try {
      const handData = await this.gestureService.detectHands()
      if (handData) {
        this.gestureService.processGestures(handData)
      }
      this.visualsService.render()
    } catch (error) {
      console.error('Erro ao processar frame:', error)
    }
  }

  /** @description Troca a câmera ativa, reiniciando o loop se necessário. */
  async switchCamera(deviceId: string): Promise<void> {
    const wasRunning = this.frameScheduler.isRunning()
    this.frameScheduler.stop()
    this.store.setStatus('initializing', `Trocando para câmera: ${deviceId}`)
    try {
      await this.gestureService.switchCamera(deviceId)
      this.store.addSystemLog('info', `Câmera alterada com sucesso para: ${deviceId}`)
      if (wasRunning) {
        this.store.setStatus('running')
        this.frameScheduler.start()
      } else {
        this.store.setStatus('ready')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.store.setStatus('camera_error', `Falha ao trocar câmera: ${errorMessage}`)
      throw error
    }
  }
}
