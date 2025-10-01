import { AppConfig, MediaPipeConfig, SystemPerformanceConfig, WebcamConfig } from '@/app/core'
import { GestureConfig } from '@/app/domains/gesture'
import { MidiConfig } from '@/app/domains/midi'
import { VisualEffectsConfig } from '@/app/domains/visuals'
import { CanvasConfig } from '@/app/domains/visuals/visualEffects'

const gestureConfig: GestureConfig = {
  handGesture: {
    pinch: { threshold: 0.05 },
    handOpenness: {
      closedThreshold: 0.08,
      openThreshold: 0.25,
      confidenceThreshold: 0.7,
      smoothing: 0.7,
      fingerWeights: {
        thumb: 0.15,
        index: 0.25,
        middle: 0.25,
        ring: 0.2,
        pinky: 0.15
      }
    },
    fingerBaseLandmark: 1
  },
  noteHysteresis: 0.4,
  significantMovementChange: 0.005,
  continuousEffectIntensity: 0.9,
  movementCenter: 0.5,
  movementScale: 2
} as const

const midiConfig: MidiConfig = {
  defaultThreshold: 0.05,
  controlChanges: {
    left: {
      x: null,
      y: 71,
      handOpenness: 1,
      pinch: null
    },
    right: {
      x: 21,
      y: 20,
      handOpenness: 11,
      pinch: 100
    }
  },
  maxValue: 127,
  channel: 1,
  baseOctave: 3,
  scale: 'whole tone'
} as const

const visualsConfig: VisualEffectsConfig = {
  pinchBurst: {
    colors: [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfece2b, 0xff8a80],
    particleCountBase: 5,
    particleCountMultiplier: 15,
    baseSize: 2,
    randomSize: 3,
    baseSpeed: 0.5,
    randomSpeed: 2.5,
    baseLifetime: 0.8,
    randomLifetime: 0.4,
    baseDecay: 0.015,
    randomDecay: 0.01,
    baseScale: 0.5,
    randomScale: 0.5,
    lift: -1
  },
  handModulation: {
    left: { base: 'cyan', target: 'indigo' },
    right: { base: 'purple', target: 'orange' },
    particleCountMultiplier: 20,
    minParticles: 5,
    baseSpawnRadius: 30,
    particleSize: 3,
    lifetime: 1.5,
    decay: 0.03,
    speed: 1.0,
    scale: { base: 0.5, random: 0.5 },
    colorInterpolation: {
      intensityWeight: 0.2,
      opennessWeight: 0.8
    }
  }
} as const

const webcamConfig: WebcamConfig = {
  facingMode: 'user',
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 30, max: 60 }
} as const

const systemPerformanceConfig: SystemPerformanceConfig = {
  targetFPS: webcamConfig.frameRate?.ideal ?? 30,
  maxParticles: 5000,
  poolSize: 500,
  maxParticlesPerEffect: 150,
  maxTextureCacheSize: 100
} as const

const mediaPipeCoreConfig: MediaPipeConfig = {
  handLandmarkerOptions: {
    runningMode: 'VIDEO',
    numHands: 2,
    baseOptions: {
      delegate: 'GPU',
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'
    }
  },
  wasmPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm',
  initTimeout: 1000,
  minHandDetectionConfidence: 0.3,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.3
} as const

const canvasConfig: CanvasConfig = {
  width: 640,
  height: 480,
  backgroundColor: 0x000000
}

/** @description Configuração padrão da aplicação. */
export const defaultConfig: AppConfig = {
  core: {
    mediaPipe: mediaPipeCoreConfig,
    systemPerformance: systemPerformanceConfig,
    webcam: webcamConfig,
    canvas: canvasConfig
  },
  domains: { gestures: gestureConfig, midi: midiConfig, visuals: visualsConfig }
}
