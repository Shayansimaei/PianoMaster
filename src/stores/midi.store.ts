import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MidiDevice, MidiEvent } from '@/types'

export type MidiStatus = 'idle' | 'requesting' | 'ready' | 'error'

export const useMidiStore = defineStore('midi', () => {
  const status = ref<MidiStatus>('idle')
  const devices = ref<MidiDevice[]>([])
  const activeNotes = ref<Map<number, MidiEvent>>(new Map())
  const lastEvent = ref<MidiEvent | null>(null)
  const selectedDeviceId = ref<string | null>(null)

  const connectedDevices = computed(() =>
    devices.value.filter(d => d.state === 'connected')
  )

  const hasDevices = computed(() => connectedDevices.value.length > 0)

  const latestNote = computed(() => lastEvent.value?.note ?? null)

  function setStatus(s: MidiStatus) {
    status.value = s
  }

  function setDevices(d: MidiDevice[]) {
    devices.value = d
    // auto-select first device if none selected
    if (!selectedDeviceId.value && d.length > 0) {
      selectedDeviceId.value = d[0].id
    }
  }

  function addDevice(d: MidiDevice) {
    const idx = devices.value.findIndex(x => x.id === d.id)
    if (idx >= 0) {
      devices.value[idx] = d
    } else {
      devices.value.push(d)
    }
    if (!selectedDeviceId.value) selectedDeviceId.value = d.id
  }

  function removeDevice(id: string) {
    devices.value = devices.value.filter(d => d.id !== id)
    if (selectedDeviceId.value === id) {
      selectedDeviceId.value = devices.value[0]?.id ?? null
    }
  }

  function handleMidiEvent(event: MidiEvent) {
    lastEvent.value = event
    if (event.type === 'noteOn') {
      activeNotes.value.set(event.note, event)
    } else {
      activeNotes.value.delete(event.note)
    }
  }

  function selectDevice(id: string) {
    selectedDeviceId.value = id
  }

  return {
    status,
    devices,
    activeNotes,
    lastEvent,
    selectedDeviceId,
    connectedDevices,
    hasDevices,
    latestNote,
    setStatus,
    setDevices,
    addDevice,
    removeDevice,
    handleMidiEvent,
    selectDevice,
  }
})
