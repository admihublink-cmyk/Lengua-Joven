const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'superadmin') {
    rows = db.prepare('SELECT * FROM buzon ORDER BY fecha DESC').all()
  } else if (['director', 'coordinador'].includes(me.rol) && me.plantel_id) {
    rows = db.prepare('SELECT * FROM buzon WHERE plantel_id = ? ORDER BY fecha DESC').all(me.plantel_id)
  } else {
    rows = db.prepare('SELECT * FROM buzon WHERE autor_id = ? ORDER BY fecha DESC').all(me.id)
  }
  res.json(rows.map(r => ({ ...r, anonimo: r.anonimo === 1 })))
})

router.post('/', requireAuth, (req, res) => {
  const { tipo, asunto, mensaje, anonimo, plantel_id } = req.body
  const ids = db.prepare('SELECT id FROM buzon').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('bz', '')) || 0), 0)
  const newId = 'bz' + (max + 1)
  const fecha = new Date().toISOString()
  const pid = req.user.plantel_id || plantel_id || null
  db.prepare('INSERT INTO buzon VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
    newId, tipo, asunto, mensaje, anonimo ? 1 : 0,
    anonimo ? null : req.user.id, pid, 'nueva', fecha, '', null, null
  )
  res.status(201).json(db.prepare('SELECT * FROM buzon WHERE id = ?').get(newId))
})

router.put('/:id/responder', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { respuesta, estado } = req.body
  const fecha = new Date().toISOString()
  db.prepare('UPDATE buzon SET respuesta = ?, respondido_por = ?, fecha_respuesta = ?, estado = ? WHERE id = ?')
    .run(respuesta, req.user.id, fecha, estado || 'respondida', req.params.id)
  res.json(db.prepare('SELECT * FROM buzon WHERE id = ?').get(req.params.id))
})

module.exports = router
