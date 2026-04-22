<template>
  <div class="sheet-display" ref="rootRef">

    <!-- Header -->
    <div class="sheet-header">
      <div class="header-left">
        <span class="sheet-title">{{ mode === 'piece' ? (piece?.title ?? '') : (title || 'Lesson') }}</span>
        <span class="sheet-sub mono" v-if="mode === 'piece'">
          {{ piece?.composer }} &middot; {{ piece?.timeSignature[0] }}/{{ piece?.timeSignature[1] }} &middot; &sung;={{ piece?.bpm }}
        </span>
        <span class="sheet-sub mono" v-else>{{ steps?.length }} steps</span>
      </div>
      <div class="header-right">
        <transition name="chord-pop">
          <span v-if="liveChord" :key="liveChord" class="chord-badge mono">{{ liveChord }}</span>
        </transition>
      </div>
    </div>

    <!-- Progress -->
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: progressPct + '%' }" />
      <span class="progress-label mono">
        {{ currentChordIdx }}/{{ totalSteps }}
        <template v-if="currentChordNoteCount > 1">
          &middot; {{ heldCorrect.size }}/{{ currentChordNoteCount }} held
        </template>
      </span>
    </div>

    <!-- Canvas -->
    <div
      class="canvas-wrap"
      ref="canvasWrapRef"
      :style="{ minHeight: canvasLogH + 'px' }"
      @dragover.prevent="$emit('dragover', $event)"
      @drop.prevent="$emit('drop', $event)"
      @click="onCanvasClick"
      @mousemove="onCanvasHover"
      @mouseleave="hoveredMidi = null; scheduleDraw()"
    >
      <canvas ref="canvasRef" class="sheet-canvas" />
      <div v-if="!hasContent" class="empty-state">
        <ion-icon name="document-text-outline" />
        <p>{{ mode === 'piece' ? 'No notes in this piece.' : 'No steps in this lesson.' }}</p>
      </div>
    </div>

    <!-- Navigation -->
    <div class="sheet-nav" v-if="totalPages > 1">
      <button class="nav-btn" :disabled="pageIdx === 0" @click="prevPage">&#8592; Prev</button>
      <div class="nav-dots">
        <span
          v-for="p in totalPages" :key="p"
          class="nav-dot" :class="{ 'nav-dot--active': p - 1 === pageIdx }"
          @click="gotoPage(p - 1)"
        />
      </div>
      <button class="nav-btn" :disabled="pageIdx >= totalPages - 1" @click="nextPage">Next &#8594;</button>
    </div>

    <!-- Options -->
    <div class="options-bar">
      <label class="opt-toggle"><input type="checkbox" v-model="showNoteNames" /><span>Note names</span></label>
      <label class="opt-toggle"><input type="checkbox" v-model="showChordNames" /><span>Chord names</span></label>
      <div class="opt-spacer" />
      <ion-select v-model="perPage" interface="popover" class="per-page-select">
        <ion-select-option v-if="mode === 'lesson'" :value="4">4 steps</ion-select-option>
        <ion-select-option v-if="mode === 'lesson'" :value="8">8 steps</ion-select-option>
        <ion-select-option v-if="mode === 'lesson'" :value="12">12 steps</ion-select-option>
        <ion-select-option v-if="mode === 'piece'" :value="2">2 bars</ion-select-option>
        <ion-select-option v-if="mode === 'piece'" :value="4">4 bars</ion-select-option>
        <ion-select-option v-if="mode === 'piece'" :value="6">6 bars</ion-select-option>
        <ion-select-option v-if="mode === 'piece'" :value="8">8 bars</ion-select-option>
      </ion-select>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { IonIcon, IonSelect, IonSelectOption } from '@ionic/vue'
import { midiToNoteInfo } from '@/utils/noteEngine'
import {midiToChord} from '@/utils/midiToChord'

import type { SheetPiece, SheetNote } from '@/types'

// ─── Exported type ────────────────────────────────────────────────────────────
export interface LessonDisplayStep { midis: number[] }

// ─── Props ────────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  piece?:          SheetPiece | null
  steps?:          LessonDisplayStep[]
  title?:          string
  currentChordIdx: number
  heldCorrect:     Set<number>
  playedNotes:     Set<number>
  wrongNotes?:     Set<number>
}>(), { piece: null, steps: () => [], title: '', wrongNotes: () => new Set() })

const emit = defineEmits<{
  noteClick:  [midi: number]
  dragover:   [e: DragEvent]
  drop:       [e: DragEvent]
  pageChange: [offset: number]
}>()

// ─── Refs ─────────────────────────────────────────────────────────────────────
const rootRef      = ref<HTMLElement | null>(null)
const canvasRef    = ref<HTMLCanvasElement | null>(null)
const canvasWrapRef = ref<HTMLElement | null>(null)
defineExpose({ rootRef })

