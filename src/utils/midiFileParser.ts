import { parseMidi } from 'midi-file'
import type { SheetPiece, SheetMeasure, SheetNote } from '@/types'

// ─── Types from midi-file library ─────────────────────────────────────────────

interface MidiNoteOnEvent {
  type: 'noteOn'
  deltaTime: number
  channel: number
  noteNumber: number
  velocity: number
}

interface MidiNoteOffEvent {
  type: 'noteOff'
  deltaTime: number
  channel: number
  noteNumber: number
  velocity: number
}

interface MidiTempoEvent {
  type: 'setTempo'
  deltaTime: number
  microsecondsPerBeat: number
}

interface MidiTimeSignatureEvent {
  type: 'timeSignature'
  deltaTime: number
  numerator: number
  denominator: number
}

interface MidiKeySignatureEvent {
  type: 'keySignature'
  deltaTime: number
  key: number
  scale: number
}

interface MidiTrackNameEvent {
  type: 'trackName'
  deltaTime: number
  text: string
}

type MidiEvent =
  | MidiNoteOnEvent
  | MidiNoteOffEvent
  | MidiTempoEvent
  | MidiTimeSignatureEvent
  | MidiKeySignatureEvent
  | MidiTrackNameEvent
  | { type: string; deltaTime: number; [key: string]: unknown }

interface MidiFile {
  header: {
    format: number
    numTracks: number
    ticksPerBeat: number
  }
  tracks: MidiEvent[][]
}

// ─── Intermediate note while building ─────────────────────────────────────────

interface PendingNote {
  midi: number
  startTick: number
  channel: number
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a .mid file (as ArrayBuffer) into a SheetPiece.
 *
 * @param buffer   - ArrayBuffer from FileReader or fetch
 * @param title    - Display title (defaults to filename)
 * @param composer - Composer name (optional)
 */
export function parseMidiFile(
  buffer: ArrayBuffer,
  title = 'Untitled',
  composer = 'Unknown'
): SheetPiece {
  const midi = parseMidi(new Uint8Array(buffer)) as MidiFile

  const ticksPerBeat = midi.header.ticksPerBeat ?? 480

  // ─── Extract tempo & time signature from track 0 (or any track) ───────────
  let microsecondsPerBeat = 500_000  // default = 120 BPM
  let timeSigNumerator = 4
  let timeSigDenominator = 4
  let keySignatureSemitones = 0

  for (const track of midi.tracks) {
    for (const event of track) {
      if (event.type === 'setTempo') {
        microsecondsPerBeat = (event as MidiTempoEvent).microsecondsPerBeat
      }
      if (event.type === 'timeSignature') {
        timeSigNumerator = (event as MidiTimeSignatureEvent).numerator
        timeSigDenominator = (event as MidiTimeSignatureEvent).denominator
      }
      if (event.type === 'keySignature') {
        keySignatureSemitones = (event as MidiKeySignatureEvent).key
      }
    }
  }

  const bpm = Math.round(60_000_000 / microsecondsPerBeat)
  const beatsPerMeasure = timeSigNumerator

  // ─── Collect all notes across all tracks ──────────────────────────────────
  const allNotes: SheetNote[] = []
  let noteIdCounter = 0

  for (let trackIdx = 0; trackIdx < midi.tracks.length; trackIdx++) {
    const track = midi.tracks[trackIdx]
    const hand: 'left' | 'right' = trackIdx <= 1 ? 'right' : 'left'

    // Convert delta times → absolute ticks
    let absoluteTick = 0
    const pending = new Map<string, PendingNote>()  // key = `channel-noteNumber`

    for (const event of track) {
      absoluteTick += event.deltaTime

      if (event.type === 'noteOn' && (event as MidiNoteOnEvent).velocity > 0) {
        const e = event as MidiNoteOnEvent
        const key = `${e.channel}-${e.noteNumber}`
        pending.set(key, {
          midi: e.noteNumber,
          startTick: absoluteTick,
          channel: e.channel,
        })
      }

      // noteOff OR noteOn with velocity=0 closes the note
      if (
        event.type === 'noteOff' ||
        (event.type === 'noteOn' && (event as MidiNoteOnEvent).velocity === 0)
      ) {
        const e = event as MidiNoteOffEvent
        const key = `${e.channel}-${e.noteNumber}`
        const pending_note = pending.get(key)

        if (pending_note) {
          const durationTicks = absoluteTick - pending_note.startTick
          const startBeat = pending_note.startTick / ticksPerBeat
          const durationBeats = Math.max(durationTicks / ticksPerBeat, 0.125) // min 1/8 beat

          // Determine hand from MIDI channel: ch 0 = right, ch 1 = left (General MIDI convention)
          const noteHand: 'left' | 'right' =
            e.channel === 1 ? 'left' : hand

          allNotes.push({
            id: `n${noteIdCounter++}`,
            midi: pending_note.midi,
            startBeat,
            durationBeats,
            hand: noteHand,
          })

          pending.delete(key)
        }
      }
    }
  }

  if (allNotes.length === 0) {
    // Return an empty piece rather than crashing
    return {
      id: slugify(title),
      title,
      composer,
      bpm,
      timeSignature: [timeSigNumerator, timeSigDenominator],
      keySignature: keySignatureSemitones,
      measures: [],
    }
  }

  // ─── Group notes into measures ─────────────────────────────────────────────
  const maxBeat = Math.max(...allNotes.map(n => n.startBeat + n.durationBeats))
  const totalMeasures = Math.ceil(maxBeat / beatsPerMeasure)

  const measures: SheetMeasure[] = Array.from({ length: totalMeasures }, (_, i) => ({
    number: i + 1,
    notes: [],
  }))

  for (const note of allNotes) {
    const measureIdx = Math.floor(note.startBeat / beatsPerMeasure)
    const beatWithinMeasure = note.startBeat % beatsPerMeasure

    if (measureIdx < measures.length) {
      measures[measureIdx].notes.push({
        ...note,
        startBeat: beatWithinMeasure,  // make beat relative to measure start
      })
    }
  }

  // Remove empty measures at the end
  while (measures.length > 0 && measures[measures.length - 1].notes.length === 0) {
    measures.pop()
  }

  return {
    id: slugify(title),
    title,
    composer,
    bpm,
    timeSignature: [timeSigNumerator, timeSigDenominator],
    keySignature: keySignatureSemitones,
    measures,
  }
}

// ─── Load from File object (drag & drop / input[type=file]) ───────────────────

export function parseMidiFromFile(file: File): Promise<SheetPiece> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const title = file.name.replace(/\.mid$/i, '').replace(/[-_]/g, ' ')

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer
        resolve(parseMidiFile(buffer, title))
      } catch (err) {
        reject(new Error(`Failed to parse MIDI file: ${(err as Error).message}`))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

// ─── Load from URL (fetch a .mid file) ────────────────────────────────────────

export async function parseMidiFromUrl(url: string, title?: string, composer?: string): Promise<SheetPiece> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`)
  const buffer = await response.arrayBuffer()
  const name = title ?? url.split('/').pop()?.replace(/\.mid$/i, '') ?? 'Untitled'
  return parseMidiFile(buffer, name, composer)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
