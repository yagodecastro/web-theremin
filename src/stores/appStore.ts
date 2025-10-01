import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { Scale } from 'tonal'
import type { AppController } from '@/app/core'
import { LogType } from 'vite'
import { VisualEffect } from '@/app/domains/visuals'

/** @description Interface para uma entrada de log. */
export interface LogEntry {
  id: string
  timestamp: number
  level: LogType
  message: string
}

/** @description Status da aplicação. */
export type AppStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'error'
  | 'recovering'
  | 'camera_error'

/** @description Store Pinia para o estado global da aplicação. */
export const useAppStore = defineStore('appStore', () => {
  const appSystem = ref<AppController | null>(null)
  const status = ref<AppStatus>('idle')
  const error = ref<string | null>(null)
  const gestureActive = ref(false)
  const lastGesturePosition = ref<{ x: number; y: number } | null>(null)
  const showCamera = ref(false)
  const debugInfoValue = reactive<Array<{ key: string; value: string | undefined }>>([])
  const devices = ref({
    midi: {
      selectedMidiOutput: '',
      availableMidiOutputs: [] as string[]
    },
    webcam: {
      selectedCamera: '',
      availableCameras: [] as Array<{ deviceId: string; label: string }>
    }
  })
  const musicalConfig = ref({
    selectedScale: 'C major',
    baseOctave: 4,
    availableScales: Scale.names()
  })
  const systemLogs = ref<LogEntry[]>([])
  const visualEffects = ref<VisualEffect[]>([])
  let logIdCounter = 0

  const isReady = computed(() => {
    return (
      status.value === 'ready' &&
      appSystem.value !== null &&
      devices.value.midi.availableMidiOutputs.length > 0 &&
      devices.value.webcam.availableCameras.length > 0
    )
  })
  const isRunning = computed(() => status.value === 'running')
  const isInitializing = computed(() => status.value === 'initializing')
  const hasError = computed(() => status.value === 'error' || status.value === 'camera_error')
  const isBusy = computed(() => ['initializing', 'recovering'].includes(status.value))
  const systemHealthStatus = computed(() => {
    if (hasError.value) return 'error'
    if (isBusy.value) return 'busy'
    if (!appSystem.value) return 'not_initialized'
    if (devices.value.midi.availableMidiOutputs.length === 0) return 'no_midi'
    if (devices.value.webcam.availableCameras.length === 0) return 'no_camera'
    if (isReady.value) return 'ready'
    return 'unknown'
  })
  const statusMessage = computed(() => {
    const healthStatus = systemHealthStatus.value
    switch (status.value) {
      case 'idle':
        return 'Aguardando inicialização...'
      case 'initializing':
        return 'Inicializando sistema...'
      case 'ready':
        if (healthStatus === 'no_midi') return 'Sistema pronto - Nenhum dispositivo MIDI detectado'
        if (healthStatus === 'no_camera') return 'Sistema pronto - Nenhuma câmera detectada'
        return 'Sistema pronto'
      case 'running':
        return 'Sistema em execução'
      case 'recovering':
        return 'Tentando recuperar conexão...'
      case 'camera_error':
        return 'Erro na câmera - verifique conexão'
      case 'error':
        return error.value || 'Erro desconhecido'
      default:
        return 'Status desconhecido'
    }
  })
  const systemDiagnostics = computed(() => {
    return {
      appSystem: !!appSystem.value,
      midiDevices: devices.value.midi.availableMidiOutputs.length,
      cameras: devices.value.webcam.availableCameras.length,
      selectedMidi: devices.value.midi.selectedMidiOutput,
      selectedCamera: devices.value.webcam.selectedCamera,
      status: status.value,
      healthStatus: systemHealthStatus.value
    }
  })
  const debugInfo = computed(() => {
    return debugInfoValue
  })

  /** @description Define a instância do AppController. */
  const setAppSystem = (system: AppController) => {
    appSystem.value = system
  }
  /** @description Define o status da aplicação. */
  const setStatus = (newStatus: AppStatus, errorMessage?: string) => {
    status.value = newStatus
    if (newStatus === 'error' && errorMessage) {
      error.value = errorMessage
    } else if (newStatus !== 'error') {
      error.value = null
    }
  }
  /** @description Define a lista de saídas MIDI disponíveis. */
  const setMidiOutputs = (outputs: string[]) => {
    devices.value.midi.availableMidiOutputs = outputs
    if (outputs.length > 0 && !devices.value.midi.selectedMidiOutput) {
      devices.value.midi.selectedMidiOutput = outputs[0]
    }
  }
  /** @description Define a lista de câmeras disponíveis. */
  const setCameras = (cameras: Array<{ deviceId: string; label: string }>) => {
    devices.value.webcam.availableCameras = cameras
    if (cameras.length > 0 && !devices.value.webcam.selectedCamera) {
      devices.value.webcam.selectedCamera = cameras[0].deviceId
    }
  }
  /** @description Adiciona uma entrada de log ao sistema. */
  const addSystemLog = (level: 'info' | 'warn' | 'error', message: string, _data?: unknown) => {
    const timestamp = Date.now()
    const log: LogEntry = {
      id: `${timestamp}-${++logIdCounter}`,
      timestamp,
      level,
      message
    }
    systemLogs.value.unshift(log)
    if (systemLogs.value.length > 100) {
      systemLogs.value.pop()
    }
  }
  /** @description Adiciona um efeito visual à fila para ser processado. */
  const addVisualEffect = (effect: VisualEffect) => {
    visualEffects.value.push(effect)
  }

  /** @description Limpa todos os efeitos visuais da fila. */
  const clearVisualEffects = () => {
    visualEffects.value = []
  }
  /** @description Seleciona um dispositivo de saída MIDI. */
  const selectMidiOutput = (deviceName: string) => {
    devices.value.midi.selectedMidiOutput = deviceName
  }
  /** @description Seleciona um dispositivo de câmera. */
  const selectCamera = (deviceId: string) => {
    devices.value.webcam.selectedCamera = deviceId
  }
  /** @description Seleciona uma escala musical. */
  const selectScale = (scaleName: string) => {
    musicalConfig.value.selectedScale = scaleName
  }
  /** @description Define a oitava base. */
  const setBaseOctave = (octave: number) => {
    musicalConfig.value.baseOctave = octave
  }
  /** @description Alterna a visibilidade da câmera. */
  const toggleCamera = () => {
    showCamera.value = !showCamera.value
  }
  /** @description Adiciona ou atualiza uma informação de debug. */
  const addDebugInfo = (key: string, value: string | undefined) => {
    const index = debugInfoValue.findIndex(item => item.key === key)
    if (index !== -1) {
      debugInfoValue[index] = { ...debugInfoValue[index], value }
    } else {
      debugInfoValue.push({ key, value })
    }
  }

  return {
    appSystem,
    status,
    error,
    gestureActive,
    lastGesturePosition,
    showCamera,
    devices,
    musicalConfig,
    systemLogs,
    debugInfo,
    visualEffects,
    isReady,
    isRunning,
    isInitializing,
    hasError,
    isBusy,
    statusMessage,
    systemHealthStatus,
    systemDiagnostics,
    setAppSystem,
    setStatus,
    setMidiOutputs,
    setCameras,
    addSystemLog,
    addVisualEffect,
    clearVisualEffects,
    selectMidiOutput,
    selectCamera,
    selectScale,
    setBaseOctave,
    toggleCamera,
    addDebugInfo
  }
})

export type AppStore = ReturnType<typeof useAppStore>