// ─── Options ──────────────────────────────────────────────────────────────────
const showNoteNames  = ref(true)
const showChordNames = ref(true)
const hoveredMidi    = ref<number | null>(null)

// ─── Mode ─────────────────────────────────────────────────────────────────────
const mode = computed<'piece' | 'lesson'>(() =>
  props.steps && props.steps.length > 0 ? 'lesson' : 'piece'
)

const perPage = ref(4)
watch(mode, m => { perPage.value = m === 'lesson' ? 8 : 4 }, { immediate: true })

// ─── Chord index maps ─────────────────────────────────────────────────────────
// Built once from the full piece — maps each chord to its page.
// This is the ground truth for smart pagination.

interface PieceChord {
  idx:           number     // global chord index (0-based)
  beat:          number     // absolute beat
  notes:         SheetNote[]
  measureIdx:    number     // 0-based index in piece.measures[]
  measureNumber: number     // display number (m.number)
  page:          number     // which page this chord lives on
}

const pieceChords = computed((): PieceChord[] => {
  if (!props.piece) return []
  const bpm    = props.piece.timeSignature[0]
  const groups: Omit<PieceChord, 'idx' | 'page'>[] = []

  props.piece.measures.forEach((m, mi) => {
    m.notes.forEach(n => {
      const ab = n.startBeat + mi * bpm
      const ex = groups.find(g => Math.abs(g.beat - ab) < 0.05)
      if (ex) ex.notes.push(n)
      else groups.push({ beat: ab, notes: [n], measureIdx: mi, measureNumber: m.number })
    })
  })

  groups.sort((a, b) => a.beat - b.beat)

  // Assign page: a page is a contiguous slice of measures.
  // Chord lives on the page that contains its measure.
  return groups.map((g, i) => ({
    ...g,
    idx:  i,
    page: Math.floor(g.measureIdx / perPage.value),
  }))
})

// For lesson mode: flat array of chords per page
const lessonChordsPerPage = computed(() => {
  // Each step is one chord. Page = Math.floor(stepIdx / perPage)
  return props.steps.map((s, i) => ({
    idx:  i,
    page: Math.floor(i / perPage.value),
    midis: s.midis,
  }))
})

// ─── Smart pagination ─────────────────────────────────────────────────────────
// Given currentChordIdx, find which page it belongs to and jump there if needed.

function pageForChord(chordIdx: number): number {
  if (mode.value === 'lesson') {
    return Math.floor(chordIdx / perPage.value)
  }
  // Piece mode: look up the chord's page in pieceChords
  const chord = pieceChords.value[chordIdx]
  if (!chord) return 0
  // Page = which slice of measures contains this chord's measureIdx
  return Math.floor(chord.measureIdx / perPage.value)
}

const pageIdx    = ref(0)
const totalItems = computed(() =>
  mode.value === 'lesson'
    ? props.steps.length
    : (props.piece?.measures.length ?? 0)
)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / perPage.value)))
const pageOffset = computed(() => pageIdx.value * perPage.value)
const hasContent = computed(() => totalItems.value > 0)

function prevPage()          { pageIdx.value = Math.max(0, pageIdx.value - 1) }
function nextPage()          { pageIdx.value = Math.min(totalPages.value - 1, pageIdx.value + 1) }
function gotoPage(p: number) { pageIdx.value = Math.max(0, Math.min(totalPages.value - 1, p)) }

// ── Smart auto-scroll: jump page only when chord moves off current page ────────
watch(() => props.currentChordIdx, (newIdx) => {
  const targetPage = pageForChord(newIdx)
  if (targetPage !== pageIdx.value) {
    pageIdx.value = targetPage
    emit('pageChange', pageIdx.value * perPage.value)
  }
})

// Reset on piece/steps change
watch([() => props.piece?.id, () => props.steps?.length], () => {
  pageIdx.value = 0
})

// Recalculate pages if perPage changes — keep current chord visible
watch(perPage, () => {
  const targetPage = pageForChord(props.currentChordIdx)
  pageIdx.value = targetPage
})

// ─── Visible slices ───────────────────────────────────────────────────────────
interface StepSlot { globalIdx: number; midis: number[] }

const visibleSteps = computed((): StepSlot[] => {
  if (mode.value !== 'lesson') return []
  return props.steps
    .slice(pageOffset.value, pageOffset.value + perPage.value)
    .map((s, i) => ({ globalIdx: pageOffset.value + i, midis: s.midis }))
})

const visibleMeasures = computed(() => {
  if (mode.value !== 'piece' || !props.piece) return []
  return props.piece.measures.slice(pageOffset.value, pageOffset.value + perPage.value)
})

