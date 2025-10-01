import { GestureConfig } from '@/app/domains/gesture'
import { HandLandmarkerOptions } from '@mediapipe/tasks-vision'
import { MidiConfig } from '@/app/domains/midi'
import { VisualEffectsConfig } from '@/app/domains/visuals'
import { CanvasConfig } from '@/app/domains/visuals/visualEffects'

export * from './AppController'
export * from './ServiceOrchestrator'

/** @description Configurações de performance do sistema. */
export interface SystemPerformanceConfig {
  readonly targetFPS: number
  readonly maxParticles: number
  readonly poolSize: number
  readonly maxParticlesPerEffect: number
  readonly maxTextureCacheSize: number
}

/** @description Configurações da Webcam. */
export interface WebcamConfig {
  readonly width: ConstrainULongRange
  readonly height: ConstrainULongRange
  readonly frameRate: ConstrainULongRange
  readonly facingMode: string
}

/** @description Configurações do MediaPipe. */
export interface MediaPipeConfig {
  readonly initTimeout: number
  readonly minHandDetectionConfidence: number
  readonly minHandPresenceConfidence: number
  readonly minTrackingConfidence: number
  readonly handLandmarkerOptions: HandLandmarkerOptions
  readonly wasmPath: string
}

/** @description Configuração principal e unificada da aplicação. */
export interface AppConfig {
  readonly domains: {
    readonly gestures: GestureConfig
    readonly midi: MidiConfig
    readonly visuals: VisualEffectsConfig
  }
  readonly core: {
    readonly systemPerformance: SystemPerformanceConfig
    readonly webcam: WebcamConfig
    readonly mediaPipe: MediaPipeConfig
    readonly canvas: CanvasConfig
  }
}
