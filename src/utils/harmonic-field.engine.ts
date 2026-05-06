/**
 * Harmonic Field Engine
 *
 * Generates an infinite sequence of harmonically connected chords,
 * each 4–8 notes, linked by voice-leading proximity to the previous chord.
 *
 * Core rules:
 *  1. Common-tone retention  — prefer chords sharing 2+ notes with prev
 *  2. Smooth voice leading   — penalise large jumps in individual voices
 *  3. Functional tension arc — alternate stable/tense chords to avoid monotony
 *  4. No immediate repeat    — never suggest the same root+type twice in a row
 *  5. Register spread        — left hand 36–60, right hand 52–84, overlap allowed
 */

// ─── Note names ───────────────────────────────────────────────────────────────
export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const
export type NoteName = typeof NOTE_NAMES[number]

// ─── Extended chord template library ──────────────────────────────────────────
// Each template: [name, intervals above root (semitones), tension 0–10]
export interface ChordTemplate {
  name:      string          // e.g. "Major 7th"
  short:     string          // e.g. "maj7"
  intervals: number[]        // relative to root, root=0 included
  tension:   number          // 0=stable, 10=very tense
  color:     string          // description of harmonic colour
}

export const TEMPLATES: ChordTemplate[] = [
  // ── Triads ──────────────────────────────────────────────────────────────────
  { name:'Major',          short:'maj',    intervals:[0,4,7],        tension:0,  color:'Bright and stable' },
  { name:'Minor',          short:'min',    intervals:[0,3,7],        tension:1,  color:'Dark, introspective' },
  { name:'Diminished',     short:'dim',    intervals:[0,3,6],        tension:7,  color:'Unstable, wants resolution' },
  { name:'Augmented',      short:'aug',    intervals:[0,4,8],        tension:6,  color:'Dreamy, ambiguous' },
  { name:'Sus2',           short:'sus2',   intervals:[0,2,7],        tension:2,  color:'Open, floating' },
  { name:'Sus4',           short:'sus4',   intervals:[0,5,7],        tension:3,  color:'Suspended anticipation' },

  // ── 7th chords (4 notes) ────────────────────────────────────────────────────
  { name:'Major 7th',      short:'maj7',   intervals:[0,4,7,11],     tension:2,  color:'Warm, lush' },
  { name:'Dominant 7th',   short:'7',      intervals:[0,4,7,10],     tension:5,  color:'Tension, blues feel' },
  { name:'Minor 7th',      short:'m7',     intervals:[0,3,7,10],     tension:2,  color:'Melancholic richness' },
  { name:'Minor Maj7',     short:'mMaj7',  intervals:[0,3,7,11],     tension:4,  color:'Sophisticated, cinematic' },
  { name:'Half-Dim 7th',   short:'ø7',     intervals:[0,3,6,10],     tension:6,  color:'Dark jazz tension' },
  { name:'Dim 7th',        short:'dim7',   intervals:[0,3,6,9],      tension:8,  color:'Dramatic, symmetrical' },
  { name:'Dominant 7sus4', short:'7sus4',  intervals:[0,5,7,10],     tension:4,  color:'Floating dominance' },
  { name:'Major 6th',      short:'maj6',   intervals:[0,4,7,9],      tension:1,  color:'Sweet, open' },
  { name:'Minor 6th',      short:'m6',     intervals:[0,3,7,9],      tension:2,  color:'Bittersweet' },

  // ── 9th chords (5 notes) ────────────────────────────────────────────────────
  { name:'Major 9th',      short:'maj9',   intervals:[0,4,7,11,14],  tension:2,  color:'Airy, impressionist' },
  { name:'Dominant 9th',   short:'9',      intervals:[0,4,7,10,14],  tension:5,  color:'Rich jazz tension' },
  { name:'Minor 9th',      short:'m9',     intervals:[0,3,7,10,14],  tension:3,  color:'Deep, soulful' },
  { name:'Add9',           short:'add9',   intervals:[0,2,4,7],      tension:1,  color:'Fresh, open triadic' },
  { name:'Minor Add9',     short:'madd9',  intervals:[0,2,3,7],      tension:2,  color:'Plaintive, modal' },
  { name:'Dom 7♭9',        short:'7b9',    intervals:[0,4,7,10,13],  tension:8,  color:'Intense jazz dissonance' },
  { name:'Dom 7♯9',        short:'7#9',    intervals:[0,4,7,10,15],  tension:9,  color:'Hendrix chord — extreme' },

  // ── 11th chords (5–6 notes) ─────────────────────────────────────────────────
  { name:'Minor 11th',     short:'m11',    intervals:[0,3,7,10,14,17], tension:3, color:'Modal, spacious' },
  { name:'Dominant 11th',  short:'11',     intervals:[0,4,7,10,14,17], tension:6, color:'Dense, modern' },
  { name:'Major 9♯11',     short:'maj9#11',intervals:[0,4,7,11,14,18], tension:4, color:'Lydian magic' },

  // ── 13th chords (6–7 notes) ─────────────────────────────────────────────────
  { name:'Major 13th',     short:'maj13',  intervals:[0,4,7,11,14,21],   tension:3, color:'Full orchestral lush' },
  { name:'Dominant 13th',  short:'13',     intervals:[0,4,7,10,14,17,21],tension:6, color:'Complete jazz dominant' },
  { name:'Minor 13th',     short:'m13',    intervals:[0,3,7,10,14,17,21],tension:4, color:'Soul/funk richness' },
]

