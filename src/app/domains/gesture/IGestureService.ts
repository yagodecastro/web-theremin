import { HandLandmarkerResult } from '@mediapipe/tasks-vision'

/** @description Interface para o serviço de gestos unificado. */
export interface IGestureService {
  /** @description Inicializa o serviço de gestos. */
  initialize(videoElement: HTMLVideoElement): Promise<void>
  /** @description Detecta mãos no frame de vídeo atual. */
  detectHands(): Promise<HandLandmarkerResult | null>
  /** @description Processa os gestos detectados em um frame. */
  processGestures(handData: HandLandmarkerResult): void
  /** @description Troca a câmera ativa. */
  switchCamera(deviceId: string): Promise<void>
  /** @description Define um callback para verificação de saúde. */
  setHealthCheckCallback(callback: (error: Error) => void): void
  /** @description Para todos os gestos e reseta o estado dos manipuladores. */
  stopAllGestures(): void
  /** @description Para o serviço de gestos. */
  stop(): Promise<void>
}
