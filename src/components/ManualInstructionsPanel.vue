<template>
  <details class="group bg-dark-metal border-2 border-retro-gray-600 rounded-lg shadow-bevel">
    <summary
      class="p-4 cursor-pointer select-none hover:bg-retro-gray-700 transition-colors text-neon-pink font-typewriter font-bold text-lg uppercase tracking-wider"
    >
      OPERATION MANUAL
    </summary>
    <div class="px-6 pb-6">
      <div
        class="bg-retro-black p-4 rounded border border-retro-gray-700 font-mono text-sm text-neon-green"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p class="text-neon-amber font-bold mb-2">► HAND GESTURES:</p>
            <ul class="space-y-1 text-xs">
              <li>
                <span class="text-neon-cyan">RIGHT 3-FINGER:</span> Middle, Ring, Pinky spread (CC1)
              </li>
              <li>
                <span class="text-neon-green">LEFT 3-FINGER:</span> Middle, Ring, Pinky spread
                (CC11)
              </li>
              <li><span class="text-neon-pink">MOUTH OPENING:</span> Mouth opening (CC21)</li>
            </ul>
          </div>
          <div>
            <p class="text-neon-amber font-bold mb-2">► NOTE CONTROL:</p>
            <ul class="space-y-1 text-xs">
              <li>
                <span class="text-neon-cyan">PINCH:</span> Thumb + Index proximity to
                trigger/release notes
              </li>
              <li><span class="text-neon-cyan">PITCH:</span> Pentatonic scale mapping (Y-axis)</li>
              <li>
                <span class="text-neon-cyan">VELOCITY:</span> Pinch strength controls note volume
                (40-120)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </details>
</template>
<script setup lang="ts"></script>
