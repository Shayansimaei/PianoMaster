<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>MIDI Devices</ion-title>
      </ion-toolbar>
      
    </ion-header>

    <ion-content>
      <div class="devices-layout">

        <!-- Status card -->
        <div class="status-card" :class="`status-card--${midiStore.status}`">
          <div class="status-icon">
            <ion-icon :icon="statusIcon" />
          </div>
          <div class="status-info">
            <p class="status-title">{{ statusTitle }}</p>
            <p class="status-desc">{{ statusDesc }}</p>
          </div>
          <ion-button
            v-if="midiStore.status === 'idle' || midiStore.status === 'error'"
            size="small"
            @click="initMidi"
          >
            {{ midiStore.status === 'error' ? 'Retry' : 'Connect' }}
          </ion-button>
        </div>

        <!-- Not supported warning -->
        <div v-if="!midi.supported.value" class="unsupported-box">
          <ion-icon :icon="alertCircleOutline" />
          <div>
            <strong>Web MIDI not supported</strong>
            <p>Use Chrome or Edge on desktop for full MIDI support.</p>
          </div>
        </div>

        <!-- Connected devices -->
        <div v-if="midiStore.connectedDevices.length > 0">
          <h3 class="section-title">Connected Inputs</h3>
          <div class="device-list">
            <div
              v-for="device in midiStore.connectedDevices"
              :key="device.id"
              class="device-card"
              :class="{ 'device-card--selected': midiStore.selectedDeviceId === device.id }"
              @click="midiStore.selectDevice(device.id)"
            >
              <div class="device-icon">
                <ion-icon :icon="musicalNotesOutline" />
              </div>
              <div class="device-info">
                <p class="device-name">{{ device.name }}</p>
                <p class="device-manufacturer mono">{{ device.manufacturer || 'Unknown manufacturer' }}</p>
                <p class="device-id mono">ID: {{ device.id }}</p>
              </div>
              <div class="device-status">
                <span class="connected-dot" />
                <span class="mono">Connected</span>
              </div>
            </div>
          </div>
        </div>

        <!-- No devices -->
        <div v-else-if="midiStore.status === 'ready'" class="empty-state">
          <ion-icon :icon="hardwareChipOutline" class="empty-icon" />
          <h3>No MIDI devices detected</h3>
          <p>Plug in a MIDI keyboard or controller via USB, then refresh.</p>
          <ion-button fill="outline" @click="initMidi">
            <ion-icon slot="start" :icon="refreshOutline" />
            Refresh
          </ion-button>
        </div>

        <!-- Live MIDI monitor -->
        <div v-if="midiStore.status === 'ready'" class="monitor-section">
          <h3 class="section-title">Live MIDI Monitor</h3>
          <div class="monitor-box">
            <div v-if="!lastEvent" class="monitor-idle mono">
              Waiting for MIDI input…
            </div>
            <div v-else class="monitor-event">
              <div class="monitor-row">
                <span class="monitor-label">Type</span>
                <span class="mono monitor-val" :class="lastEvent.type === 'noteOn' ? 'val--on' : 'val--off'">
                  {{ lastEvent.type }}
                </span>
              </div>
              <div class="monitor-row">
                <span class="monitor-label">Note</span>
                <span class="mono monitor-val">{{ lastEvent.note }} — {{ noteLabel }}</span>
              </div>
              <div class="monitor-row">
                <span class="monitor-label">Velocity</span>
                <span class="mono monitor-val">{{ lastEvent.velocity }}</span>
              </div>
              <div class="monitor-row">
                <span class="monitor-label">Channel</span>
                <span class="mono monitor-val">{{ lastEvent.channel }}</span>
              </div>
              <div class="monitor-row">
                <span class="monitor-label">Device</span>
                <span class="mono monitor-val">{{ lastEvent.device }}</span>
              </div>
            </div>

            <!-- Active notes display -->
            <div class="active-notes" v-if="midiStore.activeNotes.size > 0">
              <span class="monitor-label">Active notes:</span>
              <div class="active-note-pills">
                <span
                  v-for="[note] in midiStore.activeNotes"
                  :key="note"
                  class="active-pill mono"
                >
                  {{ midiToNoteInfo(note).label }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tips -->
        <div class="tips-section">
          <h3 class="section-title">Tips</h3>
          <div class="tip-list">
            <div class="tip">
              <ion-icon :icon="bulbOutline" />
              <p>MIDI devices are detected automatically — just plug in and play.</p>
            </div>
            <div class="tip">
              <ion-icon :icon="bulbOutline" />
              <p>Chrome and Edge have the best Web MIDI support. Safari does not support it.</p>
            </div>
            <div class="tip">
              <ion-icon :icon="bulbOutline" />
              <p>If your device isn't detected, try unplugging and replugging it.</p>
            </div>
          </div>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonIcon
} from '@ionic/vue'
import { useMidi } from '@/composables/useMidi'
import { useMidiStore } from '@/stores/midi.store'
import { midiToNoteInfo } from '@/utils/noteEngine'
import { bulbOutline,hardwareChipOutline,
refreshOutline,musicalNotesOutline,alertCircleOutline,starOutline} from 'ionicons/icons';

const midi = useMidi()
const midiStore = useMidiStore()

const lastEvent = computed(() => midiStore.lastEvent)
const noteLabel = computed(() =>
  lastEvent.value ? midiToNoteInfo(lastEvent.value.note).label : ''
)

