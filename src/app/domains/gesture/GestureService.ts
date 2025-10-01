import { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { GestureDetector } from '@/app/domains/gesture/GestureDetector'
import { GestureProcessor } from '@/app/domains/gesture/GestureProcessor'
import { IGestureService } from '@/app/domains/gesture/IGestureService'
import { AppConfig } from '@/app/core'
import { IMidiService } from '@/app/domains/midi/IMidiService'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService'
import { AppStore } from '@/stores/appStore'

/** @description Serviço de gestos unificado que gerencia detecção e processamento. */
export class GestureService implements IGestureService {
  private readonly detector: GestureDetector
  private readonly processor: GestureProcessor

  /** @description Constrói o serviço de gestos. */
  constructor(
    config: AppConfig,
    midiService: IMidiService,
    visualsService: IVisualsService,
    store: AppStore
  ) {
    this.detector = new GestureDetector(config.core.webcam, config.core.mediaPipe)
    this.processor = new GestureProcessor(config, midiService, visualsService, store)
  }

  /** @description Inicializa o serviço de gestos. */
  async initialize(videoElement: HTMLVideoElement): Promise<void> {
    await this.detector.initialize(videoElement)
  }

  /** @description Detecta mãos no frame de vídeo atual. */
  async detectHands(): Promise<HandLandmarkerResult | null> {
    return this.detector.detectHands()
  }

  /** @description Processa os gestos detectados em um frame. */
  processGestures(handData: HandLandmarkerResult): void {
    this.processor.processGestures(handData)
  }

  /** @description Troca a câmera ativa. */
  async switchCamera(deviceId: string): Promise<void> {
    await this.detector.switchCamera(deviceId)
  }

  /** @description Define um callback para verificação de saúde. */
  setHealthCheckCallback(callback: (error: Error) => void): void {
    this.detector.setHealthCheckCallback(callback)
  }

  /** @description Para todos os gestos e reseta o estado dos manipuladores. */
  stopAllGestures(): void {
    this.processor.stopAllGestures()
  }

  /** @description Para o serviço de gestos. */
  async stop(): Promise<void> {
    await this.detector.stop()
  }

  static async getAvailableCameras(): Promise<Array<{ deviceId: string; label: string }>> {
    return await GestureDetector.getAvailableCameras()
  }
}
