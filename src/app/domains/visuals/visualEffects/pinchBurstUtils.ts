import { Color } from 'pixi.js'
import type { EffectOptions } from './types.ts'
import type { PooledParticle } from './PooledParticle.ts'
import type { VisualsService } from '../VisualsService.ts'

/** @description Cria um efeito de explosão de partículas para o gesto de pinça. */
export function createPinchBurstEffect(
  options: EffectOptions,
  visualsService: VisualsService
): void {
  const config = visualsService.visualEffectsConfig.pinchBurst
  const maxParticles = visualsService.getMaxParticlesPerEffect()
  const particleCount = Math.min(
    config.particleCountBase + Math.floor(options.intensity * config.particleCountMultiplier),
    maxParticles
  )
  if (particleCount === 0) {
    return
  }
  for (let i = 0; i < particleCount; i++) {
    const particle = visualsService.acquireParticle()
    if (!particle) {
      break
    }
    activatePinchBurstParticle(particle, options, visualsService)
  }
}

/** @description Ativa uma partícula individual para o efeito de explosão de pinça. */
function activatePinchBurstParticle(
  particle: PooledParticle,
  options: EffectOptions,
  visualsService: VisualsService
): void {
  const { x, y, intensity } = options
  const config = visualsService.visualEffectsConfig.pinchBurst
  const colorIndex = Math.floor(Math.random() * config.colors.length)
  const color = new Color(config.colors[colorIndex])
  const texture = visualsService.createCircleTexture(
    color,
    config.baseSize + Math.random() * config.randomSize,
    options.handedness
  )
  const angle = Math.random() * Math.PI * 2
  const speed = config.baseSpeed + Math.random() * config.randomSpeed * intensity
  const vx = Math.cos(angle) * speed
  const vy = Math.sin(angle) * speed + config.lift
  const lifetime = config.baseLifetime + Math.random() * config.randomLifetime
  const decay = config.baseDecay + Math.random() * config.randomDecay
  const scale = config.baseScale + Math.random() * config.randomScale
  particle.activate({
    x,
    y,
    vx,
    vy,
    life: lifetime,
    decay,
    texture,
    scale
  })
}