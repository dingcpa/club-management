const ExcelJS = require('exceljs')

/**
 * 月份收支明細表 — 仿 29 屆 Excel 版面
 * 一個 Sheet：上半部現金 + 收支彙總；下半部明細
 */
async function buildMonthlyReportXlsx(data) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Club Finance v2'
  wb.created = new Date()

  const ws = wb.addWorksheet(`${data.period.year}年${data.period.month}月`, {
    views: [{ state: 'frozen', ySplit: 4 }],
  })
  ws.columns = [
    { width: 6 },     // A 編號
    { width: 28 },    // B 科目
    { width: 14 },    // C 金額
    { width: 28 },    // D 摘要
    { width: 4 },
    { width: 28 },    // F 科目（支出側）
    { width: 14 },    // G 金額
    { width: 28 },    // H 摘要
  ]

  // 標題
  ws.mergeCells('A1:H1')
  ws.getCell('A1').value = `嘉義中區扶輪社 第 ${data.term_id} 屆 ${data.period.year}年${data.period.month}月份收支明細表`
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.getCell('A1').alignment = { horizontal: 'center' }

  ws.mergeCells('A2:H2')
  ws.getCell('A2').value = `期間：${data.period.from} ~ ${data.period.to}`
  ws.getCell('A2').alignment = { horizontal: 'center' }

  // 收入支出標題列
  ws.mergeCells('A4:D4')
  ws.getCell('A4').value = '收入'
  ws.getCell('A4').font = { bold: true, size: 12 }
  ws.getCell('A4').alignment = { horizontal: 'center' }
  ws.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } }

  ws.mergeCells('F4:H4')
  ws.getCell('F4').value = '支出'
  ws.getCell('F4').font = { bold: true, size: 12 }
  ws.getCell('F4').alignment = { horizontal: 'center' }
  ws.getCell('F4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } }

  // 期初現金
  ws.getCell('A5').value = '期初現金/銀行'
  ws.getCell('B5').value = ''
  ws.getCell('C5').value = data.opening_cash
  ws.getCell('C5').numFmt = '#,##0'
  ws.getCell('C5').font = { bold: true }

  ws.getCell('F5').value = '本月支出'
  ws.getCell('F5').font = { bold: true }

  // 寫收入明細
  let r = 6
  for (const row of data.income_by_account) {
    ws.getCell(`A${r}`).value = row.code
    ws.getCell(`B${r}`).value = row.name
    ws.getCell(`C${r}`).value = row.amount
    ws.getCell(`C${r}`).numFmt = '#,##0'
    r++
  }

  // 寫支出明細
  let er = 6
  for (const [category, items] of Object.entries(data.expense_by_category)) {
    ws.getCell(`F${er}`).value = `【${category}委員會】`
    ws.getCell(`F${er}`).font = { bold: true }
    er++
    for (const it of items) {
      ws.getCell(`F${er}`).value = `  ${it.code} ${it.name}`
      ws.getCell(`G${er}`).value = it.amount
      ws.getCell(`G${er}`).numFmt = '#,##0'
      er++
    }
  }

  // 兩邊取齊（總計列）
  const lastRow = Math.max(r, er) + 2

  ws.getCell(`A${lastRow}`).value = '本月收入合計'
  ws.getCell(`A${lastRow}`).font = { bold: true }
  ws.getCell(`C${lastRow}`).value = data.total_income
  ws.getCell(`C${lastRow}`).numFmt = '#,##0'
  ws.getCell(`C${lastRow}`).font = { bold: true }

  ws.getCell(`F${lastRow}`).value = '本月支出合計'
  ws.getCell(`F${lastRow}`).font = { bold: true }
  ws.getCell(`G${lastRow}`).value = data.total_expense
  ws.getCell(`G${lastRow}`).numFmt = '#,##0'
  ws.getCell(`G${lastRow}`).font = { bold: true }

  ws.getCell(`A${lastRow + 1}`).value = '本月餘絀'
  ws.getCell(`A${lastRow + 1}`).font = { bold: true }
  ws.getCell(`C${lastRow + 1}`).value = data.surplus
  ws.getCell(`C${lastRow + 1}`).numFmt = '#,##0'
  ws.getCell(`C${lastRow + 1}`).font = { bold: true, color: { argb: data.surplus >= 0 ? 'FF2E7D32' : 'FFC62828' } }

  ws.getCell(`A${lastRow + 2}`).value = '期末現金/銀行'
  ws.getCell(`A${lastRow + 2}`).font = { bold: true }
  ws.getCell(`C${lastRow + 2}`).value = data.closing_cash
  ws.getCell(`C${lastRow + 2}`).numFmt = '#,##0'
  ws.getCell(`C${lastRow + 2}`).font = { bold: true }

  // ============================================================
  //  應收應付明細（第二 sheet）
  // ============================================================
  const ws2 = wb.addWorksheet('應收應付')
  ws2.columns = [
    { header: '類別', width: 12 },
    { header: '對象', width: 20 },
    { header: '金額', width: 14 },
    { header: '備註', width: 30 },
  ]
  ws2.getRow(1).font = { bold: true }

  ws2.addRow(['', '', '', ''])
  ws2.addRow(['應收明細', '', '', ''])
  ws2.lastRow.font = { bold: true, color: { argb: 'FF2E7D32' } }
  for (const r of data.receivables.by_member) {
    ws2.addRow(['應收社費', `${r.name_zh}${r.name_en ? ' ' + r.name_en : ''}`, r.outstanding, ''])
  }
  ws2.addRow(['應收合計', '', data.receivables.total, ''])
  ws2.lastRow.font = { bold: true }

  ws2.addRow(['', '', '', ''])
  ws2.addRow(['應付明細', '', '', ''])
  ws2.lastRow.font = { bold: true, color: { argb: 'FFC62828' } }
  for (const p of data.payables.by_person) {
    const name = p.name_zh
      ? `${p.name_zh}${p.name_en ? ' ' + p.name_en : ''}`
      : p.payer_name || p.payer_type
    ws2.addRow([`應付${p.payer_type === 'staff' ? '幹事' : p.payer_type === 'president' ? '社長' : '其他'}代墊`, name, p.outstanding, ''])
  }
  ws2.addRow(['應付合計', '', data.payables.total, ''])
  ws2.lastRow.font = { bold: true }

  ws2.getColumn(3).numFmt = '#,##0'

  return await wb.xlsx.writeBuffer()
}

module.exports = { buildMonthlyReportXlsx }
