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
  handedness: HandednessType | undefined,
  xPosition: number = 0,
  poeticMode: 'classic' | 'synesthesia' | 'constellation' = 'classic'
): Color {
  if (poeticMode === 'synesthesia') {
    // Cor baseada na posição X (frequência)
    // Converte X (0 a 1) para Hue (0 a 360) e gera HSL
    const hue = (1 - xPosition) * 360 // Invertido porque X=0 é direita na tela espelhada, mas notas agudas? Depende do mapeamento.

    // HSL to RGB conversion (basic version for Pixi Color)
    // Pixi Color aceita hsl string
    return new Color(`hsl(${hue}, 100%, 50%)`)
  }

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
  const mode = visualsService.getPoeticMode()

  const maxParticles = visualsService.getMaxParticlesPerEffect()

  // Em sinestesia, emitimos mais partículas. Em constelação, emitimos menos para não poluir as linhas.
  let multiplier = config.particleCountMultiplier
  if (visualsService.systemPerformance.lowPerformance) {
    multiplier *= 0.3 // Reduz em 70% o número de partículas em modo de baixa performance
  } else if (mode === 'synesthesia') {
    multiplier *= 1.5
  } else if (mode === 'constellation') {
    multiplier *= 0.4
  }

  const baseParticleCount = Math.floor(options.intensity * multiplier)

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
    activateHandModulationParticle(particle, options, visualsService, mode)
  }
}

/** @description Ativa uma partícula individual para o efeito de modulação da mão. */
function activateHandModulationParticle(
  particle: PooledParticle,
  options: EffectOptions,
  visualsService: VisualsService,
  mode: 'classic' | 'synesthesia' | 'constellation'
): void {
  const config = visualsService.visualEffectsConfig

  // Pass normalizado x para color calculation (options.x / width)
  const normalizedX = options.x / visualsService.canvasConfig.width
  const color = calculateAdvancedColor(
    options.intensity,
    config,
    options.handedness,
    normalizedX,
    mode
  )

  let spawnRadius = config.handModulation.baseSpawnRadius * options.intensity
  let particleSize = config.handModulation.particleSize
  let speedMult = 1
  let decay = config.handModulation.decay
  let shape: 'circle' | 'square' | 'triangle' = 'circle'

  if (mode === 'synesthesia') {
    spawnRadius = config.handModulation.baseSpawnRadius * 0.5
    particleSize = config.handModulation.particleSize * 2.5 // Partículas maiores em sinestesia
    speedMult = 0.2 // Movimento super lento e flutuante
    decay = config.handModulation.decay * 0.2 // Duram muito tempo para pintar a tela
    shape = 'circle'
  } else if (mode === 'constellation') {
    spawnRadius = 0 // Spawnam exatamente nas articulações
    particleSize = config.handModulation.particleSize * 1.5
    speedMult = 0.5
    decay = config.handModulation.decay * 1.5 // Desaparecem rápido
    shape = Math.random() > 0.5 ? 'square' : 'triangle' // Formas geométricas para constelação!
  }

  const angle = Math.random() * Math.PI * 2
  const radius = Math.random() * spawnRadius
  const spawnX = options.x + Math.cos(angle) * radius
  const spawnY = options.y + Math.sin(angle) * radius

  const texture = visualsService.createShapeTexture(color, particleSize, shape, options.handedness)

  // Em constelação as partículas flutuam para cima levemente
  const vx = (Math.random() - 0.5) * config.handModulation.speed * speedMult
  let vy = (Math.random() - 0.5) * config.handModulation.speed * speedMult
  if (mode === 'constellation') {
    vy -= 1 // Drift ascendente
  }

  const scale =
    config.handModulation.scale.base + Math.random() * config.handModulation.scale.random

  particle.activate({
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    life: config.handModulation.lifetime,
    decay: decay,
    texture,
    scale
  })
}
