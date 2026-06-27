import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/editor/:id',
    name: 'editor',
    component: () => import('../views/EditorView.vue'),
  },
  {
    path: '/share/:token',
    name: 'share',
    component: () => import('../views/ShareView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
