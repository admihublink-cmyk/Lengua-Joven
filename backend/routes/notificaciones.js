const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY fecha DESC').all(req.user.id)
    .map(n => ({ ...n, leida: n.leida === 1 })))
})

router.put('/:id/leida', requireAuth, (req, res) => {
  db.prepare('UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

router.post('/marcar-todas', requireAuth, (req, res) => {
  db.prepare('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?').run(req.user.id)
  res.json({ ok: true })
})

module.exports = router
