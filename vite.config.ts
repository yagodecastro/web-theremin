import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import * as path from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/web-theremin/' : '/',
  plugins: [vue(), tailwindcss()],

  server: {
    watch: {
      usePolling: true
    }
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  // Pré-bundling explícito de libs pesadas — elimina a análise lazy no primeiro acesso
  optimizeDeps: {
    include: ['pixi.js', 'tone', '@mediapipe/tasks-vision', 'tonal']
  },

  build: {
    // ESNext permite top-level await nativo e output menor (sem polyfills desnecessários)
    target: 'esnext',

    rollupOptions: {
      output: {
        /**
         * Chunks separados por lib pesada:
         *   - pixi.js     ~1.5 MB → carregado só ao inicializar o canvas
         *   - tone        ~400 KB → carregado só ao conectar o áudio
         *   - mediapipe   ~250 KB (wasm fica em /public) → carregado na inicialização gestual
         *   - vendor      Vue + Pinia + tonal → cacheable separadamente
         *
         * Resultado: o bundle inicial (Vue app) fica < 100 KB;
         * cada lib pesada é cacheada pelo browser independentemente.
         */
        manualChunks: {
          pixi: ['pixi.js'],
          tone: ['tone'],
          mediapipe: ['@mediapipe/tasks-vision'],
          vendor: ['vue', 'pinia', 'tonal']
        }
      }
    }
  }
})