// ─── Chord lookup helpers ─────────────────────────────────────────────────────
function pieceChordIdxOf(note: SheetNote, measureNumber: number): number {
  if (!props.piece) return -1
  const bpm = props.piece.timeSignature[0]
  const mi  = props.piece.measures.findIndex(m => m.number === measureNumber)
  if (mi < 0) return -1
  const ab = note.startBeat + mi * bpm
  return pieceChords.value.findIndex(c => Math.abs(c.beat - ab) < 0.05)
}

// ─── Progress ─────────────────────────────────────────────────────────────────
const totalSteps = computed(() =>
  mode.value === 'lesson' ? props.steps.length : pieceChords.value.length
)
const progressPct = computed(() =>
  totalSteps.value ? (props.currentChordIdx / totalSteps.value) * 100 : 0
)
const currentChordNoteCount = computed(() => {
  if (mode.value === 'lesson') return props.steps[props.currentChordIdx]?.midis.length ?? 0
  return pieceChords.value[props.currentChordIdx]?.notes.length ?? 0
})
const liveChord = computed(() => {
  if (!props.playedNotes.size) return ''
  const r = midiToChord([...props.playedNotes])
  return r.chord === '—' ? '' : r.chord
})

// ═══════════════════════════════════════════════════════════════════════════════
// ── CANVAS 2D RENDERER — DYNAMIC STAVE SYSTEM ───────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const DPR = window.devicePixelRatio || 1

// ── Fixed layout constants ────────────────────────────────────────────────────
const CLEF_W        = 62      // width reserved for clef + time sig
const SLOT_W        = 72      // lesson step slot width
const MIN_MEASURE_W = 180     // minimum measure width in piece mode
const STAFF_H       = 60      // height of one 5-line staff (4 × gap)
const STAFF_GAP     = STAFF_H / 4  // 15px — space between adjacent staff lines
const STEP_PX       = STAFF_GAP / 2  // 7.5px per diatonic step
const STAVE_SEP     = 26      // vertical gap between consecutive staves
const TOP_MARGIN    = 52      // space above first stave (ledger lines + labels)
const BOT_MARGIN    = 48      // space below last stave (chord labels + padding)

// ── Diatonic mapping ─────────────────────────────────────────────────────────
const DIATONIC_MAP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
const SHARPS       = new Set([1, 3, 6, 8, 10])

function midiToDiatonic(midi: number): number {
  return (Math.floor(midi / 12) - 1) * 7 + DIATONIC_MAP[midi % 12]
}

// ── Stave definition ──────────────────────────────────────────────────────────
// Each stave has:
//   id       — unique string key  ('treble' | 'bass' | 'treble2' | etc.)
//   clef     — 'treble' | 'bass' | 'alto' | 'tenor'
//   anchor   — MIDI note that sits on the centre (3rd) staff line
//   top      — Y of the top staff line (computed dynamically)
interface StaveDef {
  id:     string
  clef:   'treble' | 'bass' | 'alto' | 'tenor'
  anchor: number    // MIDI note on middle staff line
  top:    number    // computed Y
  bot:    number    // computed Y
  cy:     number    // centre Y
}

// Standard anchor notes (MIDI):
//   Treble: B4=71 on middle line
//   Bass:   D3=50 on middle line (actually B2=47 for standard bass clef)
//   Alto:   C4=60 on middle line
//   Tenor:  A3=57 on middle line
const CLEF_ANCHORS: Record<string, number> = {
  treble: 71,   // B4
  bass:   47,   // B2
  alto:   60,   // C4
  tenor:  57,   // A3
}

const CLEF_SYMBOLS: Record<string, string> = {
  treble: '𝄞',
  bass:   '𝄢',
  alto:   '𝄡',
  tenor:  '𝄡',
}

// ── Analyse notes to determine which staves are needed ────────────────────────
// Strategy: cluster the MIDI range of all notes across active measures/steps
// into stave "zones" separated by natural breaks in the range.
// Rules:
//   - Notes 55–127  → treble (G3 and above)
//   - Notes 36–54   → bass   (below G3)
//   - Notes 0–35    → contrabass (very low — extra bass stave)
//   - Notes 84–127  → piccolo (very high — extra treble stave)
// Additionally, if the piece explicitly sets note.hand, we respect that.

interface StaveLayout {
  staves:    StaveDef[]
  totalH:    number    // total canvas height including margins
  lastBotY:  number    // bottom of the last stave
}

