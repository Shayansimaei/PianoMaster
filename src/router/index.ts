import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/tabs/play',
  },
  {
    // The tabs shell owns /tabs and all its children
    path: '/tabs',
    component: () => import('@/views/TabsRoot.vue'),
    children: [
      {
        path: '',
        redirect: '/tabs/play',
      },
      {
        path: 'play',
        component: () => import('@/views/PlayPage.vue'),
      },
      {
        path: 'lesson',
        component: () => import('@/views/LessonPage.vue'),
      },
      {
        path: 'lesson/:id',
        component: () => import('@/views/LessonDetailPage.vue'),
      },
      {
        path: 'sheet',
        component: () => import('@/views/SheetMusicPage.vue'),
      },
      {
        path: 'devices',
        component: () => import('@/views/DevicesPage.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
