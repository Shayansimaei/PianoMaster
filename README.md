# PianoMaster 🎹

A MIDI teaching application built with **Vue 3 + Ionic + TypeScript**.  
Detects MIDI keyboards dynamically, plays real piano samples, and guides users through notes across three modes.
[Demo](https://PianoMasterteacher.netlify.app/)

---

## Quick Start

```bash
cd PianoMaster
npm install
npm run dev
```

Open `http://localhost:5173` in **Chrome** or **Edge** (required for Web MIDI API).

---

## Project Structure

```
src/
├── composables/
│   ├── useMidi.ts            # Web MIDI API — device detection + note streaming
│   └── useAudioSampler.ts    # Tone.js — Salamander Grand Piano samples
│
├── stores/
│   ├── midi.store.ts         # Pinia — connected devices, active notes, last event
│   └── lesson.store.ts       # Pinia — lesson catalog, progress, scoring
│
├── utils/
│   └── noteEngine.ts         # Music theory — MIDI↔note conversion, matching, layouts
│
├── types/
│   └── index.ts              # Shared TypeScript types
│
├── components/
│   ├── PianoKeyboard.vue     # Visual piano — highlights target/played/wrong notes
│   ├── NoteDisplay.vue       # Target vs played — correct/wrong/octave-off states
│   └── DeviceStatusBar.vue   # MIDI connection pill shown in toolbars
│
├── views/
│   ├── PlayPage.vue          # Free play — match any note, streak counter
│   ├── LessonPage.vue        # Lesson catalog with difficulty filter
│   ├── LessonDetailPage.vue  # Active lesson — step-by-step with scoring
│   ├── SheetMusicPage.vue    # SVG sheet music with follow-along highlighting
│   └── DevicesPage.vue       # MIDI device manager + live event monitor
│
└── theme/
    ├── variables.css         # Design tokens (colors, fonts, Ionic overrides)
    └── global.css            # Base styles
```

---

## Core Systems

### 1. MIDI Input — `useMidi.ts`

- Calls `navigator.requestMIDIAccess()` once (singleton)
- Attaches `onmidimessage` handlers to all inputs
- Listens on `access.onstatechange` for plug/unplug events
- Broadcasts `MidiEvent` to all registered handlers via a shared `Set`
- Each component subscribes with `midi.onMidiEvent(handler)` — auto-cleaned on unmount

```ts
const midi = useMidi()
await midi.init()               // request browser permission
midi.onMidiEvent((event) => {   // fires on every noteOn/noteOff
  console.log(event.note, event.velocity)
})
```

### 2. Audio Sampler — `useAudioSampler.ts`

- Uses **Tone.js Sampler** with free Salamander Grand Piano samples
- Samples hosted at `https://tonejs.github.io/audio/salamander/`
- Velocity-aware: `velocity / 127` maps to gain
- `noteOn(midi, velocity)` / `noteOff(midi)` / `noteOnce(midi)` / `allNotesOff()`

### 3. Note Engine — `utils/noteEngine.ts`

```ts
midiToNoteInfo(60)    // → { midi:60, name:'C', octave:4, label:'C4', isBlack:false, frequency:261.6 }
matchNotes(62, 60)    // → { result: 'wrong', played: NoteInfo, target: NoteInfo }
matchNotes(72, 60)    // → { result: 'octave-off', ... }   // same note class, wrong octave
matchNotes(60, 60)    // → { result: 'correct', ... }
buildKeyboardLayout(48, 84)  // → KeyLayout[] for rendering the piano SVG
getScaleNotes(60, 'major')   // → [60,62,64,65,67,69,71,72]
```

### 4. Match Results

| Result | Meaning |
|--------|---------|
| `correct` | Exact MIDI note match |
| `wrong` | Different pitch class |
| `octave-off` | Same note name, different octave |
| `idle` | No note playing |

---

## Modes

### Free Play (`/play`)
- Set a target note manually or shuffle randomly
- Press Space to shuffle
- Streak counter for consecutive correct notes
- Click piano keys with mouse/touch or use a real MIDI keyboard

### Lessons (`/lesson` → `/lesson/:id`)
- 6 built-in lessons: Middle C, C Major Scale, G Major Scale, Pentatonic, Chromatic, Thirds
- Step-by-step — plays the next note only after the correct one is hit
- Tracks accuracy per session, saves high score per lesson
- Skip button for practice mode

### Sheet Music (`/sheet`)
- SVG-rendered staff notation
- Blue = current target note, green = already played
- Click any note head to preview its sound
- Advances automatically on correct notes

---

## Adding Lessons

Edit `src/stores/lesson.store.ts` — add to the `CATALOG` array:

```ts
{
  id: 'my-lesson',
  title: 'My Custom Lesson',
  description: 'Description here',
  difficulty: 'beginner',
  status: 'available',
  tags: ['custom'],
  steps: [60, 62, 64].map((note, i) => ({
    id: `step-${i}`,
    targetNote: note,
    durationMs: 0,
    hint: i === 0 ? 'Start on C!' : undefined,
  })),
}
```

---

## Adding Sheet Music Pieces

Edit the `pieces` array in `SheetMusicPage.vue`:

```ts
{
  id: 'my-piece',
  title: 'My Piece',
  composer: 'Me',
  bpm: 120,
  timeSignature: [4, 4],
  keySignature: 0,
  measures: [
    {
      number: 1,
      notes: [
        { id: 'n1', midi: 60, startBeat: 0, durationBeats: 1, hand: 'right' },
        { id: 'n2', midi: 64, startBeat: 1, durationBeats: 1, hand: 'right' },
      ]
    }
  ]
}
```

---

## Browser Compatibility

| Browser | MIDI | Audio |
|---------|------|-------|
| Chrome  | ✅ Full | ✅ |
| Edge    | ✅ Full | ✅ |
| Firefox | ❌ (no Web MIDI) | ✅ |
| Safari  | ❌ (no Web MIDI) | ✅ |

> For Firefox/Safari: the app still works with mouse/touch piano input — only hardware MIDI keyboards are unavailable.

---

## Roadmap Ideas

- [ ] Metronome with BPM sync
- [ ] Chord detection (multiple simultaneous notes)
- [ ] Left/right hand separation in sheet mode
- [ ] Record & playback sessions
- [ ] Custom sample packs (upload your own)
- [ ] Interval and chord ear training modes
- [ ] MusicXML import for sheet music
- [ ] Mobile: Capacitor wrapper for iOS/Android MIDI via BLE-MIDI
