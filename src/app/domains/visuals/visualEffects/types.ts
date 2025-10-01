import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Texture } from 'pixi.js'
import { HandednessType } from '@/app/domains/gesture/utils/gestureUtils.ts'

/** @description Opções para a criação de efeitos visuais. */
export interface EffectOptions {
  x: number
  y: number
  intensity: number
  handOpenness?: number
  landmarks?: NormalizedLandmark[]
  handedness?: HandednessType
}

/** @description Configuração do canvas para renderização. */
export interface CanvasConfig {
  width: number
  height: number
  backgroundColor: number | string
}

/** @description Opções para a ativação de uma partícula. */
export interface ParticleActivationOptions {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  decay: number
  texture: Texture
  scale: number
}