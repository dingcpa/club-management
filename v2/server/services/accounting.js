/**
 * 會計核心服務
 *
 * 把幹事在 UI 看到的「4 種傳票」展開成正規借貸分錄。
 * 傳票模型：
 *   收 (receipt)   - 主科目 = 銀行/現金 (借)，明細 = 收入或沖銷應收 (貸)
 *   付 (payment)   - 主科目 = 銀行/現金 (貸)，明細 = 支出 (借)
 *   代墊 (advance) - 主科目 = 應付○○○代墊款 (貸)，明細 = 支出 (借)
 *   轉帳 (transfer)- 兩筆銀行/現金互轉 (借: 收方, 貸: 付方)
 *
 * UI 永遠看不到「借貸」字眼。
 */
const { pool } = require('../db')

const ENTRY_TYPES = ['receipt', 'payment', 'advance', 'transfer']

/**
 * 展開傳票為借貸分錄
 * @param {object} entry
 *   - type: 'receipt' | 'payment' | 'advance' | 'transfer'
 *   - cash_account_id: 主科目 ID（銀行/現金；對 advance 為應付科目；對 transfer 為來源帳戶）
 *   - dest_account_id: 僅 transfer 用，目的帳戶
 *   - lines: [{ account_id, amount, member_id?, billing_item_id?, description? }]
 * @returns {Array} journal_lines 內容（不含 entry_id / id）
 */
function expandEntryToLines(entry) {
  const { type, cash_account_id, dest_account_id, lines = [] } = entry

  if (!ENTRY_TYPES.includes(type)) {
    throw new Error(`Invalid entry type: ${type}`)
  }
  if (!cash_account_id) {
    throw new Error('cash_account_id is required')
  }

  const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0)
  if (total <= 0) {
    throw new Error('明細金額必須大於 0')
  }

  const out = []
  let lineNo = 1

  if (type === 'receipt') {
    // 借: 銀行/現金
    out.push({
      line_no: lineNo++,
      account_id: cash_account_id,
      debit: total,
      credit: 0,
    })
    // 貸: 各收入或應收
    for (const l of lines) {
      out.push({
        line_no: lineNo++,
        account_id: l.account_id,
        debit: 0,
        credit: Number(l.amount),
        member_id: l.member_id || null,
        billing_item_id: l.billing_item_id || null,
        description: l.description || null,
      })
    }
  } else if (type === 'payment') {
    // 借: 各支出
    for (const l of lines) {
      out.push({
        line_no: lineNo++,
        account_id: l.account_id,
        debit: Number(l.amount),
        credit: 0,
        member_id: l.member_id || null,
        description: l.description || null,
      })
    }
    // 貸: 銀行/現金
    out.push({
      line_no: lineNo++,
      account_id: cash_account_id,
      debit: 0,
      credit: total,
    })
  } else if (type === 'advance') {
    // 借: 各支出
    for (const l of lines) {
      out.push({
        line_no: lineNo++,
        account_id: l.account_id,
        debit: Number(l.amount),
        credit: 0,
        description: l.description || null,
      })
    }
    // 貸: 應付代墊款
    out.push({
      line_no: lineNo++,
      account_id: cash_account_id,
      debit: 0,
      credit: total,
    })
  } else if (type === 'transfer') {
    if (!dest_account_id) throw new Error('轉帳需要 dest_account_id')
    out.push({
      line_no: lineNo++,
      account_id: dest_account_id,
      debit: total,
      credit: 0,
    })
    out.push({
      line_no: lineNo++,
      account_id: cash_account_id,
      debit: 0,
      credit: total,
    })
  }

  // 借貸平衡檢查
  const sumDr = out.reduce((s, l) => s + Number(l.debit || 0), 0)
  const sumCr = out.reduce((s, l) => s + Number(l.credit || 0), 0)
  if (Math.abs(sumDr - sumCr) > 0.01) {
    throw new Error(`借貸不平衡：借 ${sumDr} ≠ 貸 ${sumCr}`)
  }

  return out
}

/**
 * 取得下一個傳票編號 (T32-001 等)
 */
async function nextEntryNo(termId) {
  const [rows] = await pool.query(
    `SELECT entry_no FROM journal_entries WHERE term_id=? AND entry_no LIKE ?
     ORDER BY entry_no DESC LIMIT 1`,
    [termId, `T${termId}-%`]
  )
  let n = 1
  if (rows.length) {
    const m = rows[0].entry_no.match(/T\d+-(\d+)/)
    if (m) n = parseInt(m[1]) + 1
  }
  return `T${termId}-${String(n).padStart(4, '0')}`
}

/**
 * 期間科目餘額
 *   收入/收益型：sum(credit) - sum(debit)
 *   支出/費用型：sum(debit) - sum(credit)
 *   資產：sum(debit) - sum(credit)
 *   負債/權益：sum(credit) - sum(debit)
 */
async function accountBalance({ accountId, termId, dateFrom, dateTo }) {
  const where = ['jl.account_id=?', `je.status='posted'`]
  const params = [accountId]
  if (termId) {
    where.push('je.term_id=?')
    params.push(termId)
  }
  if (dateFrom) {
    where.push('je.entry_date>=?')
    params.push(dateFrom)
  }
  if (dateTo) {
    where.push('je.entry_date<=?')
    params.push(dateTo)
  }
  const [rows] = await pool.query(
    `SELECT
       COALESCE(SUM(jl.debit), 0) AS total_debit,
       COALESCE(SUM(jl.credit), 0) AS total_credit
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.entry_id
     WHERE ${where.join(' AND ')}`,
    params
  )
  const { total_debit, total_credit } = rows[0]
  return {
    debit: parseFloat(total_debit),
    credit: parseFloat(total_credit),
    net: parseFloat(total_debit) - parseFloat(total_credit),
  }
}

/**
 * 應收餘額（依 billing_items.status）
 */
async function receivablesByMember(termId, asOfDate) {
  const [rows] = await pool.query(
    `SELECT
       bi.member_id,
       m.name_zh, m.name_en,
       SUM(bi.amount - bi.paid_amount) AS outstanding
     FROM billing_items bi
     JOIN members m ON m.id = bi.member_id
     WHERE bi.term_id=? AND bi.status IN ('open','partial')
       ${asOfDate ? 'AND bi.created_at <= ?' : ''}
     GROUP BY bi.member_id, m.name_zh, m.name_en
     HAVING outstanding > 0
     ORDER BY m.name_zh`,
    asOfDate ? [termId, asOfDate] : [termId]
  )
  return rows.map((r) => ({
    ...r,
    outstanding: parseFloat(r.outstanding) || 0,
  }))
}

/**
 * 代墊款未還清總額（按人）
 */
async function payablesByPerson() {
  const [rows] = await pool.query(
    `SELECT
       ap.payer_type,
       ap.payer_member_id,
       ap.payer_name,
       m.name_zh, m.name_en,
       SUM(ap.total_amount - ap.paid_amount) AS outstanding
     FROM advance_payments ap
     LEFT JOIN members m ON m.id = ap.payer_member_id
     WHERE ap.status IN ('open','partial')
     GROUP BY ap.payer_type, ap.payer_member_id, ap.payer_name, m.name_zh, m.name_en
     HAVING outstanding > 0`
  )
  return rows.map((r) => ({
    ...r,
    outstanding: parseFloat(r.outstanding) || 0,
  }))
}

module.exports = {
  ENTRY_TYPES,
  expandEntryToLines,
  nextEntryNo,
  accountBalance,
  receivablesByMember,
  payablesByPerson,
}
