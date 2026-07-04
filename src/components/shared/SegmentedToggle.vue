<script setup lang="ts">
/**
 * Toggle segmentado de duas opções estilo pill.
 * Exemplo: <SegmentedToggle :options="[{value:'a',label:'A'},{value:'b',label:'B'}]" v-model="val" />
 */
defineProps<{
  modelValue: string
  options: { value: string; label: string }[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div
    class="inline-flex w-full rounded-md border border-retro-gray-600 bg-retro-black overflow-hidden"
    :class="{ 'opacity-55 pointer-events-none': disabled }"
    role="group"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="flex-1 py-2 text-xs font-typewriter uppercase tracking-wider transition-all duration-200 focus:outline-none"
      :class="
        modelValue === option.value
          ? 'bg-neon-cyan/20 text-neon-cyan font-bold'
          : 'text-slate-300 hover:text-white hover:bg-retro-gray-700'
      "
      :aria-pressed="modelValue === option.value"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
