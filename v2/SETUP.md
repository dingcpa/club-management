# Phase 1 啟動指引

## 完成度

✅ **Phase 1 核心功能已完成**

| 模組 | 狀態 | 備註 |
|---|---|---|
| 後端 Express + JWT + mysql2 pool | ✅ |  |
| 14 張表 schema（terms, members, accounts, journal_entries/lines, billing*, advance*, contribution*） | ✅ | `server/db.js` |
| 169 個會計科目（六大委員會 + 紅箱 + 代辦費 + 預備費） | ✅ | `server/seed-accounts.js` |
| 簡化複式簿記服務（4 種傳票自動展開借貸） | ✅ | `server/services/accounting.js` |
| API 路由（10 條）：auth / users / terms / members / accounts / journal / billing / advances / contributions / reports | ✅ |  |
| Vue 3 + Vuetify 3 SPA（11 頁） | ✅ | dist 已 build 成功 |
| 月份收支明細表 Excel 匯出 | ✅ | `services/xlsx.js` |
| 一頁式儀表板（理監事用） | ✅ | DashboardPage + ReportsPage |
| 應收追蹤 + 季度請款單 | ✅ | BillingPage |
| 代墊款工作流（多人 + 跨屆） | ✅ | AdvancesPage |
| 認捐單（紅白包/捐贈/旅遊房費） | ✅ | ContributionsPage |
| 待補單據追蹤 | ✅ | DashboardPage 提醒區 |
| **PDF 請款單** | ✅ | `services/pdf.js`（puppeteer） |

⏳ **Phase 1 尚未做（可稍後補）**
- 屆別結轉作業（Phase 3）

⏳ **Phase 2（強烈建議，2026/7 上線後盡快做）**
- LINE Official Account 申請 + Webhook 接收
- LINE Bot 私訊請款單 PDF
- 例會主檔 + 自動編號
- LINE 接龍 Claude API 解析
- 紅箱現場登記（手機友善 3 秒流程）

⏳ **Phase 3**
- 預算 vs 決算對比表
- 資產負債表 + 現金流量表
- 屆別結轉作業
- 行事曆檢視
- 文件管理

---

## 啟動步驟（你電腦）

### 1. 安裝 MariaDB / MySQL

如果尚未安裝，可選擇：
- **MariaDB**：https://mariadb.org/download/
- **MySQL**：https://dev.mysql.com/downloads/mysql/
- **Docker**：`docker run -d --name mariadb -p 3306:3306 -e MARIADB_ROOT_PASSWORD=xxxxxx mariadb:11`

### 2. 建立資料庫

```sql
CREATE DATABASE club_finance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 設定環境變數

```bash
cd c:/Code_Claude/club-finance/v2
cp .env.example .env
```

編輯 `.env`，至少填入：
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密碼
DB_NAME=club_finance
JWT_SECRET=任意字串至少 32 字元
```

### 4. 啟動後端 + 自動建表

```bash
node server/index.js
# 看到 [DB] All tables initialized + [server] http://localhost:5000 即成功
```

### 5. 灌入會計科目

另開一個終端：
```bash
cd c:/Code_Claude/club-finance/v2
node server/seed-accounts.js
# 看到 [seed-accounts] 完成，共 169 筆
```

### 6. 建立第一個管理員帳號

```bash
node server/seed-user.js admin <你的密碼> 系統管理員 admin
# 看到 使用者 admin (admin) 建立成功
```

### 7. 啟動前端 dev server

```bash
cd client
npm run dev
# 看到 ➜  Local:   http://localhost:5173/
```

開啟瀏覽器：http://localhost:5173

用 admin / 你設定的密碼登入。

---

## 第一次使用流程（建議）

