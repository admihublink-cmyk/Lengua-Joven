const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'superadmin') {
    rows = await query('SELECT * FROM avisos WHERE activo = 1 ORDER BY fecha DESC', [])
  } else if (me.plantel_id) {
    rows = await query(`
      SELECT * FROM avisos
      WHERE activo = 1 AND (plantel_id IS NULL OR plantel_id = $1)
      ORDER BY fecha DESC
    `, [me.plantel_id])
  } else {
    rows = await query('SELECT * FROM avisos WHERE activo = 1 AND plantel_id IS NULL ORDER BY fecha DESC', [])
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
  const fecha = new Date().toISOString().split('T')[0]
  const pid = req.user.rol === 'superadmin' ? (plantel_id || null) : req.user.plantel_id
  await run('INSERT INTO avisos (id, titulo, contenido, plantel_id, grupo_id, creado_por, fecha, activo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
    newId, titulo, contenido, pid, grupo_id || null, req.user.id, fecha, 1
  ])
  res.status(201).json(await queryOne('SELECT * FROM avisos WHERE id = $1', [newId]))
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
  if (sets.length) await run(`UPDATE avisos SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  res.json(await queryOne('SELECT * FROM avisos WHERE id = $1', [req.params.id]))
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
