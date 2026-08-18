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
  const ids = (await query('SELECT id FROM avisos', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('av', '')) || 0), 0)
  const newId = 'av' + (max + 1)
  const fecha = new Date().toISOString().split('T')[0]
  const pid = req.user.rol === 'superadmin' ? (plantel_id || null) : req.user.plantel_id
  await run('INSERT INTO avisos VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
    newId, titulo, contenido, pid, grupo_id || null, req.user.id, fecha, 1
  ])
  res.status(201).json(await queryOne('SELECT * FROM avisos WHERE id = $1', [newId]))
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'profesor'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
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
  if (!['superadmin', 'director', 'coordinador', 'profesor'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  await run('UPDATE avisos SET activo = 0 WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
