<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import MindMap from 'simple-mind-map'
import { mindmapApi } from '../api'

const route = useRoute()
const mindmapContainer = ref(null)
const loading = ref(true)
const error = ref(null)
const title = ref('')
let mindmapInstance = null

onMounted(async () => {
  const token = route.params.token
  try {
    const { data } = await mindmapApi.getShared(token)
    title.value = data.title
    initMindmap(data.data)
  } catch (e) {
    error.value = '该思维导图未分享或不存在'
  } finally {
    loading.value = false
  }
})

function initMindmap(data) {
  if (!mindmapContainer.value) return

  mindmapInstance = new MindMap({
    el: mindmapContainer.value,
    data,
    readonly: true,
    initRootNodePosition: ['50%', '50%'],
    mousewheelCenter: false,
    disableMouseWheelZoom: false,
  })
}

onUnmounted(() => {
  if (mindmapInstance) {
    mindmapInstance.destroy()
  }
})
</script>

<template>
  <div class="share-view">
    <header class="share-header">
      <h1 class="logo">Mindx</h1>
      <span class="divider">|</span>
      <span class="title">{{ title }}</span>
      <span class="badge">只读分享</span>
    </header>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="mindmap-container" ref="mindmapContainer"></div>
  </div>
</template>

<style scoped>
.share-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.share-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e5e5e5;
}

.logo {
  font-size: 18px;
  font-weight: 700;
  color: #4f46e5;
}

.divider {
  color: #ddd;
}

.title {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  background: #e0e7ff;
  color: #4f46e5;
  border-radius: 10px;
}

.loading,
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 16px;
  color: #666;
}

.error {
  color: #e53e3e;
}

.mindmap-container {
  flex: 1;
}
</style>
