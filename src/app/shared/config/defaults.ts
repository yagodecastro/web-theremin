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
  tonic: 'A',
  baseOctave: 3,
  scale: 'minor pentatonic',
  octaveRange: 3
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

// BASE_URL é '/' em dev/Vercel e '/web-theremin/' no build do GitHub Pages (sempre termina com '/').
// Usar BASE_URL garante que os assets do MediaPipe sejam resolvidos corretamente em qualquer base path.
const mediaPipePath = (suffix: string) => `${import.meta.env.BASE_URL}${suffix}`

const mediaPipeCoreConfig: MediaPipeConfig = {
  handLandmarkerOptions: {
    runningMode: 'VIDEO',
    numHands: 2,
    baseOptions: {
      delegate: 'GPU',
      // Modelo servido localmente — elimina round-trip ao CDN na inicialização
      modelAssetPath: mediaPipePath('mediapipe/hand_landmarker.task')
    }
  },
  // WASM servido localmente de /public/mediapipe/wasm/ (copiado de node_modules em postinstall)
  wasmPath: mediaPipePath('mediapipe/wasm'),
  initTimeout: 1000,
  minHandDetectionConfidence: 0.3,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.3,
  // 10 fps é suficiente para rastrear olhos — reduz carga da CPU vs. 15 fps anterior
  faceDetectionFps: 10
}

const canvasConfig: CanvasConfig = {
  width: 640,
  height: 480,
  backgroundColor: 0x000000
}

/** @description Retorna a configuração da aplicação com base no perfil de desempenho. */
export function getAppConfig(lowPerformance: boolean): AppConfig {
  const customWebcam: WebcamConfig = {
    ...webcamConfig,
    width: lowPerformance ? { ideal: 480 } : { ideal: 640 },
    height: lowPerformance ? { ideal: 360 } : { ideal: 480 },
    frameRate: lowPerformance ? { ideal: 15, max: 20 } : { ideal: 30, max: 60 }
  }

  const customPerformance: SystemPerformanceConfig = {
    targetFPS: lowPerformance ? 15 : (webcamConfig.frameRate?.ideal ?? 30),
    maxParticles: lowPerformance ? 600 : 5000,
    poolSize: lowPerformance ? 100 : 500,
    maxParticlesPerEffect: lowPerformance ? 25 : 150,
    maxTextureCacheSize: lowPerformance ? 30 : 100,
    lowPerformance
  }

  const customMediaPipe: MediaPipeConfig = {
    ...mediaPipeCoreConfig,
    // Desativa a detecção facial em modo de baixo desempenho para evitar carregar/executar BlazeFace
    faceDetectionFps: lowPerformance ? 0 : 10
  }

  return {
    core: {
      mediaPipe: customMediaPipe,
      systemPerformance: customPerformance,
      webcam: customWebcam,
      canvas: canvasConfig
    },
    domains: {
      gestures: gestureConfig,
      midi: midiConfig,
      visuals: visualsConfig
    }
  }
}

/** @description Configuração padrão da aplicação. */
export const defaultConfig: AppConfig = getAppConfig(false)
