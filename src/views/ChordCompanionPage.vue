<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Chord Companion</ion-title>
       
        <ion-buttons slot="end">
          <DeviceStatusBar />
        </ion-buttons>
       
      </ion-toolbar>
      
    </ion-header>

    <ion-content>
      <div class="cc-layout">

        <!-- ── PROGRESSION SELECTOR ───────────────────────────────────────── -->
        <div v-if="!store.activeProgression" class="selector-view">

          <p class="intro">
            Learn to play chord pairs with both hands simultaneously.
            Each progression chains harmonically matched chords — left hand anchors the bass,
            right hand voices above. Play them in sequence to make real music.
          </p>

          <!-- Difficulty filter -->
          <div class="filter-row">
            <button
              v-for="d in DIFFICULTIES"
              :key="d"
              class="diff-pill"
              :class="{ 'diff-pill--active': store.difficultyFilter === d }"
              @click="store.difficultyFilter = d"
            >{{ d === 'all' ? 'All' : d }}</button>
          </div>

          <!-- Progression cards -->
          <div class="prog-list">
            <div
              v-for="prog in store.filteredProgressions"
              :key="prog.id"
              class="prog-card"
              :class="`prog-card--${prog.difficulty}`"
              @click="startProgression(prog.id)"
            >
              <div class="prog-header">
                <span class="diff-badge">{{ prog.difficulty }}</span>
                <span class="key-badge mono">{{ prog.key }}</span>
                <span class="tempo-badge mono">♩={{ prog.tempo }}</span>
              </div>
              <h3 class="prog-title">{{ prog.title }}</h3>
              <p class="prog-desc">{{ prog.description }}</p>
              <div class="prog-footer">
                <span class="pair-count mono">{{ prog.pairs.length }} pairs</span>
                <span v-if="prog.loop" class="loop-badge">↻ loops</span>
                <div class="pair-preview">
                  <span
                    v-for="pair in prog.pairs.slice(0,6)"
                    :key="pair.id"
                    class="pair-pill mono"
                  >{{ pair.name }}</span>
                  <span v-if="prog.pairs.length > 6" class="pair-pill mono muted">
                    +{{ prog.pairs.length - 6 }} more
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── ACTIVE PROGRESSION ─────────────────────────────────────────── -->
        <div v-else="store.activeProgression" class="active-view">

          <!-- Top bar: title + controls -->
          <div class="active-top">
            <div class="active-info">
              <h2 class="active-title">{{ store.activeProgression.title }}</h2>
              <span class="active-key mono">{{ store.activeProgression.key }}</span>
            </div>
            <div class="active-controls">
              <ion-button fill="clear" size="small" @click="store.stopProgression()">
                <ion-icon slot="icon-only" :icon="homeOutline" />
              </ion-button>
            </div>
          </div>

          <!-- Progress dots -->
          <div class="pair-dots">
            <span
              v-for="(pair, i) in store.activeProgression.pairs"
              :key="pair.id"
              class="pair-dot"
              :class="{
                'pair-dot--done':    i < store.currentPairIdx,
                'pair-dot--current': i === store.currentPairIdx,
              }"
              :title="pair.name"
            />
          </div>

          <!-- Stats row -->
          <div class="stats-row">
            <div class="stat">
              <span class="stat-num accent mono">{{ store.correctPairs }}</span>
              <span class="stat-label">Correct</span>
            </div>
            <div class="stat">
              <span class="stat-num mono">{{ store.totalPairsPlayed }}</span>
              <span class="stat-label">Played</span>
            </div>
            <div class="stat">
              <span class="stat-num mono" :style="{ color: accuracyColor }">{{ store.accuracy }}%</span>
              <span class="stat-label">Accuracy</span>
            </div>
            <div class="stat">
              <span class="stat-num mono" style="color:var(--nf-warn)">{{ store.streak }}</span>
              <span class="stat-label">Streak</span>
            </div>
          </div>

          <!-- ── MAIN PAIR DISPLAY ─────────────────────────────────────────── -->
          <div class="pair-display" v-if="store.currentPair">
            <div class="pair-name mono">{{ store.currentPair.name }}</div>
            <p class="pair-desc">{{ store.currentPair.description }}</p>

            <!-- Two-hand chord cards -->
            <div class="hands-row">

              <!-- LEFT HAND -->
              <div class="hand-card hand-card--left" :class="leftStatus">
                <div class="hand-label">
                  <ion-icon :icon="handLeftOutline" />
                  <span>Left Hand</span>
                </div>
                <div class="chord-name">{{ store.currentPair.left.chord.label }}</div>
                <div class="chord-short mono">{{ store.currentPair.left.chord.shortLabel }}</div>
                <div class="chord-notes mono">
                  <span
                    v-for="n in store.currentPair.left.notes"
                    :key="n"
                    class="note-dot"
                    :class="{
                      'note-dot--held': store.matchState.leftHeld.has(n),
                      'note-dot--wrong': store.matchState.wrongNotes.has(n),
                    }"
                  >{{ midiToNoteInfo(n).label }}</span>
                </div>
                <div class="held-indicator">
                  <div
                    class="held-bar"
                    :style="{ width: leftProgress + '%' }"
                  />
                </div>
              </div>

              <!-- Match bridge -->
              <div class="match-bridge">
                <div class="bridge-icon" :class="`bridge-icon--${overallStatus}`">
                  {{ bridgeIcon }}
                </div>
                <span class="bridge-label mono">{{ bridgeLabel }}</span>
              </div>

              <!-- RIGHT HAND -->
              <div class="hand-card hand-card--right" :class="rightStatus">
                <div class="hand-label">
                  <span>Right Hand</span>
                  <ion-icon :icon="handRightOutline" />
                </div>
                <div class="chord-name">{{ store.currentPair.right.chord.label }}</div>
                <div class="chord-short mono">{{ store.currentPair.right.chord.shortLabel }}</div>
                <div class="chord-notes mono">
                  <span
                    v-for="n in store.currentPair.right.notes"
                    :key="n"
                    class="note-dot"
                    :class="{
                      'note-dot--held': store.matchState.rightHeld.has(n),
                      'note-dot--wrong': store.matchState.wrongNotes.has(n),
                    }"
                  >{{ midiToNoteInfo(n).label }}</span>
                </div>
                <div class="held-indicator">
                  <div
                    class="held-bar"
                    :style="{ width: rightProgress + '%' }"
                  />
                </div>
              </div>
            </div>

            <!-- Completion flash -->
            <transition name="complete-flash">
              <div v-if="showCompleteFlash" class="complete-flash">
                ✓ &nbsp;{{ completedPairName }}
              </div>
            </transition>
          </div>

          <!-- Finished state -->
          <div v-if="showFinished" class="finished-screen">
            <div class="finished-icon">🎵</div>
            <h2 class="finished-title">Progression Complete!</h2>
            <div class="finished-stats">
              <div class="fin-stat">
                <span class="fin-num mono accent">{{ store.accuracy }}%</span>
                <span class="fin-label">accuracy</span>
              </div>
              <div class="fin-stat">
                <span class="fin-num mono" style="color:var(--nf-warn)">{{ store.maxStreak }}</span>
                <span class="fin-label">best streak</span>
              </div>
              <div class="fin-stat">
                <span class="fin-num mono">{{ store.totalPairsPlayed }}</span>
                <span class="fin-label">pairs played</span>
              </div>
            </div>
            <div class="finished-actions">
              <ion-button @click="restartCurrent">Play Again</ion-button>
              <ion-button fill="outline" @click="store.stopProgression()">Choose Another</ion-button>
            </div>
          </div>

          <!-- ── PIANO KEYBOARD ─────────────────────────────────────────────── -->
          <div class="keyboard-section" v-if="store.currentPair && !showFinished">
            <PianoKeyboard
              :start-midi="36"
              :end-midi="96"
              :active-notes="activeNotes"
              :target-notes="allTargetNotes"
              :wrong-note="firstWrongNote"
              :show-labels="true"
              :show-controls="true"
              :initial-span="3"
              :key-height="140"
              @note-on="onNoteOn"
              @note-off="onNoteOff"
            />
          </div>

          <!-- Skip -->
          <div class="skip-row" v-if="store.currentPair && !showFinished">
            <ion-button fill="clear" size="small" class="skip-btn" @click="skip">
              Skip pair
              <ion-icon slot="end" :icon="playSkipForwardOutline" />
            </ion-button>
          </div>

        </div>

      </div>
    </ion-content>

  
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonTabBar, IonTabButton, IonLabel,
} from '@ionic/vue'
import DeviceStatusBar from '@/components/DeviceStatusBar.vue'
import PianoKeyboard   from '@/components/PianoKeyboard.vue'
import { useChordCompanionStore } from '@/stores/chord-companion.store'
import { useMidi }         from '@/composables/useMidi'
import { useAudioSampler } from '@/composables/useAudioSampler'
import { midiToNoteInfo }  from '@/utils/noteEngine'
import { homeOutline,playSkipForwardOutline,handRightOutline,handLeftOutline } from 'ionicons/icons';

