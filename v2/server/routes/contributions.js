const express = require('express')
const { pool } = require('../db')
const { requireRole } = require('../auth')

const router = express.Router()

router.get('/', async (req, res) => {
  const { term_id, status, type } = req.query
  const where = []
  const params = []
  if (term_id) { where.push('cd.term_id=?'); params.push(parseInt(term_id)) }
  if (status) { where.push('cd.status=?'); params.push(status) }
  if (type) { where.push('cd.type=?'); params.push(type) }
  const sql = `
    SELECT cd.*, m.name_zh AS beneficiary_name_zh, m.name_en AS beneficiary_name_en
    FROM contribution_drives cd
    LEFT JOIN members m ON m.id = cd.beneficiary_member_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY cd.initiated_date DESC, cd.id DESC
  `
  const [rows] = await pool.query(sql, params)
  res.json(rows.map((r) => ({ ...r, total_pledged: parseFloat(r.total_pledged) || 0 })))
})

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const [headers] = await pool.query(
    `SELECT cd.*, m.name_zh AS beneficiary_name_zh, m.name_en AS beneficiary_name_en
     FROM contribution_drives cd
     LEFT JOIN members m ON m.id = cd.beneficiary_member_id
     WHERE cd.id=?`,
    [id]
  )
  if (!headers.length) return res.status(404).json({ error: 'Not found' })
  const [pledges] = await pool.query(
    `SELECT cp.*, m.name_zh, m.name_en
     FROM contribution_pledges cp
     JOIN members m ON m.id = cp.member_id
     WHERE cp.drive_id=?
     ORDER BY m.name_zh`,
    [id]
  )
  res.json({
    ...headers[0],
    total_pledged: parseFloat(headers[0].total_pledged) || 0,
    pledges: pledges.map((p) => ({ ...p, amount: parseFloat(p.amount) })),
  })
})

// ============================================================
//  POST /api/contributions — 新增認捐單
// ============================================================
router.post('/', requireRole('admin', 'staff', 'treasurer', 'president'), async (req, res) => {
  const {
    term_id, type, title, occasion,
    beneficiary_member_id, beneficiary_external,
    initiated_date, due_date, remark,
  } = req.body || {}
  if (!term_id || !type || !title || !initiated_date) {
    return res.status(400).json({ error: '缺少必填欄位' })
  }
  const id = Date.now()
  await pool.query(
    `INSERT INTO contribution_drives
      (id, term_id, type, title, occasion, beneficiary_member_id, beneficiary_external,
       initiated_date, due_date, status, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      id, term_id, type, title, occasion || null,
      beneficiary_member_id || null, beneficiary_external || null,
      initiated_date, due_date || null, remark || null,
    ]
  )
  res.status(201).json({ id })
})

// ============================================================
//  PUT /api/contributions/:id/pledges — 更新各社友認捐金額
//  body: { pledges: [{ member_id, amount }, ...] }
// ============================================================
router.put('/:id/pledges', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const driveId = parseInt(req.params.id)
  const { pledges = [] } = req.body || {}
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    let baseId = Date.now()
    let total = 0
    for (const p of pledges) {
      if (!p.member_id || !p.amount) continue
      total += parseFloat(p.amount)
      // upsert
      await conn.query(
        `INSERT INTO contribution_pledges (id, drive_id, member_id, amount, status, remark)
         VALUES (?, ?, ?, ?, 'pledged', ?)
         ON DUPLICATE KEY UPDATE amount=VALUES(amount), remark=VALUES(remark)`,
        [baseId++, driveId, p.member_id, p.amount, p.remark || null]
      )
    }
    await conn.query(
      `UPDATE contribution_drives SET total_pledged=? WHERE id=?`,
      [total, driveId]
    )
    await conn.commit()
    res.json({ ok: true, total })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})

// ============================================================
//  POST /api/contributions/:id/close — 結單，把認捐轉成 billing_items
//  body: { account_id }   - 收入科目（一般歡喜紅箱 4240 或代收款）
// ============================================================
router.post('/:id/close', requireRole('admin', 'treasurer', 'president'), async (req, res) => {
  const driveId = parseInt(req.params.id)
  const { account_id } = req.body || {}
  if (!account_id) return res.status(400).json({ error: '需要 account_id' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [drives] = await conn.query('SELECT * FROM contribution_drives WHERE id=?', [driveId])
    if (!drives.length) throw new Error('找不到認捐單')
    const drive = drives[0]
    if (drive.status === 'closed') throw new Error('已結單')

    const [pledges] = await conn.query(
      `SELECT * FROM contribution_pledges WHERE drive_id=? AND status='pledged'`,
      [driveId]
    )

    let baseId = Date.now()
    for (const p of pledges) {
      if (!p.amount || parseFloat(p.amount) <= 0) continue
      const itemId = baseId++
      await conn.query(
        `INSERT INTO billing_items
          (id, term_id, member_id, category, period, account_id, description, amount, status, contribution_pledge_id)
         VALUES (?, ?, ?, 'contribution', ?, ?, ?, ?, 'open', ?)`,
        [
          itemId, drive.term_id, p.member_id, drive.title.slice(0, 20),
          account_id, drive.title, p.amount, p.id,
        ]
      )
      await conn.query(
        `UPDATE contribution_pledges SET status='billing_created', billing_item_id=? WHERE id=?`,
        [itemId, p.id]
      )
    }

    await conn.query(`UPDATE contribution_drives SET status='closed' WHERE id=?`, [driveId])
    await conn.commit()
    res.json({ ok: true, generated: pledges.length })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id)
  await pool.query('DELETE FROM contribution_pledges WHERE drive_id=?', [id])
  await pool.query('DELETE FROM contribution_drives WHERE id=?', [id])
  res.json({ ok: true })
})

module.exports = router
