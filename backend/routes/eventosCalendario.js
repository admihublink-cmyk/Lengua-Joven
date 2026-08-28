const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const ROLES_ADMIN = ['superadmin', 'director', 'coordinador']

router.get('/', requireAuth, async (req, res) => {
  try {
    const me = req.user
    let rows
    if (me.rol === 'superadmin') {
      rows = await query(`SELECT * FROM eventos_calendario WHERE activo = 1 ORDER BY fecha_inicio ASC`, [])
    } else {
      // Cada rol ve los eventos de su plantel + los globales (plantel_id IS NULL)
      rows = await query(
        `SELECT * FROM eventos_calendario WHERE activo = 1 AND (plantel_id IS NULL OR plantel_id = $1) ORDER BY fecha_inicio ASC`,
        [me.plantel_id]
      )
    }
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', requireAuth, async (req, res) => {
  if (!ROLES_ADMIN.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { titulo, descripcion, tipo, fecha_inicio, fecha_fin, plantel_id } = req.body
  if (!titulo || !fecha_inicio) {
    return res.status(400).json({ error: 'titulo y fecha_inicio son requeridos' })
  }
  if (fecha_fin && fecha_fin < fecha_inicio) {
    return res.status(400).json({ error: 'fecha_fin debe ser mayor o igual a fecha_inicio' })
  }

  // Superadmin puede crear eventos globales (sin plantel) o para un plantel específico.
  // Director/coordinador siempre crean para su propio plantel.
  const pid = req.user.rol === 'superadmin' ? (plantel_id || null) : req.user.plantel_id

  const { m } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)), 0) AS m FROM eventos_calendario WHERE id ~ '^ec[0-9]+'`,
    []
  )
  const newId = 'ec' + (m + 1)
  await run(
    `INSERT INTO eventos_calendario (id, titulo, descripcion, tipo, fecha_inicio, fecha_fin, plantel_id, creado_por, activo, creado_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9)`,
    [newId, titulo, descripcion || null, tipo || 'general', fecha_inicio, fecha_fin || null, pid, req.user.id, new Date().toISOString()]
  )
  res.status(201).json(await queryOne('SELECT * FROM eventos_calendario WHERE id = $1', [newId]))
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!ROLES_ADMIN.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const evento = await queryOne('SELECT * FROM eventos_calendario WHERE id = $1', [req.params.id])
  if (!evento) return res.status(404).json({ error: 'No encontrado' })
  // Director/coordinador solo pueden editar eventos de su propio plantel
  if (req.user.rol !== 'superadmin' && evento.plantel_id !== req.user.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para este evento' })
  }
  const { titulo, descripcion, tipo, fecha_inicio, fecha_fin } = req.body
  if (fecha_fin && fecha_inicio && fecha_fin < fecha_inicio) {
    return res.status(400).json({ error: 'fecha_fin debe ser mayor o igual a fecha_inicio' })
  }
  const sets = []; const vals = []
  const add = (col, val) => { sets.push(`${col} = $${sets.length + 1}`); vals.push(val) }
  if (titulo !== undefined) add('titulo', titulo)
  if (descripcion !== undefined) add('descripcion', descripcion || null)
  if (tipo !== undefined) add('tipo', tipo)
  if (fecha_inicio !== undefined) add('fecha_inicio', fecha_inicio)
  if ('fecha_fin' in req.body) add('fecha_fin', fecha_fin || null)
  if (sets.length) {
    await run(`UPDATE eventos_calendario SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  }
  res.json(await queryOne('SELECT * FROM eventos_calendario WHERE id = $1', [req.params.id]))
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!ROLES_ADMIN.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const evento = await queryOne('SELECT * FROM eventos_calendario WHERE id = $1', [req.params.id])
  if (!evento) return res.status(404).json({ error: 'No encontrado' })
  if (req.user.rol !== 'superadmin' && evento.plantel_id !== req.user.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para este evento' })
  }
  await run('UPDATE eventos_calendario SET activo = 0 WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
