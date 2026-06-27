import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// CORS: 只允许配置的域名
app.use('/*', async (c, next) => {
  const allowedOrigins = (c.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')
  const origin = c.req.header('Origin') || ''
  if (allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    c.header('Access-Control-Allow-Credentials', 'true')
  }
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204)
  }
  await next()
})

// JWT_SECRET 从环境变量读取，不再硬编码

// ==================== JWT 工具函数 ====================

function getJWTSecret(c) {
  return c.env.JWT_SECRET || 'fallback-dev-secret-change-in-production'
}

async function base64UrlEncode(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data)
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function createJWT(c, payload) {
  const secret = getJWTSecret(c)
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = await base64UrlEncode(header)
  const payloadB64 = await base64UrlEncode(payload)
  const data = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  return `${data}.${sigB64}`
}

async function verifyJWT(c, token) {
  const secret = getJWTSecret(c)
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerB64, payloadB64, sigB64] = parts
  const data = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const sigStr = atob(sigB64.replace(/-/g, '+').replace(/_/g, '/'))
  const sigBytes = new Uint8Array(sigStr.length)
  for (let i = 0; i < sigStr.length; i++) sigBytes[i] = sigStr.charCodeAt(i)

  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data))
  if (!valid) return null

  const payload = JSON.parse(await base64UrlDecode(payloadB64))
  if (payload.exp && Date.now() / 1000 > payload.exp) return null
  return payload
}

// ==================== 密码哈希 ====================

async function hashPassword(password) {
  const salt = crypto.randomUUID()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
    key,
    256
  )
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)))
  return `${salt}:${hash}`
}

// 恒定时间字符串比较，防止时间侧信道攻击
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
    key,
    256
  )
  const newHash = btoa(String.fromCharCode(...new Uint8Array(bits)))
  return timingSafeEqual(newHash, hash)
}

// ==================== 鉴权中间件 ====================

async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }

  const token = authHeader.substring(7)
  const payload = await verifyJWT(c, token)
  if (!payload) {
    return c.json({ error: '登录已过期' }, 401)
  }

  c.set('userId', payload.userId)
  c.set('username', payload.username)
  await next()
}

// ==================== 用户 API ====================

app.post('/api/auth/register', async (c) => {
  const db = c.env.DB
  const { username, password } = await c.req.json()

  if (!username || !password) {
    return c.json({ error: '用户名和密码不能为空' }, 400)
  }
  if (username.length < 2 || username.length > 20) {
    return c.json({ error: '用户名长度 2-20 个字符' }, 400)
  }
  if (password.length < 6) {
    return c.json({ error: '密码至少 6 个字符' }, 400)
  }

  const existing = await db
    .prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first()

  if (existing) {
    return c.json({ error: '用户名已存在' }, 409)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const passwordHash = await hashPassword(password)
  const recoveryKey = crypto.randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase()

  await db
    .prepare('INSERT INTO users (id, username, password_hash, recovery_key, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, username, passwordHash, recoveryKey, now)
    .run()

  const token = await createJWT(c, { userId: id, username, exp: Math.floor(Date.now() / 1000) + 86400 * 7 })

  return c.json({ token, user: { id, username }, recovery_key: recoveryKey }, 201)
})

app.post('/api/auth/login', async (c) => {
  const db = c.env.DB
  const { username, password } = await c.req.json()

  if (!username || !password) {
    return c.json({ error: '用户名和密码不能为空' }, 400)
  }

  const user = await db
    .prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .first()

  if (!user) {
    return c.json({ error: '用户名或密码错误' }, 401)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return c.json({ error: '用户名或密码错误' }, 401)
  }

  const token = await createJWT(c, { userId: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 86400 * 7 })

  return c.json({ token, user: { id: user.id, username: user.username } })
})

app.get('/api/auth/me', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const username = c.get('username')
  return c.json({ user: { id: userId, username } })
})

// 密码重置：使用恢复码
app.post('/api/auth/reset-password', async (c) => {
  const db = c.env.DB
  const { username, recovery_key, new_password } = await c.req.json()

  if (!username || !recovery_key || !new_password) {
    return c.json({ error: '请填写所有字段' }, 400)
  }
  if (new_password.length < 6) {
    return c.json({ error: '密码至少 6 个字符' }, 400)
  }

  const user = await db
    .prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .first()

  if (!user) {
    return c.json({ error: '用户名不存在' }, 404)
  }

  // 恢复码比较使用恒定时间
  if (!timingSafeEqual(user.recovery_key, recovery_key.toUpperCase())) {
    return c.json({ error: '恢复码错误' }, 401)
  }

  const newHash = await hashPassword(new_password)
  await db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(newHash, user.id)
    .run()

  return c.json({ success: true, message: '密码重置成功，请使用新密码登录' })
})

// ==================== 文件夹 API（需要鉴权） ====================

app.get('/api/folders', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const { results } = await db
    .prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY name ASC')
    .bind(userId)
    .all()
  return c.json(results)
})

