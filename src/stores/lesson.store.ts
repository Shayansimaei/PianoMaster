import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Lesson, LessonStep, ChordDef, ChordCategory } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// CHORD CATALOG
// All notes anchored around octave 4 (MIDI 60 = C4).
// Enharmonic equivalents resolved to the nearest MIDI value.
// ─────────────────────────────────────────────────────────────────────────────

// Root MIDI offsets from C4 (60)
const ROOT: Record<string, number> = {
  'C': 60, 'C#': 61, 'Db': 61,
  'D': 62, 'D#': 63, 'Eb': 63,
  'E': 64, 'F': 65,
  'F#': 66, 'Gb': 66,
  'G': 67, 'G#': 68, 'Ab': 68,
  'A': 69, 'A#': 70, 'Bb': 70,
  'B': 71,
}

// Semitone intervals for each chord quality
const INTERVALS: Record<ChordCategory, number[]> = {
  major:      [0, 4, 7],
  minor:      [0, 3, 7],
  diminished: [0, 3, 6],
  major7:     [0, 4, 7, 11],
  dominant7:  [0, 4, 7, 10],
  minor7:     [0, 3, 7, 10],
  minor7b5:   [0, 3, 6, 10],
}

// Human-readable labels
const CAT_LABEL: Record<ChordCategory, string> = {
  major:      'Major',
  minor:      'Minor',
  diminished: 'Diminished',
  major7:     'Major 7th',
  dominant7:  'Dominant 7th',
  minor7:     'Minor 7th',
  minor7b5:   'Minor 7th ♭5',
}

const CAT_SHORT: Record<ChordCategory, string> = {
  major:      'maj',
  minor:      'min',
  diminished: 'dim',
  major7:     'maj7',
  dominant7:  '7',
  minor7:     'min7',
  minor7b5:   'min7♭5',
}

// Which major keys each chord quality root belongs to
// Used for harmonic progression generation (circle of fifths logic)
// Format: root → list of major key roots it naturally functions in
const DIATONIC_FUNCTION: Partial<Record<string, string[]>> = {
  'C':  ['C','F','G','Am','Dm','Em'],
  'D':  ['G','D','A','Bm','Em','F#m'],
  'E':  ['A','E','B','C#m','F#m','G#m'],
  'F':  ['F','Bb','C','Dm','Gm','Am'],
  'G':  ['C','G','D','Em','Am','Bm'],
  'A':  ['D','A','E','F#m','Bm','C#m'],
  'B':  ['E','B','F#','G#m','C#m','D#m'],
  'C#': ['F#','C#','G#','A#m','D#m','E#m'],
  'Eb': ['Ab','Eb','Bb','Cm','Fm','Gm'],
  'F#': ['B','F#','C#','G#m','C#m','D#m'],
  'Ab': ['Db','Ab','Eb','Fm','Bbm','Cm'],
  'Bb': ['Eb','Bb','F','Gm','Cm','Dm'],
}

function buildChord(root: string, category: ChordCategory): ChordDef {
  const rootMidi = ROOT[root] ?? 60
  const intervals = INTERVALS[category]
  const notes = intervals.map(i => rootMidi + i)
  return {
    id: `${root}-${category}`,
    root,
    category,
    label: `${root} ${CAT_LABEL[category]}`,
    shortLabel: `${root}${CAT_SHORT[category]}`,
    notes,
    relatedKeys: DIATONIC_FUNCTION[root] ?? [],
  }
}

// ─── Full chord catalog — 84 chords ─────────────────────────────────────────

const ROOTS_MAJOR_ORDER = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']

export const CHORD_CATALOG: ChordDef[] = [
  // Major triads (12)
  ...ROOTS_MAJOR_ORDER.map(r => buildChord(r, 'major')),
  // Minor triads (12)
  ...ROOTS_MAJOR_ORDER.map(r => buildChord(r, 'minor')),
  // Diminished triads (12)
  ...ROOTS_MAJOR_ORDER.map(r => buildChord(r, 'diminished')),
  // Major 7th (12)
  ...ROOTS_MAJOR_ORDER.map(r => buildChord(r, 'major7')),
  // Dominant 7th (12)
  ...ROOTS_MAJOR_ORDER.map(r => buildChord(r, 'dominant7')),
  // Minor 7th (12)
  ...ROOTS_MAJOR_ORDER.map(r => buildChord(r, 'minor7')),
  // Minor 7th ♭5 / half-diminished (12)
  ...ROOTS_MAJOR_ORDER.map(r => buildChord(r, 'minor7b5')),
]

