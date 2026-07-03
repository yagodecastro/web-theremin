import { Sprite, Texture } from 'pixi.js'
import type { ParticleActivationOptions } from './types.ts'

/** @description Representa uma partícula reutilizável (pooled) para efeitos visuais. */
export class PooledParticle extends Sprite {
  public isActive = false
  public vx = 0
  public vy = 0
  public life = 0
  public decay = 0
  public maxLife = 0
  // Pré-calculado no activate() para substituir divisão por multiplicação no update()
  private inverseMaxLife = 0

  constructor(texture: Texture) {
    super(texture)
    this.anchor.set(0.5)
  }

  /** @description Ativa a partícula com novas propriedades. */
  activate(options: ParticleActivationOptions): void {
    this.isActive = true
    this.x = options.x
    this.y = options.y
    this.vx = options.vx
    this.vy = options.vy
    this.life = options.life
    this.maxLife = options.life
    this.decay = options.decay
    this.alpha = 1
    this.texture = options.texture
    this.scale.set(options.scale)
    // Pré-calcular 1/maxLife para evitar divisão a cada frame no update()
    this.inverseMaxLife = options.life > 0 ? 1 / options.life : 0
  }

  /** @description Desativa a partícula, tornando-a invisível e pronta para reutilização. */
  deactivate(): void {
    this.isActive = false
    this.alpha = 0
  }

  /** @description Atualiza a posição e o estado da partícula a cada frame. */
  update(): boolean {
    if (!this.isActive) {
      return false
    }
    this.life -= this.decay
    if (this.life <= 0) {
      this.deactivate()
      return false
    }
    // Multiplicação em vez de divisão (inverseMaxLife pré-calculado no activate)
    this.alpha = this.life * this.inverseMaxLife
    this.x += this.vx
    this.y += this.vy
    return true
  }
}