function computeStaveLayout(allMidis: number[]): StaveLayout {
  if (!allMidis.length) {
    // Default: one treble + one bass
    return buildLayout(['treble', 'bass'])
  }

  const lo = Math.min(...allMidis)
  const hi = Math.max(...allMidis)

  const needed: string[] = []

  // Very high notes (above C6=84) → add a high treble or keep treble
  // Piccolo range above C7=96 is impractical for piano, keep as treble
  if (hi >= 60) needed.push('treble')

  // Mid-upper range: if treble alone covers it all, no extra stave
  // Check if an alto stave is useful (C4–C5 heavy middle range)
  // Only add alto if there's a dense cluster in 48–72 AND also notes outside treble
  const hasHighAlt = allMidis.some(m => m >= 60 && m <= 72)
  const hasLow     = lo < 55
  const hasMid     = allMidis.some(m => m >= 48 && m < 60)

  // Add bass stave if any notes below G3(55)
  if (hasLow) needed.push('bass')

  // Add sub-bass if notes go below C2(36)
  if (lo < 36) needed.push('subbass')

  // Ensure at least one stave
  if (!needed.length) needed.push('treble')

  return buildLayout(needed)
}

function buildLayout(staveIds: string[]): StaveLayout {
  const staves: StaveDef[] = []
  let y = TOP_MARGIN

  for (const id of staveIds) {
    // Map id to clef
    let clef: StaveDef['clef'] = 'treble'
    if (id === 'bass' || id === 'subbass') clef = 'bass'
    else if (id === 'alto') clef = 'alto'
    else if (id === 'tenor') clef = 'tenor'

    const top = y
    const bot = top + STAFF_H
    staves.push({
      id,
      clef,
      anchor: CLEF_ANCHORS[clef] ?? 71,
      top,
      bot,
      cy: (top + bot) / 2,
    })
    y = bot + STAVE_SEP
  }

  // Remove the trailing sep from the last stave
  const lastBotY = staves[staves.length - 1]?.bot ?? TOP_MARGIN
  const totalH   = lastBotY + BOT_MARGIN

  return { staves, totalH, lastBotY }
}

// ── Assign each MIDI note to the best matching stave ─────────────────────────
function assignStave(midi: number, staves: StaveDef[], explicitHand?: 'left' | 'right'): StaveDef {
  if (staves.length === 1) return staves[0]

  // If explicit hand from SheetNote
  if (explicitHand === 'right') {
    return staves.find(s => s.clef === 'treble') ?? staves[0]
  }
  if (explicitHand === 'left') {
    return staves.find(s => s.clef === 'bass') ?? staves[staves.length - 1]
  }

  // Find the stave whose anchor is closest diatonically to the note
  const dNote = midiToDiatonic(midi)
  let best    = staves[0]
  let bestDist = Math.abs(dNote - midiToDiatonic(best.anchor))

  for (const s of staves) {
    const dist = Math.abs(dNote - midiToDiatonic(s.anchor))
    if (dist < bestDist) { bestDist = dist; best = s }
  }
  return best
}

// ── noteY using stave ─────────────────────────────────────────────────────────
function noteYInStave(midi: number, stave: StaveDef): number {
  const dNote   = midiToDiatonic(midi)
  const dAnchor = midiToDiatonic(stave.anchor)
  return stave.cy - (dNote - dAnchor) * STEP_PX
}

// ── Measure width ─────────────────────────────────────────────────────────────
function measureW(measures: any[]): number {
  if (!measures.length) return MIN_MEASURE_W
  const maxNotes = measures.reduce((m: number, ms: any) => Math.max(m, ms.notes.length), 1)
  return Math.max(MIN_MEASURE_W, maxNotes * 30 + 30)
}

function beatX(localBeat: number, mw: number, bpm: number): number {
  return 22 + (localBeat / bpm) * (mw - 36)
}

// ── CSS vars (cached) ─────────────────────────────────────────────────────────
const cssCache = new Map<string, string>()
function css(name: string): string {
  if (cssCache.has(name)) return cssCache.get(name)!
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  cssCache.set(name, v)
  return v
}

// ── Hit zones ─────────────────────────────────────────────────────────────────
interface HitZone { x: number; y: number; r: number; midi: number }
let hitZones: HitZone[] = []

// ── Canvas height state (drives CSS height of wrapper) ────────────────────────
const canvasLogH = ref(260)

