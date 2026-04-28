const express = require('express')
const bcrypt = require('bcryptjs')
const { pool } = require('../db')
const { signToken, authMiddleware } = require('../auth')

const router = express.Router()

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ error: '請輸入帳號與密碼' })
    }
    const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username])
    if (!rows.length) return res.status(401).json({ error: '帳號或密碼錯誤' })
    const ok = await bcrypt.compare(password, rows[0].password_hash)
    if (!ok) return res.status(401).json({ error: '帳號或密碼錯誤' })
    const token = signToken(rows[0])
    res.json({
      token,
      displayName: rows[0].display_name,
      role: rows[0].role,
      memberId: rows[0].member_id,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Login failed' })
  }
})

router.get('/me', authMiddleware, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    displayName: req.user.displayName,
    role: req.user.role,
    memberId: req.user.memberId,
  })
})

module.exports = router