// ─── A voiced chord (ready to play) ──────────────────────────────────────────
export interface VoicedChord {
  uid:        string            // unique id for this specific voicing
  root:       number            // MIDI note of root (in left-hand octave)
  rootName:   string            // e.g. 'C#'
  template:   ChordTemplate
  label:      string            // e.g. 'C# maj7'
  notes:      number[]          // all MIDI notes, sorted low→high
  leftNotes:  number[]          // bass register (< 60)
  rightNotes: number[]          // treble register (>= 52)
  tension:    number
  color:      string
}

// ─── Harmonic field context ───────────────────────────────────────────────────
export type FieldMode = 'major' | 'minor' | 'jazz' | 'chromatic' | 'modal'

export interface FieldConfig {
  mode:       FieldMode
  rootPc:     number     // pitch class 0-11 for the tonal centre
  tension:    number     // 0=calm, 10=adventurous (user slider)
  spread:     number     // 0=tight voicings, 10=wide (octave spread)
  noteCount:  [number,number]  // [min,max] notes per chord
}

// ─── Voice the chord across registers ─────────────────────────────────────────
function voiceChord(
  rootPc: number,
  template: ChordTemplate,
  config: FieldConfig,
  prevNotes: number[],
): VoicedChord {
  // Choose root octave for bass (left hand anchor)
  // Prefer octaves 2–3 (MIDI 24–47) for the root
  const rootBase = 36 + rootPc  // C3 = 48, but we want variety

  // Build all notes spanning left and right registers
  const allNotes: number[] = []

  // Left hand: root + bass intervals in octaves 2–3
  for (const interval of template.intervals.slice(0, 3)) {
    const n = rootBase + interval
    if (n >= 28 && n <= 60) allNotes.push(n)
  }

  // Right hand: upper intervals in octaves 4–6
  const rightBase = rootBase + 12  // one octave up
  const spreadOctaves = Math.floor(config.spread / 4)  // 0–2 extra octaves
  for (const interval of template.intervals) {
    for (let oct = 0; oct <= spreadOctaves; oct++) {
      const n = rightBase + interval + oct * 12
      if (n >= 52 && n <= 88) allNotes.push(n)
    }
  }

  // Remove duplicates, sort
  const unique = [...new Set(allNotes)].sort((a, b) => a - b)

  // Clamp to note count range
  const [minN, maxN] = config.noteCount
  let final = unique
  if (final.length > maxN) {
    // Keep lowest (bass), highest (melody), and most-common-toned middle
    if (prevNotes.length) {
      const prevSet = new Set(prevNotes.map(n => n % 12))
      const scored  = final.map(n => ({ n, score: prevSet.has(n % 12) ? 1 : 0 }))
      // Always keep first and last
      const keep = [scored[0], scored[scored.length - 1]]
      const middle = scored.slice(1, -1).sort((a, b) => b.score - a.score)
      while (keep.length < maxN && middle.length) keep.push(middle.shift()!)
      final = keep.map(x => x.n).sort((a, b) => a - b)
    } else {
      final = [...final.slice(0, 2), ...final.slice(-( maxN - 2))]
    }
  }
  while (final.length < minN && unique.length < minN) {
    // Add octave doublings if needed
    const highest = final[final.length - 1]
    if (highest + 12 <= 88) final.push(highest + 12)
    else break
  }

  const leftNotes  = final.filter(n => n < 60)
  const rightNotes = final.filter(n => n >= 52)

  const rootName = NOTE_NAMES[rootPc]
  const uid      = `${rootName}-${template.short}-${final.join('.')}`

  return {
    uid,
    root:      rootBase,
    rootName,
    template,
    label:     `${rootName} ${template.short}`,
    notes:     final,
    leftNotes,
    rightNotes,
    tension:   template.tension,
    color:     template.color,
  }
}

