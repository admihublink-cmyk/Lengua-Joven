const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth, puedeVerPlantel } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  if (me.rol === 'superadmin') {
    return res.json(await query('SELECT * FROM inscripciones ORDER BY fecha_registro DESC', []))
  }
  if (me.rol === 'alumno') {
    return res.json(await query('SELECT * FROM inscripciones WHERE alumno_id = $1 ORDER BY fecha_registro DESC', [me.id]))
  }
  if (me.rol === 'coordinador') {
    const ids = me.planteles || []
    if (ids.length === 0) return res.json([])
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    return res.json(await query(`SELECT * FROM inscripciones WHERE plantel_id IN (${placeholders}) ORDER BY fecha_registro DESC`, ids))
  }
  if (me.plantel_id) {
    return res.json(await query('SELECT * FROM inscripciones WHERE plantel_id = $1 ORDER BY fecha_registro DESC', [me.plantel_id]))
  }
  res.json([])
})

router.get('/:id', requireAuth, async (req, res) => {
  const i = await queryOne('SELECT * FROM inscripciones WHERE id = $1', [req.params.id])
  if (!i) return res.status(404).json({ error: 'No encontrado' })
  res.json(i)
})

router.post('/', requireAuth, async (req, res) => {
  if (!['superadmin', 'coordinador', 'director', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { alumno_id, grupo_id, plantel_id, estado, nombre_externo, email_externo, tel_externo, oferta_id, placement_nivel, sugerida_por } = req.body
  const ids = (await query('SELECT id FROM inscripciones', [])).map(r => r.id)
  const maxN = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('ins', '')) || 0), 0)
  const newId = 'ins' + (maxN + 1)
  const folio = 'INJ-' + String(maxN + 1).padStart(4, '0')
  const fecha = new Date().toISOString().split('T')[0]
  let pid
  if (req.user.rol === 'superadmin') pid = plantel_id
  else if (req.user.rol === 'coordinador') pid = plantel_id  // coordinador especifica el plantel
  else pid = req.user.plantel_id
  await run(`INSERT INTO inscripciones VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
    newId, alumno_id || null, grupo_id || null, pid,
    estado || 'nueva', folio, fecha,
    placement_nivel || null, sugerida_por || null,
    nombre_externo || null, email_externo || null, tel_externo || null, oferta_id || null
  ])
  let nivel_sugerido = null
  if (alumno_id && !placement_nivel) {
    const hoy = new Date().toISOString().split('T')[0]
    const ultimo = await queryOne(`
      SELECT g.nivel_id, g.idioma_id FROM inscripciones i
      JOIN grupos g ON g.id = i.grupo_id
      WHERE i.alumno_id = $1 AND g.fecha_fin_clases < $2 AND g.nivel_id IS NOT NULL
        AND g.nivel_id != '' AND i.id != $3
      ORDER BY g.fecha_fin_clases DESC LIMIT 1
    `, [alumno_id, hoy, newId])
    if (ultimo) {
      const nivelActual = await queryOne('SELECT * FROM niveles WHERE id = $1', [ultimo.nivel_id])
      if (nivelActual) {
        const sig = await queryOne(
          'SELECT * FROM niveles WHERE idioma_id = $1 AND orden = $2 LIMIT 1',
          [nivelActual.idioma_id, nivelActual.orden + 1]
        )
        if (sig) nivel_sugerido = { id: sig.id, nombre: sig.nombre }
      }
    }
  }
  res.status(201).json({ ...await queryOne('SELECT * FROM inscripciones WHERE id = $1', [newId]), nivel_sugerido })
})

router.put('/:id', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }

  const ins = await queryOne('SELECT * FROM inscripciones WHERE id = $1', [req.params.id])
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
    if (req.body[f] !== undefined) { sets.push(`${f} = $${sets.length + 1}`); vals.push(req.body[f] ?? null) }
  }
  if (sets.length) await run(`UPDATE inscripciones SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  res.json(await queryOne('SELECT * FROM inscripciones WHERE id = $1', [req.params.id]))
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  await run('DELETE FROM inscripciones WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
