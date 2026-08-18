const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM notificaciones WHERE usuario_id = $1 ORDER BY fecha DESC', [req.user.id])
  res.json(rows.map(n => ({ ...n, leida: n.leida === 1 })))
})

router.put('/:id/leida', requireAuth, async (req, res) => {
  await run('UPDATE notificaciones SET leida = 1 WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id])
  res.json({ ok: true })
})

router.post('/marcar-todas', requireAuth, async (req, res) => {
  await run('UPDATE notificaciones SET leida = 1 WHERE usuario_id = $1', [req.user.id])
  res.json({ ok: true })
})

module.exports = router
