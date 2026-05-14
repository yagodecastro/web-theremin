# Web Theremin

[![DOI](https://zenodo.org/badge/1062915118.svg)](https://doi.org/10.5281/zenodo.20184763)

A gestural web theremin: converts hand movements captured by the webcam into musical notes and visual effects in real time. Runs directly in the browser via Tone.js synthesis or connected to an external MIDI device.

> Final Project — **MBA in Software Engineering**  
> University of São Paulo · ESALQ · 2026  
> **Author:** de Castro, Yago F. B.

This project is the practical artifact of the thesis titled *"Expressive Musical Interface on the Web with Gestural Control and Audiovisual Feedback"*. Its goal is to demonstrate the feasibility of building a fully expressive musical interface in the browser — no dedicated hardware required — using computer vision for real-time gesture tracking as the control mechanism and audio synthesis as the means of expression.

## Technologies

- **Vue 3** with Composition API and TypeScript
- **MediaPipe** for hand tracking
- **Tone.js** for in-browser audio synthesis
- **WebMIDI API** for external MIDI output
- **Tonal.js** for music theory
- **PixiJS** for real-time visual effects
- **TailwindCSS** for styling
- **Pinia** for state management

## How to use

1. Open the app and wait for the camera to initialize
2. Configure the musical scale (tonic, scale, base octave, range)
3. Choose the audio mode: **TONE.JS** (browser) or **MIDI** (external device)
4. Click **START** and position your hands in front of the camera
5. **Right hand**: controls the note (X axis) and volume/timbre (Y axis and openness)
6. **Left hand**: controls filter, vibrato and effects (Y axis and openness)
7. Double-click the canvas to toggle fullscreen

## Installation

```bash
bun install
```

## Commands

```bash
# Development
bun run dev

# Production build
bun run build

# Preview the build
bun run preview

# Quality checks
bun run check          # TypeScript + ESLint
bun run typecheck      # TypeScript only
bun run lint           # ESLint only
bun run format         # Prettier
```

## Live demo

[https://yagodecastro.github.io/web-theremin](https://yagodecastro.github.io/web-theremin)

## How to cite

```bibtex
@software{decastro2026webtheremin,
  author    = {de Castro, Yago Fernando Bastos},
  title     = {Web Theremin: Expressive Musical Interface on the Web with Gestural Control and Audiovisual Feedback},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.20184764},
  url       = {https://doi.org/10.5281/zenodo.20184764},
  note      = {Prototype developed as the practical result of the Final Project in Software Engineering — University of São Paulo, USP/ESALQ, 2026}
}
```

## License

MIT
