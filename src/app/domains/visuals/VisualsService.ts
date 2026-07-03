import { Application, Color, Container, Graphics, Texture } from 'pixi.js'
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

  constructor(
    public readonly canvasConfig: CanvasConfig,
    public readonly systemPerformance: SystemPerformanceConfig,
    public readonly visualEffectsConfig: VisualEffectsConfig,
    // EffectQueue plain (não-reativo) substitui AppStore para comunicação de efeitos.
    // Elimina ~60 disparos do sistema de reatividade Vue/Pinia por segundo.
    private readonly effectQueue: EffectQueue,
    public readonly getPoeticMode: () => 'classic' | 'synesthesia' | 'constellation' = () => 'classic'
  ) {}

  /** @description Inicializa a aplicação Pixi.js e o pool de partículas. */
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
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
      
      this.constellationGraphics = new Graphics()
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

  /** @description Cria e armazena em cache uma textura de círculo para reutilização. */
  public createCircleTexture(color: Color, radius: number, handedness?: HandednessType): Texture {
    const cacheKey = `${handedness}_${color.toHex()}_${radius}`
    this.textureUsage.set(cacheKey, Date.now())
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!
    }
    this.evictCacheIfNeeded()
    const graphics = new Graphics()
    graphics.circle(0, 0, radius)
    graphics.fill({ color, alpha: 1 })
    const texture = this.app!.renderer.generateTexture(graphics)
    graphics.destroy()
    this.textureCache.set(cacheKey, texture)
    return texture
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
    
    if (this.constellationGraphics) {
      this.constellationGraphics.clear()
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
    const { type, ...options } = effect
    if (type === 'pinchBurst') {
      this.emitPinchBurst(options as Omit<PinchBurstEffectData, 'type'>)
    } else if (type === 'handModulation') {
      const mode = this.getPoeticMode()
      const modulationOptions = effect as import('@/app/domains/visuals/index.ts').HandModulationEffectData
      if (mode === 'constellation' && modulationOptions.landmarks && this.constellationGraphics) {
        this.drawConstellation(modulationOptions.landmarks)
      }
      this.emitHandModulation(options)
    }
  }

  private drawConstellation(landmarks: import('@mediapipe/tasks-vision').NormalizedLandmark[]): void {
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
    const fingers = [[1,2,3,4], [5,6,7,8], [9,10,11,12], [13,14,15,16], [17,18,19,20]]
    for (const finger of fingers) {
      for (let i = 0; i < finger.length - 1; i++) {
        drawLine(finger[i], finger[i+1])
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
