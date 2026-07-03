import { AsciiFilter, HslAdjustmentFilter, RGBSplitFilter } from 'pixi-filters'
import { Application, Color, Container, Graphics, Texture, Sprite } from 'pixi.js'
import { CanvasConfig, EffectOptions, PooledParticle } from './visualEffects'
import { HandednessType } from '@/app/domains/gesture/utils/gestureUtils.ts'
import { createHandModulationEffect } from './visualEffects/handModulationUtils.ts'
import { createPinchBurstEffect } from './visualEffects/pinchBurstUtils.ts'
import { IVisualsService } from '@/app/domains/visuals/IVisualsService.ts'
import { SystemPerformanceConfig } from '@/app/core'
import {
  PinchBurstEffectData,
  VisualEffect,
  VisualEffectsConfig
} from '@/app/domains/visuals/index.ts'
import { EffectQueue } from '@/app/shared/EffectQueue.ts'

/** @description Gerencia a renderização de efeitos visuais com pooling de partículas e cache de texturas. */
export class VisualsService implements IVisualsService {
  private app: Application | null = null
  private particleContainer: Container | null = null
  private particlePool: PooledParticle[] = []
  private activeParticles: PooledParticle[] = []
  private textureCache: Map<string, Texture> = new Map()
  private textureUsage: Map<string, number> = new Map()
  private fadeOverlay: Graphics | null = null
  private constellationGraphics: Graphics | null = null
  private videoSprite: Sprite | null = null
  private asciiFilter: AsciiFilter | null = null
  private hslFilter: HslAdjustmentFilter | null = null
  private rgbSplitFilter: RGBSplitFilter | null = null
  private time: number = 0
  private interactionIntensity: number = 0 // Mede a atividade das mãos para modular a câmera
  private currentLeftEye: { x: number; y: number } | null = null
  private currentRightEye: { x: number; y: number } | null = null
  private targetLeftEye: { x: number; y: number } | null = null
  private targetRightEye: { x: number; y: number } | null = null
  private eyeDetectionTimeout: number = 0

  constructor(
    public readonly canvasConfig: CanvasConfig,
    public readonly systemPerformance: SystemPerformanceConfig,
    public readonly visualEffectsConfig: VisualEffectsConfig,
    // EffectQueue plain (não-reativo) substitui AppStore para comunicação de efeitos.
    // Elimina ~60 disparos do sistema de reatividade Vue/Pinia por segundo.
    private readonly effectQueue: EffectQueue,
    public readonly getPoeticMode: () => 'classic' | 'synesthesia' | 'constellation' = () =>
      'classic',
    private readonly getCameraOpacity: () => number = () => 0.6,
    private readonly getShowCamera: () => boolean = () => true
  ) {}

  /** @description Inicializa a aplicação Pixi.js e o pool de partículas. */
  async initialize(canvas: HTMLCanvasElement, videoElement?: HTMLVideoElement): Promise<void> {
    try {
      this.app = new Application()
      await this.app.init({
        canvas,
        width: this.canvasConfig.width,
        height: this.canvasConfig.height,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        backgroundColor: this.canvasConfig.backgroundColor,
        backgroundAlpha: 0,
        clearBeforeRender: true
      })

      if (videoElement) {
        // Usa Texture.from para criar textura a partir do elemento de video
        const videoTexture = await Texture.from(videoElement)
        this.videoSprite = new Sprite(videoTexture)
        this.videoSprite.width = this.canvasConfig.width
        this.videoSprite.height = this.canvasConfig.height
        // Removemos o flip interno do WebGL porque o canvas inteiro 
        // já é flipado via CSS (-scale-x-100) para espelhar a imagem corretamente!
        this.app.stage.addChild(this.videoSprite)
        
        this.asciiFilter = new AsciiFilter(12)
        
        this.hslFilter = new HslAdjustmentFilter({
          hue: 0,
          saturation: 0.5,
          lightness: 0,
          colorize: false,
          alpha: 1
        })
        
        this.rgbSplitFilter = new RGBSplitFilter({
          red: { x: -5, y: 0 },
          green: { x: 0, y: 5 },
          blue: { x: 5, y: 0 }
        })
      }

      this.constellationGraphics = new Graphics()
      this.constellationGraphics.blendMode = 'add'
      this.app.stage.addChild(this.constellationGraphics)

      this.particleContainer = new Container()
      this.app.stage.addChild(this.particleContainer)
      this.initializePool()
    } catch (error) {
      console.error('Erro ao inicializar VisualsService:', error)
      throw error
    }
  }

