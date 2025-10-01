<script setup lang="ts">
defineProps<{
  label: string
  variant: 'primary' | 'secondary' | 'danger' | 'warning'
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const variantClasses = {
  primary: 'text-neon-green border-neon-green hover:shadow-neon-green',
  secondary: 'text-retro-gray-500 border-retro-gray-700',
  danger: 'text-neon-red border-neon-red hover:shadow-neon-red',
  warning: 'text-neon-amber border-neon-amber hover:shadow-neon-amber'
}

const ledClasses = {
  primary: 'bg-led-green shadow-led-on animate-pulse-neon',
  secondary: 'bg-led-off',
  danger: 'bg-led-red shadow-led-on animate-pulse-neon',
  warning: 'bg-led-amber shadow-led-on animate-pulse-neon'
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
      <span class="w-2 h-2 rounded-full" :class="ledClasses[variant]" />
      {{ label }}
    </span>
  </button>
</template>
