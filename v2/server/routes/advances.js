const express = require('express')
const { pool } = require('../db')
const { requireRole } = require('../auth')
const accounting = require('../services/accounting')

const router = express.Router()

/**
 * 代墊款（advance_payments）的會計處理：
 *   開單時自動產生 advance 類型傳票：
 *     借: 各支出科目（lines）
 *     貸: 應付○○○代墊款（payer 對應的負債科目，code 2120/2130/2140）
 *
 *   還款時呼叫 /api/advances/:id/repay 端點，產生 payment 類型傳票：
 *     借: 應付○○○代墊款
 *     貸: 銀行存款 / 庫存現金
 */

const PAYABLE_ACCOUNTS = {
  staff: '2120',     // 應付代墊款-幹事
  president: '2130', // 應付代墊款-社長
  member: '2130',    // 預設社員代墊歸入社長線（社長最常代墊）
  external: '2140',  // 應付代墊款-其他
}

async function getAccountIdByCode(code) {
  const [rows] = await pool.query('SELECT id FROM accounts WHERE code=? LIMIT 1', [code])
  if (!rows.length) throw new Error(`找不到科目 ${code}`)
  return rows[0].id
}

router.get('/', async (req, res) => {
  const { status, payer_type, payer_member_id, only_open } = req.query
  const where = []
  const params = []
  if (status) { where.push('ap.status=?'); params.push(status) }
  if (only_open === '1') { where.push(`ap.status IN ('open','partial')`) }
  if (payer_type) { where.push('ap.payer_type=?'); params.push(payer_type) }
  if (payer_member_id) { where.push('ap.payer_member_id=?'); params.push(parseInt(payer_member_id)) }
  const sql = `
    SELECT ap.*, m.name_zh AS payer_member_name_zh, m.name_en AS payer_member_name_en
    FROM advance_payments ap
    LEFT JOIN members m ON m.id = ap.payer_member_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ap.date DESC, ap.id DESC
  `
  const [rows] = await pool.query(sql, params)
  res.json(rows.map((r) => ({
    ...r,
    total_amount: parseFloat(r.total_amount) || 0,
    paid_amount: parseFloat(r.paid_amount) || 0,
    outstanding: parseFloat(r.total_amount) - parseFloat(r.paid_amount),
  })))
})

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const [headers] = await pool.query(
    `SELECT ap.*, m.name_zh AS payer_member_name_zh, m.name_en AS payer_member_name_en
     FROM advance_payments ap
     LEFT JOIN members m ON m.id = ap.payer_member_id
     WHERE ap.id=?`,
    [id]
  )
  if (!headers.length) return res.status(404).json({ error: 'Not found' })
  const [lines] = await pool.query(
    `SELECT al.*, a.code AS account_code, a.name AS account_name
     FROM advance_payment_lines al
     JOIN accounts a ON a.id = al.account_id
     WHERE al.advance_id=?`,
    [id]
  )
  const [repays] = await pool.query(
    'SELECT * FROM advance_repayments WHERE advance_id=? ORDER BY date',
    [id]
  )
  res.json({
    ...headers[0],
    total_amount: parseFloat(headers[0].total_amount) || 0,
    paid_amount: parseFloat(headers[0].paid_amount) || 0,
    lines: lines.map((l) => ({ ...l, amount: parseFloat(l.amount) })),
    repayments: repays.map((r) => ({ ...r, amount: parseFloat(r.amount) })),
  })
})

// ============================================================
//  POST /api/advances — 開代墊單（自動產 advance 傳票）
//  body: {
//    payer_type, payer_member_id, payer_name,
//    term_id, date, summary, attachment_status,
//    lines: [{ account_id, amount, description }]
//  }
// ============================================================
router.post('/', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const {
      payer_type, payer_member_id, payer_name,
      term_id, date, summary, attachment_status, attachment_file,
      lines = [], remark,
    } = req.body || {}

    if (!payer_type || !term_id || !date || !lines.length) {
      throw new Error('缺少 payer_type / term_id / date / lines')
    }
    const total = lines.reduce((s, l) => s + parseFloat(l.amount || 0), 0)
    if (total <= 0) throw new Error('總金額需大於 0')

    // 取得對應應付科目
    const payableCode = PAYABLE_ACCOUNTS[payer_type]
    if (!payableCode) throw new Error('payer_type 不合法')
    const payableAccountId = await getAccountIdByCode(payableCode)

    const advanceId = Date.now()
    await conn.query(
      `INSERT INTO advance_payments
        (id, payer_type, payer_member_id, payer_name, term_id, date,
         total_amount, summary, status, attachment_status, attachment_file, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
      [
        advanceId, payer_type, payer_member_id || null, payer_name || null,
        term_id, date, total, summary || null,
        attachment_status || 'pending', attachment_file || null, remark || null,
      ]
    )

    let lineOffset = 0
    for (const l of lines) {
      await conn.query(
        `INSERT INTO advance_payment_lines (id, advance_id, account_id, amount, description)
         VALUES (?, ?, ?, ?, ?)`,
        [advanceId + 1000 + (lineOffset++), advanceId, l.account_id, l.amount, l.description || null]
      )
    }

    // 產生對應傳票（advance 類型：借支出，貸應付○○○）
    const expanded = accounting.expandEntryToLines({
      type: 'advance',
      cash_account_id: payableAccountId,
      lines: lines.map((l) => ({
        account_id: l.account_id,
        amount: parseFloat(l.amount),
        description: l.description,
      })),
    })

    const entryId = Date.now() + 500
    const entryNo = await accounting.nextEntryNo(term_id)
    await conn.query(
      `INSERT INTO journal_entries
        (id, term_id, entry_no, entry_date, entry_type, summary,
         attachment_status, status, created_by_user_id, remark)
       VALUES (?, ?, ?, ?, 'advance', ?, ?, 'posted', ?, ?)`,
      [
        entryId, term_id, entryNo, date,
        summary || `代墊 ${payer_name || payer_type}`,
        attachment_status || 'pending',
        req.user.id, `代墊單 ID=${advanceId}`,
      ]
    )
    let entryLineOffset = 0
    for (const ex of expanded) {
      await conn.query(
        `INSERT INTO journal_lines
          (id, entry_id, line_no, account_id, debit, credit, advance_payment_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Date.now() + 2000 + (entryLineOffset++), entryId, ex.line_no,
          ex.account_id, ex.debit, ex.credit, advanceId, ex.description || null,
        ]
      )
    }
    await conn.query(
      `UPDATE advance_payments SET journal_entry_id=? WHERE id=?`,
      [entryId, advanceId]
    )

    await conn.commit()
    res.status(201).json({ id: advanceId, journal_entry_id: entryId, entry_no: entryNo })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})