const statusIcon = computed(() => ({
  idle:       'hardware-chip-outline',
  requesting: 'hourglass-outline',
  ready:      'checkmark-circle-outline',
  error:      'alert-circle-outline'
}[midiStore.status]))

const statusTitle = computed(() => ({
  idle:       'MIDI not initialized',
  requesting: 'Requesting access…',
  ready:      'MIDI ready',
  error:      'MIDI access denied'
}[midiStore.status]))

const statusDesc = computed(() => ({
  idle:       'Tap Connect to enable MIDI input.',
  requesting: 'Please allow MIDI access in your browser.',
  ready:      `Listening on ${midiStore.connectedDevices.length} device(s). Plug/unplug to update automatically.`,
  error:      'Allow MIDI access in browser site settings, then retry.'
}[midiStore.status]))

async function initMidi() {
  await midi.init()
}

midi.onMidiEvent(event => midiStore.handleMidiEvent(event))

onMounted(async () => {
  if (midiStore.status === 'idle') await midi.init()
})
</script>

<style scoped>
.devices-layout {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Status card ───────────────────────────────────────── */
.status-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--nf-border);
  background: var(--nf-surface-2);
  transition: border-color 300ms;
}
.status-card--ready  { border-color: var(--nf-accent); }
.status-card--error  { border-color: var(--nf-error); }
.status-card--requesting { border-color: var(--nf-warn); }

.status-icon { font-size: 1.8rem; flex-shrink: 0; }
.status-card--ready      .status-icon { color: var(--nf-accent); }
.status-card--error      .status-icon { color: var(--nf-error); }
.status-card--requesting .status-icon { color: var(--nf-warn); animation: spin 1.5s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

.status-info { flex: 1; }
.status-title { font-weight: 700; font-size: 0.9rem; margin: 0 0 3px; }
.status-desc  { font-size: 0.78rem; color: var(--nf-text-muted); margin: 0; line-height: 1.4; }

/* ── Unsupported ────────────────────────────────────────── */
.unsupported-box {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  background: rgba(255,79,106,0.1);
  border: 1px solid var(--nf-error);
  border-radius: 12px;
  font-size: 0.82rem;
  color: var(--nf-error);
}
.unsupported-box ion-icon { font-size: 1.4rem; flex-shrink: 0; margin-top: 2px; }
.unsupported-box p { margin: 4px 0 0; color: var(--nf-text-muted); }

/* ── Section title ──────────────────────────────────────── */
.section-title {
  font-size: 0.7rem;
  font-family: var(--nf-font-mono);
  letter-spacing: 0.12em;
  color: var(--nf-text-muted);
  text-transform: uppercase;
  margin: 0 0 10px;
}

/* ── Device list ────────────────────────────────────────── */
.device-list { display: flex; flex-direction: column; gap: 10px; }

.device-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 150ms;
}
.device-card:hover { border-color: var(--nf-text-muted); }
.device-card--selected { border-color: var(--nf-accent); background: rgba(200,245,69,0.04); }

.device-icon {
  font-size: 1.6rem;
  color: var(--nf-accent);
  flex-shrink: 0;
}

.device-info { flex: 1; }
.device-name { font-weight: 700; font-size: 0.9rem; margin: 0 0 3px; }
.device-manufacturer { font-size: 0.72rem; color: var(--nf-text-muted); margin: 0; }
.device-id { font-size: 0.65rem; color: var(--nf-text-dim); margin: 3px 0 0; }

.device-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 0.62rem;
  color: var(--nf-accent);
  font-family: var(--nf-font-mono);
}
.connected-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--nf-accent);
  box-shadow: 0 0 6px var(--nf-accent);
}

/* ── Empty state ────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 32px 20px;
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 14px;
  color: var(--nf-text-muted);
}
.empty-icon { font-size: 2.4rem; color: var(--nf-text-dim); }
.empty-state h3 { margin: 0; font-size: 1rem; color: var(--nf-text); }
.empty-state p  { margin: 0; font-size: 0.82rem; line-height: 1.5; }

/* ── Monitor ────────────────────────────────────────────── */
.monitor-box {
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.monitor-idle { color: var(--nf-text-muted); font-size: 0.8rem; text-align: center; padding: 10px; }
.monitor-event { display: flex; flex-direction: column; gap: 6px; }
.monitor-row { display: flex; justify-content: space-between; align-items: center; }
.monitor-label { font-size: 0.7rem; color: var(--nf-text-muted); }
.monitor-val { font-size: 0.82rem; }
.val--on  { color: var(--nf-accent); }
.val--off { color: var(--nf-text-muted); }

.active-notes { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.active-note-pills { display: flex; gap: 6px; flex-wrap: wrap; }
.active-pill {
  background: rgba(200,245,69,0.15);
  color: var(--nf-accent);
  border: 1px solid var(--nf-accent-dim);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 0.75rem;
}

/* ── Tips ───────────────────────────────────────────────── */
.tip-list { display: flex; flex-direction: column; gap: 10px; }
.tip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.82rem;
  color: var(--nf-text-muted);
  line-height: 1.45;
}
.tip ion-icon { font-size: 1rem; color: var(--nf-warn); flex-shrink: 0; margin-top: 2px; }
.tip p { margin: 0; }

ion-tab-bar { --background: var(--nf-surface); --border-color: var(--nf-border); }
ion-tab-button { --color: var(--nf-text-muted); --color-selected: var(--nf-accent); }
</style>
