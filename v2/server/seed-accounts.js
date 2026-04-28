require('dotenv').config()
const { pool, initDB } = require('./db')

/**
 * 嘉義中區扶輪社會計科目樹（依 29 屆預算表結構）
 *
 * code 編碼：
 *   1xxx  資產
 *   2xxx  負債
 *   3xxx  權益
 *   4xxx  收入
 *   5xxx  支出
 *
 * is_leaf=false 為分類節點（不直接記帳）
 */
const accounts = [
  // ============================================================
  //  1xxx 資產
  // ============================================================
  { code: '1000', name: '資產', type: 'asset', is_leaf: false },
  { code: '1100', name: '流動資產', type: 'asset', parent: '1000', is_leaf: false },
  { code: '1110', name: '庫存現金', type: 'asset', parent: '1100' },
  { code: '1120', name: '銀行存款', type: 'asset', parent: '1100' },
  { code: '1130', name: '應收社費', type: 'asset', parent: '1100' },
  { code: '1140', name: '應收代收款', type: 'asset', parent: '1100' },
  { code: '1150', name: '預付款', type: 'asset', parent: '1100' },
  { code: '1200', name: '基金', type: 'asset', parent: '1000', is_leaf: false },
  { code: '1210', name: '定存-社務發展基金', type: 'asset', parent: '1200' },
  { code: '1220', name: '助秘退休基金', type: 'asset', parent: '1200' },

  // ============================================================
  //  2xxx 負債
  // ============================================================
  { code: '2000', name: '負債', type: 'liability', is_leaf: false },
  { code: '2100', name: '流動負債', type: 'liability', parent: '2000', is_leaf: false },
  { code: '2110', name: '應付廠商款', type: 'liability', parent: '2100' },
  { code: '2120', name: '應付代墊款-幹事', type: 'liability', parent: '2100' },
  { code: '2130', name: '應付代墊款-社長', type: 'liability', parent: '2100' },
  { code: '2140', name: '應付代墊款-其他', type: 'liability', parent: '2100' },
  { code: '2150', name: '應付代收款', type: 'liability', parent: '2100' },
  { code: '2160', name: '預收社費', type: 'liability', parent: '2100' },
  { code: '2200', name: '長期負債', type: 'liability', parent: '2000', is_leaf: false },
  { code: '2210', name: '應付退休金準備', type: 'liability', parent: '2200' },

  // ============================================================
  //  3xxx 權益
  // ============================================================
  { code: '3000', name: '權益', type: 'equity', is_leaf: false },
  { code: '3100', name: '提撥基金', type: 'equity', parent: '3000' },
  { code: '3200', name: '累計餘絀', type: 'equity', parent: '3000' },
  { code: '3300', name: '本期餘絀', type: 'equity', parent: '3000' },

  // ============================================================
  //  4xxx 收入
  // ============================================================
  { code: '4000', name: '收入', type: 'income', is_leaf: false },
  { code: '4100', name: '社費', type: 'income', parent: '4000', is_leaf: false },
  { code: '4101', name: '會費', type: 'income', parent: '4100' },
  { code: '4102', name: '服務基金', type: 'income', parent: '4100' },
  { code: '4103', name: '餐費', type: 'income', parent: '4100' },
  { code: '4104', name: '固定紅箱', type: 'income', parent: '4100' },
  { code: '4200', name: '紅箱', type: 'income', parent: '4000', is_leaf: false },
  { code: '4210', name: '授證紅箱', type: 'income', parent: '4200', is_leaf: false },
  { code: '4211', name: '授證紅箱-社長', type: 'income', parent: '4210' },
  { code: '4212', name: '授證紅箱-社長當選人', type: 'income', parent: '4210' },
  { code: '4213', name: '授證紅箱-副社長', type: 'income', parent: '4210' },
  { code: '4214', name: '授證紅箱-理監事', type: 'income', parent: '4210' },
  { code: '4215', name: '授證紅箱-社友', type: 'income', parent: '4210' },
  { code: '4220', name: '交接紅箱', type: 'income', parent: '4200', is_leaf: false },
  { code: '4221', name: '交接紅箱-新任社長', type: 'income', parent: '4220' },
  { code: '4222', name: '交接紅箱-卸任社長', type: 'income', parent: '4220' },
  { code: '4223', name: '交接紅箱-社長當選人', type: 'income', parent: '4220' },
  { code: '4224', name: '交接紅箱-理監事', type: 'income', parent: '4220' },
  { code: '4225', name: '交接紅箱-社友', type: 'income', parent: '4220' },
  { code: '4230', name: '四節紅箱', type: 'income', parent: '4200', is_leaf: false },
  { code: '4231', name: '春節紅箱', type: 'income', parent: '4230' },
  { code: '4232', name: '母親節紅箱', type: 'income', parent: '4230' },
  { code: '4233', name: '父親節紅箱', type: 'income', parent: '4230' },
  { code: '4234', name: '中秋節紅箱', type: 'income', parent: '4230' },
  { code: '4240', name: '歡喜紅箱', type: 'income', parent: '4200' },
  { code: '4250', name: '其他紅箱', type: 'income', parent: '4200' },
  { code: '4300', name: '利息收入', type: 'income', parent: '4000' },
  { code: '4400', name: '代辦費收入', type: 'income', parent: '4000', is_leaf: false },
  { code: '4401', name: '總半年費收入', type: 'income', parent: '4400' },
  { code: '4402', name: '扶輪月刊收入', type: 'income', parent: '4400' },
  { code: '4403', name: '地區基金收入', type: 'income', parent: '4400' },
  { code: '4500', name: '其他收入', type: 'income', parent: '4000', is_leaf: false },
  { code: '4501', name: '新社友入社', type: 'income', parent: '4500' },
  { code: '4502', name: '其他雜項收入', type: 'income', parent: '4500' },

  // ============================================================
  //  5xxx 支出
  // ============================================================
  { code: '5000', name: '支出', type: 'expense', is_leaf: false },
  { code: '5100', name: '行政管理委員會', type: 'expense', parent: '5000', category: '行政', is_leaf: false },
  { code: '5110', name: '辦公室設備費', type: 'expense', parent: '5100', category: '行政', is_leaf: false },
  { code: '5111', name: '辦公室租金及水電', type: 'expense', parent: '5110', category: '行政' },
  { code: '5112', name: '人事費-薪資/油資', type: 'expense', parent: '5110', category: '行政' },
  { code: '5113', name: '健保費', type: 'expense', parent: '5110', category: '行政' },
  { code: '5114', name: '文具費', type: 'expense', parent: '5110', category: '行政' },
  { code: '5115', name: '郵電費', type: 'expense', parent: '5110', category: '行政' },
  { code: '5116', name: '印刷費', type: 'expense', parent: '5110', category: '行政' },
  { code: '5117', name: '雜費及設備更新', type: 'expense', parent: '5110', category: '行政' },
  { code: '5118', name: '助秘提撥金', type: 'expense', parent: '5110', category: '行政' },
  { code: '5120', name: '餐費', type: 'expense', parent: '5100', category: '行政', is_leaf: false },
  { code: '5121', name: '一般例會/聯合例會', type: 'expense', parent: '5120', category: '行政' },
  { code: '5122', name: '女賓夕/眷屬聯歡', type: 'expense', parent: '5120', category: '行政' },
  { code: '5130', name: '社務活動費', type: 'expense', parent: '5100', category: '行政', is_leaf: false },
  { code: '5131', name: '資訊維修費', type: 'expense', parent: '5130', category: '行政' },
  { code: '5132', name: '健遊活動', type: 'expense', parent: '5130', category: '行政' },
  { code: '5133', name: '演講車馬費', type: 'expense', parent: '5130', category: '行政' },
  { code: '5134', name: '爐邊會', type: 'expense', parent: '5130', category: '行政' },
  { code: '5135', name: '內輪會', type: 'expense', parent: '5130', category: '行政' },
  { code: '5136', name: '金蘭聯誼', type: 'expense', parent: '5130', category: '行政' },
  { code: '5137', name: '高球聯誼', type: 'expense', parent: '5130', category: '行政' },
  { code: '5138', name: '專長聯誼研習', type: 'expense', parent: '5130', category: '行政' },
  { code: '5139', name: '職業參觀', type: 'expense', parent: '5130', category: '行政' },
  { code: '5140', name: '地區年會', type: 'expense', parent: '5130', category: '行政' },
  { code: '5141', name: '地區講習會', type: 'expense', parent: '5130', category: '行政' },
  { code: '5142', name: '交接費用', type: 'expense', parent: '5130', category: '行政' },
  { code: '5143', name: '授證之旅', type: 'expense', parent: '5130', category: '行政' },
  { code: '5144', name: '主辦縣市運動會', type: 'expense', parent: '5130', category: '行政' },
  { code: '5145', name: '體育保健-運動服', type: 'expense', parent: '5130', category: '行政' },
  { code: '5146', name: '扶輪家庭', type: 'expense', parent: '5130', category: '行政' },
  { code: '5200', name: '服務計畫委員會', type: 'expense', parent: '5000', category: '服務', is_leaf: false },
  { code: '5210', name: '生命橋樑計劃', type: 'expense', parent: '5200', category: '服務' },
  { code: '5220', name: '肺癌篩檢計畫', type: 'expense', parent: '5200', category: '服務' },
  { code: '5230', name: '美林國小樂團經費', type: 'expense', parent: '5200', category: '服務' },
  { code: '5240', name: '生命教育暨反毒計劃', type: 'expense', parent: '5200', category: '服務' },
  { code: '5250', name: '專案服務計劃', type: 'expense', parent: '5200', category: '服務' },
  { code: '5260', name: '捐血活動', type: 'expense', parent: '5200', category: '服務' },
  { code: '5270', name: 'YEP 委員會', type: 'expense', parent: '5200', category: '服務' },
  { code: '5300', name: '社員發展委員會', type: 'expense', parent: '5000', category: '社員', is_leaf: false },
  { code: '5310', name: '新社員帶領', type: 'expense', parent: '5300', category: '社員' },
  { code: '5320', name: '社員訓練教育', type: 'expense', parent: '5300', category: '社員' },
  { code: '5400', name: '扶輪基金委員會', type: 'expense', parent: '5000', category: '扶輪基金' },
  { code: '5500', name: '公共關係委員會', type: 'expense', parent: '5000', category: '公關' },
  { code: '5600', name: '代辦費支出', type: 'expense', parent: '5000', category: '代辦', is_leaf: false },
  { code: '5601', name: '總半年費支出', type: 'expense', parent: '5600', category: '代辦' },
  { code: '5602', name: '扶輪月刊支出', type: 'expense', parent: '5600', category: '代辦' },
  { code: '5603', name: '地區基金支出', type: 'expense', parent: '5600', category: '代辦' },
  { code: '5700', name: '預備費', type: 'expense', parent: '5000', category: '預備' },
]

async function main() {
  await initDB()

  // 先全清舊資料（idempotent，方便重灌）
  console.log('[seed-accounts] 清除舊有 accounts...')
  await pool.query('DELETE FROM accounts')

  console.log('[seed-accounts] 寫入科目樹...')
  const codeToId = new Map()
  let order = 0

  for (const a of accounts) {
    const parentId = a.parent ? codeToId.get(a.parent) : null
    const [r] = await pool.query(
      `INSERT INTO accounts (code, name, parent_id, type, category, is_leaf, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.code, a.name, parentId, a.type, a.category || null, a.is_leaf !== false, order++]
    )
    codeToId.set(a.code, r.insertId)
  }

  console.log(`[seed-accounts] 完成，共 ${accounts.length} 筆`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