export function chordById(id: string): ChordDef | undefined {
  return CHORD_CATALOG.find(c => c.id === id)
}

// ─────────────────────────────────────────────────────────────────────────────
// HARMONIC PROGRESSION ENGINE
//
// Generates musically coherent chord sequences using:
// 1. Circle of fifths proximity (chords a 5th apart sound smooth)
// 2. Common tone retention (chords sharing notes feel connected)
// 3. Functional harmonic motion (I→IV→V→I, ii→V→I, etc.)
// ─────────────────────────────────────────────────────────────────────────────

// Semitone distance on circle of fifths (0 = same key, 1 = one fifth away)
function fifthsDistance(rootA: string, rootB: string): number {
  const FIFTHS_ORDER = ['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F']
  const a = FIFTHS_ORDER.indexOf(
    ROOTS_MAJOR_ORDER.find(r => ROOT[r] === ROOT[rootA]) ?? 'C'
  )
  const b = FIFTHS_ORDER.indexOf(
    ROOTS_MAJOR_ORDER.find(r => ROOT[r] === ROOT[rootB]) ?? 'C'
  )
  if (a === -1 || b === -1) return 6
  return Math.min(Math.abs(a - b), 12 - Math.abs(a - b))
}

// Count shared MIDI pitch classes between two chords
function commonTones(a: ChordDef, b: ChordDef): number {
  const pcA = new Set(a.notes.map(n => n % 12))
  return b.notes.filter(n => pcA.has(n % 12)).length
}

// Score how well chord B follows chord A — higher = more harmonically natural
function progressionScore(a: ChordDef, b: ChordDef): number {
  if (a.id === b.id) return -100  // no repeats

  let score = 0

  // Common tones — strong glue
  score += commonTones(a, b) * 15

  // Circle of fifths proximity
  const fd = fifthsDistance(a.root, b.root)
  score += (6 - fd) * 8

  // Functional motion bonuses
  const aRoot = ROOT[a.root] % 12
  const bRoot = ROOT[b.root] % 12
  const interval = (bRoot - aRoot + 12) % 12

  // Dominant → tonic resolution (V→I = 7 semitones down, or 5 up)
  if (interval === 5) score += 25   // up a fourth (most natural resolution)
  if (interval === 7) score += 15   // up a fifth
  if (interval === 2) score += 10   // whole step up (ii→iii, VI→VII)
  if (interval === 9) score += 10   // minor 7th up (often feels right)

  // Category-based bonuses
  // dominant7 → major resolves beautifully
  if (a.category === 'dominant7' && b.category === 'major' && interval === 5) score += 30
  // minor7b5 → dominant7 (ii°7 → V7)
  if (a.category === 'minor7b5' && b.category === 'dominant7' && interval === 5) score += 25
  // minor → major of same root (parallel major shift — dramatic)
  if (a.root === b.root && a.category === 'minor' && b.category === 'major') score += 12

  return score
}

