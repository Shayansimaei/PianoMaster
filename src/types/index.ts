// ─── MIDI ──────────────────────────────────────────────────────────────────

export interface MidiDevice {
  id: string
  name: string
  manufacturer: string
  state: 'connected' | 'disconnected'
  type: 'input' | 'output'
}

export interface MidiEvent {
  note: number        // 0–127
  velocity: number    // 0–127
  type: 'noteOn' | 'noteOff'
  channel: number     // 0–15
  timestamp: number
  device: string
}

// ─── MUSIC THEORY ──────────────────────────────────────────────────────────

export type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'
export type Accidental = 'sharp' | 'flat' | 'natural'

export interface NoteInfo {
  midi: number          // 0–127
  name: NoteName        // e.g. "C#"
  octave: number        // e.g. 4
  label: string         // e.g. "C#4"
  frequency: number     // Hz
  isBlack: boolean      // piano key type
}

export type MatchResult = 'correct' | 'wrong' | 'octave-off' | 'idle'

export interface NoteMatch {
  played: NoteInfo | null
  target: NoteInfo | null
  result: MatchResult
  centsDiff?: number
}

// ─── LESSONS ───────────────────────────────────────────────────────────────

export type LessonDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type LessonStatus = 'locked' | 'available' | 'in-progress' | 'completed'

export interface LessonStep {
  id: string
  targetNotes: number[]   // one or more MIDI notes (chord if >1)
  durationMs: number      // how long to hold (0 = just hit)
  hint?: string
}

export type ChordCategory = 'major' | 'minor' | 'diminished' | 'major7' | 'dominant7' | 'minor7' | 'minor7b5'

export interface ChordDef {
  id: string
  root: string            // e.g. 'C', 'F#'
  category: ChordCategory
  label: string           // e.g. 'C Major'
  shortLabel: string      // e.g. 'Cmaj'
  notes: number[]         // MIDI note numbers (root octave 4 area)
  // Harmonic relationships for progression building
  relatedKeys: string[]   // keys this chord belongs to (for progression logic)
}

export interface Lesson {
  id: string
  title: string
  description: string
  difficulty: LessonDifficulty
  status: LessonStatus
  steps: LessonStep[]
  bpm?: number
  tags: string[]
  completedAt?: string
  highScore?: number      // 0–100
  isChordLesson?: boolean // true = steps are chords not single notes
}

// ─── SHEET MUSIC ───────────────────────────────────────────────────────────

export interface SheetNote {
  id: string
  midi: number
  startBeat: number
  durationBeats: number
  hand: 'left' | 'right'
}

export interface SheetMeasure {
  number: number
  notes: SheetNote[]
}

export interface SheetPiece {
  id: string
  title: string
  composer: string
  bpm: number
  timeSignature: [number, number]   // e.g. [4, 4]
  keySignature: number              // semitones from C
  measures: SheetMeasure[]
}

// ─── AUDIO ─────────────────────────────────────────────────────────────────

export interface SamplerState {
  loaded: boolean
  loading: boolean
  error: string | null
  activeNotes: Set<number>
}

// ─── APP STATE ─────────────────────────────────────────────────────────────

export type AppMode = 'free-play' | 'lesson' | 'sheet-music'