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

const emit = defineEmits(['start', 'stop', 'restart', 'recovery', 'panic', 'full-restart'])
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 md:justify-between gap-8">
    <div class="grid grid-cols-1 md:grid-cols-2 md:col-span-2 gap-4">
      <LabeledSelect
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
              // Reverte seleção se houve erro
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
        @click="store.hasError ? emit('full-restart') : emit(store.isRunning ? 'restart' : 'start')"
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
        :disabled="!store.devices.midi.selectedMidiOutput"
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
        :disabled="!store.devices.midi.selectedMidiOutput"
        label="TEST MIDI"
        variant="secondary"
        @click="() => store.appSystem?.testMidi()"
      />
    </div>
  </div>
</template>
