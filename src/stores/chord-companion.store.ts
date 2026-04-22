import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { CHORD_CATALOG, buildProgression, chordById } from './lesson.store'
import type {
  ChordPair, ChordProgression, HandChord,
  ChordDef, ChordCompanionDifficulty, PairMatchState,
} from '@/types'

// ─── Octave transposition helpers ─────────────────────────────────────────────
function transposeNotes(notes: number[], octaveDelta: number): number[] {
  return notes.map(n => n + octaveDelta * 12)
}

function makeHandChord(chord: ChordDef, hand: 'left' | 'right'): HandChord {
  // Left hand: root octave 2–3 (bass register) → subtract 1 octave from base (oct 4)
  // Right hand: root octave 4–5 (treble register) → keep as-is or add 1
  const octave = hand === 'left' ? -1 : 0
  return {
    chord,
    hand,
    octave,
    notes: transposeNotes(chord.notes, octave),
  }
}

// ─── Build a ChordPair from two ChordDefs ─────────────────────────────────────
function makePair(left: ChordDef, right: ChordDef, desc: string, tags: string[]): ChordPair {
  return {
    id:          `${left.id}::${right.id}`,
    name:        `${left.shortLabel} / ${right.shortLabel}`,
    left:        makeHandChord(left, 'left'),
    right:       makeHandChord(right, 'right'),
    description: desc,
    tags,
  }
}

// ─── Chord lookup shorthand ───────────────────────────────────────────────────
function c(root: string, cat: 'major'|'minor'|'diminished'|'major7'|'dominant7'|'minor7'|'minor7b5') {
  return CHORD_CATALOG.find(ch => ch.root === root && ch.category === cat)!
}

// ─── Built-in progression catalog ────────────────────────────────────────────

