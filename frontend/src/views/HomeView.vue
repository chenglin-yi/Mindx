<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMindmapStore } from '../stores/mindmap'
import { mindmapApi } from '../api'
import JSZip from 'jszip'

const router = useRouter()
const store = useMindmapStore()

// 对话框状态
const showCreateDialog = ref(false)
const showFolderDialog = ref(false)
const showImportDialog = ref(false)
const showShareDialog = ref(false)
const showMoveDialog = ref(false)
const newTitle = ref('')
const newFolderName = ref('')
const editingFolderId = ref(null)

// 分享相关
const shareMindmapId = ref(null)
const shareToken = ref('')
const shareUrl = ref('')

// 移动相关
const movingMindmapId = ref(null)
const moveTargetFolderId = ref(null)

// 导入相关
const importFile = ref(null)
const importPreview = ref(null)
const importError = ref('')

// 右键菜单
const contextMenu = ref({ show: false, x: 0, y: 0, type: '', item: null })

// 侧边栏展开状态
const sidebarOpen = ref(true)

onMounted(async () => {
  await Promise.all([store.fetchMindmaps(), store.fetchFolders()])
})

// ==================== 思维导图操作 ====================

async function handleCreate() {
  const title = newTitle.value.trim() || '未命名思维导图'
  const result = await store.createMindmap(title, store.currentFolderId)
  if (result) {
    showCreateDialog.value = false
    newTitle.value = ''
    router.push(`/editor/${result.id}`)
  }
}

async function handleDeleteMindmap(id, e) {
  e?.stopPropagation()
  if (confirm('确定要删除这个思维导图吗？')) {
    await store.deleteMindmap(id)
  }
}

// ==================== 文件夹操作 ====================

function openCreateFolderDialog() {
  editingFolderId.value = null
  newFolderName.value = ''
  showFolderDialog.value = true
}

function openRenameFolderDialog(folder, e) {
  e?.stopPropagation()
  editingFolderId.value = folder.id
  newFolderName.value = folder.name
  showFolderDialog.value = true
}

async function handleSaveFolder() {
  const name = newFolderName.value.trim()
  if (!name) return

  if (editingFolderId.value) {
    await store.renameFolder(editingFolderId.value, name)
  } else {
    await store.createFolder(name)
  }

  showFolderDialog.value = false
  newFolderName.value = ''
  editingFolderId.value = null
}

async function handleDeleteFolder(id, e) {
  e?.stopPropagation()
  if (confirm('确定要删除这个文件夹吗？文件夹内的思维导图将移到根目录。')) {
    await store.deleteFolder(id)
  }
}

function navigateToFolder(folderId) {
  store.navigateToFolder(folderId)
}

// ==================== 导入操作 ====================

function openImportDialog() {
  importFile.value = null
  importPreview.value = null
  importError.value = ''
  showImportDialog.value = true
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return

  importFile.value = file
  importError.value = ''
  importPreview.value = null

  const reader = new FileReader()
  reader.onload = async (event) => {
    try {
      const content = event.target.result

      if (file.name.endsWith('.xmind')) {
        try {
          const data = await parseXmind(content)
          importPreview.value = { title: file.name.replace('.xmind', ''), data }
        } catch (err) {
          importError.value = 'XMind 文件解析失败: ' + err.message
        }
      } else {
        // JSON 和 Markdown 以文本方式处理
        const text = typeof content === 'string' ? content : new TextDecoder().decode(content)

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text)
          if (parsed.data && parsed.data.text) {
            importPreview.value = { title: file.name.replace('.json', ''), data: parsed }
          } else if (parsed.root) {
            importPreview.value = { title: file.name.replace('.json', ''), data: parsed.root }
          } else {
            importError.value = '无法识别的 JSON 格式'
          }
        } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
          const data = parseMarkdown(text)
          importPreview.value = { title: file.name.replace(/\.(md|markdown)$/, ''), data }
        } else {
          importError.value = '不支持的文件格式，请选择 JSON、Markdown 或 XMind 文件'
        }
      }
    } catch (err) {
      importError.value = '文件解析失败: ' + err.message
    }
  }
  reader.readAsArrayBuffer(file)
}