const store   = useChordCompanionStore()
const midi    = useMidi()
const sampler = useAudioSampler()

type Difficulty = 'all' | 'beginner' | 'intermediate' | 'advanced'
const DIFFICULTIES: Difficulty[] = ['all', 'beginner', 'intermediate', 'advanced']

// ── Active notes from keyboard ─────────────────────────────────────────────
const activeNotes = ref(new Set<number>())
const chordLists = ref(false)

// ── All required notes (both hands) for PianoKeyboard highlight ────────────
const allTargetNotes = computed((): Set<number> => {
  if (!store.currentPair) return new Set()
  return new Set([...store.currentPair.left.notes, ...store.currentPair.right.notes])
})

const firstWrongNote = computed(() => {
  const w = store.matchState.wrongNotes
  return w.size > 0 ? [...w][0] : null
})

// ── Hand progress (0–100) ──────────────────────────────────────────────────
const leftProgress = computed(() => {
  if (!store.currentPair) return 0
  const total = store.currentPair.left.notes.length
  const held  = store.matchState.leftHeld.size
  return total ? (held / total) * 100 : 0
})

const rightProgress = computed(() => {
  if (!store.currentPair) return 0
  const total = store.currentPair.right.notes.length
  const held  = store.matchState.rightHeld.size
  return total ? (held / total) * 100 : 0
})

