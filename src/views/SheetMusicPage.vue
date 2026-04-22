<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Sheet Music</ion-title>
        <ion-buttons slot="end">
          <DeviceStatusBar />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="sheet-layout">

        <!-- ── Piece selector ─────────────────────────────────────── -->
        <div class="piece-selector">
          <button
            v-for="piece in pieces"
            :key="piece.id"
            class="piece-btn"
            :class="{ 'piece-btn--active': selectedPieceId === piece.id }"
            @click="selectPiece(piece.id)"
          >
            <span class="piece-title">{{ piece.title }}</span>
            <span class="piece-composer mono">{{ piece.composer }}</span>
            <button
              v-if="piece._imported"
              class="remove-btn"
              @click.stop="removePiece(piece.id)"
              title="Remove"
            >✕</button>
          </button>

          <!-- Import button -->
          <button class="piece-btn piece-btn--import" @click="triggerFileInput">
            <ion-icon :icon="addCircleOutline" />
            <span class="piece-title">Import .mid</span>
            <span class="piece-composer mono">drag & drop or click</span>
          </button>
          <button class="piece-btn piece-btn--import" @click="showTextImport = true">
            <ion-icon :icon="codeOutline" />
            <span class="piece-title">Import text</span>
            <span class="piece-composer mono">paste notation</span>
          </button>
          <button class="piece-btn piece-btn--import" @click="isNoteDisplay = !isNoteDisplay">
            <ion-icon :icon="eyeOutline" />
            <span class="piece-title">Play And Heard</span>
          </button>
        </div>

        
        </div>
         <MidiPlayerBar
          v-if="currentPiece?.id"
          :piece="currentPiece"
          :key="currentPiece.id"
          @beat-change="onBeatChange"
          @chord-change="onChordChange"
        />
        <!-- Hidden file input -->
        <input
          ref="fileInputRef"
          type="file"
          accept=".mid,.midi"
          multiple
          style="display:none"
          @change="onFileInputChange"
        />

        <!-- ── Drop zone overlay (active when dragging) ──────────── -->
        <transition name="drop-fade">
          <div
            v-if="isDragging"
            class="drop-overlay"
            @dragover.prevent
            @dragleave="isDragging = false"
            @drop.prevent="onDrop"
          >
            <ion-icon name="musical-notes-outline" />
            <p>Drop your .mid file here</p>
          </div>
        </transition>

        <!-- ── Import error ──────────────────────────────────────── -->
        <div v-if="importError" class="banner banner--error">
          <ion-icon name="alert-circle-outline" />
          {{ importError }}
          <button class="dismiss" @click="importError = null">✕</button>
        </div>

        <!-- ── Import loading ────────────────────────────────────── -->
        <div v-if="importing" class="banner banner--info">
          <ion-icon :icon="hourglassOutline" />
          Parsing MIDI file…
        </div>

        <!-- ── Piece info bar ────────────────────────────────────── -->
        <div class="piece-info" v-if="currentPiece">
          <span class="mono">{{ currentPiece.timeSignature[0] }}/{{ currentPiece.timeSignature[1] }}</span>
          <span class="mono">♩= {{ currentPiece.bpm }}</span>
          <span class="mono">{{ currentPiece.measures.length }} bars</span>
          <span class="mono">{{ allNotes.length }} notes</span>
          <span class="mono progress-text">
            chord {{ completedChords + 1 }}/{{ chords.length }}
          </span>
          <span class="mono chord-indicator" v-if="currentChord && currentChord.notes.length > 1">
            {{ heldCorrect.size }}/{{ currentChord.notes.length }} notes
          </span>
          <button class="reset-btn mono" @click="resetProgress" title="Restart from beginning">↺ Reset</button>
        </div>

        <!-- ── Sheet canvas ──────────────────────────────────────── -->
       <SheetDisplay
          :piece="currentPiece"
          :current-chord-idx="currentChordIdx"
          :held-correct="heldCorrect"
          :played-notes="activeNotes"
          :wrong-notes="wrongNotes"
          @note-click="playNote"
          @dragover="isDragging = true"
          @drop="onDrop"
        />
         

        <!-- ── Text import modal ──────────────────────────────────── -->
        <TextImportModal
          :is-open="showTextImport"
          @close="showTextImport = false"
          @import="onTextImport"
        />


        

        <!-- ── Match panel ────────────────────────────────────────── -->
        <NoteDisplay
          v-if="currentPiece&&isNoteDisplay"
          :target-note="currentTargetNote"
          :target-notes="requiredMidis"
          :played-note="lastPlayedNote"
          :result="matchResult"
          :held-correct="heldCorrect"
        />

        <!-- ── Piano keyboard ─────────────────────────────────────── -->
        <div class="keyboard-wrap" v-if="currentPiece">
          <PianoKeyboard
            :active-notes="activeNotes"
            :target-notes="requiredMidis"
            :target-note="currentTargetNote"
            :wrong-note="wrongNote"
            :show-labels="false"
            :key-height="130"
            @note-on="onNoteOn"
            @note-off="onNoteOff"
          />
        </div>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonIcon,
} from '@ionic/vue'
import PianoKeyboard from '@/components/PianoKeyboard.vue'
import NoteDisplay from '@/components/NoteDisplay.vue'
import DeviceStatusBar from '@/components/DeviceStatusBar.vue'
import { useMidi } from '@/composables/useMidi'
import { useAudioSampler } from '@/composables/useAudioSampler'
import TextImportModal from '@/components/TextImportModal.vue'
import MidiPlayerBar from '@/components/MidiPlayerBar.vue'
import { parseMidiFromFile } from '@/utils/midiFileParser'
import type { SheetPiece, MatchResult, SheetNote } from '@/types'
import SheetDisplay from '@/components/SheetDisplay.vue'
import {hourglassOutline,addCircleOutline,
codeOutline,eyeOutline} from 'ionicons/icons';

