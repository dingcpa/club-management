const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'club_finance',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: '+08:00',
})

async function initDB() {
  // ============================================================
  //  使用者 / 系統權限
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100),
      role VARCHAR(20) NOT NULL DEFAULT 'staff',
      member_id BIGINT NULL COMMENT '對應社員 ID（幹事為 NULL）',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
  `)

  // ============================================================
  //  屆別
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS terms (
      id INT PRIMARY KEY COMMENT '屆別號 (32, 33, …)',
      start_date DATE NOT NULL COMMENT '7/1',
      end_date DATE NOT NULL COMMENT '隔年 6/30',
      status ENUM('active','closed') NOT NULL DEFAULT 'active',
      president_member_id BIGINT NULL,
      secretary_member_id BIGINT NULL,
      treasurer_member_id BIGINT NULL,
      carry_over_at DATETIME NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
  `)

  // ============================================================
  //  社員 / 職務
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id BIGINT PRIMARY KEY,
      name_zh VARCHAR(50) NOT NULL COMMENT '中文名',
      name_en VARCHAR(50) COMMENT '英文社名',
      classification VARCHAR(50) COMMENT '職業分類',
      occupation VARCHAR(100) COMMENT '詳細職業',
      email VARCHAR(100),
      phone VARCHAR(30),
      line_user_id VARCHAR(100) COMMENT 'LINE Bot userId',
      preferred_channel ENUM('line','email','paper') DEFAULT 'line',
      joined_date DATE COMMENT '入社日期',
      status ENUM('active','leave','resigned') DEFAULT 'active',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_status (status)
    ) CHARACTER SET utf8mb4
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_terms (
      id BIGINT PRIMARY KEY,
      term_id INT NOT NULL,
      member_id BIGINT NOT NULL,
      role VARCHAR(50) COMMENT 'P/Sec/PE/VP/PP/Director/Supervisor/Chair/Member',
      committee VARCHAR(50) COMMENT '主委所屬委員會',
      ratbed_group VARCHAR(20) COMMENT '爐邊組',
      neilun_group VARCHAR(20) COMMENT '內輪組',
      monthly_dues DECIMAL(10,2) DEFAULT 1400 COMMENT '月份社費',
      service_fund DECIMAL(10,2) DEFAULT 800 COMMENT '服務基金',
      meal_fee DECIMAL(10,2) DEFAULT 2000 COMMENT '餐費',
      fixed_red_box DECIMAL(10,2) DEFAULT 1300 COMMENT '固定紅箱',
      remark TEXT,
      UNIQUE KEY uk_term_member (term_id, member_id),
      KEY idx_term (term_id),
      KEY idx_member (member_id)
    ) CHARACTER SET utf8mb4
  `)

  // ============================================================
  //  會計科目
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      parent_id INT NULL,
      type ENUM('asset','liability','equity','income','expense') NOT NULL,
      category VARCHAR(50) COMMENT '六大委員會分類',
      is_leaf BOOLEAN DEFAULT TRUE COMMENT '是否為記帳科目',
      active BOOLEAN DEFAULT TRUE,
      sort_order INT DEFAULT 0,
      remark TEXT,
      KEY idx_parent (parent_id),
      KEY idx_type (type)
    ) CHARACTER SET utf8mb4
  `)

  // ============================================================
  //  預算
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id BIGINT PRIMARY KEY,
      term_id INT NOT NULL,
      account_id INT NOT NULL,
      unit_price DECIMAL(12,2),
      qty1 INT,
      qty2 INT,
      qty3 INT,
      amount DECIMAL(12,2) NOT NULL,
      remark TEXT,
      UNIQUE KEY uk_term_account (term_id, account_id)
    ) CHARACTER SET utf8mb4
  `)

  // ============================================================
  //  傳票（簡化複式簿記）
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id BIGINT PRIMARY KEY,
      term_id INT NOT NULL,
      entry_no VARCHAR(20) UNIQUE COMMENT 'T32-001 等',
      entry_date DATE NOT NULL,
      entry_type ENUM('receipt','payment','advance','transfer') NOT NULL
        COMMENT 'receipt 收/payment 付/advance 代墊/transfer 轉帳',
      summary VARCHAR(255),
      attachment_status ENUM('none','pending','received','na') DEFAULT 'pending',
      attachment_file VARCHAR(255),
      status ENUM('draft','posted','reversed') DEFAULT 'posted',
      reversed_by_id BIGINT NULL,
      meeting_id BIGINT NULL,
      activity_id BIGINT NULL,
      created_by_user_id INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      remark TEXT,
      KEY idx_term_date (term_id, entry_date),
      KEY idx_attachment_status (attachment_status)
    ) CHARACTER SET utf8mb4
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS journal_lines (
      id BIGINT PRIMARY KEY,
      entry_id BIGINT NOT NULL,
      line_no INT NOT NULL,
      account_id INT NOT NULL,
      debit DECIMAL(12,2) NOT NULL DEFAULT 0,
      credit DECIMAL(12,2) NOT NULL DEFAULT 0,
      member_id BIGINT NULL COMMENT '與某社友相關',
      billing_item_id BIGINT NULL COMMENT '沖銷某應收',
      advance_payment_id BIGINT NULL COMMENT '沖銷某代墊款',
      description VARCHAR(255),
      KEY idx_entry (entry_id),
      KEY idx_account (account_id),
      KEY idx_member (member_id),
      KEY idx_billing_item (billing_item_id),
      KEY idx_advance (advance_payment_id)
    ) CHARACTER SET utf8mb4
  `)

  // ============================================================
  //  應收項目（個人帳） + 請款單
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_items (
      id BIGINT PRIMARY KEY,
      term_id INT NOT NULL,
      member_id BIGINT NOT NULL,
      category VARCHAR(50) NOT NULL
        COMMENT 'monthly_due/cert_red_box/handover_red_box/festival_red_box/happy_red_box/agency/contribution',
      period VARCHAR(20) COMMENT '2025-07 / 2025-Q1 / 授證 / 春節 …',
      account_id INT NOT NULL,
      description VARCHAR(255),
      amount DECIMAL(12,2) NOT NULL,
      due_date DATE,
      status ENUM('open','partial','paid','waived','carried') DEFAULT 'open',
      paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      paid_date DATE,
      contribution_pledge_id BIGINT NULL,
      source_term_id INT NULL COMMENT '結轉自哪屆',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      remark TEXT,
      KEY idx_member_term (member_id, term_id),
      KEY idx_status (status),
      KEY idx_category (category)
    ) CHARACTER SET utf8mb4
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS billings (
      id BIGINT PRIMARY KEY,
      term_id INT NOT NULL,
      member_id BIGINT NOT NULL,
      billing_no VARCHAR(20) UNIQUE COMMENT 'B32-001 等',
      issued_date DATE NOT NULL,
      due_date DATE,
      total_amount DECIMAL(12,2) NOT NULL,
      status ENUM('issued','paid','partial','cancelled') DEFAULT 'issued',
      paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      pdf_path VARCHAR(255),
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_member (member_id),
      KEY idx_term (term_id)
    ) CHARACTER SET utf8mb4
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_lines (
      id BIGINT PRIMARY KEY,
      billing_id BIGINT NOT NULL,
      billing_item_id BIGINT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      label VARCHAR(255),
      KEY idx_billing (billing_id),
      KEY idx_item (billing_item_id)
    ) CHARACTER SET utf8mb4
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_send_logs (
      id BIGINT PRIMARY KEY,
      billing_id BIGINT NOT NULL,
      channel ENUM('line','email','paper','manual') NOT NULL,
      status ENUM('pending','sent','failed','read') DEFAULT 'pending',
      sent_at DATETIME,
      read_at DATETIME,
      error_message TEXT,
      remark TEXT,
      KEY idx_billing (billing_id)
    ) CHARACTER SET utf8mb4
  `)

  // ============================================================
  //  代墊款
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS advance_payments (
      id BIGINT PRIMARY KEY,
      payer_type ENUM('staff','member','external') NOT NULL,
      payer_member_id BIGINT NULL COMMENT 'payer_type=member 時對應社員',
      payer_name VARCHAR(100) COMMENT 'staff/external 時填名稱',
      term_id INT NOT NULL,
      date DATE NOT NULL,
      total_amount DECIMAL(12,2) NOT NULL,
      summary VARCHAR(255),
      status ENUM('open','partial','closed') DEFAULT 'open',
      paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      source_term_id INT NULL COMMENT '跨屆結轉',
      attachment_status ENUM('none','pending','received','na') DEFAULT 'pending',
      attachment_file VARCHAR(255),
      journal_entry_id BIGINT NULL COMMENT '開單時的傳票',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_payer (payer_type, payer_member_id),
      KEY idx_status (status)
    ) CHARACTER SET utf8mb4
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS advance_payment_lines (
      id BIGINT PRIMARY KEY,
      advance_id BIGINT NOT NULL,
      account_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      description VARCHAR(255),
      KEY idx_advance (advance_id)
    ) CHARACTER SET utf8mb4
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS advance_repayments (
      id BIGINT PRIMARY KEY,
      advance_id BIGINT NOT NULL,
      date DATE NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      journal_entry_id BIGINT NULL,
      remark TEXT,
      KEY idx_advance (advance_id)
    ) CHARACTER SET utf8mb4
  `)

  // ============================================================
  //  認捐單（紅白包 / 公益 / 旅遊房費）
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contribution_drives (
      id BIGINT PRIMARY KEY,
      term_id INT NOT NULL,
      type VARCHAR(50) NOT NULL
        COMMENT 'red_envelope/white_envelope/donation/trip_fee/external',
      title VARCHAR(255) NOT NULL,
      occasion VARCHAR(255),
      beneficiary_member_id BIGINT NULL,
      beneficiary_external VARCHAR(100),
      initiated_date DATE NOT NULL,
      due_date DATE,
      total_pledged DECIMAL(12,2) NOT NULL DEFAULT 0,
      status ENUM('open','closed') DEFAULT 'open',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_term (term_id),
      KEY idx_status (status)
    ) CHARACTER SET utf8mb4
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contribution_pledges (
      id BIGINT PRIMARY KEY,
      drive_id BIGINT NOT NULL,
      member_id BIGINT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status ENUM('pledged','billing_created','paid','waived') DEFAULT 'pledged',
      billing_item_id BIGINT NULL,
      remark TEXT,
      UNIQUE KEY uk_drive_member (drive_id, member_id),
      KEY idx_drive (drive_id),
      KEY idx_member (member_id)
    ) CHARACTER SET utf8mb4
  `)

  console.log('[DB] All tables initialized')
}

module.exports = { pool, initDB }
