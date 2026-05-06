import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import {
  generateNextChord,
  generateLookAhead,
  explainTransition,
  type VoicedChord,
  type FieldConfig,
  type FieldMode,
  NOTE_NAMES,
} from '@/utils/harmonic-field.engine'

export const useHarmonicFieldStore = defineStore('harmonicField', () => {

  // ── Config ────────────────────────────────────────────────────────────────
  const config = reactive<FieldConfig>({
    mode:      'major',
    rootPc:    0,          // C
    tension:   4,          // moderate
    spread:    5,          // medium spread
    noteCount: [4, 7],
  })

  // ── Session state ─────────────────────────────────────────────────────────
  const active          = ref(false)
  const history         = ref<VoicedChord[]>([])   // all played chords
  const current         = ref<VoicedChord | null>(null)
  const lookahead       = ref<VoicedChord[]>([])   // next 3 chords preview
  const explanation     = ref('')
  const chordsPlayed    = ref(0)
  const sessionStreak   = ref(0)
  const maxSessionStreak = ref(0)

  // ── Match state: which notes are currently held ───────────────────────────
  const heldNotes   = ref(new Set<number>())
  const wrongNotes  = ref(new Set<number>())
  const isComplete  = ref(false)

  // ── Computed ──────────────────────────────────────────────────────────────
  const allTargetNotes = computed((): Set<number> =>
    current.value ? new Set(current.value.notes) : new Set()
  )

  const leftProgress = computed((): number => {
    if (!current.value || !current.value.leftNotes.length) return 0
    const held = current.value.leftNotes.filter(n => heldNotes.value.has(n)).length
    return (held / current.value.leftNotes.length) * 100
  })

  const rightProgress = computed((): number => {
    if (!current.value || !current.value.rightNotes.length) return 0
    const held = current.value.rightNotes.filter(n => heldNotes.value.has(n)).length
    return (held / current.value.rightNotes.length) * 100
  })

  const rootName = computed(() => NOTE_NAMES[config.rootPc])

  // ── Start / stop ──────────────────────────────────────────────────────────
  function start() {
    history.value      = []
    chordsPlayed.value = 0
    sessionStreak.value = 0
    heldNotes.value    = new Set()
    wrongNotes.value   = new Set()
    isComplete.value   = false
    active.value       = true

    // Generate first chord
    const first = generateNextChord(null, config, [])
    current.value   = first
    explanation.value = explainTransition(null, first)
    refreshLookahead()
  }

  function stop() {
    active.value     = false
    current.value    = null
    lookahead.value  = []
    heldNotes.value  = new Set()
    wrongNotes.value = new Set()
    isComplete.value = false
  }

  // ── Lookahead ─────────────────────────────────────────────────────────────
  function refreshLookahead() {
    if (!current.value) return
    lookahead.value = generateLookAhead(current.value, config, history.value, 3)
  }

  // ── Note matching ─────────────────────────────────────────────────────────
  function onNoteOn(midi: number): boolean {
    if (!current.value || isComplete.value) return false

    const target = current.value.notes

    if (target.includes(midi)) {
      heldNotes.value = new Set([...heldNotes.value, midi])
      wrongNotes.value.delete(midi)
    } else {
      wrongNotes.value = new Set([...wrongNotes.value, midi])
    }

    // Complete when every target note is held
    const allHeld = target.every(n => heldNotes.value.has(n))
    if (allHeld && !isComplete.value) {
      isComplete.value = true
      chordsPlayed.value++
      sessionStreak.value++
      maxSessionStreak.value = Math.max(maxSessionStreak.value, sessionStreak.value)
      return true
    }
    return false
  }

  function onNoteOff(midi: number) {
    const next = new Set(heldNotes.value)
    next.delete(midi)
    heldNotes.value = next

    const wrong = new Set(wrongNotes.value)
    wrong.delete(midi)
    wrongNotes.value = wrong
  }

  // ── Advance to next chord ─────────────────────────────────────────────────
  function advance() {
    if (!current.value) return

    // Push current to history (keep last 20)
    history.value = [...history.value, current.value].slice(-20)

    // The first item in lookahead becomes the new current
    const [next, ...rest] = lookahead.value

    if (next) {
      const prev       = current.value
      current.value    = next
      explanation.value = explainTransition(prev, next)

      // Regenerate one more at the tail
      const tail = generateNextChord(
        rest[rest.length - 1] ?? next,
        config,
        [...history.value, next, ...rest],
      )
      lookahead.value = [...rest, tail]
    } else {
      // Lookahead was empty — generate fresh
      const prev = current.value
      const newChord = generateNextChord(prev, config, history.value)
      current.value  = newChord
      explanation.value = explainTransition(prev, newChord)
      refreshLookahead()
    }

    // Reset match state
    heldNotes.value  = new Set()
    wrongNotes.value = new Set()
    isComplete.value = false
  }

  // ── Skip (no penalty on wrong notes in field mode — just keep playing) ────
  function skip() {
    sessionStreak.value = 0
    advance()
  }

  // ── Config mutators ───────────────────────────────────────────────────────
  function setMode(m: FieldMode)     { config.mode     = m;  if (active.value) refreshLookahead() }
  function setRoot(pc: number)       { config.rootPc   = pc; if (active.value) refreshLookahead() }
  function setTension(t: number)     { config.tension  = t;  if (active.value) refreshLookahead() }
  function setSpread(s: number)      { config.spread   = s;  if (active.value) refreshLookahead() }
  function setNoteCount(min: number, max: number) {
    config.noteCount = [min, max]
    if (active.value) refreshLookahead()
  }

  return {
    config,
    active,
    history,
    current,
    lookahead,
    explanation,
    chordsPlayed,
    sessionStreak,
    maxSessionStreak,
    heldNotes,
    wrongNotes,
    isComplete,
    allTargetNotes,
    leftProgress,
    rightProgress,
    rootName,
    start,
    stop,
    onNoteOn,
    onNoteOff,
    advance,
    skip,
    setMode, setRoot, setTension, setSpread, setNoteCount,
  }
})
