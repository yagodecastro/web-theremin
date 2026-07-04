<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AppController } from '@/app/core/AppController.ts'
import { useAppStore } from '@/stores/appStore'
import SideMenu from '@/components/SideMenu.vue'
import VideoCanvas from '@/components/VideoCanvas.vue'
import { getAppConfig } from '@/app/shared/config/defaults.ts'
import { Settings, Play, Pause, RotateCcw } from 'lucide-vue-next'

const videoElement = ref<HTMLVideoElement>()
const visualsCanvas = ref<HTMLCanvasElement>()
const videoCanvasRef = ref<InstanceType<typeof VideoCanvas>>()
const store = useAppStore()

let appInstance: AppController | null = null

const isControlsVisible = ref(true)
let autoHideTimeout: ReturnType<typeof setTimeout> | null = null

const showControls = () => {
  isControlsVisible.value = true
  if (autoHideTimeout) {
    clearTimeout(autoHideTimeout)
    autoHideTimeout = null
  }

  if (store.isRunning) {
    autoHideTimeout = setTimeout(() => {
      if (store.isRunning) {
        isControlsVisible.value = false
      }
    }, 2500)
  }
}

const handleUserActivity = () => {
  showControls()
}

watch(
  () => store.isRunning,
  running => {
    if (!running) {
      if (autoHideTimeout) {
        clearTimeout(autoHideTimeout)
        autoHideTimeout = null
      }
      isControlsVisible.value = true
    } else {
      showControls()
    }
  }
)

watch(
  () => store.lowPerformanceMode,
  async newVal => {
    store.addSystemLog(
      'info',
      `App.vue: Modo de desempenho alterado para: ${newVal ? 'Otimizado' : 'Normal'}`
    )
    if (store.status !== 'idle') {
      store.addSystemLog(
        'info',
        'App.vue: Reiniciando sistema para aplicar novas configurações de desempenho...'
      )
      await handleFullSystemRestart()
    }
  }
)

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
      const app = new AppController(getAppConfig(store.lowPerformanceMode), store, store.audioMode)
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

/** Botão play/pause flutuante — inicia, pausa ou reinicia conforme o estado */
const handlePlayPause = async () => {
  if (store.hasError) {
    await handleFullSystemRestart()
  } else if (store.isRunning) {
    handleStop()
  } else {
    await handleStart()
  }
}

onMounted(() => {
  store.addSystemLog(
    'info',
    'AppController.vue: Componente montado. Aguardando elementos de mídia...'
  )
  window.addEventListener('mousemove', handleUserActivity)
  window.addEventListener('mousedown', handleUserActivity)
  window.addEventListener('touchstart', handleUserActivity)
})

onBeforeUnmount(async () => {
  window.removeEventListener('mousemove', handleUserActivity)
  window.removeEventListener('mousedown', handleUserActivity)
  window.removeEventListener('touchstart', handleUserActivity)
  if (autoHideTimeout) {
    clearTimeout(autoHideTimeout)
  }
  // Usa a instância guardada para chamar o destroy
  if (appInstance) {
    await appInstance.destroy()
    store.addSystemLog('info', 'AppController.vue: Sistema finalizado.')
  }
})
</script>

<template>
  <!-- Canvas ocupa toda a viewport -->
  <div class="fixed inset-0 bg-black overflow-hidden" role="main">
    <VideoCanvas
      ref="videoCanvasRef"
      class="w-full h-full"
      @video-ready="onVideoReady"
      @visuals-ready="onVisualsReady"
    />

    <!-- Botões flutuantes: configs e play/pause -->
    <Transition name="fade-buttons">
      <div v-show="isControlsVisible" class="absolute bottom-6 left-6 flex items-center gap-4 z-30">
        <!-- Botão de configurações -->
        <button
          id="open-settings-btn"
          class="floating-btn"
          :aria-label="store.isSideMenuOpen ? 'Fechar configurações' : 'Abrir configurações'"
          :aria-expanded="store.isSideMenuOpen"
          aria-controls="side-menu"
          @click="store.toggleSideMenu"
        >
          <Settings class="w-5 h-5" />
        </button>

        <!-- Botão play/pause/restart -->
        <button
          id="play-pause-btn"
          class="floating-btn floating-btn--primary"
          :class="{ 'floating-btn--danger': store.hasError }"
          :disabled="store.isBusy && !store.hasError"
          :aria-label="
            store.isRunning ? 'Pausar' : store.hasError ? 'Reiniciar sistema' : 'Iniciar'
          "
          @click="handlePlayPause"
        >
          <RotateCcw v-if="store.hasError" class="w-5 h-5" />
          <Pause v-else-if="store.isRunning" class="w-5 h-5" />
          <Play v-else class="w-5 h-5" />
        </button>
      </div>
    </Transition>

    <!-- SideMenu sobrepondo o canvas -->
    <SideMenu
      @close="store.closeSideMenu"
      @panic="handlePanicMidi"
      @restart="handleRestart"
      @start="handleStart"
      @stop="handleStop"
      @full-restart="handleFullSystemRestart"
      @fullscreen="handleFullscreen"
    />
  </div>
</template>

<style>
/* Botões flutuantes sobre o canvas */
.floating-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 0.25rem; /* cantos retos arredondados coerentes */
  background: var(--gradient-dark-metal);
  border: 2px solid var(--color-retro-gray-600);
  color: var(--color-retro-metal);
  box-shadow: var(--shadow-bevel);
  cursor: pointer;
  transition: all 0.2s ease;
}

.floating-btn:hover {
  border-color: var(--color-neon-cyan);
  color: var(--color-neon-cyan);
  box-shadow: var(--shadow-neon-cyan);
  transform: scale(1.08);
}

.floating-btn:active {
  box-shadow: var(--shadow-inset-metal);
  transform: scale(0.96);
}

.floating-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.floating-btn--primary {
  width: 3.75rem;
  height: 3.75rem;
  border-color: var(--color-neon-green);
  color: var(--color-neon-green);
}

.floating-btn--primary:hover {
  background: rgba(0, 255, 65, 0.15);
  border-color: var(--color-neon-green);
  color: #fff;
  box-shadow: var(--shadow-neon-green);
}

.floating-btn--danger {
  border-color: var(--color-neon-red);
  color: var(--color-neon-red);
}

.floating-btn--danger:hover {
  background: rgba(255, 7, 58, 0.15);
  border-color: var(--color-neon-red);
  color: #fff;
  box-shadow: var(--shadow-neon-red);
}
</style>
