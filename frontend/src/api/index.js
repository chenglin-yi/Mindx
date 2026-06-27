import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

export const mindmapApi = {
  getList(folderId) {
    const params = folderId ? { folder_id: folderId } : {}
    return api.get('/mindmaps', { params })
  },

  getById(id) {
    return api.get(`/mindmaps/${id}`)
  },

  create(data) {
    return api.post('/mindmaps', data)
  },

  update(id, data) {
    return api.put(`/mindmaps/${id}`, data)
  },

  delete(id) {
    return api.delete(`/mindmaps/${id}`)
  },

  // 分享
  createShare(id) {
    return api.post(`/mindmaps/${id}/share`)
  },

  removeShare(id) {
    return api.delete(`/mindmaps/${id}/share`)
  },

  getShared(token) {
    return api.get(`/shared/${token}`)
  },

  // 导入
  importJson(data) {
    return api.post('/import/json', data)
  },
}

export const folderApi = {
  getList() {
    return api.get('/folders')
  },

  create(data) {
    return api.post('/folders', data)
  },

  update(id, data) {
    return api.put(`/folders/${id}`, data)
  },

  delete(id) {
    return api.delete(`/folders/${id}`)
  },
}

export default api
