<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AppController } from '@/app/core/AppController.ts'
import { useAppStore } from '@/stores/appStore'
import MainHeader from '@/components/MainHeader.vue'
import Controls from '@/components/Controls.vue'
import VideoCanvas from '@/components/VideoCanvas.vue'
import LogTerminal from '@/components/LogTerminal.vue'
import { defaultConfig } from '@/app/shared/config/defaults.ts'
import AppFooter from '@/components/AppFooter.vue'

const videoElement = ref<HTMLVideoElement>()
const visualsCanvas = ref<HTMLCanvasElement>()
const videoCanvasRef = ref<InstanceType<typeof VideoCanvas>>()
const isControlsOpen = ref(true)
const store = useAppStore()

let mouseMoveTimeout: ReturnType<typeof setTimeout> | null = null

const resetZenModeTimer = () => {
  if (store.poeticMode === 'classic' || !store.isRunning) {
    store.setZenMode(false)
    return
  }

  store.setZenMode(false)
  if (mouseMoveTimeout) {
    clearTimeout(mouseMoveTimeout)
  }

  mouseMoveTimeout = setTimeout(() => {
    if (store.isRunning && store.poeticMode !== 'classic') {
      store.setZenMode(true)
    }
  }, 3000)
}

onMounted(() => {
  window.addEventListener('mousemove', resetZenModeTimer)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', resetZenModeTimer)
  if (mouseMoveTimeout) clearTimeout(mouseMoveTimeout)
})

watch(() => store.poeticMode, resetZenModeTimer)
watch(() => store.isRunning, resetZenModeTimer)

const toggleControls = () => {
  isControlsOpen.value = !isControlsOpen.value
}

let appInstance: AppController | null = null

/**
 * Tenta inicializar o sistema principal.
 * Só executa se ambos os elementos (video e canvas) estiverem prontos
 * e a inicialização ainda não tiver ocorrido.
 */
