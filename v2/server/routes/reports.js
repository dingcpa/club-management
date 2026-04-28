const express = require('express')
const { pool } = require('../db')
const accounting = require('../services/accounting')
const xlsxService = require('../services/xlsx')

const router = express.Router()

// ============================================================
//  月份收支明細表 - JSON
//  GET /api/reports/monthly?term_id=33&year=2026&month=7
// ============================================================
router.get('/monthly', async (req, res) => {
  const term_id = parseInt(req.query.term_id)
  const year = parseInt(req.query.year)
  const month = parseInt(req.query.month)
  if (!term_id || !year || !month) {
    return res.status(400).json({ error: '缺少 term_id / year / month' })
  }
  const data = await buildMonthlyReport({ term_id, year, month })
  res.json(data)
})

// ============================================================
//  月份收支明細表 - Excel
//  GET /api/reports/monthly.xlsx?term_id=...
// ============================================================
router.get('/monthly.xlsx', async (req, res) => {
  const term_id = parseInt(req.query.term_id)
  const year = parseInt(req.query.year)
  const month = parseInt(req.query.month)
  if (!term_id || !year || !month) {
    return res.status(400).json({ error: '缺少 term_id / year / month' })
  }
  const data = await buildMonthlyReport({ term_id, year, month })
  const buffer = await xlsxService.buildMonthlyReportXlsx(data)
  const filename = `${term_id}屆-${year}年${month}月份收支明細表.xlsx`
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  })
  res.send(buffer)
})

// ============================================================
//  待補單據清單
// ============================================================
router.get('/pending-attachments', async (req, res) => {
  const term_id = parseInt(req.query.term_id) || null
  const where = [`attachment_status='pending'`, `status='posted'`]
  const params = []
  if (term_id) { where.push('term_id=?'); params.push(term_id) }
  const [rows] = await pool.query(
    `SELECT id, term_id, entry_no, entry_date, entry_type, summary, created_at
     FROM journal_entries
     WHERE ${where.join(' AND ')}
     ORDER BY entry_date DESC`,
    params
  )
  res.json(rows)
})

// ============================================================
//  應收應付總覽
// ============================================================
router.get('/dashboard', async (req, res) => {
  const term_id = parseInt(req.query.term_id)
  if (!term_id) return res.status(400).json({ error: '缺少 term_id' })

  // 取得銀行+現金科目
  const [cashAccs] = await pool.query(
    `SELECT id FROM accounts WHERE code IN ('1110','1120')`
  )
  const cashAccIds = cashAccs.map((a) => a.id)

  // 當前現金/銀行餘額（不限月份）
  let cashBalance = 0
  for (const accId of cashAccIds) {
    const b = await accounting.accountBalance({ accountId: accId, termId: term_id })
    cashBalance += b.net
  }

  // 應收
  const recvByMember = await accounting.receivablesByMember(term_id)
  const totalReceivables = recvByMember.reduce((s, r) => s + r.outstanding, 0)

  // 應付（代墊款）
  const payByPerson = await accounting.payablesByPerson()
  const totalPayables = payByPerson.reduce((s, p) => s + p.outstanding, 0)

  // 本期餘絀（4xxx - 5xxx）
  const [incomeRows] = await pool.query(
    `SELECT COALESCE(SUM(jl.credit) - SUM(jl.debit), 0) AS net
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.entry_id
     JOIN accounts a ON a.id = jl.account_id
     WHERE je.term_id=? AND je.status='posted' AND a.type='income'`,
    [term_id]
  )
  const [expenseRows] = await pool.query(
    `SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS net
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.entry_id
     JOIN accounts a ON a.id = jl.account_id
     WHERE je.term_id=? AND je.status='posted' AND a.type='expense'`,
    [term_id]
  )
  const totalIncome = parseFloat(incomeRows[0].net)
  const totalExpense = parseFloat(expenseRows[0].net)

  res.json({
    term_id,
    cash_balance: cashBalance,
    total_income: totalIncome,
    total_expense: totalExpense,
    surplus: totalIncome - totalExpense,
    receivables: {
      total: totalReceivables,
      by_member: recvByMember,
    },
    payables: {
      total: totalPayables,
      by_person: payByPerson,
    },
    expected_balance: cashBalance + totalReceivables - totalPayables,
  })
})

