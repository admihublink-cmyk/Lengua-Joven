const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

// Endpoint público: solo devuelve la liga de pago (sin auth)
router.get('/liga-pago', async (req, res) => {
  const row = await queryOne("SELECT value FROM config WHERE key = 'liga_pago_url'")
  res.json({ url: row?.value || null })
})

router.get('/', requireAuth, async (req, res) => {
  if (['alumno', 'tutor'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const rows = await query('SELECT * FROM config', [])
  const config = {}
  for (const r of rows) config[r.key] = r.value
  res.json(config)
})

router.put('/', requireAuth, async (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  for (const [key, value] of Object.entries(req.body)) {
    await run('INSERT INTO config VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [key, String(value)])
  }
  const rows = await query('SELECT * FROM config', [])
  const config = {}
  for (const r of rows) config[r.key] = r.value
  res.json(config)
})

module.exports = router
