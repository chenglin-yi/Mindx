import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api/index.js'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('mindx_token') || '')
  const user = ref(JSON.parse(localStorage.getItem('mindx_user') || 'null'))

  const isLoggedIn = computed(() => !!token.value)

  async function register(username, password) {
    const { data } = await api.post('/api/auth/register', { username, password })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('mindx_token', data.token)
    localStorage.setItem('mindx_user', JSON.stringify(data.user))
    return data
  }

  async function resetPassword(username, recoveryKey, newPassword) {
    const { data } = await api.post('/api/auth/reset-password', {
      username,
      recovery_key: recoveryKey,
      new_password: newPassword,
    })
    return data
  }

  async function login(username, password) {
    const { data } = await api.post('/api/auth/login', { username, password })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('mindx_token', data.token)
    localStorage.setItem('mindx_user', JSON.stringify(data.user))
    return data
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('mindx_token')
    localStorage.removeItem('mindx_user')
  }

  async function checkAuth() {
    if (!token.value) return false
    try {
      const { data } = await api.get('/api/auth/me')
      user.value = data.user
      return true
    } catch {
      logout()
      return false
    }
  }

  return { token, user, isLoggedIn, register, login, logout, checkAuth, resetPassword }
})
