const express = require('express')
const { pool } = require('../db')
const { requireRole } = require('../auth')

const router = express.Router()

router.get('/', async (req, res) => {
  const { term_id, status } = req.query
  let sql = `
    SELECT m.*,
      mt.role AS term_role,
      mt.committee, mt.ratbed_group, mt.neilun_group,
      mt.monthly_dues, mt.service_fund, mt.meal_fee, mt.fixed_red_box
    FROM members m
    LEFT JOIN member_terms mt ON mt.member_id = m.id ${term_id ? 'AND mt.term_id=?' : ''}
  `
  const params = []
  if (term_id) params.push(parseInt(term_id))
  const where = []
  if (status) {
    where.push('m.status=?')
    params.push(status)
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY m.name_zh'
  const [rows] = await pool.query(sql, params)
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const [rows] = await pool.query('SELECT * FROM members WHERE id=?', [id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  const [terms] = await pool.query(
    'SELECT * FROM member_terms WHERE member_id=? ORDER BY term_id DESC',
    [id]
  )
  res.json({ ...rows[0], terms })
})

router.post('/', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const {
    name_zh, name_en, classification, occupation, email, phone,
    line_user_id, preferred_channel, joined_date, status, remark,
  } = req.body || {}
  if (!name_zh) return res.status(400).json({ error: '請填寫中文名' })
  const id = Date.now()
  await pool.query(
    `INSERT INTO members (id, name_zh, name_en, classification, occupation, email, phone,
      line_user_id, preferred_channel, joined_date, status, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, name_zh, name_en || null, classification || null, occupation || null,
      email || null, phone || null, line_user_id || null,
      preferred_channel || 'line', joined_date || null,
      status || 'active', remark || null,
    ]
  )
  res.status(201).json({ id })
})

router.put('/:id', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const id = parseInt(req.params.id)
  const fields = [
    'name_zh', 'name_en', 'classification', 'occupation', 'email', 'phone',
    'line_user_id', 'preferred_channel', 'joined_date', 'status', 'remark',
  ]
  const updates = []
  const params = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f}=?`)
      params.push(req.body[f] === '' ? null : req.body[f])
    }
  }
  if (!updates.length) return res.status(400).json({ error: '無更新欄位' })
  params.push(id)
  await pool.query(`UPDATE members SET ${updates.join(', ')} WHERE id=?`, params)
  res.json({ ok: true })
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id)
  await pool.query('UPDATE members SET status="resigned" WHERE id=?', [id])
  res.json({ ok: true })
})

// ============================================================
//  member_terms
// ============================================================

router.get('/:id/terms', async (req, res) => {
  const id = parseInt(req.params.id)
  const [rows] = await pool.query(
    'SELECT * FROM member_terms WHERE member_id=? ORDER BY term_id DESC',
    [id]
  )
  res.json(rows)
})

router.post('/:id/terms', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const member_id = parseInt(req.params.id)
  const {
    term_id, role, committee, ratbed_group, neilun_group,
    monthly_dues, service_fund, meal_fee, fixed_red_box, remark,
  } = req.body || {}
  if (!term_id) return res.status(400).json({ error: '需要 term_id' })
  const id = Date.now()
  await pool.query(
    `INSERT INTO member_terms (id, term_id, member_id, role, committee, ratbed_group, neilun_group,
      monthly_dues, service_fund, meal_fee, fixed_red_box, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       role=VALUES(role), committee=VALUES(committee),
       ratbed_group=VALUES(ratbed_group), neilun_group=VALUES(neilun_group),
       monthly_dues=VALUES(monthly_dues), service_fund=VALUES(service_fund),
       meal_fee=VALUES(meal_fee), fixed_red_box=VALUES(fixed_red_box),
       remark=VALUES(remark)`,
    [
      id, term_id, member_id, role || 'Member', committee || null,
      ratbed_group || null, neilun_group || null,
      monthly_dues ?? 1400, service_fund ?? 800, meal_fee ?? 2000, fixed_red_box ?? 1300,
      remark || null,
    ]
  )
  res.status(201).json({ id })
})

router.delete('/:memberId/terms/:termId', requireRole('admin', 'staff'), async (req, res) => {
  const memberId = parseInt(req.params.memberId)
  const termId = parseInt(req.params.termId)
  await pool.query(
    'DELETE FROM member_terms WHERE member_id=? AND term_id=?',
    [memberId, termId]
  )
  res.json({ ok: true })
})

module.exports = router
