<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/lesson" text="" />
        </ion-buttons>
        <ion-title>{{ lessonStore.currentLesson?.title ?? 'Lesson' }}</ion-title>
      </ion-toolbar>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" :style="{ width: `${lessonStore.progressPercent}%` }" />
      </div>
    </ion-header>

    <ion-content>
      <!-- Completed -->
      <div v-if="lessonStore.isComplete" class="complete-screen">
        <div class="complete-icon">🎉</div>
        <h2 class="complete-title">Lesson Complete!</h2>
        <div class="score-display">
          <span class="score-num mono">{{ finalScorePercent }}%</span>
          <span class="score-label">accuracy</span>
        </div>
        <p class="score-detail mono">{{ lessonStore.score }} / {{ lessonStore.attempts }} correct</p>
        <div class="complete-actions">
          <ion-button expand="block" @click="restartLesson">Try Again</ion-button>
          <ion-button expand="block" fill="outline" router-link="/tabs/lesson">All Lessons</ion-button>
        </div>
      </div>

      <!-- Active -->
      <div v-else class="lesson-layout">
    
        <div class="badges">

        <div v-if="currentStep?.id" class="hint-box">
          <ion-icon :icon="informationCircleOutline" />
          {{ currentStep.id }}
        </div>

        <!-- Chord name badge (chord lessons only) -->
        <div v-if="isChordStep && currentStep" class="chord-name-badge">
          <span class="chord-label">{{ currentStep.hint ?? `Play ${currentStep.targetNotes.length} notes together` }}</span>
          <span class="chord-progress mono" v-if="heldCorrect.size > 0 && heldCorrect.size < requiredMidis.size">
            {{ heldCorrect.size }}/{{ requiredMidis.size }} held
          </span>
        </div>
        </div>
        <div class="step-counter mono">
          Step {{ lessonStore.currentStepIndex + 1 }} of {{ lessonStore.currentLesson?.steps.length }}
        </div>
        <NoteDisplay
          :target-note="currentTargetNote"
          :target-notes="requiredMidis"
          :played-note="lastPlayedNote"
          :result="matchResult"
          :held-correct="heldCorrect"
          :is-lesson="true"
        />

        <div name="feedback" :class="`${ feedbackVisible? `feedback-visible`:`feedback-none-visible` }`" >
          <div class="feedback-flash" :class="`feedback-flash--${matchResult}`">
            {{ feedbackText }}
          </div>
        </div>

        <div class="stats-row">
          <div class="stat">
            <span class="stat-num mono accent">{{ lessonStore.score }}</span>
            <span class="stat-label">Correct</span>
          </div>
          <div class="stat">
            <span class="stat-num mono">{{ lessonStore.attempts }}</span>
            <span class="stat-label">Attempts</span>
          </div>
          <div class="stat">
            <span class="stat-num mono" :style="{ color: accuracyColor }">{{ accuracy }}%</span>
            <span class="stat-label">Accuracy</span>
          </div>
        </div>

        <div class="keyboard-wrap">
          <PianoKeyboard
            :start-midi="36"
            :end-midi="96"
            :active-notes="activeNotes"
            :target-note="currentTargetNote"
            :target-notes="requiredMidis"
            :wrong-note="wrongNote"
            :show-labels="true"
            :key-height="140"
            @note-on="onNoteOn"
            @note-off="onNoteOff"
          />
        </div>

        <div class="lesson-footer">
          <ion-button fill="clear" size="small" class="skip-btn" @click="skipStep">
            Skip this note
            <ion-icon slot="end" :icon="playSkipForwardOutline" />
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonBackButton, IonButton, IonIcon,
  
} from '@ionic/vue'
  import {playSkipForwardOutline,informationCircleOutline } from 'ionicons/icons';

import PianoKeyboard from '@/components/PianoKeyboard.vue'
import NoteDisplay from '@/components/NoteDisplay.vue'
import { useMidi } from '@/composables/useMidi'
import { useAudioSampler } from '@/composables/useAudioSampler'
import { useLessonStore } from '@/stores/lesson.store'
import type { MatchResult } from '@/types'
import { chordFromSet } from '@/utils/midiToChord'

const route       = useRoute()
const lessonStore = useLessonStore()
const midi        = useAudioSampler! ? useMidi() : useMidi()
const midiInput   = useMidi()
const sampler     = useAudioSampler()

