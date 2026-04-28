# Club Finance v2 — 嘉義中區扶輪社財務管理系統

Vue 3 + Vuetify 3 + Express 5 + MariaDB + JWT 全端應用。

## 啟動

```bash
# 1. 安裝依賴
npm install
cd client && npm install && cd ..

# 2. 設定環境
cp .env.example .env
# 編輯 .env 填入 DB 資訊與 JWT_SECRET

# 3. 建立 DB（MariaDB / MySQL）
mysql -u root -p
> CREATE DATABASE club_finance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 4. 啟動後端（自動建表）
npm run dev:server

# 5. 建立第一個管理員
npm run create-user admin <password> 系統管理員

# 6. 灌入會計科目
npm run seed-accounts

# 7. 另開終端啟動前端
npm run dev:client
```

開啟 http://localhost:5173

## 架構

```
v2/
├── server/
│   ├── index.js              Express 入口 + 路由註冊
│   ├── db.js                 mysql2 連線池 + initDB()
│   ├── auth.js               JWT middleware
│   ├── seed-user.js          建立管理員帳號
│   ├── seed-accounts.js      灌入扶輪社會計科目
│   ├── routes/               業務路由（按模組拆分）
│   ├── services/             共用 services（accounting / pdf / line / ai-parser）
│   └── migrations/           SQL schema
├── client/
│   └── src/
│       ├── App.vue           主框架（provide 全域狀態）
│       ├── composables/      useAuth, useMembers, useJournal, ...
│       └── pages/            視圖頁
└── .env
```

## 角色

| 角色 | 權限 |
|---|---|
| `admin` | 全部 + 帳號管理 |
| `staff` | 幹事：日常傳票、請款、活動 |
| `treasurer` | 司庫：審閱、報表 |
| `president` | 社長：所有檢視 |
