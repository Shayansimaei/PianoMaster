import type { NoteInfo, NoteName, MatchResult, NoteMatch } from '@/types'

// ─── Constants ─────────────────────────────────────────────────────────────

export const NOTE_NAMES: NoteName[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
]

export const ENHARMONIC: Record<string, string> = {
  'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'
}

const BLACK_KEY_INDICES = new Set([1, 3, 6, 8, 10]) // C#, D#, F#, G#, A#

// MIDI note 69 = A4 = 440 Hz
export const midiToFrequency = (midi: number): number =>
  440 * Math.pow(2, (midi - 69) / 12)

// ─── Core conversion ───────────────────────────────────────────────────────

export function midiToNoteInfo(midi: number): NoteInfo {
  const semitone = midi % 12
  const octave = Math.floor(midi / 12) - 1
  const name = NOTE_NAMES[semitone]
  return {
    midi,
    name,
    octave,
    label: `${name}${octave}`,
    frequency: midiToFrequency(midi),
    isBlack: BLACK_KEY_INDICES.has(semitone),
  }
}

export function noteToMidi(name: NoteName, octave: number): number {
  const semitone = NOTE_NAMES.indexOf(name)
  return (octave + 1) * 12 + semitone
}

export function noteNameFromMidi(midi: number): string {
  return midiToNoteInfo(midi).label
}

// ─── Matching ──────────────────────────────────────────────────────────────

export function matchNotes(played: number | null, target: number | null): NoteMatch {
  if (played === null || target === null) {
    return { played: null, target: target ? midiToNoteInfo(target) : null, result: 'idle' }
  }

  const playedInfo = midiToNoteInfo(played)
  const targetInfo = midiToNoteInfo(target)

  let result: MatchResult = 'idle'
  if (played === target) {
    result = 'correct'
  } else if (played % 12 === target % 12) {
    result = 'octave-off'
  } else {
    result = 'wrong'
  }

  return {
    played: playedInfo,
    target: targetInfo,
    result,
    centsDiff: (played - target) * 100,
  }
}

// ─── Piano keyboard layout ─────────────────────────────────────────────────

export interface KeyLayout {
  midi: number
  note: NoteInfo
  whiteIndex: number   // position among white keys
  isBlack: boolean
  leftOffset: number   // % from left in octave
}

const WHITE_KEY_OFFSETS = [0, 1, 2, 3, 4, 5, 6]          // C D E F G A B
const BLACK_KEY_OFFSETS: Record<number, number> = {
  1: 0.6,   // C#
  3: 1.6,   // D#
  6: 3.55,  // F#
  8: 4.55,  // G#
  10: 5.55, // A#
}

export function buildKeyboardLayout(startMidi: number, endMidi: number): KeyLayout[] {
  const keys: KeyLayout[] = []
  let whiteCount = 0

  for (let midi = startMidi; midi <= endMidi; midi++) {
    const note = midiToNoteInfo(midi)
    const semitone = midi % 12
    const octaveStart = Math.floor((midi - startMidi) / 12)
    const whiteOffset = octaveStart * 7

    if (!note.isBlack) {
      const localWhiteIdx = [0, 1, 2, 3, 4, 5, 6].findIndex(
        (_, i) => [0, 2, 4, 5, 7, 9, 11][i] === semitone
      )
      keys.push({
        midi,
        note,
        whiteIndex: whiteCount,
        isBlack: false,
        leftOffset: whiteCount,
      })
      whiteCount++
    } else {
      const octaveLocalOffset = BLACK_KEY_OFFSETS[semitone] ?? 0
      keys.push({
        midi,
        note,
        whiteIndex: -1,
        isBlack: true,
        leftOffset: whiteOffset + octaveLocalOffset,
      })
    }
  }

  return keys
}

// Total white keys in range
export function countWhiteKeys(startMidi: number, endMidi: number): number {
  let count = 0
  for (let m = startMidi; m <= endMidi; m++) {
    if (!midiToNoteInfo(m).isBlack) count++
  }
  return count
}

// ─── Scales & intervals ────────────────────────────────────────────────────

export const SCALES: Record<string, number[]> = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  naturalMinor:     [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor:    [0, 2, 3, 5, 7, 8, 11],
  pentatonicMajor:  [0, 2, 4, 7, 9],
  pentatonicMinor:  [0, 3, 5, 7, 10],
  blues:            [0, 3, 5, 6, 7, 10],
  chromatic:        [0,1,2,3,4,5,6,7,8,9,10,11],
}

export function getScaleNotes(rootMidi: number, scaleName: keyof typeof SCALES, octaves = 1): number[] {
  const intervals = SCALES[scaleName]
  const notes: number[] = []
  for (let oct = 0; oct < octaves; oct++) {
    for (const interval of intervals) {
      const midi = rootMidi + oct * 12 + interval
      if (midi <= 127) notes.push(midi)
    }
  }
  return notes
}
