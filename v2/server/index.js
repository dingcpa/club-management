require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')

const { pool, initDB } = require('./db')
const { authMiddleware } = require('./auth')

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(bodyParser.json({ limit: '10mb' }))

// ============================================================
//  靜態檔（生產環境）
// ============================================================
const clientDist = path.join(__dirname, '../client/dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
}

// ============================================================
//  路由（公開）
// ============================================================
app.use('/api/auth', require('./routes/auth'))

// ============================================================
//  路由（需登入）
// ============================================================
app.use('/api', authMiddleware)
app.use('/api/users', require('./routes/users'))
app.use('/api/terms', require('./routes/terms'))
app.use('/api/members', require('./routes/members'))
app.use('/api/accounts', require('./routes/accounts'))
app.use('/api/journal', require('./routes/journal'))
app.use('/api/billing', require('./routes/billing'))
app.use('/api/advances', require('./routes/advances'))
app.use('/api/contributions', require('./routes/contributions'))
app.use('/api/reports', require('./routes/reports'))

// ============================================================
//  SPA fallback
// ============================================================
app.get('/{*path}', (req, res) => {
  const indexFile = path.join(__dirname, '../client/dist/index.html')
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile)
  } else {
    res.status(404).send('Frontend not built yet — run `npm run dev:client`')
  }
})

// ============================================================
//  全域錯誤
// ============================================================
app.use((err, req, res, next) => {
  console.error('[ERROR]', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

async function start() {
  await initDB()
  app.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
