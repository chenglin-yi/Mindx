<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMindmapStore } from '../stores/mindmap'
import MindMap from 'simple-mind-map'
import Drag from 'simple-mind-map/src/plugins/Drag.js'
import Select from 'simple-mind-map/src/plugins/Select.js'
import KeyboardNavigation from 'simple-mind-map/src/plugins/KeyboardNavigation.js'
import Search from 'simple-mind-map/src/plugins/Search.js'
import Export from 'simple-mind-map/src/plugins/Export.js'
import Demonstrate from 'simple-mind-map/src/plugins/Demonstrate.js'

MindMap.usePlugin(Drag).usePlugin(Select).usePlugin(KeyboardNavigation).usePlugin(Search).usePlugin(Export).usePlugin(Demonstrate)

// 自定义主题
MindMap.defineTheme('dark', {
  backgroundColor: '#1a1a2e',
  root: { backgroundColor: '#4f46e5', color: '#fff', borderColor: '#4f46e5' },
  second: { backgroundColor: '#16213e', color: '#e0e0e0', borderColor: '#0f3460' },
  node: { backgroundColor: '#1a1a2e', color: '#ccc', borderColor: '#333' },
  lineColor: '#555',
})
MindMap.defineTheme('blueSky', {
  backgroundColor: '#e8f4fd',
  root: { backgroundColor: '#2196f3', color: '#fff', borderColor: '#1976d2' },
  second: { backgroundColor: '#bbdefb', color: '#0d47a1', borderColor: '#90caf9' },
  node: { backgroundColor: '#e3f2fd', color: '#1565c0', borderColor: '#64b5f6' },
  lineColor: '#42a5f5',
})
MindMap.defineTheme('freshGreen', {
  backgroundColor: '#e8f5e9',
  root: { backgroundColor: '#4caf50', color: '#fff', borderColor: '#388e3c' },
  second: { backgroundColor: '#c8e6c9', color: '#1b5e20', borderColor: '#a5d6a7' },
  node: { backgroundColor: '#e8f5e9', color: '#2e7d32', borderColor: '#81c784' },
  lineColor: '#66bb6a',
})
MindMap.defineTheme('warmOrange', {
  backgroundColor: '#fff3e0',
  root: { backgroundColor: '#ff9800', color: '#fff', borderColor: '#f57c00' },
  second: { backgroundColor: '#ffe0b2', color: '#e65100', borderColor: '#ffcc80' },
  node: { backgroundColor: '#fff8e1', color: '#ef6c00', borderColor: '#ffb74d' },
  lineColor: '#ffa726',
})

const route = useRoute()
const router = useRouter()
const store = useMindmapStore()

const mindmapContainer = ref(null)
const title = ref('')
const isEditingTitle = ref(false)
const saving = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)
const currentLayout = ref('logicalStructure')
const currentTheme = ref('default')
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })

// P1: 搜索
const showSearch = ref(false)
const searchText = ref('')
const searchResult = ref({ current: 0, total: 0 })

// P1: 大纲模式
const showOutline = ref(false)
const outlineData = ref([])

// P1: 演示模式
const isDemonstrate = ref(false)

// P2: 备注
const showNotePanel = ref(false)
const noteText = ref('')

// P2: 超链接
const showLinkDialog = ref(false)
const linkUrl = ref('')
const linkTitle = ref('')

// P2: 节点样式
const showStylePanel = ref(false)
const nodeStyle = reactive({
  color: '#333',
  backgroundColor: '#fff',
  borderColor: '#4f46e5',
  fontSize: 14,
  shape: 'rectangle',
})

// 俯瞰图（小地图）
const showMinimap = ref(true)
const minimapOverlay = ref(null)
const minimapViewport = reactive({ left: 0, top: 0, width: 0, height: 0 })
const isDraggingMinimap = ref(false)

let mindmapInstance = null
let saveTimer = null
let keydownHandler = null

const layouts = [
  { value: 'logicalStructure', label: '逻辑图' },
  { value: 'mindMap', label: '思维导图' },
  { value: 'organizationStructure', label: '组织架构' },
  { value: 'catalogOrganization', label: '目录组织' },
  { value: 'timeline', label: '时间轴' },
  { value: 'timeline2', label: '时间轴2' },
  { value: 'fishbone', label: '鱼骨图' },
]

const themes = [
  { value: 'default', label: '默认' },
  { value: 'dark', label: '暗色' },
  { value: 'blueSky', label: '蓝天' },
  { value: 'freshGreen', label: '清新绿' },
  { value: 'warmOrange', label: '暖橙' },
]

const iconGroups = [
  {
    type: 'priority',
    name: '优先级',
    items: [
      { name: '1', label: 'P1', color: '#E93B30' },
      { name: '2', label: 'P2', color: '#FA8D2E' },
      { name: '3', label: 'P3', color: '#2E66FA' },
      { name: '4', label: 'P4', color: '#8B5CF6' },
      { name: '5', label: 'P5', color: '#6B7280' },
      { name: '6', label: 'P6', color: '#9CA3AF' },
    ],
  },
  {
    type: 'progress',
    name: '进度',
    items: [
      { name: '1', label: '25%', color: '#12BB37' },
      { name: '2', label: '50%', color: '#12BB37' },
      { name: '3', label: '75%', color: '#12BB37' },
      { name: '8', label: '✓', color: '#12BB37' },
    ],
  },
]

