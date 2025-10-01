import { HandLandmarkerResult } from '@mediapipe/tasks-vision'

/** @description Normaliza um número de um intervalo para outro. */
export function normalize(
  value: number,
  min: number,
  max: number,
  from: number = 0,
  to: number = 1
): number {
  if (min === max) {
    return 0
  }
  const proportion = (value - min) / (max - min)
  return Math.max(from, Math.min(to, proportion))
}

/** @description Restringe um número a um intervalo [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** @description Garante que as coordenadas dos landmarks da mão estejam no intervalo [0, 1]. */
export function normalizeHandLandmarks(handData: HandLandmarkerResult): HandLandmarkerResult {
  for (const landmarks of handData.landmarks) {
    for (const landmark of landmarks) {
      landmark.x = clamp(landmark.x, 0, 1)
      landmark.y = clamp(landmark.y, 0, 1)
      landmark.z = clamp(landmark.z ?? 0, 0, 1)
    }
  }
  return handData
}