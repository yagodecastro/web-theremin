import { MidiService } from '@/app/domains/midi/MidiService'
import { VisualsService } from '@/app/domains/visuals/VisualsService'
import { GestureService } from '@/app/domains/gesture'
import { ServiceOrchestrator } from '@/app/core/ServiceOrchestrator'
import { defaultConfig } from '@/app/shared/config/defaults'
import { AppConfig } from '@/app/core/index'
import { AppStore } from '@/stores/appStore'
import { IGestureService } from '@/app/domains/gesture/IGestureService'
import { IMidiService } from '@/app/domains/midi/IMidiService'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService'
import { LogType } from 'vite'

/** @description Controla o ciclo de vida e o fluxo de dados central da aplicação. */
export class AppController {
  private readonly gestureService: IGestureService
  private readonly midiService: IMidiService
  private readonly visualsService: IVisualsService
  private readonly serviceOrchestrator: ServiceOrchestrator

  /** @description Constrói o AppController com suas dependências. */
  constructor(
    private config: AppConfig = defaultConfig,
    private store: AppStore
  ) {
    this.midiService = this.setupMidiService()
    this.visualsService = this.setupVisualsService()
    this.gestureService = this.setupGestureService()
    this.serviceOrchestrator = this.setupServiceOrchestrator()
  }

  /** @description Inicializa todos os serviços da aplicação e detecta dispositivos disponíveis. */
  async initialize(
    videoElement: HTMLVideoElement,
    visualsCanvas: HTMLCanvasElement
  ): Promise<{ midiOutputs: string[]; cameras: Array<{ deviceId: string; label: string }> }> {
    this.store.setStatus('initializing')
    try {
      await Promise.all([
        this.gestureService.initialize(videoElement),
        this.visualsService.initialize(visualsCanvas)
      ])
      const devices = await this.detectAvailableDevices()
      await this.connectMidi()
      this.store.setStatus('ready')
      return devices
    } catch (error) {
      this.handleError(error, 'error')
      throw error
    }
  }

  /** @description Inicia o loop de processamento principal da aplicação. */
  async start(): Promise<void> {
    if (this.store.status !== 'ready') {
      this.store.addSystemLog('error', 'Sistema não está pronto para iniciar.')
      return
    }
    this.serviceOrchestrator.start()
  }

  /** @description Para o loop de processamento principal. */
  stop(): void {
    this.serviceOrchestrator.stop()
  }

  /** @description Para todos os serviços e libera os recursos associados. */
  async destroy(): Promise<void> {
    this.stop()
    await Promise.all([
      this.gestureService.stop(),
      this.midiService.stop(),
      this.visualsService.stop()
    ])
  }

  /** @description Conecta a um dispositivo de saída MIDI. */
  async connectMidi(deviceName?: string): Promise<void> {
    try {
      await this.midiService.connect(deviceName)
    } catch (error) {
      this.handleError(error, 'error', 'Erro ao conectar MIDI')
    }
  }

  /** @description Altera a escala musical para mapear gestos em notas. */
  setScale(scaleName: string): void {
    this.midiService.setScale(scaleName)
  }

  /** @description Define a oitava base para a geração de notas. */
  setBaseOctave(octave: number): void {
    this.midiService.setBaseOctave(octave)
  }

  /** @description Troca para um dispositivo de câmera diferente. */
  async switchCamera(deviceId: string): Promise<void> {
    await this.serviceOrchestrator.switchCamera(deviceId)
  }

  /** @description Envia uma nota de teste para o dispositivo MIDI para verificar a conexão. */
  testMidi(): void {
    this.midiService.testConnection()
  }

  /** @description Envia um comando "All Notes Off" para silenciar todo o som MIDI. */
  panicMidi(): void {
    this.midiService.panicStop()
    this.store.addSystemLog('warn', 'PANIC STOP executado - todo áudio MIDI parado')
  }

  /** @description Configura e retorna o serviço de gestos. */
  private setupGestureService = (): IGestureService => {
    return new GestureService(this.config, this.midiService, this.visualsService, this.store)
  }

  /** @description Configura e retorna o serviço MIDI. */
  private setupMidiService = (): IMidiService => {
    return new MidiService(this.config.domains.midi)
  }

  /** @description Configura e retorna o serviço de visuais. */
  private setupVisualsService = (): IVisualsService => {
    return new VisualsService(
      this.config.core.canvas,
      this.config.core.systemPerformance,
      this.config.domains.visuals,
      this.store
    )
  }

  /** @description Configura e retorna o orquestrador de serviços. */
  private setupServiceOrchestrator = (): ServiceOrchestrator => {
    return new ServiceOrchestrator(
      this.config,
      this.gestureService,
      this.midiService,
      this.visualsService,
      this.store
    )
  }

  /** @description Detecta e retorna os dispositivos de saída MIDI e câmeras disponíveis. */
  private async detectAvailableDevices(): Promise<{
    midiOutputs: string[]
    cameras: Array<{ deviceId: string; label: string }>
  }> {
    try {
      await MidiService.enableWebMidi()
      const midiOutputs = MidiService.getAvailableOutputs().map(output => output.name)
      const cameras = await GestureService.getAvailableCameras()
      return { midiOutputs, cameras }
    } catch (error) {
      this.handleError(error, 'error', 'Erro ao detectar dispositivos')
      throw error
    }
  }

  /** @description Centraliza o tratamento de erros, atualizando o estado e registrando logs. */
  private handleError(error: unknown, type: LogType, logPrefix = ''): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const finalMessage = logPrefix ? `${logPrefix}: ${errorMessage}` : errorMessage
    if (type === 'error') {
      this.store.setStatus('error', finalMessage)
    } else {
      this.store.addSystemLog('error', finalMessage)
    }
  }
}