// ─── Layout constants ────────────────────────────────────────────────────────
const MEASURE_W       = 155
const STAFF_TOP       = 35
const STAFF_BOT       = 115
const STAFF_SPACING   = (STAFF_BOT - STAFF_TOP) / 4
const NOTE_CENTER_Y   = (STAFF_TOP + STAFF_BOT) / 2   // B4 area
const MEASURES_PER_VIEW = 4
const svgWidth  = '100%'
const svgHeight = 200

function staffY(lineIdx: number) { return STAFF_TOP + lineIdx * STAFF_SPACING }

// Beat X within a measure (localBeat 0–beatsPerMeasure)
function beatX(localBeat: number, _measureNum: number) {
  const beatsPerMeasure = currentPiece.value?.timeSignature[0] ?? 4
  const usableWidth = MEASURE_W - 30
  return 18 + (localBeat / beatsPerMeasure) * usableWidth
}

function measureX(visibleIdx: number) { return 10 + visibleIdx * MEASURE_W }

// MIDI → staff Y: each diatonic step = 4px, anchored to B4 (midi 71)
function noteY(midi: number): number {
  return NOTE_CENTER_Y - (midi - 71) * 3.5
}

function isSharp(midi: number) { return [1, 3, 6, 8, 10].includes(midi % 12) }
function isFlat(midi: number)  { return false } // can extend later

// Ledger lines above/below the 5-line staff
function ledgerLines(midi: number): number[] {
  const y = noteY(midi)
  const lines: number[] = []
  // Above staff
  if (y < STAFF_TOP - 4) {
    for (let ly = STAFF_TOP - 8; ly >= y - 4; ly -= 7) lines.push(ly)
  }
  // Below staff
  if (y > STAFF_BOT + 4) {
    for (let ly = STAFF_BOT + 8; ly <= y + 4; ly += 7) lines.push(ly)
  }
  // Middle C ledger line
  if (midi === 60) lines.push(noteY(60))
  return lines
}

