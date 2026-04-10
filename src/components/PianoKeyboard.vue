<template>
  <div class="piano-wrap" ref="wrapRef">
    <div
      class="piano"
      :style="{ height: `${keyHeight}px` }"
    >
      <!-- White keys -->
      <div
        v-for="key in whiteKeys"
        :key="key.midi"
        class="key white"
        :class="keyClass(key.midi)"
        :style="{ left: `${(key.leftOffset / totalWhiteKeys) * 100}%`, width: `${100 / totalWhiteKeys}%` }"
        @mousedown="handlePress(key.midi)"
        @mouseup="handleRelease(key.midi)"
        @mouseleave="handleRelease(key.midi)"
        @touchstart.prevent="handlePress(key.midi)"
        @touchend.prevent="handleRelease(key.midi)"
      >
        <span class="key-label" v-if="showLabels">{{ key.note.label }}</span>
      </div>

      <!-- Black keys -->
      <div
        v-for="key in blackKeys"
        :key="key.midi"
        class="key black"
        :class="keyClass(key.midi)"
        :style="{
          left: `calc(${(key.leftOffset / totalWhiteKeys) * 100}% + ${blackKeyWidthPct / 3.5}%)`,
          width: `${blackKeyWidthPct}%`,
        }"
        @mousedown="handlePress(key.midi)"
        @mouseup="handleRelease(key.midi)"
        @mouseleave="handleRelease(key.midi)"
        @touchstart.prevent="handlePress(key.midi)"
        @touchend.prevent="handleRelease(key.midi)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { buildKeyboardLayout, countWhiteKeys } from '@/utils/noteEngine'

// ─── Props ──────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  startMidi?: number
  endMidi?: number
  activeNotes?: Set<number>     // currently pressed (from MIDI input)
  targetNote?: number | null    // primary target (lowest unplayed in chord)
  targetNotes?: Set<number>     // ALL notes in the current chord to highlight
  wrongNote?: number | null     // a wrong note to highlight
  showLabels?: boolean
  keyHeight?: number
}>(), {
  startMidi: 48,
  endMidi: 84,
  activeNotes: () => new Set(),
  targetNote: null,
  targetNotes: () => new Set(),
  wrongNote: null,
  showLabels: true,
  keyHeight: 160,
})

const emit = defineEmits<{
  noteOn: [midi: number]
  noteOff: [midi: number]
}>()

// ─── Layout ─────────────────────────────────────────────────────────────────
const allKeys = computed(() => buildKeyboardLayout(props.startMidi, props.endMidi))
const whiteKeys = computed(() => allKeys.value.filter(k => !k.isBlack))
const blackKeys = computed(() => allKeys.value.filter(k => k.isBlack))
const totalWhiteKeys = computed(() => countWhiteKeys(props.startMidi, props.endMidi))
const blackKeyWidthPct = computed(() => (60 / totalWhiteKeys.value))

// ─── Key state ──────────────────────────────────────────────────────────────
function keyClass(midi: number) {
  const isActive   = props.activeNotes.has(midi)
  // A key is "target" if it's in the chord set OR is the single targetNote
  const isTarget   = props.targetNotes.has(midi) || props.targetNote === midi
  const isWrong    = props.wrongNote === midi && !isTarget
  const isCorrect  = isTarget && isActive   // held target note → green
  // Octave-off: same pitch class as any target, but not in the required set
  const isOctaveOff = !isTarget &&
    [...props.targetNotes].some(t => t % 12 === midi % 12) &&
    isActive

  return {
    'key--active':  isActive && !isTarget && !isWrong,
    'key--target':  isTarget && !isCorrect,
    'key--correct': isCorrect,
    'key--wrong':   isWrong && isActive,
    'key--octave':  isOctaveOff,
  }
}

// ─── Mouse/touch interaction ─────────────────────────────────────────────────
const pressedByMouse = new Set<number>()

function handlePress(midi: number) {
  pressedByMouse.add(midi)
  emit('noteOn', midi)
}

function handleRelease(midi: number) {
  if (pressedByMouse.has(midi)) {
    pressedByMouse.delete(midi)
    emit('noteOff', midi)
  }
}

const wrapRef = ref<HTMLElement | null>(null)
</script>

<style scoped>
.piano-wrap {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
}

.piano {
  position: relative;
  min-width: 480px;
  width: 100%;
  user-select: none;
  touch-action: none;
}

.key {
  position: absolute;
  top: 0;
  border-radius: 0 0 8px 8px;
  cursor: pointer;
  transition: background 80ms ease, transform 60ms ease, box-shadow 80ms ease;
}

/* ── White keys ──────────────────────────────────────────── */
.key.white {
  height: 100%;
  background: var(--nf-key-white);
  border: 1px solid #aaaabc;
  border-top: none;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 10px;
}

.key.white:active,
.key.white.key--active {
  background: #c8c8d8;
  transform: scaleY(0.97);
  transform-origin: top;
}

.key.white.key--target {
  background: #a8d4ff;
  box-shadow: inset 0 -4px 0 var(--nf-blue);
}

.key.white.key--correct {
  background: var(--nf-accent);
  box-shadow: inset 0 -4px 0 var(--nf-accent-dim);
}

.key.white.key--wrong {
  background: #ffb8c0;
  box-shadow: inset 0 -4px 0 var(--nf-error);
  animation: shake 200ms ease;
}

.key.white.key--octave {
  background: #ffe0a0;
  box-shadow: inset 0 -4px 0 var(--nf-warn);
}

/* ── Black keys ──────────────────────────────────────────── */
.key.black {
  height: 62%;
  background: var(--nf-key-black);
  border: 1px solid #050508;
  border-top: none;
  z-index: 2;
  box-shadow: 2px 4px 8px rgba(0,0,0,0.5);
}

.key.black:active,
.key.black.key--active {
  background: #2a2a3c;
  box-shadow: 1px 2px 4px rgba(0,0,0,0.5);
  transform: scaleY(0.97);
  transform-origin: top;
}

.key.black.key--target {
  background: #1e3d6a;
  box-shadow: 0 0 12px var(--nf-blue), 2px 4px 8px rgba(0,0,0,0.5);
}

.key.black.key--correct {
  background: #4a7a10;
  box-shadow: 0 0 12px var(--nf-accent), 2px 4px 8px rgba(0,0,0,0.5);
}

.key.black.key--wrong {
  background: #6a1020;
  box-shadow: 0 0 12px var(--nf-error);
  animation: shake 200ms ease;
}

/* ── Labels ──────────────────────────────────────────────── */
.key-label {
  font-family: var(--nf-font-mono);
  font-size: 0.55rem;
  color: #888899;
  pointer-events: none;
}

.key--target .key-label,
.key--correct .key-label {
  color: #334;
  font-weight: 700;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
</style>
