import { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { IMidiService } from '@/app/domains/midi/IMidiService'

/** @description Interface para o serviço de gestos unificado. */
export interface IGestureService {
  /** @description Inicializa o serviço de gestos. */
  initialize(videoElement: HTMLVideoElement, deviceId?: string): Promise<void>
  /** @description Detecta mãos no frame de vídeo atual. */
  detectHands(): Promise<HandLandmarkerResult | null>
  /** @description Processa os gestos detectados em um frame com o timestamp do rAF. */
  processGestures(handData: HandLandmarkerResult, timestamp: number): void
  /** @description Troca a câmera ativa. */
  switchCamera(deviceId: string): Promise<void>
  /** @description Define um callback para verificação de saúde. */
  setHealthCheckCallback(callback: (error: Error) => void): void
  /** @description Para todos os gestos e reseta o estado dos manipuladores. */
  stopAllGestures(): void
  /** @description Substitui o serviço de áudio nos handlers de gestos. */
  updateMidiService(midiService: IMidiService): void
  /** @description Para o serviço de gestos. */
  stop(): Promise<void>
}
