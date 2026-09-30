const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const { puedeOperarEnPlantel } = require('../utils/planteles')

const TIPOS_VALIDOS = ['normal', 'reinscripcion', 'extemporanea', 'penalizacion']
const ROLES_ADMIN = ['superadmin', 'coordinador', 'director']

// GET /api/reglas?plantel_id=&idioma_id=&tipo=
router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  const { plantel_id, idioma_id, tipo } = req.query

  let sql = 'SELECT r.*, p.nombre AS plantel_nombre, i.nombre AS idioma_nombre FROM reglas r LEFT JOIN planteles p ON p.id = r.plantel_id LEFT JOIN idiomas i ON i.id = r.idioma_id WHERE r.activo = 1'
  const vals = []

  if (me.rol === 'superadmin') {
    if (plantel_id) { sql += ` AND r.plantel_id = $${vals.length + 1}`; vals.push(plantel_id) }
  } else if (me.rol === 'coordinador') {
    const ids = me.planteles || []
    if (ids.length === 0) return res.json([])
    const phs = ids.map((_, i) => `$${vals.length + i + 1}`).join(',')
    sql += ` AND r.plantel_id IN (${phs})`
    vals.push(...ids)
  } else if (me.plantel_id) {
    sql += ` AND r.plantel_id = $${vals.length + 1}`
    vals.push(me.plantel_id)
  } else {
    return res.json([])
  }

  if (idioma_id) { sql += ` AND r.idioma_id = $${vals.length + 1}`; vals.push(idioma_id) }
  if (tipo) { sql += ` AND r.tipo = $${vals.length + 1}`; vals.push(tipo) }

  sql += ' ORDER BY r.tipo, r.plantel_id'
  res.json(await query(sql, vals))
})

// GET /api/reglas/:id
router.get('/:id', requireAuth, async (req, res) => {
  const r = await queryOne('SELECT * FROM reglas WHERE id = $1', [req.params.id])
  if (!r) return res.status(404).json({ error: 'Regla no encontrada' })
  if (req.user.rol !== 'superadmin' && !puedeOperarEnPlantel(req.user, r.plantel_id)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  res.json(r)
})

// POST /api/reglas
router.post('/', requireAuth, async (req, res) => {
  const me = req.user
  if (!ROLES_ADMIN.includes(me.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const { plantel_id, idioma_id, tipo, fecha_limite, porcentaje_penalizacion, monto_extra } = req.body
  if (!plantel_id || !tipo) return res.status(400).json({ error: 'plantel_id y tipo son requeridos' })
  if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: `tipo inválido. Valores: ${TIPOS_VALIDOS.join(', ')}` })
  if (!puedeOperarEnPlantel(me, plantel_id)) return res.status(403).json({ error: 'Sin permiso para ese plantel' })

  const { m } = await queryOne(`SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 2) AS INTEGER)), 0) AS m FROM reglas WHERE id ~ '^r[0-9]+'`)
  const newId = 'r' + (m + 1)

  await run(
    `INSERT INTO reglas (id, plantel_id, idioma_id, tipo, fecha_limite, porcentaje_penalizacion, monto_extra, activo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,1)`,
    [newId, plantel_id, idioma_id || null, tipo, fecha_limite || null,
     parseFloat(porcentaje_penalizacion) || 0, parseFloat(monto_extra) || 0]
  )
  res.status(201).json(await queryOne('SELECT * FROM reglas WHERE id = $1', [newId]))
})

// PUT /api/reglas/:id
router.put('/:id', requireAuth, async (req, res) => {
  const me = req.user
  if (!ROLES_ADMIN.includes(me.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const regla = await queryOne('SELECT * FROM reglas WHERE id = $1', [req.params.id])
  if (!regla) return res.status(404).json({ error: 'Regla no encontrada' })
  if (!puedeOperarEnPlantel(me, regla.plantel_id)) return res.status(403).json({ error: 'Sin permiso' })

  const { tipo, fecha_limite, porcentaje_penalizacion, monto_extra, idioma_id } = req.body
  if (tipo && !TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'tipo inválido' })

  const sets = []; const vals = []
  if (tipo !== undefined)                   { sets.push(`tipo = $${sets.length + 1}`);                   vals.push(tipo) }
  if (fecha_limite !== undefined)           { sets.push(`fecha_limite = $${sets.length + 1}`);           vals.push(fecha_limite || null) }
  if (porcentaje_penalizacion !== undefined){ sets.push(`porcentaje_penalizacion = $${sets.length + 1}`);vals.push(parseFloat(porcentaje_penalizacion) || 0) }
  if (monto_extra !== undefined)            { sets.push(`monto_extra = $${sets.length + 1}`);            vals.push(parseFloat(monto_extra) || 0) }
  if (idioma_id !== undefined)              { sets.push(`idioma_id = $${sets.length + 1}`);              vals.push(idioma_id || null) }

  if (sets.length) await run(`UPDATE reglas SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  res.json(await queryOne('SELECT * FROM reglas WHERE id = $1', [req.params.id]))
})

// DELETE /api/reglas/:id (soft delete)
router.delete('/:id', requireAuth, async (req, res) => {
  const me = req.user
  if (!ROLES_ADMIN.includes(me.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const regla = await queryOne('SELECT * FROM reglas WHERE id = $1', [req.params.id])
  if (!regla) return res.status(404).json({ error: 'No encontrada' })
  if (!puedeOperarEnPlantel(me, regla.plantel_id)) return res.status(403).json({ error: 'Sin permiso' })

  await run('UPDATE reglas SET activo = 0 WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