// ============================================================
//  helpers
// ============================================================
async function buildMonthlyReport({ term_id, year, month }) {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)
  const dateFrom = monthStart.toISOString().slice(0, 10)
  const dateTo = monthEnd.toISOString().slice(0, 10)

  // 取得 cash + bank 科目
  const [cashAccs] = await pool.query(
    `SELECT id, code, name FROM accounts WHERE code IN ('1110','1120')`
  )

  // 期初現金/銀行（截至 dateFrom-1）
  const dayBefore = new Date(monthStart.getTime() - 86400000).toISOString().slice(0, 10)
  let openingCash = 0
  for (const acc of cashAccs) {
    const b = await accounting.accountBalance({
      accountId: acc.id, termId: term_id, dateTo: dayBefore,
    })
    openingCash += b.net
  }

  // 期末現金/銀行
  let closingCash = 0
  for (const acc of cashAccs) {
    const b = await accounting.accountBalance({
      accountId: acc.id, termId: term_id, dateTo,
    })
    closingCash += b.net
  }

  // 本月各收入科目（leaf only）
  const [incomeRows] = await pool.query(
    `SELECT a.id, a.code, a.name, a.parent_id,
       COALESCE(SUM(jl.credit) - SUM(jl.debit), 0) AS amount
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id = a.id
     LEFT JOIN journal_entries je ON je.id = jl.entry_id
       AND je.term_id=? AND je.status='posted'
       AND je.entry_date BETWEEN ? AND ?
     WHERE a.type='income' AND a.is_leaf=1
     GROUP BY a.id, a.code, a.name, a.parent_id
     ORDER BY a.code`,
    [term_id, dateFrom, dateTo]
  )

  // 本月各支出科目
  const [expenseRows] = await pool.query(
    `SELECT a.id, a.code, a.name, a.parent_id, a.category,
       COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS amount
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id = a.id
     LEFT JOIN journal_entries je ON je.id = jl.entry_id
       AND je.term_id=? AND je.status='posted'
       AND je.entry_date BETWEEN ? AND ?
     WHERE a.type='expense' AND a.is_leaf=1
     GROUP BY a.id, a.code, a.name, a.parent_id, a.category
     ORDER BY a.code`,
    [term_id, dateFrom, dateTo]
  )

  const incomeByAccount = incomeRows
    .map((r) => ({ ...r, amount: parseFloat(r.amount) }))
    .filter((r) => Math.abs(r.amount) > 0.01)

  const expenseByCategory = {}
  for (const r of expenseRows) {
    const amt = parseFloat(r.amount)
    if (Math.abs(amt) < 0.01) continue
    const cat = r.category || '其他'
    if (!expenseByCategory[cat]) expenseByCategory[cat] = []
    expenseByCategory[cat].push({ ...r, amount: amt })
  }

  const totalIncome = incomeByAccount.reduce((s, r) => s + r.amount, 0)
  const totalExpense = Object.values(expenseByCategory)
    .flat()
    .reduce((s, r) => s + r.amount, 0)

  // 截至月底應收/應付明細
  const recvByMember = await accounting.receivablesByMember(term_id, dateTo + ' 23:59:59')
  const payByPerson = await accounting.payablesByPerson()

  return {
    term_id,
    period: { year, month, from: dateFrom, to: dateTo },
    opening_cash: openingCash,
    closing_cash: closingCash,
    total_income: totalIncome,
    total_expense: totalExpense,
    surplus: totalIncome - totalExpense,
    income_by_account: incomeByAccount,
    expense_by_category: expenseByCategory,
    receivables: {
      total: recvByMember.reduce((s, r) => s + r.outstanding, 0),
      by_member: recvByMember,
    },
    payables: {
      total: payByPerson.reduce((s, p) => s + p.outstanding, 0),
      by_person: payByPerson,
    },
  }
}

module.exports = router