// ─── Scoring: how well does candidate follow prev? ────────────────────────────
interface CandidateScore {
  chord:       VoicedChord
  score:       number
  commonTones: number
  voiceLeap:   number
}

function scoreTransition(prev: VoicedChord, candidate: VoicedChord, config: FieldConfig): number {
  const prevPcs = new Set(prev.notes.map(n => n % 12))
  const candPcs = new Set(candidate.notes.map(n => n % 12))

  // 1. Common tones (higher = smoother)
  let commonTones = 0
  for (const pc of candPcs) { if (prevPcs.has(pc)) commonTones++ }
  const commonScore = commonTones * 12

  // 2. Voice-leading smoothness: sum of abs intervals between closest prev note
  let leapTotal = 0
  for (const n of candidate.notes) {
    const closest = prev.notes.reduce((best, p) => Math.abs(p - n) < Math.abs(best - n) ? p : best, prev.notes[0])
    leapTotal += Math.abs(closest - n)
  }
  const leapScore = Math.max(0, 60 - leapTotal)  // lower leap = higher score

  // 3. Tension variety: penalise repeating same tension level heavily
  const tensionDelta = Math.abs(candidate.tension - prev.tension)
  const tensionScore = tensionDelta * 3  // small reward for variety

  // 4. User tension setting: prefer chords near user's tension target
  const tensionTarget = (config.tension / 10) * 10  // 0–10
  const tensionFit    = 10 - Math.abs(candidate.tension - tensionTarget)
  const tensionFitScore = tensionFit * 2

  // 5. Root movement variety: prefer 4ths/5ths/3rds over unison
  const rootInterval = ((candidate.root % 12) - (prev.root % 12) + 12) % 12
  const rootBonus = [3, 4, 5, 7, 8, 9].includes(rootInterval) ? 8 : rootInterval === 0 ? -20 : 2

  return commonScore + leapScore + tensionScore + tensionFitScore + rootBonus
}

// ─── Mode-aware candidate pool ────────────────────────────────────────────────
function getCandidateRoots(config: FieldConfig): number[] {
  const root = config.rootPc
  switch (config.mode) {
    case 'major':    return [root, (root+2)%12, (root+4)%12, (root+5)%12, (root+7)%12, (root+9)%12, (root+11)%12]
    case 'minor':    return [root, (root+2)%12, (root+3)%12, (root+5)%12, (root+7)%12, (root+8)%12, (root+10)%12]
    case 'jazz':     return Array.from({length:12}, (_,i) => (root+i)%12)  // all 12
    case 'chromatic':return Array.from({length:12}, (_,i) => (root+i)%12)
    case 'modal':    return [root, (root+2)%12, (root+3)%12, (root+5)%12, (root+7)%12, (root+9)%12, (root+10)%12]
  }
}