  /** @description Emite um efeito visual de modulação da mão. */
  public emitHandModulation(options: EffectOptions): void {
    if (!this.particleContainer) return
    const canvasOptions = {
      ...options,
      x: options.x * this.canvasConfig.width,
      y: options.y * this.canvasConfig.height
    }
    createHandModulationEffect(canvasOptions, this)
  }

  /** @description Emite um efeito visual de explosão para o gesto de pinça. */
  public emitPinchBurst(options: Omit<PinchBurstEffectData, 'type'>): void {
    if (!this.particleContainer) return
    const canvasOptions = {
      ...options,
      x: options.x * this.canvasConfig.width,
      y: options.y * this.canvasConfig.height
    }
    createPinchBurstEffect(canvasOptions, this)
  }

  /** @description Cria e armazena em cache uma textura de forma para reutilização. */
  public createShapeTexture(
    color: Color,
    size: number,
    shape: 'circle' | 'square' | 'triangle' = 'circle',
    handedness?: HandednessType
  ): Texture {
    const cacheKey = `${handedness}_${color.toHex()}_${size}_${shape}`
    this.textureUsage.set(cacheKey, Date.now())
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!
    }
    this.evictCacheIfNeeded()
    const graphics = new Graphics()
    
    if (shape === 'square') {
      graphics.rect(-size / 2, -size / 2, size, size)
    } else if (shape === 'triangle') {
      const half = size / 2
      // Desenha um triângulo equilátero apontando para cima
      graphics.poly([-half, half, 0, -half, half, half])
    } else {
      graphics.circle(0, 0, size)
    }
    
