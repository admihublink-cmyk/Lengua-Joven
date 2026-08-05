const router = require('express').Router()
const db = require('../db')
const { requireAuth, puedeVerPlantel } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const me = req.user
  if (me.rol === 'superadmin') {
    res.json(db.prepare('SELECT * FROM planteles ORDER BY nombre').all())
  } else if (me.rol === 'coordinador') {
    const ids = me.planteles || []
    if (ids.length === 0) return res.json([])
    const placeholders = ids.map(() => '?').join(',')
    res.json(db.prepare(`SELECT * FROM planteles WHERE id IN (${placeholders}) ORDER BY nombre`).all(...ids))
  } else if (me.plantel_id) {
    res.json(db.prepare('SELECT * FROM planteles WHERE id = ?').all(me.plantel_id))
  } else {
    res.json([])
  }
})

router.get('/:id', requireAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM planteles WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ error: 'No encontrado' })
  if (!puedeVerPlantel(req.user, p.id)) return res.status(403).json({ error: 'Sin permiso' })
  res.json(p)
})

router.post('/', requireAuth, (req, res) => {
  if (!['superadmin', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { nombre, ciudad, convenio_vencimiento } = req.body
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' })
  const ids = db.prepare('SELECT id FROM planteles').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('p', '')) || 0), 0)
  const newId = 'p' + (max + 1)
  db.prepare('INSERT INTO planteles VALUES (?,?,?,?,?)').run(newId, nombre.trim(), ciudad || '', convenio_vencimiento || '', 0)
  // Si es coordinador, asignarlo automáticamente al nuevo plantel
  if (req.user.rol === 'coordinador') {
    db.prepare('INSERT OR IGNORE INTO coordinador_planteles (coordinador_id, plantel_id) VALUES (?,?)').run(req.user.id, newId)
  }
  res.status(201).json(db.prepare('SELECT * FROM planteles WHERE id = ?').get(newId))
})

// Coordinador asignado a un plantel (para el botón "COORDINADOR" del director)
router.get('/:id/coordinador', requireAuth, (req, res) => {
  if (!puedeVerPlantel(req.user, req.params.id)) return res.status(403).json({ error: 'Sin permiso' })
  const row = db.prepare(`
    SELECT u.id, u.nombre, u.email, u.rol FROM coordinador_planteles cp
    JOIN usuarios u ON u.id = cp.coordinador_id
    WHERE cp.plantel_id = ? LIMIT 1
  `).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Sin coordinador asignado' })
  res.json(row)
})

router.put('/:id', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  if (!puedeVerPlantel(req.user, req.params.id)) return res.status(403).json({ error: 'Sin permiso' })
  const campos = ['nombre', 'ciudad', 'convenio_vencimiento', 'convenio_notificado',
    'razon_social', 'representante_legal', 'rfc', 'domicilio_fiscal', 'tipo_persona', 'proveedor_nombre']
  const sets = [], vals = []
  for (const c of campos) {
    if (req.body[c] !== undefined) {
      sets.push(`${c} = ?`)
      vals.push(c === 'convenio_notificado' ? (req.body[c] ? 1 : 0) : req.body[c])
    }
  }
  if (sets.length) db.prepare(`UPDATE planteles SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM planteles WHERE id = ?').get(req.params.id))
})

module.exports = router