function getCandidateTemplates(config: FieldConfig): ChordTemplate[] {
  const maxTension = 2 + Math.round((config.tension / 10) * 8)  // 2 at calm, 10 at adventurous
  const minTension = Math.max(0, maxTension - 5)

  switch (config.mode) {
    case 'major':
      return TEMPLATES.filter(t => t.tension <= maxTension && !['dim','aug','7b9','7#9','dim7','ø7'].includes(t.short))
    case 'minor':
      return TEMPLATES.filter(t => t.tension <= maxTension && !['maj','maj7','maj9','maj13'].includes(t.short))
    case 'jazz':
      return TEMPLATES.filter(t => t.tension <= maxTension && t.intervals.length >= 3)
    case 'chromatic':
      return TEMPLATES.filter(t => t.tension >= minTension && t.tension <= maxTension)
    case 'modal':
      return TEMPLATES.filter(t =>
        ['maj','min','sus2','sus4','maj7','m7','m9','madd9','m11','maj9#11'].includes(t.short)
        && t.tension <= maxTension
      )
  }
}

// ─── Main: generate next chord ────────────────────────────────────────────────
export function generateNextChord(
  prev: VoicedChord | null,
  config: FieldConfig,
  history: VoicedChord[],
): VoicedChord {
  const roots     = getCandidateRoots(config)
  const templates = getCandidateTemplates(config)

  if (!templates.length) {
    // Fallback: major triad on root
    return voiceChord(config.rootPc, TEMPLATES[0], config, prev?.notes ?? [])
  }

  // Build all candidates
  const candidates: CandidateScore[] = []
  const recentUids = new Set(history.slice(-3).map(c => c.uid))
  const recentRoots = new Set(history.slice(-2).map(c => c.root % 12))

  for (const rootPc of roots) {
    for (const tmpl of templates) {
      const chord = voiceChord(rootPc, tmpl, config, prev?.notes ?? [])
      // Never repeat exact chord from last 3
      if (recentUids.has(chord.uid)) continue
      // Avoid same root twice in a row
      if (recentRoots.has(rootPc) && history.length > 0 && history[history.length - 1].root % 12 === rootPc) continue

      const score = prev
        ? scoreTransition(prev, chord, config)
        : (10 - Math.abs(chord.tension - 2)) * 5  // first chord: prefer calm

      candidates.push({ chord, score, commonTones: 0, voiceLeap: 0 })
    }
  }

  if (!candidates.length) {
    // Emergency fallback
    return voiceChord(config.rootPc, TEMPLATES[0], config, [])
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score)

  // Pick from top-5 with slight randomness to avoid determinism
  const pool = candidates.slice(0, Math.min(5, candidates.length))
  // Weighted random: score^2 weighting
  const totalWeight = pool.reduce((s, c) => s + c.score * c.score, 0)
  let rnd = Math.random() * totalWeight
  for (const c of pool) {
    rnd -= c.score * c.score
    if (rnd <= 0) return c.chord
  }
  return pool[0].chord
}

// ─── Look-ahead: generate N chords in advance for display ────────────────────
export function generateLookAhead(
  current: VoicedChord,
  config: FieldConfig,
  history: VoicedChord[],
  count: number,
): VoicedChord[] {
  const ahead: VoicedChord[] = []
  let prev = current
  let hist = [...history]

  for (let i = 0; i < count; i++) {
    const next = generateNextChord(prev, config, hist)
    ahead.push(next)
    hist = [...hist, next]
    prev = next
  }
  return ahead
}

// ─── Explain why this chord follows the previous ──────────────────────────────
export function explainTransition(prev: VoicedChord | null, current: VoicedChord): string {
  if (!prev) return `${current.label} — starting chord. ${current.color}.`

  const prevPcs  = new Set(prev.notes.map(n => n % 12))
  const currPcs  = [...current.notes.map(n => n % 12)]
  const common   = currPcs.filter(pc => prevPcs.has(pc))
  const rootMove = ((current.root % 12) - (prev.root % 12) + 12) % 12

  const rootDesc = {
    0:'Same root',1:'Semitone up',2:'Whole step up',3:'Minor 3rd up',
    4:'Major 3rd up',5:'Perfect 4th up',6:'Tritone',7:'Perfect 5th up',
    8:'Minor 6th up',9:'Major 6th up',10:'Minor 7th up',11:'Major 7th up',
  }[rootMove] ?? 'Root shift'

  const tensionDir = current.tension > prev.tension ? '↑ tension rises'
    : current.tension < prev.tension ? '↓ tension falls' : '→ tension steady'

  return `${rootDesc} · ${common.length} shared tones · ${tensionDir} · ${current.color}`
}