// ── Status classes ─────────────────────────────────────────────────────────
const leftStatus = computed(() => {
  if (!store.currentPair) return ''
  if (store.currentPair.left.notes.every(n => store.matchState.leftHeld.has(n))) return 'hand-card--complete'
  if (store.matchState.wrongNotes.size) return 'hand-card--wrong'
  return ''
})

const rightStatus = computed(() => {
  if (!store.currentPair) return ''
  if (store.currentPair.right.notes.every(n => store.matchState.rightHeld.has(n))) return 'hand-card--complete'
  if (store.matchState.wrongNotes.size) return 'hand-card--wrong'
  return ''
})

const overallStatus = computed(() => {
  if (store.matchState.complete) return 'correct'
  if (store.matchState.wrongNotes.size) return 'wrong'
  if (store.matchState.leftHeld.size || store.matchState.rightHeld.size) return 'partial'
  return 'idle'
})

const bridgeIcon = computed(() => ({
  correct: '✓', wrong: '✗', partial: '◐', idle: '◦',
}[overallStatus.value]))

const bridgeLabel = computed(() => ({
  correct: 'Perfect!', wrong: 'Wrong note', partial: 'Keep going…', idle: 'Play both hands',
}[overallStatus.value]))

const accuracyColor = computed(() => {
  const a = store.accuracy
  return a >= 80 ? 'var(--nf-accent)' : a >= 50 ? 'var(--nf-warn)' : 'var(--nf-error)'
})

// ── Completion flash ───────────────────────────────────────────────────────
const showCompleteFlash = ref(false)
const completedPairName = ref('')
const showFinished      = ref(false)

// ── Note events ────────────────────────────────────────────────────────────
function onNoteOn(midiNote: number) {
  activeNotes.value = new Set([...activeNotes.value, midiNote])
  sampler.noteOn(midiNote, 90)

  const completed = store.onNoteOn(midiNote)
  if (completed) {
    completedPairName.value = store.currentPair?.name ?? ''
    showCompleteFlash.value = true
    setTimeout(() => { showCompleteFlash.value = false }, 900)

    // Advance after a short hold
    setTimeout(() => {
      const result = store.advancePair()
      if (result === 'finished') showFinished.value = true
      else showFinished.value = false
    }, 700)
  }
}

function onNoteOff(midiNote: number) {
  const next = new Set(activeNotes.value)
  next.delete(midiNote)
  activeNotes.value = next
  sampler.noteOff(midiNote)
  store.onNoteOff(midiNote)
}

// ── MIDI hardware ──────────────────────────────────────────────────────────
midi.onMidiEvent(event => {
  if (event.type === 'noteOn') onNoteOn(event.note)
  else onNoteOff(event.note)
})

// ── Actions ────────────────────────────────────────────────────────────────
function startProgression(id: string) {
  showFinished.value = false
  store.startProgression(id)
  chordLists.value=false
}

function restartCurrent() {
  const id = store.activeProgressionId
  if (id) { showFinished.value = false; store.startProgression(id) }
}

