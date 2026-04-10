<template>
  <div class="note-display" :class="`note-display--${result}`">
    <!-- Target note -->
    <div class="note-cell note-cell--target">
      <div class="cell-label">PLAY</div>
      <div class="note-name" :class="{ 'has-accidental': targetInfo?.name.includes('#') }">
        <span class="note-letter">{{ targetLetter }}</span>
        <span v-if="targetAccidental" class="note-accidental">{{ targetAccidental }}</span>
        <span class="note-octave">{{ targetInfo?.octave }}</span>
      </div>
    </div>

    <!-- Match indicator -->
    <div class="match-indicator">
      <div class="match-icon">{{ matchIcon }}</div>
      <div class="match-text">{{ matchText }}</div>
    </div>

    <!-- Played note -->
    <div class="note-cell note-cell--played">
      <div class="cell-label">HEARD</div>
      <div class="note-name" :class="playedNoteClass">
        <template v-if="playedInfo">
          <span class="note-letter">{{ playedLetter }}</span>
          <span v-if="playedAccidental" class="note-accidental">{{ playedAccidental }}</span>
          <span class="note-octave">{{ playedInfo.octave }}</span>
        </template>
        <span v-else class="note-letter" style="visibility: hidden;"> *</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchResult } from '@/types'
import { midiToNoteInfo } from '@/utils/noteEngine'

const props = defineProps<{
  targetNote: number | null
  targetNotes?: Set<number>      // full chord — if set, shows chord size
  playedNote: number | null
  result: MatchResult
  heldCorrect?: Set<number>      // notes already hit in current chord
}>()

const targetInfo = computed(() => props.targetNote !== null ? midiToNoteInfo(props.targetNote) : null)
const playedInfo = computed(() => props.playedNote !== null ? midiToNoteInfo(props.playedNote) : null)

function splitNoteName(label: string | undefined) {
  if (!label) return { letter: '', accidental: '' }
  const hasSharp = label.includes('#')
  return {
    letter: hasSharp ? label[0] : label,
    accidental: hasSharp ? '♯' : '',
  }
}

const { letter: targetLetter, accidental: targetAccidental } = computed(() =>
  splitNoteName(targetInfo.value?.name)
).value

const playedLetter = computed(() => splitNoteName(playedInfo.value?.name).letter)
const playedAccidental = computed(() => splitNoteName(playedInfo.value?.name).accidental)

const matchIcon = computed(() => ({
  correct:     '✓',
  wrong:       '✗',
  'octave-off':'≈',
  idle:        '◦',
}[props.result]))

const matchText = computed(() => {
  if (props.result === 'correct') return 'Correct!'
  if (props.result === 'wrong')   return 'Wrong note'
  if (props.result === 'octave-off') return 'Wrong octave'
  // Show chord progress when idle and multi-note chord
  if (props.targetNotes && props.targetNotes.size > 1) {
    const held = props.heldCorrect?.size ?? 0
    return `${held}/${props.targetNotes.size} held`
  }
  return 'Waiting…'
})

const playedNoteClass = computed(() => ({
  'note-name--correct': props.result === 'correct',
  'note-name--wrong': props.result === 'wrong',
  'note-name--warn': props.result === 'octave-off',
}))
</script>

<style scoped>
.note-display {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 16px;
  padding: 20px 16px;
  transition: border-color 200ms all;
}

.note-display--correct { border-color: var(--nf-accent); }
.note-display--wrong   { border-color: var(--nf-error); }
.note-display--octave-off { border-color: var(--nf-warn); }

.note-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.cell-label {
  font-family: var(--nf-font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: var(--nf-text-muted);
}

.note-name {
  display: flex;
  align-items: baseline;
  gap: 1px;
  line-height: 1;
}

.note-letter {
  font-family: var(--nf-font-display);
  font-size: 3.2rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--nf-text);
}

.note-cell--target .note-letter {
  color: var(--nf-blue);
}

.note-accidental {
  font-size: 1.6rem;
  font-weight: 600;
  color: inherit;
  margin-top: -4px;
}

.note-octave {
  font-family: var(--nf-font-mono);
  font-size: 0.9rem;
  color: var(--nf-text-muted);
  margin-left: 2px;
  align-self: flex-end;
  margin-bottom: 6px;
}

.note-empty {
  font-size: 2.4rem;
  color: var(--nf-text-dim);
}

/* ── Match indicator ──────────────────────────────────────── */
.match-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 60px;
}

.match-icon {
  font-size: 1.8rem;
  line-height: 1;
  transition: all 200ms ease;
  color: var(--nf-text-muted);
}

.note-display--correct  .match-icon { color: var(--nf-accent); }
.note-display--wrong    .match-icon { color: var(--nf-error); }
.note-display--octave-off .match-icon { color: var(--nf-warn); }

.match-text {
  font-family: var(--nf-font-mono);
  font-size: 0.6rem;
  color: var(--nf-text-muted);
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.note-display--correct  .match-text { color: var(--nf-accent); }
.note-display--wrong    .match-text { color: var(--nf-error); }
.note-display--octave-off .match-text { color: var(--nf-warn); }

/* ── Played note color states ─────────────────────────────── */
.note-name--correct .note-letter { color: var(--nf-accent); }
.note-name--wrong   .note-letter { color: var(--nf-error); }
.note-name--warn    .note-letter { color: var(--nf-warn); }
</style>
