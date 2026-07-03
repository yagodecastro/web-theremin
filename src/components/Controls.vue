<script lang="ts" setup>
import { computed } from 'vue'
import { useAppStore } from '@/stores/appStore'
import ActionButton from './shared/ActionButton.vue'
import LabeledSelect from './shared/LabeledSelect.vue'

const store = useAppStore()

const midiOutputOptions = computed(() =>
  store.devices.midi.availableMidiOutputs.map(output => ({ value: output, label: output }))
)

const cameraOptions = computed(() =>
  store.devices.webcam.availableCameras.map(camera => ({
    value: camera.deviceId,
    label: camera.label
  }))
)

const tonicOptions = computed(() =>
  store.musicalConfig.availableTonics.map(note => ({ value: note, label: note }))
)

const scaleOptions = computed(() => store.musicalConfig.availableScales)

const octaveRangeOptions = [1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n} oct` }))

const baseOctaveOptions = [1, 2, 3, 4, 5, 6, 7].map(n => ({ value: String(n), label: `Oct ${n}` }))

const emit = defineEmits<{
  start: []
  stop: []
  restart: []
  recovery: []
  panic: []
  'full-restart': []
  'switch-audio-mode': [mode: 'tone' | 'midi']
  fullscreen: []
}>()

const handleStartClick = () => {
  if (store.hasError) emit('full-restart')
  else if (store.isRunning) emit('restart')
  else emit('start')
}

const toggleAudioMode = () => {
  const next = store.audioMode === 'tone' ? 'midi' : 'tone'
  store.setAudioMode(next)
  emit('switch-audio-mode', next)
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4">
    <!-- Linha 1: escala musical -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <LabeledSelect
        :model-value="store.musicalConfig.tonic"
        :options="tonicOptions"
        label="TONIC"
        variant="purple"
        @update:model-value="store.setTonic"
      />
      <LabeledSelect
        :model-value="store.musicalConfig.scaleName"
        :options="scaleOptions"
        label="SCALE"
        variant="purple"
        @update:model-value="store.selectScale"
      />
      <LabeledSelect
        :model-value="String(store.musicalConfig.baseOctave)"
        :options="baseOctaveOptions"
        label="BASE OCT"
        variant="purple"
        @update:model-value="v => store.setBaseOctave(Number(v))"
      />
      <LabeledSelect
        :model-value="String(store.musicalConfig.octaveRange)"
        :options="octaveRangeOptions"
        label="RANGE"
        variant="purple"
        @update:model-value="v => store.setOctaveRange(Number(v))"
      />
    </div>
    <!-- Linha 2: dispositivos -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <ActionButton
        :label="store.audioMode === 'tone' ? 'TONE.JS' : 'MIDI'"
        :variant="store.audioMode === 'tone' ? 'primary' : 'warning'"
        :disabled="store.isBusy"
        @click="toggleAudioMode"
      />
      <LabeledSelect
        v-if="store.audioMode === 'midi'"
        :model-value="store.devices.midi.selectedMidiOutput"
        :options="midiOutputOptions"
        :disabled="store.isBusy"
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
        class="flex items-center px-3 py-1 rounded border border-neon-cyan/30 text-neon-cyan/60 text-xs font-typewriter uppercase tracking-wider"
      >
        DIRECT BROWSER AUDIO
      </div>
      <LabeledSelect
        :model-value="store.devices.webcam.selectedCamera"
        :options="cameraOptions"
        :disabled="store.isBusy"
        label="CAMERA"
        variant="cyan"
        @update:model-value="
          async value => {
            try {
              store.selectCamera(value)
              if (store.appSystem) {
                await store.appSystem.switchCamera(value)
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              store.addSystemLog('error', `Falha ao trocar câmera: ${errorMessage}`)
              const currentCamera = store.devices.webcam.availableCameras.find(
                cam => cam.deviceId === store.devices.webcam.selectedCamera
              )
              if (currentCamera) {
                store.selectCamera(currentCamera.deviceId)
              }
            }
          }
        "
      />
    </div>
    <!-- Linha 3: ações -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-2">
      <ActionButton
        :disabled="store.isBusy && !store.hasError"
        :label="store.hasError ? 'RESTART SYSTEM' : 'START'"
        :variant="store.hasError ? 'warning' : store.isRunning ? 'secondary' : 'primary'"
        @click="handleStartClick"
      />
      <ActionButton
        :disabled="!store.isRunning || store.isBusy"
        :label="'STOP'"
        :variant="'danger'"
        @click="emit('stop')"
      />
      <ActionButton
        v-if="store.hasError"
        label="RECOVERY"
        variant="warning"
        @click="emit('recovery')"
      />
      <ActionButton
        :disabled="store.audioMode === 'midi' && !store.devices.midi.selectedMidiOutput"
        label="PANIC"
        variant="danger"
        @click="emit('panic')"
      />
      <div class="flex flex-col gap-1">
        <ActionButton
          label="CAMERA"
          :variant="store.showCamera ? 'primary' : 'secondary'"
          class="flex-1"
          @click="store.toggleCamera"
        />
        <input
          v-if="store.showCamera"
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="store.cameraOpacity"
          class="w-full h-2 mt-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
          @input="e => store.setCameraOpacity(Number((e.target as HTMLInputElement).value))"
        />
      </div>
      <ActionButton
        :disabled="!store.isRunning"
        :label="store.isFullscreen ? 'EXIT FULL' : 'FULLSCREEN'"
        :variant="store.isFullscreen ? 'primary' : 'secondary'"
        @click="emit('fullscreen')"
      />
    </div>
  </div>
</template>