// ─── Chord-aware state (mirrors SheetMusicPage logic) ────────────────────────
const activeNotes   = ref(new Set<number>())
const heldCorrect   = ref(new Set<number>())
const wrongNotes    = ref(new Set<number>())
const lastPlayedNote = ref<number | null>(null)
const matchResult   = ref<MatchResult>('idle')
const feedbackVisible = ref(false)
const feedbackText    = ref('')
let feedbackTimer: ReturnType<typeof setTimeout> | null = null
let advanceTimer:  ReturnType<typeof setTimeout> | null = null

const currentStep = computed(() => lessonStore.currentStep)

// Support both single-note (targetNotes.length === 1) and chord steps
const requiredMidis = computed((): Set<number> =>
  new Set(currentStep.value?.targetNotes ?? [])
)

// Show the first unplayed required note as the "primary" target
const currentTargetNote = computed((): number | null => {
  if (!currentStep.value) return null
  const unplayed = currentStep.value.targetNotes.find(m => !heldCorrect.value.has(m))
  return unplayed ?? currentStep.value.targetNotes[0] ?? null
})
const chordName = computed(() => chordFromSet(activeNotes.value).chord)

const wrongNote = computed(() =>
  wrongNotes.value.size > 0 ? [...wrongNotes.value][0] : null
)

const isChordStep = computed(() => (currentStep.value?.targetNotes.length ?? 0) > 1)

const accuracy = computed(() =>
  !lessonStore.attempts ? 100 : Math.round((lessonStore.score / lessonStore.attempts) * 100)
)
const accuracyColor = computed(() =>
  accuracy.value >= 80 ? 'var(--nf-accent)' : accuracy.value >= 50 ? 'var(--nf-warn)' : 'var(--nf-error)'
)
const finalScorePercent = computed(() =>
  !lessonStore.attempts ? 0 : Math.round((lessonStore.score / lessonStore.attempts) * 100)
)

// ─── Note handling ────────────────────────────────────────────────────────────
function onNoteOn(midiNote: number) {
  activeNotes.value = new Set([...activeNotes.value, midiNote])
  lastPlayedNote.value = midiNote
  sampler.noteOn(midiNote, 90)

  if (!currentStep.value) return

  if (requiredMidis.value.has(midiNote)) {
    heldCorrect.value = new Set([...heldCorrect.value, midiNote])
    const allHit = [...requiredMidis.value].every(m => heldCorrect.value.has(m))

    if (allHit) {
      matchResult.value = 'correct'
      lessonStore.recordAttempt(true)
      showFeedback(isChordStep.value ? '✓ Chord!' : '✓ Correct!')
      if (advanceTimer) clearTimeout(advanceTimer)
      advanceTimer = setTimeout(() => {
        lessonStore.advanceStep()
        if (lessonStore.isComplete) lessonStore.completeLesson()
        heldCorrect.value  = new Set()
        wrongNotes.value   = new Set()
        matchResult.value  = 'idle'
        lastPlayedNote.value = null
      }, 500)
    } else {
      // Partial chord — show progress, no penalty
      matchResult.value = 'idle'
    }
  } else {
    wrongNotes.value = new Set([...wrongNotes.value, midiNote])
    matchResult.value = 'wrong'
    lessonStore.recordAttempt(false)
    showFeedback('Wrong note')
  }
}

function onNoteOff(midiNote: number) {
  const next = new Set(activeNotes.value)
  next.delete(midiNote)
  activeNotes.value = next
  sampler.noteOff(midiNote)

  const w = new Set(wrongNotes.value)
  w.delete(midiNote)
  wrongNotes.value = w

  if (next.size === 0) {
    matchResult.value = 'idle'
    lastPlayedNote.value = null
  }
}

function showFeedback(text: string) {
  feedbackText.value  = text
  feedbackVisible.value = true
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => { feedbackVisible.value = false }, 1000)
}

function skipStep() {
  if (advanceTimer) clearTimeout(advanceTimer)
  lessonStore.advanceStep()
  if (lessonStore.isComplete) lessonStore.completeLesson()
  heldCorrect.value  = new Set()
  wrongNotes.value   = new Set()
  matchResult.value  = 'idle'
  lastPlayedNote.value = null
}

