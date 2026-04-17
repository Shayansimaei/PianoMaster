import { ref, reactive, readonly } from 'vue'
import * as Tone from 'tone'
import { midiToNoteInfo } from '@/utils/noteEngine'

// ─── Salamander Grand Piano samples (hosted by Tone.js) ────────────────────
// Uses free Salamander Grand Piano samples via tonejs CDN
const SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/'

const SAMPLE_URLS: Record<string, string> = {
  A0:  'A0.mp3',  C1:  'C1.mp3',  'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  A1:  'A1.mp3',  C2:  'C2.mp3',  'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2:  'A2.mp3',  C3:  'C3.mp3',  'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3:  'A3.mp3',  C4:  'C4.mp3',  'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4:  'A4.mp3',  C5:  'C5.mp3',  'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5:  'A5.mp3',  C6:  'C6.mp3',  'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  A6:  'A6.mp3',  C7:  'C7.mp3',  'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
  A7:  'A7.mp3',  C8:  'C8.mp3',
}

const urlsWithBase: Record<string, string> = {}
for (const [k, v] of Object.entries(SAMPLE_URLS)) {
  urlsWithBase[k] = SAMPLE_BASE + v
}

// ─── State ─────────────────────────────────────────────────────────────────
let sampler: Tone.Sampler | null = null
const activeNotes = reactive(new Set<number>())

export function useAudioSampler() {
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const volume = ref(0) // dB
  let timeOut=setInterval(async ()=>{
    if(!loaded.value)
      await init()

  },2000)
  async function init() {
    if (sampler && loaded.value) return loaded.value
    loading.value = true
    error.value = null
    await Tone.start()
    timeOut
    return new Promise<void>((resolve, reject) => {
      sampler = new Tone.Sampler({
        urls: urlsWithBase,
        onload: () => {
          loaded.value = true
          loading.value = false
          clearInterval(timeOut)
          resolve()
        },
        onerror: (err) => {
          error.value = 'Failed to load audio samples.'
          loading.value = false
          console.error('[Sampler] Load error:', err)
          reject(err)
        },
      }).toDestination()
    })
  }

  function noteOn(midi: number, velocity = 100) {
    if (!sampler || !loaded.value) {
      return


    } 
    const { label } = midiToNoteInfo(midi)
    const gainDb = Tone.gainToDb(velocity / 127)
    sampler.triggerAttack(label, Tone.now(), velocity / 127)
    activeNotes.add(midi)
  }

  function noteOff(midi: number) {
    if (!sampler || !loaded.value) return
    const { label } = midiToNoteInfo(midi)
    sampler.triggerRelease(label, Tone.now())
    activeNotes.delete(midi)
  }

  function noteOnce(midi: number, velocity = 100) {
    noteOn(midi, velocity)
    setTimeout(() => noteOff(midi), 800)
  }

  function setVolume(db: number) {
    volume.value = db
    if (sampler) sampler.volume.value = db
  }

  function allNotesOff() {
    if (!sampler) return
    sampler.releaseAll()
    activeNotes.clear()
  }

  return {
    loaded: readonly(loaded),
    loading: readonly(loading),
    error: readonly(error),
    volume,
    activeNotes: readonly(activeNotes),
    init,
    noteOn,
    noteOff,
    noteOnce,
    setVolume,
    allNotesOff,
  }
}
