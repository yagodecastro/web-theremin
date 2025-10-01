<script lang="ts" setup>
import { computed } from 'vue'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
const fpsInfo = computed(() => {
  const fpsDebug = store.debugInfo.find(item => item.key === 'fps')
  return fpsDebug?.value || '--'
})
</script>

<template>
  <header
    class="bg-dark-metal p-4 rounded-lg border-2 border-retro-gray-600 shadow-bevel max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 items-center justify-between"
  >
    <div class="flex items-center gap-4">
      <div class="w-2 h-6 bg-neon-green rounded-full animate-glow shadow-neon-green" />
      <h1 class="text-2xl font-display text-white tracking-widest">Theremin Gestual Interativo</h1>
    </div>

    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-led-red shadow-led-on animate-pulse-neon" />
        <span class="text-xs font-mono text-neon-red">LIVE</span>
      </div>
      <div v-if="store.isRunning" class="flex items-center gap-2">
        <span class="text-xs font-mono text-neon-cyan">FPS: {{ fpsInfo }}</span>
      </div>
    </div>
  </header>
</template>
