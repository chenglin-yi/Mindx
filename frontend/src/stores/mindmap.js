import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mindmapApi, folderApi } from '../api'

export const useMindmapStore = defineStore('mindmap', () => {
  const mindmaps = ref([])
  const folders = ref([])
  const currentMindmap = ref(null)
  const loading = ref(false)
  const currentFolderId = ref(null)

  // 当前文件夹下的文件夹
  const currentFolders = computed(() => {
    return folders.value.filter((f) => f.parent_id === currentFolderId.value)
  })

  // 当前文件夹下的思维导图
  const currentMindmaps = computed(() => {
    return mindmaps.value.filter((m) => m.folder_id === currentFolderId.value)
  })

  // 获取当前面包屑路径
  const breadcrumb = computed(() => {
    const path = [{ id: null, name: '全部文件' }]
    let folderId = currentFolderId.value
    while (folderId) {
      const folder = folders.value.find((f) => f.id === folderId)
      if (folder) {
        path.unshift({ id: folder.id, name: folder.name })
        folderId = folder.parent_id
      } else {
        break
      }
    }
    return path
  })

  async function fetchFolders() {
    try {
      const { data } = await folderApi.getList()
      folders.value = data
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    }
  }

  async function fetchMindmaps() {
    loading.value = true
    try {
      const { data } = await mindmapApi.getList()
      mindmaps.value = data
    } catch (error) {
      console.error('Failed to fetch mindmaps:', error)
    } finally {
      loading.value = false
    }
  }

  async function fetchMindmap(id) {
    loading.value = true
    try {
      const { data } = await mindmapApi.getById(id)
      currentMindmap.value = data
      return data
    } catch (error) {
      console.error('Failed to fetch mindmap:', error)
      return null
    } finally {
      loading.value = false
    }
  }

  async function createMindmap(title = '未命名思维导图', folderId = null) {
    try {
      const { data } = await mindmapApi.create({
        title,
        data: getDefaultMindmapData(title),
        folder_id: folderId,
      })
      mindmaps.value.unshift(data)
      return data
    } catch (error) {
      console.error('Failed to create mindmap:', error)
      return null
    }
  }

  async function updateMindmap(id, updates) {
    try {
      const { data } = await mindmapApi.update(id, updates)
      const index = mindmaps.value.findIndex((m) => m.id === id)
      if (index !== -1) {
        mindmaps.value[index] = data
      }
      if (currentMindmap.value?.id === id) {
        currentMindmap.value = data
      }
      return data
    } catch (error) {
      console.error('Failed to update mindmap:', error)
      return null
    }
  }

  async function deleteMindmap(id) {
    try {
      await mindmapApi.delete(id)
      mindmaps.value = mindmaps.value.filter((m) => m.id !== id)
      return true
    } catch (error) {
      console.error('Failed to delete mindmap:', error)
      return false
    }
  }

  async function createFolder(name) {
    try {
      const { data } = await folderApi.create({
        name,
        parent_id: currentFolderId.value,
      })
      folders.value.push(data)
      return data
    } catch (error) {
      console.error('Failed to create folder:', error)
      return null
    }
  }

  async function renameFolder(id, name) {
    try {
      const { data } = await folderApi.update(id, { name })
      const index = folders.value.findIndex((f) => f.id === id)
      if (index !== -1) {
        folders.value[index] = data
      }
      return data
    } catch (error) {
      console.error('Failed to rename folder:', error)
      return null
    }
  }

  async function deleteFolder(id) {
    try {
      await folderApi.delete(id)
      folders.value = folders.value.filter((f) => f.id !== id)
      // 重新获取思维导图（文件夹内的已移到根目录）
      await fetchMindmaps()
      return true
    } catch (error) {
      console.error('Failed to delete folder:', error)
      return false
    }
  }

  async function moveToFolder(mindmapId, folderId) {
    try {
      await mindmapApi.update(mindmapId, { folder_id: folderId })
      const index = mindmaps.value.findIndex((m) => m.id === mindmapId)
      if (index !== -1) {
        mindmaps.value[index].folder_id = folderId
      }
      return true
    } catch (error) {
      console.error('Failed to move to folder:', error)
      return false
    }
  }

  function navigateToFolder(folderId) {
    currentFolderId.value = folderId
  }

  function getDefaultMindmapData(title) {
    return {
      data: { text: title },
      children: [
        { data: { text: '分支 1' }, children: [] },
        { data: { text: '分支 2' }, children: [] },
        { data: { text: '分支 3' }, children: [] },
      ],
    }
  }

  return {
    mindmaps,
    folders,
    currentMindmap,
    loading,
    currentFolderId,
    currentFolders,
    currentMindmaps,
    breadcrumb,
    fetchFolders,
    fetchMindmaps,
    fetchMindmap,
    createMindmap,
    updateMindmap,
    deleteMindmap,
    createFolder,
    renameFolder,
    deleteFolder,
    moveToFolder,
    navigateToFolder,
  }
})