// Build a harmonically ordered sequence of N chords from a pool
export function buildProgression(pool: ChordDef[], length: number, seed?: ChordDef): ChordDef[] {
  if (pool.length === 0) return []
  if (pool.length === 1) return Array(length).fill(pool[0])

  const result: ChordDef[] = []
  const available = [...pool]

  // Start with seed or the chord with most connections
  let current = seed ?? available[Math.floor(available.length / 3)]
  result.push(current)

  for (let i = 1; i < length; i++) {
    // Score all remaining candidates
    const candidates = available.filter(c => c.id !== current.id)
    if (candidates.length === 0) break

    // Sort by harmonic score, add small random noise to avoid rigid repetition
    const scored = candidates.map(c => ({
      chord: c,
      score: progressionScore(current, c) + (Math.random() * 8 - 4),
    }))
    scored.sort((a, b) => b.score - a.score)

    // Pick from top 3 to keep variety
    const topN = scored.slice(0, Math.min(3, scored.length))
    current = topN[Math.floor(Math.random() * topN.length)].chord
    result.push(current)
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// LESSON STEP BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function singleNoteSteps(midis: number[]): LessonStep[] {
  return midis.map((note, i) => ({
    id: `step-${i}`,
    targetNotes: [note],
    durationMs: 0,
  }))
}

function chordSteps(chords: ChordDef[], hint?: (c: ChordDef, i: number) => string | undefined): LessonStep[] {
  return chords.map((chord, i) => ({
    id: `step-${i}`,
    targetNotes: chord.notes,
    durationMs: 0,
    hint: hint?.(chord, i),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// LESSON CATALOG
// ─────────────────────────────────────────────────────────────────────────────

function getCat(category: ChordCategory) {
  return CHORD_CATALOG.filter(c => c.category === category)
}

function getRoot(root: string) {
  return CHORD_CATALOG.filter(c => c.root === root)
}

function makeChordLesson(
  id: string,
  title: string,
  description: string,
  difficulty: Lesson['difficulty'],
  tags: string[],
  chords: ChordDef[],
  firstHint?: string,
): Lesson {
  return {
    id,
    title,
    description,
    difficulty,
    status: 'available',
    tags: ['chords', ...tags],
    isChordLesson: true,
    steps: chordSteps(chords, (c, i) =>
      i === 0 ? (firstHint ?? `Play ${c.label}`) : undefined
    ),
  }
}

// ─── Helper: harmonic progression lesson from a category ─────────────────────
function progressionLesson(
  id: string,
  title: string,
  desc: string,
  difficulty: Lesson['difficulty'],
  tags: string[],
  pool: ChordDef[],
  length = 8,
  seed?: ChordDef,
): Lesson {
  const chords = buildProgression(pool, length, seed)
  return makeChordLesson(id, title, desc, difficulty, tags, chords)
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL CATALOG DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

const ALL_MAJOR   = getCat('major')
const ALL_MINOR   = getCat('minor')
const ALL_DIM     = getCat('diminished')
const ALL_MAJ7    = getCat('major7')
const ALL_DOM7    = getCat('dominant7')
const ALL_MIN7    = getCat('minor7')
const ALL_MIN7B5  = getCat('minor7b5')

// Shorthand chord lookups
const chord = (root: string, cat: ChordCategory) =>
  CHORD_CATALOG.find(c => c.root === root && c.category === cat)!

// ─── I. Single note fundamentals (unchanged, kept for progression) ────────────
const FUNDAMENTALS: Lesson[] = [
  {
    id: 'single-notes-c',
    title: 'Middle C & Friends',
    description: 'Learn the five notes around Middle C. Perfect starting point.',
    difficulty: 'beginner',
    status: 'available',
    tags: ['basics', 'single notes'],
    steps: singleNoteSteps([60, 62, 64, 65, 67]),
  },
  {
    id: 'c-major-scale',
    title: 'C Major Scale',
    description: 'Ascend and descend the C major scale — the foundation of Western music.',
    difficulty: 'beginner',
    status: 'available',
    tags: ['scales', 'C major'],
    steps: singleNoteSteps([60,62,64,65,67,69,71,72,71,69,67,65,64,62,60]),
  },
  {
    id: 'chromatic-exercise',
    title: 'Chromatic Warm-Up',
    description: 'Every semitone from C4 to C5.',
    difficulty: 'intermediate',
    status: 'available',
    tags: ['technique'],
    steps: singleNoteSteps(Array.from({length:13},(_,i)=>60+i)),
  },
]

// ─── II. Individual chord lessons — one per chord type ───────────────────────
// Each teaches all 12 roots of a given quality in circle-of-fifths order
const FIFTHS_ORDER = ['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F']

function allRootsLesson(cat: ChordCategory, difficulty: Lesson['difficulty']): Lesson {
  const chords = FIFTHS_ORDER.map(r => {
    // Map enharmonic: Db→C#, Ab stays Ab, Eb stays Eb, Bb stays Bb, F#→F#
    const canonical = (['Db','Ab','Eb','Bb'].includes(r)) ? r : r
    return CHORD_CATALOG.find(c => c.root === canonical && c.category === cat)
      ?? CHORD_CATALOG.find(c => c.root === r && c.category === cat)!
  }).filter(Boolean) as ChordDef[]

  return makeChordLesson(
    `all-${cat}`,
    `All 12 ${CAT_LABEL[cat]} Chords`,
    `Play every ${CAT_LABEL[cat]} chord around the circle of fifths.`,
    difficulty,
    [cat],
    chords,
    `Start with ${chords[0].label}`,
  )
}

const ALL_ROOTS_LESSONS: Lesson[] = [
  allRootsLesson('major',      'beginner'),
  allRootsLesson('minor',      'beginner'),
  allRootsLesson('diminished', 'intermediate'),
  allRootsLesson('major7',     'intermediate'),
  allRootsLesson('dominant7',  'intermediate'),
  allRootsLesson('minor7',     'intermediate'),
  allRootsLesson('minor7b5',   'advanced'),
]

// ─── III. Per-root lessons — all chord types on a single root ────────────────
function rootLesson(root: string): Lesson {
  const chords = getRoot(root)
  // Order: maj → min → dim → maj7 → dom7 → min7 → min7b5
  const ordered: ChordDef[] = []
  for (const cat of ['major','minor','diminished','major7','dominant7','minor7','minor7b5'] as ChordCategory[]) {
    const c = chords.find(c => c.category === cat)
    if (c) ordered.push(c)
  }
  const hasSharps = root.includes('#')
  const hasFlats  = root.includes('b')
  const diff: Lesson['difficulty'] = hasSharps || hasFlats ? 'intermediate' : 'beginner'
  return makeChordLesson(
    `root-${root.replace('#','sharp').replace('b','flat')}`,
    `${root} — All Chord Types`,
    `Master all 7 chord qualities built on ${root}: triad, diminished, and all 7th variants.`,
    diff,
    ['per-root', root],
    ordered,
    `${root} Major — your home base`,
  )
}

const PER_ROOT_LESSONS: Lesson[] = ROOTS_MAJOR_ORDER.map(rootLesson)

// ─── IV. Harmonic progression lessons ────────────────────────────────────────
// Chords are ordered by the progression engine — musically coherent sequences

// I–IV–V in major (the backbone of pop/rock)
function iIVVLesson(key: string): Lesson {
  const majorScale = [0, 2, 4, 5, 7, 9, 11]  // degrees in semitones
  const keyRoot = ROOT[key] % 12
  // Build I, IV, V from the major scale
  const I   = CHORD_CATALOG.find(c => ROOT[c.root] % 12 === keyRoot && c.category === 'major')!
  const IV  = CHORD_CATALOG.find(c => ROOT[c.root] % 12 === (keyRoot + 5) % 12 && c.category === 'major')!
  const V   = CHORD_CATALOG.find(c => ROOT[c.root] % 12 === (keyRoot + 7) % 12 && c.category === 'major')!
  const vi  = CHORD_CATALOG.find(c => ROOT[c.root] % 12 === (keyRoot + 9) % 12 && c.category === 'minor')!
  const ii  = CHORD_CATALOG.find(c => ROOT[c.root] % 12 === (keyRoot + 2) % 12 && c.category === 'minor')!

  if (!I || !IV || !V || !vi || !ii) return null!

  // I–V–vi–IV (most common pop progression)
  const progression = [I, V, vi, IV, I, V, vi, IV].filter(Boolean)

  return makeChordLesson(
    `prog-iivv-${key.replace('#','sharp').replace('b','flat')}`,
    `${key} — I–V–vi–IV Progression`,
    `The most common progression in pop music. ${I.shortLabel}–${V.shortLabel}–${vi.shortLabel}–${IV.shortLabel} repeated.`,
    'beginner',
    ['progression', 'pop', key],
    progression,
    `${I.label} — this is your I (tonic) chord`,
  )
}

const IIVV_LESSONS = ['C','G','D','F','A','E'].map(iIVVLesson).filter(Boolean)

// ii–V–I jazz progressions
function iiVILesson(key: string): Lesson {
  const keyRoot = ROOT[key] % 12
  const ii  = CHORD_CATALOG.find(c => ROOT[c.root] % 12 === (keyRoot + 2) % 12 && c.category === 'minor7')!
  const V7  = CHORD_CATALOG.find(c => ROOT[c.root] % 12 === (keyRoot + 7) % 12 && c.category === 'dominant7')!
  const Imaj7 = CHORD_CATALOG.find(c => ROOT[c.root] % 12 === keyRoot && c.category === 'major7')!

  if (!ii || !V7 || !Imaj7) return null!

  const progression = [ii, V7, Imaj7, ii, V7, Imaj7, V7, Imaj7]

  return makeChordLesson(
    `prog-iivi-${key.replace('#','sharp').replace('b','flat')}`,
    `${key} — ii–V–I Jazz`,
    `The foundational jazz progression. ${ii.shortLabel}–${V7.shortLabel}–${Imaj7.shortLabel}.`,
    'advanced',
    ['jazz', 'progression', key],
    progression,
    `${ii.label} — the ii chord, tension begins`,
  )
}

const IIVI_LESSONS = ['C','F','G','D','Bb','Eb'].map(iiVILesson).filter(Boolean)

// Mixed category harmonically shuffled progressions
const MIXED_PROGRESSIONS: Lesson[] = [
  progressionLesson(
    'prog-major-harmonic',
    'Major Chords — Harmonic Flow',
    'All 12 major chords arranged by harmonic proximity. Circle of fifths in action.',
    'beginner',
    ['major', 'progression', 'circle-of-fifths'],
    ALL_MAJOR, 12, chord('C','major'),
  ),
  progressionLesson(
    'prog-minor-harmonic',
    'Minor Chords — Harmonic Flow',
    'All 12 minor chords in a musically natural sequence.',
    'beginner',
    ['minor', 'progression'],
    ALL_MINOR, 12, chord('A','minor'),
  ),
  progressionLesson(
    'prog-dim-tension',
    'Diminished — Tension & Release',
    'Diminished chords resolve naturally into major or dominant chords. Explore the tension.',
    'intermediate',
    ['diminished', 'tension'],
    [...ALL_DIM, ...ALL_DOM7.slice(0,6)], 12, chord('B','diminished'),
  ),
  progressionLesson(
    'prog-maj7-lush',
    'Major 7ths — Lush Harmony',
    'Major 7th chords sound rich and jazzy. A flowing sequence through all 12 roots.',
    'intermediate',
    ['major7', 'jazz'],
    ALL_MAJ7, 12, chord('C','major7'),
  ),
  progressionLesson(
    'prog-dom7-blues',
    'Dominant 7ths — Blues Backbone',
    'Dominant 7th chords are the soul of blues and jazz. All 12 roots in motion.',
    'intermediate',
    ['dominant7', 'blues', 'jazz'],
    ALL_DOM7, 12, chord('G','dominant7'),
  ),
  progressionLesson(
    'prog-min7-soul',
    'Minor 7ths — Soul & R&B',
    'Minor 7ths are the foundation of soul, R&B, and modal jazz.',
    'intermediate',
    ['minor7', 'soul', 'jazz'],
    ALL_MIN7, 12, chord('D','minor7'),
  ),
  progressionLesson(
    'prog-min7b5-tension',
    'Half-Diminished — Maximum Tension',
    'Minor 7♭5 (half-diminished) chords create strong pull toward resolution.',
    'advanced',
    ['minor7b5', 'jazz'],
    ALL_MIN7B5, 12, chord('B','minor7b5'),
  ),
  // Grand mixed progression — all 84 chords grouped harmonically
  progressionLesson(
    'prog-grand-tour',
    'Grand Harmonic Tour',
    'All 84 chords in a single harmonically coherent journey. The ultimate challenge.',
    'advanced',
    ['all-chords', 'marathon'],
    CHORD_CATALOG, 84, chord('C','major'),
  ),
  // Triads + 7ths mixed in natural keys
  progressionLesson(
    'prog-c-key-full',
    'Key of C — Full Harmony',
    'Major, minor, and 7th chords that naturally belong to the key of C.',
    'intermediate',
    ['key-of-C', 'mixed'],
    [
      chord('C','major'), chord('D','minor'), chord('E','minor'),
      chord('F','major'), chord('G','major'), chord('A','minor'),
      chord('G','dominant7'), chord('C','major7'), chord('F','major7'),
      chord('D','minor7'), chord('E','minor7'), chord('A','minor7'),
      chord('B','minor7b5'),
    ],
    13, chord('C','major'),
  ),
  progressionLesson(
    'prog-g-key-full',
    'Key of G — Full Harmony',
    'All the natural diatonic chords of the key of G.',
    'intermediate',
    ['key-of-G', 'mixed'],
    [
      chord('G','major'), chord('A','minor'), chord('B','minor'),
      chord('C','major'), chord('D','major'), chord('E','minor'),
      chord('D','dominant7'), chord('G','major7'), chord('C','major7'),
      chord('A','minor7'), chord('E','minor7'), chord('B','minor7b5'),
    ],
    12, chord('G','major'),
  ),
]

// ─── V. Comparison lessons — same root, different qualities ──────────────────
// Great for ear training: hear major vs minor vs diminished side by side

function comparisonLesson(root: string): Lesson {
  const maj   = chord(root, 'major')
  const min   = chord(root, 'minor')
  const dim   = chord(root, 'diminished')
  const maj7  = chord(root, 'major7')
  const dom7  = chord(root, 'dominant7')
  const min7  = chord(root, 'minor7')
  const hd    = chord(root, 'minor7b5')

  const chords = [maj, min, maj, dim, maj, min7, dom7, maj7, hd, maj].filter(Boolean)

  return makeChordLesson(
    `compare-${root.replace('#','sharp').replace('b','flat')}`,
    `${root} — Hear the Difference`,
    `Play all chord qualities on ${root} back-to-back. Train your ear to hear major vs minor vs diminished.`,
    'intermediate',
    ['ear-training', 'comparison', root],
    chords,
    `${maj.label} — bright and stable`,
  )
}

const COMPARISON_LESSONS = ['C','G','D','A','E','F','Bb'].map(comparisonLesson)

// ─────────────────────────────────────────────────────────────────────────────
// FULL CATALOG
// ─────────────────────────────────────────────────────────────────────────────

const CATALOG: Lesson[] = [
  ...FUNDAMENTALS,
  ...ALL_ROOTS_LESSONS,
  ...PER_ROOT_LESSONS,
  ...IIVV_LESSONS,
  ...IIVI_LESSONS,
  ...MIXED_PROGRESSIONS,
  ...COMPARISON_LESSONS,
].filter(Boolean)

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useLessonStore = defineStore('lessons', () => {
  const lessons      = ref<Lesson[]>(CATALOG)
  const currentLessonId  = ref<string | null>(null)
  const currentStepIndex = ref(0)
  const score        = ref(0)
  const attempts     = ref(0)

  const currentLesson = computed(() =>
    lessons.value.find(l => l.id === currentLessonId.value) ?? null
  )

  const currentStep = computed((): LessonStep | null => {
    if (!currentLesson.value) return null
    return currentLesson.value.steps[currentStepIndex.value] ?? null
  })

  const progressPercent = computed(() => {
    if (!currentLesson.value) return 0
    return Math.round((currentStepIndex.value / currentLesson.value.steps.length) * 100)
  })

  const isComplete = computed(() => {
    if (!currentLesson.value) return false
    return currentStepIndex.value >= currentLesson.value.steps.length
  })

  function startLesson(id: string) {
    currentLessonId.value  = id
    currentStepIndex.value = 0
    score.value    = 0
    attempts.value = 0
    const lesson = lessons.value.find(l => l.id === id)
    if (lesson) lesson.status = 'in-progress'
  }

  function nextStep() {
    currentStepIndex.value++
  }
  function lastStep() {
    currentStepIndex.value--
  }

  function recordAttempt(correct: boolean) {
    attempts.value++
    if (correct) score.value++
  }

  function completeLesson() {
    if (!currentLesson.value) return
    const finalScore = attempts.value > 0
      ? Math.round((score.value / attempts.value) * 100)
      : 0
    const lesson = lessons.value.find(l => l.id === currentLessonId.value)
    if (lesson) {
      lesson.status = 'completed'
      lesson.completedAt = new Date().toISOString()
      lesson.highScore = Math.max(lesson.highScore ?? 0, finalScore)
    }
    currentLessonId.value = null
  }

  function resetLesson() {
    currentLessonId.value  = null
    currentStepIndex.value = 0
    score.value    = 0
    attempts.value = 0
  }

  return {
    lessons,
    currentLessonId,
    currentStepIndex,
    score,
    attempts,
    currentLesson,
    currentStep,
    progressPercent,
    isComplete,
    startLesson,
    nextStep,
    lastStep,
    recordAttempt,
    completeLesson,
    resetLesson,
  }
})
