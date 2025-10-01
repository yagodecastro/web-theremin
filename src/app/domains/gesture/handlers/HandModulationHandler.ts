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
import { AppStore } from '@/stores/appStore.ts'

/** @description Manipulador para gestos de modulação da mão, como abertura e posição. */
export class HandModulationHandler extends BaseGestureHandler {
  readonly priority: HandlerPriority = 'medium'
  private lastValues: Map<string, { x: number; y: number; openness: number }> = new Map()
  private lastProcessTime: Map<string, number> = new Map()
  private readonly throttleInterval: number = 16 // ms, aprox 60fps

  constructor(
    midiService: IMidiService,
    visualsService: IVisualsService,
    midiConfig: MidiConfig,
    gestureConfig: GestureConfig,
    private store: AppStore
  ) {
    super(midiService, visualsService, midiConfig, gestureConfig)
    // TODO: Idealmente, o valor de throttleInterval viria de gestureConfig
    // this.throttleInterval = gestureConfig.throttleInterval;
  }

  /** @description Processa os dados de modulação da mão para ambas as mãos, com throttling. */
  process(handData: HandLandmarkerResult): void {
    const now = Date.now()
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

      const lastTime = this.lastProcessTime.get(handName) ?? 0
      if (now - lastTime < this.throttleInterval) {
        return // Pula o processamento MIDI se estiver dentro do intervalo de throttle.
      }

      if (this.hasSignificantChange(landmarks, handName)) {
        this.processMidi(landmarks, handName, openness)
        this.lastProcessTime.set(handName, now)
      }
    })
  }

  /** @description Verifica se houve uma mudança significativa na posição ou abertura da mão. */
  private hasSignificantChange(landmarks: NormalizedLandmark[], handName: string): boolean {
    const wrist = landmarks[0]
    const openness = getThreeFingersOpenness(landmarks) ?? 0
    const last = this.lastValues.get(handName) ?? { x: 0, y: 0, openness: 0 }
    const xChanged = Math.abs(wrist.x - last.x) > this.gestureConfig.significantMovementChange
    const yChanged = Math.abs(wrist.y - last.y) > this.gestureConfig.significantMovementChange
    const opennessChanged =
      Math.abs(openness - last.openness) > this.gestureConfig.significantMovementChange
    if (xChanged || yChanged || opennessChanged) {
      this.lastValues.set(handName, { x: wrist.x, y: wrist.y, openness })
      return true
    }
    return false
  }

  /** @description Processa e envia os comandos MIDI correspondentes à modulação da mão. */
  private processMidi(
    landmarks: NormalizedLandmark[],
    handName: 'Left' | 'Right',
    openness: number | null
  ): void {
    const position = getPalmCenter(landmarks)
    if (handName === 'Left') {
      const config = this.midiConfig.controlChanges.left
      this.sendMidiCC(config.y, position.y)
      if (openness !== null) {
        this.sendMidiCC(config.handOpenness, openness)
      }
    } else {
      const config = this.midiConfig.controlChanges.right
      this.sendMidiCC(config.x, position.x)
      this.sendMidiCC(config.y, position.y)
      if (openness !== null) {
        this.sendMidiCC(config.handOpenness, openness)
      }
    }
  }

  /** @description Envia uma mensagem de Control Change (CC) MIDI. */
  private sendMidiCC(cc: number, value: number): void {
    this.midiService.sendCC(cc, value * this.midiConfig.maxValue)
  }

  /** @description Adiciona um efeito visual de modulação da mão à fila do store. */
  private createHandVisualEffect(
    landmarks: NormalizedLandmark[],
    threeFingerOpenness: number,
    handName: HandednessType
  ): void {
    const middleFingerBase = getPalmCenter(landmarks)
    this.store.addVisualEffect({
      type: 'handModulation',
      x: middleFingerBase.x,
      y: middleFingerBase.y,
      intensity: threeFingerOpenness,
      landmarks: landmarks,
      handedness: handName
    })
  }
}