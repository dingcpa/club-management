const puppeteer = require('puppeteer')

let browserPromise = null

/**
 * 重複使用同一個 browser instance（首次啟動較慢，之後快）
 */
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
  return browserPromise
}

async function htmlToPdf(html, options = {}) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: options.format || 'A4',
      margin: options.margin || { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      printBackground: true,
    })
    return pdf
  } finally {
    await page.close()
  }
}

function fmt(n) {
  return Number(n || 0).toLocaleString('zh-TW')
}

function fmtDate(d) {
  if (!d) return ''
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d).slice(0, 10)
}

function escapeHtml(s) {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 請款單 PDF
 * @param {object} billing - billings 主檔（含 lines）
 * @param {object} opts - { clubName, bankInfo, treasurerNote }
 */
async function buildBillingPdf(billing, opts = {}) {
  const clubName = opts.clubName || '嘉義中區扶輪社'
  const bankInfo = opts.bankInfo || '匯款銀行：__________ 帳號：__________ 戶名：__________'
  const treasurerNote = opts.treasurerNote || ''

  const memberLabel = billing.name_en
    ? `${billing.name_zh} ${billing.name_en}`
    : billing.name_zh

  const linesHtml = (billing.lines || [])
    .map(
      (l) => `
        <tr>
          <td>${escapeHtml(l.period || '-')}</td>
          <td>${escapeHtml(l.account_name || '')}</td>
          <td>${escapeHtml(l.item_description || l.label || '')}</td>
          <td class="num">${fmt(l.amount)}</td>
        </tr>`
    )
    .join('')

  const html = `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <title>請款單 ${escapeHtml(billing.billing_no)}</title>
  <style>
    @page { size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", "Heiti TC", sans-serif;
      color: #222;
      font-size: 12pt;
      line-height: 1.5;
      margin: 0;
    }
    .header { text-align: center; border-bottom: 3px double #0d47a1; padding-bottom: 8px; margin-bottom: 16px; }
    .club-name { font-size: 20pt; font-weight: bold; color: #0d47a1; letter-spacing: 2px; }
    .term { font-size: 12pt; color: #555; margin-top: 4px; }
    .doc-title { font-size: 22pt; font-weight: bold; margin-top: 10px; letter-spacing: 4px; }

    .meta { display: flex; justify-content: space-between; margin: 16px 0; }
    .meta .left, .meta .right { font-size: 11pt; color: #444; }
    .meta .right { text-align: right; }
    .recipient { font-size: 14pt; font-weight: bold; margin: 8px 0 16px; }

    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }
    table.items th {
      background: #0d47a1;
      color: #fff;
      padding: 8px;
      font-weight: bold;
      font-size: 11pt;
    }
    table.items td {
      padding: 8px;
      border-bottom: 1px solid #ddd;
      font-size: 11pt;
    }
    table.items td.num { text-align: right; font-family: "Consolas", monospace; }
    table.items tfoot td { font-weight: bold; background: #f5f5f5; }
    table.items tr:nth-child(even) td { background: #fafafa; }

    .total-box {
      margin-top: 16px;
      padding: 12px 20px;
      border: 2px solid #0d47a1;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f5f9ff;
    }
    .total-box .label { font-size: 14pt; }
    .total-box .amount { font-size: 22pt; font-weight: bold; color: #0d47a1; font-family: "Consolas", monospace; }

    .payment-info {
      margin-top: 24px;
      padding: 12px 16px;
      background: #fffde7;
      border-left: 4px solid #f9a825;
      font-size: 10.5pt;
      line-height: 1.7;
    }
    .payment-info .title { font-weight: bold; margin-bottom: 6px; }

    .footer {
      margin-top: 36px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      font-size: 10pt;
      color: #555;
    }
    .footer .col { text-align: center; border-top: 1px solid #aaa; padding-top: 8px; }

    .stamp-area {
      margin-top: 32px;
      text-align: right;
      font-size: 10pt;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="club-name">${escapeHtml(clubName)}</div>
    <div class="term">第 ${escapeHtml(billing.term_id)} 屆</div>
    <div class="doc-title">請　款　單</div>
  </div>

  <div class="meta">
    <div class="left">
      <div>請款單號：<strong>${escapeHtml(billing.billing_no)}</strong></div>
      <div>開立日期：${escapeHtml(fmtDate(billing.issued_date))}</div>
    </div>
    <div class="right">
      <div>繳款期限：${escapeHtml(fmtDate(billing.due_date) || '請儘速繳清')}</div>
    </div>
  </div>

  <div class="recipient">
    敬致　<u>${escapeHtml(memberLabel)}</u>　社友
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width: 14%">期別</th>
        <th style="width: 24%">項目</th>
        <th>說明</th>
        <th style="width: 18%; text-align: right;">金額</th>
      </tr>
    </thead>
    <tbody>
      ${linesHtml || '<tr><td colspan="4" style="text-align:center;color:#999">無明細</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right">合計</td>
        <td class="num">${fmt(billing.total_amount)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="total-box">
    <div class="label">應繳金額</div>
    <div class="amount">NT$ ${fmt(billing.total_amount)}</div>
  </div>

  <div class="payment-info">
    <div class="title">繳款方式</div>
    <div>1. 匯款：${escapeHtml(bankInfo)}</div>
    <div>2. 例會現場繳交（現金或支票）給司庫或幹事</div>
    ${treasurerNote ? `<div style="margin-top:6px;color:#777">${escapeHtml(treasurerNote)}</div>` : ''}
  </div>

  ${
    billing.remark
      ? `<div style="margin-top:12px;font-size:10pt;color:#555">備註：${escapeHtml(billing.remark)}</div>`
      : ''
  }

  <div class="footer">
    <div class="col">社　長</div>
    <div class="col">司　庫</div>
    <div class="col">幹　事</div>
  </div>

  <div class="stamp-area">
    產出時間：${new Date().toISOString().slice(0, 19).replace('T', ' ')}
  </div>
</body>
</html>`

  return await htmlToPdf(html)
}

module.exports = { htmlToPdf, buildBillingPdf }