// ── MAIN DRAW ─────────────────────────────────────────────────────────────────
function draw() {
  const canvas = canvasRef.value
  const wrap   = canvasWrapRef.value
  if (!canvas || !wrap) return

  // Collect all MIDI notes on this page
  let allMidis: number[] = []
  if (mode.value === 'lesson') {
    allMidis = visibleSteps.value.flatMap(s => s.midis)
  } else {
    allMidis = visibleMeasures.value.flatMap(m => m.notes.map(n => n.midi))
  }

  // Build dynamic stave layout from actual notes
  const layout = computeStaveLayout(allMidis)
  const { staves, totalH, lastBotY } = layout

  // Update reactive height so the wrapper div tracks it
  canvasLogH.value = totalH

  // Compute canvas width
  let logW: number
  if (mode.value === 'lesson') {
    logW = Math.max(wrap.clientWidth, CLEF_W + visibleSteps.value.length * SLOT_W + 40)
  } else {
    const mw = measureW(visibleMeasures.value)
    logW = Math.max(wrap.clientWidth, CLEF_W + visibleMeasures.value.length * mw + 20)
  }

  // Resize canvas
  canvas.width        = logW * DPR
  canvas.height       = totalH * DPR
  canvas.style.width  = logW + 'px'
  canvas.style.height = totalH + 'px'

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  ctx.clearRect(0, 0, logW, totalH)
  hitZones = []

  const C = {
    bg:        css('--nf-key-white')  || '#12121a',
    border:    css('--nf-border')     || '#2a2a3a',
    muted:     css('--nf-text-muted') || '#6b6b88',
    dim:       css('--nf-key-black')   || '#3a3a55',
    accent:    css('--nf-key-black')     || '#c8f545',
    accentDim: css('--nf-accent-dim') || '#7a9a1f',
    blue:      css('--nf-blue')       || '#4f9eff',
    error:     css('--nf-error')      || '#ff4f6a',
  }

  // Background
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, logW, totalH)

  // Draw all staves
  for (const stave of staves) {
    drawStaff(ctx, logW, stave, C)
  }

  // Connecting brace (left edge through all staves)
  if (staves.length > 1) {
    ctx.strokeStyle = C.muted
    ctx.lineWidth   = 2
    ctx.beginPath()
    ctx.moveTo(CLEF_W - 3, staves[0].top)
    ctx.lineTo(CLEF_W - 3, staves[staves.length - 1].bot)
    ctx.stroke()
  }

  if (!hasContent.value) return

  // Dispatch to mode renderer
  if (mode.value === 'lesson') {
    drawLesson(ctx, C, logW, staves, lastBotY)
  } else {
    drawPiece(ctx, C, logW, staves, lastBotY)
  }

  // Ghost column — played notes mapped to their stave
  const ghostX = logW - 18
  for (const midi of props.playedNotes) {
    const stave = assignStave(midi, staves)
    const y     = noteYInStave(midi, stave)
    const color = props.wrongNotes?.has(midi) ? C.error : C.accent
    drawLedgers(ctx, midi, ghostX, stave, C.muted)
    drawHead(ctx, ghostX, y, color, color, true, 0.75)
  }
}

// ── Draw a single staff ───────────────────────────────────────────────────────
function drawStaff(ctx: CanvasRenderingContext2D, logW: number, stave: StaveDef, C: Record<string,string>) {
  // 5 staff lines
  ctx.strokeStyle = C.border
  ctx.lineWidth   = 1
  for (let i = 0; i < 5; i++) {
    const y = stave.top + i * STAFF_GAP
    ctx.beginPath(); ctx.moveTo(CLEF_W, y); ctx.lineTo(logW - 8, y); ctx.stroke()
  }

  // Clef symbol
  ctx.fillStyle = C.muted
  if (stave.clef === 'treble') {
    ctx.font = `${STAFF_H * 0.86}px serif`
    ctx.textAlign = 'left'
    ctx.fillText('𝄞', 7, stave.bot + 4)
  } else if (stave.clef === 'bass') {
    ctx.font = `${STAFF_H * 0.52}px serif`
    ctx.textAlign = 'left'
    ctx.fillText('𝄢', 9, stave.top + STAFF_GAP * 3.4)
  } else {
    // Alto / tenor — use a simplified C-clef rectangle
    ctx.font = `${STAFF_H * 0.52}px serif`
    ctx.textAlign = 'left'
    ctx.fillText('𝄡', 9, stave.top + STAFF_GAP * 3.4)
  }

  // Stave label (id) in tiny text
  ctx.fillStyle  = C.dim
  ctx.font       = '7px "Space Mono", monospace'
  ctx.textAlign  = 'left'
  const label = stave.clef.charAt(0).toUpperCase() + stave.clef.slice(1)
  ctx.fillText(label, 4, stave.top - 4)
}

