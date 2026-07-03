import type { VisualEffect } from '@/app/domains/visuals'

/**
 * @description Fila de efeitos visuais plain (não-reativa).
 *
 * Substitui `ref<VisualEffect[]>` no Pinia store para comunicação entre
 * gesture handlers (produtores) e VisualsService (consumidor).
 * Ao evitar o sistema de reatividade do Vue, elimina ~60 disparos de
 * rastreamento reativo por segundo no hot path.
 *
 * @example
 * const queue = new EffectQueue()
 * queue.push({ type: 'pinchBurst', x: 0.5, y: 0.5, intensity: 1 })
 * queue.drain(effect => visualsService.processEffect(effect))
 */
export class EffectQueue {
  private readonly items: VisualEffect[] = []

  /** @description Adiciona um efeito à fila. */
  push(effect: VisualEffect): void {
    this.items.push(effect)
  }

  /**
   * @description Itera sobre todos os efeitos acumulados e limpa a fila.
   *
   * Reutiliza o array interno sem alocar novos arrays — zero GC pressure.
   */
  drain(callback: (effect: VisualEffect) => void): void {
    for (let i = 0; i < this.items.length; i++) {
      callback(this.items[i])
    }
    this.items.length = 0
  }

  /** @description Número de efeitos pendentes na fila. */
  get size(): number {
    return this.items.length
  }
}