// ─── Built-in pieces ─────────────────────────────────────────────────────────
const BUILTIN_PIECES: (SheetPiece & { _imported?: boolean })[] = [
  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    composer: 'Traditional',
    bpm: 100,
    timeSignature: [4, 4],
    keySignature: 0,
    measures: [
      { number:1, notes:[
        {id:'n1',midi:64,startBeat:0,durationBeats:1,hand:'right'},
        {id:'n2',midi:62,startBeat:1,durationBeats:1,hand:'right'},
        {id:'n3',midi:60,startBeat:2,durationBeats:1,hand:'right'},
        {id:'n4',midi:62,startBeat:3,durationBeats:1,hand:'right'},
      ]},
      { number:2, notes:[
        {id:'n5',midi:64,startBeat:0,durationBeats:1,hand:'right'},
        {id:'n6',midi:64,startBeat:1,durationBeats:1,hand:'right'},
        {id:'n7',midi:64,startBeat:2,durationBeats:2,hand:'right'},
      ]},
      { number:3, notes:[
        {id:'n8',midi:62,startBeat:0,durationBeats:1,hand:'right'},
        {id:'n9',midi:62,startBeat:1,durationBeats:1,hand:'right'},
        {id:'n10',midi:62,startBeat:2,durationBeats:2,hand:'right'},
      ]},
      { number:4, notes:[
        {id:'n11',midi:64,startBeat:0,durationBeats:1,hand:'right'},
        {id:'n12',midi:67,startBeat:1,durationBeats:1,hand:'right'},
        {id:'n13',midi:67,startBeat:2,durationBeats:2,hand:'right'},
      ]},{ number:5, notes:[
        {id:'n1',midi:64,startBeat:0,durationBeats:1,hand:'right'},
        {id:'n2',midi:62,startBeat:1,durationBeats:1,hand:'right'},
        {id:'n3',midi:60,startBeat:2,durationBeats:1,hand:'right'},
        {id:'n4',midi:62,startBeat:3,durationBeats:1,hand:'right'},
      ]},
      { number:6, notes:[
        {id:'n5',midi:64,startBeat:0,durationBeats:1,hand:'right'},
        {id:'n6',midi:64,startBeat:1,durationBeats:1,hand:'right'},
        {id:'n7',midi:64,startBeat:2,durationBeats:2,hand:'right'},
      ]},
      { number:7, notes:[
        {id:'n8',midi:62,startBeat:0,durationBeats:1,hand:'right'},
        {id:'n9',midi:62,startBeat:1,durationBeats:1,hand:'right'},
        {id:'n10',midi:62,startBeat:2,durationBeats:2,hand:'right'},
      ]},
      { number:8, notes:[
        {id:'n11',midi:64,startBeat:0,durationBeats:1,hand:'right'},
        {id:'n12',midi:67,startBeat:1,durationBeats:1,hand:'right'},
        {id:'n13',midi:67,startBeat:2,durationBeats:2,hand:'right'},
      ]},
    ],
    
  },
  {
    id: 'ode',
    title: 'Ode to Joy',
    composer: 'Beethoven',
    bpm: 90,
    timeSignature: [4, 4],
    keySignature: 0,
    measures: [
      { number:1, notes:[
        {id:'o1',midi:64,startBeat:0,durationBeats:1,hand:'right'},
        {id:'o2',midi:64,startBeat:1,durationBeats:1,hand:'right'},
        {id:'o3',midi:65,startBeat:2,durationBeats:1,hand:'right'},
        {id:'o4',midi:67,startBeat:3,durationBeats:1,hand:'right'},
      ]},
      { number:2, notes:[
        {id:'o5',midi:67,startBeat:0,durationBeats:1,hand:'right'},
        {id:'o6',midi:65,startBeat:1,durationBeats:1,hand:'right'},
        {id:'o7',midi:64,startBeat:2,durationBeats:1,hand:'right'},
        {id:'o8',midi:62,startBeat:3,durationBeats:1,hand:'right'},
      ]},
      { number:3, notes:[
        {id:'o9',midi:60,startBeat:0,durationBeats:1,hand:'right'},
        {id:'o10',midi:60,startBeat:1,durationBeats:1,hand:'right'},
        {id:'o11',midi:62,startBeat:2,durationBeats:1,hand:'right'},
        {id:'o12',midi:64,startBeat:3,durationBeats:1,hand:'right'},
      ]},
      { number:4, notes:[
        {id:'o13',midi:64,startBeat:0,durationBeats:1.5,hand:'right'},
        {id:'o14',midi:62,startBeat:2,durationBeats:0.5,hand:'right'},
        {id:'o15',midi:62,startBeat:3,durationBeats:2,hand:'right'},
      ]},
    ],
  }
]

// ─── State ───────────────────────────────────────────────────────────────────
const midi     = useMidi()
const sampler  = useAudioSampler()

const pieces         = ref<(SheetPiece & { _imported?: boolean })[]>([...BUILTIN_PIECES])
const selectedPieceId = ref<string | null>(null)
const measureOffset  = ref(0)
const importing      = ref(false)
const importError    = ref<string | null>(null)
const isDragging     = ref(false)
const fileInputRef   = ref<HTMLInputElement | null>(null)
const playerBeat     = ref(0)
const playerChordIdx = ref(0)
const showTextImport = ref(false)
const isNoteDisplay = ref(true)


const currentPiece = computed(() => pieces.value.find(p => p.id === selectedPieceId.value) ?? null)

const visibleMeasures = computed(() => {
  if (!currentPiece.value) return []
  return currentPiece.value.measures.slice(measureOffset.value, measureOffset.value + MEASURES_PER_VIEW)
})

