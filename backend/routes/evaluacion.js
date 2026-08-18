const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const { grupo_id, alumno_id } = req.query
  const me = req.user
  let sql = 'SELECT * FROM evaluaciones WHERE 1=1'
  const vals = []
  if (me.rol === 'alumno') {
    sql += ` AND alumno_id = $${vals.length + 1}`; vals.push(me.id)
  } else if (me.rol === 'tutor') {
    const alumnos = me.alumnos || []
    if (alumnos.length === 0) return res.json([])
    const placeholders = alumnos.map((_, i) => `$${i + 1}`).join(',')
    sql += ` AND alumno_id IN (${placeholders})`
    vals.push(...alumnos)
    if (alumno_id) { sql += ` AND alumno_id = $${vals.length + 1}`; vals.push(alumno_id) }
  } else {
    if (grupo_id) { sql += ` AND grupo_id = $${vals.length + 1}`; vals.push(grupo_id) }
    if (alumno_id) { sql += ` AND alumno_id = $${vals.length + 1}`; vals.push(alumno_id) }
  }
  res.json(await query(sql, vals))
})

router.post('/', requireAuth, async (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { alumno_id, grupo_id, tipo, calificacion, observaciones, fecha } = req.body
  const ids = (await query('SELECT id FROM evaluaciones', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('e', '')) || 0), 0)
  const newId = 'e' + (max + 1)
  await run('INSERT INTO evaluaciones VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
    newId, alumno_id, grupo_id, tipo, parseFloat(calificacion),
    fecha || new Date().toISOString().split('T')[0], req.user.id, observaciones || ''
  ])
  res.status(201).json(await queryOne('SELECT * FROM evaluaciones WHERE id = $1', [newId]))
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { calificacion, observaciones, tipo } = req.body
  await run('UPDATE evaluaciones SET calificacion = $1, observaciones = $2, tipo = $3 WHERE id = $4',
    [calificacion, observaciones, tipo, req.params.id])
  res.json(await queryOne('SELECT * FROM evaluaciones WHERE id = $1', [req.params.id]))
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  await run('DELETE FROM evaluaciones WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// Placements
router.get('/placements', requireAuth, async (req, res) => {
  const { alumno_id } = req.query
  if (alumno_id) return res.json(await query('SELECT * FROM placements WHERE alumno_id = $1', [alumno_id]))
  res.json(await query('SELECT * FROM placements', []))
})

router.post('/placements', requireAuth, async (req, res) => {
  const { alumno_id, nivel_sugerido, calificacion, notas } = req.body
  const ids = (await query('SELECT id FROM placements', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('pl', '')) || 0), 0)
  const newId = 'pl' + (max + 1)
  const fecha = new Date().toISOString().split('T')[0]
  await run('INSERT INTO placements VALUES ($1,$2,$3,$4,$5,$6,$7)', [
    newId, alumno_id, nivel_sugerido, parseFloat(calificacion), fecha, req.user.id, notas || ''
  ])
  res.status(201).json(await queryOne('SELECT * FROM placements WHERE id = $1', [newId]))
})

module.exports = router
