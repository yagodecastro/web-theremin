import { Color } from 'pixi.js'
import type { EffectOptions } from './types.ts'
import type { PooledParticle } from './PooledParticle.ts'
import type { HandednessType } from '@/app/domains/gesture/utils/gestureUtils.ts'
import type { VisualsService } from '../VisualsService.ts'
import { VisualEffectsConfig } from '@/app/domains/visuals'

/** @description Calcula uma cor avançada com base na intensidade e abertura da mão. */
function calculateAdvancedColor(
  intensity: number,
  visualEffectsConfig: VisualEffectsConfig,
  handedness: HandednessType | undefined
): Color {
  const handColorsConfig = visualEffectsConfig.handModulation
  const handColors = handedness === 'Left' ? handColorsConfig.left : handColorsConfig.right
  const baseColor = new Color(handColors.base)
  const targetColor = new Color(handColors.target)
  const [baseR, baseG, baseB] = baseColor.toArray()
  const [targetR, targetG, targetB] = targetColor.toArray()
  const r = baseR + (targetR - baseR) * intensity
  const g = baseG + (targetG - baseG) * intensity
  const b = baseB + (targetB - baseB) * intensity
  return new Color([r, g, b])
}

/** @description Cria um efeito de partículas para a modulação da mão. */
export function createHandModulationEffect(
  options: EffectOptions,
  visualsService: VisualsService
): void {
  const config = visualsService.visualEffectsConfig.handModulation
  const maxParticles = visualsService.getMaxParticlesPerEffect()
  const baseParticleCount = Math.floor(options.intensity * config.particleCountMultiplier)
  const particleCount = Math.min(
    options.intensity > 0 ? Math.max(baseParticleCount, config.minParticles) : 0,
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
    activateHandModulationParticle(particle, options, visualsService)
  }
}

/** @description Ativa uma partícula individual para o efeito de modulação da mão. */
function activateHandModulationParticle(
  particle: PooledParticle,
  options: EffectOptions,
  visualsService: VisualsService
): void {
  const config = visualsService.visualEffectsConfig
  const color = calculateAdvancedColor(options.intensity, config, options.handedness)
  const spawnRadius = config.handModulation.baseSpawnRadius * options.intensity
  const angle = Math.random() * Math.PI * 2
  const radius = Math.random() * spawnRadius
  const spawnX = options.x + Math.cos(angle) * radius
  const spawnY = options.y + Math.sin(angle) * radius
  const texture = visualsService.createCircleTexture(
    color,
    config.handModulation.particleSize,
    options.handedness
  )
  const vx = (Math.random() - 0.5) * config.handModulation.speed
  const vy = (Math.random() - 0.5) * config.handModulation.speed
  const scale =
    config.handModulation.scale.base + Math.random() * config.handModulation.scale.random
  particle.activate({
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    life: config.handModulation.lifetime,
    decay: config.handModulation.decay,
    texture,
    scale
  })
}