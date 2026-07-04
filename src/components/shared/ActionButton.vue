<script setup lang="ts">
import { type Component } from 'vue'

defineProps<{
  label: string
  variant: 'primary' | 'secondary' | 'danger' | 'warning'
  disabled?: boolean
  icon?: Component
}>()

const emit = defineEmits<{
  click: []
}>()

const variantClasses = {
  primary: 'text-neon-green border-neon-green hover:shadow-neon-green',
  secondary:
    'text-retro-metal border-retro-gray-500 hover:text-white hover:border-neon-cyan hover:shadow-neon-cyan',
  danger: 'text-neon-red border-neon-red hover:shadow-neon-red',
  warning: 'text-neon-amber border-neon-amber hover:shadow-neon-amber'
}
</script>

<template>
  <button
    :disabled="disabled"
    class="relative bg-dark-metal border-2 border-retro-gray-600 rounded px-1 lg:px-4 py-3 font-typewriter font-bold text-sm uppercase tracking-wider shadow-bevel transition-all duration-200 hover:bg-retro-gray-700 active:shadow-inset-metal disabled:opacity-50 disabled:cursor-not-allowed"
    :class="variantClasses[variant]"
    @click="emit('click')"
  >
    <span class="flex items-center justify-center gap-2 text-xs truncate">
      <component :is="icon" v-if="icon" class="w-4 h-4" />
      {{ label }}
    </span>
  </button>
</template>
