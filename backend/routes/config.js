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

// ── Precios por plantel + idioma ──────────────────────────────────────────────
router.get('/precios', requireAuth, async (req, res) => {
  if (['alumno', 'tutor'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const rows = await query('SELECT * FROM precios ORDER BY plantel_id, idioma_id')
  res.json(rows)
})

router.put('/precios', requireAuth, async (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { plantel_id, idioma_id, categoria = '', monto } = req.body
  if (!plantel_id || !idioma_id || monto == null) return res.status(400).json({ error: 'plantel_id, idioma_id y monto son requeridos' })
  await run(
    'INSERT INTO precios (plantel_id, idioma_id, categoria, monto) VALUES ($1,$2,$3,$4) ON CONFLICT (plantel_id, idioma_id, categoria) DO UPDATE SET monto = EXCLUDED.monto',
    [plantel_id, idioma_id, categoria, parseFloat(monto)]
  )
  res.json({ ok: true })
})

router.delete('/precios/:plantel_id/:idioma_id/:categoria', requireAuth, async (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  await run('DELETE FROM precios WHERE plantel_id = $1 AND idioma_id = $2 AND categoria = $3',
    [req.params.plantel_id, req.params.idioma_id, req.params.categoria])
  res.json({ ok: true })
})

module.exports = router
