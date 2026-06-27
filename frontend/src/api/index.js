import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787',
  timeout: 10000,
})

// 请求拦截器：自动添加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mindx_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 自动跳转登录
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('mindx_token')
      localStorage.removeItem('mindx_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

export const mindmapApi = {
  getAll: (folderId) => api.get('/api/mindmaps', { params: { folder_id: folderId } }),
  getById: (id) => api.get(`/api/mindmaps/${id}`),
  create: (data) => api.post('/api/mindmaps', data),
  update: (id, data) => api.put(`/api/mindmaps/${id}`, data),
  delete: (id) => api.delete(`/api/mindmaps/${id}`),
  createShare: (id) => api.post(`/api/mindmaps/${id}/share`),
  deleteShare: (id) => api.delete(`/api/mindmaps/${id}/share`),
  getShared: (token) => api.get(`/api/shared/${token}`),
  importJson: (data) => api.post('/api/import/json', data),
}

export const folderApi = {
  getAll: () => api.get('/api/folders'),
  create: (data) => api.post('/api/folders', data),
  update: (id, data) => api.put(`/api/folders/${id}`, data),
  delete: (id) => api.delete(`/api/folders/${id}`),
}
