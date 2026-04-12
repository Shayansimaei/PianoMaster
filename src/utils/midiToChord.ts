// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChordResult {
  /** Individual note labels, sorted low → high, e.g. ["C4", "E4", "G4"] */
  notes: string[]
  /** Chord name, e.g. "C Major", "A Minor 7th", "Unknown" */
  chord: string
  /** Root note name, e.g. "C" */
  root: string | null
  /** Chord quality, e.g. "Major", "Minor 7th" */
  quality: string | null
  /** Interval pattern as semitone offsets from root, e.g. [0, 4, 7] */
  intervals: number[]
}

// ─── Note names ────────────────────────────────────────────────────────────

const SHARP_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

// ─── Chord interval patterns ───────────────────────────────────────────────
// [name, semitone intervals above root — root (0) is implicit]

const CHORD_PATTERNS: [string, number[]][] = [
  // Triads
  ['Major',               [4, 7]],
  ['Minor',               [3, 7]],
  ['Diminished',          [3, 6]],
  ['Augmented',           [4, 8]],
  ['Suspended 2nd',       [2, 7]],
  ['Suspended 4th',       [5, 7]],
  // 6ths
  ['Major 6th',           [4, 7, 9]],
  ['Minor 6th',           [3, 7, 9]],
  // 7ths
  ['Major 7th',           [4, 7, 11]],
  ['Dominant 7th',        [4, 7, 10]],
  ['Minor 7th',           [3, 7, 10]],
  ['Minor Major 7th',     [3, 7, 11]],
  ['Half Diminished 7th', [3, 6, 10]],
  ['Diminished 7th',      [3, 6,  9]],
  ['Augmented 7th',       [4, 8, 10]],
  ['Augmented Major 7th', [4, 8, 11]],
  // 9ths
  ['Major 9th',           [4, 7, 11, 14]],
  ['Dominant 9th',        [4, 7, 10, 14]],
  ['Minor 9th',           [3, 7, 10, 14]],
  ['Add 9',               [4, 7, 14]],
  ['Minor Add 9',         [3, 7, 14]],
  // 11th & 13th
  ['Dominant 11th',       [4, 7, 10, 14, 17]],
  ['Dominant 13th',       [4, 7, 10, 14, 17, 21]],
  // Power chord
  ['Power',               [7]],
  // Dyads / intervals
  ['Minor 2nd',  [1]],  ['Major 2nd',  [2]],
  ['Minor 3rd',  [3]],  ['Major 3rd',  [4]],
  ['Perfect 4th',[5]],  ['Tritone',    [6]],
  ['Perfect 5th',[7]],  ['Minor 6th',  [8]],
  ['Major 6th',  [9]],  ['Minor 7th', [10]],
  ['Major 7th', [11]],  ['Octave',    [12]],
]

// ─── Helpers ───────────────────────────────────────────────────────────────

function midiToLabel(midi: number): string {
  const name   = SHARP_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

// ─── Main functions ────────────────────────────────────────────────────────

/**
 * Convert MIDI note numbers → note labels + chord name.
 *
 * @example
 * midiToChord([60, 64, 67])
 * // { notes: ["C4","E4","G4"], chord: "C Major", root: "C", quality: "Major", intervals: [0,4,7] }
 *
 * midiToChord([60, 63, 67, 70])
 * // { notes: ["C4","Eb4","G4","Bb4"], chord: "C Minor 7th", ... }
 *
 * midiToChord([60])
 * // { notes: ["C4"], chord: "C", root: "C", quality: null, intervals: [0] }
 *
 * midiToChord([])
 * // { notes: [], chord: "—", root: null, quality: null, intervals: [] }
 */
export function midiToChord(midiNotes: number[]): ChordResult {
  if (midiNotes.length === 0) {
    return { notes: [], chord: '—', root: null, quality: null, intervals: [] }
  }

  const sorted = [...midiNotes].sort((a, b) => a - b)
  const notes  = sorted.map(midiToLabel)

  if (sorted.length === 1) {
    const root = SHARP_NAMES[sorted[0] % 12]
    return { notes, chord: root, root, quality: null, intervals: [0] }
  }

  // Unique pitch classes
  const pitchClasses = [...new Set(sorted.map(m => m % 12))]

  // Try every pitch class as the root to handle all inversions
  for (const candidateRoot of pitchClasses) {
    const intervals = [...new Set(
      pitchClasses.map(pc => ((pc - candidateRoot) + 12) % 12)
    )].sort((a, b) => a - b)

    const pattern = intervals.filter(i => i !== 0)

    const match = CHORD_PATTERNS.find(([, p]) =>
      p.length === pattern.length && p.every((v, i) => v === pattern[i])
    )

    if (match) {
      const root    = SHARP_NAMES[candidateRoot]
      const quality = match[0]
      return { notes, chord: `${root} ${quality}`, root, quality, intervals: [0, ...pattern] }
    }
  }

  // No match — return pitch classes as a hint
  const root        = SHARP_NAMES[sorted[0] % 12]
  const allPitches  = pitchClasses.map(pc => SHARP_NAMES[pc]).join('-')
  return {
    notes,
    chord: `Unknown (${allPitches})`,
    root,
    quality: null,
    intervals: pitchClasses
      .map(pc => ((pc - (sorted[0] % 12)) + 12) % 12)
      .sort((a, b) => a - b),
  }
}

/**
 * Same as midiToChord but accepts a Set<number> directly.
 * Useful when working with activeNotes from the MIDI store.
 *
 * @example
 * chordFromSet(new Set([60, 64, 67]))
 * // { notes: ["C4","E4","G4"], chord: "C Major", ... }
 */
export function chordFromSet(midiSet: Set<number>): ChordResult {
  return midiToChord([...midiSet])
}
