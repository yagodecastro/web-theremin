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
import { AppStore } from '@/stores/appStore.ts'

/** @description Gerencia a renderização de efeitos visuais com pooling de partículas e cache de texturas. */
export class VisualsService implements IVisualsService {
  private app: Application | null = null
  private particleContainer: Container | null = null
  private particlePool: PooledParticle[] = []
  private activeParticles: PooledParticle[] = []
  private textureCache: Map<string, Texture> = new Map()
  private textureUsage: Map<string, number> = new Map()

  constructor(
    public readonly canvasConfig: CanvasConfig,
    public readonly systemPerformance: SystemPerformanceConfig,
    public readonly visualEffectsConfig: VisualEffectsConfig,
    private readonly store: AppStore
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
        backgroundColor: this.canvasConfig.backgroundColor
      })
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

  /** @description Limpa todas as partículas ativas, retornando-as ao pool. */
  public clear(): void {
    while (this.activeParticles.length > 0) {
      const particle = this.activeParticles.pop()!
      this.releaseParticle(particle)
    }
  }

  /** @description Loop de renderização principal para animar partículas e processar efeitos da fila. */
  render(): void {
    // Processa a fila de efeitos visuais do store
    const effectsToProcess = [...this.store.visualEffects]
    this.store.clearVisualEffects()

    for (const effect of effectsToProcess) {
      this.processVisualEffect(effect)
    }

    // Atualiza a animação das partículas ativas
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const particle = this.activeParticles[i]
      if (!particle.update()) {
        this.releaseParticle(particle)
      }
    }
  }

  /** @description Processa um único efeito visual da fila. */
  private processVisualEffect(effect: VisualEffect): void {
    const { type, ...options } = effect
    if (type === 'pinchBurst') {
      this.emitPinchBurst(options as Omit<PinchBurstEffectData, 'type'>)
    } else if (type === 'handModulation') {
      this.emitHandModulation(options)
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

  /** @description Remove texturas menos utilizadas do cache se o limite for excedido. */
  private evictCacheIfNeeded(): void {
    if (this.textureCache.size < this.systemPerformance.maxTextureCacheSize) {
      return
    }
    const sortedByUsage = Array.from(this.textureUsage.entries()).sort((a, b) => a[1] - b[1])
    const evictionCount = Math.floor(this.systemPerformance.maxTextureCacheSize * 0.2)
    for (let i = 0; i < evictionCount; i++) {
      const [key] = sortedByUsage[i]
      const texture = this.textureCache.get(key)
      if (texture) {
        texture.destroy()
        this.textureCache.delete(key)
        this.textureUsage.delete(key)
      }
    }
  }

  /** @description Retorna uma partícula para o pool após o uso. */
  private releaseParticle(particle: PooledParticle): void {
    const index = this.activeParticles.indexOf(particle)
    if (index === -1) return
    particle.deactivate()
    this.activeParticles.splice(index, 1)
    this.particlePool.push(particle)
  }
}
