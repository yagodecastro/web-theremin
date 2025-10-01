import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { IGestureDetector } from '@/app/domains/gesture/IGestureDetector.ts'
import { normalizeHandLandmarks } from '@/app/shared/utils/utils'
import { MediaPipeConfig, WebcamConfig } from '@/app/core'

/** @description Serviço para detecção gestual que combina webcam e MediaPipe. */
export class GestureDetector implements IGestureDetector {
  private gestureRecognizer: HandLandmarker | null = null
  private videoElement: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private isReady = false
  private isProcessing = false
  private isMediaPipeReady = false
  private lastVideoTime = -1
  private healthCheckCallback?: (error: Error) => void

  constructor(
    private webcamConfig: WebcamConfig,
    private mediaPipeConfig: MediaPipeConfig
  ) {}

  /** @description Registra um callback para monitoramento de saúde do serviço. */
  setHealthCheckCallback(callback: (error: Error) => void): void {
    this.healthCheckCallback = callback
  }

  /** @description Notifica sobre problemas de saúde do sistema. */
  private notifyHealthIssue(error: Error): void {
    if (this.healthCheckCallback) {
      this.healthCheckCallback(error)
    }
  }

  /** @description Lista as câmeras disponíveis no dispositivo. */
  static async getAvailableCameras(): Promise<Array<{ deviceId: string; label: string }>> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`
        }))
    } catch (error) {
      console.error('Erro ao listar câmeras:', error)
      return []
    }
  }

  /** @description Inicializa a webcam e o MediaPipe. */
  async initialize(videoElement: HTMLVideoElement, deviceId?: string): Promise<void> {
    try {
      this.videoElement = videoElement
      await this.initWebcam(deviceId)
      await this.initMediaPipe()
      this.isReady = true
    } catch (error) {
      console.error('Erro ao inicializar GestureDetector:', error)
      throw error
    }
  }

  /** @description Inicializa a webcam e o stream de vídeo. */
  private async initWebcam(deviceId?: string): Promise<void> {
    const videoConstraints: MediaTrackConstraints = {
      width: this.webcamConfig.width,
      height: this.webcamConfig.height,
      frameRate: this.webcamConfig.frameRate
    }
    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId }
    } else {
      videoConstraints.facingMode = this.webcamConfig.facingMode
    }
    const constraints: MediaStreamConstraints = { video: videoConstraints, audio: false }
    this.stream = await navigator.mediaDevices.getUserMedia(constraints)
    this.videoElement!.srcObject = this.stream
    this.setupStreamMonitoring()
    await new Promise<void>((resolve, reject) => {
      this.videoElement!.onloadedmetadata = () => {
        this.videoElement!.play().then(resolve).catch(reject)
      }
      this.videoElement!.onerror = reject
    })
  }

  /** @description Inicializa o HandLandmarker do MediaPipe. */
  private async initMediaPipe(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(this.mediaPipeConfig.wasmPath)
    this.gestureRecognizer = await HandLandmarker.createFromOptions(
      vision,
      this.mediaPipeConfig.handLandmarkerOptions
    )
    await new Promise(resolve => setTimeout(resolve, this.mediaPipeConfig.initTimeout))
    this.isMediaPipeReady = true
  }

  /** @description Detecta mãos no frame de vídeo atual. */
  async detectHands(): Promise<HandLandmarkerResult | null> {
    if (
      !this.isReady ||
      !this.gestureRecognizer ||
      !this.videoElement ||
      this.isProcessing ||
      !this.isMediaPipeReady
    ) {
      return null
    }
    if (this.videoElement.currentTime === this.lastVideoTime) {
      return null
    }
    this.isProcessing = true
    try {
      const timestamp = performance.now()
      this.lastVideoTime = this.videoElement.currentTime
      let handData = this.gestureRecognizer.detectForVideo(this.videoElement, timestamp)
      if (!this.isValidLandmarkData(handData)) {
        return null
      }
      if (handData && handData.landmarks.length > 0) {
        handData = normalizeHandLandmarks(handData)
      }
      return handData
    } catch (error) {
      console.error('Erro ao processar frame:', error)
      return null
    } finally {
      this.isProcessing = false
    }
  }

  /** @description Para o serviço e libera todos os recursos. */
  async stop(): Promise<void> {
    if (this.gestureRecognizer) {
      this.gestureRecognizer.close()
      this.gestureRecognizer = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null
    }
    this.isReady = false
    this.isProcessing = false
    this.isMediaPipeReady = false
    this.lastVideoTime = -1
  }

  /** @description Valida se os dados de landmarks da mão são consistentes. */
  private isValidLandmarkData(handData: HandLandmarkerResult | null): boolean {
    if (!handData || !handData.landmarks || handData.landmarks.length === 0) {
      return true
    }
    for (const landmarks of handData.landmarks) {
      if (landmarks.length !== 21) {
        console.warn(
          `Dados de landmark inválidos: esperado 21 landmarks, mas obteve ${landmarks.length}`
        )
        return false
      }
    }
    return true
  }

  /** @description Troca para uma câmera específica pelo ID do dispositivo. */
  async switchCamera(deviceId: string): Promise<void> {
    if (!this.videoElement) {
      throw new Error('VideoElement não foi inicializado')
    }
    try {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop())
      }
      this.lastVideoTime = -1
      await this.initWebcam(deviceId)
    } catch (error) {
      console.error('Erro ao trocar câmera:', error)
      throw error
    }
  }

  /** @description Configura o monitoramento de saúde do stream de vídeo. */
  private setupStreamMonitoring(): void {
    if (!this.stream) return
    this.stream.getTracks().forEach(track => {
      track.addEventListener('ended', () => {
        this.notifyHealthIssue(new Error('Câmera foi desconectada'))
      })
      track.addEventListener('mute', () => {
        this.notifyHealthIssue(new Error('Câmera foi silenciada - possível problema de permissão'))
      })
    })
    if (this.videoElement) {
      this.videoElement.addEventListener('error', event => {
        console.error('[GestureDetector] Video element error:', event)
        this.notifyHealthIssue(new Error('Erro no elemento de vídeo'))
      })
    }
  }
}
