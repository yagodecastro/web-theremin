import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { detectPinch, PinchData } from '@/app/domains/gesture/utils/gestureUtils.ts'
import { BaseGestureHandler, type HandlerPriority } from './BaseGestureHandler.ts'
import { IMidiService } from '@/app/domains/midi/IMidiService.ts'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService.ts'
import { MidiConfig } from '@/app/domains/midi'
import { GestureConfig } from '@/app/domains/gesture'
import { AppStore } from '@/stores/appStore.ts'

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
    private store: AppStore
  ) {
    super(midiService, visualsService, midiConfig, gestureConfig)
  }

  /** @description Processa os dados da mão para detectar e manipular o gesto de pinça. */
  process(handData: HandLandmarkerResult): void {
    const leftHandLandmarks = this.getLandmarksByHand(handData, 'Left')
    if (!leftHandLandmarks) {
      this.handlePinchRelease()
      return
    }
    const pinchData = detectPinch(leftHandLandmarks, this.gestureConfig.handGesture.pinch.threshold)
    const wasActive = this.pinchState.isActive
    const isActive = pinchData?.isActive ?? false
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
  }

  /** @description Obtém a nota MIDI atual com base na posição do gesto. */
  private getCurrentMidiNote(position: { x: number; y: number }): {
    note: number | null
    noteValue: number
  } {
    return this.midiService.gestureToNote(position.x, position.y)
  }

  /** @description Adiciona um efeito visual de explosão à fila do store. */
  private createPinchBurstEffect(position: { x: number; y: number }, intensity: number): void {
    this.store.addVisualEffect({
      type: 'pinchBurst',
      x: position.x,
      y: position.y,
      intensity
    })
  }
}