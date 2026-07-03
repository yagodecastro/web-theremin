import { HandLandmarkerResult, FaceDetectorResult } from '@mediapipe/tasks-vision'
import { GestureDetector } from '@/app/domains/gesture/GestureDetector'
import { GestureProcessor } from '@/app/domains/gesture/GestureProcessor'
import { IGestureService } from '@/app/domains/gesture/IGestureService'
import { AppConfig } from '@/app/core'
import { IMidiService } from '@/app/domains/midi/IMidiService'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService'
import { EffectQueue } from '@/app/shared/EffectQueue'

/** @description Serviço de gestos unificado que gerencia detecção e processamento. */
export class GestureService implements IGestureService {
  private readonly detector: GestureDetector
  private readonly processor: GestureProcessor

  /** @description Constrói o serviço de gestos. */
  constructor(
    config: AppConfig,
    midiService: IMidiService,
    visualsService: IVisualsService,
    private readonly effectQueue: EffectQueue
  ) {
    this.detector = new GestureDetector(config.core.webcam, config.core.mediaPipe)
    this.processor = new GestureProcessor(config, midiService, visualsService, effectQueue)
  }

  /** @description Inicializa o serviço de gestos. */
  async initialize(videoElement: HTMLVideoElement, deviceId?: string): Promise<void> {
    await this.detector.initialize(videoElement, deviceId)
  }

  /** @description Detecta mãos no frame de vídeo atual. */
  async detectHands(): Promise<HandLandmarkerResult | null> {
    const handData = await this.detector.detectHands()
    
    // Executa a detecção de face em um tick separado do event loop (setTimeout 0).
    // Isso garante que o som (altamente sensível a latência) seja atualizado
    // e o frame principal com as mãos seja renderizado ANTES que o processamento
    // da face bloqueie a thread principal.
    setTimeout(async () => {
      try {
        const faceData = await this.detector.detectFace()
        if (faceData) {
          this.processEyes(faceData)
        }
      } catch (error) {
        console.error('Erro na detecção de face assíncrona:', error)
      }
    }, 0)
    
    return handData
  }

  /** @description Extrai as coordenadas dos olhos e as envia para a fila de efeitos. */
  private processEyes(faceData: FaceDetectorResult): void {
    if (!faceData || !faceData.detections || faceData.detections.length === 0) {
      this.effectQueue.push({
        type: 'eyeTrack',
        leftEye: null,
        rightEye: null
      })
      return
    }

    const detection = faceData.detections[0]
    if (detection && detection.keypoints && detection.keypoints.length >= 2) {
      const kp0 = detection.keypoints[0]
      const kp1 = detection.keypoints[1]
      this.effectQueue.push({
        type: 'eyeTrack',
        leftEye: { x: kp1.x, y: kp1.y },
        rightEye: { x: kp0.x, y: kp0.y }
      })
    }
  }

  /** @description Processa os gestos detectados em um frame com o timestamp do rAF. */
  processGestures(handData: HandLandmarkerResult, timestamp: number): void {
    this.processor.processGestures(handData, timestamp)
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

  /** @description Substitui o serviço de áudio nos handlers de gestos. */
  updateMidiService(midiService: IMidiService): void {
    this.processor.updateMidiService(midiService)
  }

  /** @description Para o serviço de gestos. */
  async stop(): Promise<void> {
    await this.detector.stop()
  }

  static async getAvailableCameras(): Promise<Array<{ deviceId: string; label: string }>> {
    return await GestureDetector.getAvailableCameras()
  }
}
