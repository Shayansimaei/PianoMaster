import { ref, readonly, onUnmounted } from 'vue'
import type { MidiDevice, MidiEvent } from '@/types'
import { useMidiStore } from '@/stores/midi.store'

type MidiMessageHandler = (event: MidiEvent) => void

let midiAccess: MIDIAccess | null = null
const handlers = new Set<MidiMessageHandler>()

// ─── Singleton MIDI access ──────────────────────────────────────────────────

async function requestAccess(): Promise<MIDIAccess | null> {
  if (midiAccess) return midiAccess
  if (!navigator.requestMIDIAccess) return null
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false })
    return midiAccess
  } catch {
    return null
  }
}

function parseMidiMessage(msg: MIDIMessageEvent, deviceName: string): MidiEvent | null {
  const data = msg.data
  if (!data || data.length < 2) return null
  const statusByte = data[0]
  const type = statusByte >> 4
  const channel = statusByte & 0x0f
  const note = data[1]
  const velocity = data.length > 2 ? data[2] : 0

  if (type === 0x9 && velocity > 0) {
    return { type: 'noteOn', note, velocity, channel, timestamp: msg.timeStamp, device: deviceName }
  }
  if (type === 0x8 || (type === 0x9 && velocity === 0)) {
    return { type: 'noteOff', note, velocity: 0, channel, timestamp: msg.timeStamp, device: deviceName }
  }
  return null
}

function attachInput(input: MIDIInput) {
  input.onmidimessage = (msg: MIDIMessageEvent) => {
    const event = parseMidiMessage(msg, input.name ?? 'Unknown')
    if (event) handlers.forEach(h => h(event))
  }
}

function detachInput(input: MIDIInput) {
  input.onmidimessage = null
}

function syncInputs(access: MIDIAccess, store: ReturnType<typeof useMidiStore>) {
  const devices: MidiDevice[] = []
  access.inputs.forEach(input => {
    attachInput(input)
    devices.push({
      id: input.id,
      name: input.name ?? 'Unknown Device',
      manufacturer: input.manufacturer ?? '',
      state: input.state as 'connected' | 'disconnected',
      type: 'input',
    })
  })
  store.setDevices(devices)
}

// ─── Composable ────────────────────────────────────────────────────────────

export function useMidi() {
  const store = useMidiStore()
  const supported = ref('requestMIDIAccess' in navigator)
  const permissionError = ref<string | null>(null)

  async function init() {
    if (!supported.value) {
      permissionError.value = 'Web MIDI API not supported in this browser.'
      return
    }

    store.setStatus('requesting')
    const access = await requestAccess()

    if (!access) {
      store.setStatus('error')
      permissionError.value = 'MIDI access was denied. Please allow MIDI in browser settings.'
      return
    }

    store.setStatus('ready')
    syncInputs(access, store)

    // ─── Dynamic device detection ────────────────────────────────────────
    access.onstatechange = (event: MIDIConnectionEvent) => {
      const port = event.port
      if (port!.type === 'input') {
        const input = port as MIDIInput

        if (port!.state === 'connected') {
          attachInput(input)
          store.addDevice({
            id: input.id,
            name: input.name ?? 'Unknown',
            manufacturer: input.manufacturer ?? '',
            state: 'connected',
            type: 'input',
          })
          console.log(`[NoteFlow] MIDI device connected: ${input.name}`)
        } else {
          detachInput(input)
          store.removeDevice(input.id)
          console.log(`[NoteFlow] MIDI device disconnected: ${input.name}`)
        }
      }
    }
  }

  function onMidiEvent(handler: MidiMessageHandler) {
    handlers.add(handler)
    onUnmounted(() => handlers.delete(handler))
  }

  function cleanup() {
    if (midiAccess) {
      midiAccess.inputs.forEach(input => detachInput(input))
    }
  }

  return {
    supported: readonly(supported),
    permissionError: readonly(permissionError),
    status: store.status,
    devices: store.devices,
    init,
    onMidiEvent,
    cleanup,
  }
}
