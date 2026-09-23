const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'superadmin') {
    rows = await query(`
      SELECT a.*, u.nombre AS autor_nombre
      FROM avisos a LEFT JOIN usuarios u ON u.id = a.creado_por
      WHERE a.activo = 1 ORDER BY COALESCE(a.creado_en, a.fecha) DESC
    `)
  } else if (me.plantel_id) {
    rows = await query(`
      SELECT a.*, u.nombre AS autor_nombre
      FROM avisos a LEFT JOIN usuarios u ON u.id = a.creado_por
      WHERE a.activo = 1 AND (a.plantel_id IS NULL OR a.plantel_id = $1)
      ORDER BY COALESCE(a.creado_en, a.fecha) DESC
    `, [me.plantel_id])
  } else {
    rows = await query(`
      SELECT a.*, u.nombre AS autor_nombre
      FROM avisos a LEFT JOIN usuarios u ON u.id = a.creado_por
      WHERE a.activo = 1 AND a.plantel_id IS NULL
      ORDER BY COALESCE(a.creado_en, a.fecha) DESC
    `)
  }
  res.json(rows)
})

router.post('/', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'profesor'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { titulo, contenido, plantel_id, grupo_id } = req.body
  const { m: maxNum } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)), 0) AS m FROM avisos WHERE id ~ '^av[0-9]+'`, []
  )
  const newId = 'av' + (maxNum + 1)
  const ahora = new Date().toISOString()
  const fecha = ahora.split('T')[0]
  const pid = req.user.rol === 'superadmin' ? (plantel_id || null) : req.user.plantel_id
  await run(
    'INSERT INTO avisos (id, titulo, contenido, plantel_id, grupo_id, creado_por, fecha, activo, creado_en) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [newId, titulo, contenido, pid, grupo_id || null, req.user.id, fecha, 1, ahora]
  )
  const aviso = await queryOne(`
    SELECT a.*, u.nombre AS autor_nombre
    FROM avisos a LEFT JOIN usuarios u ON u.id = a.creado_por
    WHERE a.id = $1
  `, [newId])
  res.status(201).json(aviso)
})

router.put('/:id', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'profesor'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const aviso = await queryOne('SELECT * FROM avisos WHERE id = $1', [req.params.id])
  if (!aviso) return res.status(404).json({ error: 'No encontrado' })
  if (me.rol === 'director' && aviso.plantel_id && aviso.plantel_id !== me.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para este plantel' })
  }
  if (me.rol === 'coordinador') {
    const asignados = (await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [me.id])).map(r => r.plantel_id)
    if (aviso.plantel_id && !asignados.includes(aviso.plantel_id) && aviso.plantel_id !== me.plantel_id) {
      return res.status(403).json({ error: 'Sin permiso para este plantel' })
    }
  }
  if (me.rol === 'profesor' && aviso.creado_por !== me.id) {
    return res.status(403).json({ error: 'Solo puedes editar tus propios avisos' })
  }
  const { titulo, contenido, activo } = req.body
  const sets = []; const vals = []
  if (titulo !== undefined) { sets.push(`titulo = $${sets.length + 1}`); vals.push(titulo) }
  if (contenido !== undefined) { sets.push(`contenido = $${sets.length + 1}`); vals.push(contenido) }
  if (activo !== undefined) { sets.push(`activo = $${sets.length + 1}`); vals.push(activo ? 1 : 0) }
  // Marcar como editado solo si se cambia contenido real (no solo archivar)
  if (titulo !== undefined || contenido !== undefined) {
    sets.push(`editado_en = $${sets.length + 1}`)
    vals.push(new Date().toISOString())
  }
  if (sets.length) await run(`UPDATE avisos SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  const updated = await queryOne(`
    SELECT a.*, u.nombre AS autor_nombre
    FROM avisos a LEFT JOIN usuarios u ON u.id = a.creado_por
    WHERE a.id = $1
  `, [req.params.id])
  res.json(updated)
})

router.delete('/:id', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'profesor'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const aviso = await queryOne('SELECT * FROM avisos WHERE id = $1', [req.params.id])
  if (!aviso) return res.status(404).json({ error: 'No encontrado' })
  if (me.rol === 'director' && aviso.plantel_id && aviso.plantel_id !== me.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para este plantel' })
  }
  if (me.rol === 'coordinador') {
    const asignados = (await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [me.id])).map(r => r.plantel_id)
    if (aviso.plantel_id && !asignados.includes(aviso.plantel_id) && aviso.plantel_id !== me.plantel_id) {
      return res.status(403).json({ error: 'Sin permiso para este plantel' })
    }
  }
  if (me.rol === 'profesor' && aviso.creado_por !== me.id) {
    return res.status(403).json({ error: 'Solo puedes eliminar tus propios avisos' })
  }
  await run('UPDATE avisos SET activo = 0 WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
