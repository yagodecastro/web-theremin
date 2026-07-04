<script lang="ts" setup>
import { computed } from 'vue'
import { useAppStore } from '@/stores/appStore'
import Controls from '@/components/Controls.vue'
import { X, Play, Square, TriangleAlert, RotateCcw, Wrench } from 'lucide-vue-next'

const store = useAppStore()

// Label e ícone do botão START contextual
const startLabel = computed(() => {
  if (store.hasError) return 'RESTART'
  if (store.isRunning) return 'RESTART'
  return 'START'
})

const startIcon = computed(() => {
  if (store.hasError || store.isRunning) return RotateCcw
  return Play
})

const startVariant = computed(() => {
  if (store.hasError) return 'warning'
  if (store.isRunning) return 'secondary'
  return 'primary'
})

const emit = defineEmits<{
  close: []
  panic: []
  restart: []
  start: []
  stop: []
  'full-restart': []
  'switch-audio-mode': [mode: 'tone' | 'midi']
  fullscreen: []
}>()

const handleStartClick = () => {
  if (store.hasError) emit('full-restart')
  else if (store.isRunning) emit('restart')
  else emit('start')
}
</script>

<template>
  <!-- Backdrop -->
  <Transition name="backdrop">
    <div
      v-if="store.isSideMenuOpen"
      class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />
  </Transition>

  <!-- Side panel -->
  <Transition name="sidemenu">
    <div
      v-if="store.isSideMenuOpen"
      id="side-menu"
      aria-label="Configurações"
      class="fixed top-0 left-0 z-50 h-full w-96 flex flex-col bg-black/75 backdrop-blur-xl border-r border-white/10 shadow-2xl"
      role="dialog"
      aria-modal="true"
    >
      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <div class="flex items-center justify-between p-4 border-b border-retro-gray-700 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-1.5 h-5 bg-neon-green rounded-full animate-glow shadow-neon-green" />
          <h1 class="text-lg font-display text-white tracking-widest uppercase">Web Theremin</h1>
        </div>
        <div class="flex items-center gap-3">
          <button
            id="close-sidemenu-btn"
            class="text-slate-400 hover:text-neon-cyan transition-colors p-1.5 rounded hover:bg-white/10"
            aria-label="Fechar configurações"
            @click="emit('close')"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- ── Barra de sessão sticky ──────────────────────────────────────── -->
      <div
        class="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-black/60 backdrop-blur-xl border-b border-white/10 shrink-0"
      >
        <!-- START / RESTART -->
        <button
          id="session-start-btn"
          class="session-btn"
          :class="{
            'session-btn--primary': startVariant === 'primary',
            'session-btn--secondary': startVariant === 'secondary',
            'session-btn--warning': startVariant === 'warning'
          }"
          :disabled="store.isBusy && !store.hasError"
          @click="handleStartClick"
        >
          <component :is="startIcon" class="w-3.5 h-3.5" />
          {{ startLabel }}
        </button>

        <!-- STOP -->
        <button
          id="session-stop-btn"
          class="session-btn session-btn--danger"
          :disabled="!store.isRunning || store.isBusy"
          @click="emit('stop')"
        >
          <Square class="w-3.5 h-3.5" />
          STOP
        </button>

        <!-- RECOVERY — só aparece em erro -->
        <button
          v-if="store.hasError"
          id="session-recovery-btn"
          class="session-btn session-btn--warning"
          @click="emit('restart')"
        >
          <Wrench class="w-3.5 h-3.5" />
          RECOVERY
        </button>

        <!-- PANIC — sempre visível à direita -->
        <button
          id="session-panic-btn"
          class="session-btn session-btn--danger ml-auto"
          :disabled="store.audioMode === 'midi' && !store.devices.midi.selectedMidiOutput"
          @click="emit('panic')"
        >
          <TriangleAlert class="w-3.5 h-3.5" />
          PANIC
        </button>
      </div>

      <!-- ── Seções de controle (scrollable) ────────────────────────────── -->
      <div class="flex-1 overflow-y-auto p-4">
        <Controls @fullscreen="emit('fullscreen')" />
      </div>

      <!-- ── Footer fixo ─────────────────────────────────────────────────── -->
      <footer
        class="p-4 border-t border-retro-gray-700 text-center text-xs text-gray-300 font-mono space-y-2 shrink-0"
      >
        <p>Trabalho de Conclusão de Curso — MBA em Engenharia de Software · USP · 2026</p>
        <span class="flex justify-center gap-3 flex-wrap">
          <a
            href="https://doi.org/10.5281/zenodo.20184763"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img alt="DOI" src="https://zenodo.org/badge/1062915118.svg" />
          </a>
          <a
            class="inline-flex items-center gap-1 text-neon-cyan hover:text-white transition-colors"
            href="https://github.com/yagodecastro/web-theremin"
            rel="noopener noreferrer"
            target="_blank"
          >
            <img
              alt="GitHub"
              aria-hidden="true"
              height="12"
              src="/GitHub_Invertocat_White.svg"
              width="12"
            />
            yagodecastro/web-theremin
          </a>
        </span>
        <p>Autor: de Castro, Yago F. B.</p>
      </footer>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Botões da barra de sessão ──────────────────────────────────────────────── */
.session-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.6rem;
  border-radius: 0.25rem;
  border: 1px solid;
  font-family: var(--font-typewriter), monospace;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: all 0.15s ease;
  white-space: nowrap;
  cursor: pointer;
}

.session-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.session-btn--primary {
  color: #4ade80; /* neon-green */
  border-color: #4ade80;
  background: transparent;
}
.session-btn--primary:hover:not(:disabled) {
  background: rgb(74 222 128 / 0.12);
}

.session-btn--secondary {
  color: #94a3b8;
  border-color: #475569;
  background: transparent;
}
.session-btn--secondary:hover:not(:disabled) {
  background: rgb(148 163 184 / 0.1);
}

.session-btn--danger {
  color: #f87171; /* neon-red */
  border-color: #f87171;
  background: transparent;
}
.session-btn--danger:hover:not(:disabled) {
  background: rgb(248 113 113 / 0.12);
}

.session-btn--warning {
  color: #fbbf24; /* neon-amber */
  border-color: #fbbf24;
  background: transparent;
}
.session-btn--warning:hover:not(:disabled) {
  background: rgb(251 191 36 / 0.12);
}

/* ── Transições ─────────────────────────────────────────────────────────────── */
</style>