app.post('/api/folders', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const body = await c.req.json()

  if (!body.name || body.name.length > 100) {
    return c.json({ error: 'Folder name must be 1-100 characters' }, 400)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db
    .prepare(
      'INSERT INTO folders (id, name, parent_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(id, body.name, body.parent_id || null, userId, now, now)
    .run()

  const result = await db
    .prepare('SELECT * FROM folders WHERE id = ?')
    .bind(id)
    .first()

  return c.json(result, 201)
})

app.put('/api/folders/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const existing = await db
    .prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first()

  if (!existing) {
    return c.json({ error: 'Not found' }, 404)
  }

  await db
    .prepare(
      'UPDATE folders SET name = ?, parent_id = ?, updated_at = ? WHERE id = ?'
    )
    .bind(
      body.name || existing.name,
      body.parent_id !== undefined ? body.parent_id : existing.parent_id,
      now,
      id
    )
    .run()

  const result = await db
    .prepare('SELECT * FROM folders WHERE id = ?')
    .bind(id)
    .first()

  return c.json(result)
})

app.delete('/api/folders/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const id = c.req.param('id')

  const existing = await db
    .prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first()

  if (!existing) {
    return c.json({ error: 'Not found' }, 404)
  }

  await db
    .prepare('UPDATE mindmaps SET folder_id = NULL WHERE folder_id = ?')
    .bind(id)
    .run()

  await db
    .prepare('DELETE FROM folders WHERE parent_id = ?')
    .bind(id)
    .run()

  await db.prepare('DELETE FROM folders WHERE id = ?').bind(id).run()

  return c.json({ success: true })
})

// ==================== 思维导图 API（需要鉴权） ====================

app.get('/api/mindmaps', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const folderId = c.req.query('folder_id')

  let query = 'SELECT * FROM mindmaps WHERE user_id = ?'
  let params = [userId]

  if (folderId === 'root') {
    query += ' AND folder_id IS NULL'
  } else if (folderId) {
    query += ' AND folder_id = ?'
    params.push(folderId)
  }

  query += ' ORDER BY updated_at DESC'

  const { results } = await db.prepare(query).bind(...params).all()
  return c.json(results)
})

app.get('/api/mindmaps/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const id = c.req.param('id')
  const result = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first()

  if (!result) {
    return c.json({ error: 'Not found' }, 404)
  }

  return c.json({
    ...result,
    data: JSON.parse(result.data),
  })
})

app.post('/api/mindmaps', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const body = await c.req.json()

  if (!body.title || body.title.length > 200) {
    return c.json({ error: 'Title must be 1-200 characters' }, 400)
  }
  if (!body.data) {
    return c.json({ error: 'Data is required' }, 400)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db
    .prepare(
      'INSERT INTO mindmaps (id, title, data, folder_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      id,
      body.title,
      JSON.stringify(body.data),
      body.folder_id || null,
      userId,
      now,
      now
    )
    .run()

  const result = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ?')
    .bind(id)
    .first()

  return c.json(
    {
      ...result,
      data: JSON.parse(result.data),
    },
    201
  )
})

app.put('/api/mindmaps/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const existing = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first()

  if (!existing) {
    return c.json({ error: 'Not found' }, 404)
  }

  await db
    .prepare(
      'UPDATE mindmaps SET title = ?, data = ?, folder_id = ?, updated_at = ? WHERE id = ?'
    )
    .bind(
      body.title || existing.title,
      body.data ? JSON.stringify(body.data) : existing.data,
      body.folder_id !== undefined ? body.folder_id : existing.folder_id,
      now,
      id
    )
    .run()

  const result = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ?')
    .bind(id)
    .first()

  return c.json({
    ...result,
    data: JSON.parse(result.data),
  })
})

app.delete('/api/mindmaps/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const id = c.req.param('id')

  const existing = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first()

  if (!existing) {
    return c.json({ error: 'Not found' }, 404)
  }

  await db.prepare('DELETE FROM mindmaps WHERE id = ?').bind(id).run()

  return c.json({ success: true })
})

// ==================== 分享 API（公开，不需要鉴权） ====================

app.post('/api/mindmaps/:id/share', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const id = c.req.param('id')

  const existing = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first()

  if (!existing) {
    return c.json({ error: 'Not found' }, 404)
  }

  if (existing.share_token) {
    return c.json({ share_token: existing.share_token })
  }

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 8)
  const now = new Date().toISOString()

  await db
    .prepare('UPDATE mindmaps SET share_token = ?, updated_at = ? WHERE id = ?')
    .bind(token, now, id)
    .run()

  return c.json({ share_token: token })
})

app.delete('/api/mindmaps/:id/share', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const id = c.req.param('id')
  const now = new Date().toISOString()

  await db
    .prepare('UPDATE mindmaps SET share_token = NULL, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(now, id, userId)
    .run()

  return c.json({ success: true })
})

app.get('/api/shared/:token', async (c) => {
  const db = c.env.DB
  const token = c.req.param('token')

  const result = await db
    .prepare('SELECT id, title, data, share_token, created_at, updated_at FROM mindmaps WHERE share_token = ?')
    .bind(token)
    .first()

  if (!result) {
    return c.json({ error: 'Not found or not shared' }, 404)
  }

  return c.json({
    ...result,
    data: JSON.parse(result.data),
  })
})

// ==================== 导入 API（需要鉴权） ====================

app.post('/api/import/json', authMiddleware, async (c) => {
  const db = c.env.DB
  const userId = c.get('userId')
  const body = await c.req.json()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const title = body.title || '导入的思维导图'
  const data = body.data

  await db
    .prepare(
      'INSERT INTO mindmaps (id, title, data, folder_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(id, title, JSON.stringify(data), body.folder_id || null, userId, now, now)
    .run()

  const result = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ?')
    .bind(id)
    .first()

  return c.json({
    ...result,
    data: JSON.parse(result.data),
  }, 201)
})

export default app