onMounted(async () => {
  loadLocalSettings()
  const id = route.params.id
  const data = await store.fetchMindmap(id)
  if (data) {
    title.value = data.title
    await nextTick()
    initMindmap(data.data)
  }
})

onBeforeUnmount(() => {
  if (keydownHandler) document.removeEventListener('keydown', keydownHandler)
  if (mindmapInstance) {
    mindmapInstance.destroy()
    mindmapInstance = null
  }
  if (saveTimer) clearTimeout(saveTimer)
  if (minimapTimer) clearTimeout(minimapTimer)
})

// 修复旧数据中的图标格式和缺失字段
function fixNodeData(node) {
  if (!node) return
  // 确保 data 存在
  if (!node.data) node.data = {}
  // 确保 text 是字符串
  if (typeof node.data.text !== 'string') {
    node.data.text = node.data.text ? String(node.data.text) : ''
  }
  // 修复图标格式
  if (node.data.icon && Array.isArray(node.data.icon)) {
    node.data.icon = node.data.icon
      .map(item => {
        if (typeof item === 'object' && item.type && item.name) {
          return `${item.type}_${item.name}`
        }
        return item
      })
      .filter(item => typeof item === 'string')
  }
  // 递归修复子节点
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach(child => fixNodeData(child))
  }
}

function initMindmap(data) {
  if (!mindmapContainer.value) return

  // 修复旧数据中的图标格式
  if (data) {
    fixNodeData(data)
  }

  mindmapInstance = new MindMap({
    el: mindmapContainer.value,
    data: data || {
      data: { text: title.value },
      children: [
        { data: { text: '分支 1' }, children: [] },
        { data: { text: '分支 2' }, children: [] },
        { data: { text: '分支 3' }, children: [] },
      ],
    },
    layout: currentLayout.value,
    theme: currentTheme.value,
    readonly: false,
    enableFreeDrag: true,
    enableCtrlKeyNodeSelection: true,
    expandBtnSize: 20,
    defaultInsertSecondLevelNodeText: '子主题',
    defaultInsertBelowSecondLevelNodeText: '子主题',
  })

  mindmapInstance.on('data_change', () => {
    updateHistoryState()
    scheduleSave()
    if (showOutline.value) updateOutline()
    if (showMinimap.value) scheduleMinimapUpdate()
  })

  // 全局键盘快捷键
  keydownHandler = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleSearch()
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        resetZoom()
      }
    }
  }
  document.addEventListener('keydown', keydownHandler)

  mindmapInstance.on('node_contextmenu', (e, node) => {
    e.preventDefault()
    contextMenuPos.value = { x: e.clientX, y: e.clientY }
    showContextMenu.value = true
  })

  mindmapInstance.on('mousedown', () => {
    showContextMenu.value = false
  })

  // 演示模式事件
  mindmapInstance.on('demonstrate_exit', () => {
    isDemonstrate.value = false
  })

  // 视图变化时更新小地图和缩放级别
  mindmapInstance.on('view_data_change', () => {
    if (showMinimap.value) scheduleMinimapUpdate()
    zoomLevel.value = Math.round(mindmapInstance.view.scale * 100)
  })

  // 初始化后首次更新小地图
  setTimeout(() => {
    if (showMinimap.value) updateMinimap()
  }, 500)

  updateHistoryState()
}

function updateHistoryState() {
  if (!mindmapInstance) return
  const cmd = mindmapInstance.command
  canUndo.value = cmd.history.length > 0 && cmd.activeHistoryIndex >= 0
  canRedo.value = cmd.activeHistoryIndex < cmd.history.length - 1
}

// ===== 节点操作 =====
function addChildNode() { mindmapInstance?.execCommand('INSERT_CHILD_NODE') }
function addSiblingNode() { mindmapInstance?.execCommand('INSERT_NODE') }
function deleteNode() { mindmapInstance?.execCommand('REMOVE_NODE') }
function expandNode() {
  const node = mindmapInstance?.renderer.activeNodeList[0]
  if (node) mindmapInstance.execCommand('SET_NODE_EXPAND', node, true)
}
function collapseNode() {
  const node = mindmapInstance?.renderer.activeNodeList[0]
  if (node) mindmapInstance.execCommand('SET_NODE_EXPAND', node, false)
}
function expandAll() { mindmapInstance?.execCommand('EXPAND_ALL') }
function collapseAll() { mindmapInstance?.execCommand('UNEXPAND_ALL') }
function focusNode() { mindmapInstance?.view.fit() }
function undo() { mindmapInstance?.execCommand('BACK') }
function redo() { mindmapInstance?.execCommand('FORWARD') }

// ===== 缩放 =====
const zoomLevel = ref(100)

function zoomIn() {
  if (!mindmapInstance) return
  mindmapInstance.view.enlarge()
  zoomLevel.value = Math.round(mindmapInstance.view.scale * 100)
}

function zoomOut() {
  if (!mindmapInstance) return
  mindmapInstance.view.narrow()
  zoomLevel.value = Math.round(mindmapInstance.view.scale * 100)
}

function resetZoom() {
  if (!mindmapInstance) return
  mindmapInstance.view.reset()
  zoomLevel.value = 100
}

function fitCanvas() {
  if (!mindmapInstance) return
  mindmapInstance.view.fit()
  zoomLevel.value = Math.round(mindmapInstance.view.scale * 100)
}