async function parseXmind(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)

  // XMind 8+ 格式: content.json
  const contentFile = zip.file('content.json')
  if (contentFile) {
    const contentStr = await contentFile.async('string')
    const sheets = JSON.parse(contentStr)
    const sheet = Array.isArray(sheets) ? sheets[0] : sheets
    if (sheet && sheet.rootTopic) {
      return xmindTopicToNode(sheet.rootTopic)
    }
  }

  // XMind 旧格式: content.xml
  const xmlFile = zip.file('content.xml')
  if (xmlFile) {
    const xmlStr = await xmlFile.async('string')
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlStr, 'text/xml')
    const topic = xmlDoc.querySelector('topic')
    if (topic) {
      return xmindXmlToNode(topic)
    }
  }

  throw new Error('无法识别的 XMind 格式')
}

function xmindTopicToNode(topic) {
  const node = {
    data: {
      text: topic.title || '未命名',
    },
    children: [],
  }

  if (topic.children && topic.children.attached) {
    node.children = topic.children.attached.map((child) => xmindTopicToNode(child))
  }

  return node
}

function xmindXmlToNode(topicEl) {
  const titleEl = topicEl.querySelector(':scope > title')
  const node = {
    data: { text: titleEl ? titleEl.textContent : '未命名' },
    children: [],
  }

  const childrenEl = topicEl.querySelector(':scope > children')
  if (childrenEl) {
    const topics = childrenEl.querySelectorAll(':scope > topics > topic')
    topics.forEach((child) => {
      node.children.push(xmindXmlToNode(child))
    })
  }

  return node
}

function parseMarkdown(text) {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length === 0) {
    return { data: { text: '根节点' }, children: [] }
  }

  const root = { data: { text: lines[0].replace(/^#+\s*/, '') }, children: [] }
  const stack = [{ node: root, level: 0 }]

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/)

    let level, text
    if (match) {
      level = match[1].length
      text = match[2]
    } else if (bulletMatch) {
      const indent = bulletMatch[1].length
      level = Math.floor(indent / 2) + 2
      text = bulletMatch[2]
    } else {
      continue
    }

    const newNode = { data: { text }, children: [] }

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    stack[stack.length - 1].node.children.push(newNode)
    stack.push({ node: newNode, level })
  }

  return root
}

async function handleImport() {
  if (!importPreview.value) return

  try {
    await mindmapApi.importJson({
      title: importPreview.value.title,
      data: importPreview.value.data,
      folder_id: store.currentFolderId,
    })
    await store.fetchMindmaps()
    showImportDialog.value = false
    importPreview.value = null
  } catch (err) {
    importError.value = '导入失败: ' + err.message
  }
}

// ==================== 分享操作 ====================

async function openShareDialog(mindmap, e) {
  e?.stopPropagation()
  shareMindmapId.value = mindmap.id
  shareToken.value = mindmap.share_token || ''
  shareUrl.value = ''
  showShareDialog.value = true

  if (mindmap.share_token) {
    shareUrl.value = `${window.location.origin}/share/${mindmap.share_token}`
  }
}

async function handleCreateShare() {
  try {
    const { data } = await mindmapApi.createShare(shareMindmapId.value)
    shareToken.value = data.share_token
    shareUrl.value = `${window.location.origin}/share/${data.share_token}`
    const index = store.mindmaps.findIndex((m) => m.id === shareMindmapId.value)
    if (index !== -1) {
      store.mindmaps[index].share_token = data.share_token
    }
  } catch (err) {
    alert('创建分享链接失败')
  }
}

async function handleRemoveShare() {
  try {
    await mindmapApi.removeShare(shareMindmapId.value)
    shareToken.value = ''
    shareUrl.value = ''
    const index = store.mindmaps.findIndex((m) => m.id === shareMindmapId.value)
    if (index !== -1) {
      store.mindmaps[index].share_token = null
    }
  } catch (err) {
    alert('取消分享失败')
  }
}

function copyShareUrl() {
  navigator.clipboard.writeText(shareUrl.value)
  alert('已复制到剪贴板')
}

// ==================== 移动操作 ====================

function openMoveDialog(mindmap, e) {
  e?.stopPropagation()
  movingMindmapId.value = mindmap.id
  moveTargetFolderId.value = mindmap.folder_id || null
  showMoveDialog.value = true
}

async function handleMove() {
  await store.moveToFolder(movingMindmapId.value, moveTargetFolderId.value)
  showMoveDialog.value = false
}

// ==================== 右键菜单 ====================

function onContextMenu(e, type, item) {
  e.preventDefault()
  e.stopPropagation()
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY, type, item }
}

function closeContextMenu() {
  contextMenu.value.show = false
}

