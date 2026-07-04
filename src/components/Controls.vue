<script lang="ts" setup>
import { computed } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { MidiService } from '@/app/domains/midi/MidiService'
import LabeledSelect from './shared/LabeledSelect.vue'
import SegmentedToggle from './shared/SegmentedToggle.vue'
import ActionButton from './shared/ActionButton.vue'
import {
  ArrowDownUp,
  AudioLines,
  ListMusic,
  Maximize,
  Minimize,
  Settings,
  Music,
  Palette,
  PlugZap,
  Sparkles,
  Video,
  Zap,
  Maximize2
} from 'lucide-vue-next'

const store = useAppStore()

// ── Opções ───────────────────────────────────────────────────────────────────

const poeticModeOptions = [
  { value: 'classic', label: 'CLASSIC' },
  { value: 'synesthesia', label: 'SYNESTHESIA' },
  { value: 'constellation', label: 'CONSTELLATION' }
]

const audioModeOptions = [
  { value: 'tone', label: 'SYNTH' },
  { value: 'midi', label: 'EXT. MIDI' }
]

const poeticModeIcon = computed(() => {
  switch (store.poeticMode) {
    case 'synesthesia':
      return Palette
    case 'constellation':
      return Sparkles
    default:
      return Zap
  }
})

const midiOutputOptions = computed(() =>
  store.devices.midi.availableMidiOutputs.map((output: string) => ({
    value: output,
    label: output
  }))
)

const cameraOptions = computed(() =>
  store.devices.webcam.availableCameras.map((camera: { deviceId: string; label: string }) => ({
    value: camera.deviceId,
    label: camera.label
  }))
)

const tonicOptions = computed(() =>
  store.musicalConfig.availableTonics.map((note: string) => ({ value: note, label: note }))
)

const scaleOptions = computed(() => store.musicalConfig.availableScales)

