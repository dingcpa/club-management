const express = require('express')
const { pool } = require('../db')
const { requireRole } = require('../auth')

const router = express.Router()

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM terms ORDER BY id DESC')
  res.json(rows)
})

router.get('/active', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT * FROM terms WHERE status='active' ORDER BY id DESC LIMIT 1`
  )
  res.json(rows[0] || null)
})

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const [rows] = await pool.query('SELECT * FROM terms WHERE id=?', [id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

router.post('/', requireRole('admin', 'treasurer', 'president'), async (req, res) => {
  const { id, start_date, end_date, president_member_id, secretary_member_id, treasurer_member_id, remark } = req.body || {}
  if (!id || !start_date || !end_date) {
    return res.status(400).json({ error: '請填寫屆別號與起訖日期' })
  }
  await pool.query(
    `INSERT INTO terms (id, start_date, end_date, status, president_member_id, secretary_member_id, treasurer_member_id, remark)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
    [id, start_date, end_date, president_member_id || null, secretary_member_id || null, treasurer_member_id || null, remark || null]
  )
  res.status(201).json({ id })
})

router.put('/:id', requireRole('admin', 'treasurer', 'president'), async (req, res) => {
  const id = parseInt(req.params.id)
  const fields = ['start_date', 'end_date', 'president_member_id', 'secretary_member_id', 'treasurer_member_id', 'remark']
  const updates = []
  const params = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f}=?`)
      params.push(req.body[f] || null)
    }
  }
  if (!updates.length) return res.status(400).json({ error: '無更新欄位' })
  params.push(id)
  await pool.query(`UPDATE terms SET ${updates.join(', ')} WHERE id=?`, params)
  res.json({ ok: true })
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id)
  await pool.query('DELETE FROM terms WHERE id=?', [id])
  res.json({ ok: true })
})

module.exports = router