// Flat sorted note list for the whole piece (absolute beats)
const allNotes = computed((): SheetNote[] => {
  if (!currentPiece.value) return []
  const bpm = currentPiece.value.timeSignature[0]
  return currentPiece.value.measures
    .flatMap((m, mi) => m.notes.map(n => ({ ...n, startBeat: n.startBeat + mi * bpm })))
    .sort((a, b) => a.startBeat - b.startBeat)
})

// ─── Chord grouping ─────────────────────────────────────────────────────────
// A "chord" = all notes sharing the same absolute startBeat (within tolerance)
const BEAT_TOLERANCE = 0.05  // beats within this are considered simultaneous

interface Chord {
  beat: number           // absolute beat position
  notes: SheetNote[]     // all notes sounding at this beat
}

const chords = computed((): Chord[] => {
  const notes = allNotes.value
  if (!notes.length) return []

  const groups: Chord[] = []
  for (const note of notes) {
    const existing = groups.find(g => Math.abs(g.beat - note.startBeat) < BEAT_TOLERANCE)
    if (existing) {
      existing.notes.push(note)
    } else {
      groups.push({ beat: note.startBeat, notes: [note] })
    }
  }
  return groups.sort((a, b) => a.beat - b.beat)
})

// Index into chords[], not allNotes[]
const currentChordIdx = ref(0)

const currentChord = computed(() => chords.value[currentChordIdx.value] ?? null)

// The set of MIDI numbers required right now
const requiredMidis = computed((): Set<number> =>
  new Set(currentChord.value?.notes.map(n => n.midi) ?? [])
)

// Notes played so far in this chord (must be a subset of requiredMidis)
const heldCorrect = ref(new Set<number>())

// All currently active (pressed) notes from keyboard/MIDI
const activeNotes = ref(new Set<number>())

// For NoteDisplay — show the lowest required note as "target" when multiple
const currentTargetNote = computed(() => {
  if (!currentChord.value) return null
  const midis = currentChord.value.notes.map(n => n.midi).sort((a, b) => a - b)
  // Highlight the first unplayed required note
  const unplayed = midis.find(m => !heldCorrect.value.has(m))
  return unplayed ?? midis[0]
})

const lastPlayedNote  = ref<number | null>(null)
const wrongNotes      = ref(new Set<number>())   // wrong notes currently held
const matchResult     = ref<MatchResult>('idle')

// How many chords are done (for progress display)
const completedChords = computed(() => currentChordIdx.value)

// ─── Note coloring ───────────────────────────────────────────────────────────
function noteHeadFill(note: SheetNote): string {
  const chordIdx = chords.value.findIndex(c => c.notes.some(n => n.id === note.id))
  if (chordIdx < currentChordIdx.value) return 'var(--nf-accent)'           // played
  if (chordIdx === currentChordIdx.value) {
    if (heldCorrect.value.has(note.midi)) return 'var(--nf-accent)'         // this note hit
    return 'var(--nf-blue)'                                                  // current target
  }
  return 'transparent'                                                        // future
}

function noteHeadStroke(note: SheetNote): string {
  const chordIdx = chords.value.findIndex(c => c.notes.some(n => n.id === note.id))
  if (chordIdx < currentChordIdx.value)   return 'var(--nf-accent-dim)'
  if (chordIdx === currentChordIdx.value) return 'var(--nf-blue)'
  return 'var(--nf-text-muted)'
}

// ─── Piece management ────────────────────────────────────────────────────────
function selectPiece(id: string) {
  selectedPieceId.value = id
  resetProgress()
  measureOffset.value   = 0
}

function removePiece(id: string) {
  pieces.value = pieces.value.filter(p => p.id !== id)
  if (selectedPieceId.value === id) {
    selectedPieceId.value = pieces.value[0]?.id ?? null
  }
}

function resetProgress() {
  currentChordIdx.value = 0
  heldCorrect.value     = new Set()
  wrongNotes.value      = new Set()
  matchResult.value     = 'idle'
  lastPlayedNote.value  = null
  activeNotes.value     = new Set()
}

