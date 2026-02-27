# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案簡介

**社團財務管理系統（Club Finance）** — 使用 vanilla JavaScript + Node.js 靜態檔案伺服器，無任何外部依賴。

## 啟動與運行

```bash
# 啟動開發伺服器（Port 3000）
node server.js
```

開啟瀏覽器前往 `http://localhost:3000`。無需構建步驟，修改 JS/CSS 後直接重新整理頁面即可生效。

## 架構概覽

這是一個零依賴的單頁應用程式（SPA），由三個主要檔案組成：

- [server.js](server.js) — 原生 Node.js `http` 模組，服務靜態檔案，Port 3000 硬編碼
- [app.js](app.js) — 全部應用邏輯（21 KB），包含資料層與 UI 層
- [index.html](index.html) — HTML 結構與模態框模板
- [style.css](style.css) — 玻璃態(Glassmorphism)深色主題設計

## 資料層：DataStore 類

`DataStore` 類（位於 [app.js](app.js) 頂部）負責所有資料持久化，使用 `localStorage`：

- 儲存鍵：`cf_members`（社員陣列）、`cf_transactions`（交易紀錄陣列）
- 社員結構：`{id, name, studentId, dept, status, joinDate}`
- 交易結構：`{id, date, type('income'|'expense'), item, payer, amount, note}`
- `getBalance()` — 計算所有交易的累計結餘
- `getStats(year)` — 依年度計算收入/支出統計

## UI 層：app 物件

全域 `app` 物件管理視圖切換與渲染：

- 視圖：`dashboard`、`members`、`fees`、`expenses`、`reports`
- 每個視圖有對應的 `render*()` 方法，直接操作 `innerHTML`
- 模態框模式用於新增/編輯（`showMemberModal()`、`showFeeModal()`、`showExpenseModal()`）
- 事件綁定混用內聯 `onclick` 與 `bindNav()` 中的 `addEventListener`

## 主要功能視圖

| 視圖 | 功能 |
|------|------|
| Dashboard | 社員人數、帳戶結餘、年度收支卡片、近期交易列表 |
| 社員明細 | 新增/編輯/刪除社員，顯示部門與狀態標籤 |
| 社費繳交 | 記錄 `income` 類型交易，連結至社員 |
| 支出管理 | 記錄 `expense` 類型交易 |
| 年度報表 | 依年份篩選並顯示收支明細與盈餘 |
