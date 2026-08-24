const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message)
})

// Returns array of rows
async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows
}

// Returns first row or null
async function queryOne(sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows[0] || null
}

// Executes and returns pg result
async function run(sql, params = []) {
  return pool.query(sql, params)
}

async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = { pool, query, queryOne, run, withTransaction }