1. **建第 32 屆**（屆別管理）→ 起日 2025-07-01、迄日 2026-06-30
2. **新增 35-38 位社員**（社員 / 職務）→ 至少填中文 + 英文社名 + 職業
3. **設定每位社員的本屆職務**（社員列表的「職務」按鈕）→ P / Sec / Treasurer / Director 等
4. **產生 32 屆 5 月應收項目**（應收 / 請款 → 應收項目 → 期別填 `2025-05`、年 2025、月 5、按「批次產生月份社費」）
5. **記錄一筆收入傳票**（傳票 → 新傳票 → 收）→ 銀行存款收 12000，沖銷某社友 5 月會費 + 服務基金 + 餐費 + 固定紅箱
6. **記錄一筆支出傳票**（付）→ 例會餐費
7. **記錄一筆代墊單**（代墊）→ 社長代墊授證之旅 50000
8. **建立認捐單**（認捐單 → 例如某社友母喪白包）→ 各社友認捐金額 → 結單 → 自動轉應收
9. **開立季度請款單**（應收 / 請款 → 請款單 → 開立 → 選社友 → 預設勾選所有未繳項目 → 建立）
10. **檢視儀表板**（首頁）→ 看 cash 餘額、應收應付小計
11. **產生月份收支明細表**（報表 → 5 月 → 產生報表 → 匯出 Excel）

---

## 角色權限速查

| 動作 | admin | staff | treasurer | president |
|---|---|---|---|---|
| 帳號管理 | ✅ |  |  |  |
| 屆別新增 | ✅ |  | ✅ | ✅ |
| 社員 CRUD | ✅ | ✅ | ✅ |  |
| 會計科目 CRUD | ✅ |  | ✅ |  |
| 傳票 / 應收 / 代墊 / 認捐 | ✅ | ✅ | ✅ |  |
| 結單 / 反沖傳票 | ✅ |  | ✅ |  |
| 查看所有報表 | ✅ | ✅ | ✅ | ✅ |
| 刪除（軟刪除） | ✅ |  |  |  |

---

## 簡化複式簿記說明（給其他幹事看）

幹事在 UI 看到的只有 4 種傳票：

| UI 名稱 | 系統內部展開 | 何時用 |
|---|---|---|
| 收 | 借: 銀行/現金，貸: 收入科目（可沖銷某應收） | 收到社費、紅箱、利息 |
| 付 | 借: 支出科目，貸: 銀行/現金 | 直接付出去（不墊） |
| 代墊 | 借: 支出科目，貸: 應付○○○代墊款 | 社長 / 幹事先墊（之後還） |
| 轉帳 | 借: 銀行 B，貸: 銀行 A | 內部轉移（不影響損益） |

**還代墊款** 不是新傳票，而是在「代墊款」頁按綠色還款按鈕，系統會自動產生一張「付」傳票沖銷應付。

---

## 已知限制 / 後續優化點

1. **PDF 請款單客製欄位**：在 `.env` 設定 `CLUB_NAME`、`BANK_INFO`、`TREASURER_NOTE` 即可改 PDF 上的銀行帳號與司庫備註。
2. **單張帳冊大資料量**：應收項目單筆 INSERT 在批次產生月份社費時是 35 人 × 4 項 = 140 個 INSERT。Phase 1 規模沒問題；若日後真的太慢可改 batch insert。
3. **沒做活動 / 例會 / 行事曆**：留 Phase 2。
4. **沒做預算 vs 決算對比**：留 Phase 3。
5. **屆別結轉**：6/30 結帳 → 7/1 結轉未結項目，留 Phase 3 做（33 屆上線時不需要，因為是新開帳）。

---

## 檔案清單

```
v2/
├── server/
│   ├── index.js
│   ├── db.js                       (14 張表 schema)
│   ├── auth.js
│   ├── seed-user.js
│   ├── seed-accounts.js            (169 個科目)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── terms.js
│   │   ├── members.js              (含 member_terms)
│   │   ├── accounts.js
│   │   ├── journal.js              (4 種傳票 + 反沖)
│   │   ├── billing.js              (應收 + 請款單 + 月份社費批次)
│   │   ├── advances.js             (代墊單 + 還款)
│   │   ├── contributions.js        (認捐單 + 結單)
│   │   └── reports.js              (儀表板 + 月份明細 + 待補單據)
│   └── services/
│       ├── accounting.js           (借貸展開 + 餘額計算)
│       └── xlsx.js                 (Excel 匯出)
└── client/
    └── src/
        ├── App.vue                 (provide hub + 屆別切換)
        ├── main.js
        ├── composables/            (9 支 composable)
        └── pages/                  (11 個頁面)
```
