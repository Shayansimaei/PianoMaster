import type { SheetPiece, SheetMeasure, SheetNote } from '@/types'

// ─── Format spec ──────────────────────────────────────────────────────────────
//
// Notes:   <NoteName><Octave>   e.g.  A3  C#4  F#5  Bb3
// Chords:  [<note><note>...]    e.g.  [A3D4]  [A3C#4F#4]
// "ı" after a note/chord = dotted (1.5x duration, ignored in step mode)
// Spaces or newlines separate beats.
// Lines separate left hand / right hand (first line = right, second = left)
// BPM and time signature are optional first tokens:
//   BPM=120  or  4/4  anywhere before notes
//
// Examples:
//   [A3D4ı] G6F6G6A6 [A3C#4F#4]
//   D4 D5A5F5 D5A5F5

// ─── Note name → semitone ─────────────────────────────────────────────────────
const NOTE_MAP: Record<string, number> = {
  C:0, D:2, E:4, F:5, G:7, A:9, B:11,
}

function noteNameToMidi(token: string): number | null {
  // token examples: A3  C#4  Bb5  F#6  D4
  const m = token.match(/^([A-Ga-g])([#b]?)(\d)$/)
  if (!m) return null
  const base    = NOTE_MAP[m[1].toUpperCase()]
  const acc     = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  const octave  = parseInt(m[3])
  return (octave + 1) * 12 + base + acc
}

// ─── Tokeniser ────────────────────────────────────────────────────────────────
interface Beat {
  midis:   number[]    // notes in this beat (1 = single, >1 = chord)
  dotted:  boolean     // ı suffix
}

function parseLine(line: string): Beat[] {
  const beats: Beat[] = []

  // Split on whitespace, filter empty
  const rawTokens = line.trim().split(/\s+/).filter(Boolean)

  for (const raw of rawTokens) {
    // Skip BPM / time sig tokens
    if (/^BPM=\d+$/i.test(raw) || /^\d+\/\d+$/.test(raw)) continue

    const dotted = raw.includes('ı') || raw.includes('i') // 'ı' or latin 'i' fallback
    const clean  = raw.replace(/[ıi]/g, '')

    if (clean.startsWith('[')) {
      // ── Chord: [A3C#4F#4] ─────────────────────────────────────────────
      const inner = clean.replace(/[\[\]]/g, '')
      // Split into individual note tokens — each is letter + optional accidental + digit
      const noteTokens = inner.match(/[A-Ga-g][#b]?\d/g) ?? []
      const midis = noteTokens.map(noteNameToMidi).filter((m): m is number => m !== null)
      if (midis.length) beats.push({ midis, dotted })
    } else {
      // ── Possibly multiple notes concatenated without brackets: D5A5F5 ──
      const noteTokens = clean.match(/[A-Ga-g][#b]?\d/g) ?? []
      for (const nt of noteTokens) {
        const midi = noteNameToMidi(nt)
        if (midi !== null) beats.push({ midis: [midi], dotted })
      }
    }
  }

  return beats
}

function extractMeta(text: string): { bpm: number; timeSig: [number, number]; title: string } {
  let bpm    = 120
  let num    = 4
  let den    = 4
  let title  = 'Text Import'

  const bpmMatch = text.match(/BPM=(\d+)/i)
  if (bpmMatch) bpm = parseInt(bpmMatch[1])

  const tsMatch = text.match(/(\d+)\/(\d+)/)
  if (tsMatch) { num = parseInt(tsMatch[1]); den = parseInt(tsMatch[2]) }

  const titleMatch = text.match(/^#\s*(.+)$/m)
  if (titleMatch) title = titleMatch[1].trim()

  return { bpm, timeSig: [num, den] as [number, number], title }
}

// ─── Main parser ──────────────────────────────────────────────────────────────

let _idCounter = 0
function uid() { return `t${++_idCounter}` }

/**
 * Parse text notation into a SheetPiece.
 *
 * Multi-line input:
 *   Line 1 = right hand notes
 *   Line 2 = left hand notes
 * Single-line: all notes treated as right hand.
 *
 * @param text     Raw notation string
 * @param title    Override title
 * @param bpmOverride Override BPM from text
 */
export function textToSheetPiece(
  text: string,
  title?: string,
  bpmOverride?: number,
): SheetPiece {
  const meta = extractMeta(text)
  const bpm  = bpmOverride ?? meta.bpm
  const [beatsPerMeasure] = meta.timeSig
  const pieceTitle = title ?? meta.title

  // Split into non-empty lines (ignore comment lines starting with #)
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))

  // Two-hand mode: odd lines = right, even = left (0-indexed)
  const rightBeats: Beat[] = lines.filter((_, i) => i % 2 === 0).flatMap(parseLine)
  const leftBeats:  Beat[] = lines.filter((_, i) => i % 2 !== 0).flatMap(parseLine)

  // ── Merge hands into timed notes ────────────────────────────────────────
  // Assign each beat an absolute beat position.
  // Both hands tick at 1 beat per beat (dotted = 1.5, but we simplify to 1 for layout).
  const allNotes: SheetNote[] = []

  function addBeats(beats: Beat[], hand: 'left' | 'right') {
    let cursor = 0
    for (const beat of beats) {
      const dur = beat.dotted ? 1.5 : 1
      for (const midi of beat.midis) {
        allNotes.push({
          id:            uid(),
          midi,
          startBeat:     cursor,
          durationBeats: dur,
          hand,
        })
      }
      cursor += dur
    }
  }

  addBeats(rightBeats, 'right')
  addBeats(leftBeats,  'left')

  if (!allNotes.length) {
    return {
      id: uid(), title: pieceTitle, composer: 'Text Import',
      bpm, timeSignature: meta.timeSig, keySignature: 0, measures: [],
    }
  }

  // ── Group into measures ──────────────────────────────────────────────────
  const maxBeat      = Math.max(...allNotes.map(n => n.startBeat + n.durationBeats))
  const totalMeasures = Math.ceil(maxBeat / beatsPerMeasure)

  const measures: SheetMeasure[] = Array.from({ length: totalMeasures }, (_, i) => ({
    number: i + 1,
    notes:  [],
  }))

  for (const note of allNotes) {
    const mi  = Math.floor(note.startBeat / beatsPerMeasure)
    const rel = note.startBeat % beatsPerMeasure
    if (mi < measures.length) {
      measures[mi].notes.push({ ...note, startBeat: rel })
    }
  }

  // Remove trailing empty measures
  while (measures.length && !measures[measures.length - 1].notes.length) measures.pop()

  return {
    id:            uid(),
    title:         pieceTitle,
    composer:      'Text Import',
    bpm,
    timeSignature: meta.timeSig,
    keySignature:  0,
    measures,
  }
}