// ── LESSON renderer ───────────────────────────────────────────────────────────
function drawLesson(
  ctx: CanvasRenderingContext2D,
  C: Record<string,string>,
  logW: number,
  staves: StaveDef[],
  lastBotY: number,
) {
  for (let vi = 0; vi < visibleSteps.value.length; vi++) {
    const slot = visibleSteps.value[vi]
    const sx   = CLEF_W + vi * SLOT_W
    const cx   = sx + SLOT_W / 2
    const gi   = slot.globalIdx
    const cur  = gi === props.currentChordIdx

    // Dashed separator spanning all staves
    ctx.strokeStyle = C.border
    ctx.lineWidth   = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(sx + SLOT_W, staves[0].top)
    ctx.lineTo(sx + SLOT_W, lastBotY)
    ctx.stroke()
    ctx.setLineDash([])

    // Step number above first stave
    ctx.fillStyle  = C.dim
    ctx.font       = '8px "Space Mono", monospace'
    ctx.textAlign  = 'center'
    ctx.fillText(String(gi + 1), cx, staves[0].top - 7)

    // Current highlight across all staves
    if (cur) {
      ctx.fillStyle = 'rgba(79,158,255,0.07)'
      ctx.fillRect(sx + 1, staves[0].top - 2, SLOT_W - 2, lastBotY - staves[0].top + 4)
    }

    for (const midi of slot.midis) {
      const stave  = assignStave(midi, staves)
      const y      = noteYInStave(midi, stave)
      const done   = gi < props.currentChordIdx
      const held   = cur && props.heldCorrect.has(midi)
      const fill   = done || held ? C.accent : 'transparent'
      const stroke = done ? C.accentDim : cur ? (held ? C.accent : C.blue) : C.dim

      drawLedgers(ctx, midi, cx, stave, C.muted)
      if (SHARPS.has(midi % 12)) drawAccidental(ctx, cx, y, C.muted)
      drawHead(ctx, cx, y, fill, stroke, done || held)
      drawStem(ctx, cx, y, C.muted, stave)
      hitZones.push({ x: cx, y, r: 9, midi })

      if (showNoteNames.value) {
        const lc     = done ? C.accentDim : cur ? C.blue : C.dim
        const isTop  = stave === staves[0]
        const labelY = isTop ? stave.top - 18 : stave.bot + 14
        ctx.fillStyle  = lc
        ctx.font       = '7.5px "Space Mono", monospace'
        ctx.textAlign  = 'center'
        ctx.fillText(midiToNoteInfo(midi).label, cx, labelY)
      }
    }

    // Chord label below last stave
    if (showChordNames.value && slot.midis.length > 1) {
      ctx.fillStyle  = C.muted
      ctx.font       = '7px "Space Mono", monospace'
      ctx.textAlign  = 'center'
      ctx.fillText(midiToChord(slot.midis).chord, cx, lastBotY + (showNoteNames.value ? 26 : 12))
    }
  }
}

// ── PIECE renderer ────────────────────────────────────────────────────────────
function drawPiece(
  ctx: CanvasRenderingContext2D,
  C: Record<string,string>,
  logW: number,
  staves: StaveDef[],
  lastBotY: number,
) {
  const measures = visibleMeasures.value
  if (!measures.length || !props.piece) return
  const mw  = measureW(measures)
  const bpm = props.piece.timeSignature[0]

  // Time signature on every stave
  ctx.fillStyle = C.muted
  ctx.font = `bold ${STAFF_GAP * 1.1}px "Space Mono", monospace`
  ctx.textAlign = 'center'
  for (const stave of staves) {
    ctx.fillText(String(props.piece.timeSignature[0]), CLEF_W - 9, stave.top + STAFF_GAP * 1.6)
    ctx.fillText(String(props.piece.timeSignature[1]), CLEF_W - 9, stave.top + STAFF_GAP * 3.4)
  }

  for (let vi = 0; vi < measures.length; vi++) {
    const measure    = measures[vi]
    const ox         = CLEF_W + vi * mw
    const curMeasure = pieceChords.value[props.currentChordIdx]?.measureNumber === measure.number

    // Current measure highlight (all staves)
    if (curMeasure) {
      ctx.fillStyle = 'rgba(79,158,255,0.05)'
      ctx.fillRect(ox, staves[0].top - 2, mw, lastBotY - staves[0].top + 4)
    }

    // Bar line through all staves
    ctx.strokeStyle = C.muted
    ctx.lineWidth   = 1.5
    ctx.beginPath()
    ctx.moveTo(ox + mw, staves[0].top)
    ctx.lineTo(ox + mw, lastBotY)
    ctx.stroke()

    // Measure number above first stave
    ctx.fillStyle  = C.dim
    ctx.font       = '8px "Space Mono", monospace'
    ctx.textAlign  = 'left'
    ctx.fillText(String(measure.number), ox + 4, staves[0].top - 8)

    // Group notes by beat
    const beatMap = new Map<number, SheetNote[]>()
    for (const note of measure.notes) {
      const key = Math.round(note.startBeat * 1000)
      if (!beatMap.has(key)) beatMap.set(key, [])
      beatMap.get(key)!.push(note)
    }

    // Draw each note
    for (const note of measure.notes) {
      const explicitHand = note.hand as ('left' | 'right' | undefined)
      const stave  = assignStave(note.midi, staves, explicitHand)
      const nx     = ox + beatX(note.startBeat, mw, bpm)
      const y      = noteYInStave(note.midi, stave)
      const ci     = pieceChordIdxOf(note, measure.number)
      const cur    = ci === props.currentChordIdx
      const done   = ci < props.currentChordIdx
      const held   = cur && props.heldCorrect.has(note.midi)
      const hov    = hoveredMidi.value === note.midi
      const fill   = done || held ? C.accent : 'transparent'
      const stroke = done ? C.accentDim : cur ? (held ? C.accent : C.blue) : hov ? C.blue : C.dim

      drawLedgers(ctx, note.midi, nx, stave, C.muted)
      if (SHARPS.has(note.midi % 12)) drawAccidental(ctx, nx, y, C.muted)
      drawHead(ctx, nx, y, fill, stroke, done || held)
      drawStem(ctx, nx, y, C.muted, stave)
      hitZones.push({ x: nx, y, r: 9, midi: note.midi })

      if (showNoteNames.value) {
        const lc     = done ? C.accentDim : cur ? C.blue : C.dim
        const isTop  = stave === staves[0]
        const labelY = isTop ? stave.top - 18 : stave.bot + 14
        ctx.fillStyle  = lc
        ctx.font       = '7.5px "Space Mono", monospace'
        ctx.textAlign  = 'center'
        ctx.fillText(midiToNoteInfo(note.midi).label, nx, labelY)
      }
    }

    // Chord labels below last stave
    if (showChordNames.value) {
      for (const [, notes] of beatMap) {
        if (notes.length < 2) continue
        const nx  = ox + beatX(notes[0].startBeat, mw, bpm)
        const lbl = midiToChord(notes.map(n => n.midi)).chord
        ctx.fillStyle  = C.muted
        ctx.font       = '7px "Space Mono", monospace'
        ctx.textAlign  = 'center'
        ctx.fillText(lbl, nx, lastBotY + (showNoteNames.value ? 26 : 12))
      }
    }
  }
}

