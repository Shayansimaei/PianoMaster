<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Free Play</ion-title>
        <ion-buttons slot="end">
          <DeviceStatusBar />
           <ion-button fill="outline" size="small" class="random-btn" @click="gitHub">
            <ion-icon :icon="logoGithub" herf="https://github.com/Shayansimaei/noteflow"/>
            </ion-button>

        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="play-layout">

        <div v-if="permissionError" class="banner banner--error">
          <ion-icon :icon="warningOutline"/>
          {{ permissionError }}
        </div>

        <div v-if="IsSamplerLoaded" class="banner banner--info">
          <ion-icon :icon="hourglassOutline" />
          Loading piano samples…
        </div>

        <NoteDisplay
          :target-note="targetNote"
          :played-note="lastPlayedNote"
          :result="matchResult"
          class="note-display-card"
        />

        <div class="controls-row">
          <div class="control-group">
            <label class="control-label">TARGET NOTE</label>
            <div class="note-picker">
              <ion-button fill="clear" size="small" @click="stepTarget(-1)">
                <ion-icon slot="icon-only" :icon="chevronBackOutline" />
              </ion-button>
              <span class="target-label mono">{{ targetNoteLabel }}</span>
              <ion-button fill="clear" size="small" @click="stepTarget(1)">
                <ion-icon slot="icon-only" :icon="chevronForwardOutline" />
              </ion-button>
            </div>
          </div>

          <div class="control-group">
            <label class="control-label">RANDOM</label>
            <ion-button fill="outline" size="small" class="random-btn" @click="randomTarget">
              <ion-icon slot="start" :icon="shuffleOutline" />
              Shuffle
            </ion-button>
          </div>

          <div class="control-group">
            <label class="control-label">VOLUME</label>
            <ion-range
              :min="-40"
              :max="6"
              :value="volumeDb"
              class="vol-range"
              @ion-change="onVolumeChange"
            >
              <ion-icon slot="start" :icon="volumeLowOutline" />
              <ion-icon slot="end" :icon="volumeHighOutline" />
            </ion-range>
          </div>
        </div>

        <div class="streak-row" v-if="streak > 0">
          <span class="streak-label">🔥 {{ streak }} in a row</span>
        </div>

        <div class="keyboard-container">
          <PianoKeyboard
            :active-notes="activeNotes"
            :target-note="targetNote"
            :wrong-note="wrongNote"
            :show-labels="showLabels"
            :key-height="keyboardHeight"
            @note-on="onMouseNoteOn"
            @note-off="onMouseNoteOff"
            @range-change="onRangeChange"
          />
        </div>

        <div class="footer-row">
          <ion-toggle v-model="showLabels" size="small">
            <span class="toggle-label">Note labels</span>
          </ion-toggle>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted   } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonButtons, IonIcon, IonRange, IonToggle,
} from '@ionic/vue'
  import {volumeHighOutline,volumeLowOutline,shuffleOutline,
    chevronForwardOutline,chevronBackOutline,warningOutline,logoGithub,
    hourglassOutline} from 'ionicons/icons';

import PianoKeyboard from '@/components/PianoKeyboard.vue'
import NoteDisplay from '@/components/NoteDisplay.vue'
import DeviceStatusBar from '@/components/DeviceStatusBar.vue'
import { useMidi } from '@/composables/useMidi'
import { useAudioSampler } from '@/composables/useAudioSampler'
import { useMidiStore } from '@/stores/midi.store'
import { matchNotes, midiToNoteInfo } from '@/utils/noteEngine'
import type { MatchResult } from '@/types'

const midi = useMidi()
const midiStore = useMidiStore()
const { permissionError } = midi
const sampler = useAudioSampler()
const volumeDb = ref(0)
const targetNote = ref<number>(60)
const lastPlayedNote = ref<number | null>(null)
const matchResult = ref<MatchResult>('idle')
const wrongNote = ref<number | null>(null)
const streak = ref(0)
const showLabels = ref(true)
const activeNotes = ref(new Set<number>())

