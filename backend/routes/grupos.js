const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const { enviarNotificacionApertura } = require('../services/email')

router.get('/', requireAuth, (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'superadmin') {
    rows = db.prepare('SELECT * FROM grupos ORDER BY codigo').all()
  } else if (me.rol === 'profesor') {
    rows = db.prepare('SELECT * FROM grupos WHERE plantel_id = ? AND profesor_id = ? ORDER BY codigo').all(me.plantel_id, me.id)
  } else if (me.rol === 'coordinador') {
    // Incluye todos los planteles asignados al coordinador
    const asignados = db.prepare('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = ?').all(me.id).map(r => r.plantel_id)
    if (me.plantel_id && !asignados.includes(me.plantel_id)) asignados.push(me.plantel_id)
    if (asignados.length === 0) { rows = [] }
    else {
      const placeholders = asignados.map(() => '?').join(',')
      rows = db.prepare(`SELECT * FROM grupos WHERE plantel_id IN (${placeholders}) ORDER BY codigo`).all(...asignados)
    }
  } else if (me.plantel_id) {
    rows = db.prepare('SELECT * FROM grupos WHERE plantel_id = ? ORDER BY codigo').all(me.plantel_id)
  } else {
    rows = []
  }
  res.json(rows)
})

router.get('/:id', requireAuth, (req, res) => {
  const g = db.prepare('SELECT * FROM grupos WHERE id = ?').get(req.params.id)
  if (!g) return res.status(404).json({ error: 'No encontrado' })
  res.json(g)
})

router.post('/', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { idioma_id, nivel_id, plantel_id, profesor_id, codigo, horario, cupo, activo,
    fecha_inicio_inscripciones, fecha_fin_inscripciones, fecha_inicio_clases, fecha_fin_clases } = req.body
  const ids = db.prepare('SELECT id FROM grupos').all().map(r => r.id)
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
    const asignados = db.prepare('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = ?').all(req.user.id).map(r => r.plantel_id)
    const plantelValido = asignados.includes(pid) || req.user.plantel_id === pid
    if (!plantelValido) return res.status(403).json({ error: 'Sin permiso para ese plantel' })
  }
  db.prepare(`INSERT INTO grupos VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    newId, idioma_id, nivel_id, pid, profesor_id || null, codigo, horario,
    cupo || 20, activo !== false ? 1 : 0,
    fecha_inicio_inscripciones || '', fecha_fin_inscripciones || '',
    fecha_inicio_clases || '', fecha_fin_clases || ''
  )
  const grupoCreado = db.prepare('SELECT * FROM grupos WHERE id = ?').get(newId)

  // Notificar suscriptores interesados en este idioma + plantel
  setImmediate(async () => {
    try {
      const idiomaNombre = db.prepare('SELECT nombre FROM idiomas WHERE id = ?').get(idioma_id)?.nombre
      const plantelNombre = db.prepare('SELECT nombre FROM planteles WHERE id = ?').get(pid)?.nombre
      if (!idiomaNombre || !plantelNombre) return
      const nivelNombre = nivel_id ? db.prepare('SELECT nombre FROM niveles WHERE id = ?').get(nivel_id)?.nombre : null
      const cupoDisponible = Math.max(0, (cupo || 20))
      const grupoInfo = { nivel_nombre: nivelNombre, horario, cupo_disponible: cupoDisponible }
      const subs = db.prepare(`
        SELECT * FROM suscripciones_apertura
        WHERE notificado = 0
          AND (idioma = '' OR idioma = ?)
          AND (plantel_nombre = '' OR plantel_nombre = ?)
      `).all(idiomaNombre, plantelNombre)
      for (const sub of subs) {
        try {
          await enviarNotificacionApertura(sub.email, sub.nombre, idiomaNombre, plantelNombre, grupoInfo)
          db.prepare('UPDATE suscripciones_apertura SET notificado = 1 WHERE id = ?').run(sub.id)
        } catch (_) {}
      }
    } catch (_) {}
  })

  res.status(201).json(grupoCreado)
})

router.put('/:id', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const fields = ['idioma_id','nivel_id','plantel_id','profesor_id','codigo','horario','cupo','activo',
    'fecha_inicio_inscripciones','fecha_fin_inscripciones','fecha_inicio_clases','fecha_fin_clases']
  const sets = []; const vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = ?`)
      vals.push(f === 'activo' ? (req.body[f] ? 1 : 0) : (req.body[f] ?? null))
    }
  }
  if (sets.length) db.prepare(`UPDATE grupos SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM grupos WHERE id = ?').get(req.params.id))
})

router.delete('/:id', requireAuth, (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  db.prepare('UPDATE grupos SET activo = 0 WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Alumnos del grupo
router.get('/:id/alumnos', requireAuth, (req, res) => {
  const alumnos = db.prepare(`
    SELECT u.id, u.nombre, u.email, u.matricula, i.estado, i.id as inscripcion_id, i.folio
    FROM inscripciones i
    JOIN usuarios u ON u.id = i.alumno_id
    WHERE i.grupo_id = ? AND i.alumno_id IS NOT NULL
  `).all(req.params.id)
  res.json(alumnos)
})

module.exports = router
