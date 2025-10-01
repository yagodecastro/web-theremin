<script setup lang="ts">
import { useAppStore } from '@/stores/appStore.ts'

const appStore = useAppStore()

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString()
}
</script>

<template>
  <div class="bg-retro-black border-2 border-retro-gray-700 rounded-lg overflow-hidden">
    <div
      class="bg-retro-gray-800 px-4 py-2 border-b border-retro-gray-600 flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <div class="flex gap-1">
          <div class="w-3 h-3 rounded-full bg-led-red shadow-led-on" />
          <div class="w-3 h-3 rounded-full bg-led-amber shadow-led-on" />
          <div class="w-3 h-3 rounded-full bg-led-green shadow-led-on" />
        </div>
        <span class="text-neon-green font-typewriter text-sm font-bold">SYSTEM.LOG</span>
      </div>
      <div class="text-xs text-neon-amber font-mono animate-flicker">LOGGING ACTIVE</div>
    </div>

    <div
      ref="terminalElement"
      class="bg-retro-black text-neon-green font-mono text-[11px] leading-tight p-4 h-[160px] overflow-y-auto relative"
    >
      <div class="mb-2 text-neon-amber">GESTURE-MIDI-CONTROLLER v1.0</div>

      <div
        v-for="log in appStore.systemLogs.slice(0, 20)"
        :key="log.id"
        :class="[
          'mb-1',
          log.level === 'error' && 'text-red-400',
          log.level === 'warn' && 'text-yellow-400'
        ]"
      >
        [{{ formatTime(log.timestamp) }}] {{ log.message }}
      </div>

      <div v-if="appStore.systemLogs.length === 0" class="text-gray-500">Nenhum log disponível</div>

      <div class="flex items-center mt-2">
        <span class="text-neon-amber mr-2">$</span>
        <div class="w-2 h-3 bg-neon-green animate-flicker" />
      </div>

      <div class="absolute inset-0 bg-crt-lines bg-lines opacity-10 pointer-events-none" />
    </div>
  </div>
</template>
