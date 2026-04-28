const express = require('express')
const bcrypt = require('bcryptjs')
const { pool } = require('../db')
const { adminOnly } = require('../auth')

const router = express.Router()

router.use(adminOnly)

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, username, display_name, role, member_id, created_at FROM users ORDER BY id'
  )
  res.json(rows)
})

router.post('/', async (req, res) => {
  const { username, password, display_name, role, member_id } = req.body || {}
  if (!username || !password || !role) {
    return res.status(400).json({ error: '缺少必填欄位' })
  }
  const allowedRoles = ['admin', 'staff', 'treasurer', 'president', 'secretary']
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: '角色不合法' })
  }
  const hash = await bcrypt.hash(password, 12)
  const [r] = await pool.query(
    'INSERT INTO users (username, password_hash, display_name, role, member_id) VALUES (?, ?, ?, ?, ?)',
    [username, hash, display_name || username, role, member_id || null]
  )
  res.status(201).json({ id: r.insertId, username, display_name, role, member_id: member_id || null })
})

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const { display_name, role, member_id, password } = req.body || {}
  const updates = []
  const params = []
  if (display_name !== undefined) { updates.push('display_name=?'); params.push(display_name) }
  if (role !== undefined) { updates.push('role=?'); params.push(role) }
  if (member_id !== undefined) { updates.push('member_id=?'); params.push(member_id || null) }
  if (password) {
    updates.push('password_hash=?')
    params.push(await bcrypt.hash(password, 12))
  }
  if (!updates.length) return res.status(400).json({ error: '無更新欄位' })
  params.push(id)
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id=?`, params)
  res.json({ ok: true })
})

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  if (id === req.user.id) return res.status(400).json({ error: '不能刪除自己' })
  await pool.query('DELETE FROM users WHERE id=?', [id])
  res.json({ ok: true })
})

module.exports = router
