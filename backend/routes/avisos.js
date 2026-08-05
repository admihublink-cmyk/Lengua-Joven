const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'superadmin') {
    rows = db.prepare('SELECT * FROM avisos WHERE activo = 1 ORDER BY fecha DESC').all()
  } else if (me.plantel_id) {
    rows = db.prepare(`
      SELECT * FROM avisos
      WHERE activo = 1 AND (plantel_id IS NULL OR plantel_id = ?)
      ORDER BY fecha DESC
    `).all(me.plantel_id)
  } else {
    rows = db.prepare('SELECT * FROM avisos WHERE activo = 1 AND plantel_id IS NULL ORDER BY fecha DESC').all()
  }
  res.json(rows)
})

router.post('/', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'profesor'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { titulo, contenido, plantel_id, grupo_id } = req.body
  const ids = db.prepare('SELECT id FROM avisos').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('av', '')) || 0), 0)
  const newId = 'av' + (max + 1)
  const fecha = new Date().toISOString().split('T')[0]
  const pid = req.user.rol === 'superadmin' ? (plantel_id || null) : req.user.plantel_id
  db.prepare('INSERT INTO avisos VALUES (?,?,?,?,?,?,?,?)').run(
    newId, titulo, contenido, pid, grupo_id || null, req.user.id, fecha, 1
  )
  res.status(201).json(db.prepare('SELECT * FROM avisos WHERE id = ?').get(newId))
})

router.put('/:id', requireAuth, (req, res) => {
  const { titulo, contenido, activo } = req.body
  const sets = []; const vals = []
  if (titulo !== undefined) { sets.push('titulo = ?'); vals.push(titulo) }
  if (contenido !== undefined) { sets.push('contenido = ?'); vals.push(contenido) }
  if (activo !== undefined) { sets.push('activo = ?'); vals.push(activo ? 1 : 0) }
  if (sets.length) db.prepare(`UPDATE avisos SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM avisos WHERE id = ?').get(req.params.id))
})

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE avisos SET activo = 0 WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
