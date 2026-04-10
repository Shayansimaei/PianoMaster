<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Lessons</ion-title>
        <ion-buttons slot="end">
          <DeviceStatusBar />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="lesson-layout">
        <p class="intro-text">
          Work through structured exercises — from single notes to full scales and intervals.
        </p>

        <div class="filter-row">
          <button
            v-for="f in filters"
            :key="f"
            class="filter-pill"
            :class="{ 'filter-pill--active': activeFilter === f }"
            @click="activeFilter = f"
          >
            {{ f }}
          </button>
        </div>

        <div class="lesson-list">
          <div
            v-for="lesson in filteredLessons"
            :key="lesson.id"
            class="lesson-card"
            :class="`lesson-card--${lesson.difficulty}`"
            @click="openLesson(lesson.id)"
          >
            <div class="lesson-header">
              <span class="difficulty-badge">{{ lesson.difficulty }}</span>
              <span v-if="lesson.status === 'completed'" class="status-badge status-badge--done">✓ Done</span>
              <span v-else-if="lesson.status === 'in-progress'" class="status-badge status-badge--progress">In progress</span>
            </div>
            <h3 class="lesson-title">{{ lesson.title }}</h3>
            <p class="lesson-desc">{{ lesson.description }}</p>
            <div class="lesson-footer">
              <span class="step-count mono">{{ lesson.steps.length }} notes</span>
              <div class="tag-list">
                <span v-for="tag in lesson.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
              <div v-if="lesson.highScore" class="high-score mono">Best: {{ lesson.highScore }}%</div>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
} from '@ionic/vue'
import DeviceStatusBar from '@/components/DeviceStatusBar.vue'
import { useLessonStore } from '@/stores/lesson.store'

const router = useRouter()
const lessonStore = useLessonStore()

type Filter = 'All' | 'beginner' | 'intermediate' | 'advanced' | 'chords' | 'progression' | 'jazz' | 'scales'
const filters: Filter[] = ['All', 'beginner', 'intermediate', 'advanced', 'chords', 'progression', 'jazz', 'scales']
const activeFilter = ref<Filter>('All')

const filteredLessons = computed(() => {
  if (activeFilter.value === 'All') return lessonStore.lessons
  if (activeFilter.value === 'beginner' || activeFilter.value === 'intermediate' || activeFilter.value === 'advanced') {
    return lessonStore.lessons.filter(l => l.difficulty === activeFilter.value)
  }
  // Tag-based filters
  return lessonStore.lessons.filter(l => l.tags.includes(activeFilter.value))
})

function openLesson(id: string) {
  router.push(`/tabs/lesson/${id}`)
}
</script>

<style scoped>
.lesson-layout { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.intro-text { font-size: 0.85rem; color: var(--nf-text-muted); margin: 0; line-height: 1.5; }
.filter-row { display: flex; gap: 8px; flex-wrap: wrap; }
.filter-pill {
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid var(--nf-border);
  background: transparent;
  color: var(--nf-text-muted);
  font-family: var(--nf-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 150ms;
  text-transform: capitalize;
}
.filter-pill:hover { border-color: var(--nf-text-muted); color: var(--nf-text); }
.filter-pill--active { background: var(--nf-accent); border-color: var(--nf-accent); color: #0a0a0f; }
.lesson-list { display: flex; flex-direction: column; gap: 12px; }
.lesson-card {
  background: var(--nf-surface-2);
  border: 1px solid var(--nf-border);
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  transition: border-color 150ms, transform 100ms;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lesson-card:hover { border-color: var(--nf-text-muted); transform: translateY(-1px); }
.lesson-card--beginner     { border-left: 3px solid var(--nf-accent); }
.lesson-card--intermediate { border-left: 3px solid var(--nf-blue); }
.lesson-card--advanced     { border-left: 3px solid var(--nf-error); }
.lesson-header { display: flex; align-items: center; gap: 8px; }
.difficulty-badge { font-family: var(--nf-font-mono); font-size: 0.6rem; letter-spacing: 0.1em; color: var(--nf-text-muted); text-transform: uppercase; }
.status-badge { font-family: var(--nf-font-mono); font-size: 0.62rem; padding: 2px 8px; border-radius: 999px; }
.status-badge--done     { background: rgba(200,245,69,0.15); color: var(--nf-accent); }
.status-badge--progress { background: rgba(255,184,48,0.15); color: var(--nf-warn); }
.lesson-title { font-size: 1rem; font-weight: 700; color: var(--nf-text); margin: 0; letter-spacing: -0.01em; }
.lesson-desc  { font-size: 0.8rem; color: var(--nf-text-muted); margin: 0; line-height: 1.45; }
.lesson-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.step-count { font-size: 0.7rem; color: var(--nf-text-muted); }
.tag-list { display: flex; gap: 5px; flex-wrap: wrap; }
.tag { font-size: 0.62rem; padding: 2px 7px; background: var(--nf-surface); border: 1px solid var(--nf-border); border-radius: 5px; color: var(--nf-text-muted); font-family: var(--nf-font-mono); }
.high-score { font-size: 0.7rem; color: var(--nf-accent); margin-left: auto; }
</style>
