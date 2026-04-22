<template>
  <ion-modal :is-open="isOpen" @did-dismiss="$emit('close')" :breakpoints="[0, 0.9]" :initial-breakpoint="0.9">
    <ion-header>
      <ion-toolbar>
        <ion-title>Import from Text</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">✕</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="modal-content">
      <div class="import-layout">

        <!-- Format reference -->
        <div class="format-guide">
          <p class="guide-title mono">FORMAT</p>
          <div class="guide-rows">
            <div class="guide-row"><code>A3</code><span>Single note (note + octave)</span></div>
            <div class="guide-row"><code>[A3D4]</code><span>Chord (notes in brackets)</span></div>
            <div class="guide-row"><code>D5A5F5</code><span>Quick notes (concatenated)</span></div>
            <div class="guide-row"><code>[A3D4ı]</code><span>Dotted (ı = 1.5x duration)</span></div>
            <div class="guide-row"><code>Line 1</code><span>Right hand</span></div>
            <div class="guide-row"><code>Line 2</code><span>Left hand (alternates)</span></div>
            <div class="guide-row"><code>BPM=90</code><span>Set tempo anywhere</span></div>
          </div>
        </div>

        <!-- Metadata -->
        <div class="meta-row">
          <div class="meta-field">
            <label class="field-label mono">TITLE</label>
            <input v-model="titleInput" class="text-input" placeholder="My piece" />
          </div>
          <div class="meta-field meta-field--sm">
            <label class="field-label mono">BPM</label>
            <input v-model.number="bpmInput" type="number" min="40" max="240" class="text-input" placeholder="120" />
          </div>
        </div>

        <!-- Text area -->
        <div class="textarea-wrap">
          <textarea
            v-model="notation"
            class="notation-input"
            :placeholder="PLACEHOLDER"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
          />
        </div>

        <!-- Parse error -->
        <div v-if="parseError" class="parse-error">
          <ion-icon name="warning-outline" />
          {{ parseError }}
        </div>

        <!-- Preview counts -->
        <div v-if="preview" class="preview-bar mono">
          ✓ {{ preview.measures.length }} bars · {{ previewNoteCount }} notes · {{ preview.bpm }} BPM
        </div>

        <!-- Actions -->
        <div class="action-row">
          <ion-button fill="outline" @click="parsePreview">Preview</ion-button>
          <ion-button :disabled="!preview" @click="confirm">
            Add to sheet
            <ion-icon slot="end" name="arrow-forward-outline" />
          </ion-button>
        </div>

      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon,
} from '@ionic/vue'
import { textToSheetPiece } from '@/utils/textToSheetPiece'
import type { SheetPiece } from '@/types'

const props = defineProps<{ isOpen: boolean }>()
const emit  = defineEmits<{
  close:  []
  import: [piece: SheetPiece]
}>()

const PLACEHOLDER = `[A3D4ı] G6F6G6A6 [A3C#4F#4] [A3C4ı] G6F6G6A6F6 [A3B3ı]
D4 D5A5F5 D5A5F5 A4 C#5A5G5 C#5A5G5`

const notation   = ref('')
const titleInput = ref('')
const bpmInput   = ref<number | ''>('')
const preview    = ref<SheetPiece | null>(null)
const parseError = ref<string | null>(null)

const previewNoteCount = computed(() =>
  preview.value?.measures.reduce((s, m) => s + m.notes.length, 0) ?? 0
)

function parsePreview() {
  parseError.value = null
  preview.value    = null

  if (!notation.value.trim()) {
    parseError.value = 'Paste some notation first.'
    return
  }

  try {
    const piece = textToSheetPiece(
      notation.value,
      titleInput.value || undefined,
      bpmInput.value ? Number(bpmInput.value) : undefined,
    )
    if (!piece.measures.length) {
      parseError.value = 'No notes detected. Check your format — use A3, C#4, [A3D4], etc.'
      return
    }
    preview.value = piece
  } catch (e) {
    parseError.value = `Parse error: ${(e as Error).message}`
  }
}

function confirm() {
  if (!preview.value) return
  emit('import', preview.value)
  emit('close')
  notation.value   = ''
  titleInput.value = ''
  bpmInput.value   = ''
  preview.value    = null
}
</script>

<style scoped>
.modal-content { --background: var(--nf-bg); }

.import-layout {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Format guide */
.format-guide {
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 10px;
  padding: 12px 14px;
}
.guide-title { font-size: 0.6rem; letter-spacing: 0.12em; color: var(--nf-text); margin: 0 0 8px; }
.guide-rows  { display: flex; flex-direction: column; gap: 5px; }
.guide-row   { display: flex; align-items: center; gap: 10px; font-size: 0.78rem; }
.guide-row code {
  font-family: var(--nf-font-mono);
  background: var(--nf-surface);
  border: 1px solid var(--nf-border);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--nf-accent);
  min-width: 80px;
  display: inline-block;
}
.guide-row span { color: var(--nf-text); }

/* Metadata */
.meta-row   { display: flex; gap: 10px; }
.meta-field { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.meta-field--sm { flex: 0 0 80px; }
.field-label {
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: var(--nf-text);
}
.text-input {
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 8px;
  color: var(--nf-text);
  font-family: var(--nf-font-display);
  font-size: 0.88rem;
  padding: 8px 10px;
  width: 100%;
  outline: none;
  transition: border-color 150ms;
}
.text-input:focus { border-color: var(--nf-accent); }

/* Textarea */
.textarea-wrap { display: flex; flex-direction: column; }
.notation-input {
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 10px;
  color: var(--nf-text);
  font-family: var(--nf-font-mono);
  font-size: 0.82rem;
  line-height: 1.6;
  padding: 12px;
  min-height: 140px;
  resize: vertical;
  outline: none;
  transition: border-color 150ms;
  width: 100%;
}
.notation-input:focus { border-color: var(--nf-accent); }
.notation-input::placeholder { color: var(--nf-text); }

/* Feedback */
.parse-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(255,79,106,0.1);
  border: 1px solid var(--nf-error);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--nf-error);
}
.preview-bar {
  font-size: 0.75rem;
  color: var(--nf-accent);
  background: rgba(200,245,69,0.08);
  border: 1px solid var(--nf-accent-dim);
  border-radius: 8px;
  padding: 8px 12px;
}

/* Actions */
.action-row {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
