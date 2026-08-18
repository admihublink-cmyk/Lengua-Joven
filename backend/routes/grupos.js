const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const { enviarNotificacionApertura } = require('../services/email')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'superadmin') {
    rows = await query('SELECT * FROM grupos ORDER BY codigo', [])
  } else if (me.rol === 'profesor') {
    rows = await query('SELECT * FROM grupos WHERE plantel_id = $1 AND profesor_id = $2 ORDER BY codigo', [me.plantel_id, me.id])
  } else if (me.rol === 'coordinador') {
    // Incluye todos los planteles asignados al coordinador
    const asignados = (await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [me.id])).map(r => r.plantel_id)
    if (me.plantel_id && !asignados.includes(me.plantel_id)) asignados.push(me.plantel_id)
    if (asignados.length === 0) { rows = [] }
    else {
      const placeholders = asignados.map((_, i) => `$${i + 1}`).join(',')
      rows = await query(`SELECT * FROM grupos WHERE plantel_id IN (${placeholders}) ORDER BY codigo`, asignados)
    }
  } else if (me.plantel_id) {
    rows = await query('SELECT * FROM grupos WHERE plantel_id = $1 ORDER BY codigo', [me.plantel_id])
  } else {
    rows = []
  }
  res.json(rows)
})

router.get('/:id', requireAuth, async (req, res) => {
  const g = await queryOne('SELECT * FROM grupos WHERE id = $1', [req.params.id])
  if (!g) return res.status(404).json({ error: 'No encontrado' })
  res.json(g)
})

router.post('/', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { idioma_id, nivel_id, plantel_id, profesor_id, codigo, horario, cupo, activo,
    fecha_inicio_inscripciones, fecha_fin_inscripciones, fecha_inicio_clases, fecha_fin_clases } = req.body
  const ids = (await query('SELECT id FROM grupos', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('g', '')) || 0), 0)
  const newId = 'g' + (max + 1)
  // Superadmin elige libremente; coordinador y director usan el plantel del form
  // (validado contra su plantel asignado para evitar escalada de privilegios)
  const pid = req.user.rol === 'superadmin'
    ? plantel_id
    : plantel_id || req.user.plantel_id
  if (req.user.rol === 'director' && pid !== req.user.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para ese plantel' })
  }
  if (req.user.rol === 'coordinador') {
    const asignados = (await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [req.user.id])).map(r => r.plantel_id)
    const plantelValido = asignados.includes(pid) || req.user.plantel_id === pid
    if (!plantelValido) return res.status(403).json({ error: 'Sin permiso para ese plantel' })
  }
  await run(`INSERT INTO grupos VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
    newId, idioma_id, nivel_id, pid, profesor_id || null, codigo, horario,
    cupo || 20, activo !== false ? 1 : 0,
    fecha_inicio_inscripciones || '', fecha_fin_inscripciones || '',
    fecha_inicio_clases || '', fecha_fin_clases || ''
  ])
  const grupoCreado = await queryOne('SELECT * FROM grupos WHERE id = $1', [newId])

  // Notificar suscriptores interesados en este idioma + plantel
  setImmediate(async () => {
    try {
      const idiomaNombre = (await queryOne('SELECT nombre FROM idiomas WHERE id = $1', [idioma_id]))?.nombre
      const plantelNombre = (await queryOne('SELECT nombre FROM planteles WHERE id = $1', [pid]))?.nombre
      if (!idiomaNombre || !plantelNombre) return
      const nivelNombre = nivel_id ? (await queryOne('SELECT nombre FROM niveles WHERE id = $1', [nivel_id]))?.nombre : null
      const cupoDisponible = Math.max(0, (cupo || 20))
      const grupoInfo = { nivel_nombre: nivelNombre, horario, cupo_disponible: cupoDisponible }
      const subs = await query(`
        SELECT * FROM suscripciones_apertura
        WHERE notificado = 0
          AND (idioma = '' OR idioma = $1)
          AND (plantel_nombre = '' OR plantel_nombre = $2)
      `, [idiomaNombre, plantelNombre])
      for (const sub of subs) {
        try {
          await enviarNotificacionApertura(sub.email, sub.nombre, idiomaNombre, plantelNombre, grupoInfo)
          await run('UPDATE suscripciones_apertura SET notificado = 1 WHERE id = $1', [sub.id])
        } catch (_) {}
      }
    } catch (_) {}
  })

  res.status(201).json(grupoCreado)
})

router.put('/:id', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador'].includes(me.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const grupo = await queryOne('SELECT * FROM grupos WHERE id = $1', [req.params.id])
  if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' })

  if (me.rol === 'director' && grupo.plantel_id !== me.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para este plantel' })
  }
  if (me.rol === 'coordinador') {
    const asignados = (await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [me.id])).map(r => r.plantel_id)
    if (!asignados.includes(grupo.plantel_id)) return res.status(403).json({ error: 'Sin permiso para este plantel' })
  }

  const fields = ['idioma_id','nivel_id','plantel_id','profesor_id','codigo','horario','cupo','activo',
    'fecha_inicio_inscripciones','fecha_fin_inscripciones','fecha_inicio_clases','fecha_fin_clases']
  const sets = []; const vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = $${sets.length + 1}`)
      vals.push(f === 'activo' ? (req.body[f] ? 1 : 0) : (req.body[f] ?? null))
    }
  }
  if (sets.length) await run(`UPDATE grupos SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  res.json(await queryOne('SELECT * FROM grupos WHERE id = $1', [req.params.id]))
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  await run('UPDATE grupos SET activo = 0 WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// Alumnos del grupo
router.get('/:id/alumnos', requireAuth, async (req, res) => {
  const alumnos = await query(`
    SELECT u.id, u.nombre, u.email, u.matricula, i.estado, i.id as inscripcion_id, i.folio
    FROM inscripciones i
    JOIN usuarios u ON u.id = i.alumno_id
    WHERE i.grupo_id = $1 AND i.alumno_id IS NOT NULL
  `, [req.params.id])
  res.json(alumnos)
})

module.exports = router
