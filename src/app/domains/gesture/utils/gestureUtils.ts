import { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { HandLandmark } from '@/constants/mediapipe-hand'

export type HandednessType = 'Left' | 'Right'
/** @description Tipo para os nomes dos dedos. */
export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky'

/** @description Configuração dos dedos para cálculo de abertura. */
const FINGER_CONFIG: Record<
  FingerName,
  { opennessCalc: readonly [HandLandmark, HandLandmark, HandLandmark] }
> = {
  thumb: {
    opennessCalc: [HandLandmark.THUMB_TIP, HandLandmark.THUMB_IP, HandLandmark.THUMB_MCP] as const
  },
  index: {
    opennessCalc: [HandLandmark.INDEX_TIP, HandLandmark.INDEX_PIP, HandLandmark.INDEX_MCP] as const
  },
  middle: {
    opennessCalc: [
      HandLandmark.MIDDLE_TIP,
      HandLandmark.MIDDLE_PIP,
      HandLandmark.MIDDLE_MCP
    ] as const
  },
  ring: {
    opennessCalc: [HandLandmark.RING_TIP, HandLandmark.RING_PIP, HandLandmark.RING_MCP] as const
  },
  pinky: {
    opennessCalc: [HandLandmark.PINKY_TIP, HandLandmark.PINKY_PIP, HandLandmark.PINKY_MCP] as const
  }
}

/** @description Mapeamento de nomes de dedos para os landmarks usados no cálculo de abertura. */
const FINGER_LANDMARKS_MAP = Object.fromEntries(
  (Object.keys(FINGER_CONFIG) as FingerName[]).map(name => [name, FINGER_CONFIG[name].opennessCalc])
) as Record<FingerName, readonly [HandLandmark, HandLandmark, HandLandmark]>

/** @description Dados do gesto de pinça. */
export interface PinchData {
  isActive: boolean
  intensity: number
  position: { x: number; y: number }
}

/** @description Detecta o gesto de pinça na mão. */
export function detectPinch(landmarks: NormalizedLandmark[], threshold = 0.05): PinchData | null {
  const thumbTip = landmarks?.[HandLandmark.THUMB_TIP]
  const indexTip = landmarks?.[HandLandmark.INDEX_TIP]
  if (!thumbTip || !indexTip) {
    return null
  }
  const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y)
  return {
    isActive: distance < threshold,
    intensity: Math.max(0, 1 - distance / threshold),
    position: { x: indexTip.x, y: indexTip.y }
  }
}

/** @description Calcula a abertura de um dedo. */
function calculateFingerOpenness(
  tip: NormalizedLandmark,
  pip: NormalizedLandmark,
  mcp: NormalizedLandmark
): number {
  const a = getDistance(pip, tip)
  const c = getDistance(mcp, pip)
  const b = getDistance(mcp, tip)
  const cosAngle = (a * a + c * c - b * b) / (2 * a * c + 1e-6)
  const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)))
  return angleRad / Math.PI
}

/** @description Calcula a abertura da mão com base nos dedos especificados. */
export function getThreeFingersOpenness(landmarks: NormalizedLandmark[]): number {
  if (!landmarks || landmarks.length !== 21) {
    return 0
  }
  const fingers: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky']
  const totalOpenness = fingers.reduce((sum, finger) => {
    const [tipIdx, pipIdx, mcpIdx] = FINGER_LANDMARKS_MAP[finger]
    return sum + calculateFingerOpenness(landmarks[tipIdx], landmarks[pipIdx], landmarks[mcpIdx])
  }, 0)
  return totalOpenness / fingers.length
}

/** @description Calcula o ponto central da palma da mão. */
export function getPalmCenter(landmarks: NormalizedLandmark[]): { x: number; y: number } {
  const point0 = landmarks[0]
  const point5 = landmarks[5]
  return {
    x: (point0.x + point5.x) / 2,
    y: (point0.y + point5.y) / 2
  }
}

/** @description Calcula a distância euclidiana 2D entre dois landmarks. */
function getDistance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y)
}