// ─── MIDI file import ────────────────────────────────────────────────────────
function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFiles(files: FileList | File[]) {
  const fileArr = Array.from(files).filter(f => /\.midi?$/i.test(f.name))
  if (!fileArr.length) {
    importError.value = 'Please select a .mid or .midi file.'
    return
  }
  importing.value  = true
  importError.value = null

  for (const file of fileArr) {
    try {
      const piece = await parseMidiFromFile(file)
      // Avoid duplicate IDs
      const exists = pieces.value.find(p => p.id === piece.id)
      if (exists) piece.id = piece.id + '-' + Date.now()
      pieces.value.push({ ...piece, _imported: true })
      selectPiece(piece.id)
    } catch (err) {
      importError.value = `Failed to import "${file.name}": ${(err as Error).message}`
    }
  }

  importing.value = false
}

function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) handleFiles(input.files)
  input.value = '' // reset so same file can be re-imported
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files)
}
function onTextImport(piece: any) {
  // Ensure unique id
  if (pieces.value.find(p => p.id === piece.id)) piece.id = piece.id + '-' + Date.now()
  pieces.value.push({ ...piece, _imported: true })
  selectPiece(piece.id)
}


// ─── Chord-aware note playback ───────────────────────────────────────────────
//
// Logic:
//   noteOn  → if note is in requiredMidis, add to heldCorrect
//             → if all required notes held → chord complete → advance
//             → if note is NOT required → mark as wrong (but don't block)
//   noteOff → remove from activeNotes; if chord wasn't complete, clear wrongNotes for that note
//
// "Forgiveness window": extra notes outside the chord are flagged visually
// but don't prevent advancing — real playing always has timing slop.

let advanceTimer: ReturnType<typeof setTimeout> | null = null

function onNoteOn(midiNote: number) {
  // Always add to active set and play audio
  activeNotes.value = new Set([...activeNotes.value, midiNote])
  lastPlayedNote.value = midiNote
  sampler.noteOn(midiNote, 90)

  if (!currentChord.value) return

  if (requiredMidis.value.has(midiNote)) {
    // Correct note for this chord
    heldCorrect.value = new Set([...heldCorrect.value, midiNote])

    // Check if all required notes are now held
    const allHit = [...requiredMidis.value].every(m => heldCorrect.value.has(m))

    if (allHit) {
      matchResult.value = 'correct'

      // Clear any stale advance timer
      if (advanceTimer) clearTimeout(advanceTimer)

      advanceTimer = setTimeout(() => {
        const nextIdx = currentChordIdx.value + 1
        currentChordIdx.value = Math.min(nextIdx, chords.value.length - 1)
        heldCorrect.value     = new Set()
        wrongNotes.value      = new Set()
        matchResult.value     = 'idle'
        lastPlayedNote.value  = null

        // Auto-scroll: keep current chord's measure in view
        if (currentChord.value) {
          const bpm         = currentPiece.value?.timeSignature[0] ?? 4
          const measureOfChord = Math.floor(currentChord.value.beat / bpm)
          if (measureOfChord >= measureOffset.value + MEASURES_PER_VIEW) {
            measureOffset.value += MEASURES_PER_VIEW
          }
        }
      }, 300)
    } else {
      // Partially correct — show how many notes still needed
      matchResult.value = 'idle'
    }
  } else {
    // Wrong note — mark it, but don't block chord completion
    wrongNotes.value = new Set([...wrongNotes.value, midiNote])
    matchResult.value = 'wrong'
  }
}

function onNoteOff(midiNote: number) {
  const next = new Set(activeNotes.value)
  next.delete(midiNote)
  activeNotes.value = next
  sampler.noteOff(midiNote)

  // Remove from wrong set when released
  if (wrongNotes.value.has(midiNote)) {
    const w = new Set(wrongNotes.value)
    w.delete(midiNote)
    wrongNotes.value = w
  }

  // Reset match result display when all keys released
  if (next.size === 0) {
    matchResult.value = 'idle'
    lastPlayedNote.value = null
  }
}

function playNote(midiNote: number) {
  sampler.noteOnce(midiNote)
}

// Expose wrongNotes as a flat Set for PianoKeyboard :wrong-note prop
// PianoKeyboard takes a single number — we highlight all wrong notes held
const wrongNote = computed(() =>
  wrongNotes.value.size > 0 ? [...wrongNotes.value][0] : null
)

// ─── Global drag enter ────────────────────────────────────────────────────────
function onWindowDragEnter(e: DragEvent) {
  if (e.dataTransfer?.types.includes('Files')) isDragging.value = true
}
function onBeatChange(e:number){
  playerBeat.value =e

}
function onChordChange(e:number){
  playerChordIdx.value=e;
}
midi.onMidiEvent(event => {
  if (event.type === 'noteOn') onNoteOn(event.note)
  else onNoteOff(event.note)
})

