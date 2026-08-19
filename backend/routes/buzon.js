const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'superadmin') {
    rows = await query('SELECT * FROM buzon ORDER BY fecha DESC', [])
  } else if (me.rol === 'director' && me.plantel_id) {
    rows = await query('SELECT * FROM buzon WHERE plantel_id = $1 ORDER BY fecha DESC', [me.plantel_id])
  } else if (me.rol === 'coordinador') {
    const pids = (await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [me.id])).map(r => r.plantel_id)
    if (pids.length > 0) {
      const ph = pids.map((_, i) => `$${i + 1}`).join(',')
      rows = await query(`SELECT * FROM buzon WHERE plantel_id IN (${ph}) ORDER BY fecha DESC`, pids)
    } else {
      rows = []
    }
  } else {
    rows = await query('SELECT * FROM buzon WHERE autor_id = $1 ORDER BY fecha DESC', [me.id])
  }
  res.json(rows.map(r => ({ ...r, anonimo: r.anonimo === 1 })))
})

router.post('/', requireAuth, async (req, res) => {
  const { tipo, asunto, mensaje, anonimo, plantel_id } = req.body
  const { m: maxNum } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)), 0) AS m FROM buzon WHERE id ~ '^bz[0-9]+'`, []
  )
  const newId = 'bz' + (maxNum + 1)
  const fecha = new Date().toISOString()
  const pid = req.user.plantel_id || plantel_id || null
  await run('INSERT INTO buzon (id, tipo, asunto, mensaje, anonimo, autor_id, plantel_id, estado, fecha, respuesta, respondido_por, fecha_respuesta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [
    newId, tipo, asunto, mensaje, anonimo ? 1 : 0,
    anonimo ? null : req.user.id, pid, 'nueva', fecha, '', null, null
  ])
  res.status(201).json(await queryOne('SELECT * FROM buzon WHERE id = $1', [newId]))
})

router.put('/:id/responder', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const bz = await queryOne('SELECT * FROM buzon WHERE id = $1', [req.params.id])
  if (!bz) return res.status(404).json({ error: 'No encontrado' })
  if (req.user.rol === 'director' && bz.plantel_id && bz.plantel_id !== req.user.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para este plantel' })
  }
  if (req.user.rol === 'coordinador') {
    const asignados = (await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [req.user.id])).map(r => r.plantel_id)
    if (bz.plantel_id && !asignados.includes(bz.plantel_id) && bz.plantel_id !== req.user.plantel_id) {
      return res.status(403).json({ error: 'Sin permiso para este plantel' })
    }
  }
  const { respuesta, estado } = req.body
  const fecha = new Date().toISOString()
  await run('UPDATE buzon SET respuesta = $1, respondido_por = $2, fecha_respuesta = $3, estado = $4 WHERE id = $5',
    [respuesta, req.user.id, fecha, estado || 'respondida', req.params.id])
  res.json(await queryOne('SELECT * FROM buzon WHERE id = $1', [req.params.id]))
})

module.exports = router
