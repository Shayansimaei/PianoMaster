import { ref, computed, readonly, onUnmounted } from 'vue'
import type { SheetPiece } from '@/types'
import { useAudioSampler } from './useAudioSampler'

export type PlayerState = 'stopped' | 'playing' | 'paused'

/**
 * Plays a SheetPiece automatically using Tone.js sampler.
 * Exposes play/pause/stop controls and a reactive currentBeat cursor.
 */
export function useMidiPlayer() {
  const sampler = useAudioSampler()

  // ── State ──────────────────────────────────────────────────────────────────
  const state        = ref<PlayerState>('stopped')
  const currentBeat  = ref(0)          // absolute beat position as it plays
  const currentChord = ref(0)          // index into sorted chord sequence
  const bpm          = ref(120)
  const tempo        = ref(1.0)        // playback speed multiplier

  let piece:       SheetPiece | null = null
  let chords:      { beat: number; midis: number[]; durBeats: number }[] = []
  let scheduler:   ReturnType<typeof setTimeout> | null = null
  let chordCursor: number = 0
  let beatTimer:   ReturnType<typeof setInterval> | null = null
  let beatStart:   number = 0          // Date.now() when current beat started
  let beatAtStart: number = 0          // currentBeat value when play() was called

  // ── Beat-per-minute → ms per beat ─────────────────────────────────────────
  function msPerBeat() { return (60_000 / bpm.value) / tempo.value }

  // ── Build chord schedule from piece ───────────────────────────────────────
  function buildSchedule(p: SheetPiece) {
    piece = p
    bpm.value = p.bpm

    // Flatten all notes, group by absolute beat
    const groups = new Map<number, { midis: number[]; durBeats: number }>()
    p.measures.forEach((m, mi) => {
      m.notes.forEach(n => {
        const ab  = Math.round((n.startBeat + mi * p.timeSignature[0]) * 1000) / 1000
        const key = ab
        if (!groups.has(key)) groups.set(key, { midis: [], durBeats: n.durationBeats })
        groups.get(key)!.midis.push(n.midi)
        groups.get(key)!.durBeats = Math.max(groups.get(key)!.durBeats, n.durationBeats)
      })
    })

    chords = [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([beat, val]) => ({ beat, ...val }))
  }

  // ── Scheduler: fire each chord at the right time ──────────────────────────
  function scheduleNext() {
    if (chordCursor >= chords.length) {
      // End of piece
      setTimeout(() => stop(), msPerBeat())
      return
    }

    const chord   = chords[chordCursor]
    const nextIdx = chordCursor + 1
    const now     = chordCursor === 0
      ? 0
      : chord.beat

    // Time from now until this chord should fire
    const beatsPassed = chord.beat - beatAtStart
    const msFromStart = beatsPassed * msPerBeat()
    const elapsed     = Date.now() - beatStart
    const delay       = Math.max(0, msFromStart - elapsed)

    scheduler = setTimeout(() => {
      if (state.value !== 'playing') return

      // Play all notes in chord
      for (const midi of chord.midis) {
        sampler.noteOn(midi, 90)
      }

      // Release after duration
      const holdMs = chord.durBeats * msPerBeat() * 0.85  // 85% legato
      setTimeout(() => {
        for (const midi of chord.midis) {
          sampler.noteOff(midi)
        }
      }, holdMs)

      currentChord.value = chordCursor
      currentBeat.value  = chord.beat
      chordCursor++

      scheduleNext()
    }, delay)
  }

  // ── Smooth beat counter for UI progress ───────────────────────────────────
  function startBeatTicker() {
    stopBeatTicker()
    beatTimer = setInterval(() => {
      if (state.value !== 'playing') return
      const elapsed = (Date.now() - beatStart) / msPerBeat()
      currentBeat.value = beatAtStart + elapsed
    }, 80)
  }

  function stopBeatTicker() {
    if (beatTimer !== null) { clearInterval(beatTimer); beatTimer = null }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function load(p: SheetPiece) {
    stop()
    buildSchedule(p)
    if (!sampler.loaded.value) await sampler.init()
  }

  function play() {
    if (!chords.length) return
    if (state.value === 'playing') return

    state.value  = 'playing'
    beatStart    = Date.now()
    beatAtStart  = currentBeat.value

    // Find chord cursor from currentBeat (supports resume)
    chordCursor = chords.findIndex(c => c.beat >= currentBeat.value)
    if (chordCursor < 0) chordCursor = 0

    startBeatTicker()
    scheduleNext()
  }

  function pause() {
    if (state.value !== 'playing') return
    state.value = 'paused'
    if (scheduler) { clearTimeout(scheduler); scheduler = null }
    stopBeatTicker()
    sampler.allNotesOff()
  }

  function stop() {
    state.value    = 'stopped'
    currentBeat.value  = 0
    currentChord.value = 0
    chordCursor    = 0
    if (scheduler) { clearTimeout(scheduler); scheduler = null }
    stopBeatTicker()
    sampler.allNotesOff()
  }

  function seek(beat: number) {
    const wasPlaying = state.value === 'playing'
    if (wasPlaying) pause()
    currentBeat.value = beat
    if (wasPlaying) play()
  }

  function setTempo(t: number) {
    tempo.value = t
    if (state.value === 'playing') {
      // Restart scheduling from current position at new tempo
      pause()
      play()
    }
  }

  // Total beats in the piece
  const totalBeats = computed(() =>
    chords.length ? chords[chords.length - 1].beat + chords[chords.length - 1].durBeats : 0
  )

  const progressPct = computed(() =>
    totalBeats.value ? Math.min((currentBeat.value / totalBeats.value) * 100, 100) : 0
  )

  const isPlaying = computed(() => state.value === 'playing')
  const isStopped = computed(() => state.value === 'stopped')

  onUnmounted(() => stop())

  return {
    state:        readonly(state),
    currentBeat:  readonly(currentBeat),
    currentChord: readonly(currentChord),
    bpm,
    tempo,
    totalBeats,
    progressPct,
    isPlaying,
    isStopped,
    load,
    play, 
    pause,
    stop,
    seek,
    setTempo,
  }
}
