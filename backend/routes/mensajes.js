const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const me = req.user
  const { grupo_id, contacto_id } = req.query
  let rows
  if (contacto_id) {
    rows = db.prepare(`
      SELECT * FROM mensajes
      WHERE (de = ? AND para = ?) OR (de = ? AND para = ?)
      ORDER BY fecha ASC
    `).all(me.id, contacto_id, contacto_id, me.id)
  } else if (grupo_id) {
    rows = db.prepare('SELECT * FROM mensajes WHERE grupo_id = ? ORDER BY fecha ASC').all(grupo_id)
  } else {
    rows = db.prepare('SELECT * FROM mensajes WHERE de = ? OR para = ? ORDER BY fecha DESC').all(me.id, me.id)
  }
  res.json(rows.map(r => ({ ...r, leido: r.leido === 1 })))
})

router.post('/', requireAuth, (req, res) => {
  const { para, contenido, grupo_id } = req.body
  const ids = db.prepare('SELECT id FROM mensajes').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('m', '')) || 0), 0)
  const newId = 'm' + (max + 1)
  const fecha = new Date().toISOString()
  db.prepare('INSERT INTO mensajes VALUES (?,?,?,?,?,?,?)').run(
    newId, req.user.id, para, contenido, fecha, 0, grupo_id || null
  )
  res.status(201).json(db.prepare('SELECT * FROM mensajes WHERE id = ?').get(newId))
})

router.put('/:id/leido', requireAuth, (req, res) => {
  db.prepare('UPDATE mensajes SET leido = 1 WHERE id = ? AND para = ?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

router.put('/marcar-leidos', requireAuth, (req, res) => {
  const { de } = req.body
  db.prepare('UPDATE mensajes SET leido = 1 WHERE para = ? AND de = ?').run(req.user.id, de)
  res.json({ ok: true })
})

module.exports = router