const tryInitializeSystem = async () => {
  // Logs detalhados de diagnóstico só em desenvolvimento
  if (import.meta.env.DEV) {
    store.addSystemLog('info', `App.vue: Verificando condições de inicialização...`)
    store.addSystemLog('info', `App.vue: Video element ready: ${!!videoElement.value}`)
    store.addSystemLog('info', `App.vue: Canvas element ready: ${!!visualsCanvas.value}`)
    store.addSystemLog('info', `App.vue: Current status: ${store.status}`)
  }

  if (videoElement.value && visualsCanvas.value && store.status === 'idle') {
    try {
      if (import.meta.env.DEV) {
        store.addSystemLog(
          'info',
          'AppController.vue: Iniciando construção da instância AppController...'
        )
      }
      const app = new AppController(defaultConfig, store, store.audioMode)
      appInstance = app
      store.setAppSystem(app)

      store.addSystemLog(
        'info',
        'AppController.vue: Inicializando serviços (video, canvas, MIDI, câmera)...'
      )
      const { midiOutputs, cameras } = await app.initialize(videoElement.value, visualsCanvas.value)

      store.setMidiOutputs(midiOutputs)
      store.setCameras(cameras)

      store.addSystemLog('info', 'AppController.vue: Sistema inicializado com sucesso.')

      // Diagnóstico final só em DEV (JSON.stringify tem custo significativo)
      if (import.meta.env.DEV) {
        store.addSystemLog(
          'info',
          `App.vue: Dispositivos detectados - MIDI: ${midiOutputs.length}, Câmeras: ${cameras.length}`
        )
        const diagnostics = store.systemDiagnostics
        store.addSystemLog('info', `App.vue: Diagnóstico final - ${JSON.stringify(diagnostics)}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      store.addSystemLog('error', `App.vue: Erro crítico na inicialização: ${errorMessage}`)
      if (import.meta.env.DEV) {
        store.addSystemLog(
          'error',
          `App.vue: Stack trace: ${error instanceof Error ? error.stack : 'N/A'}`
        )
      }
    }
  } else {
    if (store.status !== 'idle') {
      store.addSystemLog(
        'warn',
        `App.vue: Sistema não está em estado idle (status atual: ${store.status})`
      )
    }
  }
}

const onVideoReady = (element: HTMLVideoElement) => {
  videoElement.value = element
  tryInitializeSystem()
}

const onVisualsReady = (canvas: HTMLCanvasElement) => {
  visualsCanvas.value = canvas
  tryInitializeSystem()
}

const handleStart = async () => {
  if (appInstance && store.isReady) {
    try {
      store.addSystemLog('info', 'AppController.vue: Iniciando sessão...')
      await appInstance.start()
      store.addSystemLog('info', 'AppController.vue: Sessão iniciada.')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      store.addSystemLog('error', `Erro ao iniciar sessão: ${errorMessage}`)
    }
  } else {
    store.addSystemLog('warn', 'AppController.vue: Sistema não está pronto para iniciar.')
    // Diagnóstico detalhado só em DEV (JSON.stringify tem custo)
    if (import.meta.env.DEV) {
      const diagnostics = store.systemDiagnostics
      store.addSystemLog('warn', `App.vue: Diagnóstico detalhado: ${JSON.stringify(diagnostics)}`)
    }
    if (!appInstance) {
      store.addSystemLog('error', 'AppController.vue: Instância da aplicação não foi criada')
    }
    if (!store.isReady) {
      store.addSystemLog(
        'error',
        `App.vue: Sistema não está ready - Health status: ${store.systemHealthStatus}`
      )
    }
  }
}

const handleStop = () => {
  if (appInstance) {
    appInstance.stop()
    store.addSystemLog('info', 'AppController.vue: Sessão parada.')
  }
}

const handleRestart = async () => {
  if (appInstance) {
    try {
      appInstance.stop()
      store.addSystemLog('info', 'AppController.vue: Sessão parada para reiniciar.')
      await appInstance.start()
      store.addSystemLog('info', 'AppController.vue: Sessão reiniciada.')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      store.addSystemLog('error', `Erro ao reiniciar sessão: ${errorMessage}`)
    }
  }
}

/**
 * Reinicialização completa do sistema - destrói e reconstrói tudo
 */
const handleFullSystemRestart = async () => {
  try {
    store.addSystemLog(
      'info',
      'AppController.vue: Iniciando reinicialização completa do sistema...'
    )
    store.setStatus('initializing')

    // 1. Parar e destruir sistema atual
    if (appInstance) {
      await appInstance.destroy()
      appInstance = null
      store.setAppSystem(null as unknown as AppController)
    }

    // 2. Limpar referências de elementos
    videoElement.value = undefined
    visualsCanvas.value = undefined

    // 3. Resetar status
    store.setStatus('idle')

    // 4. Aguardar um momento para limpeza
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 5. Forçar re-renderização dos elementos
    store.addSystemLog(
      'info',
      'AppController.vue: Aguardando elementos de mídia para reinicialização...'
    )

    // Os elementos serão reinicializados automaticamente quando o componente VideoCanvas re-montar
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    store.addSystemLog('error', `Falha na reinicialização completa: ${errorMessage}`)
    store.setStatus('error', errorMessage)
  }
}

const handleFullscreen = () => videoCanvasRef.value?.toggleFullscreen()

const handlePanicMidi = () => {
  if (appInstance) {
    appInstance.panicMidi()
  }
}

const handleSwitchAudioMode = async (mode: 'tone' | 'midi') => {
  if (appInstance) {
    try {
      await appInstance.switchAudioMode(mode)
      store.addSystemLog('info', `Modo de áudio alterado para: ${mode}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      store.addSystemLog('error', `Erro ao trocar modo de áudio: ${errorMessage}`)
    }
  }
}

onMounted(() => {
  store.addSystemLog(
    'info',
    'AppController.vue: Componente montado. Aguardando elementos de mídia...'
  )
})

onBeforeUnmount(async () => {
  // Usa a instância guardada para chamar o destroy
  if (appInstance) {
    await appInstance.destroy()
    store.addSystemLog('info', 'AppController.vue: Sistema finalizado.')
  }
})
</script>

<template>
  <div
    class="w-full max-w-7xl mx-auto my-4 min-h-screen bg-retro-blue text-white font-mono pt-2 transition-colors duration-1000"
    :class="{ 'bg-black': store.isZenMode }"
  >
    <div
      class="transition-opacity duration-1000"
      :class="{ 'opacity-0 pointer-events-none': store.isZenMode }"
    >
      <MainHeader />
    </div>

    <main class="flex-1 space-y-3 mt-3 relative">
      <div
        class="bg-dark-metal p-4 rounded-lg border-2 border-retro-gray-600 shadow-bevel transition-all duration-1000"
        :class="{ 'opacity-0 pointer-events-none absolute w-full z-10': store.isZenMode }"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <div class="w-1.5 h-5 bg-neon-cyan rounded-full animate-glow shadow-neon-cyan" />
            <h2
              class="text-neon-green font-typewriter font-bold text-base uppercase tracking-wider"
            >
              CONTROL INTERFACE
            </h2>
          </div>
          <button
            class="text-neon-cyan hover:text-white transition-colors text-xs font-bold flex items-center gap-1 border border-neon-cyan/30 px-2 py-1 rounded"
            @click="toggleControls"
          >
            {{ isControlsOpen ? '▲ COLLAPSE' : '▼ EXPAND' }}
          </button>
        </div>

        <div
          v-show="isControlsOpen"
          class="pt-2 border-t border-retro-gray-700 mt-2 transition-all duration-300"
        >
          <Controls
            @panic="handlePanicMidi"
            @restart="handleRestart"
            @start="handleStart"
            @stop="handleStop"
            @full-restart="handleFullSystemRestart"
            @switch-audio-mode="handleSwitchAudioMode"
            @fullscreen="handleFullscreen"
          />
        </div>
      </div>

      <div
        class="grid grid-cols-1 gap-3 relative z-0 transition-all duration-1000"
        :class="{ 'scale-[1.02] mt-8': store.isZenMode }"
      >
        <div class="lg:col-span-2 space-y-3">
          <div
            class="p-1 rounded border shadow-crt transition-all duration-1000"
            :class="store.isZenMode ? 'border-transparent shadow-none' : 'border-retro-gray-700'"
          >
            <VideoCanvas
              ref="videoCanvasRef"
              @video-ready="onVideoReady"
              @visuals-ready="onVisualsReady"
            />
          </div>
        </div>
      </div>

      <div
        class="bg-dark-metal p-4 rounded-lg border-2 border-retro-gray-600 shadow-bevel transition-opacity duration-1000"
        :class="{ 'opacity-0 pointer-events-none absolute w-full -z-10': store.isZenMode }"
      >
        <LogTerminal />
      </div>
    </main>

    <div
      class="transition-opacity duration-1000"
      :class="{ 'opacity-0 pointer-events-none': store.isZenMode }"
    >
      <AppFooter />
    </div>
  </div>
</template>
