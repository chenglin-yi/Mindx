<div align="right">

[中文](./README_CN.md)

</div>

<div align="center">

# Mindx

**A free, open-source mind mapping tool for everyone**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883)](https://vuejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f48120)](https://workers.cloudflare.com/)

<br />

A lightweight, self-hosted mind mapping application built with modern web technologies. Create, organize, and share your ideas without any subscription fees.

</div>

---

## Features

### Core Editing
- **Multiple Layouts** — Logical structure, mind map, org chart, directory, timeline, fishbone diagram
- **Rich Node Operations** — Add child/sibling nodes, drag & drop, copy/paste, collapse/expand
- **Undo / Redo** — Full history support with `Ctrl+Z` / `Ctrl+Y`
- **Keyboard Shortcuts** — `Tab` for child node, `Enter` for sibling, `Delete` to remove, `Space` to toggle collapse
- **Search** — Find and navigate to any node with `Ctrl+F`

### Styling & Themes
- **5 Built-in Themes** — Default, Dark, Blue Sky, Fresh Green, Warm Orange
- **Node Styling** — Custom text color, background, border, font size, and shape
- **Icons & Tags** — 6-level priority markers (P1–P6) and 4-stage progress indicators
- **Local Preferences** — Remembers your preferred layout and theme across sessions

### Content Enrichment
- **Notes** — Attach detailed notes to any node
- **Hyperlinks** — Add clickable links with custom titles
- **Images** — Insert images directly into nodes

### Import & Export
- **Import** — JSON, Markdown, XMind (.xmind) formats
- **Export** — PNG, SVG, PDF, Markdown, JSON

### Navigation & View
- **Minimap** — Bird's-eye overview with click-to-navigate and drag support
- **Outline Mode** — Tree-view sidebar for quick content overview
- **Presentation Mode** — Fullscreen step-by-step presentation
- **Zoom Controls** — Buttons + keyboard shortcuts (`Ctrl++` / `Ctrl+-` / `Ctrl+0`)

### Organization
- **Folder Management** — Organize mind maps into folders
- **Share Links** — Generate read-only sharing URLs
- **Auto Save** — Saves 1 second after editing, with local backup

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Frontend | Vue 3 + Vite + Pinia |
| Mind Map Engine | [simple-mind-map](https://github.com/wanglin2/mind-map) |
| Backend | Cloudflare Workers (Hono) |
| Database | Cloudflare D1 (SQLite) |
| Deployment | Cloudflare Workers + EdgeOne Pages |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (for backend)

### Local Development

```bash
# Clone the repository
git clone https://github.com/nicoyabernathy/Mindx.git
cd Mindx

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Initialize local database
npx wrangler d1 execute mindx --local --file=./schema.sql

# Start backend (Terminal 1)
npx wrangler dev

# Start frontend (Terminal 2)
cd ../frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### Deploy to Cloudflare (Free)

```bash
# Create D1 database
cd backend
npx wrangler d1 create mindx
# Update database_id in wrangler.toml

# Initialize production database
npx wrangler d1 execute mindx --remote --file=./schema.sql

# Deploy backend
npm run deploy

# Build and deploy frontend
cd ../frontend
npm run build
# Upload dist/ to EdgeOne Pages or Cloudflare Pages
```

---

## Project Structure

```
Mindx/
├── frontend/                # Vue 3 frontend
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── router/          # Vue Router
│   │   ├── stores/          # Pinia state management
│   │   └── views/           # Page components
│   │       ├── HomeView     # Dashboard with folders & cards
│   │       ├── EditorView   # Mind map editor
│   │       └── ShareView    # Public share page
│   └── vite.config.js
├── backend/                 # Cloudflare Workers API
│   ├── src/index.js         # Hono routes
│   ├── schema.sql           # D1 database schema
│   └── wrangler.toml        # Cloudflare config
└── README.md
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|:---------|:-------|
| `Tab` | Add child node |
| `Enter` | Add sibling node |
| `Delete` | Delete selected node |
| `Space` | Toggle expand/collapse |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+F` | Search nodes |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |

---

## Free Tier Limits

| Service | Free Quota |
|:--------|:-----------|
| Cloudflare D1 | 5 GB storage, 10M reads/day |
| Cloudflare Workers | 100K requests/day |
| EdgeOne Pages | Unlimited bandwidth |

More than enough for personal use.

---

## License

[MIT](LICENSE)
