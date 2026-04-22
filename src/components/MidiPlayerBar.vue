<template>
  <div class="player-bar" v-if="piece">

    <!-- ── Transport controls ─────────────────────────────────────────────── -->
    <div class="transport">
      <button class="ctrl-btn" @click="stop" title="Stop">
        <ion-icon :icon="stopOutline" />
      </button>

      <button class="ctrl-btn ctrl-btn--play" @click="togglePlay" :title="isPlaying ? 'Pause' : 'Play'">
        <ion-icon :icon="isPlaying ? pauseOutline : playOutline" />
      </button>

      <button class="ctrl-btn" @click="restart" title="Restart">
        <ion-icon :icon="playSkipBackOutline" />
      </button>
    </div>

    <!-- ── Seek bar ───────────────────────────────────────────────────────── -->
    <div class="seek-wrap">
      <span class="beat-label mono">{{ parseInt(beatDisplay) }}</span>
      <div class="seek-track" ref="seekTrack" @click="onSeekClick">
        <div class="seek-fill" :style="{ width: progressPct + '%' }" />
        <div class="seek-thumb" :style="{ left: progressPct + '%' }" />
      </div>
      <span class="beat-label mono">{{ parseInt(totalBeatsDisplay) }}</span>
    </div>

    <!-- ── Tempo & speed ──────────────────────────────────────────────────── -->
    <div class="tempo-wrap">
      <ion-icon name="speedometer-outline" class="tempo-icon" />
      <ion-select
        v-model="selectedSpeed"
        interface="popover"
        class="speed-select"
        @ion-change="onSpeedChange"
      >
        <ion-select-option :value="0.5">0.5×</ion-select-option>
        <ion-select-option :value="0.75">0.75×</ion-select-option>
        <ion-select-option :value="1.0">1×</ion-select-option>
        <ion-select-option :value="1.25">1.25×</ion-select-option>
        <ion-select-option :value="1.5">1.5×</ion-select-option>
      </ion-select>

      <span class="bpm-display mono">{{ Math.round(parseInt(beatDisplay) * selectedSpeed) }} BPM</span>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { IonIcon, IonSelect, IonSelectOption } from '@ionic/vue'
import { useMidiPlayer } from '@/composables/useMidiPlayer'
import type { SheetPiece } from '@/types'
import {playSkipBackOutline,pauseOutline,
playOutline,stopOutline} from 'ionicons/icons';

const props = defineProps<{ piece: SheetPiece | null, key:string }>()
const emit  = defineEmits<{
  /** Emits the current absolute beat so the sheet can highlight it */
  beatChange:  [beat: number]
  chordChange: [chordIdx: number]
}>()

const player = useMidiPlayer()
const selectedSpeed = ref(1.0)
const seekTrack     = ref<HTMLElement | null>(null)

const { isPlaying, progressPct, currentBeat, currentChord, totalBeats, bpm } = player

// Load piece whenever it changes
watch(() => props.piece, async (p) => {
  if (p) {
    await player.load(p)
    player.stop()
  }
}, { immediate: true })

// Emit reactive beat / chord for SheetDisplay cursor
watch(currentBeat,  b => emit('beatChange',  b))
watch(currentChord, c => emit('chordChange', c))

function togglePlay() {
  if (isPlaying.value) player.pause()
  else player.play()
}

function stop()    { player.stop() }
function restart() { player.stop(); player.play() }

function onSpeedChange(e: CustomEvent) {
  player.setTempo(e.detail.value)
}

function onSeekClick(e: MouseEvent) {
  if (!seekTrack.value || !player.totalBeats
.value) return
  const rect  = seekTrack.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  player.seek(ratio * player.totalBeats
.value)
}

const beatDisplay = computed(() => {
  const b = Math.floor(currentBeat.value)
  const ts = props.piece?.timeSignature[0] ?? 4
  return `${Math.floor(b / ts) + 1}:${(b % ts) + 1}`
})

const totalBeatsDisplay = computed(() => {
  const b  = Math.ceil(player.totalBeats
.value)
  const ts = props.piece?.timeSignature[0] ?? 4
  return `${Math.floor(b / ts) + 1}:${(b % ts) + 1}`
})

onUnmounted(() => player.stop())
</script>

<style scoped>
.player-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 12px;
  flex-wrap: wrap;
}

/* Transport */
.transport { display: flex; gap: 4px; align-items: center; }

.ctrl-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--nf-border);
  background: var(--nf-surface);
  color: var(--nf-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 120ms;
  font-size: 1rem;
}
.ctrl-btn:hover { border-color: var(--nf-text-muted); color: var(--nf-text); }

.ctrl-btn--play {
  width: 40px;
  height: 40px;
  background: var(--nf-accent);
  border-color: var(--nf-accent);
  color: #0a0a0f;
  font-size: 1.1rem;
}
.ctrl-btn--play:hover { background: var(--nf-accent-dim); border-color: var(--nf-accent-dim); color: #fff; }

/* Seek bar */
.seek-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.beat-label {
  font-size: 0.65rem;
  color: var(--nf-text-muted);
  min-width: 32px;
}

.seek-track {
  flex: 1;
  height: 4px;
  background: var(--nf-border);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
}
.seek-fill {
  height: 100%;
  background: var(--nf-accent);
  border-radius: 2px;
  transition: width 80ms linear;
}
.seek-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--nf-accent);
  box-shadow: 0 0 6px rgba(200,245,69,0.5);
  transition: left 80ms linear;
}

/* Tempo */
.tempo-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tempo-icon { color: var(--nf-text-muted); font-size: 1rem; }

.speed-select {
  --background: var(--nf-surface);
  --color: var(--nf-text-muted);
  border: 1px solid var(--nf-border);
  border-radius: 7px;
  font-family: var(--nf-font-mono);
  font-size: 0.72rem;
  width: 64px;
}

.bpm-display {
  font-size: 0.65rem;
  color: var(--nf-text-muted);
  min-width: 56px;
}
</style>
