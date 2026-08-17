const router = require('express').Router()
const db = require('../db')

// Ofertas son públicas (landing page no requiere auth)
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM ofertas ORDER BY proveedor, idioma').all())
})

router.get('/proveedores', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT proveedor FROM ofertas ORDER BY proveedor').all()
  res.json(rows.map(r => r.proveedor))
})

router.get('/:id', (req, res) => {
  const o = db.prepare('SELECT * FROM ofertas WHERE id = ?').get(req.params.id)
  if (!o) return res.status(404).json({ error: 'No encontrada' })
  res.json(o)
})

const { requireAuth } = require('../middleware/auth')

router.post('/', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const o = req.body
  const ids = db.prepare('SELECT id FROM ofertas').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('of', '')) || 0), 0)
  const newId = 'of' + (max + 1)
  db.prepare('INSERT INTO ofertas VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    newId, o.proveedor, o.sede, o.idioma, o.costo, o.costo_tipo, o.categoria, o.edades,
    o.modalidad, o.sistema, String(o.no_niveles ?? ''), String(o.material_nivel ?? ''),
    o.horario, o.examen_ubicacion, String(o.nivel ?? '')
  )
  res.status(201).json(db.prepare('SELECT * FROM ofertas WHERE id = ?').get(newId))
})

router.put('/:id', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const o = req.body
  const fields = ['proveedor','sede','idioma','costo','costo_tipo','categoria','edades','modalidad','sistema','no_niveles','material_nivel','horario','examen_ubicacion','nivel']
  const sets = []; const vals = []
  for (const f of fields) {
    if (o[f] !== undefined) { sets.push(`${f} = ?`); vals.push(String(o[f] ?? '')) }
  }
  if (sets.length) db.prepare(`UPDATE ofertas SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM ofertas WHERE id = ?').get(req.params.id))
})

router.delete('/:id', requireAuth, (req, res) => {
  if (!['superadmin'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  db.prepare('DELETE FROM ofertas WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
