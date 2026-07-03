import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { AVAILABLE_SCALES, CHROMATIC_NOTES } from '@/app/shared/utils/musicTheoryUtils'
import type { AppController } from '@/app/core'
import { LogType } from 'vite'

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
  interface PersistentSettings {
    audioMode?: 'tone' | 'midi'
    poeticMode?: 'classic' | 'synesthesia' | 'constellation'
    showCamera?: boolean
    cameraOpacity?: number
    musicalConfig?: {
      tonic?: string
      scaleName?: string
      baseOctave?: number
      octaveRange?: number
    }
    selectedMidiOutput?: string
    selectedCamera?: string
  }

  // Load saved settings from LocalStorage
  const STORAGE_KEY = 'web-theremin:settings'
  let savedSettings: PersistentSettings = {}
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        savedSettings = JSON.parse(raw) as PersistentSettings
      }
    } catch (e) {
      console.error('Failed to load settings from localStorage:', e)
    }
  }

  const appSystem = ref<AppController | null>(null)
  const status = ref<AppStatus>('idle')
  const error = ref<string | null>(null)
  const audioMode = ref<'tone' | 'midi'>(savedSettings.audioMode || 'tone')
  const poeticMode = ref<'classic' | 'synesthesia' | 'constellation'>(savedSettings.poeticMode || 'classic')
  const gestureActive = ref(false)
  const lastGesturePosition = ref<{ x: number; y: number } | null>(null)
  const showCamera = ref<boolean>(savedSettings.showCamera !== undefined ? savedSettings.showCamera : false)
  const cameraOpacity = ref<number>(savedSettings.cameraOpacity !== undefined ? savedSettings.cameraOpacity : 0.6)
  const isFullscreen = ref(false)
  const debugInfoValue = reactive<Array<{ key: string; value: string | undefined }>>([])
  const devices = ref({
    midi: {
      selectedMidiOutput: savedSettings.selectedMidiOutput || '',
      availableMidiOutputs: [] as string[]
    },
    webcam: {
      selectedCamera: savedSettings.selectedCamera || '',
      availableCameras: [] as Array<{ deviceId: string; label: string }>
    }
  })
  const musicalConfig = ref({
    tonic: savedSettings.musicalConfig?.tonic || 'A',
    scaleName: savedSettings.musicalConfig?.scaleName || 'minor pentatonic',
    baseOctave: savedSettings.musicalConfig?.baseOctave !== undefined ? savedSettings.musicalConfig.baseOctave : 3,
    octaveRange: savedSettings.musicalConfig?.octaveRange !== undefined ? savedSettings.musicalConfig.octaveRange : 3,
    availableScales: AVAILABLE_SCALES,
    availableTonics: CHROMATIC_NOTES
  })
  const systemLogs = ref<LogEntry[]>([])
  let logIdCounter = 0

  const isReady = computed(() => {
    const hasMidi =
      audioMode.value === 'midi' ? devices.value.midi.availableMidiOutputs.length > 0 : true
    return (
      status.value === 'ready' &&
      appSystem.value !== null &&
      hasMidi &&
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
    if (audioMode.value === 'midi' && devices.value.midi.availableMidiOutputs.length === 0)
      return 'no_midi'
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
    const currentSelected = devices.value.midi.selectedMidiOutput
    if (outputs.length > 0) {
      if (!currentSelected || !outputs.includes(currentSelected)) {
        devices.value.midi.selectedMidiOutput = outputs[0]
      }
    } else {
      devices.value.midi.selectedMidiOutput = ''
    }
  }
  /** @description Define a lista de câmeras disponíveis. */
  const setCameras = (cameras: Array<{ deviceId: string; label: string }>) => {
    devices.value.webcam.availableCameras = cameras
    const currentSelected = devices.value.webcam.selectedCamera
    if (cameras.length > 0) {
      if (!currentSelected || !cameras.some(cam => cam.deviceId === currentSelected)) {
        devices.value.webcam.selectedCamera = cameras[0].deviceId
      }
    } else {
      devices.value.webcam.selectedCamera = ''
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
  /** @description Seleciona um dispositivo de saída MIDI. */
  const selectMidiOutput = (deviceName: string) => {
    devices.value.midi.selectedMidiOutput = deviceName
  }
  /** @description Seleciona um dispositivo de câmera. */
  const selectCamera = (deviceId: string) => {
    devices.value.webcam.selectedCamera = deviceId
  }
  /** @description Seleciona uma escala musical e propaga ao serviço de áudio. */
  const selectScale = (scaleName: string) => {
    musicalConfig.value.scaleName = scaleName
    appSystem.value?.setScale(scaleName)
  }
  /** @description Define a tônica e propaga ao serviço de áudio. */
  const setTonic = (tonic: string) => {
    musicalConfig.value.tonic = tonic
    appSystem.value?.setTonic(tonic)
  }
  /** @description Define a oitava base e propaga ao serviço de áudio. */
  const setBaseOctave = (octave: number) => {
    musicalConfig.value.baseOctave = octave
    appSystem.value?.setBaseOctave(octave)
  }
  /** @description Define o range de oitavas e propaga ao serviço de áudio. */
  const setOctaveRange = (range: number) => {
    musicalConfig.value.octaveRange = range
    appSystem.value?.setOctaveRange(range)
  }
  /** @description Define o modo de áudio (tone ou midi). */
  const setAudioMode = (mode: 'tone' | 'midi') => {
    audioMode.value = mode
  }

  const setPoeticMode = (mode: 'classic' | 'synesthesia' | 'constellation') => {
    poeticMode.value = mode
  }

  /** @description Alterna a visibilidade da câmera. */
  const toggleCamera = () => {
    showCamera.value = !showCamera.value
  }
  const setCameraOpacity = (opacity: number) => {
    cameraOpacity.value = opacity
  }

  /** @description Sincroniza o estado de fullscreen com a API do browser. */
  const setFullscreen = (v: boolean) => {
    isFullscreen.value = v
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

  // Salva automaticamente as configurações no LocalStorage quando alteradas
  watch(
    () => ({
      audioMode: audioMode.value,
      poeticMode: poeticMode.value,
      showCamera: showCamera.value,
      cameraOpacity: cameraOpacity.value,
      musicalConfig: {
        tonic: musicalConfig.value.tonic,
        scaleName: musicalConfig.value.scaleName,
        baseOctave: musicalConfig.value.baseOctave,
        octaveRange: musicalConfig.value.octaveRange
      },
      selectedMidiOutput: devices.value.midi.selectedMidiOutput,
      selectedCamera: devices.value.webcam.selectedCamera
    }),
    (newSettings) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
        } catch (e) {
          console.error('Failed to save settings to localStorage:', e)
        }
      }
    },
    { deep: true }
  )

  return {
    appSystem,
    status,
    error,
    audioMode,
    poeticMode,
    gestureActive,
    lastGesturePosition,
    showCamera,
    cameraOpacity,
    isFullscreen,
    devices,
    musicalConfig,
    systemLogs,
    debugInfo,
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
    selectMidiOutput,
    selectCamera,
    selectScale,
    setTonic,
    setBaseOctave,
    setOctaveRange,
    toggleCamera,
    setCameraOpacity,
    setFullscreen,
    addDebugInfo,
    setAudioMode,
    setPoeticMode
  }
})

export type AppStore = ReturnType<typeof useAppStore>