function restartLesson() {
  lessonStore.startLesson(route.params.id as string)
  heldCorrect.value    = new Set()
  wrongNotes.value     = new Set()
  matchResult.value    = 'idle'
  lastPlayedNote.value = null
  activeNotes.value    = new Set()
}

midiInput.onMidiEvent((event) => {
  if (event.type === 'noteOn') onNoteOn(event.note)
  else onNoteOff(event.note)
})

onMounted(async () => {
  lessonStore.startLesson(route.params.id as string)
  await midiInput.init()
  await sampler.init()
})
onUnmounted(() => {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  if (advanceTimer)  clearTimeout(advanceTimer)
  sampler.allNotesOff()
})
</script>

<style scoped>
.progress-bar-track { height: 3px; background: var(--nf-border); width: 100%; }
.progress-bar-fill  { height: 100%; background: var(--nf-accent); transition: width 300ms ease; }
.lesson-layout { padding: 16px; display: flex; flex-direction: column; gap: 14px; min-height: 100%; }
.badges{ display: flex; flex-direction: row; gap: 14px; justify-content: end;}
.step-counter { font-size: 0.72rem; color: var(--nf-text-muted); letter-spacing: 0.06em; }
.hint-box {
  display: flex; align-items: center; gap: 8px;
  background: rgba(79,158,255,0.1); border: 1px solid var(--nf-blue-dim);
  border-radius: 10px; padding: 10px 14px; font-size: 0.82rem; color: var(--nf-blue);
}
.feedback-flash {
  text-align: center; padding: 8px; border-radius: 10px;
  font-family: var(--nf-font-mono); font-size: 0.9rem; font-weight: 700; letter-spacing: 0.04em;
}
.feedback-flash--correct    { background: rgba(200,245,69,0.15); color: var(--nf-accent); }
.feedback-flash--wrong      { background: rgba(255,79,106,0.15); color: var(--nf-error); }
.feedback-flash--octave-off { background: rgba(255,184,48,0.15); color: var(--nf-warn); }
.feedback-enter-active, .feedback-leave-active { transition: opacity 200ms, transform 200ms; }
.feedback-enter-from { opacity: 0; transform: translateY(-6px); }
.feedback-leave-to   { opacity: 0; transform: translateY(6px); }
.stats-row { display: flex; background: var(--nf-surface-2); border: 1px solid var(--nf-border); border-radius: 12px; overflow: hidden; }
.stat { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 10px 8px; gap: 3px; border-right: 1px solid var(--nf-border); }
.stat:last-child { border-right: none; }
.stat-num   { font-size: 1.3rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: 0.62rem; color: var(--nf-text-muted); font-family: var(--nf-font-mono); }
.keyboard-wrap { flex: 1; }
.lesson-footer { display: flex; justify-content: center; }
.skip-btn { --color: var(--nf-text-muted); font-size: 0.8rem; }
.chord-name-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(79,158,255,0.08);
  border: 1px solid var(--nf-blue-dim);
  border-radius: 10px;
  padding: 10px 16px;
}
.chord-label {
  font-size: 1rem;
  font-weight: 700;
  color: var(--nf-blue);
  letter-spacing: -0.01em;
}
.chord-progress {
  font-size: 0.72rem;
  color: var(--nf-accent);
  background: rgba(200,245,69,0.1);
  border: 1px solid var(--nf-accent-dim);
  border-radius: 999px;
  padding: 2px 8px;
}
.feed-back-container{
  position: absolute;
  left: auto;
}
.complete-screen {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; padding: 40px 24px; min-height: 70vh; text-align: center;
}
.feedback-visible{visibility: visible;}
.feedback-none-visible{visibility: hidden;}
.complete-icon  { font-size: 4rem; }
.complete-title { font-size: 1.8rem; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
.score-display  { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.score-num      { font-size: 4rem; font-weight: 700; color: var(--nf-accent); line-height: 1; }
.score-label    { font-size: 0.8rem; color: var(--nf-text-muted); font-family: var(--nf-font-mono); letter-spacing: 0.1em; }
.score-detail   { color: var(--nf-text-muted); font-size: 0.85rem; margin: 0; }
.complete-actions { width: 100%; max-width: 280px; display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
</style>
