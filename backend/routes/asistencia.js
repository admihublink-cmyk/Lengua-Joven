const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const { grupo_id, alumno_id, fecha } = req.query
  let sql = 'SELECT * FROM asistencias WHERE 1=1'
  const vals = []
  if (grupo_id) { sql += ' AND grupo_id = ?'; vals.push(grupo_id) }
  if (alumno_id) { sql += ' AND alumno_id = ?'; vals.push(alumno_id) }
  if (fecha) { sql += ' AND fecha = ?'; vals.push(fecha) }
  sql += ' ORDER BY fecha DESC'
  res.json(db.prepare(sql).all(...vals))
})

router.post('/', requireAuth, (req, res) => {
  const registros = Array.isArray(req.body) ? req.body : [req.body]
  const insert = db.prepare('INSERT OR REPLACE INTO asistencias (id, grupo_id, alumno_id, fecha, presente, registrado_por) VALUES (?,?,?,?,?,?)')
  const ids = db.prepare('SELECT id FROM asistencias').all().map(r => r.id)
  let max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('a', '')) || 0), 0)
  const results = []
  for (const r of registros) {
    max++
    const newId = 'a' + max
    insert.run(newId, r.grupo_id, r.alumno_id, r.fecha, r.presente ? 1 : 0, req.user.id)
    results.push({ id: newId, ...r })
  }
  res.status(201).json(results)
})

router.put('/:id', requireAuth, (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  db.prepare('UPDATE asistencias SET presente = ? WHERE id = ?').run(req.body.presente ? 1 : 0, req.params.id)
  res.json(db.prepare('SELECT * FROM asistencias WHERE id = ?').get(req.params.id))
})

// Sesiones programadas
router.get('/sesiones', requireAuth, (req, res) => {
  const { grupo_id } = req.query
  if (!grupo_id) return res.json(db.prepare('SELECT * FROM sesiones').all())
  res.json(db.prepare('SELECT * FROM sesiones WHERE grupo_id = ?').all(grupo_id))
})

router.post('/sesiones', requireAuth, (req, res) => {
  const ids = db.prepare('SELECT id FROM sesiones').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('s', '')) || 0), 0)
  const newId = 's' + (max + 1)
  const { grupo_id, titulo, tipo, fecha, hora_inicio, hora_fin, dia_semana, fecha_inicio, fecha_fin } = req.body
  db.prepare('INSERT INTO sesiones VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    newId, grupo_id, titulo, tipo, fecha || null, hora_inicio, hora_fin, 1,
    dia_semana ?? null, fecha_inicio || null, fecha_fin || null
  )
  res.status(201).json(db.prepare('SELECT * FROM sesiones WHERE id = ?').get(newId))
})

router.get('/sesiones/:id/asistencia', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM asistencias_sesion WHERE sesion_id = ?').all(req.params.id))
})

router.post('/sesiones/:id/asistencia', requireAuth, (req, res) => {
  const registros = Array.isArray(req.body) ? req.body : [req.body]
  const insert = db.prepare('INSERT OR REPLACE INTO asistencias_sesion (id, sesion_id, alumno_id, presente, registrado_por) VALUES (?,?,?,?,?)')
  const ids = db.prepare('SELECT id FROM asistencias_sesion').all().map(r => r.id)
  let max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('as', '')) || 0), 0)
  for (const r of registros) {
    max++
    insert.run('as' + max, req.params.id, r.alumno_id, r.presente ? 1 : 0, req.user.id)
  }
  res.status(201).json({ ok: true })
})

module.exports = router