// ===== 布局/主题 =====
function setLayout(layout) {
  currentLayout.value = layout
  mindmapInstance?.setLayout(layout)
  localStorage.setItem('mindx_layout', layout)
}
function setTheme(theme) {
  currentTheme.value = theme
  mindmapInstance?.setTheme(theme)
  localStorage.setItem('mindx_theme', theme)
}

function loadLocalSettings() {
  const savedLayout = localStorage.getItem('mindx_layout')
  if (savedLayout && layouts.some(l => l.value === savedLayout)) {
    currentLayout.value = savedLayout
  }
  const savedTheme = localStorage.getItem('mindx_theme')
  if (savedTheme && themes.some(t => t.value === savedTheme)) {
    currentTheme.value = savedTheme
  }
}

// ===== 图标操作 =====
function setIcon(type, name) {
  const node = mindmapInstance?.renderer.activeNodeList[0]
  if (!node) return
  const icons = [...(node.getData('icon') || [])]
  const iconKey = `${type}_${name}`
  const index = icons.indexOf(iconKey)
  if (index !== -1) {
    icons.splice(index, 1)
  } else {
    icons.push(iconKey)
  }
  mindmapInstance.execCommand('SET_NODE_ICON', node, icons)
}

// ===== 搜索功能 =====
function toggleSearch() {
  showSearch.value = !showSearch.value
  if (showSearch.value) {
    nextTick(() => document.querySelector('.search-input')?.focus())
  } else {
    mindmapInstance?.search.endSearch()
    searchText.value = ''
    searchResult.value = { current: 0, total: 0 }
  }
}

function doSearch() {
  if (!mindmapInstance || !searchText.value.trim()) {
    searchResult.value = { current: 0, total: 0 }
    return
  }
  mindmapInstance.search.search(searchText.value, () => {
    searchResult.value = {
      current: mindmapInstance.search.currentIndex + 1,
      total: mindmapInstance.search.matchNodeList.length,
    }
  })
}

function searchNext() {
  if (!mindmapInstance) return
  mindmapInstance.search.searchNext(null, mindmapInstance.search.currentIndex + 1)
  searchResult.value = {
    current: mindmapInstance.search.currentIndex + 1,
    total: mindmapInstance.search.matchNodeList.length,
  }
}

function searchPrev() {
  if (!mindmapInstance) return
  const index = mindmapInstance.search.currentIndex - 1
  mindmapInstance.search.jump(index < 0 ? mindmapInstance.search.matchNodeList.length - 1 : index)
  searchResult.value = {
    current: mindmapInstance.search.currentIndex + 1,
    total: mindmapInstance.search.matchNodeList.length,
  }
}

// ===== 大纲模式 =====
function toggleOutline() {
  showOutline.value = !showOutline.value
  if (showOutline.value) updateOutline()
}

function updateOutline() {
  if (!mindmapInstance) return
  const data = mindmapInstance.getData()
  outlineData.value = buildOutlineTree(data)
}

function buildOutlineTree(node, level = 0) {
  if (!node) return []
  const item = {
    text: node.data?.text || '',
    level,
    uid: node.data?.uid,
    children: [],
  }
  if (node.children?.length) {
    item.children = node.children.flatMap(c => buildOutlineTree(c, level + 1))
  }
  return [item]
}

function outlineToFlat(list) {
  const result = []
  function walk(items) {
    for (const item of items) {
      result.push(item)
      if (item.children?.length) walk(item.children)
    }
  }
  walk(list)
  return result
}

function jumpToNode(uid) {
  if (!mindmapInstance || !uid) return
  const node = mindmapInstance.renderer.nodeList.find(n => n.getData('uid') === uid)
  if (node) {
    mindmapInstance.execCommand('SET_NODE_ACTIVE', node)
    mindmapInstance.execCommand('GO_TARGET_NODE', uid)
  }
}

// ===== 演示模式 =====
function enterDemonstrate() {
  if (!mindmapInstance) return
  try {
    // 先尝试手动进入全屏
    const el = mindmapInstance.el
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => {
        mindmapInstance.demonstrate.enter()
      }).catch(() => {
        // 全屏被拒绝，直接进入演示模式
        mindmapInstance.demonstrate._enter()
        isDemonstrate.value = true
      })
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen()
      setTimeout(() => mindmapInstance.demonstrate.enter(), 100)
    } else {
      // 不支持全屏，直接进入
      mindmapInstance.demonstrate._enter()
      isDemonstrate.value = true
    }
  } catch (e) {
    console.error('Demonstrate enter failed:', e)
    // 降级处理
    try {
      mindmapInstance.demonstrate._enter()
      isDemonstrate.value = true
    } catch (e2) {
      console.error('Fallback failed:', e2)
    }
  }
}

function exitDemonstrate() {
  if (!mindmapInstance) return
  try {
    mindmapInstance.demonstrate.exit()
    isDemonstrate.value = false
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    }
  } catch (e) {
    console.error('Exit demonstrate failed:', e)
    isDemonstrate.value = false
  }
}

// ===== 俯瞰图（小地图） =====
let minimapTimer = null
const minimapSvgContent = ref('')
const minimapViewBox = ref('0 0 1000 800')

function scheduleMinimapUpdate() {
  if (minimapTimer) clearTimeout(minimapTimer)
  minimapTimer = setTimeout(() => updateMinimap(), 200)
}

