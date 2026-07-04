import type { HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  getPalmCenter,
  getThreeFingersOpenness,
  HandednessType
} from '@/app/domains/gesture/utils/gestureUtils.ts'
import type { MidiConfig } from '@/app/domains/midi'
import { BaseGestureHandler, type HandlerPriority } from './BaseGestureHandler.ts'
import { GestureConfig } from '@/app/domains/gesture'
import { IMidiService } from '@/app/domains/midi/IMidiService.ts'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService.ts'
import { EffectQueue } from '@/app/shared/EffectQueue.ts'

/** @description Manipulador para gestos de modulação da mão, como abertura e posição. */
export class HandModulationHandler extends BaseGestureHandler {
  readonly priority: HandlerPriority = 'medium'
  private lastValues: Map<string, { x: number; y: number; openness: number }> = new Map()
  private lastSmoothedValues: Map<string, { x: number; y: number; openness: number }> = new Map()
  // Guarda o timestamp do último processamento MIDI por mão (em DOMHighResTimeStamp)
  private lastProcessTimestamp: Map<string, number> = new Map()
  private readonly throttleInterval: number = 16 // ms, aprox 60fps

  constructor(
    midiService: IMidiService,
    visualsService: IVisualsService,
    midiConfig: MidiConfig,
    gestureConfig: GestureConfig,
    effectQueue: EffectQueue
  ) {
    super(midiService, visualsService, midiConfig, gestureConfig, effectQueue)
    // TODO: Idealmente, o valor de throttleInterval viria de gestureConfig
    // this.throttleInterval = gestureConfig.throttleInterval;
  }

  /** @description Processa os dados de modulação da mão para ambas as mãos, com throttling.
   *
   * Usa o timestamp do rAF (DOMHighResTimeStamp) em vez de Date.now() —
   * maior precisão e menor overhead no hot path.
   */
  process(handData: HandLandmarkerResult, timestamp: number): void {
    handData.handednesses.forEach((hand, index) => {
      const landmarks = handData.landmarks[index]
      const handName = hand[0]?.categoryName as HandednessType
      if (handName !== 'Left' && handName !== 'Right') {
        return
      }
      const openness = getThreeFingersOpenness(landmarks)

      // O efeito visual continua em todos os frames para manter a fluidez.
      if (openness !== null) {
        this.createHandVisualEffect(landmarks, openness, handName)
      }

      const lastTimestamp = this.lastProcessTimestamp.get(handName) ?? 0
      if (timestamp - lastTimestamp < this.throttleInterval) {
        return // Pula o processamento MIDI se estiver dentro do intervalo de throttle.
      }

      // Aplica o filtro de média móvel exponencial (EMA) para suavizar tremidos da mão e ruídos da câmera
      const rawPosition = getPalmCenter(landmarks)
      const rawOpenness = openness ?? 0
      const lastSmoothed = this.lastSmoothedValues.get(handName) || {
        x: rawPosition.x,
        y: rawPosition.y,
        openness: rawOpenness
      }

      const alpha = 0.25 // Fator de suavização (menor = mais suave, maior = mais reativo)
      const smoothedX = lastSmoothed.x + alpha * (rawPosition.x - lastSmoothed.x)
      const smoothedY = lastSmoothed.y + alpha * (rawPosition.y - lastSmoothed.y)
      const smoothedOpenness =
        openness !== null
          ? lastSmoothed.openness + alpha * (rawOpenness - lastSmoothed.openness)
          : lastSmoothed.openness

      this.lastSmoothedValues.set(handName, {
        x: smoothedX,
        y: smoothedY,
        openness: smoothedOpenness
      })

      if (this.hasSignificantChange(smoothedX, smoothedY, smoothedOpenness, handName)) {
        this.processMidi(
          smoothedX,
          smoothedY,
          openness !== null ? smoothedOpenness : null,
          handName
        )
        this.lastProcessTimestamp.set(handName, timestamp)
      }
    })
  }

  /** @description Verifica se houve uma mudança significativa na posição ou abertura da mão. */
  private hasSignificantChange(
    smoothedX: number,
    smoothedY: number,
    smoothedOpenness: number,
    handName: string
  ): boolean {
    const last = this.lastValues.get(handName) ?? { x: 0, y: 0, openness: 0 }
    const xChanged = Math.abs(smoothedX - last.x) > this.gestureConfig.significantMovementChange
    const yChanged = Math.abs(smoothedY - last.y) > this.gestureConfig.significantMovementChange
    const opennessChanged =
      Math.abs(smoothedOpenness - last.openness) > this.gestureConfig.significantMovementChange
    if (xChanged || yChanged || opennessChanged) {
      this.lastValues.set(handName, { x: smoothedX, y: smoothedY, openness: smoothedOpenness })
      return true
    }
    return false
  }

  /** @description Processa e envia os comandos MIDI correspondentes à modulação da mão. */
  private processMidi(
    smoothedX: number,
    smoothedY: number,
    smoothedOpenness: number | null,
    handName: 'Left' | 'Right'
  ): void {
    if (handName === 'Left') {
      const config = this.midiConfig.controlChanges.left
      this.sendMidiCC(config.y, smoothedY)
      if (smoothedOpenness !== null) {
        this.sendMidiCC(config.handOpenness, smoothedOpenness)
      }
    } else {
      const config = this.midiConfig.controlChanges.right
      this.sendMidiCC(config.x, smoothedX)
      this.sendMidiCC(config.y, smoothedY)
      if (smoothedOpenness !== null) {
        this.sendMidiCC(config.handOpenness, smoothedOpenness)
      }
    }
  }

  /** @description Envia uma mensagem de Control Change (CC) MIDI. */
  private sendMidiCC(cc: number, value: number): void {
    this.midiService.sendCC(cc, value * this.midiConfig.maxValue)
  }

  /** @description Adiciona um efeito visual de modulação da mão à fila de efeitos. */
  private createHandVisualEffect(
    landmarks: NormalizedLandmark[],
    threeFingerOpenness: number,
    handName: HandednessType
  ): void {
    const middleFingerBase = getPalmCenter(landmarks)
    this.effectQueue.push({
      type: 'handModulation',
      x: middleFingerBase.x,
      y: middleFingerBase.y,
      intensity: threeFingerOpenness,
      landmarks: landmarks,
      handedness: handName
    })
  }
}
