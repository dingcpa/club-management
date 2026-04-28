const express = require('express')
const { pool } = require('../db')
const { requireRole } = require('../auth')

const router = express.Router()

router.get('/', async (req, res) => {
  const { type, leaf_only } = req.query
  let sql = 'SELECT * FROM accounts WHERE active=1'
  const params = []
  if (type) {
    sql += ' AND type=?'
    params.push(type)
  }
  if (leaf_only === '1') {
    sql += ' AND is_leaf=1'
  }
  sql += ' ORDER BY code'
  const [rows] = await pool.query(sql, params)
  res.json(rows)
})

router.get('/tree', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM accounts WHERE active=1 ORDER BY code')
  const map = new Map()
  const roots = []
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }))
  rows.forEach((r) => {
    const node = map.get(r.id)
    if (r.parent_id && map.has(r.parent_id)) {
      map.get(r.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })
  res.json(roots)
})

router.post('/', requireRole('admin', 'treasurer'), async (req, res) => {
  const { code, name, parent_id, type, category, is_leaf, sort_order, remark } = req.body || {}
  if (!code || !name || !type) {
    return res.status(400).json({ error: '請填寫科目代碼、名稱、類別' })
  }
  const [r] = await pool.query(
    `INSERT INTO accounts (code, name, parent_id, type, category, is_leaf, sort_order, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, name, parent_id || null, type, category || null, is_leaf ?? 1, sort_order || 0, remark || null]
  )
  res.status(201).json({ id: r.insertId })
})

router.put('/:id', requireRole('admin', 'treasurer'), async (req, res) => {
  const id = parseInt(req.params.id)
  const fields = ['code', 'name', 'parent_id', 'type', 'category', 'is_leaf', 'active', 'sort_order', 'remark']
  const updates = []
  const params = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f}=?`)
      params.push(req.body[f])
    }
  }
  if (!updates.length) return res.status(400).json({ error: '無更新欄位' })
  params.push(id)
  await pool.query(`UPDATE accounts SET ${updates.join(', ')} WHERE id=?`, params)
  res.json({ ok: true })
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id)
  await pool.query('UPDATE accounts SET active=0 WHERE id=?', [id])
  res.json({ ok: true })
})

module.exports = router
