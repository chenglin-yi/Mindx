import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('/*', cors())

app.get('/api/health', (c) => {
  return c.json({ status: 'ok' })
})

// ==================== 文件夹 API ====================

app.get('/api/folders', async (c) => {
  const db = c.env.DB
  const { results } = await db
    .prepare('SELECT * FROM folders ORDER BY name ASC')
    .all()
  return c.json(results)
})

app.post('/api/folders', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db
    .prepare(
      'INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, body.name, body.parent_id || null, now, now)
    .run()

  const result = await db
    .prepare('SELECT * FROM folders WHERE id = ?')
    .bind(id)
    .first()

  return c.json(result, 201)
})

app.put('/api/folders/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const existing = await db
    .prepare('SELECT * FROM folders WHERE id = ?')
    .bind(id)
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

app.delete('/api/folders/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')

  // 将文件夹内的思维导图移到根目录
  await db
    .prepare('UPDATE mindmaps SET folder_id = NULL WHERE folder_id = ?')
    .bind(id)
    .run()

  // 删除子文件夹
  await db
    .prepare('DELETE FROM folders WHERE parent_id = ?')
    .bind(id)
    .run()

  await db.prepare('DELETE FROM folders WHERE id = ?').bind(id).run()

  return c.json({ success: true })
})

// ==================== 思维导图 API ====================

app.get('/api/mindmaps', async (c) => {
  const db = c.env.DB
  const folderId = c.req.query('folder_id')

  let query = 'SELECT * FROM mindmaps'
  let params = []

  if (folderId === 'root') {
    query += ' WHERE folder_id IS NULL'
  } else if (folderId) {
    query += ' WHERE folder_id = ?'
    params.push(folderId)
  }

  query += ' ORDER BY updated_at DESC'

  const stmt = params.length > 0
    ? db.prepare(query).bind(...params)
    : db.prepare(query)

  const { results } = await stmt.all()
  return c.json(results)
})

app.get('/api/mindmaps/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const result = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ?')
    .bind(id)
    .first()

  if (!result) {
    return c.json({ error: 'Not found' }, 404)
  }

  return c.json({
    ...result,
    data: JSON.parse(result.data),
  })
})

app.post('/api/mindmaps', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db
    .prepare(
      'INSERT INTO mindmaps (id, title, data, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(
      id,
      body.title,
      JSON.stringify(body.data),
      body.folder_id || null,
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

app.put('/api/mindmaps/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const existing = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ?')
    .bind(id)
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

app.delete('/api/mindmaps/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')

  const existing = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ?')
    .bind(id)
    .first()

  if (!existing) {
    return c.json({ error: 'Not found' }, 404)
  }

  await db.prepare('DELETE FROM mindmaps WHERE id = ?').bind(id).run()

  return c.json({ success: true })
})

// ==================== 分享 API ====================

app.post('/api/mindmaps/:id/share', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')

  const existing = await db
    .prepare('SELECT * FROM mindmaps WHERE id = ?')
    .bind(id)
    .first()

  if (!existing) {
    return c.json({ error: 'Not found' }, 404)
  }

  // 如果已有分享链接，直接返回
  if (existing.share_token) {
    return c.json({ share_token: existing.share_token })
  }

  // 生成新的分享 token
  const token = crypto.randomUUID().replace(/-/g, '').substring(0, 12)
  const now = new Date().toISOString()

  await db
    .prepare('UPDATE mindmaps SET share_token = ?, updated_at = ? WHERE id = ?')
    .bind(token, now, id)
    .run()

  return c.json({ share_token: token })
})

app.delete('/api/mindmaps/:id/share', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const now = new Date().toISOString()

  await db
    .prepare('UPDATE mindmaps SET share_token = NULL, updated_at = ? WHERE id = ?')
    .bind(now, id)
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

// ==================== 导入 API ====================

app.post('/api/import/json', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const title = body.title || '导入的思维导图'
  const data = body.data

  await db
    .prepare(
      'INSERT INTO mindmaps (id, title, data, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(id, title, JSON.stringify(data), body.folder_id || null, now, now)
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