function updateMinimap() {
  if (!mindmapInstance || !showMinimap.value) return

  const svgEl = mindmapInstance.el.querySelector('svg')
  if (!svgEl) return

  // 获取 SVG 内容边界
  const bbox = getSvgBBox(svgEl)
  if (!bbox.width || !bbox.height) return

  minimapViewBox.value = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`

  // 克隆内部绘制组
  const drawGroup = svgEl.querySelector('g')
  if (drawGroup) {
    minimapSvgContent.value = drawGroup.outerHTML
  }

  // 更新视口
  updateViewport(bbox)
}

function getSvgBBox(svgEl) {
  try {
    const drawGroup = svgEl.querySelector('g')
    if (!drawGroup) return { x: 0, y: 0, width: 1000, height: 800 }
    const bbox = drawGroup.getBBox()
    const padding = Math.max(bbox.width, bbox.height) * 0.1 + 50
    return {
      x: bbox.x - padding,
      y: bbox.y - padding,
      width: bbox.width + padding * 2,
      height: bbox.height + padding * 2,
    }
  } catch {
    return { x: 0, y: 0, width: 1000, height: 800 }
  }
}

function updateViewport(contentBBox) {
  if (!mindmapInstance || !minimapOverlay.value) return

  const containerRect = minimapOverlay.value.getBoundingClientRect()
  if (!containerRect.width || !containerRect.height) return

  // 缩放比例：小地图像素 / 内容实际尺寸
  const scaleX = containerRect.width / contentBBox.width
  const scaleY = containerRect.height / contentBBox.height
  const scale = Math.min(scaleX, scaleY)

  // 当前视图状态
  const s = mindmapInstance.view.scale || 1
  const tx = mindmapInstance.view.x || 0
  const ty = mindmapInstance.view.y || 0

  // 编辑器可视区域在内容坐标中的位置
  const viewLeft = -tx / s
  const viewTop = -ty / s
  const editorRect = mindmapInstance.el.getBoundingClientRect()
  const viewWidth = editorRect.width / s
  const viewHeight = editorRect.height / s

  // 转换为小地图坐标
  minimapViewport.left = (viewLeft - contentBBox.x) * scale
  minimapViewport.top = (viewTop - contentBBox.y) * scale
  minimapViewport.width = viewWidth * scale
  minimapViewport.height = viewHeight * scale
}

function navigateFromMinimap(e) {
  if (!mindmapInstance || !minimapOverlay.value) return

  const mmRect = minimapOverlay.value.getBoundingClientRect()
  if (!mmRect.width || !mmRect.height) return

  // 获取内容边界
  const svgEl = mindmapInstance.el.querySelector('svg')
  if (!svgEl) return

  const bbox = getSvgBBox(svgEl)

  // 点击位置在小地图中的比例
  const ratioX = (e.clientX - mmRect.left) / mmRect.width
  const ratioY = (e.clientY - mmRect.top) / mmRect.height

  // 对应的内容坐标
  const contentX = bbox.x + ratioX * bbox.width
  const contentY = bbox.y + ratioY * bbox.height

  // 计算平移量使该点居中
  const s = mindmapInstance.view.scale || 1
  const editorRect = mindmapInstance.el.getBoundingClientRect()

  const newTx = -(contentX * s - editorRect.width / 2)
  const newTy = -(contentY * s - editorRect.height / 2)

  mindmapInstance.view.translateXTo(newTx)
  mindmapInstance.view.translateYTo(newTy)
  mindmapInstance.view.transform()
}

function onMinimapMouseDown(e) {
  e.preventDefault()
  isDraggingMinimap.value = true
  navigateFromMinimap(e)

  const onMove = (ev) => {
    if (isDraggingMinimap.value) navigateFromMinimap(ev)
  }
  const onUp = () => {
    isDraggingMinimap.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function toggleMinimap() {
  showMinimap.value = !showMinimap.value
  if (showMinimap.value) {
    nextTick(() => updateMinimap())
  }
}

// ===== 右键菜单 =====
function contextAddChild() { addChildNode(); showContextMenu.value = false }
function contextAddSibling() { addSiblingNode(); showContextMenu.value = false }
function contextDelete() { deleteNode(); showContextMenu.value = false }
function contextExpand() { expandNode(); showContextMenu.value = false }
function contextCollapse() { collapseNode(); showContextMenu.value = false }

// ===== P2: 备注功能 =====
function toggleNotePanel() {
  showNotePanel.value = !showNotePanel.value
  if (showNotePanel.value) {
    const node = mindmapInstance?.renderer.activeNodeList[0]
    if (node) {
      noteText.value = node.getData('note') || ''
    } else {
      noteText.value = ''
    }
  }
}

function saveNote() {
  const node = mindmapInstance?.renderer.activeNodeList[0]
  if (!node) return
  mindmapInstance.execCommand('SET_NODE_NOTE', node, noteText.value)
  showNotePanel.value = false
}

// ===== P2: 超链接功能 =====
function toggleLinkDialog() {
  showLinkDialog.value = !showLinkDialog.value
  if (showLinkDialog.value) {
    const node = mindmapInstance?.renderer.activeNodeList[0]
    if (node) {
      linkUrl.value = node.getData('hyperlink') || ''
      linkTitle.value = node.getData('hyperlinkTitle') || ''
    } else {
      linkUrl.value = ''
      linkTitle.value = ''
    }
  }
}

function saveLink() {
  const node = mindmapInstance?.renderer.activeNodeList[0]
  if (!node) return
  mindmapInstance.execCommand('SET_NODE_HYPERLINK', node, linkUrl.value, linkTitle.value)
  showLinkDialog.value = false
}

function removeLink() {
  const node = mindmapInstance?.renderer.activeNodeList[0]
  if (!node) return
  mindmapInstance.execCommand('SET_NODE_HYPERLINK', node, '', '')
  showLinkDialog.value = false
}

// ===== P2: 图片插入 =====
function insertImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const node = mindmapInstance?.renderer.activeNodeList[0]
      if (!node) return
      const img = new Image()
      img.onload = () => {
        const maxWidth = 200
        const ratio = img.width / img.height
        const width = Math.min(img.width, maxWidth)
        const height = width / ratio
        mindmapInstance.execCommand('SET_NODE_IMAGE', node, {
          url: event.target.result,
          title: file.name,
          width,
          height,
          custom: true,
        })
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

function removeImage() {
  const node = mindmapInstance?.renderer.activeNodeList[0]
  if (!node) return
  mindmapInstance.execCommand('SET_NODE_IMAGE', node, {
    url: '',
    title: '',
    width: 0,
    height: 0,
    custom: false,
  })
}

// ===== P2: 节点样式 =====
function toggleStylePanel() {
  showStylePanel.value = !showStylePanel.value
  if (showStylePanel.value) {
    const node = mindmapInstance?.renderer.activeNodeList[0]
    if (node) {
      const data = node.getData()
      nodeStyle.color = data.color || '#333'
      nodeStyle.backgroundColor = data.backgroundColor || '#fff'
      nodeStyle.borderColor = data.borderColor || '#4f46e5'
      nodeStyle.fontSize = data.fontSize || 14
      nodeStyle.shape = data.shape || 'rectangle'
    }
  }
}

function applyNodeStyle() {
  const node = mindmapInstance?.renderer.activeNodeList[0]
  if (!node) return
  mindmapInstance.execCommand('SET_NODE_STYLE', node, 'color', nodeStyle.color)
  mindmapInstance.execCommand('SET_NODE_STYLE', node, 'backgroundColor', nodeStyle.backgroundColor)
  mindmapInstance.execCommand('SET_NODE_STYLE', node, 'borderColor', nodeStyle.borderColor)
  mindmapInstance.execCommand('SET_NODE_STYLE', node, 'fontSize', nodeStyle.fontSize)
  mindmapInstance.execCommand('SET_NODE_STYLE', node, 'shape', nodeStyle.shape)
}

// ===== 保存 =====
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => handleSave(), 1000)
}

async function handleSave() {
  if (!mindmapInstance || saving.value) return
  saving.value = true
  try {
    const data = mindmapInstance.getData()
    localStorage.setItem(`mindmap_${route.params.id}`, JSON.stringify({ title: title.value, data }))
    await store.updateMindmap(route.params.id, { title: title.value, data })
  } catch (e) {
    console.error('Save failed:', e)
  } finally {
    saving.value = false
  }
}

function handleTitleBlur() { isEditingTitle.value = false; handleSave() }
function handleTitleKeyup(e) { if (e.key === 'Enter') { isEditingTitle.value = false; handleSave() } }
function handleBack() { router.push('/') }

// ===== 导出 =====
async function doExport(type) {
  if (!mindmapInstance) return
  try {
    await mindmapInstance.export(type, true, title.value)
  } catch (e) {
    console.error('Export failed:', e)
  }
}

async function exportMarkdown() {
  if (!mindmapInstance) return
  try {
    const md = await mindmapInstance.doExport.md()
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${title.value}.md`; a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Export MD failed:', e)
  }
}
</script>

