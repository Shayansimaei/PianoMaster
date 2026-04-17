<template>
  <div class="piano-wrap">

    <!-- ── Toolbar ────────────────────────────────────────────────────────── -->
    <div class="piano-toolbar" v-if="showControls">

      <!-- Octave range selector -->
      <div class="toolbar-group">
        <span class="toolbar-label">OCTAVE</span>
        <div class="octave-stepper">
          <button class="step-btn" :disabled="octaveStart <= MIN_OCTAVE" @click="shiftOctave(-1)">−</button>
          <span class="mono octave-display">{{ octaveStart }}–{{ octaveStart + octaveSpan - 1 }}</span>
          <button class="step-btn" :disabled="octaveStart + octaveSpan - 1 >= MAX_OCTAVE" @click="shiftOctave(1)">+</button>
       
        </div>
      </div>

      <!-- Span selector: 1 / 2 / 3 octaves -->
      <div class="toolbar-group">
        <span class="toolbar-label">SPAN</span>
        <div class="span-pills">
          <button
            v-for="n in [1, 2, 3,4]"
            :key="n"
            class="span-pill"
            :class="{ 'span-pill--active': octaveSpan === n }"
            @click="octaveSpan = n"
          >{{ n }} oct</button>
        </div>
      </div>

      <!-- Scale highlight selector -->
      <div class="toolbar-group toolbar-group--scale">
        <span class="toolbar-label">SCALE</span>
        <ion-select
          v-model="selectedScale"
          interface="popover"
          class="scale-select"
          placeholder="None"
        >
          <ion-select-option value="">None</ion-select-option>
          <ion-select-option v-for="s in SCALE_OPTIONS" :key="s.value" :value="s.value">
            {{ s.label }}
          </ion-select-option>
        </ion-select>
      </div>

      <!-- Root note for scale -->
      <div class="toolbar-group" v-if="selectedScale">
        <span class="toolbar-label">ROOT</span>
        <ion-select
          v-model="selectedRoot"
          interface="popover"
          class="root-select"
        >
          <ion-select-option v-for="(name, i) in NOTE_NAMES" :key="i" :value="i">
            {{ name }}
          </ion-select-option>
        </ion-select>
      </div>

    </div>

    <!-- ── Keyboard ───────────────────────────────────────────────────────── -->
    <div class="piano" :style="{ height: `${keyHeight}px` }">

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
        <span class="key-label" v-if="showLabels && !key.note.isBlack">
          {{ key.note.label }}
        </span>
      </div>

      <!-- Black keys -->
      <div
        v-for="key in blackKeys"
        :key="key.midi"
        class="key black"
        :class="keyClass(key.midi)"
        :style="{
          left: `calc(${(key.leftOffset / totalWhiteKeys) * 100}% - ${blackKeyWidthPct*-.4}%)`,
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
import { IonSelect, IonSelectOption } from '@ionic/vue'
import { buildKeyboardLayout, countWhiteKeys } from '@/utils/noteEngine'

// ─── Constants ───────────────────────────────────────────────────────────────
const MIN_OCTAVE = 1
const MAX_OCTAVE = 7

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

const SCALE_INTERVALS: Record<string, number[]> = {
  major:           [0,2,4,5,7,9,11],
  naturalMinor:    [0,2,3,5,7,8,10],
  harmonicMinor:   [0,2,3,5,7,8,11],
  pentatonicMajor: [0,2,4,7,9],
  pentatonicMinor: [0,3,5,7,10],
  blues:           [0,3,5,6,7,10],
  chromatic:       [0,1,2,3,4,5,6,7,8,9,10,11],
  wholeTone:       [0,2,4,6,8,10],
  diminished:      [0,2,3,5,6,8,9,11],
}

const SCALE_OPTIONS = [
  { value: 'major',           label: 'Major' },
  { value: 'naturalMinor',    label: 'Natural Minor' },
  { value: 'harmonicMinor',   label: 'Harmonic Minor' },
  { value: 'pentatonicMajor', label: 'Pentatonic Major' },
  { value: 'pentatonicMinor', label: 'Pentatonic Minor' },
  { value: 'blues',           label: 'Blues' },
  { value: 'wholeTone',       label: 'Whole Tone' },
  { value: 'diminished',      label: 'Diminished' },
  { value: 'chromatic',       label: 'Chromatic' },
]