// ── Drawing primitives ────────────────────────────────────────────────────────

function drawHead(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  fill: string, stroke: string,
  filled: boolean, alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.ellipse(x, y, 7, 5, -0.2, 0, Math.PI * 2)
  if (filled && fill !== 'transparent') { ctx.fillStyle = fill; ctx.fill() }
  ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.restore()
}

function drawStem(
  ctx: CanvasRenderingContext2D,
  x: number, headY: number,
  color: string,
  stave: StaveDef,
) {
  // Stem direction: notes above stave centre → stem down; below → stem up
  // (conventional engraving rule)
  const stemUp = headY >= stave.cy
  const tipY   = stemUp ? headY - 28 : headY + 28
  ctx.strokeStyle = color
  ctx.lineWidth   = 1.5
  ctx.beginPath()
  ctx.moveTo(x + 6, headY)
  ctx.lineTo(x + 6, tipY)
  ctx.stroke()
}

function drawAccidental(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle  = color
  ctx.font       = `${STAFF_GAP * 0.95}px serif`
  ctx.textAlign  = 'right'
  ctx.fillText('♯', x - 8, y + 4)
}

function drawLedgers(
  ctx: CanvasRenderingContext2D,
  midi: number,
  cx: number,
  stave: StaveDef,
  color: string,
) {
  const y    = noteYInStave(midi, stave)
  const topY = stave.top    // top staff line Y
  const botY = stave.bot    // bottom staff line Y
  const len  = 13

  ctx.strokeStyle = color
  ctx.lineWidth   = 1

  // Ledger lines above staff
  if (y < topY - 2) {
    for (let ly = topY - STAFF_GAP; ly >= y - STEP_PX + 1; ly -= STAFF_GAP) {
      ctx.beginPath(); ctx.moveTo(cx - len, ly); ctx.lineTo(cx + len, ly); ctx.stroke()
    }
  }

  // Ledger lines below staff
  if (y > botY + 2) {
    for (let ly = botY + STAFF_GAP; ly <= y + STEP_PX - 1; ly += STAFF_GAP) {
      ctx.beginPath(); ctx.moveTo(cx - len, ly); ctx.lineTo(cx + len, ly); ctx.stroke()
    }
  }

  // Middle C ledger line — only when note is near C4 and stave is adjacent
  if (midi >= 59 && midi <= 61) {
    const ly = noteYInStave(60, stave)
    if (Math.abs(ly - topY) < 3 || Math.abs(ly - botY) < 3 || ly < topY - 2 || ly > botY + 2) {
      ctx.beginPath(); ctx.moveTo(cx - len, ly); ctx.lineTo(cx + len, ly); ctx.stroke()
    }
  }
}

// ── Interaction ───────────────────────────────────────────────────────────────
function canvasXY(e: MouseEvent): [number, number] {
  const r = canvasRef.value!.getBoundingClientRect()
  return [e.clientX - r.left, e.clientY - r.top]
}

function hitTest(x: number, y: number): number | null {
  for (const z of hitZones) {
    if (Math.hypot(x - z.x, y - z.y) <= z.r) return z.midi
  }
  return null
}

function onCanvasClick(e: MouseEvent) {
  const [x, y] = canvasXY(e)
  const midi = hitTest(x, y)
  if (midi !== null) emit('noteClick', midi)
}

