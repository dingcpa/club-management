const express = require('express')
const { pool } = require('../db')
const { requireRole } = require('../auth')
const pdfService = require('../services/pdf')

const router = express.Router()

// ============================================================
//  GET /api/billing/items — 應收項目（個人帳）
//  query: term_id, member_id, status, category, period
// ============================================================
router.get('/items', async (req, res) => {
  const { term_id, member_id, status, category, period, only_open } = req.query
  const where = []
  const params = []
  if (term_id) { where.push('bi.term_id=?'); params.push(parseInt(term_id)) }
  if (member_id) { where.push('bi.member_id=?'); params.push(parseInt(member_id)) }
  if (status) { where.push('bi.status=?'); params.push(status) }
  if (only_open === '1') { where.push(`bi.status IN ('open','partial')`) }
  if (category) { where.push('bi.category=?'); params.push(category) }
  if (period) { where.push('bi.period=?'); params.push(period) }
  const sql = `
    SELECT bi.*, m.name_zh, m.name_en, a.code AS account_code, a.name AS account_name
    FROM billing_items bi
    JOIN members m ON m.id = bi.member_id
    JOIN accounts a ON a.id = bi.account_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY m.name_zh, bi.period, bi.id
  `
  const [rows] = await pool.query(sql, params)
  res.json(rows.map((r) => ({
    ...r,
    amount: parseFloat(r.amount) || 0,
    paid_amount: parseFloat(r.paid_amount) || 0,
    outstanding: parseFloat(r.amount) - parseFloat(r.paid_amount),
  })))
})