onMounted(async () => {
  await midi.init()
  await sampler.init()
  if (pieces.value.length > 0) selectPiece(pieces.value[0].id)
  window.addEventListener('dragenter', onWindowDragEnter)
})

onUnmounted(() => {
  sampler.allNotesOff()
  window.removeEventListener('dragenter', onWindowDragEnter)
})
</script>

<style scoped>
.sheet-layout {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Piece selector ─────────────────────────────────────── */
.piece-selector {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: stretch;
}

.piece-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 150ms;
  text-align: left;
  min-width: 130px;
}
.piece-btn:hover { border-color: var(--nf-text-muted); }
.piece-btn--active { border-color: var(--nf-accent); background: rgba(200,245,69,0.05); }
.piece-btn--import {
  border-style: dashed;
  color: var(--nf-text-muted);
  align-items: center;
  gap: 4px;
  min-width: 110px;
}
.piece-btn--import ion-icon { font-size: 1.4rem; color: var(--nf-accent); }
.piece-btn--import:hover { border-color: var(--nf-accent); color: var(--nf-text); }

.piece-title    { font-size: 0.85rem; font-weight: 700; color: var(--nf-text); }
.piece-composer { font-size: 0.65rem; color: var(--nf-text-muted); margin-top: 3px; }

.remove-btn {
  position: absolute;
  top: 5px; right: 6px;
  background: none;
  border: none;
  color: var(--nf-text-dim);
  font-size: 0.7rem;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 150ms, background 150ms;
}
.remove-btn:hover { color: var(--nf-error); background: rgba(255,79,106,0.1); }

/* ── Drop overlay ───────────────────────────────────────── */
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(10,10,15,0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  backdrop-filter: blur(6px);
  border: 3px dashed var(--nf-accent);
  border-radius: 20px;
  color: var(--nf-accent);
}
.drop-overlay ion-icon { font-size: 4rem; }
.drop-overlay p { font-size: 1.2rem; font-weight: 700; font-family: var(--nf-font-display); }

.drop-fade-enter-active, .drop-fade-leave-active { transition: opacity 200ms; }
.drop-fade-enter-from, .drop-fade-leave-to { opacity: 0; }

/* ── Banners ────────────────────────────────────────────── */
.banner {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 10px;
  font-size: 0.82rem; font-family: var(--nf-font-mono);
}
.banner--error { background: rgba(255,79,106,0.12); color: var(--nf-error); border: 1px solid var(--nf-error); }
.banner--info  { background: rgba(79,158,255,0.12); color: var(--nf-blue);  border: 1px solid var(--nf-blue); }
.dismiss { margin-left: auto; background: none; border: none; color: inherit; cursor: pointer; font-size: 1rem; }

/* ── Piece info ─────────────────────────────────────────── */
.piece-info {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 0.72rem;
  color: var(--nf-text-muted);
  flex-wrap: wrap;
}
.progress-text { color: var(--nf-accent); }
.chord-indicator {
  background: rgba(79,158,255,0.12);
  color: var(--nf-blue);
  border: 1px solid var(--nf-blue-dim);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.65rem;
}
.reset-btn {
  margin-left: auto;
  background: none;
  border: 1px solid var(--nf-border);
  color: var(--nf-text-muted);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 0.68rem;
  cursor: pointer;
  transition: border-color 150ms, color 150ms;
}
.reset-btn:hover { border-color: var(--nf-accent); color: var(--nf-accent); }

/* ── Sheet canvas ───────────────────────────────────────── */
.sheet-container {
  overflow-x: auto;
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 12px;
  padding: 8px;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet-svg { display: block; width: 100%; }
.sheet-note { cursor: pointer; }

.empty-sheet {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 30px;
  color: var(--nf-text-muted);
  font-size: 0.9rem;
}
.empty-sheet ion-icon { font-size: 2rem; color: var(--nf-text-dim); }

/* ── Measure nav ────────────────────────────────────────── */
.measure-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}
.nav-btn {
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  color: var(--nf-text-muted);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 0.78rem;
  cursor: pointer;
  font-family: var(--nf-font-mono);
  transition: border-color 150ms, color 150ms;
}
.nav-btn:hover:not(:disabled) { border-color: var(--nf-accent); color: var(--nf-accent); }
.nav-btn:disabled { opacity: 0.3; cursor: default; }
.nav-info { font-size: 0.72rem; color: var(--nf-text-muted); }

.keyboard-wrap { flex-shrink: 0; }
</style>
