import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/editor/:id',
    name: 'Editor',
    component: () => import('../views/EditorView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/share/:token',
    name: 'Share',
    component: () => import('../views/ShareView.vue'),
    meta: { guest: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('mindx_token')
  const isAuthenticated = !!token

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.meta.guest && isAuthenticated && to.path === '/login') {
    next('/')
  } else {
    next()
  }
})

export default router
