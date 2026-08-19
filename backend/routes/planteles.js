const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth, puedeVerPlantel } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  if (['superadmin', 'coordinador'].includes(me.rol)) {
    res.json(await query('SELECT * FROM planteles ORDER BY nombre', []))
  } else if (me.plantel_id) {
    res.json(await query('SELECT * FROM planteles WHERE id = $1', [me.plantel_id]))
  } else {
    res.json([])
  }
})

router.get('/:id', requireAuth, async (req, res) => {
  const p = await queryOne('SELECT * FROM planteles WHERE id = $1', [req.params.id])
  if (!p) return res.status(404).json({ error: 'No encontrado' })
  if (!puedeVerPlantel(req.user, p.id)) return res.status(403).json({ error: 'Sin permiso' })
  res.json(p)
})

router.post('/', requireAuth, async (req, res) => {
  if (!['superadmin', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { nombre, ciudad, convenio_vencimiento } = req.body
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' })
  const { m: maxNum } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 2) AS INTEGER)), 0) AS m FROM planteles WHERE id ~ '^p[0-9]+'`, []
  )
  const newId = 'p' + (maxNum + 1)
  await run('INSERT INTO planteles (id, nombre, ciudad, convenio_vencimiento, convenio_notificado) VALUES ($1,$2,$3,$4,$5)', [newId, nombre.trim(), ciudad || '', convenio_vencimiento || '', 0])
  // Si es coordinador, asignarlo automáticamente al nuevo plantel
  if (req.user.rol === 'coordinador') {
    await run('INSERT INTO coordinador_planteles (coordinador_id, plantel_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, newId])
  }
  res.status(201).json(await queryOne('SELECT * FROM planteles WHERE id = $1', [newId]))
})

// Coordinador asignado a un plantel (para el botón "COORDINADOR" del director)
router.get('/:id/coordinador', requireAuth, async (req, res) => {
  if (!puedeVerPlantel(req.user, req.params.id)) return res.status(403).json({ error: 'Sin permiso' })
  const row = await queryOne(`
    SELECT u.id, u.nombre, u.email, u.rol FROM coordinador_planteles cp
    JOIN usuarios u ON u.id = cp.coordinador_id
    WHERE cp.plantel_id = $1 LIMIT 1
  `, [req.params.id])
  if (!row) return res.status(404).json({ error: 'Sin coordinador asignado' })
  res.json(row)
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  if (!puedeVerPlantel(req.user, req.params.id)) return res.status(403).json({ error: 'Sin permiso' })
  const campos = ['nombre', 'ciudad', 'convenio_vencimiento', 'convenio_notificado',
    'razon_social', 'representante_legal', 'rfc', 'domicilio_fiscal', 'tipo_persona', 'proveedor_nombre']
  const sets = [], vals = []
  for (const c of campos) {
    if (req.body[c] !== undefined) {
      sets.push(`${c} = $${sets.length + 1}`)
      vals.push(c === 'convenio_notificado' ? (req.body[c] ? 1 : 0) : req.body[c])
    }
  }
  if (sets.length) await run(`UPDATE planteles SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  res.json(await queryOne('SELECT * FROM planteles WHERE id = $1', [req.params.id]))
})

module.exports = router