// ─── Props ───────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  // Range — if provided, overrides internal octave state
  startMidi?:   number
  endMidi?:     number
  // Note states
  activeNotes?: Set<number>
  targetNote?:  number | null
  targetNotes?: Set<number>
  wrongNote?:   number | null
  // Display
  showLabels?:  boolean
  showControls?: boolean    // show the toolbar
  keyHeight?:   number
  // Initial octave settings (used when showControls = true)
  initialOctave?: number    // starting octave (default: 4 = C4)
  initialSpan?:   number    // octaves to show (default: 2)
}>(), {
  activeNotes:   () => new Set(),
  targetNote:    null,
  targetNotes:   () => new Set(),
  wrongNote:     null,
  showLabels:    true,
  showControls:  true,
  keyHeight:     160,
  initialOctave: 4,
  initialSpan:   2,
})

const emit = defineEmits<{
  noteOn:  [midi: number]
  noteOff: [midi: number]
  rangeChange: [start: number, end: number]
}>()

// ─── Internal octave state (owned by this component when showControls=true) ──
const octaveStart = ref(props.initialOctave)
const octaveSpan  = ref(props.initialSpan)
const selectedScale = ref('')
const selectedRoot  = ref(0)   // 0 = C

// Derived MIDI range — prefer explicit props, else use internal state
const startMidi = computed(() =>
  props.startMidi !== undefined ? props.startMidi : octaveStart.value * 12
)
const endMidi = computed(() =>
  props.endMidi !== undefined ? props.endMidi : (octaveStart.value + octaveSpan.value) * 12
)

function shiftOctave(delta: number) {
  const next = octaveStart.value + delta
  if (next >= MIN_OCTAVE && next + octaveSpan.value - 1 <= MAX_OCTAVE) {
    octaveStart.value = next
    console.log(octaveStart.value)
    emit('rangeChange', startMidi.value, endMidi.value)
  }
}

// ─── Scale pitch classes ──────────────────────────────────────────────────────
const scaleNotes = computed((): Set<number> => {
  if (!selectedScale.value) return new Set()
  const intervals = SCALE_INTERVALS[selectedScale.value] ?? []
  const root = selectedRoot.value
  // All pitch classes (0–11) that belong to this scale+root
  const pcs = new Set(intervals.map(i => (root + i) % 12))
  return pcs
})

// ─── Layout ───────────────────────────────────────────────────────────────────
const allKeys = computed(() => buildKeyboardLayout(startMidi.value, endMidi.value))
const whiteKeys = computed(() => allKeys.value.filter(k => !k.isBlack))
const blackKeys = computed(() => allKeys.value.filter(k => k.isBlack))
const totalWhiteKeys  = computed(() => countWhiteKeys(startMidi.value, endMidi.value))
const blackKeyWidthPct = computed(() => 60 / totalWhiteKeys.value)

// ─── Key class ────────────────────────────────────────────────────────────────
function keyClass(midi: number) {
  const isActive    = props.activeNotes.has(midi)
  const isTarget    = props.targetNotes.has(midi) || props.targetNote === midi
  const isWrong     = props.wrongNote === midi && !isTarget
  const isCorrect   = isTarget && isActive
  const isOctaveOff = !isTarget &&
    [...props.targetNotes].some(t => t % 12 === midi % 12) && isActive
  // Scale highlighting — dim keys outside the scale
  const inScale     = scaleNotes.value.size === 0 || scaleNotes.value.has(midi % 12)

  return {
    'key--active':    isActive && !isTarget && !isWrong,
    'key--target':    isTarget && !isCorrect,
    'key--correct':   isCorrect,
    'key--wrong':     isWrong && isActive,
    'key--octave':    isOctaveOff,
    'key--in-scale':  inScale && scaleNotes.value.size > 0 && !isTarget && !isActive,
    'key--out-scale': !inScale && scaleNotes.value.size > 0,
  }
}

// ─── Mouse / touch ────────────────────────────────────────────────────────────
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
</script>

<style scoped>
/* ── Wrapper ──────────────────────────────────────────────── */
.piano-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Toolbar ──────────────────────────────────────────────── */
.piano-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 10px;
}

.toolbar-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toolbar-group--scale {
  flex: 1;
  min-width: 120px;
}

