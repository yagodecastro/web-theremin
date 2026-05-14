# Web Theremin

Aplicação web de theremin gestual: converte movimentos das mãos capturados pela webcam em notas musicais e efeitos visuais em tempo real. Funciona direto no browser via síntese Tone.js ou conectado a um dispositivo MIDI externo.

## Tecnologias

- **Vue 3** com Composition API e TypeScript
- **MediaPipe** para rastreamento de mãos
- **Tone.js** para síntese de áudio direta no browser
- **WebMIDI API** para saída MIDI externa
- **Tonal.js** para teoria musical
- **PixiJS** para efeitos visuais em tempo real
- **TailwindCSS** para estilização
- **Pinia** para gerenciamento de estado

## Como usar

1. Abra a aplicação e aguarde a inicialização da câmera
2. Configure a escala musical (tônica, escala, oitava base, range)
3. Escolha o modo de áudio: **TONE.JS** (browser) ou **MIDI** (dispositivo externo)
4. Clique em **START** e posicione as mãos na frente da câmera
5. **Mão direita**: controla a nota (eixo X) e volume/timbre (eixo Y e abertura)
6. **Mão esquerda**: controla filtro, vibrato e efeitos (eixo Y e abertura)
7. Duplo clique no canvas para modo tela cheia

## Instalação

```bash
bun install
```

## Comandos

```bash
# Desenvolvimento
bun run dev

# Build para produção
bun run build

# Preview do build
bun run preview

# Verificação de qualidade
bun run check          # TypeScript + ESLint
bun run typecheck      # Apenas TypeScript
bun run lint           # Apenas ESLint
bun run format         # Prettier
```

## Licença

MIT
