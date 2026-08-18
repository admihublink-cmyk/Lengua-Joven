const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  const { grupo_id, alumno_id, fecha } = req.query
  let sql = 'SELECT * FROM asistencias WHERE 1=1'
  const vals = []
  // Alumnos solo ven su propia asistencia
  if (me.rol === 'alumno') {
    sql += ` AND alumno_id = $${vals.length + 1}`; vals.push(me.id)
  } else if (me.rol === 'tutor') {
    const alumnos = me.alumnos || []
    if (alumnos.length === 0) return res.json([])
    sql += ` AND alumno_id IN (${alumnos.map((_, i) => `$${i + 1}`).join(',')})`
    vals.push(...alumnos)
  } else {
    if (grupo_id) { sql += ` AND grupo_id = $${vals.length + 1}`; vals.push(grupo_id) }
    if (alumno_id) { sql += ` AND alumno_id = $${vals.length + 1}`; vals.push(alumno_id) }
  }
  if (fecha) { sql += ` AND fecha = $${vals.length + 1}`; vals.push(fecha) }
  sql += ' ORDER BY fecha DESC'
  res.json(await query(sql, vals))
})

router.post('/', requireAuth, async (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const registros = Array.isArray(req.body) ? req.body : [req.body]
  const ids = (await query('SELECT id FROM asistencias', [])).map(r => r.id)
  let max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('a', '')) || 0), 0)
  const results = []
  for (const r of registros) {
    max++
    const newId = 'a' + max
    await run('INSERT INTO asistencias (id, grupo_id, alumno_id, fecha, presente, registrado_por) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (grupo_id, alumno_id, fecha) DO UPDATE SET presente=EXCLUDED.presente, registrado_por=EXCLUDED.registrado_por',
      [newId, r.grupo_id, r.alumno_id, r.fecha, r.presente ? 1 : 0, req.user.id])
    results.push({ id: newId, ...r })
  }
  res.status(201).json(results)
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  await run('UPDATE asistencias SET presente = $1 WHERE id = $2', [req.body.presente ? 1 : 0, req.params.id])
  res.json(await queryOne('SELECT * FROM asistencias WHERE id = $1', [req.params.id]))
})

// Sesiones programadas
router.get('/sesiones', requireAuth, async (req, res) => {
  const { grupo_id } = req.query
  if (!grupo_id) return res.json(await query('SELECT * FROM sesiones', []))
  res.json(await query('SELECT * FROM sesiones WHERE grupo_id = $1', [grupo_id]))
})

router.post('/sesiones', requireAuth, async (req, res) => {
  const ids = (await query('SELECT id FROM sesiones', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('s', '')) || 0), 0)
  const newId = 's' + (max + 1)
  const { grupo_id, titulo, tipo, fecha, hora_inicio, hora_fin, dia_semana, fecha_inicio, fecha_fin } = req.body
  await run('INSERT INTO sesiones VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
    newId, grupo_id, titulo, tipo, fecha || null, hora_inicio, hora_fin, 1,
    dia_semana ?? null, fecha_inicio || null, fecha_fin || null
  ])
  res.status(201).json(await queryOne('SELECT * FROM sesiones WHERE id = $1', [newId]))
})

router.get('/sesiones/:id/asistencia', requireAuth, async (req, res) => {
  res.json(await query('SELECT * FROM asistencias_sesion WHERE sesion_id = $1', [req.params.id]))
})

router.post('/sesiones/:id/asistencia', requireAuth, async (req, res) => {
  const registros = Array.isArray(req.body) ? req.body : [req.body]
  const ids = (await query('SELECT id FROM asistencias_sesion', [])).map(r => r.id)
  let max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('as', '')) || 0), 0)
  for (const r of registros) {
    max++
    await run('INSERT INTO asistencias_sesion (id, sesion_id, alumno_id, presente, registrado_por) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (sesion_id, alumno_id) DO UPDATE SET presente=EXCLUDED.presente, registrado_por=EXCLUDED.registrado_por',
      ['as' + max, req.params.id, r.alumno_id, r.presente ? 1 : 0, req.user.id])
  }
  res.status(201).json({ ok: true })
})

module.exports = router