<template>
  <div class="editor-page">
    <!-- 顶部工具栏 -->
    <header class="toolbar">
      <div class="toolbar-left">
        <button class="btn-icon" @click="handleBack" title="返回首页">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div class="title-area">
          <input v-if="isEditingTitle" v-model="title" class="title-input" @blur="handleTitleBlur" @keyup="handleTitleKeyup" autofocus />
          <h1 v-else class="title" @click="isEditingTitle = true">{{ title }}</h1>
          <span v-if="saving" class="save-status saving">保存中...</span>
          <span v-else class="save-status saved">已保存</span>
        </div>
      </div>

      <div class="toolbar-center">
        <div class="btn-group">
          <button class="btn-icon" :disabled="!canUndo" @click="undo" title="撤销 (Ctrl+Z)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a5 5 0 0 1 5 5v2M3 10l4-4M3 10l4 4"/></svg>
          </button>
          <button class="btn-icon" :disabled="!canRedo" @click="redo" title="重做 (Ctrl+Y)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10H11a5 5 0 0 0-5 5v2M21 10l-4-4M21 10l-4 4"/></svg>
          </button>
        </div>
        <span class="divider"></span>
        <div class="btn-group">
          <button class="btn-icon" @click="addChildNode" title="添加子节点 (Tab)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span class="btn-text">子节点</span>
          </button>
          <button class="btn-icon" @click="addSiblingNode" title="添加兄弟节点 (Enter)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span class="btn-text">兄弟</span>
          </button>
          <button class="btn-icon" @click="deleteNode" title="删除节点 (Delete)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
        <span class="divider"></span>
        <div class="btn-group">
          <button class="btn-icon" @click="expandAll" title="全部展开">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          </button>
          <button class="btn-icon" @click="collapseAll" title="全部收起">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>
          </button>
        </div>
        <span class="divider"></span>
        <div class="btn-group zoom-group">
          <button class="btn-icon" @click="zoomOut" title="缩小 (Ctrl+-)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
          </button>
          <span class="zoom-level" @click="resetZoom" title="点击重置">{{ zoomLevel }}%</span>
          <button class="btn-icon" @click="zoomIn" title="放大 (Ctrl++)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>
          </button>
          <button class="btn-icon" @click="fitCanvas" title="适应画布">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m-10-10h4m12 0h4"/></svg>
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <select class="toolbar-select" v-model="currentLayout" @change="setLayout(currentLayout)">
          <option v-for="l in layouts" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
        <select class="toolbar-select" v-model="currentTheme" @change="setTheme(currentTheme)">
          <option v-for="t in themes" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <span class="divider"></span>
        <button class="btn-icon" :class="{ active: showSearch }" @click="toggleSearch" title="搜索 (Ctrl+F)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </button>
        <button class="btn-icon" :class="{ active: showOutline }" @click="toggleOutline" title="大纲模式">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
        </button>
        <button class="btn-icon" @click="enterDemonstrate" title="演示模式">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <span class="divider"></span>
        <!-- P2: 备注/链接/图片/样式 -->
        <button class="btn-icon" :class="{ active: showNotePanel }" @click="toggleNotePanel" title="备注">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
        </button>
        <button class="btn-icon" :class="{ active: showLinkDialog }" @click="toggleLinkDialog" title="超链接">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        </button>
        <button class="btn-icon" @click="insertImage" title="插入图片">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        </button>
        <button class="btn-icon" :class="{ active: showStylePanel }" @click="toggleStylePanel" title="节点样式">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>
        </button>
        <button class="btn-icon" :class="{ active: showMinimap }" @click="toggleMinimap" title="俯瞰图">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        </button>
        <span class="divider"></span>
        <div class="dropdown" @mouseenter="$refs.exportMenu?.classList.add('show')" @mouseleave="$refs.exportMenu?.classList.remove('show')">
          <button class="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            <span class="btn-text">导出</span>
          </button>
          <div ref="exportMenu" class="dropdown-menu">
            <button @click="doExport('png')">PNG 图片</button>
            <button @click="doExport('svg')">SVG 矢量图</button>
            <button @click="doExport('pdf')">PDF 文档</button>
            <button @click="exportMarkdown">Markdown</button>
            <button @click="doExport('json')">JSON 数据</button>
          </div>
        </div>
      </div>
    </header>

    <!-- 搜索面板 -->
    <div v-if="showSearch" class="search-panel">
      <input v-model="searchText" class="search-input" placeholder="搜索节点内容..." @input="doSearch" @keyup.enter="searchNext" @keyup.escape="toggleSearch" />
      <span class="search-count" v-if="searchResult.total > 0">{{ searchResult.current }} / {{ searchResult.total }}</span>
      <span class="search-count" v-else-if="searchText">无结果</span>
      <button class="btn-icon sm" @click="searchPrev" :disabled="!searchResult.total">◀</button>
      <button class="btn-icon sm" @click="searchNext" :disabled="!searchResult.total">▶</button>
    </div>

    <!-- 图标工具栏 -->
    <div class="icon-toolbar">
      <template v-for="group in iconGroups" :key="group.type">
        <span class="icon-group-label">{{ group.name }}:</span>
        <button v-for="item in group.items" :key="`${group.type}-${item.name}`" class="icon-btn" @click="setIcon(group.type, item.name)" :title="`${group.name} ${item.name}`" :style="{ '--icon-color': item.color }">
          <svg width="16" height="16" viewBox="0 0 1024 1024"><circle cx="512" cy="512" r="512" :fill="item.color"/><text x="512" y="580" text-anchor="middle" fill="white" font-size="500" font-weight="bold">{{ item.label }}</text></svg>
        </button>
      </template>
    </div>

    <!-- 主体区域 -->
    <div class="editor-body" :class="{ 'with-outline': showOutline }">
      <div ref="mindmapContainer" class="mindmap-container"></div>

      <!-- 大纲面板 -->
      <div v-if="showOutline" class="outline-panel">
        <div class="outline-header">
          <h3>大纲</h3>
          <button class="btn-icon sm" @click="toggleOutline">✕</button>
        </div>
        <div class="outline-content">
          <template v-for="item in outlineToFlat(outlineData)" :key="item.uid">
            <div class="outline-item" :style="{ paddingLeft: (item.level * 16 + 8) + 'px' }" @click="jumpToNode(item.uid)">
              <span class="outline-bullet" :class="{ 'is-root': item.level === 0 }">●</span>
              <span class="outline-text">{{ item.text }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div v-if="showContextMenu" class="context-menu" :style="{ left: contextMenuPos.x + 'px', top: contextMenuPos.y + 'px' }">
      <button @click="contextAddChild">➕ 添加子节点</button>
      <button @click="contextAddSibling">➕ 添加兄弟节点</button>
      <div class="context-divider"></div>
      <button @click="contextExpand">📂 展开节点</button>
      <button @click="contextCollapse">📁 收起节点</button>
      <div class="context-divider"></div>
      <button @click="contextDelete" class="danger">🗑️ 删除节点</button>
    </div>

    <!-- P2: 备注面板 -->
    <div v-if="showNotePanel" class="panel note-panel">
      <div class="panel-header">
        <h3>节点备注</h3>
        <button class="btn-icon sm" @click="showNotePanel = false">✕</button>
      </div>
      <div class="panel-body">
        <textarea v-model="noteText" class="note-textarea" placeholder="输入备注内容..." rows="6"></textarea>
      </div>
      <div class="panel-footer">
        <button class="btn-primary" @click="saveNote">保存</button>
      </div>
    </div>

    <!-- P2: 超链接对话框 -->
    <div v-if="showLinkDialog" class="panel link-panel">
      <div class="panel-header">
        <h3>超链接</h3>
        <button class="btn-icon sm" @click="showLinkDialog = false">✕</button>
      </div>
      <div class="panel-body">
        <div class="form-group">
          <label>链接地址</label>
          <input v-model="linkUrl" class="form-input" placeholder="https://example.com" />
        </div>
        <div class="form-group">
          <label>显示标题</label>
          <input v-model="linkTitle" class="form-input" placeholder="链接标题（可选）" />
        </div>
      </div>
      <div class="panel-footer">
        <button class="btn-danger" @click="removeLink" v-if="linkUrl">移除</button>
        <button class="btn-primary" @click="saveLink">保存</button>
      </div>
    </div>

    <!-- P2: 样式面板 -->
    <div v-if="showStylePanel" class="panel style-panel">
      <div class="panel-header">
        <h3>节点样式</h3>
        <button class="btn-icon sm" @click="showStylePanel = false">✕</button>
      </div>
      <div class="panel-body">
        <div class="form-group">
          <label>文字颜色</label>
          <input type="color" v-model="nodeStyle.color" class="color-input" />
        </div>
        <div class="form-group">
          <label>背景颜色</label>
          <input type="color" v-model="nodeStyle.backgroundColor" class="color-input" />
        </div>
        <div class="form-group">
          <label>边框颜色</label>
          <input type="color" v-model="nodeStyle.borderColor" class="color-input" />
        </div>
        <div class="form-group">
          <label>字体大小</label>
          <input type="range" v-model="nodeStyle.fontSize" min="12" max="24" class="range-input" />
          <span class="range-value">{{ nodeStyle.fontSize }}px</span>
        </div>
        <div class="form-group">
          <label>形状</label>
          <select v-model="nodeStyle.shape" class="form-select">
            <option value="rectangle">矩形</option>
            <option value="roundedRectangle">圆角矩形</option>
          </select>
        </div>
      </div>
      <div class="panel-footer">
        <button class="btn-primary" @click="applyNodeStyle">应用</button>
      </div>
    </div>

    <!-- 快捷键提示 -->
    <div class="shortcuts-hint">
      <span>Tab: 子节点</span>
      <span>Enter: 兄弟节点</span>
      <span>Delete: 删除</span>
      <span>Ctrl+Z/Y: 撤销/重做</span>
      <span>Ctrl+F: 搜索</span>
      <span>Space: 折叠/展开</span>
    </div>

    <!-- 俯瞰图（小地图） -->
    <div v-if="showMinimap" ref="minimapOverlay" class="minimap-overlay" @mousedown="onMinimapMouseDown">
      <svg class="minimap-svg" :viewBox="minimapViewBox" preserveAspectRatio="xMidYMid meet">
        <g v-html="minimapSvgContent"></g>
      </svg>
      <div
        class="minimap-viewport"
        :style="{
          left: minimapViewport.left + 'px',
          top: minimapViewport.top + 'px',
          width: minimapViewport.width + 'px',
          height: minimapViewport.height + 'px',
        }"
      ></div>
      <div class="minimap-label">俯瞰图</div>
    </div>
  </div>
