# 🎹 Piano Master

**Learn piano the smart way.** Piano Master is an interactive piano teaching application that connects to your MIDI keyboard, listens to what you play, and guides you note by note — from your very first C major scale to reading full sheet music.

---
## [Demo](https://noteflowteacher.netlify.app/)
## Why Piano Master?

Most piano apps make you watch videos or follow along passively. Piano Master is different — it *listens*. Connect any MIDI keyboard, pick a lesson or a piece, and the app responds to every note you play in real time. Hit the right note and it lights up green. Miss it and it shows you exactly where your fingers should be.

Whether you're a complete beginner learning where Middle C is, or an intermediate player working through a Beethoven melody, Piano Master adapts to your level.

---

## Features

### 🎯 Real-Time Note Matching
Play any note on your keyboard and Piano Master instantly tells you if it's correct, wrong, or the right note in the wrong octave. Visual feedback on the on-screen piano, audio playback through a real grand piano sampler, and a streak counter to keep you motivated.

### 📚 Structured Lessons
Six built-in lessons take you from zero to playing scales and intervals:

| Lesson | What you learn |
|--------|---------------|
| Middle C & Friends | The five notes around C4 — your starting point |
| C Major Scale | The foundation of Western music, up and down |
| G Major Scale | One sharp, F# — a natural next step |
| Pentatonic Improvisation | Five notes, infinite possibilities |
| Chromatic Warm-Up | Every semitone C4→C5, builds finger independence |
| Major & Minor Thirds | The most common melodic intervals by ear and hand |

Each lesson tracks your **accuracy per session** and saves your **personal best**. Miss a note and try again — you only move forward when you get it right.

### 🎼 Sheet Music Reader
Read and play along with real staff notation rendered directly in the app:

- **Treble and bass staves** rendered side by side — the number of staves adapts dynamically to the range of the piece
- **Blue note** = what to play next · **Green note** = already played correctly
- **Auto-advance** — the highlighted note moves forward as you play
- **Chord detection** — the app recognises chords and shows their names below the staff
- **Import any .mid file** — drag and drop a MIDI file and it's immediately playable
- **Import from text notation** — paste a simple bracket notation and it converts to sheet music instantly
- **MIDI playback** — let the app play the piece so you can listen and follow along before trying yourself, with speed control from 0.5× to 1.5×

### 🎹 Interactive Piano Keyboard
A fully playable on-screen piano keyboard — use it with mouse, touch, or your MIDI hardware:

- Adjustable **octave range** and **span** (1, 2, or 3 octaves)
- **Scale highlighting** — select any scale and root note; keys inside the scale glow green, outside keys dim
- 9 scales: Major, Natural Minor, Harmonic Minor, Pentatonic Major, Pentatonic Minor, Blues, Whole Tone, Diminished, Chromatic

### 🔌 Plug-and-Play MIDI
Connect any USB MIDI keyboard and Piano Master detects it automatically — no drivers, no configuration. Unplug and plug in a different keyboard mid-session and the app updates itself in real time. The Devices page shows a live event monitor so you can verify your input is working.

### 🔊 Real Grand Piano Sound
Every note plays back through the **Salamander Grand Piano** — a professional-quality acoustic piano sample library. Velocity-sensitive: play softly and it sounds soft, hit a key hard and it responds with full dynamic range.

---

## Getting Started

```bash
npm install
npm run dev
```

Open **Chrome** or **Edge** at `http://localhost:5173` — these are required for Web MIDI API support.

**Connect your MIDI keyboard** before or after opening the app. Piano Master detects it either way.

Start with **Free Play** to get comfortable, then move to **Lessons** when you're ready for structured practice.

---

## Importing Your Own Music

### From a .mid file
In the Sheet Music tab, click **Import .mid** or drag a MIDI file anywhere onto the sheet area. The app parses the file, assigns notes to treble and bass staves, and makes it immediately playable.

### From text notation
Click **Import text** and paste notes in this simple format:

```
# My Song   (optional title)
BPM=90      (optional tempo)

[A3D4] G6F6G6A6 [A3C#4F#4] [A3C4] G6F6G6A6F6   ← right hand
D4 D5A5F5 D5A5F5 A4 C#5A5G5                      ← left hand
```

| Token | Meaning |
|-------|---------|
| `A3` | Single note |
| `[A3D4]` | Chord (all notes played together) |
| `D5A5F5` | Quick notes (separate, concatenated) |
| `[A3D4ı]` | Dotted note (1.5× duration) |
| Line 1 | Right hand (treble) |
| Line 2 | Left hand (bass) |

---

## Adding Your Own Lessons

Edit `src/stores/lesson.store.ts` and add an entry to `CATALOG`:

```ts
{
  id: 'my-lesson',
  title: 'My Custom Lesson',
  description: 'Short description shown in the lesson list.',
  difficulty: 'beginner',          // 'beginner' | 'intermediate' | 'advanced'
  status: 'available',
  tags: ['scales', 'C major'],
  steps: [60, 62, 64, 65, 67].map((note, i) => ({
    id: `step-${i}`,
    targetNote: note,
    durationMs: 0,
    hint: i === 0 ? 'Start on Middle C!' : undefined,
  })),
}
```

---

## Browser Compatibility

| Browser | MIDI keyboard | Audio | Touch piano |
|---------|:---:|:---:|:---:|
| Chrome | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ |
| Firefox | ❌ | ✅ | ✅ |
| Safari | ❌ | ✅ | ✅ |

Firefox and Safari users can still use the on-screen keyboard with mouse or touch — only hardware MIDI input is unavailable.

---

## Deploying

Piano Master deploys to **GitHub Pages** (frontend) and **Heroku** (backend) automatically via GitHub Actions on every push to `main`.

```bash
# Frontend (GitHub Pages)
git push origin main   # triggers .github/workflows/deploy.yml

# Backend (Heroku)
heroku create piano-master-api
heroku config:set NODE_ENV=production
git push heroku main
```

Live URL after deployment: `https://Shayansimaei.github.io/noteflow/`

---

## Roadmap

- [ ] Metronome with BPM sync
- [ ] Record and play back your own sessions
- [ ] MusicXML import for richer sheet music
- [ ] Interval and chord ear training mode
- [ ] Custom sample packs — upload your own instrument sounds
- [ ] Mobile: Capacitor wrapper for iOS and Android with BLE-MIDI support
- [ ] Leaderboard and progress tracking with backend sync