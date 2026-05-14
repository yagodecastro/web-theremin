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

const emit = defineEmits<{
  start: []
  stop: []
  restart: []
  recovery: []
  panic: []
  'full-restart': []
  'switch-audio-mode': [mode: 'tone' | 'midi']
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
  <div class="grid grid-cols-1 md:grid-cols-2 md:justify-between gap-4">
    <div class="grid grid-cols-1 md:grid-cols-3 md:col-span-2 gap-3">
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
    <div class="grid grid-cols-2 md:col-span-2 lg:grid-cols-5 gap-2">
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
      <ActionButton
        label="CAMERA"
        :variant="store.showCamera ? 'primary' : 'secondary'"
        @click="store.toggleCamera"
      />
      <ActionButton
        :disabled="store.audioMode === 'midi' && !store.devices.midi.selectedMidiOutput"
        :label="store.audioMode === 'tone' ? 'TEST AUDIO' : 'TEST MIDI'"
        variant="secondary"
        @click="() => store.appSystem?.testMidi()"
      />
    </div>
  </div>
</template>
