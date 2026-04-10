<template>
  <div class="device-status" :class="`status--${midiStore.status}`">
    <div class="status-dot" />
    <span class="status-text">{{ statusText }}</span>
    <router-link to="/devices" class="devices-link">
      <span v-if="midiStore.hasDevices">
        {{ midiStore.connectedDevices.length }}
        {{ midiStore.connectedDevices.length === 1 ? 'device' : 'devices' }}
      </span>
      <span v-else>No devices</span>
      <ion-icon name="chevron-forward-outline" />
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon } from '@ionic/vue'
import { useMidiStore } from '@/stores/midi.store'

const midiStore = useMidiStore()

const statusText = computed(() => ({
  idle:       'MIDI',
  requesting: 'Connecting…',
  ready:      midiStore.hasDevices ? 'MIDI Ready' : 'No MIDI input',
  error:      'MIDI Error',
}[midiStore.status]))
</script>

<style scoped>
.device-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 999px;
  font-size: 0.75rem;
  font-family: var(--nf-font-mono);
  color: var(--nf-text-muted);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--nf-text-muted);
  flex-shrink: 0;
  transition: background 300ms ease;
}

.status--ready .status-dot  { background: var(--nf-accent); box-shadow: 0 0 6px var(--nf-accent); }
.status--error .status-dot  { background: var(--nf-error); }
.status--requesting .status-dot { background: var(--nf-warn); animation: pulse 1s infinite; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.status-text {
  flex: 1;
}

.devices-link {
  display: flex;
  align-items: center;
  gap: 2px;
  color: var(--nf-text-muted);
  text-decoration: none;
  transition: color 150ms;
}
.devices-link:hover { color: var(--nf-text); }
.devices-link ion-icon { font-size: 0.8rem; }
</style>
