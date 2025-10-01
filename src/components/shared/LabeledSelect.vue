<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
  label: string
  options: { value: string; label: string }[]
  variant: 'amber' | 'cyan' | 'purple'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const model = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const variantClasses = {
  amber: {
    bg: 'bg-neon-amber',
    shadow: 'shadow-neon-amber',
    text: 'text-neon-amber',
    focus: 'focus:border-neon-amber focus:shadow-neon-amber'
  },
  cyan: {
    bg: 'bg-neon-cyan',
    shadow: 'shadow-neon-cyan',
    text: 'text-neon-cyan',
    focus: 'focus:border-neon-cyan focus:shadow-neon-cyan'
  },
  purple: {
    bg: 'bg-neon-purple',
    shadow: 'shadow-neon-purple',
    text: 'text-neon-purple',
    focus: 'focus:border-neon-purple focus:shadow-neon-purple'
  }
}
</script>

<template>
  <label class="block">
    <span class="flex items-center gap-2 mb-2">
      <span
        class="w-1.5 h-4 rounded-sm animate-glow"
        :class="[variantClasses[variant].bg, variantClasses[variant].shadow]"
      />
      <span
        class="text-xs uppercase tracking-wider font-typewriter"
        :class="variantClasses[variant].text"
      >
        {{ label }}
      </span>
    </span>
    <select
      v-model="model"
      class="w-full bg-retro-black border-2 border-retro-gray-600 rounded px-3 py-2 text-neon-green font-mono text-sm shadow-inset-metal transition-all duration-200 hover:border-retro-gray-500"
      :class="variantClasses[variant].focus"
    >
      <option value="" class="bg-retro-black text-neon-green">SELECT {{ label }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
