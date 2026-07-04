import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { detectPinch, PinchData } from '@/app/domains/gesture/utils/gestureUtils.ts'
import { BaseGestureHandler, type HandlerPriority } from './BaseGestureHandler.ts'
import { IMidiService } from '@/app/domains/midi/IMidiService.ts'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService.ts'
import { MidiConfig } from '@/app/domains/midi'
import { GestureConfig } from '@/app/domains/gesture'
import { EffectQueue } from '@/app/shared/EffectQueue.ts'

/** @description Estado do gesto de pinça. */
export interface PinchState {
  isActive: boolean
  lastPosition: { x: number; y: number } | null
  currentNote: number | null
  currentNoteValue: number | null
}

/** @description Manipulador para o gesto de pinça, que controla a reprodução de notas. */
export class PinchGestureHandler extends BaseGestureHandler {
  readonly priority: HandlerPriority = 'high'
  private lastSmoothedPosition: { x: number; y: number } | null = null

  private pinchState: PinchState = {
    isActive: false,
    lastPosition: null,
    currentNote: null,
    currentNoteValue: null
  }

  constructor(
    midiService: IMidiService,
    visualsService: IVisualsService,
    midiConfig: MidiConfig,
    gestureConfig: GestureConfig,
    effectQueue: EffectQueue
  ) {
    super(midiService, visualsService, midiConfig, gestureConfig, effectQueue)
  }

  /** @description Processa os dados da mão para detectar e manipular o gesto de pinça. */
  process(handData: HandLandmarkerResult, _timestamp: number): void {
    const leftHandLandmarks = this.getLandmarksByHand(handData, 'Left')
    if (!leftHandLandmarks) {
      this.handlePinchRelease()
      return
    }
    const pinchData = detectPinch(leftHandLandmarks, this.gestureConfig.handGesture.pinch.threshold)
    const wasActive = this.pinchState.isActive
    const isActive = pinchData?.isActive ?? false

    if (pinchData) {
      let smoothedPos = pinchData.position
      if (this.lastSmoothedPosition) {
        const alpha = 0.35 // Baixa latência, ótima suavização
        smoothedPos = {
          x:
            this.lastSmoothedPosition.x +
            alpha * (pinchData.position.x - this.lastSmoothedPosition.x),
          y:
            this.lastSmoothedPosition.y +
            alpha * (pinchData.position.y - this.lastSmoothedPosition.y)
        }
      }
      this.lastSmoothedPosition = smoothedPos
      pinchData.position = smoothedPos

      // Always send CC100 for pinch distance if pinchData exists
      // pinchData.intensity goes from 0 (open) to 1 (closed)
      // Reverse it for Reverb: 0 (closed) to 1 (open)
      this.midiService.sendCC(100, (1 - pinchData.intensity) * this.midiConfig.maxValue)

      // Vibrato/modulation incremental quando a mão da pinça chega próximo ao topo (y < 0.15)
      const vibratoLimitY = 0.15
      const isTone = this.midiService.constructor.name === 'ToneService'
      const targetCC = isTone ? 11 : 1
      if (smoothedPos.y < vibratoLimitY) {
        const vibratoVal = (vibratoLimitY - smoothedPos.y) / vibratoLimitY
        const clampedVal = Math.min(1, Math.max(0, vibratoVal))
        this.midiService.sendCC(targetCC, clampedVal * this.midiConfig.maxValue)
      } else {
        this.midiService.sendCC(targetCC, 0)
      }
    } else {
      this.lastSmoothedPosition = null
      const isTone = this.midiService.constructor.name === 'ToneService'
      this.midiService.sendCC(isTone ? 11 : 1, 0)
    }

    if (isActive && !wasActive) {
      this.handlePinchStart(pinchData!)
    } else if (isActive && wasActive) {
      this.handlePinchContinue(pinchData!)
    } else if (!isActive && wasActive) {
      this.handlePinchRelease()
    }
  }

  /** @description Para o gesto de pinça, liberando a nota se estiver ativa. */
  stop(): void {
    this.handlePinchRelease()
  }

  /** @description Manipula o início do gesto de pinça. */
  private handlePinchStart(pinchData: NonNullable<PinchData>): void {
    this.pinchState.isActive = true
    this.pinchState.lastPosition = pinchData.position
    const { note: newNote, noteValue } = this.getCurrentMidiNote(pinchData.position)
    if (newNote !== null && newNote !== this.pinchState.currentNote) {
      this.midiService.playNote(pinchData.position.x, pinchData.position.y, pinchData.intensity)
      this.pinchState.currentNote = newNote
      this.pinchState.currentNoteValue = noteValue
    }
    this.createPinchBurstEffect(pinchData.position, pinchData.intensity)
  }

  /** @description Manipula a continuação do gesto de pinça. */
  private handlePinchContinue(pinchData: NonNullable<PinchData>): void {
    if (!this.pinchState.lastPosition || this.pinchState.currentNoteValue === null) return
    const { note: newNote, noteValue: newNoteValue } = this.getCurrentMidiNote(pinchData.position)
    const noteChanged = newNote !== null && newNote !== this.pinchState.currentNote
    const hysteresisPassed =
      Math.abs(newNoteValue - this.pinchState.currentNoteValue) > this.gestureConfig.noteHysteresis
    if (noteChanged && hysteresisPassed) {
      if (this.pinchState.lastPosition) {
        this.midiService.stopNote(this.pinchState.lastPosition.x, this.pinchState.lastPosition.y)
      }
      this.midiService.playNote(pinchData.position.x, pinchData.position.y, pinchData.intensity)
      this.pinchState.currentNote = newNote
      this.pinchState.currentNoteValue = newNoteValue
    }
    this.pinchState.lastPosition = pinchData.position
    this.createPinchBurstEffect(
      pinchData.position,
      pinchData.intensity * this.gestureConfig.continuousEffectIntensity
    )
  }

  /** @description Manipula a liberação do gesto de pinça. */
  private handlePinchRelease(): void {
    if (!this.pinchState.isActive) return
    this.pinchState.isActive = false
    if (this.pinchState.lastPosition) {
      this.midiService.stopNote(this.pinchState.lastPosition.x, this.pinchState.lastPosition.y)
    }
    this.pinchState.lastPosition = null
    this.pinchState.currentNote = null
    this.pinchState.currentNoteValue = null
    this.midiService.stopAllNotes()

    const isTone = this.midiService.constructor.name === 'ToneService'
    this.midiService.sendCC(isTone ? 11 : 1, 0)
  }

  /** @description Obtém a nota MIDI atual com base na posição do gesto. */
  private getCurrentMidiNote(position: { x: number; y: number }): {
    note: number | null
    noteValue: number
  } {
    return this.midiService.gestureToNote(position.x, position.y)
  }

  /** @description Adiciona um efeito visual de explosão à fila de efeitos. */
  private createPinchBurstEffect(position: { x: number; y: number }, intensity: number): void {
    this.effectQueue.push({
      type: 'pinchBurst',
      x: position.x,
      y: position.y,
      intensity
    })
  }
}