// ============================================================
//  POST /api/billing/items — 新增單筆應收項目（手動加項用）
// ============================================================
router.post('/items', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const { term_id, member_id, category, period, account_id, description, amount, due_date, remark } = req.body || {}
  if (!term_id || !member_id || !category || !account_id || !amount) {
    return res.status(400).json({ error: '缺少必填欄位' })
  }
  const id = Date.now()
  await pool.query(
    `INSERT INTO billing_items
      (id, term_id, member_id, category, period, account_id, description, amount, due_date, status, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [id, term_id, member_id, category, period || null, account_id, description || null, amount, due_date || null, remark || null]
  )
  res.status(201).json({ id })
})

router.put('/items/:id', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const id = parseInt(req.params.id)
  const fields = ['category', 'period', 'account_id', 'description', 'amount', 'due_date', 'status', 'remark']
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
  await pool.query(`UPDATE billing_items SET ${updates.join(', ')} WHERE id=?`, params)
  res.json({ ok: true })
})

router.delete('/items/:id', requireRole('admin', 'treasurer'), async (req, res) => {
  const id = parseInt(req.params.id)
  await pool.query('DELETE FROM billing_items WHERE id=?', [id])
  res.json({ ok: true })
})

// ============================================================
//  POST /api/billing/items/generate-monthly
//   批次產生某屆某月的月份社費應收項目
//   body: { term_id, period: '2026-07', month: 7, year: 2026 }
// ============================================================
router.post('/items/generate-monthly', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const { term_id, period, year, month } = req.body || {}
  if (!term_id || !period || !year || !month) {
    return res.status(400).json({ error: '缺少 term_id / period / year / month' })
  }

  // 取得各科目 ID
  const [accs] = await pool.query(
    `SELECT id, code FROM accounts WHERE code IN ('4101','4102','4103','4104')`
  )
  const accMap = Object.fromEntries(accs.map((a) => [a.code, a.id]))

  // 取得該屆所有 active 社員 + 各人金額設定
  const [mts] = await pool.query(
    `SELECT mt.*, m.name_zh, m.status
     FROM member_terms mt
     JOIN members m ON m.id = mt.member_id
     WHERE mt.term_id = ? AND m.status = 'active'`,
    [term_id]
  )

  const dueDate = new Date(year, month - 1, 28).toISOString().slice(0, 10)
  let count = 0
  const baseId = Date.now()

  for (const mt of mts) {
    const items = [
      { code: '4101', amount: parseFloat(mt.monthly_dues), label: `${period} 會費` },
      { code: '4102', amount: parseFloat(mt.service_fund), label: `${period} 服務基金` },
      { code: '4103', amount: parseFloat(mt.meal_fee), label: `${period} 餐費` },
      { code: '4104', amount: parseFloat(mt.fixed_red_box), label: `${period} 固定紅箱` },
    ]
    for (const it of items) {
      if (it.amount <= 0) continue
      // 若已存在相同 (term, member, period, account) 就跳過
      const [exists] = await pool.query(
        `SELECT id FROM billing_items
         WHERE term_id=? AND member_id=? AND period=? AND account_id=?`,
        [term_id, mt.member_id, period, accMap[it.code]]
      )
      if (exists.length) continue
      await pool.query(
        `INSERT INTO billing_items
          (id, term_id, member_id, category, period, account_id, description, amount, due_date, status)
         VALUES (?, ?, ?, 'monthly_due', ?, ?, ?, ?, ?, 'open')`,
        [baseId + count, term_id, mt.member_id, period, accMap[it.code], it.label, it.amount, dueDate]
      )
      count++
    }
  }
  res.json({ ok: true, generated: count })
})

// ============================================================
//  GET /api/billing — 請款單列表
// ============================================================
router.get('/', async (req, res) => {
  const { term_id, member_id, status } = req.query
  const where = []
  const params = []
  if (term_id) { where.push('b.term_id=?'); params.push(parseInt(term_id)) }
  if (member_id) { where.push('b.member_id=?'); params.push(parseInt(member_id)) }
  if (status) { where.push('b.status=?'); params.push(status) }
  const sql = `
    SELECT b.*, m.name_zh, m.name_en
    FROM billings b
    JOIN members m ON m.id = b.member_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY b.issued_date DESC, b.id DESC
  `
  const [rows] = await pool.query(sql, params)
  res.json(rows.map((r) => ({
    ...r,
    total_amount: parseFloat(r.total_amount) || 0,
    paid_amount: parseFloat(r.paid_amount) || 0,
  })))
})

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const [headers] = await pool.query(
    `SELECT b.*, m.name_zh, m.name_en, m.line_user_id, m.preferred_channel
     FROM billings b
     JOIN members m ON m.id = b.member_id
     WHERE b.id=?`,
    [id]
  )
  if (!headers.length) return res.status(404).json({ error: 'Not found' })
  const [lines] = await pool.query(
    `SELECT bl.*, bi.category, bi.period, bi.description AS item_description, a.name AS account_name
     FROM billing_lines bl
     JOIN billing_items bi ON bi.id = bl.billing_item_id
     JOIN accounts a ON a.id = bi.account_id
     WHERE bl.billing_id=?
     ORDER BY bl.id`,
    [id]
  )
  const [logs] = await pool.query(
    'SELECT * FROM billing_send_logs WHERE billing_id=? ORDER BY id DESC',
    [id]
  )
  res.json({
    ...headers[0],
    total_amount: parseFloat(headers[0].total_amount) || 0,
    paid_amount: parseFloat(headers[0].paid_amount) || 0,
    lines: lines.map((l) => ({ ...l, amount: parseFloat(l.amount) })),
    send_logs: logs,
  })
})

// ============================================================
//  POST /api/billing — 開立請款單
//   body: { term_id, member_id, issued_date, due_date,
//           billing_item_ids: [...], extra_items: [{ description, amount, account_id }] }
// ============================================================
router.post('/', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const { term_id, member_id, issued_date, due_date, billing_item_ids = [], extra_items = [], remark } = req.body || {}
    if (!term_id || !member_id || !issued_date) {
      throw new Error('缺少 term_id / member_id / issued_date')
    }

    // 取得這些應收項目（必須屬於該社員，且狀態 open/partial）
    let selectedItems = []
    if (billing_item_ids.length) {
      const [rows] = await conn.query(
        `SELECT bi.*, a.name AS account_name
         FROM billing_items bi JOIN accounts a ON a.id=bi.account_id
         WHERE bi.id IN (?) AND bi.member_id=? AND bi.status IN ('open','partial')`,
        [billing_item_ids, member_id]
      )
      selectedItems = rows
    }

    // 為臨時加的項目（在 billings 流程中產生新 billing_items）
    const baseId = Date.now()
    let extraOffset = 0
    const newBillingItems = []
    for (const ex of extra_items) {
      if (!ex.amount || !ex.account_id) continue
      const itemId = baseId + (extraOffset++)
      await conn.query(
        `INSERT INTO billing_items
          (id, term_id, member_id, category, period, account_id, description, amount, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
        [
          itemId, term_id, member_id, ex.category || 'other', ex.period || null,
          ex.account_id, ex.description || null, ex.amount, due_date || null,
        ]
      )
      newBillingItems.push({
        id: itemId, amount: parseFloat(ex.amount),
        description: ex.description, period: ex.period,
        account_name: '臨時加項',
      })
    }

    const allItems = [...selectedItems, ...newBillingItems]
    const total = allItems.reduce((s, it) => s + parseFloat(it.amount) - parseFloat(it.paid_amount || 0), 0)
    if (total <= 0) throw new Error('請款金額為 0')

    const billingId = Date.now() + 1000
    const [seq] = await conn.query(
      `SELECT COUNT(*) AS n FROM billings WHERE term_id=?`, [term_id]
    )
    const billingNo = `B${term_id}-${String(seq[0].n + 1).padStart(4, '0')}`

    await conn.query(
      `INSERT INTO billings
        (id, term_id, member_id, billing_no, issued_date, due_date,
         total_amount, status, paid_amount, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'issued', 0, ?)`,
      [billingId, term_id, member_id, billingNo, issued_date, due_date || null, total, remark || null]
    )

    let lineOffset = 0
    for (const it of allItems) {
      const outstanding = parseFloat(it.amount) - parseFloat(it.paid_amount || 0)
      await conn.query(
        `INSERT INTO billing_lines (id, billing_id, billing_item_id, amount, label)
         VALUES (?, ?, ?, ?, ?)`,
        [
          baseId + 5000 + (lineOffset++),
          billingId,
          it.id,
          outstanding,
          [it.period, it.account_name, it.description].filter(Boolean).join(' / '),
        ]
      )
    }

    await conn.commit()
    res.status(201).json({ id: billingId, billing_no: billingNo, total_amount: total })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})

