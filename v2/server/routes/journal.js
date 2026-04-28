const express = require('express')
const { pool } = require('../db')
const { requireRole } = require('../auth')
const accounting = require('../services/accounting')

const router = express.Router()

// ============================================================
//  GET /api/journal — 列表（支援篩選）
// ============================================================
router.get('/', async (req, res) => {
  const { term_id, type, date_from, date_to, attachment_status, member_id, account_id } = req.query
  const where = [`je.status != 'reversed'`]
  const params = []
  if (term_id) { where.push('je.term_id=?'); params.push(parseInt(term_id)) }
  if (type) { where.push('je.entry_type=?'); params.push(type) }
  if (date_from) { where.push('je.entry_date>=?'); params.push(date_from) }
  if (date_to) { where.push('je.entry_date<=?'); params.push(date_to) }
  if (attachment_status) { where.push('je.attachment_status=?'); params.push(attachment_status) }

  let join = ''
  if (member_id || account_id) {
    join = 'JOIN journal_lines jl ON jl.entry_id = je.id'
    if (member_id) { where.push('jl.member_id=?'); params.push(parseInt(member_id)) }
    if (account_id) { where.push('jl.account_id=?'); params.push(parseInt(account_id)) }
  }

  const sql = `
    SELECT DISTINCT je.* FROM journal_entries je
    ${join}
    WHERE ${where.join(' AND ')}
    ORDER BY je.entry_date DESC, je.entry_no DESC
    LIMIT 500
  `
  const [rows] = await pool.query(sql, params)
  res.json(rows)
})

// ============================================================
//  GET /api/journal/:id — 含明細
// ============================================================
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const [headers] = await pool.query('SELECT * FROM journal_entries WHERE id=?', [id])
  if (!headers.length) return res.status(404).json({ error: 'Not found' })
  const [lines] = await pool.query(
    `SELECT jl.*, a.code AS account_code, a.name AS account_name
     FROM journal_lines jl
     JOIN accounts a ON a.id = jl.account_id
     WHERE jl.entry_id=?
     ORDER BY jl.line_no`,
    [id]
  )
  const parsedLines = lines.map((l) => ({
    ...l,
    debit: parseFloat(l.debit) || 0,
    credit: parseFloat(l.credit) || 0,
  }))
  res.json({ ...headers[0], lines: parsedLines })
})

// ============================================================
//  POST /api/journal — 開新傳票
//   body: {
//     term_id, entry_date, entry_type, summary,
//     cash_account_id, dest_account_id (transfer),
//     lines: [{ account_id, amount, member_id?, billing_item_id?, description? }],
//     attachment_status, attachment_file, meeting_id, activity_id, remark,
//     billing_pay_items: [billing_item_id, ...]   // 同步將這些應收標記為 paid
//   }
// ============================================================
router.post('/', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const {
      term_id, entry_date, entry_type, summary,
      cash_account_id, dest_account_id,
      lines, attachment_status, attachment_file,
      meeting_id, activity_id, remark, billing_pay_items,
    } = req.body || {}

    if (!term_id || !entry_date || !entry_type || !cash_account_id) {
      throw new Error('缺少 term_id / entry_date / entry_type / cash_account_id')
    }

    // 展開借貸
    const expanded = accounting.expandEntryToLines({
      type: entry_type, cash_account_id, dest_account_id, lines,
    })

    const entryNo = await accounting.nextEntryNo(term_id)
    const id = Date.now()

    await conn.query(
      `INSERT INTO journal_entries
        (id, term_id, entry_no, entry_date, entry_type, summary,
         attachment_status, attachment_file, status, meeting_id, activity_id,
         created_by_user_id, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?, ?, ?)`,
      [
        id, term_id, entryNo, entry_date, entry_type, summary || null,
        attachment_status || 'pending', attachment_file || null,
        meeting_id || null, activity_id || null,
        req.user.id, remark || null,
      ]
    )

    // 寫分錄（id 用 Date.now() + 序號避免碰撞）
    const baseId = Date.now()
    for (let i = 0; i < expanded.length; i++) {
      const l = expanded[i]
      await conn.query(
        `INSERT INTO journal_lines
          (id, entry_id, line_no, account_id, debit, credit,
           member_id, billing_item_id, advance_payment_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          baseId + i, id, l.line_no, l.account_id, l.debit, l.credit,
          l.member_id || null, l.billing_item_id || null, l.advance_payment_id || null,
          l.description || null,
        ]
      )
    }

    // 沖銷應收項目
    if (Array.isArray(billing_pay_items) && billing_pay_items.length) {
      for (const item of billing_pay_items) {
        const itemId = typeof item === 'object' ? item.id : item
        const payAmount = typeof item === 'object' ? item.amount : null
        const [b] = await conn.query('SELECT * FROM billing_items WHERE id=?', [itemId])
        if (!b.length) continue
        const bi = b[0]
        const newPaid = parseFloat(bi.paid_amount) + (payAmount ? parseFloat(payAmount) : parseFloat(bi.amount) - parseFloat(bi.paid_amount))
        const status = newPaid >= parseFloat(bi.amount) ? 'paid' : 'partial'
        await conn.query(
          `UPDATE billing_items SET paid_amount=?, status=?, paid_date=? WHERE id=?`,
          [newPaid, status, entry_date, itemId]
        )
      }
    }

    await conn.commit()
    res.status(201).json({ id, entry_no: entryNo })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})

// ============================================================
//  POST /api/journal/:id/reverse — 反向沖銷
// ============================================================
router.post('/:id/reverse', requireRole('admin', 'treasurer'), async (req, res) => {
  const id = parseInt(req.params.id)
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [orig] = await conn.query('SELECT * FROM journal_entries WHERE id=?', [id])
    if (!orig.length) throw new Error('Not found')
    if (orig[0].status === 'reversed') throw new Error('已反向沖銷')
    const [origLines] = await conn.query('SELECT * FROM journal_lines WHERE entry_id=? ORDER BY line_no', [id])

    const newId = Date.now()
    const newEntryNo = await accounting.nextEntryNo(orig[0].term_id)
    await conn.query(
      `INSERT INTO journal_entries
        (id, term_id, entry_no, entry_date, entry_type, summary, status, created_by_user_id, remark)
       VALUES (?, ?, ?, ?, ?, ?, 'posted', ?, ?)`,
      [
        newId, orig[0].term_id, newEntryNo, new Date().toISOString().slice(0, 10),
        orig[0].entry_type, `沖銷 ${orig[0].entry_no}：${orig[0].summary || ''}`,
        req.user.id, '系統自動產生反向傳票',
      ]
    )
    const baseId = Date.now()
    for (let i = 0; i < origLines.length; i++) {
      const l = origLines[i]
      await conn.query(
        `INSERT INTO journal_lines (id, entry_id, line_no, account_id, debit, credit, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          baseId + i, newId, l.line_no, l.account_id,
          parseFloat(l.credit), parseFloat(l.debit),
          `沖銷 ${orig[0].entry_no}`,
        ]
      )
    }
    await conn.query(`UPDATE journal_entries SET status='reversed', reversed_by_id=? WHERE id=?`, [newId, id])
    await conn.commit()
    res.json({ ok: true, reversed_by: newId, entry_no: newEntryNo })
  } catch (e) {
    await conn.rollback()
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})

module.exports = router
