<template>
  <ion-page>
    <ion-tabs>
      <!-- All tab pages render here -->
      <ion-router-outlet />

      <!-- ONE tab bar, defined once here only -->
      <ion-tab-bar slot="bottom">

        <ion-tab-button tab="play" href="/tabs/play">
          <ion-icon :icon="musicalNoteOutline" />
          <ion-label>Free Play</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="lesson" href="/tabs/lesson">
          <ion-icon :icon="schoolOutline" />
          <ion-label>Lessons</ion-label>
        </ion-tab-button>
         <ion-tab-button tab="chord" href="/tabs/chord">
          <ion-icon :icon="musicalNotesOutline" />
          <ion-label>Chords</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="sheet" href="/tabs/sheet">
          <ion-icon :icon="documentTextOutline" />
          <ion-label>Sheet</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="devices" href="/tabs/devices">
          <ion-icon :icon="hardwareChipOutline" />
          <ion-label>Devices</ion-label>
        </ion-tab-button>

      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonRouterOutlet,
  IonIcon,
  IonLabel,
} from '@ionic/vue'
  import { musicalNoteOutline,schoolOutline,documentTextOutline,hardwareChipOutline,musicalNotesOutline} from 'ionicons/icons';

</script>

<style scoped>
ion-tab-bar {
  --background: var(--nf-surface);
  --border-color: var(--nf-border);
  height: 60px;
}
ion-tab-button {
  --color: var(--nf-text-muted);
  --color-selected: var(--nf-accent);
  font-family: var(--nf-font-display);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}
ion-tab-button ion-icon {
  font-size: 1.3rem;
  margin-bottom: 2px;
}
</style>