    graphics.fill({ color, alpha: 1 })
    const texture = this.app!.renderer.generateTexture(graphics)
    graphics.destroy()
    this.textureCache.set(cacheKey, texture)
    return texture
  }

  /** @deprecated Use createShapeTexture instead */
  public createCircleTexture(color: Color, radius: number, handedness?: HandednessType): Texture {
    return this.createShapeTexture(color, radius, 'circle', handedness)
  }

  /** @description Adquire uma partícula do pool para uso. */
  public acquireParticle(): PooledParticle | null {
    if (this.activeParticles.length >= this.systemPerformance.maxParticles) {
      return null
    }
    let particle: PooledParticle
    if (this.particlePool.length > 0) {
      particle = this.particlePool.pop()!
    } else {
      const defaultTexture = this.createCircleTexture(new Color('white'), 1, undefined)
      particle = new PooledParticle(defaultTexture)
      this.particleContainer!.addChild(particle)
    }
    this.activeParticles.push(particle)
    return particle
  }

  /** @description Retorna o número máximo de partículas que um único efeito pode emitir. */
  public getMaxParticlesPerEffect(): number {
    return this.systemPerformance.maxParticlesPerEffect
  }

  /** @description Para o serviço, limpa recursos e destrói a aplicação Pixi.js. */
  async stop(): Promise<void> {
    this.clear()
    this.textureCache.forEach(texture => texture.destroy())
    this.textureCache.clear()
    this.textureUsage.clear()
    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
    this.particleContainer = null
    this.particlePool = []
    this.activeParticles = []
  }

  /** @description Limpa todas as partículas ativas, retornando-as ao pool sem criar arrays temporários. */
  public clear(): void {
    for (const particle of this.activeParticles) {
      particle.deactivate()
      this.particlePool.push(particle)
    }
    // .length = 0 é mais rápido que splice(0) — reutiliza o array sem realocação
    this.activeParticles.length = 0
  }

  /**
   * @description Loop de renderização principal para animar partículas e processar efeitos da fila.
   *
   * Usa EffectQueue.drain() em vez de spread + ref reativo do Pinia:
   *   - Zero alocação de arrays por frame
   *   - Zero disparos do sistema de reatividade Vue
   *
   * Usa swap-and-pop para liberar partículas mortas em O(1) por remoção
   * em vez de indexOf O(n) + splice O(n).
   */
  render(): void {
    const mode = this.getPoeticMode()

    // Decai a intensidade suavemente se as mãos estiverem paradas
    this.interactionIntensity = Math.max(0, this.interactionIntensity - 0.02)
    
    // Decai o timeout de detecção dos olhos para limpá-los se a pessoa sair da câmera
    this.eyeDetectionTimeout++
    if (this.eyeDetectionTimeout > 15) {
      this.targetLeftEye = null
      this.targetRightEye = null
      this.currentLeftEye = null
      this.currentRightEye = null
    }

    // Smooth interpolation (LERP) to reduce jitter in eye tracking
    const LERP_FACTOR = 0.15
    if (this.targetLeftEye) {
      if (!this.currentLeftEye) {
        this.currentLeftEye = { ...this.targetLeftEye }
      } else {
        this.currentLeftEye.x += (this.targetLeftEye.x - this.currentLeftEye.x) * LERP_FACTOR
        this.currentLeftEye.y += (this.targetLeftEye.y - this.currentLeftEye.y) * LERP_FACTOR
      }
    } else {
      this.currentLeftEye = null
    }

    if (this.targetRightEye) {
      if (!this.currentRightEye) {
        this.currentRightEye = { ...this.targetRightEye }
      } else {
        this.currentRightEye.x += (this.targetRightEye.x - this.currentRightEye.x) * LERP_FACTOR
        this.currentRightEye.y += (this.targetRightEye.y - this.currentRightEye.y) * LERP_FACTOR
      }
    } else {
      this.currentRightEye = null
    }
    
    // Atualiza o sprite de vídeo
    if (this.videoSprite) {
      if (this.getShowCamera()) {
        this.videoSprite.visible = true
        this.videoSprite.alpha = this.getCameraOpacity()
        
        if (mode === 'constellation' && this.asciiFilter) {
          this.videoSprite.filters = [this.asciiFilter]
          // O tamanho do ASCII reage ao movimento das mãos
          // Menos movimento = maior (abstrato), mais movimento = menor (detalhado)
          const targetSize = 12 + (1 - this.interactionIntensity) * 16
          this.asciiFilter.size += (targetSize - this.asciiFilter.size) * 0.1
          
        } else if (mode === 'synesthesia' && this.hslFilter && this.rgbSplitFilter) {
          this.videoSprite.filters = [this.hslFilter, this.rgbSplitFilter]
          
          this.time += 0.01
          
          // Efeito Psicodélico: Rotação contínua de matiz (Hue shift)
          // Vai de -180 a 180 graus ciclicamente
          this.hslFilter.hue = (Math.sin(this.time) * 180)
          
          // Efeito "Respiração / LSD": Separação de canais RGB pulsante
          // A intensidade da separação reage MUITO ao movimento das mãos!
          const activeSplit = 2 + (this.interactionIntensity * 30) // De 2px até 32px de separação
          const splitBase = Math.sin(this.time * 2) * activeSplit
          
          this.rgbSplitFilter.red = { x: -splitBase, y: splitBase }
          this.rgbSplitFilter.green = { x: splitBase, y: -splitBase }
          this.rgbSplitFilter.blue = { x: splitBase, y: splitBase }
          
        } else {
          this.videoSprite.filters = []
        }
      } else {
        this.videoSprite.visible = false
      }
    }

    if (this.constellationGraphics) {
      this.constellationGraphics.clear()
      if ((mode === 'synesthesia' || mode === 'constellation') && (this.currentLeftEye || this.currentRightEye)) {
        this.drawEyeEffects(mode)
      }
    }

    // Fading overlay para sinestesia (rastro)
    if (mode === 'synesthesia' && this.fadeOverlay) {
      // Como a câmera está atrás, não podemos preencher com preto sólido.
      // Se 'clearBeforeRender' é true, o rastro não funciona assim.
      // Modificamos as propriedades da partícula no 'handModulationUtils' para durar mais.
    }

    // Drena a fila de efeitos sem criar arrays temporários
    this.effectQueue.drain(effect => this.processVisualEffect(effect))

    // Atualiza partículas com swap-and-pop: O(1) por remoção, sem indexOf nem splice
    let i = this.activeParticles.length - 1
    while (i >= 0) {
      const particle = this.activeParticles[i]
      if (!particle.update()) {
        particle.deactivate()
        this.particlePool.push(particle)
        // Swap com o último elemento e remove — preserva a ordem do restante via iteração reversa
        const lastIdx = this.activeParticles.length - 1
        if (i !== lastIdx) {
          this.activeParticles[i] = this.activeParticles[lastIdx]
        }
        this.activeParticles.pop()
      }
      i--
    }
  }

  /** @description Processa um único efeito visual da fila. */
  private processVisualEffect(effect: VisualEffect): void {
    if (effect.type === 'eyeTrack') {
      const eyeEffect = effect as import('@/app/domains/visuals/index.ts').EyeEffectData
      if (eyeEffect.leftEye || eyeEffect.rightEye) {
        this.targetLeftEye = eyeEffect.leftEye
        this.targetRightEye = eyeEffect.rightEye
        this.eyeDetectionTimeout = 0
      }
      return
    }

    // Aumenta a intensidade global quando há atividade (limitado a 1)
    this.interactionIntensity = Math.min(1, this.interactionIntensity + 0.1)
    
    const { type, ...options } = effect
    if (type === 'pinchBurst') {
      this.emitPinchBurst(options as Omit<PinchBurstEffectData, 'type'>)
    } else if (type === 'handModulation') {
      const mode = this.getPoeticMode()
      const modulationOptions =
        effect as import('@/app/domains/visuals/index.ts').HandModulationEffectData
      if (mode === 'constellation' && modulationOptions.landmarks && this.constellationGraphics) {
        this.drawConstellation(modulationOptions.landmarks)
      }
      this.emitHandModulation(options)
    }
  }

  private drawConstellation(
    landmarks: import('@mediapipe/tasks-vision').NormalizedLandmark[]
  ): void {
    if (!this.constellationGraphics) return

    const g = this.constellationGraphics
    const w = this.canvasConfig.width
    const h = this.canvasConfig.height

    g.setStrokeStyle({ width: 2, color: 0x00ffff, alpha: 0.6 })

    const drawLine = (startIdx: number, endIdx: number) => {
      const p1 = landmarks[startIdx]
      const p2 = landmarks[endIdx]
      if (!p1 || !p2) return
      g.moveTo(p1.x * w, p1.y * h)
      g.lineTo(p2.x * w, p2.y * h)
    }

    // Draw palm base to fingers
    for (let i = 1; i <= 17; i += 4) {
      drawLine(0, i)
    }

    // Draw finger segments
    const fingers = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16],
      [17, 18, 19, 20]
    ]
    for (const finger of fingers) {
      for (let i = 0; i < finger.length - 1; i++) {
        drawLine(finger[i], finger[i + 1])
      }
    }

    // Draw web connecting the base of fingers
    drawLine(5, 9)
    drawLine(9, 13)
    drawLine(13, 17)

    // Draw nodes
    for (const p of landmarks) {
      g.circle(p.x * w, p.y * h, 3).fill({ color: 0xffffff, alpha: 0.8 })
    }
  }

  private drawEyeEffects(mode: 'classic' | 'synesthesia' | 'constellation'): void {
    if (!this.constellationGraphics) return
    const g = this.constellationGraphics
    const w = this.canvasConfig.width
    const h = this.canvasConfig.height

    const left = this.currentLeftEye
    const right = this.currentRightEye

    if (mode === 'synesthesia') {
      const pulse = 1 + Math.sin(this.time * 5) * 0.3
      const hue = (this.time * 100) % 360

      if (left) {
        g.setStrokeStyle({ width: 0 })
        g.circle(left.x * w, left.y * h, 25 * pulse).fill({ color: new Color(`hsl(${hue}, 100%, 50%)`), alpha: 0.15 })
        g.circle(left.x * w, left.y * h, 8 * pulse).fill({ color: 0xffffff, alpha: 0.4 })
        g.circle(left.x * w, left.y * h, 3).fill({ color: new Color(`hsl(${(hue + 180) % 360}, 100%, 50%)`), alpha: 0.8 })
      }
      if (right) {
        g.setStrokeStyle({ width: 0 })
        g.circle(right.x * w, right.y * h, 25 * pulse).fill({ color: new Color(`hsl(${hue}, 100%, 50%)`), alpha: 0.15 })
        g.circle(right.x * w, right.y * h, 8 * pulse).fill({ color: 0xffffff, alpha: 0.4 })
        g.circle(right.x * w, right.y * h, 3).fill({ color: new Color(`hsl(${(hue + 180) % 360}, 100%, 50%)`), alpha: 0.8 })
      }
    } else if (mode === 'constellation') {
      g.setStrokeStyle({ width: 1, color: 0x00ffff, alpha: 0.8 })
      
      const drawCross = (eye: { x: number; y: number }) => {
        const ex = eye.x * w
        const ey = eye.y * h
        g.moveTo(ex - 15, ey)
        g.lineTo(ex + 15, ey)
        g.moveTo(ex, ey - 15)
        g.lineTo(ex, ey + 15)
        
        // Losango
        g.moveTo(ex, ey - 8)
        g.lineTo(ex + 8, ey)
        g.lineTo(ex, ey + 8)
        g.lineTo(ex - 8, ey)
        g.lineTo(ex, ey - 8)
        
        g.circle(ex, ey, 2).fill({ color: 0x00ffff, alpha: 0.9 })
      }
      
      if (left) drawCross(left)
      if (right) drawCross(right)
    }
  }

  /** @description Inicializa o pool de partículas com instâncias pré-criadas. */
  private initializePool(): void {
    const poolSize = this.systemPerformance.poolSize
    const defaultTexture = this.createCircleTexture(new Color('white'), 1, undefined)
    for (let i = 0; i < poolSize; i++) {
      const particle = new PooledParticle(defaultTexture)
      this.particlePool.push(particle)
      this.particleContainer!.addChild(particle)
    }
  }

  /**
   * @description Remove texturas menos utilizadas do cache se o limite for excedido.
   *
   * Usa busca linear O(n) em vez de Array.from() + sort() O(n log n) —
   * mesma semântica LRU sem alocar arrays temporários.
   */
  private evictCacheIfNeeded(): void {
    if (this.textureCache.size < this.systemPerformance.maxTextureCacheSize) {
      return
    }
    const evictionCount = Math.floor(this.systemPerformance.maxTextureCacheSize * 0.2)
    for (let evicted = 0; evicted < evictionCount; evicted++) {
      // Encontra a entrada com menor timestamp (LRU) sem criar array intermediário
      let oldestKey: string | undefined
      let oldestTime = Infinity
      for (const [key, time] of this.textureUsage) {
        if (time < oldestTime) {
          oldestTime = time
          oldestKey = key
        }
      }
      if (oldestKey) {
        this.textureCache.get(oldestKey)?.destroy()
        this.textureCache.delete(oldestKey)
        this.textureUsage.delete(oldestKey)
      }
    }
  }
}