function handleContextAction(action) {
  const { type, item } = contextMenu.value
  closeContextMenu()

  if (action === 'rename' && type === 'folder') {
    openRenameFolderDialog(item)
  } else if (action === 'delete' && type === 'folder') {
    handleDeleteFolder(item.id)
  } else if (action === 'delete' && type === 'mindmap') {
    handleDeleteMindmap(item.id)
  } else if (action === 'share' && type === 'mindmap') {
    openShareDialog(item)
  } else if (action === 'move' && type === 'mindmap') {
    openMoveDialog(item)
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

function getItemCount(item) {
  // 从 data 中估算节点数
  try {
    const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data
    function countNodes(node) {
      if (!node) return 0
      let count = 1
      if (node.children) {
        node.children.forEach(child => { count += countNodes(child) })
      }
      return count
    }
    return countNodes(data)
  } catch {
    return 0
  }
}
</script>

<template>
  <div class="home" @click="closeContextMenu">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: !sidebarOpen }">
      <div class="sidebar-header">
        <div class="logo-area">
          <div class="logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="14" fill="url(#logo-grad)"/>
              <path d="M14 8C10.686 8 8 10.686 8 14s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm0 2a4 4 0 110 8 4 4 0 010-8z" fill="white" opacity="0.9"/>
              <circle cx="14" cy="14" r="1.5" fill="white"/>
              <line x1="14" y1="8" x2="14" y2="5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="14" y1="23" x2="14" y2="20" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="8" y1="14" x2="5" y2="14" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="23" y1="14" x2="20" y2="14" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
                  <stop offset="0%" stop-color="#6366f1"/>
                  <stop offset="100%" stop-color="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="logo-text" v-show="sidebarOpen">
            <h1>Mindx</h1>
            <span>思维导图工具</span>
          </div>
        </div>
        <button class="sidebar-toggle" @click="sidebarOpen = !sidebarOpen" :title="sidebarOpen ? '收起' : '展开'">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path :d="sidebarOpen ? 'M10 4L6 8l4 4' : 'M6 4l4 4-4 4'" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <nav class="sidebar-nav" v-show="sidebarOpen">
        <div class="nav-section">
          <div class="nav-label">快速操作</div>
          <button class="nav-item create-btn" @click="showCreateDialog = true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="1" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.5"/>
              <path d="M9 5v8M5 9h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>新建思维导图</span>
          </button>
          <button class="nav-item" @click="openCreateFolderDialog">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 5a2 2 0 012-2h3.172a2 2 0 011.414.586L10 5h4a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M9 9v4M7 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <span>新建文件夹</span>
          </button>
          <button class="nav-item" @click="openImportDialog">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 3v8M6 8l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 12v2a2 2 0 002 2h8a2 2 0 002-2v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>导入文件</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">文件夹</div>
          <div v-if="store.folders.length === 0" class="nav-empty">暂无文件夹</div>
          <div
            v-for="folder in store.folders"
            :key="folder.id"
            class="nav-item folder-item"
            :class="{ active: store.currentFolderId === folder.id }"
            @click="navigateToFolder(folder.id)"
            @contextmenu="onContextMenu($event, 'folder', folder)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M1.5 4.5a1.5 1.5 0 011.5-1.5h2.672a1.5 1.5 0 011.06.44L8 4.5h5a1.5 1.5 0 011.5 1.5V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011.5 12.5v-8z" fill="#f59e0b" opacity="0.2" stroke="#f59e0b" stroke-width="1.2"/>
            </svg>
            <span class="folder-name">{{ folder.name }}</span>
            <span class="folder-count">{{ store.mindmaps.filter(m => m.folder_id === folder.id).length }}</span>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-label">统计</div>
          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-num">{{ store.mindmaps.length }}</span>
              <span class="stat-desc">思维导图</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">{{ store.folders.length }}</span>
              <span class="stat-desc">文件夹</span>
            </div>
          </div>
        </div>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 顶部栏 -->
      <header class="topbar">
        <div class="topbar-left">
          <button class="mobile-menu-btn" @click="sidebarOpen = !sidebarOpen">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <!-- 面包屑 -->
          <nav class="breadcrumb">
            <span
              v-for="(crumb, index) in store.breadcrumb"
              :key="crumb.id || 'root'"
              class="crumb-item"
            >
              <a
                v-if="index < store.breadcrumb.length - 1"
                @click="navigateToFolder(crumb.id)"
                class="crumb-link"
              >{{ crumb.name }}</a>
              <span v-else class="crumb-current">{{ crumb.name }}</span>
              <svg v-if="index < store.breadcrumb.length - 1" width="12" height="12" viewBox="0 0 12 12" fill="none" class="crumb-sep">
                <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
            </span>
          </nav>
        </div>
        <div class="topbar-right">
          <div class="view-info">
            <span class="item-count">{{ store.currentFolders.length + store.currentMindmaps.length }} 项</span>
          </div>
        </div>
      </header>

      <!-- 内容区 -->
      <div class="content-area">
        <!-- 加载状态 -->
        <div v-if="store.loading && store.mindmaps.length === 0" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="store.currentFolders.length === 0 && store.currentMindmaps.length === 0" class="empty-state">
          <div class="empty-visual">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="56" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="4 4"/>
              <circle cx="60" cy="60" r="20" fill="url(#empty-grad)" opacity="0.15"/>
              <circle cx="60" cy="60" r="8" fill="url(#empty-grad)"/>
              <line x1="60" y1="40" x2="40" y2="25" stroke="#c7d2fe" stroke-width="2" stroke-linecap="round"/>
              <circle cx="40" cy="25" r="5" fill="#c7d2fe"/>
              <line x1="76" y1="52" x2="95" y2="38" stroke="#c7d2fe" stroke-width="2" stroke-linecap="round"/>
              <circle cx="95" cy="38" r="5" fill="#c7d2fe"/>
              <line x1="68" y1="76" x2="78" y2="95" stroke="#c7d2fe" stroke-width="2" stroke-linecap="round"/>
              <circle cx="78" cy="95" r="5" fill="#c7d2fe"/>
              <line x1="48" y1="72" x2="30" y2="88" stroke="#c7d2fe" stroke-width="2" stroke-linecap="round"/>
              <circle cx="30" cy="88" r="5" fill="#c7d2fe"/>
              <line x1="44" y1="50" x2="22" y2="55" stroke="#c7d2fe" stroke-width="2" stroke-linecap="round"/>
              <circle cx="22" cy="55" r="5" fill="#c7d2fe"/>
              <defs>
                <linearGradient id="empty-grad" x1="40" y1="40" x2="80" y2="80">
                  <stop offset="0%" stop-color="#6366f1"/>
                  <stop offset="100%" stop-color="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h2>开始你的思维之旅</h2>
          <p>创建思维导图来组织你的想法、规划项目或梳理知识</p>
          <div class="empty-actions">
            <button class="btn-primary btn-lg" @click="showCreateDialog = true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 3v12M3 9h12" stroke="white" stroke-width="2" stroke-linecap="round"/>
              </svg>
              新建思维导图
            </button>
            <button class="btn-ghost btn-lg" @click="openImportDialog">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 3v8M6 8l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 12v2a2 2 0 002 2h8a2 2 0 002-2v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              导入文件
            </button>
          </div>
        </div>

        <!-- 文件列表 -->
        <div v-else class="file-grid">
          <!-- 文件夹 -->
          <div
            v-for="(folder, idx) in store.currentFolders"
            :key="'folder-' + folder.id"
            class="file-card folder-card"
            :style="{ animationDelay: idx * 50 + 'ms' }"
            @click="navigateToFolder(folder.id)"
            @contextmenu="onContextMenu($event, 'folder', folder)"
          >
            <div class="card-visual folder-visual">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M6 12a4 4 0 014-4h8.343a4 4 0 012.829 1.172L24 12h14a4 4 0 014 4v18a4 4 0 01-4 4H10a4 4 0 01-4-4V12z" fill="url(#folder-grad)" opacity="0.15"/>
                <path d="M6 12a4 4 0 014-4h8.343a4 4 0 012.829 1.172L24 12h14a4 4 0 014 4v18a4 4 0 01-4 4H10a4 4 0 01-4-4V12z" stroke="url(#folder-grad)" stroke-width="2"/>
                <defs>
                  <linearGradient id="folder-grad" x1="6" y1="8" x2="42" y2="38">
                    <stop offset="0%" stop-color="#f59e0b"/>
                    <stop offset="100%" stop-color="#f97316"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div class="card-info">
              <h3 class="card-title">{{ folder.name }}</h3>
              <div class="card-meta">
                <span>{{ store.mindmaps.filter(m => m.folder_id === folder.id).length }} 个文件</span>
                <span class="meta-dot"></span>
                <span>{{ formatDate(folder.updated_at) }}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="action-btn" @click="openRenameFolderDialog(folder, $event)" title="重命名">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="action-btn danger" @click="handleDeleteFolder(folder.id, $event)" title="删除">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- 思维导图 -->
          <div
            v-for="(item, idx) in store.currentMindmaps"
            :key="'mindmap-' + item.id"
            class="file-card mindmap-card"
            :style="{ animationDelay: (store.currentFolders.length + idx) * 50 + 'ms' }"
            @click="router.push(`/editor/${item.id}`)"
            @contextmenu="onContextMenu($event, 'mindmap', item)"
          >
            <div class="card-visual mindmap-visual">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="8" fill="url(#map-grad)" opacity="0.2"/>
                <circle cx="24" cy="24" r="5" fill="url(#map-grad)"/>
                <circle cx="12" cy="12" r="3" fill="#a5b4fc" opacity="0.6"/>
                <circle cx="36" cy="14" r="3" fill="#a5b4fc" opacity="0.6"/>
                <circle cx="38" cy="36" r="3" fill="#a5b4fc" opacity="0.6"/>
                <circle cx="10" cy="36" r="3" fill="#a5b4fc" opacity="0.6"/>
                <line x1="19" y1="19" x2="14" y2="14" stroke="#c7d2fe" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="29" y1="19" x2="34" y2="15" stroke="#c7d2fe" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="29" y1="29" x2="35" y2="34" stroke="#c7d2fe" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="19" y1="29" x2="12" y2="34" stroke="#c7d2fe" stroke-width="1.5" stroke-linecap="round"/>
                <defs>
                  <linearGradient id="map-grad" x1="16" y1="16" x2="32" y2="32">
                    <stop offset="0%" stop-color="#6366f1"/>
                    <stop offset="100%" stop-color="#8b5cf6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div class="card-info">
              <h3 class="card-title">{{ item.title }}</h3>
              <div class="card-meta">
                <span>{{ getItemCount(item) }} 个节点</span>
                <span class="meta-dot"></span>
                <span>{{ formatDate(item.updated_at) }}</span>
                <span v-if="item.share_token" class="share-tag">已分享</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="action-btn" :class="{ active: item.share_token }" @click="openShareDialog(item, $event)" title="分享">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="10" cy="3" r="2" stroke="currentColor" stroke-width="1.2"/>
                  <circle cx="4" cy="7" r="2" stroke="currentColor" stroke-width="1.2"/>
                  <circle cx="10" cy="11" r="2" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M5.8 6.2l2.4-2.4M5.8 7.8l2.4 2.4" stroke="currentColor" stroke-width="1.2"/>
                </svg>
              </button>
              <button class="action-btn" @click="openMoveDialog(item, $event)" title="移动">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1.5 4.5a1.5 1.5 0 011.5-1.5h2.172a1.5 1.5 0 011.06.44L7.5 4.5H11a1.5 1.5 0 011.5 1.5V11.5a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 011.5 11.5v-7z" stroke="currentColor" stroke-width="1.2"/>
                </svg>
              </button>
              <button class="action-btn danger" @click="handleDeleteMindmap(item.id, $event)" title="删除">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <Transition name="menu">
        <div v-if="contextMenu.show" class="context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }">
          <template v-if="contextMenu.type === 'folder'">
            <div class="ctx-item" @click="handleContextAction('rename')">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              重命名
            </div>
            <div class="ctx-divider"></div>
            <div class="ctx-item danger" @click="handleContextAction('delete')">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
              删除
            </div>
          </template>
          <template v-if="contextMenu.type === 'mindmap'">
            <div class="ctx-item" @click="handleContextAction('share')">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="10" cy="3" r="2" stroke="currentColor" stroke-width="1.2"/><circle cx="4" cy="7" r="2" stroke="currentColor" stroke-width="1.2"/><circle cx="10" cy="11" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M5.8 6.2l2.4-2.4M5.8 7.8l2.4 2.4" stroke="currentColor" stroke-width="1.2"/></svg>
              分享
            </div>
            <div class="ctx-item" @click="handleContextAction('move')">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 4.5a1.5 1.5 0 011.5-1.5h2.172a1.5 1.5 0 011.06.44L7.5 4.5H11a1.5 1.5 0 011.5 1.5V11.5a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 011.5 11.5v-7z" stroke="currentColor" stroke-width="1.2"/></svg>
              移动到...
            </div>
            <div class="ctx-divider"></div>
            <div class="ctx-item danger" @click="handleContextAction('delete')">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
              删除
            </div>
          </template>
        </div>
      </Transition>
    </Teleport>

    <!-- 对话框们 -->
    <Teleport to="body">
      <!-- 新建思维导图 -->
      <Transition name="dialog">
        <div v-if="showCreateDialog" class="dialog-overlay" @click.self="showCreateDialog = false">
          <div class="dialog">
            <div class="dialog-header">
              <h2>新建思维导图</h2>
              <p>给你的思维导图起个名字吧</p>
            </div>
            <div class="dialog-body">
              <input v-model="newTitle" placeholder="例如：项目规划、读书笔记..." autofocus @keyup.enter="handleCreate" class="dialog-input" />
            </div>
            <div class="dialog-footer">
              <button class="btn-ghost" @click="showCreateDialog = false">取消</button>
              <button class="btn-primary" @click="handleCreate">创建</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 文件夹 -->
      <Transition name="dialog">
        <div v-if="showFolderDialog" class="dialog-overlay" @click.self="showFolderDialog = false">
          <div class="dialog">
            <div class="dialog-header">
              <h2>{{ editingFolderId ? '重命名文件夹' : '新建文件夹' }}</h2>
              <p>{{ editingFolderId ? '输入新的文件夹名称' : '将思维导图归类整理' }}</p>
            </div>
            <div class="dialog-body">
              <input v-model="newFolderName" placeholder="文件夹名称" autofocus @keyup.enter="handleSaveFolder" class="dialog-input" />
            </div>
            <div class="dialog-footer">
              <button class="btn-ghost" @click="showFolderDialog = false">取消</button>
              <button class="btn-primary" @click="handleSaveFolder">{{ editingFolderId ? '保存' : '创建' }}</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 导入 -->
      <Transition name="dialog">
        <div v-if="showImportDialog" class="dialog-overlay" @click.self="showImportDialog = false">
          <div class="dialog dialog-wide">
            <div class="dialog-header">
              <h2>导入思维导图</h2>
              <p>支持 JSON 和 Markdown 格式</p>
            </div>
            <div class="dialog-body">
              <div class="upload-zone" @click="$refs.fileInput.click()">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <path d="M20 8v16M13 15l7-7 7 7" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M6 26v4a4 4 0 004 4h20a4 4 0 004-4v-4" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p>点击选择文件或拖拽到此处</p>
                <span>支持 .json、.md、.xmind 格式</span>
                <input ref="fileInput" type="file" accept=".json,.md,.markdown,.xmind" @change="handleFileSelect" style="display:none" />
              </div>
              <div v-if="importError" class="import-error">{{ importError }}</div>
              <div v-if="importPreview" class="import-preview">
                <div class="preview-row">
                  <span class="preview-label">标题</span>
                  <span class="preview-value">{{ importPreview.title }}</span>
                </div>
                <div class="preview-row">
                  <span class="preview-label">根节点</span>
                  <span class="preview-value">{{ importPreview.data.data?.text }}</span>
                </div>
                <div class="preview-row">
                  <span class="preview-label">子节点</span>
                  <span class="preview-value">{{ importPreview.data.children?.length || 0 }} 个</span>
                </div>
              </div>
            </div>
            <div class="dialog-footer">
              <button class="btn-ghost" @click="showImportDialog = false">取消</button>
              <button class="btn-primary" @click="handleImport" :disabled="!importPreview">导入</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 分享 -->
      <Transition name="dialog">
        <div v-if="showShareDialog" class="dialog-overlay" @click.self="showShareDialog = false">
          <div class="dialog">
            <div class="dialog-header">
              <h2>分享思维导图</h2>
              <p>生成只读链接，与他人分享你的思维导图</p>
            </div>
            <div class="dialog-body">
              <div v-if="!shareToken" class="share-empty">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <circle cx="42" cy="14" r="8" stroke="#c7d2fe" stroke-width="2"/>
                  <circle cx="14" cy="28" r="8" stroke="#c7d2fe" stroke-width="2"/>
                  <circle cx="42" cy="42" r="8" stroke="#c7d2fe" stroke-width="2"/>
                  <path d="M21 23l14-6M21 33l14 6" stroke="#c7d2fe" stroke-width="2"/>
                </svg>
                <p>尚未生成分享链接</p>
                <button class="btn-primary" @click="handleCreateShare">生成分享链接</button>
              </div>
              <div v-else class="share-active">
                <div class="share-url-row">
                  <input :value="shareUrl" readonly class="share-url-input" />
                  <button class="btn-primary btn-sm" @click="copyShareUrl">复制</button>
                </div>
                <button class="btn-text-danger" @click="handleRemoveShare">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M10 4L4 10M4 4l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                  取消分享
                </button>
              </div>
            </div>
            <div class="dialog-footer">
              <button class="btn-ghost" @click="showShareDialog = false">关闭</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 移动 -->
      <Transition name="dialog">
        <div v-if="showMoveDialog" class="dialog-overlay" @click.self="showMoveDialog = false">
          <div class="dialog">
            <div class="dialog-header">
              <h2>移动到文件夹</h2>
              <p>选择目标文件夹</p>
            </div>
            <div class="dialog-body">
              <div class="move-list">
                <label class="move-option" :class="{ selected: moveTargetFolderId === null }">
                  <input type="radio" v-model="moveTargetFolderId" :value="null" />
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" stroke-width="1.2"/>
                    <path d="M6 9h6M9 6v6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                  <span>根目录</span>
                </label>
                <label v-for="folder in store.folders" :key="folder.id" class="move-option" :class="{ selected: moveTargetFolderId === folder.id }">
                  <input type="radio" v-model="moveTargetFolderId" :value="folder.id" />
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M2 5a2 2 0 012-2h3.172a2 2 0 011.414.586L10 5h4a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" fill="#f59e0b" opacity="0.15" stroke="#f59e0b" stroke-width="1.2"/>
                  </svg>
                  <span>{{ folder.name }}</span>
                </label>
              </div>
            </div>
            <div class="dialog-footer">
              <button class="btn-ghost" @click="showMoveDialog = false">取消</button>
              <button class="btn-primary" @click="handleMove">移动</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ==================== 布局 ==================== */
.home {
  display: flex;
  height: 100vh;
  background: #f8fafc;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

/* ==================== 侧边栏 ==================== */
.sidebar {
  width: 260px;
  background: #ffffff;
  border-right: 1px solid #e8ecf1;
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 56px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.logo-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text h1 {
  font-size: 17px;
  font-weight: 700;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.2;
}

.logo-text span {
  font-size: 11px;
  color: #94a3b8;
  letter-spacing: 0.5px;
}

.sidebar-toggle {
  background: transparent;
  border: none;
  padding: 6px;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: #f1f5f9;
  color: #64748b;
}

/* 侧边栏导航 */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
}

.nav-section {
  margin-bottom: 20px;
}

.nav-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #94a3b8;
  padding: 0 8px;
  margin-bottom: 6px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: #475569;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.nav-item.active {
  background: #eef2ff;
  color: #4f46e5;
}

.create-btn {
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  color: #4f46e5;
  font-weight: 500;
}

.create-btn:hover {
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
}

.folder-item {
  position: relative;
}

.folder-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  font-size: 11px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.nav-empty {
  font-size: 12px;
  color: #94a3b8;
  padding: 8px 10px;
  font-style: italic;
}

/* 统计 */
.stats-row {
  display: flex;
  gap: 12px;
  padding: 0 8px;
}

.stat-item {
  flex: 1;
  background: #f8fafc;
  border-radius: 10px;
  padding: 12px;
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.stat-desc {
  font-size: 11px;
  color: #94a3b8;
}

/* ==================== 主内容区 ==================== */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* 顶部栏 */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 28px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #e8ecf1;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-menu-btn {
  display: none;
  background: transparent;
  border: none;
  padding: 6px;
  border-radius: 6px;
  color: #64748b;
  cursor: pointer;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.crumb-link {
  color: #6366f1;
  cursor: pointer;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s;
}

.crumb-link:hover {
  color: #4f46e5;
  text-decoration: underline;
}

.crumb-current {
  color: #1e293b;
  font-weight: 600;
}

.crumb-sep {
  color: #cbd5e1;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-count {
  font-size: 12px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 12px;
}

/* ==================== 内容区 ==================== */
.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.empty-visual {
  margin-bottom: 24px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.empty-state h2 {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 14px;
  color: #94a3b8;
  margin-bottom: 28px;
}

.empty-actions {
  display: flex;
  gap: 12px;
}

.btn-lg {
  padding: 12px 24px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ==================== 文件网格 ==================== */
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.file-card {
  background: #ffffff;
  border: 1px solid #e8ecf1;
  border-radius: 14px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  overflow: hidden;
  animation: cardIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.file-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: transparent;
  transition: background 0.25s;
}

.file-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 8px 25px -5px rgba(99, 102, 241, 0.12), 0 2px 8px -2px rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
}

.mindmap-card:hover::before {
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
}

.folder-card:hover::before {
  background: linear-gradient(90deg, #f59e0b, #f97316);
}

.card-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  flex-shrink: 0;
}

.folder-visual {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
}

.mindmap-visual {
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
}

.meta-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #cbd5e1;
}

.share-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: #eef2ff;
  color: #6366f1;
  border-radius: 8px;
  font-weight: 500;
}

/* 卡片操作按钮 */
.card-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.file-card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid #e8ecf1;
  padding: 6px;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #1e293b;
}

.action-btn.active {
  color: #6366f1;
  border-color: #c7d2fe;
  background: #eef2ff;
}

.action-btn.danger:hover {
  color: #ef4444;
  border-color: #fecaca;
  background: #fef2f2;
}

/* ==================== 右键菜单 ==================== */
.context-menu {
  position: fixed;
  background: #ffffff;
  border: 1px solid #e8ecf1;
  border-radius: 12px;
  box-shadow: 0 10px 38px -10px rgba(22, 23, 24, 0.15), 0 10px 20px -15px rgba(22, 23, 24, 0.1);
  z-index: 1000;
  min-width: 160px;
  padding: 6px;
  animation: menuIn 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes menuIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #475569;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.1s;
}

.ctx-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.ctx-item.danger:hover {
  background: #fef2f2;
  color: #ef4444;
}

.ctx-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 4px 8px;
}

.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* ==================== 对话框 ==================== */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: #ffffff;
  border-radius: 20px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.dialog-wide {
  width: 520px;
}

.dialog-header {
  padding: 28px 28px 0;
}

.dialog-header h2 {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.dialog-header p {
  font-size: 13px;
  color: #94a3b8;
}

.dialog-body {
  padding: 20px 28px;
}

.dialog-input {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
  background: #f8fafc;
}

.dialog-input:focus {
  border-color: #6366f1;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 28px 24px;
}

/* 上传区域 */
.upload-zone {
  border: 2px dashed #e2e8f0;
  border-radius: 14px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-zone:hover {
  border-color: #c7d2fe;
  background: #f8faff;
}

.upload-zone p {
  font-size: 14px;
  color: #475569;
  font-weight: 500;
}

.upload-zone span {
  font-size: 12px;
  color: #94a3b8;
}

.import-error {
  color: #ef4444;
  font-size: 13px;
  margin-top: 12px;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 8px;
}

.import-preview {
  margin-top: 16px;
  background: #f8fafc;
  border: 1px solid #e8ecf1;
  border-radius: 12px;
  padding: 16px;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.preview-row:not(:last-child) {
  border-bottom: 1px solid #f1f5f9;
}

.preview-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.preview-value {
  font-size: 13px;
  color: #1e293b;
  font-weight: 500;
}

/* 分享对话框 */
.share-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 0;
}

.share-empty p {
  color: #94a3b8;
  font-size: 13px;
}

.share-active {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.share-url-row {
  display: flex;
  gap: 8px;
}

.share-url-input {
  flex: 1;
  font-size: 13px;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  color: #475569;
}

.btn-text-danger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.15s;
}

.btn-text-danger:hover {
  color: #ef4444;
}

/* 移动对话框 */
.move-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 280px;
  overflow-y: auto;
}

.move-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 14px;
  color: #475569;
  border: 1.5px solid transparent;
}

.move-option:hover {
  background: #f1f5f9;
}

.move-option.selected {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #4f46e5;
}

.move-option input[type='radio'] {
  display: none;
}

/* 对话框动画 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.25s;
}
.dialog-enter-active .dialog,
.dialog-leave-active .dialog {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .dialog {
  transform: scale(0.95) translateY(10px);
}
.dialog-leave-to .dialog {
  transform: scale(0.95) translateY(10px);
}

/* ==================== 响应式 ==================== */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 0.3s;
  }

  .sidebar:not(.collapsed) {
    transform: translateX(0);
  }

  .mobile-menu-btn {
    display: flex;
  }

  .file-grid {
    grid-template-columns: 1fr;
  }

  .content-area {
    padding: 16px;
  }
}
</style>