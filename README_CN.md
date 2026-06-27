<div align="right">

[English](./README.md)

</div>

<div align="center">

# Mindx

**一款免费、开源的思维导图工具**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883)](https://vuejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f48120)](https://workers.cloudflare.com/)

<br />

一款轻量级、可自托管的思维导图应用，基于现代 Web 技术构建。无需订阅付费，即可创建、整理和分享你的想法。

</div>

---

## 功能特性

### 核心编辑
- **多种布局** — 逻辑图、思维导图、组织架构图、目录组织、时间轴、鱼骨图
- **丰富的节点操作** — 添加子节点/兄弟节点、拖拽、复制粘贴、折叠/展开
- **撤销 / 重做** — 完整历史记录，支持 `Ctrl+Z` / `Ctrl+Y`
- **快捷键** — `Tab` 添加子节点，`Enter` 添加兄弟节点，`Delete` 删除，`Space` 折叠/展开
- **搜索** — 使用 `Ctrl+F` 查找并定位任意节点

### 样式与主题
- **5 套内置主题** — 默认、暗色、蓝天、清新绿、暖橙
- **节点样式** — 自定义文字颜色、背景色、边框、字体大小、形状
- **图标标记** — 6 级优先级（P1–P6）和 4 阶段进度指示
- **本地偏好记忆** — 自动记住你选择的布局和主题

### 内容增强
- **备注** — 为任意节点添加详细说明
- **超链接** — 插入可点击的链接，支持自定义标题
- **图片** — 直接在节点中插入图片

### 导入导出
- **导入** — JSON、Markdown、XMind (.xmind) 格式
- **导出** — PNG、SVG、PDF、Markdown、JSON

### 视图与导航
- **俯瞰图（小地图）** — 鸟瞰全局，点击/拖拽快速定位
- **大纲模式** — 树形侧边栏，快速浏览内容结构
- **演示模式** — 全屏逐步展示
- **缩放控制** — 按钮 + 快捷键（`Ctrl++` / `Ctrl+-` / `Ctrl+0`）

### 组织管理
- **文件夹管理** — 将思维导图归类到文件夹中
- **分享链接** — 生成只读分享链接
- **自动保存** — 编辑后 1 秒自动保存，同时本地备份

---

## 技术栈

| 层级 | 技术 |
|:-----|:-----|
| 前端 | Vue 3 + Vite + Pinia |
| 思维导图引擎 | [simple-mind-map](https://github.com/wanglin2/mind-map) |
| 后端 | Cloudflare Workers (Hono) |
| 数据库 | Cloudflare D1 (SQLite) |
| 部署 | Cloudflare Workers + EdgeOne Pages |

---

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)（用于后端）

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/nicoyabernathy/Mindx.git
cd Mindx

# 安装前端依赖
cd frontend
npm install

# 安装后端依赖
cd ../backend
npm install

# 初始化本地数据库
npx wrangler d1 execute mindx --local --file=./schema.sql

# 启动后端（终端 1）
npx wrangler dev

# 启动前端（终端 2）
cd ../frontend
npm run dev
```

在浏览器中打开 http://localhost:5173

### 部署到 Cloudflare（免费）

```bash
# 创建 D1 数据库
cd backend
npx wrangler d1 create mindx
# 将返回的 database_id 填入 wrangler.toml

# 初始化生产数据库
npx wrangler d1 execute mindx --remote --file=./schema.sql

# 部署后端
npm run deploy

# 构建并部署前端
cd ../frontend
npm run build
# 将 dist/ 目录上传到 EdgeOne Pages 或 Cloudflare Pages
```

---

## 项目结构

```
Mindx/
├── frontend/                # Vue 3 前端
│   ├── src/
│   │   ├── api/             # API 客户端
│   │   ├── router/          # Vue Router 路由
│   │   ├── stores/          # Pinia 状态管理
│   │   └── views/           # 页面组件
│   │       ├── HomeView     # 首页仪表盘（文件夹 + 卡片）
│   │       ├── EditorView   # 思维导图编辑器
│   │       └── ShareView    # 公开分享页
│   └── vite.config.js
├── backend/                 # Cloudflare Workers API
│   ├── src/index.js         # Hono 路由
│   ├── schema.sql           # D1 数据库表结构
│   └── wrangler.toml        # Cloudflare 配置
└── README.md
```

---

## 快捷键

| 快捷键 | 功能 |
|:-------|:-----|
| `Tab` | 添加子节点 |
| `Enter` | 添加兄弟节点 |
| `Delete` | 删除选中节点 |
| `Space` | 折叠/展开 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做 |
| `Ctrl+F` | 搜索节点 |
| `Ctrl++` | 放大 |
| `Ctrl+-` | 缩小 |
| `Ctrl+0` | 重置缩放 |

---

## 免费额度

| 服务 | 免费额度 |
|:-----|:---------|
| Cloudflare D1 | 5 GB 存储，1000 万次读取/天 |
| Cloudflare Workers | 10 万次请求/天 |
| EdgeOne Pages | 无限带宽 |

个人使用完全够用。

---

## 开源协议

[MIT](LICENSE)
