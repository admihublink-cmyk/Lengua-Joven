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
  const { m: maxNum } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 2) AS INTEGER)), 0) AS m FROM evaluaciones WHERE id ~ '^e[0-9]+'`, []
  )
  const newId = 'e' + (maxNum + 1)
  await run(
    'INSERT INTO evaluaciones (id, alumno_id, grupo_id, tipo, calificacion, fecha, registrado_por, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [newId, alumno_id, grupo_id, tipo, parseFloat(calificacion),
     fecha || new Date().toISOString().split('T')[0], req.user.id, observaciones || '']
  )
  res.status(201).json(await queryOne('SELECT * FROM evaluaciones WHERE id = $1', [newId]))
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  if (req.user.rol === 'profesor') {
    const ev = await queryOne('SELECT grupo_id FROM evaluaciones WHERE id = $1', [req.params.id])
    if (!ev) return res.status(404).json({ error: 'No encontrado' })
    const grupo = await queryOne('SELECT profesor_id FROM grupos WHERE id = $1', [ev.grupo_id])
    if (!grupo || grupo.profesor_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo puedes editar evaluaciones de tus grupos' })
    }
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
  if (req.user.rol === 'profesor') {
    const ev = await queryOne('SELECT grupo_id FROM evaluaciones WHERE id = $1', [req.params.id])
    if (!ev) return res.status(404).json({ error: 'No encontrado' })
    const grupo = await queryOne('SELECT profesor_id FROM grupos WHERE id = $1', [ev.grupo_id])
    if (!grupo || grupo.profesor_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo puedes eliminar evaluaciones de tus grupos' })
    }
  }
  await run('DELETE FROM evaluaciones WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// Placements
router.get('/placements', requireAuth, async (req, res) => {
  const me = req.user
  const { alumno_id } = req.query
  // Alumnos solo ven su propio placement
  if (me.rol === 'alumno') {
    return res.json(await query('SELECT * FROM placements WHERE alumno_id = $1', [me.id]))
  }
  // Tutores solo ven los de sus alumnos
  if (me.rol === 'tutor') {
    const alumnos = me.alumnos || []
    if (alumnos.length === 0) return res.json([])
    const phs = alumnos.map((_, i) => `$${i + 1}`).join(',')
    return res.json(await query(`SELECT * FROM placements WHERE alumno_id IN (${phs})`, alumnos))
  }
  // Roles con acceso completo pueden filtrar por alumno_id
  if (alumno_id) return res.json(await query('SELECT * FROM placements WHERE alumno_id = $1', [alumno_id]))
  res.json(await query('SELECT * FROM placements', []))
})

router.post('/placements', requireAuth, async (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { alumno_id, nivel_sugerido, calificacion, notas } = req.body
  const { m: maxNum } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)), 0) AS m FROM placements WHERE id ~ '^pl[0-9]+'`, []
  )
  const newId = 'pl' + (maxNum + 1)
  const fecha = new Date().toISOString().split('T')[0]
  await run(
    'INSERT INTO placements (id, alumno_id, nivel_sugerido, calificacion, fecha, aplicado_por, notas) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [newId, alumno_id, nivel_sugerido, parseFloat(calificacion), fecha, req.user.id, notas || '']
  )
  res.status(201).json(await queryOne('SELECT * FROM placements WHERE id = $1', [newId]))
})

module.exports = router
