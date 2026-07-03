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
  
  if (mode === 'constellation') return // Em constellation não usamos partículas de mão padrão

  const maxParticles = visualsService.getMaxParticlesPerEffect()
  
  // Em sinestesia, emitimos mais partículas
  const multiplier = mode === 'synesthesia' ? config.particleCountMultiplier * 1.5 : config.particleCountMultiplier
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
  const color = calculateAdvancedColor(options.intensity, config, options.handedness, normalizedX, mode)
  
  const spawnRadius = mode === 'synesthesia' 
    ? config.handModulation.baseSpawnRadius * 0.5 
    : config.handModulation.baseSpawnRadius * options.intensity
    
  const angle = Math.random() * Math.PI * 2
  const radius = Math.random() * spawnRadius
  const spawnX = options.x + Math.cos(angle) * radius
  const spawnY = options.y + Math.sin(angle) * radius
  
  const particleSize = mode === 'synesthesia' 
    ? config.handModulation.particleSize * 2 // Partículas maiores em sinestesia
    : config.handModulation.particleSize
    
  const texture = visualsService.createCircleTexture(
    color,
    particleSize,
    options.handedness
  )
  
  // Em sinestesia a velocidade inicial é muito menor (flutuação)
  const speedMult = mode === 'synesthesia' ? 0.2 : 1
  const vx = (Math.random() - 0.5) * config.handModulation.speed * speedMult
  const vy = (Math.random() - 0.5) * config.handModulation.speed * speedMult
  
  const scale =
    config.handModulation.scale.base + Math.random() * config.handModulation.scale.random
    
  // Decay menor em sinestesia para criar rastro
  const decay = mode === 'synesthesia' 
    ? config.handModulation.decay * 0.2 
    : config.handModulation.decay
    
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
