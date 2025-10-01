# Theremin Gestual

Aplicação web de rastreamento gestual para geração de MIDI e feedback visual em tempo real. Converte movimentos das mãos
capturados pela webcam em notas musicais e efeitos visuais.

## Tecnologias

- **Vue 3** com Composition API e TypeScript
- **MediaPipe** para rastreamento de mãos
- **WebMIDI API** com Tonal.js para teoria musical
- **PixiJS** para efeitos visuais em tempo real
- **TailwindCSS** para estilização
- **Pinia** para gerenciamento de estado

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