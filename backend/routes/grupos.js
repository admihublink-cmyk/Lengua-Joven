const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'superadmin') {
    rows = db.prepare('SELECT * FROM grupos ORDER BY codigo').all()
  } else if (me.rol === 'profesor') {
    rows = db.prepare('SELECT * FROM grupos WHERE plantel_id = ? AND (profesor_id = ? OR profesor_id IS NULL) ORDER BY codigo').all(me.plantel_id, me.id)
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
  const pid = req.user.rol === 'superadmin' ? plantel_id : req.user.plantel_id
  db.prepare(`INSERT INTO grupos VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    newId, idioma_id, nivel_id, pid, profesor_id || null, codigo, horario,
    cupo || 20, activo !== false ? 1 : 0,
    fecha_inicio_inscripciones || '', fecha_fin_inscripciones || '',
    fecha_inicio_clases || '', fecha_fin_clases || ''
  )
  res.status(201).json(db.prepare('SELECT * FROM grupos WHERE id = ?').get(newId))
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
