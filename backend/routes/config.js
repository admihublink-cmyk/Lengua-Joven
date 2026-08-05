const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM config').all()
  const config = {}
  for (const r of rows) config[r.key] = r.value
  res.json(config)
})

router.put('/', requireAuth, (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const upsert = db.prepare('INSERT OR REPLACE INTO config VALUES (?,?)')
  for (const [key, value] of Object.entries(req.body)) {
    upsert.run(key, String(value))
  }
  const rows = db.prepare('SELECT * FROM config').all()
  const config = {}
  for (const r of rows) config[r.key] = r.value
  res.json(config)
})

module.exports = router
