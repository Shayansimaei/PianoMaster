<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Harmonic Field</ion-title>
        <ion-buttons slot="end">
          <DeviceStatusBar />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="hf-layout">

        <!-- ── CONFIG PANEL (shown before start) ─────────────────────────── -->
        <div v-if="!store.active" class="config-panel">

          <div class="config-intro">
            <h2 class="config-title">Harmonic Field</h2>
            <p class="config-desc">
              An infinite stream of harmonically connected chords — each 4 to 8 notes,
              linked by voice leading to the one before it. No repetition. No fixed sequence.
              Play each chord fully with both hands and the field generates the next one.
            </p>
          </div>

          <!-- Mode -->
          <div class="config-group">
            <label class="config-label">MODE</label>
            <div class="mode-pills">
              <button
                v-for="m in MODES" :key="m.id"
                class="mode-pill"
                :class="{ 'mode-pill--active': store.config.mode === m.id }"
                @click="store.setMode(m.id)"
              >
                <span class="mode-name">{{ m.name }}</span>
                <span class="mode-sub">{{ m.desc }}</span>
              </button>
            </div>
          </div>

          <!-- Root note -->
          <div class="config-group">
            <label class="config-label">TONAL CENTRE</label>
            <div class="root-pills">
              <button
                v-for="(name, pc) in NOTE_NAMES" :key="pc"
                class="root-pill"
                :class="{
                  'root-pill--active': store.config.rootPc === pc,
                  'root-pill--black':  isBlackKey(pc),
                }"
                @click="store.setRoot(pc)"
              >{{ name }}</button>
            </div>
          </div>

          <!-- Tension slider -->
          <div class="config-group">
            <label class="config-label">TENSION  <span class="config-val mono">{{ tensionLabel }}</span></label>
            <ion-range
              :min="0" :max="10" :value="store.config.tension" :step="1"
              class="config-range tension-range"
              @ion-change="store.setTension($event.detail.value as number)"
            >
              <span slot="start" class="range-end">Calm</span>
              <span slot="end"   class="range-end">Wild</span>
            </ion-range>
          </div>

          <!-- Spread slider -->
          <div class="config-group">
            <label class="config-label">VOICING SPREAD  <span class="config-val mono">{{ spreadLabel }}</span></label>
            <ion-range
              :min="0" :max="10" :value="store.config.spread" :step="1"
              class="config-range"
              @ion-change="store.setSpread($event.detail.value as number)"
            >
              <span slot="start" class="range-end">Tight</span>
              <span slot="end"   class="range-end">Wide</span>
            </ion-range>
          </div>

          <!-- Note count -->
          <div class="config-group">
            <label class="config-label">NOTES PER CHORD</label>
            <div class="note-count-row">
              <button
                v-for="[min,max] in NOTE_COUNT_OPTIONS" :key="`${min}-${max}`"
                class="count-pill"
                :class="{ 'count-pill--active': store.config.noteCount[0] === min && store.config.noteCount[1] === max }"
                @click="store.setNoteCount(min, max)"
              >{{ min }}–{{ max }}</button>
            </div>
          </div>

          <ion-button class="start-btn" expand="block" @click="startField">
            <ion-icon slot="start" :icon="infiniteOutline" />
            Begin Harmonic Field
          </ion-button>
        </div>

        <!-- ── ACTIVE FIELD ──────────────────────────────────────────────── -->
        <div v-else class="field-view">

          <!-- Top bar -->
          <div class="field-top">
            <div class="field-meta">
              <span class="field-mode-badge mono">{{ store.config.mode }}</span>
              <span class="field-root-badge mono">{{ store.rootName }}</span>
              <span class="field-tension-badge mono">tension {{ store.config.tension }}/10</span>
            </div>
            <ion-button fill="clear" size="small" @click="store.stop()">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </div>

          <!-- Session stats -->
          <div class="stats-row">
            <div class="stat">
              <span class="stat-num mono accent">{{ store.chordsPlayed }}</span>
              <span class="stat-label">Played</span>
            </div>
            <div class="stat">
              <span class="stat-num mono" style="color:var(--nf-warn)">{{ store.sessionStreak }}</span>
              <span class="stat-label">Streak</span>
            </div>
            <div class="stat">
              <span class="stat-num mono" style="color:var(--nf-blue)">{{ store.maxSessionStreak }}</span>
              <span class="stat-label">Best</span>
            </div>
          </div>

          <!-- ── CURRENT CHORD ─────────────────────────────────────────────── -->
          <div class="chord-stage" v-if="store.current" :class="stageClass">

            <!-- Chord identity -->
            <div class="chord-identity">
              <div class="chord-label-big">{{ store.current.label }}</div>
              <div class="chord-color-text">{{ store.current.color }}</div>
            </div>

            <!-- Explanation of transition -->
            <div class="chord-explanation mono">{{ store.explanation }}</div>

            <!-- Two-hand split display -->
            <div class="hands-split">

              <!-- Left hand -->
              <div class="hand-section hand-section--left">
                <div class="hand-title">
                  <ion-icon :icon="handLeftOutline" />
                  <span>Left Hand</span>
                </div>
                <div class="hand-notes">
                  <span
                    v-for="n in store.current.leftNotes"
                    :key="n"
                    class="note-chip"
                    :class="{
                      'note-chip--held':  store.heldNotes.has(n),
                      'note-chip--wrong': store.wrongNotes.has(n),
                    }"
                  >{{ midiToNoteInfo(n).label }}</span>
                </div>
                <div class="hand-progress">
                  <div class="hand-bar" :style="{ width: store.leftProgress + '%' }" />
                </div>
              </div>

              <!-- Centre: match status -->
              <div class="match-centre">
                <div class="match-icon" :class="`match-icon--${matchStatus}`">{{ matchIcon }}</div>
                <div class="held-count mono">{{ store.heldNotes.size }}/{{ store.current.notes.length }}</div>
              </div>

              <!-- Right hand -->
              <div class="hand-section hand-section--right">
                <div class="hand-title">
                  <span>Right Hand</span>
                  <ion-icon name="hand-right-outline" />
                </div>
                <div class="hand-notes hand-notes--right">
                  <span
                    v-for="n in store.current.rightNotes"
                    :key="n"
                    class="note-chip"
                    :class="{
                      'note-chip--held':  store.heldNotes.has(n),
                      'note-chip--wrong': store.wrongNotes.has(n),
                    }"
                  >{{ midiToNoteInfo(n).label }}</span>
                </div>
                <div class="hand-progress">
                  <div class="hand-bar" :style="{ width: store.rightProgress + '%' }" />
                </div>
              </div>

            </div>

            <!-- Complete flash -->
            <transition name="flash">
              <div v-if="showFlash" class="complete-flash">✓ {{ flashLabel }}</div>
            </transition>

          </div>

          <!-- ── LOOKAHEAD ──────────────────────────────────────────────────── -->
          <div class="lookahead-row" v-if="store.lookahead.length">
            <span class="lookahead-label mono">Up next →</span>
            <div class="lookahead-chips">
              <div
                v-for="(chord, i) in store.lookahead"
                :key="chord.uid"
                class="lookahead-chip"
                :style="{ opacity: 1 - i * 0.25 }"
              >
                <span class="la-name mono">{{ chord.label }}</span>
                <div class="la-tension-bar">
                  <div class="la-tension-fill" :style="{ width: (chord.tension / 10 * 100) + '%' }" />
                </div>
              </div>
            </div>
          </div>

          <!-- ── HISTORY ────────────────────────────────────────────────────── -->
          <div class="history-row" v-if="store.history.length">
            <span class="history-label mono">History</span>
            <div class="history-chips">
              <span
                v-for="chord in [...store.history].reverse().slice(0, 8)"
                :key="chord.uid"
                class="history-chip mono"
              >{{ chord.label }}</span>
            </div>
          </div>

          <!-- ── PIANO KEYBOARD ──────────────────────────────────────────────── -->
          <div class="keyboard-wrap">
            <PianoKeyboard
              :active-notes="activeNotes"
              :target-notes="store.allTargetNotes"
              :wrong-note="firstWrongNote"
              :show-labels="true"
              :show-controls="true"
              :initial-span="4"
              :key-height="140"
              @note-on="onNoteOn"
              @note-off="onNoteOff"
            />
          </div>

          <!-- Skip -->
          <div class="skip-row">
            <ion-button fill="clear" size="small" class="skip-btn" @click="skip">
              Skip chord
              <ion-icon slot="end" :icon="playSkipForwardOutline" />
            </ion-button>
            <ion-button fill="clear" size="small" class="settings-btn" @click="store.stop()">
              <ion-icon slot="start" :icon="settingsOutline" />
              Settings
            </ion-button>
          </div>

        </div>

      </div>
    </ion-content>

    <!-- Tab bar -->
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonIcon, IonRange, IonTabBar, IonTabButton, IonLabel,
} from '@ionic/vue'
import DeviceStatusBar from '@/components/DeviceStatusBar.vue'
import PianoKeyboard   from '@/components/PianoKeyboard.vue'
import { useHarmonicFieldStore } from '@/stores/harmonic-field.store'
import { useMidi }         from '@/composables/useMidi'
import { useAudioSampler } from '@/composables/useAudioSampler'
import { midiToNoteInfo }  from '@/utils/noteEngine'
import { NOTE_NAMES, type FieldMode } from '@/utils/harmonic-field.engine'
import {settingsOutline,playSkipForwardOutline,
handLeftOutline,infiniteOutline,closeOutline} from 'ionicons/icons';
const store   = useHarmonicFieldStore()
const midi    = useMidi()
const sampler = useAudioSampler()

