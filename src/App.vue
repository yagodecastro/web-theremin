<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { AppController } from '@/app/core/AppController.ts'
import { useAppStore } from '@/stores/appStore'
import MainHeader from '@/components/MainHeader.vue'
import Controls from '@/components/Controls.vue'
import VideoCanvas from '@/components/VideoCanvas.vue'
import LogTerminal from '@/components/LogTerminal.vue'
import { defaultConfig } from '@/app/shared/config/defaults.ts'

const videoElement = ref<HTMLVideoElement>()
const visualsCanvas = ref<HTMLCanvasElement>()
const store = useAppStore()
let appInstance: AppController | null = null

/**
 * Tenta inicializar o sistema principal.
 * Só executa se ambos os elementos (video e canvas) estiverem prontos
 * e a inicialização ainda não tiver ocorrido.
 */
const tryInitializeSystem = async () => {
  // Logs detalhados de diagnóstico
  store.addSystemLog('info', `App.vue: Verificando condições de inicialização...`)
  store.addSystemLog('info', `App.vue: Video element ready: ${!!videoElement.value}`)
  store.addSystemLog('info', `App.vue: Canvas element ready: ${!!visualsCanvas.value}`)
  store.addSystemLog('info', `App.vue: Current status: ${store.status}`)

  if (videoElement.value && visualsCanvas.value && store.status === 'idle') {
    try {
      store.addSystemLog(
        'info',
        'AppController.vue: Iniciando construção da instância AppController...'
      )
      const app = new AppController(defaultConfig, store)
      appInstance = app
      store.setAppSystem(app)

      store.addSystemLog(
        'info',
        'AppController.vue: Inicializando serviços (video, canvas, MIDI, câmera)...'
      )
      const { midiOutputs, cameras } = await app.initialize(videoElement.value, visualsCanvas.value)

      store.setMidiOutputs(midiOutputs)
      store.setCameras(cameras)

      store.addSystemLog(
        'info',
        `App.vue: Dispositivos detectados - MIDI: ${midiOutputs.length}, Câmeras: ${cameras.length}`
      )
      store.addSystemLog('info', 'AppController.vue: Sistema inicializado com sucesso.')

      // Log final do diagnóstico
      const diagnostics = store.systemDiagnostics
      store.addSystemLog('info', `App.vue: Diagnóstico final - ${JSON.stringify(diagnostics)}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      store.addSystemLog('error', `App.vue: Erro crítico na inicialização: ${errorMessage}`)
      store.addSystemLog(
        'error',
        `App.vue: Stack trace: ${error instanceof Error ? error.stack : 'N/A'}`
      )
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
    // Diagnóstico detalhado do problema
    const diagnostics = store.systemDiagnostics
    store.addSystemLog('warn', 'AppController.vue: Sistema não está pronto para iniciar.')
    store.addSystemLog('warn', `App.vue: Diagnóstico detalhado: ${JSON.stringify(diagnostics)}`)

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

const handlePanicMidi = () => {
  if (appInstance) {
    appInstance.panicMidi()
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
  <div class="w-full max-w-7xl mx-auto my-12 min-h-screen bg-retro-blue text-white font-mono pt-4">
    <MainHeader />

    <main class="flex-1 space-y-4 mt-4">
      <div class="bg-dark-metal p-6 rounded-lg border-2 border-retro-gray-600 shadow-bevel">
        <div class="flex items-center gap-4 mb-4">
          <div class="w-2 h-6 bg-neon-cyan rounded-full animate-glow shadow-neon-cyan" />
          <h2 class="text-neon-green font-typewriter font-bold text-lg uppercase tracking-wider">
            CONTROL INTERFACE
          </h2>
        </div>
        <Controls
          @panic="handlePanicMidi"
          @restart="handleRestart"
          @start="handleStart"
          @stop="handleStop"
          @full-restart="handleFullSystemRestart"
        />
      </div>

      <div class="grid grid-cols-1 gap-4">
        <div class="lg:col-span-2 space-y-4">
          <div class="p-2 rounded border border-retro-gray-700 shadow-crt">
            <VideoCanvas @video-ready="onVideoReady" @visuals-ready="onVisualsReady" />
          </div>
        </div>
      </div>
      <div class="bg-dark-metal p-6 rounded-lg border-2 border-retro-gray-600 shadow-bevel">
        <LogTerminal />
      </div>
      <div class="grid grid-cols-1 gap-2"></div>
    </main>
  </div>
</template>