const octaveRangeOptions = [1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n} oct` }))

const baseOctaveOptions = [1, 2, 3, 4, 5, 6, 7].map(n => ({ value: String(n), label: `Oct ${n}` }))

// ── Emits & handlers ─────────────────────────────────────────────────────────

const emit = defineEmits<{
  fullscreen: []
}>()

const setAudioMode = async (mode: 'tone' | 'midi') => {
  store.setAudioMode(mode)
  if (store.appSystem) {
    try {
      await store.appSystem.switchAudioMode(mode)
      store.addSystemLog('info', `Modo de áudio alterado para: ${mode}`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      store.addSystemLog('error', `Erro ao trocar modo de áudio: ${msg}`)
    }
    return
  }

  // Sistema ainda não inicializado: habilita WebMIDI e lista outputs manualmente
  if (mode === 'midi') {
    await initMidiOutputsWithoutSystem()
  } else {
    store.setMidiOutputs([])
  }
}

/** @description Inicializa WebMIDI e popula a store com outputs disponíveis quando o
 *  AppController ainda não foi criado (ex.: usuário troca modo antes de clicar em START).
 */
const initMidiOutputsWithoutSystem = async () => {
  try {
    await MidiService.enableWebMidi()
    const outputNames = MidiService.getAvailableOutputs().map(o => o.name)
    store.setMidiOutputs(outputNames)
    store.addSystemLog(
      'info',
      outputNames.length > 0
        ? `MIDI inicializado: ${outputNames.length} saída(s) encontrada(s)`
        : 'MIDI inicializado: nenhum dispositivo de saída encontrado'
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    store.addSystemLog('error', `Erro ao inicializar MIDI: ${msg}`)
  }
}

const switchCamera = async (value: string) => {
  try {
    store.selectCamera(value)
    if (store.appSystem) await store.appSystem.switchCamera(value)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    store.addSystemLog('error', `Falha ao trocar câmera: ${msg}`)
    const current = store.devices.webcam.availableCameras.find(
      (cam: { deviceId: string }) => cam.deviceId === store.devices.webcam.selectedCamera
    )
    if (current) store.selectCamera(current.deviceId)
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- ── Seção: Escala Musical ───────────────────────────────────────────── -->
    <section aria-labelledby="section-scale">
      <h3 id="section-scale" class="section-title">
        <Music class="w-4 h-4" />
        Escala Musical
      </h3>
      <div class="grid grid-cols-2 gap-3">
        <LabeledSelect
          :icon="Music"
          :model-value="store.musicalConfig.tonic"
          :options="tonicOptions"
          label="TÔNICA"
          variant="purple"
          @update:model-value="store.setTonic"
        />
        <LabeledSelect
          :icon="ListMusic"
          :model-value="store.musicalConfig.scaleName"
          :options="scaleOptions"
          label="ESCALA"
          variant="purple"
          @update:model-value="store.selectScale"
        />
        <LabeledSelect
          :icon="ArrowDownUp"
          :model-value="String(store.musicalConfig.baseOctave)"
          :options="baseOctaveOptions"
          label="BASE OCT"
          variant="purple"
          @update:model-value="v => store.setBaseOctave(Number(v))"
        />
        <LabeledSelect
          :icon="Maximize2"
          :model-value="String(store.musicalConfig.octaveRange)"
          :options="octaveRangeOptions"
          label="RANGE"
          variant="purple"
          @update:model-value="v => store.setOctaveRange(Number(v))"
        />
      </div>
    </section>

    <!-- ── Seção: Áudio ────────────────────────────────────────────────────── -->
    <section aria-labelledby="section-audio">
      <h3 id="section-audio" class="section-title">
        <AudioLines class="w-4 h-4" />
        Áudio
      </h3>
      <div class="space-y-3">
        <SegmentedToggle
          :disabled="store.isBusy"
          :model-value="store.audioMode"
          :options="audioModeOptions"
          @update:model-value="v => setAudioMode(v as 'tone' | 'midi')"
        />
        <LabeledSelect
          v-if="store.audioMode === 'midi'"
          :disabled="store.isBusy"
          :icon="PlugZap"
          :model-value="store.devices.midi.selectedMidiOutput"
          :options="midiOutputOptions"
          label="MIDI OUT"
          variant="amber"
          @update:model-value="
            value => {
              store.selectMidiOutput(value)
              if (store.appSystem) store.appSystem.connectMidi(value)
            }
          "
        />
        <div
          v-else
          class="flex items-center gap-2 px-3 py-2 rounded border border-neon-cyan/20 text-neon-cyan/50 text-xs font-typewriter uppercase tracking-wider"
        >
          <AudioLines class="w-3.5 h-3.5 shrink-0" />
          Browser Audio (Tone.js)
        </div>
      </div>
    </section>

    <!-- ── Seção: Visual ───────────────────────────────────────────────────── -->
    <section aria-labelledby="section-visual">
      <h3 id="section-visual" class="section-title">
        <Palette class="w-4 h-4" />
        Visual
      </h3>
      <div class="space-y-3">
        <LabeledSelect
          :icon="poeticModeIcon"
          :model-value="store.poeticMode"
          :options="poeticModeOptions"
          label="MODO VISUAL"
          variant="cyan"
          @update:model-value="
            v => store.setPoeticMode(v as 'classic' | 'synesthesia' | 'constellation')
          "
        />
        <!-- Câmera: seletor + toggle + opacity em bloco único -->
        <div class="rounded border border-retro-gray-700 bg-retro-black/40 p-3 space-y-3">
          <div class="flex items-center justify-between">
            <span
              class="flex items-center gap-1.5 text-xs font-typewriter uppercase tracking-wider text-neon-cyan"
            >
              <Video class="w-3.5 h-3.5" />
              Câmera
            </span>
            <!-- Toggle switch ON/OFF câmera -->
            <button
              id="toggle-camera-btn"
              role="switch"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none"
              :class="
                store.showCamera
                  ? 'bg-neon-green/30 border-neon-green'
                  : 'bg-slate-600 border-slate-500'
              "
              :aria-checked="store.showCamera"
              :aria-label="store.showCamera ? 'Desativar câmera' : 'Ativar câmera'"
              @click="store.toggleCamera"
            >
              <span
                class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out mt-px"
                :class="
                  store.showCamera
                    ? 'translate-x-3.5 bg-neon-green'
                    : 'translate-x-0.5 bg-slate-200'
                "
              />
            </button>
          </div>
          <LabeledSelect
            :disabled="store.isBusy"
            :icon="Video"
            :model-value="store.devices.webcam.selectedCamera"
            :options="cameraOptions"
            label="DISPOSITIVO"
            variant="cyan"
            @update:model-value="switchCamera"
          />
          <!-- Slider de opacidade — só aparece quando câmera está ativa -->
          <Transition name="fade">
            <div v-if="store.showCamera" class="space-y-1">
              <div class="flex items-center justify-between text-xs text-gray-300 font-mono">
                <span>Opacidade</span>
                <span>{{ Math.round(store.cameraOpacity * 100) }}%</span>
              </div>
              <input
                :value="store.cameraOpacity"
                class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-retro-gray-700 accent-neon-cyan"
                max="1"
                min="0"
                step="0.05"
                type="range"
                @input="e => store.setCameraOpacity(Number((e.target as HTMLInputElement).value))"
              />
            </div>
          </Transition>
        </div>
      </div>
    </section>

    <!-- ── Seção: Sistema ──────────────────────────────────────────────────── -->
    <section aria-labelledby="section-system">
      <h3 id="section-system" class="section-title">
        <Settings class="w-4 h-4" />
        Sistema
      </h3>
      <div class="space-y-3">
        <!-- Modo de Desempenho Otimizado -->
        <div class="rounded border border-retro-gray-700 bg-retro-black/40 p-3 space-y-2">
          <div class="flex items-center justify-between">
            <span
              class="flex items-center gap-1.5 text-xs font-typewriter uppercase tracking-wider text-neon-green"
            >
              <Zap class="w-3.5 h-3.5" />
              Modo Móvel / Otimizado
            </span>
            <button
              id="toggle-performance-btn"
              role="switch"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none"
              :class="
                store.lowPerformanceMode
                  ? 'bg-neon-green/30 border-neon-green'
                  : 'bg-slate-600 border-slate-500'
              "
              :aria-checked="store.lowPerformanceMode"
              aria-label="Ativar modo otimizado para celulares"
              @click="store.setLowPerformanceMode(!store.lowPerformanceMode)"
            >
              <span
                class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out mt-px"
                :class="
                  store.lowPerformanceMode
                    ? 'translate-x-3.5 bg-neon-green'
                    : 'translate-x-0.5 bg-slate-200'
                "
              />
            </button>
          </div>
          <p class="text-[10px] text-slate-400 font-mono leading-normal">
            Recomendado para celulares e dispositivos antigos. Reduz o FPS da IA, desativa a
            detecção facial (olhos) e desliga filtros gráficos pesados de vídeo.
          </p>
        </div>

        <ActionButton
          :icon="store.isFullscreen ? Minimize : Maximize"
          :label="store.isFullscreen ? 'EXIT FULL' : 'FULLSCREEN'"
          :variant="store.isFullscreen ? 'primary' : 'secondary'"
          class="w-full"
          @click="emit('fullscreen')"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-typewriter), monospace;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgb(203 213 225); /* slate-300 para alto contraste */
  margin-bottom: 0.625rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid rgb(75 85 99 / 0.6);
}
</style>
