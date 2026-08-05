const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const me = req.user
  if (me.rol === 'superadmin') {
    res.json(db.prepare('SELECT * FROM idiomas ORDER BY nombre').all())
  } else if (me.plantel_id) {
    res.json(db.prepare('SELECT * FROM idiomas WHERE plantel_id = ? ORDER BY nombre').all(me.plantel_id))
  } else {
    res.json([])
  }
})

router.post('/', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { nombre, plantel_id } = req.body
  const ids = db.prepare('SELECT id FROM idiomas').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('i', '')) || 0), 0)
  const newId = 'i' + (max + 1)
  const pid = req.user.rol === 'superadmin' ? plantel_id : req.user.plantel_id
  db.prepare('INSERT INTO idiomas VALUES (?,?,?)').run(newId, nombre, pid)
  res.status(201).json(db.prepare('SELECT * FROM idiomas WHERE id = ?').get(newId))
})

router.put('/:id', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { nombre } = req.body
  db.prepare('UPDATE idiomas SET nombre = ? WHERE id = ?').run(nombre, req.params.id)
  res.json(db.prepare('SELECT * FROM idiomas WHERE id = ?').get(req.params.id))
})

router.delete('/:id', requireAuth, (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  db.prepare('DELETE FROM idiomas WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Niveles
router.get('/:id/niveles', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM niveles WHERE idioma_id = ? ORDER BY orden').all(req.params.id))
})

router.post('/:id/niveles', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { nombre, orden } = req.body
  const ids = db.prepare('SELECT id FROM niveles').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('n', '')) || 0), 0)
  const newId = 'n' + (max + 1)
  db.prepare('INSERT INTO niveles VALUES (?,?,?,?)').run(newId, req.params.id, nombre, orden || 0)
  res.status(201).json(db.prepare('SELECT * FROM niveles WHERE id = ?').get(newId))
})

router.put('/niveles/:nid', requireAuth, (req, res) => {
  const { nombre, orden } = req.body
  db.prepare('UPDATE niveles SET nombre = ?, orden = ? WHERE id = ?').run(nombre, orden, req.params.nid)
  res.json(db.prepare('SELECT * FROM niveles WHERE id = ?').get(req.params.nid))
})

router.delete('/niveles/:nid', requireAuth, (req, res) => {
  db.prepare('DELETE FROM niveles WHERE id = ?').run(req.params.nid)
  res.json({ ok: true })
})

module.exports = router