// ============================================================
//  POST /api/billing/:id/send-log — 紀錄發送結果
// ============================================================
router.post('/:id/send-log', requireRole('admin', 'staff'), async (req, res) => {
  const billingId = parseInt(req.params.id)
  const { channel, status, error_message, remark } = req.body || {}
  const id = Date.now()
  await pool.query(
    `INSERT INTO billing_send_logs (id, billing_id, channel, status, sent_at, error_message, remark)
     VALUES (?, ?, ?, ?, NOW(), ?, ?)`,
    [id, billingId, channel || 'manual', status || 'sent', error_message || null, remark || null]
  )
  res.status(201).json({ id })
})

router.delete('/:id', requireRole('admin', 'treasurer'), async (req, res) => {
  const id = parseInt(req.params.id)
  // 取消請款單（不刪除，改 status）
  await pool.query(`UPDATE billings SET status='cancelled' WHERE id=?`, [id])
  res.json({ ok: true })
})

// ============================================================
//  GET /api/billing/:id/pdf — 請款單 PDF
// ============================================================
router.get('/:id/pdf', async (req, res) => {
  const id = parseInt(req.params.id)
  const [headers] = await pool.query(
    `SELECT b.*, m.name_zh, m.name_en, m.line_user_id, m.preferred_channel
     FROM billings b
     JOIN members m ON m.id = b.member_id
     WHERE b.id=?`,
    [id]
  )
  if (!headers.length) return res.status(404).json({ error: 'Not found' })
  const [lines] = await pool.query(
    `SELECT bl.*, bi.category, bi.period, bi.description AS item_description, a.name AS account_name
     FROM billing_lines bl
     JOIN billing_items bi ON bi.id = bl.billing_item_id
     JOIN accounts a ON a.id = bi.account_id
     WHERE bl.billing_id=?
     ORDER BY bl.id`,
    [id]
  )

  const billing = {
    ...headers[0],
    total_amount: parseFloat(headers[0].total_amount) || 0,
    lines: lines.map((l) => ({ ...l, amount: parseFloat(l.amount) })),
  }

  try {
    const pdf = await pdfService.buildBillingPdf(billing, {
      clubName: process.env.CLUB_NAME,
      bankInfo: process.env.BANK_INFO,
      treasurerNote: process.env.TREASURER_NOTE,
    })
    const filename = `${billing.billing_no}_${billing.name_zh}.pdf`
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-cache',
    })
    res.send(pdf)
  } catch (e) {
    console.error('[PDF] failed:', e)
    res.status(500).json({ error: 'PDF generation failed: ' + e.message })
  }
})

module.exports = router
