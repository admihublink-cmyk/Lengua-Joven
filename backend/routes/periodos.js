const router = require('express').Router()
const db = require('../db')
const { requireAuth, puedeVerPlantel } = require('../middleware/auth')

// GET público — la landing page lo usa sin login
// ?plantel_id=X&idioma_id=Y  → periodo exacto o fallback al del plantel (idioma_id NULL)
router.get('/', (req, res) => {
  const { plantel_id, idioma_id } = req.query
  if (plantel_id && idioma_id) {
    // Intenta primero el periodo específico idioma+plantel
    const exacto = db.prepare('SELECT * FROM periodos_inscripcion WHERE plantel_id = ? AND idioma_id = ?').get(plantel_id, idioma_id)
    if (exacto) return res.json([exacto])
    // Fallback: el período puede haber sido guardado con un ID de idioma diferente al mismo idioma
    // (ocurre cuando se guardó antes de normalizar IDs globales)
    const idiomaNombre = db.prepare('SELECT nombre FROM idiomas WHERE id = ?').get(idioma_id)?.nombre
    if (idiomaNombre) {
      const porNombre = db.prepare(`
        SELECT pi.* FROM periodos_inscripcion pi
        JOIN idiomas i ON i.id = pi.idioma_id
        WHERE pi.plantel_id = ? AND i.nombre = ?
        LIMIT 1
      `).get(plantel_id, idiomaNombre)
      if (porNombre) return res.json([porNombre])
    }
    // Fallback genérico del plantel (sin idioma específico)
    const generico = db.prepare('SELECT * FROM periodos_inscripcion WHERE plantel_id = ? AND idioma_id IS NULL').get(plantel_id)
    if (generico) return res.json([generico])
    return res.json([])
  }
  if (plantel_id) {
    return res.json(db.prepare('SELECT * FROM periodos_inscripcion WHERE plantel_id = ? ORDER BY idioma_id').all(plantel_id))
  }
  // Sin filtros: todos (solo útil para superadmin desde el panel)
  res.json(db.prepare('SELECT * FROM periodos_inscripcion ORDER BY plantel_id, idioma_id').all())
})

function puedeGestionar(req, plantel_id) {
  const me = req.user
  if (!me) return false
  if (me.rol === 'superadmin') return true
  if (me.rol === 'coordinador') return (me.planteles || []).includes(plantel_id)
  if (me.rol === 'director') return me.plantel_id === plantel_id
  return false
}

router.post('/', requireAuth, (req, res) => {
  const { plantel_id, idioma_id, ciclo, inicio_prereg, fin_prereg, fecha_examen, fecha_asignacion, fecha_inicio_clases } = req.body
  if (!plantel_id) return res.status(400).json({ error: 'plantel_id requerido' })
  if (!puedeGestionar(req, plantel_id)) return res.status(403).json({ error: 'Sin permiso' })

  const ids = db.prepare('SELECT id FROM periodos_inscripcion').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('per', '')) || 0), 0)
  const newId = 'per' + (max + 1)

  try {
    db.prepare(`INSERT INTO periodos_inscripcion VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(newId, plantel_id, idioma_id || null, ciclo || null,
        inicio_prereg || null, fin_prereg || null, fecha_examen || null,
        fecha_asignacion || null, fecha_inicio_clases || null)
    res.status(201).json(db.prepare('SELECT * FROM periodos_inscripcion WHERE id = ?').get(newId))
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un período para ese plantel e idioma' })
    throw e
  }
})

router.put('/:id', requireAuth, (req, res) => {
  const per = db.prepare('SELECT * FROM periodos_inscripcion WHERE id = ?').get(req.params.id)
  if (!per) return res.status(404).json({ error: 'No encontrado' })
  if (!puedeGestionar(req, per.plantel_id)) return res.status(403).json({ error: 'Sin permiso' })

  const fields = ['ciclo', 'inicio_prereg', 'fin_prereg', 'fecha_examen', 'fecha_asignacion', 'fecha_inicio_clases']
  const sets = []; const vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f] || null) }
  }
  if (sets.length) db.prepare(`UPDATE periodos_inscripcion SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM periodos_inscripcion WHERE id = ?').get(req.params.id))
})

router.delete('/:id', requireAuth, (req, res) => {
  const per = db.prepare('SELECT * FROM periodos_inscripcion WHERE id = ?').get(req.params.id)
  if (!per) return res.status(404).json({ error: 'No encontrado' })
  if (!puedeGestionar(req, per.plantel_id)) return res.status(403).json({ error: 'Sin permiso' })
  db.prepare('DELETE FROM periodos_inscripcion WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