// ============================================================
//  POST /api/advances/:id/repay — 還款（產生 payment 傳票沖銷）
//  body: { date, amount, cash_account_id, term_id, remark }
// ============================================================
router.post('/:id/repay', requireRole('admin', 'staff', 'treasurer'), async (req, res) => {
  const id = parseInt(req.params.id)
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const { date, amount, cash_account_id, term_id, remark } = req.body || {}
    if (!date || !amount || !cash_account_id || !term_id) {
      throw new Error('缺少 date / amount / cash_account_id / term_id')
    }
    const [aps] = await conn.query('SELECT * FROM advance_payments WHERE id=?', [id])
    if (!aps.length) throw new Error('找不到代墊單')
    const ap = aps[0]
    const remaining = parseFloat(ap.total_amount) - parseFloat(ap.paid_amount)
    if (parseFloat(amount) > remaining + 0.01) throw new Error(`還款金額超出未還餘額 ${remaining}`)

    const payableCode = PAYABLE_ACCOUNTS[ap.payer_type]
    const payableAccountId = await getAccountIdByCode(payableCode)

    // 產生 payment 傳票：借應付○○○、貸銀行/現金
    const entryId = Date.now()
    const entryNo = await accounting.nextEntryNo(term_id)
    await conn.query(
      `INSERT INTO journal_entries
        (id, term_id, entry_no, entry_date, entry_type, summary, status, created_by_user_id, remark)
       VALUES (?, ?, ?, ?, 'payment', ?, 'posted', ?, ?)`,
      [
        entryId, term_id, entryNo, date,
        `還代墊款 ${ap.payer_name || ''} ${ap.summary || ''}`,
        req.user.id, remark || `還款代墊單 ID=${id}`,
      ]
    )
    // 借: 應付○○○
    await conn.query(
      `INSERT INTO journal_lines (id, entry_id, line_no, account_id, debit, credit, advance_payment_id, description)
       VALUES (?, ?, 1, ?, ?, 0, ?, ?)`,
      [Date.now() + 1, entryId, payableAccountId, amount, id, '沖銷代墊應付']
    )
    // 貸: 銀行/現金
    await conn.query(
      `INSERT INTO journal_lines (id, entry_id, line_no, account_id, debit, credit, description)
       VALUES (?, ?, 2, ?, 0, ?, ?)`,
      [Date.now() + 2, entryId, cash_account_id, amount, '還款付出']
    )

    // 紀錄 repayment
    const repayId = Date.now() + 3
    await conn.query(
      `INSERT INTO advance_repayments (id, advance_id, date, amount, journal_entry_id, remark)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [repayId, id, date, amount, entryId, remark || null]
    )

    // 更新代墊單狀態
    const newPaid = parseFloat(ap.paid_amount) + parseFloat(amount)
    const newStatus = newPaid >= parseFloat(ap.total_amount) ? 'closed' : 'partial'
    await conn.query(
      `UPDATE advance_payments SET paid_amount=?, status=? WHERE id=?`,
      [newPaid, newStatus, id]
    )

    await conn.commit()
    res.status(201).json({ id: repayId, journal_entry_id: entryId })
  } catch (e) {
    await conn.rollback()
    console.error(e)
    res.status(400).json({ error: e.message })
  } finally {
    conn.release()
  }
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id)
  await pool.query('DELETE FROM advance_payment_lines WHERE advance_id=?', [id])
  await pool.query('DELETE FROM advance_payments WHERE id=?', [id])
  res.json({ ok: true })
})

module.exports = router