.toolbar-label {
  font-family: var(--nf-font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: var(--nf-text-muted);
}

/* Octave stepper */
.octave-stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--nf-surface);
  border: 1px solid var(--nf-border);
  border-radius: 8px;
  padding: 2px 4px;
}

.step-btn {
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--nf-text-muted);
  font-size: 1rem;
  cursor: pointer;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms, color 120ms;
}
.step-btn:hover:not(:disabled) { background: var(--nf-border); color: var(--nf-text); }
.step-btn:disabled { opacity: 0.25; cursor: default; }

.octave-display {
  font-size: 0.78rem;
  min-width: 36px;
  text-align: center;
  color: var(--nf-text);
}

/* Span pills */
.span-pills {
  display: flex;
  gap: 4px;
}

.span-pill {
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--nf-border);
  background: transparent;
  color: var(--nf-text-muted);
  font-family: var(--nf-font-mono);
  font-size: 0.68rem;
  cursor: pointer;
  transition: all 120ms;
  white-space: nowrap;
}
.span-pill:hover { border-color: var(--nf-text-muted); color: var(--nf-text); }
.span-pill--active {
  background: var(--nf-accent);
  border-color: var(--nf-accent);
  color: #0a0a0f;
  font-weight: 700;
}

/* Scale select */
.scale-select {
  --background: var(--nf-surface);
  --color: var(--nf-text);
  --border-color: var(--nf-border);
  --border-radius: 8px;
  --padding-start: 10px;
  --padding-end: 10px;
  border: 1px solid var(--nf-border);
  border-radius: 8px;
  font-family: var(--nf-font-mono);
  font-size: 0.78rem;
  max-width: 160px;
}

.root-select {
  --background: var(--nf-surface);
  --color: var(--nf-text);
  border: 1px solid var(--nf-border);
  border-radius: 8px;
  font-family: var(--nf-font-mono);
  font-size: 0.78rem;
  width: 70px;
}

/* ── Piano canvas ────────────────────────────────────────── */
.piano {
  position: relative;
  min-width: 200px;
  width: 100%;
  overflow: hidden;
  border-radius: 0 0 10px 10px;
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
.key.white.key--active  { background: #c8c8d8; transform: scaleY(0.97); transform-origin: top; }
.key.white.key--target  { background: #a8d4ff; box-shadow: inset 0 -4px 0 var(--nf-blue); }
.key.white.key--correct { background: var(--nf-accent); box-shadow: inset 0 -4px 0 var(--nf-accent-dim); }
.key.white.key--wrong   { background: #ffb8c0; box-shadow: inset 0 -4px 0 var(--nf-error); animation: shake 200ms ease; }
.key.white.key--octave  { background: #ffe0a0; box-shadow: inset 0 -4px 0 var(--nf-warn); }

/* Scale highlighting on white keys */
.key.white.key--in-scale  { background: #daf5b0; }
.key.white.key--out-scale { background: #d0d0dc; opacity: 0.55; }

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
.key.black.key--active  { background: #2a2a3c; box-shadow: 1px 2px 4px rgba(0,0,0,0.5); transform: scaleY(0.97); transform-origin: top; }
.key.black.key--target  { background: #1e3d6a; box-shadow: 0 0 12px var(--nf-blue), 2px 4px 8px rgba(0,0,0,0.5); }
.key.black.key--correct { background: #4a7a10; box-shadow: 0 0 12px var(--nf-accent), 2px 4px 8px rgba(0,0,0,0.5); }
.key.black.key--wrong   { background: #6a1020; box-shadow: 0 0 12px var(--nf-error); animation: shake 200ms ease; }

/* Scale highlighting on black keys */
.key.black.key--in-scale  { background: #3a6010; box-shadow: 0 0 8px rgba(180,255,80,0.3), 2px 4px 8px rgba(0,0,0,0.5); }
.key.black.key--out-scale { opacity: 0.35; }

/* ── Labels ──────────────────────────────────────────────── */
.key-label {
  font-family: var(--nf-font-mono);
  font-size: 0.55rem;
  color: #888899;
  pointer-events: none;
}
.key--target .key-label,
.key--correct .key-label { color: #334; font-weight: 700; }
.key--in-scale .key-label { color: #3a5a10; }

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-3px); }
  75%       { transform: translateX(3px); }
}
</style>