// ── Modes ─────────────────────────────────────────────────────────────────
const MODES: { id: FieldMode; name: string; desc: string }[] = [
  { id: 'major',    name: 'Major',     desc: 'Diatonic, bright' },
  { id: 'minor',    name: 'Minor',     desc: 'Diatonic, dark' },
  { id: 'jazz',     name: 'Jazz',      desc: 'All 12 tones, 7ths+' },
  { id: 'modal',    name: 'Modal',     desc: 'Dorian / Phrygian colour' },
  { id: 'chromatic',name: 'Chromatic', desc: 'No tonal centre' },
]

const NOTE_COUNT_OPTIONS: [number, number][] = [[4,5],[4,6],[5,7],[6,8]]

function isBlackKey(pc: number) { return [1,3,6,8,10].includes(pc) }

const tensionLabel = computed(() => {
  const labels = ['Calm','Calm','Mellow','Mellow','Moderate','Moderate','Tense','Tense','Very Tense','Wild','Extreme']
  return labels[store.config.tension]
})
const spreadLabel = computed(() => {
  if (store.config.spread <= 2) return 'Tight'
  if (store.config.spread <= 5) return 'Medium'
  if (store.config.spread <= 8) return 'Wide'
  return 'Very Wide'
})

// ── Active notes ───────────────────────────────────────────────────────────
const activeNotes = ref(new Set<number>())