</template>

<style scoped>
.editor-page { display: flex; flex-direction: column; height: 100vh; background: #f5f5f5; }

/* 工具栏 */
.toolbar { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #fff; border-bottom: 1px solid #e5e5e5; box-shadow: 0 1px 3px rgba(0,0,0,0.05); z-index: 10; gap: 6px; flex-wrap: nowrap; overflow-x: auto; }
.toolbar-left, .toolbar-center, .toolbar-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.toolbar-right { flex-shrink: 1; overflow-x: auto; min-width: 0; }
.toolbar-center { flex: 1; justify-content: center; }
.btn-group { display: flex; align-items: center; gap: 2px; }
.btn-icon { display: flex; align-items: center; gap: 4px; padding: 5px 8px; background: transparent; border: 1px solid transparent; border-radius: 6px; color: #333; font-size: 13px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
.btn-icon:hover:not(:disabled) { background: #f0f0f0; border-color: #ddd; }
.btn-icon.active { background: #e0e7ff; border-color: #4f46e5; color: #4f46e5; }
.btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-icon svg { flex-shrink: 0; }
.btn-icon.sm { padding: 3px 6px; font-size: 12px; }
.btn-text { font-size: 11px; }
.divider { width: 1px; height: 20px; background: #e0e0e0; margin: 0 2px; }
.title-area { display: flex; align-items: center; gap: 6px; margin-left: 6px; }
.title { font-size: 15px; font-weight: 600; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
.title:hover { background: #f0f0f0; }
.title-input { font-size: 15px; font-weight: 600; border: 2px solid #4f46e5; padding: 2px 6px; border-radius: 4px; outline: none; }
.save-status { font-size: 11px; padding: 1px 6px; border-radius: 8px; }
.save-status.saving { color: #f59e0b; background: #fef3c7; }
.save-status.saved { color: #22c55e; background: #dcfce7; }
.toolbar-select { padding: 5px 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; background: #fff; cursor: pointer; outline: none; }
.toolbar-select:hover { border-color: #4f46e5; }
.zoom-group { display: flex; align-items: center; gap: 2px; }
.zoom-level { font-size: 12px; color: #555; min-width: 40px; text-align: center; cursor: pointer; padding: 2px 4px; border-radius: 4px; user-select: none; }
.zoom-level:hover { background: #f0f0f0; color: #333; }

/* 下拉菜单 */
.dropdown { position: relative; }
.dropdown-menu { display: none; position: absolute; top: 100%; right: 0; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); min-width: 130px; z-index: 20; overflow: hidden; }
.dropdown-menu.show { display: block; }
.dropdown-menu button { display: block; width: 100%; padding: 7px 14px; text-align: left; font-size: 12px; background: transparent; border: none; cursor: pointer; }
.dropdown-menu button:hover { background: #f5f5f5; }

/* 搜索面板 */
.search-panel { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #fff; border-bottom: 1px solid #e5e5e5; }
.search-input { flex: 1; max-width: 300px; padding: 5px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; outline: none; }
.search-input:focus { border-color: #4f46e5; }
.search-count { font-size: 12px; color: #666; min-width: 60px; text-align: center; }

/* 图标工具栏 */
.icon-toolbar { display: flex; align-items: center; gap: 4px; padding: 4px 12px; background: #fafafa; border-bottom: 1px solid #e5e5e5; }
.icon-group-label { font-size: 11px; color: #888; margin-left: 8px; }
.icon-btn { padding: 2px 4px; background: transparent; border: 1px solid transparent; border-radius: 4px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; }
.icon-btn:hover { background: #e0e7ff; border-color: #4f46e5; }

/* 主体区域 */
.editor-body { flex: 1; display: flex; overflow: hidden; }
.editor-body.with-outline .mindmap-container { width: calc(100% - 260px); }
.mindmap-container { width: 100%; height: 100%; }

/* 大纲面板 */
.outline-panel { width: 260px; background: #fff; border-left: 1px solid #e5e5e5; display: flex; flex-direction: column; }
.outline-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #e5e5e5; }
.outline-header h3 { font-size: 14px; font-weight: 600; margin: 0; }
.outline-content { flex: 1; overflow-y: auto; padding: 4px 0; }
.outline-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; cursor: pointer; font-size: 13px; border-radius: 4px; margin: 1px 4px; }
.outline-item:hover { background: #f0f0f0; }
.outline-bullet { font-size: 6px; color: #4f46e5; flex-shrink: 0; }
.outline-bullet.is-root { font-size: 8px; color: #ef4444; }
.outline-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 右键菜单 */
.context-menu { position: fixed; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); min-width: 160px; z-index: 100; padding: 4px; }
.context-menu button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 12px; text-align: left; font-size: 13px; background: transparent; border: none; border-radius: 4px; cursor: pointer; color: #333; }
.context-menu button:hover { background: #f0f0f0; }
.context-menu button.danger { color: #ef4444; }
.context-menu button.danger:hover { background: #fef2f2; }
.context-divider { height: 1px; background: #e5e5e5; margin: 3px 0; }

/* 快捷键提示 */
.shortcuts-hint { position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 14px; padding: 5px 14px; background: rgba(0,0,0,0.7); border-radius: 18px; z-index: 10; }
.shortcuts-hint span { font-size: 10px; color: #bbb; white-space: nowrap; }

/* P2: 面板通用样式 */
.panel { position: fixed; background: #fff; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 50; min-width: 280px; max-width: 360px; }
.note-panel { bottom: 80px; right: 20px; }
.link-panel { top: 50%; left: 50%; transform: translate(-50%, -50%); }
.style-panel { top: 50%; left: 50%; transform: translate(-50%, -50%); }
.panel-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e5e5e5; }
.panel-header h3 { font-size: 15px; font-weight: 600; margin: 0; }
.panel-body { padding: 16px; }
.panel-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid #e5e5e5; }

.note-textarea { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; resize: vertical; outline: none; font-family: inherit; }
.note-textarea:focus { border-color: #4f46e5; }

.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
.form-input { width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; outline: none; }
.form-input:focus { border-color: #4f46e5; }
.form-select { width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; outline: none; background: #fff; }
.color-input { width: 100%; height: 32px; padding: 2px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; }
.range-input { width: 100%; }
.range-value { font-size: 12px; color: #666; }

.btn-primary { padding: 6px 16px; background: #4f46e5; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-primary:hover { background: #4338ca; }
.btn-danger { padding: 6px 16px; background: #ef4444; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-danger:hover { background: #dc2626; }

/* 俯瞰图（小地图） */
.minimap-overlay {
  position: fixed;
  bottom: 50px;
  right: 16px;
  width: 240px;
  height: 170px;
  background: #f8fafc;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  cursor: crosshair;
  z-index: 20;
  user-select: none;
}
.minimap-svg {
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.minimap-viewport {
  position: absolute;
  border: 2px solid #6366f1;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 2px;
  pointer-events: none;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.06);
  transition: left 0.05s ease-out, top 0.05s ease-out;
}
.minimap-label {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: 9px;
  color: #94a3b8;
  pointer-events: none;
  letter-spacing: 0.5px;
  background: rgba(255,255,255,0.7);
  padding: 1px 4px;
  border-radius: 3px;
}
</style>
