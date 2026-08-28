const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const ROLES_GESTIONAR = ['superadmin', 'director', 'coordinador']
const ESTADOS_VALIDOS = ['pendiente', 'en_proceso', 'resuelto', 'cancelado']

router.get('/', requireAuth, async (req, res) => {
  try {
    const me = req.user
    let rows
    if (me.rol === 'superadmin') {
      rows = await query(
        `SELECT sc.*, i.folio, i.grupo_id, u.nombre AS alumno_nombre
         FROM solicitudes_cambio sc
         LEFT JOIN inscripciones i ON i.id = sc.inscripcion_id
         LEFT JOIN usuarios u ON u.id = sc.alumno_id
         ORDER BY sc.creado_en DESC`,
        []
      )
    } else {
      rows = await query(
        `SELECT sc.*, i.folio, i.grupo_id, u.nombre AS alumno_nombre
         FROM solicitudes_cambio sc
         LEFT JOIN inscripciones i ON i.id = sc.inscripcion_id
         LEFT JOIN usuarios u ON u.id = sc.alumno_id
         WHERE sc.plantel_id = $1
         ORDER BY sc.creado_en DESC`,
        [me.plantel_id]
      )
    }
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Obtener solicitud de una inscripción específica
router.get('/inscripcion/:inscripcion_id', requireAuth, async (req, res) => {
  try {
    const row = await queryOne(
      'SELECT * FROM solicitudes_cambio WHERE inscripcion_id = $1',
      [req.params.inscripcion_id]
    )
    res.json(row || null)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Crear o actualizar (upsert por inscripcion_id)
router.post('/', requireAuth, async (req, res) => {
  if (!ROLES_GESTIONAR.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { inscripcion_id, alumno_id, tipo, nivel_deseado, horario_preferido, notas } = req.body
  if (!inscripcion_id || !alumno_id || !tipo) {
    return res.status(400).json({ error: 'inscripcion_id, alumno_id y tipo son requeridos' })
  }

  const ins = await queryOne('SELECT plantel_id FROM inscripciones WHERE id = $1', [inscripcion_id])
  if (!ins) return res.status(404).json({ error: 'Inscripción no encontrada' })
  const plantel_id = ins.plantel_id || req.user.plantel_id

  const existe = await queryOne('SELECT id FROM solicitudes_cambio WHERE inscripcion_id = $1', [inscripcion_id])
  const ahora = new Date().toISOString()

  if (existe) {
    await run(
      `UPDATE solicitudes_cambio SET tipo=$1, nivel_deseado=$2, horario_preferido=$3, notas=$4, estado='pendiente', actualizado_en=$5 WHERE id=$6`,
      [tipo, nivel_deseado || null, horario_preferido || null, notas || null, ahora, existe.id]
    )
    res.json(await queryOne('SELECT * FROM solicitudes_cambio WHERE id = $1', [existe.id]))
  } else {
    const { m } = await queryOne(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)), 0) AS m FROM solicitudes_cambio WHERE id ~ '^sc[0-9]+'`,
      []
    )
    const newId = 'sc' + (m + 1)
    await run(
      `INSERT INTO solicitudes_cambio (id, inscripcion_id, alumno_id, plantel_id, tipo, nivel_deseado, horario_preferido, notas, estado, creado_por, creado_en, actualizado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente',$9,$10,$10)`,
      [newId, inscripcion_id, alumno_id, plantel_id, tipo, nivel_deseado || null, horario_preferido || null, notas || null, req.user.id, ahora]
    )
    res.status(201).json(await queryOne('SELECT * FROM solicitudes_cambio WHERE id = $1', [newId]))
  }
})

router.patch('/:id/estado', requireAuth, async (req, res) => {
  if (!ROLES_GESTIONAR.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { estado } = req.body
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' })
  }
  const sc = await queryOne('SELECT * FROM solicitudes_cambio WHERE id = $1', [req.params.id])
  if (!sc) return res.status(404).json({ error: 'No encontrado' })
  if (req.user.rol !== 'superadmin' && sc.plantel_id !== req.user.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para esta solicitud' })
  }
  await run(
    'UPDATE solicitudes_cambio SET estado = $1, actualizado_en = $2 WHERE id = $3',
    [estado, new Date().toISOString(), req.params.id]
  )
  res.json(await queryOne('SELECT * FROM solicitudes_cambio WHERE id = $1', [req.params.id]))
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!ROLES_GESTIONAR.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const sc = await queryOne('SELECT * FROM solicitudes_cambio WHERE id = $1', [req.params.id])
  if (!sc) return res.status(404).json({ error: 'No encontrado' })
  if (req.user.rol !== 'superadmin' && sc.plantel_id !== req.user.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para esta solicitud' })
  }
  await run('DELETE FROM solicitudes_cambio WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
