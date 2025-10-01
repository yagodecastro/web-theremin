export * from './IGestureService'
export * from './GestureService'
export * from './GestureDetector'

/** @description Configurações relacionadas à detecção e mapeamento de gestos. */
export interface GestureConfig {
  readonly handGesture: {
    readonly pinch: {
      readonly threshold: number
    }
    readonly fingerBaseLandmark: number
    readonly handOpenness: {
      readonly closedThreshold: number
      readonly openThreshold: number
      readonly confidenceThreshold: number
      readonly smoothing: number
      readonly fingerWeights: {
        readonly thumb: number
        readonly index: number
        readonly middle: number
        readonly ring: number
        readonly pinky: number
      }
    }
  }
  readonly noteHysteresis: number
  readonly significantMovementChange: number
  readonly continuousEffectIntensity: number
  readonly movementCenter: number
  readonly movementScale: number
}
