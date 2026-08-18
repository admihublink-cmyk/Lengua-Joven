const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')

// Ofertas son públicas (landing page no requiere auth)
router.get('/', async (req, res) => {
  res.json(await query('SELECT * FROM ofertas ORDER BY proveedor, idioma', []))
})

router.get('/proveedores', async (req, res) => {
  const rows = await query('SELECT DISTINCT proveedor FROM ofertas ORDER BY proveedor', [])
  res.json(rows.map(r => r.proveedor))
})

router.get('/:id', async (req, res) => {
  const o = await queryOne('SELECT * FROM ofertas WHERE id = $1', [req.params.id])
  if (!o) return res.status(404).json({ error: 'No encontrada' })
  res.json(o)
})

const { requireAuth } = require('../middleware/auth')

router.post('/', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const o = req.body
  const ids = (await query('SELECT id FROM ofertas', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('of', '')) || 0), 0)
  const newId = 'of' + (max + 1)
  await run('INSERT INTO ofertas VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)', [
    newId, o.proveedor, o.sede, o.idioma, o.costo, o.costo_tipo, o.categoria, o.edades,
    o.modalidad, o.sistema, String(o.no_niveles ?? ''), String(o.material_nivel ?? ''),
    o.horario, o.examen_ubicacion, String(o.nivel ?? '')
  ])
  res.status(201).json(await queryOne('SELECT * FROM ofertas WHERE id = $1', [newId]))
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const o = req.body
  const fields = ['proveedor','sede','idioma','costo','costo_tipo','categoria','edades','modalidad','sistema','no_niveles','material_nivel','horario','examen_ubicacion','nivel']
  const sets = []; const vals = []
  for (const f of fields) {
    if (o[f] !== undefined) { sets.push(`${f} = $${sets.length + 1}`); vals.push(String(o[f] ?? '')) }
  }
  if (sets.length) await run(`UPDATE ofertas SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  res.json(await queryOne('SELECT * FROM ofertas WHERE id = $1', [req.params.id]))
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!['superadmin'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  await run('DELETE FROM ofertas WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
