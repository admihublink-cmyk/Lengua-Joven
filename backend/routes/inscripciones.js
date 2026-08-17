const router = require('express').Router()
const db = require('../db')
const { requireAuth, puedeVerPlantel } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const me = req.user
  if (me.rol === 'superadmin') {
    return res.json(db.prepare('SELECT * FROM inscripciones ORDER BY fecha_registro DESC').all())
  }
  if (me.rol === 'alumno') {
    return res.json(db.prepare('SELECT * FROM inscripciones WHERE alumno_id = ? ORDER BY fecha_registro DESC').all(me.id))
  }
  if (me.rol === 'coordinador') {
    const ids = me.planteles || []
    if (ids.length === 0) return res.json([])
    const placeholders = ids.map(() => '?').join(',')
    return res.json(db.prepare(`SELECT * FROM inscripciones WHERE plantel_id IN (${placeholders}) ORDER BY fecha_registro DESC`).all(...ids))
  }
  if (me.plantel_id) {
    return res.json(db.prepare('SELECT * FROM inscripciones WHERE plantel_id = ? ORDER BY fecha_registro DESC').all(me.plantel_id))
  }
  res.json([])
})

router.get('/:id', requireAuth, (req, res) => {
  const i = db.prepare('SELECT * FROM inscripciones WHERE id = ?').get(req.params.id)
  if (!i) return res.status(404).json({ error: 'No encontrado' })
  res.json(i)
})

router.post('/', requireAuth, (req, res) => {
  if (!['superadmin', 'coordinador', 'director', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { alumno_id, grupo_id, plantel_id, estado, nombre_externo, email_externo, tel_externo, oferta_id, placement_nivel, sugerida_por } = req.body
  const count = db.prepare('SELECT COUNT(*) as n FROM inscripciones').get().n
  const folio = 'INJ-' + String(count + 1).padStart(4, '0')
  const newId = 'ins' + (db.prepare('SELECT COUNT(*) as n FROM inscripciones').get().n + 1)
  const fecha = new Date().toISOString().split('T')[0]
  let pid
  if (req.user.rol === 'superadmin') pid = plantel_id
  else if (req.user.rol === 'coordinador') pid = plantel_id  // coordinador especifica el plantel
  else pid = req.user.plantel_id
  db.prepare(`INSERT INTO inscripciones VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    newId, alumno_id || null, grupo_id || null, pid,
    estado || 'nueva', folio, fecha,
    placement_nivel || null, sugerida_por || null,
    nombre_externo || null, email_externo || null, tel_externo || null, oferta_id || null
  )
  let nivel_sugerido = null
  if (alumno_id && !placement_nivel) {
    const hoy = new Date().toISOString().split('T')[0]
    const ultimo = db.prepare(`
      SELECT g.nivel_id, g.idioma_id FROM inscripciones i
      JOIN grupos g ON g.id = i.grupo_id
      WHERE i.alumno_id = ? AND g.fecha_fin_clases < ? AND g.nivel_id IS NOT NULL
        AND g.nivel_id != '' AND i.id != ?
      ORDER BY g.fecha_fin_clases DESC LIMIT 1
    `).get(alumno_id, hoy, newId)
    if (ultimo) {
      const nivelActual = db.prepare('SELECT * FROM niveles WHERE id = ?').get(ultimo.nivel_id)
      if (nivelActual) {
        const sig = db.prepare(
          'SELECT * FROM niveles WHERE idioma_id = ? AND orden = ? LIMIT 1'
        ).get(nivelActual.idioma_id, nivelActual.orden + 1)
        if (sig) nivel_sugerido = { id: sig.id, nombre: sig.nombre }
      }
    }
  }
  res.status(201).json({ ...db.prepare('SELECT * FROM inscripciones WHERE id = ?').get(newId), nivel_sugerido })
})

router.put('/:id', requireAuth, (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }

  const ins = db.prepare('SELECT * FROM inscripciones WHERE id = ?').get(req.params.id)
  if (!ins) return res.status(404).json({ error: 'No encontrado' })

  if (me.rol === 'director' && ins.plantel_id !== me.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para este plantel' })
  }
  if (me.rol === 'coordinador') {
    const asignados = me.planteles || []
    if (!asignados.includes(ins.plantel_id) && ins.plantel_id !== me.plantel_id) {
      return res.status(403).json({ error: 'Sin permiso para este plantel' })
    }
  }

  const fields = ['alumno_id','grupo_id','plantel_id','estado','placement_nivel','sugerida_por',
    'nombre_externo','email_externo','tel_externo','oferta_id','grupo_sugerido_id']
  const sets = []; const vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f] ?? null) }
  }
  if (sets.length) db.prepare(`UPDATE inscripciones SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM inscripciones WHERE id = ?').get(req.params.id))
})

router.delete('/:id', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  db.prepare('DELETE FROM inscripciones WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