function onCanvasHover(e: MouseEvent) {
  const [x, y] = canvasXY(e)
  const prev = hoveredMidi.value
  hoveredMidi.value = hitTest(x, y)
  canvasRef.value!.style.cursor = hoveredMidi.value !== null ? 'pointer' : 'default'
  if (hoveredMidi.value !== prev) scheduleDraw()
}

// ── Reactive redraw ───────────────────────────────────────────────────────────
let rafId: number | null = null

function scheduleDraw() {
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => { draw(); rafId = null })
}

watch(
  [
    () => props.piece, () => props.steps,
    () => props.currentChordIdx, () => props.heldCorrect,
    () => props.playedNotes, () => props.wrongNotes,
    pageIdx, perPage, showNoteNames, showChordNames,
  ],
  scheduleDraw,
  { deep: true },
)

let resizeObs: ResizeObserver | null = null
onMounted(async () => {
  await nextTick()
  scheduleDraw()
  resizeObs = new ResizeObserver(scheduleDraw)
  if (canvasWrapRef.value) resizeObs.observe(canvasWrapRef.value)
})
onUnmounted(() => {
  resizeObs?.disconnect()
  if (rafId !== null) cancelAnimationFrame(rafId)
})

</script>

<style scoped>
.sheet-display { display:flex; flex-direction:column; background:var(--nf-surface-2); border:1px solid var(--nf-border); border-radius:14px; overflow:hidden; }
.sheet-header  { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 14px 8px; flex-wrap:wrap; }
.header-left   { display:flex; flex-direction:column; gap:2px; }
.sheet-title   { font-size:0.9rem; font-weight:700; color:var(--nf-text); letter-spacing:-0.01em; }
.sheet-sub     { font-size:0.65rem; color:var(--nf-text-muted); }
.header-right  { display:flex; align-items:center; gap:6px; }
.chord-badge   { font-size:0.72rem; padding:3px 10px; background:rgba(200,245,69,0.12); border:1px solid var(--nf-accent-dim); border-radius:999px; color:var(--nf-accent); font-weight:700; }
.chord-pop-enter-active { transition:opacity 180ms, transform 180ms; }
.chord-pop-enter-from   { opacity:0; transform:scale(0.8) translateY(-4px); }
.chord-pop-leave-active { transition:opacity 100ms; }
.chord-pop-leave-to     { opacity:0; }
.progress-track { position:relative; height:3px; background:var(--nf-border); margin:0 14px 4px; border-radius:2px; }
.progress-fill  { height:100%; background:var(--nf-accent); border-radius:2px; transition:width 300ms ease; }
.progress-label { position:absolute; right:0; top:6px; font-size:0.58rem; color:var(--nf-text-muted); white-space:nowrap; }
.canvas-wrap    { position:relative; overflow-x:auto; overflow-y:hidden; display:flex; align-items:stretch; transition: min-height 200ms ease; }
.sheet-canvas   { display:block; flex-shrink:0; }
.empty-state    { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--nf-text-muted); font-size:0.85rem; text-align:center; pointer-events:none; }
.empty-state ion-icon { font-size:1.8rem; color:var(--nf-text-dim); }
.empty-state p  { margin:0; }
.sheet-nav      { display:flex; align-items:center; justify-content:center; gap:10px; padding:4px 12px; }
.nav-btn        { padding:3px 10px; background:var(--nf-surface); border:1px solid var(--nf-border); border-radius:7px; color:var(--nf-text-muted); font-family:var(--nf-font-mono); font-size:0.7rem; cursor:pointer; transition:border-color 120ms, color 120ms; }
.nav-btn:hover:not(:disabled) { border-color:var(--nf-accent); color:var(--nf-accent); }
.nav-btn:disabled { opacity:0.25; cursor:default; }
.nav-dots       { display:flex; gap:5px; }
.nav-dot        { width:6px; height:6px; border-radius:50%; background:var(--nf-border); cursor:pointer; transition:background 120ms, transform 120ms; }
.nav-dot:hover  { background:var(--nf-text-muted); }
.nav-dot--active{ background:var(--nf-accent); transform:scale(1.35); }
.options-bar    { display:flex; align-items:center; gap:12px; padding:7px 14px 10px; border-top:1px solid var(--nf-border); flex-wrap:wrap; }
.opt-toggle     { display:flex; align-items:center; gap:5px; font-size:0.7rem; color:var(--nf-text-muted); cursor:pointer; font-family:var(--nf-font-mono); user-select:none; }
.opt-toggle input[type=checkbox] { accent-color:var(--nf-accent); width:13px; height:13px; cursor:pointer; }
.opt-spacer     { flex:1; }
.per-page-select{ --background:var(--nf-surface); --color:var(--nf-text-muted); border:1px solid var(--nf-border); border-radius:7px; font-family:var(--nf-font-mono); font-size:0.7rem; width:80px; }
</style>
