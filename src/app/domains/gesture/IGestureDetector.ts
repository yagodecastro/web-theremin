import { HandLandmarkerResult } from '@mediapipe/tasks-vision'

/** @description Interface para o serviço de detecção de gestos. */
export interface IGestureDetector {
  /** @description Detecta mãos no frame de vídeo atual. */
  detectHands(): Promise<HandLandmarkerResult | null>
  /** @description Troca a câmera ativa. */
  switchCamera(deviceId: string): Promise<void>
  /** @description Define um callback para verificação de saúde. */
  setHealthCheckCallback(callback: (error: Error) => void): void
  /** @description Para o serviço de gestos. */
  stop(): Promise<void>
  /** @description Inicializa o serviço de gestos. */
  initialize(videoElement: HTMLVideoElement): Promise<void>
}
