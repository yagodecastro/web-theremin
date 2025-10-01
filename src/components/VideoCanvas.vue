<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/appStore'

const emit = defineEmits<{
  videoReady: [element: HTMLVideoElement]
  visualsReady: [container: HTMLCanvasElement]
}>()

const store = useAppStore()
const videoElement = ref<HTMLVideoElement>()
const visualsContainer = ref<HTMLCanvasElement>()

onMounted(() => {
  if (videoElement.value) {
    emit('videoReady', videoElement.value)
  }
  if (visualsContainer.value) {
    emit('visualsReady', visualsContainer.value)
  }
})
</script>

<template>
  <div
    class="max-w-5xl mx-auto aspect-4/3 max-h-full relative w-full h-full rounded-lg overflow-hidden"
  >
    <video
      ref="videoElement"
      class="absolute inset-0 w-full h-full object-cover -scale-x-100"
      autoplay
      muted
      playsinline
    />
    <canvas
      ref="visualsContainer"
      :class="[
        'absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none',
        { 'opacity-90': store.showCamera, 'opacity-100': !store.showCamera }
      ]"
    />

    <div class="absolute top-4 right-4 flex flex-col gap-2">
      <div
        :class="[
          'w-3 h-3 rounded-full',
          store.isReady || store.isRunning
            ? 'bg-green-500'
            : store.hasError
              ? 'bg-red-500'
              : 'bg-yellow-500'
        ]"
        :title="store.statusMessage"
      />
    </div>

    <div
      v-if="!store.isReady && !store.isRunning"
      class="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center"
    >
      <div class="text-white text-center">
        <div v-if="store.isInitializing" class="animate-pulse mb-4">
          <div
            class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"
          />
        </div>
        <div :class="{ 'text-red-500': store.hasError }">{{ store.statusMessage }}</div>
      </div>
    </div>
  </div>
</template>
