require('dotenv').config()
const bcrypt = require('bcryptjs')
const { pool, initDB } = require('./db')

async function main() {
  const [username, password, displayName, role] = process.argv.slice(2)
  if (!username || !password) {
    console.error('Usage: node server/seed-user.js <username> <password> [displayName] [role]')
    console.error('Roles: admin / staff / treasurer / president / secretary')
    process.exit(1)
  }
  await initDB()
  const hash = await bcrypt.hash(password, 12)
  try {
    await pool.query(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
      [username, hash, displayName || username, role || 'admin']
    )
    console.log(`使用者 ${username} (${role || 'admin'}) 建立成功`)
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      console.error(`使用者 ${username} 已存在`)
    } else {
      throw e
    }
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