export const PROGRESSION_CATALOG: ChordProgression[] = [

  // ── I. BEGINNER ────────────────────────────────────────────────────────────

  {
    id: 'c-major-basic',
    title: 'C Major — I · IV · V',
    key: 'C major',
    tempo: 72,
    difficulty: 'beginner',
    loop: true,
    description: 'The most fundamental progression in Western music. Left hand anchors the bass, right hand voices the chord above. I → IV → V → I.',
    pairs: [
      makePair(c('C','major'), c('C','major'),  'I — Home. Both hands on C Major. Stable and resolved.', ['I']),
      makePair(c('C','major'), c('F','major'),  'IV — Left stays on C, right moves up to F. Warm, open feeling.', ['IV']),
      makePair(c('G','major'), c('G','major'),  'V — The dominant. Tension that wants to resolve back home.', ['V']),
      makePair(c('C','major'), c('C','major'),  'I — Resolution. Welcome back home.', ['I']),
    ],
  },

  {
    id: 'a-minor-basic',
    title: 'A Minor — i · VI · III · VII',
    key: 'A minor',
    tempo: 70,
    difficulty: 'beginner',
    loop: true,
    description: 'A natural minor progression with a haunting, emotional quality. Used in thousands of pop and rock songs.',
    pairs: [
      makePair(c('A','minor'), c('A','minor'),  'i — The minor tonic. Dark, introspective centre.', ['i']),
      makePair(c('A','minor'), c('F','major'),  'VI — Relative major. Lifts the mood slightly.', ['VI']),
      makePair(c('C','major'), c('C','major'),  'III — Brightens further. Major feel within minor key.', ['III']),
      makePair(c('G','major'), c('G','major'),  'VII — Subtonic dominant. Pulls back toward the minor tonic.', ['VII']),
    ],
  },

  {
    id: 'pop-fifths',
    title: 'Pop Axis — I · V · vi · IV',
    key: 'C major',
    tempo: 80,
    difficulty: 'beginner',
    loop: true,
    description: 'Axis of awesome — the most used chord progression in pop music. Works for hundreds of songs.',
    pairs: [
      makePair(c('C','major'), c('C','major'),  'I — Tonic. Start strong.', ['I']),
      makePair(c('G','major'), c('G','major'),  'V — Dominant. Upward energy.', ['V']),
      makePair(c('A','minor'), c('A','minor'),  'vi — Relative minor. Emotional dip.', ['vi']),
      makePair(c('F','major'), c('F','major'),  'IV — Subdominant. Warm and grounding.', ['IV']),
    ],
  },

  // ── II. INTERMEDIATE ────────────────────────────────────────────────────────

  {
    id: 'jazz-ii-v-i-c',
    title: 'Jazz ii·V·I in C',
    key: 'C major',
    tempo: 90,
    difficulty: 'intermediate',
    loop: true,
    description: 'The cornerstone of jazz harmony. ii→V→I with 7th chords creates smooth voice leading and strong resolution.',
    pairs: [
      makePair(c('D','minor7'),    c('D','minor7'),    'ii7 — Dm7. Soft tension, minor subdominant feel.', ['ii7']),
      makePair(c('G','dominant7'), c('G','dominant7'), 'V7 — G7. Maximum tension — wants to resolve urgently.', ['V7']),
      makePair(c('C','major7'),    c('C','major7'),    'Imaj7 — Cmaj7. Lush resolution with the major 7th colour.', ['Imaj7']),
    ],
  },

  {
    id: 'jazz-ii-v-i-f',
    title: 'Jazz ii·V·I in F',
    key: 'F major',
    tempo: 88,
    difficulty: 'intermediate',
    loop: true,
    description: 'Same ii–V–I motion shifted to F. Learn to hear the pattern in a different key.',
    pairs: [
      makePair(c('G','minor7'),    c('G','minor7'),    'ii7 in F — Gm7.', ['ii7']),
      makePair(c('C','dominant7'), c('C','dominant7'), 'V7 in F — C7. Tension peaks here.', ['V7']),
      makePair(c('F','major7'),    c('F','major7'),    'Imaj7 in F — Fmaj7. Release.', ['Imaj7']),
    ],
  },

  {
    id: 'hands-split-c',
    title: 'Two-Hand Split — C Major',
    key: 'C major',
    tempo: 72,
    difficulty: 'intermediate',
    loop: true,
    description: 'Left hand plays the bass chord independently while right hand voices higher inversions. This is real piano accompaniment technique.',
    pairs: [
      makePair(c('C','major'),  c('E','minor'),   'C bass / Em treble — root + relative minor voicing. Rich and layered.', ['I', 'iii']),
      makePair(c('F','major'),  c('A','minor'),   'F bass / Am treble — IV/vi split. Common in ballads.', ['IV', 'vi']),
      makePair(c('G','major'),  c('B','minor'),   'G bass / Bm treble — V/vii split. Adds sophistication to the dominant.', ['V', 'vii']),
      makePair(c('C','major'),  c('C','major'),   'Unison return — both hands on C Major for resolution.', ['I']),
    ],
  },

  {
    id: 'blues-12-bar',
    title: '12-Bar Blues in A',
    key: 'A major',
    tempo: 85,
    difficulty: 'intermediate',
    loop: true,
    description: 'The foundation of blues and rock. Dominant 7th chords throughout — left hand bass, right hand 7th chord.',
    pairs: [
      makePair(c('A','dominant7'), c('A','dominant7'), 'I7 — A7. Blues tonic (dominant 7 on the I).', ['I7']),
      makePair(c('A','dominant7'), c('A','dominant7'), 'I7 — repeat.', ['I7']),
      makePair(c('A','dominant7'), c('A','dominant7'), 'I7 — repeat.', ['I7']),
      makePair(c('A','dominant7'), c('A','dominant7'), 'I7 — repeat.', ['I7']),
      makePair(c('D','dominant7'), c('D','dominant7'), 'IV7 — D7. Move to subdominant.', ['IV7']),
      makePair(c('D','dominant7'), c('D','dominant7'), 'IV7 — repeat.', ['IV7']),
      makePair(c('A','dominant7'), c('A','dominant7'), 'I7 — back home.', ['I7']),
      makePair(c('A','dominant7'), c('A','dominant7'), 'I7 — repeat.', ['I7']),
      makePair(c('E','dominant7'), c('E','dominant7'), 'V7 — E7. Maximum tension.', ['V7']),
      makePair(c('D','dominant7'), c('D','dominant7'), 'IV7 — D7. Pull back.', ['IV7']),
      makePair(c('A','dominant7'), c('A','dominant7'), 'I7 — back home.', ['I7']),
      makePair(c('E','dominant7'), c('E','dominant7'), 'V7 — E7. Turnaround.', ['V7']),
    ],
  },

  // ── III. ADVANCED ───────────────────────────────────────────────────────────

  {
    id: 'jazz-rhythm-changes',
    title: 'Rhythm Changes (A Section)',
    key: 'Bb major',
    tempo: 110,
    difficulty: 'advanced',
    loop: true,
    description: 'Based on "I Got Rhythm" — used in hundreds of jazz standards. Cycle of dominant 7ths, tight voice leading required.',
    pairs: [
      makePair(c('Bb','major7'),   c('Bb','major7'),   'Imaj7 in Bb.', ['Imaj7']),
      makePair(c('G','dominant7'), c('G','dominant7'),  'VI7 — secondary dominant toward ii.', ['VI7']),
      makePair(c('C','minor7'),    c('C','minor7'),     'ii7 — Cm7.', ['ii7']),
      makePair(c('F','dominant7'), c('F','dominant7'),  'V7 — F7. Strong pull to Bb.', ['V7']),
      makePair(c('Bb','major7'),   c('Bb','major7'),   'Imaj7 — return.', ['Imaj7']),
      makePair(c('Bb','dominant7'),c('Bb','dominant7'), 'I7 — pivot to IV.', ['I7']),
      makePair(c('Eb','major7'),   c('Eb','major7'),   'IVmaj7 — Ebmaj7.', ['IVmaj7']),
      makePair(c('Eb','minor7'),   c('Ab','dominant7'), 'iv7/VII7 — Ebm7 → Ab7 chromatic approach.', ['iv7','VII7']),
    ],
  },

  {
    id: 'chromatic-mediant',
    title: 'Chromatic Mediant Shifts',
    key: 'Various',
    tempo: 65,
    difficulty: 'advanced',
    loop: false,
    description: 'Third-related chords that share no notes in common create dramatic colour shifts. Used heavily in film scores.',
    pairs: [
      makePair(c('C','major'),  c('E','major'),   'C → E: major third up. Brilliant, surprising shift.', ['chromatic']),
      makePair(c('E','major'),  c('G','major'),   'E → G: minor third up. Dark pivot.', ['chromatic']),
      makePair(c('G','major'),  c('Eb','major'),  'G → Eb: tritone-adjacent. Disorienting then resolved.', ['chromatic']),
      makePair(c('Eb','major'), c('C','major'),   'Eb → C: return via major third down.', ['chromatic']),
    ],
  },

  {
    id: 'sus-and-extensions',
    title: 'Suspended & Extended',
    key: 'G major',
    tempo: 75,
    difficulty: 'advanced',
    loop: true,
    description: 'Combines minor 7ths and half-diminished chords to create jazz-influenced voice leading with rich extended harmony.',
    pairs: [
      makePair(c('G','major7'),    c('G','major7'),    'Gmaj7 — Lush tonic.', ['Imaj7']),
      makePair(c('E','minor7'),    c('E','minor7'),    'Em7 — iii7. Floaty, ambiguous.', ['iii7']),
      makePair(c('A','minor7'),    c('A','minor7'),    'Am7 — ii7. Soft preparation.', ['ii7']),
      makePair(c('D','dominant7'), c('D','dominant7'), 'D7 — V7. Drive.', ['V7']),
      makePair(c('B','minor7b5'), c('E','dominant7'),  'Bm7♭5 → E7 — ii°7/V7 substitution. Dark jazz colour.', ['ii°7','V7']),
      makePair(c('A','minor7'),    c('D','dominant7'), 'Am7/D7 — Secondary ii–V motion.', ['ii7','V7']),
      makePair(c('G','major7'),    c('G','major7'),    'Gmaj7 — Resolution.', ['Imaj7']),
    ],
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────
export const useChordCompanionStore = defineStore('chordCompanion', () => {

  // ── Active progression ─────────────────────────────────────────────────────
  const activeProgressionId  = ref<string | null>(null)
  const currentPairIdx       = ref(0)
  const loopCount            = ref(0)
  const totalPairsPlayed     = ref(0)
  const difficultyFilter     = ref<ChordCompanionDifficulty | 'all'>('all')

  const activeProgression = computed(() =>
    PROGRESSION_CATALOG.find(p => p.id === activeProgressionId.value) ?? null
  )
  const currentPair = computed(() =>
    activeProgression.value?.pairs[currentPairIdx.value] ?? null
  )
  const isLastPair = computed(() =>
    activeProgression.value
      ? currentPairIdx.value >= activeProgression.value.pairs.length - 1
      : false
  )

  const filteredProgressions = computed(() =>
    difficultyFilter.value === 'all'
      ? PROGRESSION_CATALOG
      : PROGRESSION_CATALOG.filter(p => p.difficulty === difficultyFilter.value)
  )

  // ── Match state for current pair ───────────────────────────────────────────
  const matchState = ref<PairMatchState>({
    leftHeld:   new Set(),
    rightHeld:  new Set(),
    wrongNotes: new Set(),
    complete:   false,
  })

  // ── Scoring ────────────────────────────────────────────────────────────────
  const correctPairs  = ref(0)
  const totalAttempts = ref(0)
  const streak        = ref(0)
  const maxStreak     = ref(0)

  const accuracy = computed(() =>
    totalAttempts.value ? Math.round((correctPairs.value / totalAttempts.value) * 100) : 0
  )

  // ── Actions ────────────────────────────────────────────────────────────────
  function startProgression(id: string) {
    activeProgressionId.value = id
    currentPairIdx.value      = 0
    loopCount.value           = 0
    totalPairsPlayed.value    = 0
    correctPairs.value        = 0
    totalAttempts.value       = 0
    streak.value              = 0
    resetMatchState()
  }

  function resetMatchState() {
    matchState.value = {
      leftHeld:   new Set(),
      rightHeld:  new Set(),
      wrongNotes: new Set(),
      complete:   false,
    }
  }

  /**
   * Called on every noteOn.
   * Returns true if this note completed the current pair.
   */
  function onNoteOn(midi: number): boolean {
    if (!currentPair.value || matchState.value.complete) return false

    const pair = currentPair.value
    const leftNotes  = new Set(pair.left.notes)
    const rightNotes = new Set(pair.right.notes)

    const ms = matchState.value

    if (leftNotes.has(midi)) {
      ms.leftHeld = new Set([...ms.leftHeld, midi])
      ms.wrongNotes.delete(midi)
    } else if (rightNotes.has(midi)) {
      ms.rightHeld = new Set([...ms.rightHeld, midi])
      ms.wrongNotes.delete(midi)
    } else {
      ms.wrongNotes = new Set([...ms.wrongNotes, midi])
    }

    // Check completion: all notes of both hands held
    const leftDone  = pair.left.notes.every(n => ms.leftHeld.has(n))
    const rightDone = pair.right.notes.every(n => ms.rightHeld.has(n))

    if (leftDone && rightDone) {
      ms.complete = true
      correctPairs.value++
      totalAttempts.value++
      streak.value++
      maxStreak.value = Math.max(maxStreak.value, streak.value)
      return true
    }

    return false
  }

  function onNoteOff(midi: number) {
    const ms = matchState.value
    ms.leftHeld  = new Set([...ms.leftHeld].filter(n => n !== midi))
    ms.rightHeld = new Set([...ms.rightHeld].filter(n => n !== midi))
    ms.wrongNotes.delete(midi)
  }

  /**
   * Advance to the next pair. Handles looping.
   * Returns 'next' | 'looped' | 'finished'
   */
  function advancePair(): 'next' | 'looped' | 'finished' {
    const prog = activeProgression.value
    if (!prog) return 'finished'

    totalPairsPlayed.value++
    resetMatchState()

    if (currentPairIdx.value < prog.pairs.length - 1) {
      currentPairIdx.value++
      return 'next'
    }

    if (prog.loop) {
      currentPairIdx.value = 0
      loopCount.value++
      return 'looped'
    }

    return 'finished'
  }

  function skipPair() {
    totalAttempts.value++
    streak.value = 0
    advancePair()
  }

  function stopProgression() {
    activeProgressionId.value = null
    resetMatchState()
  }

  return {
    // State
    activeProgressionId,
    activeProgression,
    currentPairIdx,
    currentPair,
    isLastPair,
    loopCount,
    totalPairsPlayed,
    matchState,
    correctPairs,
    totalAttempts,
    streak,
    maxStreak,
    accuracy,
    difficultyFilter,
    filteredProgressions,
    // Actions
    startProgression,
    resetMatchState,
    onNoteOn,
    onNoteOff,
    advancePair,
    skipPair,
    stopProgression,
  }
})
