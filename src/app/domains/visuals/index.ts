import { HandednessType } from '@/app/domains/gesture/utils/gestureUtils.ts'
import { NormalizedLandmark } from '@mediapipe/tasks-vision'

export * from './VisualsService'

/** @description Dados para o efeito visual de explosão de pinça. */
export interface PinchBurstEffectData {
  type: 'pinchBurst'
  x: number
  y: number
  intensity: number
}

/** @description Dados para o efeito visual de modulação da mão. */
export interface HandModulationEffectData {
  type: 'handModulation'
  x: number
  y: number
  intensity: number
  landmarks: NormalizedLandmark[]
  handedness: HandednessType
}

/** @description União de todos os tipos de efeitos visuais possíveis. */
export type VisualEffect = PinchBurstEffectData | HandModulationEffectData

/** @description Configurações para efeitos visuais. */
export interface VisualEffectsConfig {
  readonly pinchBurst: {
    readonly colors: readonly number[]
    readonly particleCountBase: number
    readonly particleCountMultiplier: number
    readonly baseSize: number
    readonly randomSize: number
    readonly baseSpeed: number
    readonly randomSpeed: number
    readonly baseLifetime: number
    readonly randomLifetime: number
    readonly baseDecay: number
    readonly randomDecay: number
    readonly baseScale: number
    readonly randomScale: number
    readonly lift: number
  }
  readonly handModulation: {
    readonly left: { readonly base: string; readonly target: string }
    readonly right: { readonly base: string; readonly target: string }
    readonly particleCountMultiplier: number
    readonly minParticles: number
    readonly baseSpawnRadius: number
    readonly particleSize: number
    readonly lifetime: number
    readonly decay: number
    readonly speed: number
    readonly scale: { readonly base: number; readonly random: number }
    readonly colorInterpolation: {
      readonly intensityWeight: number
      readonly opennessWeight: number
    }
  }
}