const firstWrongNote = computed(() =>
  store.wrongNotes.size > 0 ? [...store.wrongNotes][0] : null
)

// ── Stage class ────────────────────────────────────────────────────────────
const stageClass = computed(() => ({
  'chord-stage--complete': store.isComplete,
  'chord-stage--wrong':    store.wrongNotes.size > 0 && !store.isComplete,
  'chord-stage--partial':  store.heldNotes.size > 0 && !store.isComplete,
}))

const matchStatus = computed(() => {
  if (store.isComplete)        return 'correct'
  if (store.wrongNotes.size)   return 'wrong'
  if (store.heldNotes.size)    return 'partial'
  return 'idle'
})

const matchIcon = computed(() => ({
  correct: '✓', wrong: '✗', partial: '◐', idle: '◦',
}[matchStatus.value]))

// ── Flash on completion ───────────────────────────────────────────────────
const showFlash  = ref(false)
const flashLabel = ref('')

// ── Note events ────────────────────────────────────────────────────────────
function onNoteOn(midiNote: number) {
  activeNotes.value = new Set([...activeNotes.value, midiNote])
  sampler.noteOn(midiNote, 90)

  const completed = store.onNoteOn(midiNote)
  if (completed) {
    flashLabel.value = store.current?.label ?? ''
    showFlash.value  = true
    setTimeout(() => { showFlash.value = false }, 800)
    setTimeout(() => store.advance(), 650)
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

async function startField() {
  await sampler.init()
  store.start()
}

function skip() { store.skip() }

onMounted(async () => {
  await midi.init()
  await sampler.init()
})
onUnmounted(() => sampler.allNotesOff())
</script>

<style scoped>
.hf-layout {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}

/* ── Config panel ────────────────────────────────────────── */
.config-panel { display: flex; flex-direction: column; gap: 20px; }
.config-intro { display: flex; flex-direction: column; gap: 6px; }
.config-title { font-size: 1.4rem; font-weight: 800; color: var(--nf-text); margin: 0; letter-spacing: -0.03em; }
.config-desc  { font-size: 0.84rem; color: var(--nf-text-muted); line-height: 1.55; margin: 0; }

.config-group { display: flex; flex-direction: column; gap: 8px; }
.config-label { font-family: var(--nf-font-mono); font-size: 0.6rem; letter-spacing: 0.12em; color: var(--nf-text-muted); }
.config-val   { color: var(--nf-accent); }

/* Mode pills */
.mode-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.mode-pill  {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 12px; border-radius: 10px;
  border: 1px solid var(--nf-border); background: var(--nf-surface-2);
  cursor: pointer; transition: all 150ms; text-align: left;
}
.mode-pill:hover { border-color: var(--nf-text-muted); }
.mode-pill--active { border-color: var(--nf-accent); background: rgba(200,245,69,0.08); }
.mode-name { font-size: 0.88rem; font-weight: 700; color: var(--nf-text); }
.mode-sub  { font-size: 0.65rem; color: var(--nf-text-muted); font-family: var(--nf-font-mono); }
.mode-pill--active .mode-name { color: var(--nf-accent); }

/* Root pills */
.root-pills { display: flex; gap: 5px; flex-wrap: wrap; }
.root-pill  {
  padding: 4px 10px; border-radius: 7px;
  border: 1px solid var(--nf-border); background: var(--nf-surface-2);
  color: var(--nf-text-muted); font-family: var(--nf-font-mono); font-size: 0.78rem;
  cursor: pointer; transition: all 150ms;
}
.root-pill--black  { background: var(--nf-surface); }
.root-pill:hover   { border-color: var(--nf-text-muted); color: var(--nf-text); }
.root-pill--active { background: var(--nf-accent); border-color: var(--nf-accent); color: #0a0a0f; font-weight: 700; }

/* Range */
.config-range {
  --bar-background: var(--nf-border);
  --bar-background-active: var(--nf-accent);
  --knob-background: var(--nf-accent);
  --knob-size: 20px;
  padding: 0;
}
.tension-range { --bar-background-active: linear-gradient(90deg, var(--nf-accent), var(--nf-error)); }
.range-end { font-family: var(--nf-font-mono); font-size: 0.65rem; color: var(--nf-text-muted); }

/* Note count */
.note-count-row { display: flex; gap: 8px; }
.count-pill {
  padding: 5px 14px; border-radius: 8px;
  border: 1px solid var(--nf-border); background: var(--nf-surface-2);
  color: var(--nf-text-muted); font-family: var(--nf-font-mono); font-size: 0.8rem;
  cursor: pointer; transition: all 150ms;
}
.count-pill:hover   { border-color: var(--nf-text-muted); color: var(--nf-text); }
.count-pill--active { background: var(--nf-accent); border-color: var(--nf-accent); color: #0a0a0f; font-weight: 700; }

.start-btn { margin-top: 4px; --background: var(--nf-accent); --color: #0a0a0f; font-weight: 700; }

/* ── Field view ──────────────────────────────────────────── */
.field-view { display: flex; flex-direction: column; gap: 12px; }

.field-top  { display: flex; align-items: center; justify-content: space-between; }
.field-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.field-mode-badge  { font-size: 0.7rem; padding: 2px 8px; background: rgba(200,245,69,0.1); border: 1px solid var(--nf-accent-dim); border-radius: 6px; color: var(--nf-accent); text-transform: uppercase; }
.field-root-badge  { font-size: 0.7rem; padding: 2px 8px; background: rgba(79,158,255,0.1); border: 1px solid var(--nf-blue-dim); border-radius: 6px; color: var(--nf-blue); }
.field-tension-badge { font-size: 0.65rem; color: var(--nf-text-muted); }

/* Stats */
.stats-row { display: flex; background: var(--nf-surface-2); border: 1px solid var(--nf-border); border-radius: 12px; overflow: hidden; }
.stat      { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 10px 8px; gap: 3px; border-right: 1px solid var(--nf-border); }
.stat:last-child { border-right: none; }
.stat-num  { font-size: 1.3rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: 0.6rem; color: var(--nf-text-muted); font-family: var(--nf-font-mono); }

/* Chord stage */
.chord-stage {
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 16px;
  padding: 18px 16px;
  display: flex; flex-direction: column; gap: 12px;
  transition: border-color 200ms, box-shadow 200ms;
}
.chord-stage--complete { border-color: var(--nf-accent); box-shadow: 0 0 20px rgba(200,245,69,0.12); }
.chord-stage--wrong    { border-color: var(--nf-error);  box-shadow: 0 0 16px rgba(255,79,106,0.1); }
.chord-stage--partial  { border-color: var(--nf-blue); }

.chord-identity  { text-align: center; }
.chord-label-big { font-size: 2rem; font-weight: 800; color: var(--nf-text); letter-spacing: -0.03em; line-height: 1; }
.chord-color-text { font-size: 0.78rem; color: var(--nf-text-muted); margin-top: 4px; }

.chord-explanation {
  text-align: center;
  font-size: 0.7rem;
  color: var(--nf-text-muted);
  background: var(--nf-surface);
  border: 1px solid var(--nf-border);
  border-radius: 8px;
  padding: 6px 10px;
  line-height: 1.5;
}

/* Hands split */
.hands-split { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; }

.hand-section { display: flex; flex-direction: column; gap: 7px; }
.hand-title   { display: flex; align-items: center; gap: 5px; font-size: 0.65rem; color: var(--nf-text-muted); font-family: var(--nf-font-mono); letter-spacing: 0.06em; text-transform: uppercase; }
.hand-section--right .hand-title { justify-content: flex-end; }

.hand-notes { display: flex; gap: 5px; flex-wrap: wrap; }
.hand-notes--right { justify-content: flex-end; }

.note-chip {
  font-size: 0.68rem; padding: 2px 7px;
  background: var(--nf-surface); border: 1px solid var(--nf-border);
  border-radius: 6px; color: var(--nf-text-muted);
  transition: all 150ms;
}
.note-chip--held  { background: rgba(200,245,69,0.15); border-color: var(--nf-accent); color: var(--nf-accent); }
.note-chip--wrong { background: rgba(255,79,106,0.15); border-color: var(--nf-error);  color: var(--nf-error); }

.hand-progress { height: 3px; background: var(--nf-border); border-radius: 2px; overflow: hidden; }
.hand-bar      { height: 100%; background: var(--nf-accent); border-radius: 2px; transition: width 120ms ease; }
.chord-stage--wrong .hand-bar { background: var(--nf-error); }

/* Match centre */
.match-centre { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 48px; }
.match-icon   { font-size: 1.8rem; line-height: 1; color: var(--nf-text-muted); transition: color 200ms; }
.match-icon--correct { color: var(--nf-accent); }
.match-icon--wrong   { color: var(--nf-error); }
.match-icon--partial { color: var(--nf-warn); }
.held-count   { font-size: 0.65rem; color: var(--nf-text-muted); }

/* Flash */
.complete-flash {
  text-align: center; padding: 8px; border-radius: 9px;
  background: rgba(200,245,69,0.12); border: 1px solid var(--nf-accent-dim);
  font-family: var(--nf-font-mono); font-size: 0.88rem; font-weight: 700; color: var(--nf-accent);
}
.flash-enter-active, .flash-leave-active { transition: opacity 200ms, transform 200ms; }
.flash-enter-from { opacity: 0; transform: scale(0.9); }
.flash-leave-to   { opacity: 0; transform: scale(1.06); }

/* Lookahead */
.lookahead-row   { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.lookahead-label { font-size: 0.62rem; color: var(--nf-text-muted); white-space: nowrap; }
.lookahead-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.lookahead-chip  { display: flex; flex-direction: column; gap: 3px; min-width: 70px; }
.la-name         { font-size: 0.72rem; color: var(--nf-text-muted); }
.la-tension-bar  { height: 2px; background: var(--nf-border); border-radius: 1px; width: 100%; }
.la-tension-fill { height: 100%; background: var(--nf-warn); border-radius: 1px; transition: width 300ms ease; }

/* History */
.history-row   { display: flex; align-items: center; gap: 10px; overflow-x: auto; }
.history-label { font-size: 0.62rem; color: var(--nf-text-dim); white-space: nowrap; flex-shrink: 0; }
.history-chips { display: flex; gap: 5px; }
.history-chip  {
  font-size: 0.62rem; padding: 2px 7px; white-space: nowrap;
  background: var(--nf-surface); border: 1px solid var(--nf-border);
  border-radius: 5px; color: var(--nf-text-dim);
}

/* Keyboard */
.keyboard-wrap { flex-shrink: 0; }

/* Skip */
.skip-row    { display: flex; justify-content: center; gap: 8px; }
.skip-btn    { --color: var(--nf-text-muted); font-size: 0.78rem; }
.settings-btn { --color: var(--nf-text-muted); font-size: 0.78rem; }

/* Tab bar */
ion-tab-bar { --background: var(--nf-surface); --border-color: var(--nf-border); }
ion-tab-button { --color: var(--nf-text-muted); --color-selected: var(--nf-accent); }
</style>
