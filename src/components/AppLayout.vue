<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />

      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="play" href="/play">
          <ion-icon name="musical-notes-outline" />
          <ion-label>Free Play</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="lesson" href="/lesson">
          <ion-icon name="school-outline" />
          <ion-label>Lessons</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="sheet" href="/sheet">
          <ion-icon name="document-text-outline" />
          <ion-label>Sheet</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="devices" href="/devices">
          <ion-icon name="hardware-chip-outline" />
          <ion-label>Devices</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonTabs, IonTabBar, IonTabButton,
  IonIcon, IonLabel, IonRouterOutlet
} from '@ionic/vue'
</script>
