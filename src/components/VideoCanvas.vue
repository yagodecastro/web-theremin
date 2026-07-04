<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/appStore'

const emit = defineEmits<{
  videoReady: [element: HTMLVideoElement]
  visualsReady: [container: HTMLCanvasElement]
}>()

const store = useAppStore()
const container = ref<HTMLDivElement>()
const videoElement = ref<HTMLVideoElement>()
const visualsContainer = ref<HTMLCanvasElement>()

const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    await container.value?.requestFullscreen()
  } else {
    await document.exitFullscreen()
  }
}

const onFullscreenChange = () => store.setFullscreen(!!document.fullscreenElement)

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  if (videoElement.value) emit('videoReady', videoElement.value)
  if (visualsContainer.value) emit('visualsReady', visualsContainer.value)
})

onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFullscreenChange))

defineExpose({ toggleFullscreen })
</script>

<template>
  <div
    ref="container"
    class="relative w-full h-full overflow-hidden bg-black"
    @dblclick="toggleFullscreen"
  >
    <video
      ref="videoElement"
      class="absolute inset-0 w-full h-full object-cover -scale-x-100 opacity-0 pointer-events-none"
      autoplay
      muted
      playsinline
    />
    <canvas
      ref="visualsContainer"
      class="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none"
    />

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