const targetNoteLabel = computed(() => midiToNoteInfo(targetNote.value).label)
const keyboardHeight = computed(() => window.innerWidth < 480 ? 120 : 160)
const IsSamplerLoaded = computed(() => {return (sampler.loading.value && !sampler.loaded.value)})
const startMidi=ref(36);
const endMidi=ref(96);
sampler.loading.value
async function handleNoteOn(midiNum: number, velocity = 100) {
  activeNotes.value = new Set([...activeNotes.value, midiNum])
  lastPlayedNote.value = midiNum
  sampler.noteOn(midiNum, velocity)
  const match = matchNotes(midiNum, targetNote.value)
  matchResult.value = match.result
  midiStore.handleMidiEvent({ type: 'noteOn', note: midiNum, velocity, channel: 0, timestamp: Date.now(), device: 'mouse' })
  if (match.result === 'correct') {
    streak.value++
    wrongNote.value = null
    setTimeout(() => { if (matchResult.value === 'correct') randomTarget() }, 800)
  } else {
    wrongNote.value = midiNum
    streak.value = 0
  }
}

function handleNoteOff(midiNum: number) {
  const next = new Set(activeNotes.value)
  next.delete(midiNum)
  activeNotes.value = next
  sampler.noteOff(midiNum)
  if (next.size === 0) {
    matchResult.value = 'idle'
    lastPlayedNote.value = null
    wrongNote.value = null
  }
}

function onMouseNoteOn(m: number) { handleNoteOn(m, 80) }
function onMouseNoteOff(m: number) { handleNoteOff(m) }

midi.onMidiEvent((event) => {
  if (event.type === 'noteOn') handleNoteOn(event.note, event.velocity)
  else handleNoteOff(event.note)
})

function stepTarget(delta: number) {
  targetNote.value = Math.max(21, Math.min(108, targetNote.value + delta))
  resetMatch()
}
function randomTarget() {
  targetNote.value = 48 + Math.floor(Math.random() * 37)
  resetMatch()
}
function resetMatch() {
  matchResult.value = 'idle'
  lastPlayedNote.value = null
  wrongNote.value = null
}
function onVolumeChange(e: CustomEvent) {
  volumeDb.value = e.detail.value
  sampler.setVolume(volumeDb.value)
}
function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space') { e.preventDefault(); randomTarget() }
}
async function init(){
    await midi.init()
    await sampler.init()
    window.addEventListener('keydown', onKeyDown)
}
onMounted(async () => {
await init()
 
})
onUnmounted(() => {
  sampler.allNotesOff()
  window.removeEventListener('keydown', onKeyDown)
})
function onRangeChange(start: number, end: number):void{
  console.log(start,end)
  startMidi.value=start;
  endMidi.value=end;


}
function gitHub(){
  window.open("https://github.com/Shayansimaei/noteflow")
}
</script>

<style scoped>
.play-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  min-height: 100%;
}
.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-family: var(--nf-font-mono);
}
.banner--error { background: rgba(255,79,106,0.12); color: var(--nf-error); border: 1px solid var(--nf-error); }
.banner--info  { background: rgba(79,158,255,0.12); color: var(--nf-blue);  border: 1px solid var(--nf-blue); }
.note-display-card { flex-shrink: 0; }
.controls-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.control-group { display: flex; flex-direction: column; gap: 6px; }
.control-label { font-family: var(--nf-font-mono); font-size: 0.6rem; letter-spacing: 0.1em; color: var(--nf-text-muted); }
.note-picker {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 10px;
  padding: 0 4px;
}
.target-label { font-size: 1rem; font-weight: 700; color: var(--nf-blue); min-width: 38px; text-align: center; }
.random-btn { --color: var(--nf-accent); --border-color: var(--nf-accent); }
.vol-range {
  --bar-background: var(--nf-border);
  --bar-background-active: var(--nf-accent);
  --knob-background: var(--nf-accent);
  --knob-size: 18px;
  width: 130px;
  padding: 0;
}
.streak-row { display: flex; justify-content: center; }
.streak-label {
  font-family: var(--nf-font-mono);
  font-size: 0.85rem;
  color: var(--nf-accent);
  background: rgba(200,245,69,0.1);
  border: 1px solid var(--nf-accent-dim);
  border-radius: 999px;
  padding: 4px 14px;
  animation: streakPop 300ms ease;
}
@keyframes streakPop {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@media (max-width: 768px){
  .streak-row { display: none; }

}
.keyboard-container { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; }
.footer-row { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; }
.toggle-label { font-family: var(--nf-font-mono); font-size: 0.72rem; color: var(--nf-text-muted); }
</style>
