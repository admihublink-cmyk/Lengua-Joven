const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const { grupo_id, alumno_id } = req.query
  const me = req.user
  let sql = 'SELECT * FROM evaluaciones WHERE 1=1'
  const vals = []
  if (me.rol === 'alumno') {
    sql += ' AND alumno_id = ?'; vals.push(me.id)
  } else if (me.rol === 'tutor') {
    const alumnos = me.alumnos || []
    if (alumnos.length === 0) return res.json([])
    sql += ` AND alumno_id IN (${alumnos.map(() => '?').join(',')})`
    vals.push(...alumnos)
    if (alumno_id) { sql += ' AND alumno_id = ?'; vals.push(alumno_id) }
  } else {
    if (grupo_id) { sql += ' AND grupo_id = ?'; vals.push(grupo_id) }
    if (alumno_id) { sql += ' AND alumno_id = ?'; vals.push(alumno_id) }
  }
  res.json(db.prepare(sql).all(...vals))
})

router.post('/', requireAuth, (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { alumno_id, grupo_id, tipo, calificacion, observaciones, fecha } = req.body
  const ids = db.prepare('SELECT id FROM evaluaciones').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('e', '')) || 0), 0)
  const newId = 'e' + (max + 1)
  db.prepare('INSERT INTO evaluaciones VALUES (?,?,?,?,?,?,?,?)').run(
    newId, alumno_id, grupo_id, tipo, parseFloat(calificacion),
    fecha || new Date().toISOString().split('T')[0], req.user.id, observaciones || ''
  )
  res.status(201).json(db.prepare('SELECT * FROM evaluaciones WHERE id = ?').get(newId))
})

router.put('/:id', requireAuth, (req, res) => {
  const { calificacion, observaciones, tipo } = req.body
  db.prepare('UPDATE evaluaciones SET calificacion = ?, observaciones = ?, tipo = ? WHERE id = ?')
    .run(calificacion, observaciones, tipo, req.params.id)
  res.json(db.prepare('SELECT * FROM evaluaciones WHERE id = ?').get(req.params.id))
})

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM evaluaciones WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Placements
router.get('/placements', requireAuth, (req, res) => {
  const { alumno_id } = req.query
  if (alumno_id) return res.json(db.prepare('SELECT * FROM placements WHERE alumno_id = ?').all(alumno_id))
  res.json(db.prepare('SELECT * FROM placements').all())
})

router.post('/placements', requireAuth, (req, res) => {
  const { alumno_id, nivel_sugerido, calificacion, notas } = req.body
  const ids = db.prepare('SELECT id FROM placements').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('pl', '')) || 0), 0)
  const newId = 'pl' + (max + 1)
  const fecha = new Date().toISOString().split('T')[0]
  db.prepare('INSERT INTO placements VALUES (?,?,?,?,?,?,?)').run(
    newId, alumno_id, nivel_sugerido, parseFloat(calificacion), fecha, req.user.id, notas || ''
  )
  res.status(201).json(db.prepare('SELECT * FROM placements WHERE id = ?').get(newId))
})

module.exports = router
