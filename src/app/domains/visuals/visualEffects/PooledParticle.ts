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
    this.alpha = this.maxLife > 0 ? this.life / this.maxLife : 0
    this.x += this.vx
    this.y += this.vy
    return true
  }
}