function skip() {
  store.skipPair()
  if (store.isLastPair && !store.activeProgression?.loop) {
    // One more skip will finish
  }
}

onMounted(async () => {
  await midi.init()
  await sampler.init()
})

onUnmounted(() => sampler.allNotesOff())
</script>

<style scoped>
.cc-layout {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}

/* ── Intro ───────────────────────────────────────────────── */
.intro {
  font-size: 0.84rem;
  color: var(--nf-text-muted);
  line-height: 1.55;
  margin: 0;
}

/* ── Difficulty filter ───────────────────────────────────── */
.filter-row { display: flex; gap: 8px; flex-wrap: wrap; }
.diff-pill  {
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid var(--nf-border);
  background: transparent;
  color: var(--nf-text-muted);
  font-family: var(--nf-font-mono);
  font-size: 0.72rem;
  cursor: pointer;
  transition: all 150ms;
  text-transform: capitalize;
}
.diff-pill:hover { border-color: var(--nf-text-muted); color: var(--nf-text); }
.diff-pill--active { background: var(--nf-accent); border-color: var(--nf-accent); color: #0a0a0f; font-weight: 700; }

/* ── Progression list ────────────────────────────────────── */
.prog-list  { display: flex; flex-direction: column; gap: 12px; }
.prog-card  {
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  transition: border-color 150ms, transform 100ms;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.prog-card:hover          { border-color: var(--nf-text-muted); transform: translateY(-1px); }
.prog-card--beginner      { border-left: 3px solid var(--nf-accent); }
.prog-card--intermediate  { border-left: 3px solid var(--nf-blue); }
.prog-card--advanced      { border-left: 3px solid var(--nf-error); }

.prog-header { display: flex; align-items: center; gap: 8px; }
.diff-badge  { font-family: var(--nf-font-mono); font-size: 0.6rem; letter-spacing: 0.1em; color: var(--nf-text-muted); text-transform: uppercase; }
.key-badge   { font-size: 0.7rem; color: var(--nf-blue); background: rgba(79,158,255,0.1); border: 1px solid var(--nf-blue-dim); border-radius: 6px; padding: 1px 6px; }
.tempo-badge { font-size: 0.68rem; color: var(--nf-text-muted); }

.prog-title { font-size: 1rem; font-weight: 700; color: var(--nf-text); margin: 0; letter-spacing: -0.01em; }
.prog-desc  { font-size: 0.78rem; color: var(--nf-text-muted); margin: 0; line-height: 1.45; }

.prog-footer  { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.pair-count   { font-size: 0.68rem; color: var(--nf-text-muted); }
.loop-badge   { font-size: 0.65rem; color: var(--nf-warn); font-family: var(--nf-font-mono); }
.pair-preview { display: flex; gap: 5px; flex-wrap: wrap; }
.pair-pill    { font-size: 0.62rem; padding: 2px 7px; background: var(--nf-surface); border: 1px solid var(--nf-border); border-radius: 5px; color: var(--nf-text-muted); white-space: nowrap; }
.pair-pill.muted { opacity: 0.55; }

/* ── Active view ─────────────────────────────────────────── */
.active-view  { display: flex; flex-direction: column; gap: 14px; }
.active-top   { display: flex; align-items: flex-start; justify-content: space-between; }
.active-info  { display: flex; flex-direction: column; gap: 3px; }
.active-title { font-size: 1.1rem; font-weight: 800; color: var(--nf-text); margin: 0; letter-spacing: -0.02em; }
.active-key   { font-size: 0.7rem; color: var(--nf-blue); }

/* ── Pair dots ───────────────────────────────────────────── */
.pair-dots  { display: flex; gap: 6px; flex-wrap: wrap; }
.pair-dot   {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--nf-border);
  transition: background 200ms, transform 200ms;
}
.pair-dot--done    { background: var(--nf-accent-dim); }
.pair-dot--current { background: var(--nf-accent); transform: scale(1.4); box-shadow: 0 0 6px var(--nf-accent); }

/* ── Stats ───────────────────────────────────────────────── */
.stats-row { display: flex; background: var(--nf-surface-2); border: 1px solid var(--nf-border); border-radius: 12px; overflow: hidden; }
.stat      { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 10px 8px; gap: 3px; border-right: 1px solid var(--nf-border); }
.stat:last-child { border-right: none; }
.stat-num  { font-size: 1.3rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: 0.6rem; color: var(--nf-text-muted); font-family: var(--nf-font-mono); }

/* ── Pair display ────────────────────────────────────────── */
.pair-display { display: flex; flex-direction: column; gap: 12px; }
.pair-name    { font-size: 0.85rem; color: var(--nf-text-muted); text-align: center; letter-spacing: 0.04em; }
.pair-desc    { font-size: 0.78rem; color: var(--nf-text-muted); text-align: center; margin: 0; line-height: 1.45; }

/* ── Hands row ───────────────────────────────────────────── */
.hands-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; }

.hand-card {
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  transition: border-color 200ms, box-shadow 200ms;
}
.hand-card--complete {
  border-color: var(--nf-accent);
  box-shadow: 0 0 16px rgba(200,245,69,0.15);
}
.hand-card--wrong {
  border-color: var(--nf-error);
  box-shadow: 0 0 12px rgba(255,79,106,0.12);
}

.hand-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  color: var(--nf-text-muted);
  font-family: var(--nf-font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.hand-card--right .hand-label { justify-content: flex-end; }

.chord-name  { font-size: 1.1rem; font-weight: 800; color: var(--nf-text); letter-spacing: -0.02em; }
.chord-short { font-size: 0.75rem; color: var(--nf-text-muted); }

.chord-notes {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.hand-card--right .chord-notes { justify-content: flex-end; }

.note-dot {
  font-size: 0.7rem;
  padding: 2px 7px;
  background: var(--nf-surface);
  border: 1px solid var(--nf-border);
  border-radius: 6px;
  color: var(--nf-text-muted);
  transition: all 150ms;
}
.note-dot--held  { background: rgba(200,245,69,0.15); border-color: var(--nf-accent); color: var(--nf-accent); }
.note-dot--wrong { background: rgba(255,79,106,0.15); border-color: var(--nf-error); color: var(--nf-error); }

.held-indicator {
  height: 3px;
  background: var(--nf-border);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
}
.held-bar {
  height: 100%;
  background: var(--nf-accent);
  border-radius: 2px;
  transition: width 150ms ease;
}
.hand-card--wrong .held-bar { background: var(--nf-error); }

/* ── Bridge ──────────────────────────────────────────────── */
.match-bridge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  min-width: 52px;
}
.bridge-icon {
  font-size: 1.6rem;
  line-height: 1;
  transition: all 200ms;
  color: var(--nf-text-muted);
}
.bridge-icon--correct { color: var(--nf-accent); }
.bridge-icon--wrong   { color: var(--nf-error); }
.bridge-icon--partial { color: var(--nf-warn); }
.bridge-label {
  font-size: 0.58rem;
  color: var(--nf-text-muted);
  text-align: center;
  white-space: nowrap;
  letter-spacing: 0.04em;
}
.bridge-icon--correct + .bridge-label { color: var(--nf-accent); }
.bridge-icon--wrong   + .bridge-label { color: var(--nf-error); }
.bridge-icon--partial + .bridge-label { color: var(--nf-warn); }

/* ── Complete flash ──────────────────────────────────────── */
.complete-flash {
  text-align: center;
  padding: 10px;
  background: rgba(200,245,69,0.12);
  border: 1px solid var(--nf-accent-dim);
  border-radius: 10px;
  font-family: var(--nf-font-mono);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--nf-accent);
  letter-spacing: 0.04em;
}
.complete-flash-enter-active, .complete-flash-leave-active { transition: opacity 250ms, transform 250ms; }
.complete-flash-enter-from { opacity: 0; transform: scale(0.9); }
.complete-flash-leave-to   { opacity: 0; transform: scale(1.05); }

/* ── Keyboard ────────────────────────────────────────────── */
.keyboard-section { flex-shrink: 0; }

/* ── Skip ────────────────────────────────────────────────── */
.skip-row { display: flex; justify-content: center; }
.skip-btn { --color: var(--nf-text-muted); font-size: 0.78rem; }

/* ── Finished ────────────────────────────────────────────── */
.finished-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 20px;
  text-align: center;
}
.finished-icon  { font-size: 3rem; }
.finished-title { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
.finished-stats { display: flex; gap: 24px; }
.fin-stat       { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.fin-num        { font-size: 2.2rem; font-weight: 700; line-height: 1; }
.fin-label      { font-size: 0.65rem; color: var(--nf-text-muted); font-family: var(--nf-font-mono); letter-spacing: 0.1em; }
.finished-actions { display: flex; gap: 10px; }

/* ── Tab bar ─────────────────────────────────────────────── */
ion-tab-bar { --background: var(--nf-surface); --border-color: var(--nf-border); }
ion-tab-button { --color: var(--nf-text-muted); --color-selected: var(--nf-accent); }
</style>
