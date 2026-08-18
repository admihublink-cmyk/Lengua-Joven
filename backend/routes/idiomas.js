const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  if (me.rol === 'superadmin') {
    res.json(await query('SELECT * FROM idiomas ORDER BY nombre', []))
  } else if (me.plantel_id) {
    res.json(await query('SELECT * FROM idiomas WHERE plantel_id = $1 ORDER BY nombre', [me.plantel_id]))
  } else {
    res.json([])
  }
})

router.post('/', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { nombre, plantel_id } = req.body
  const ids = (await query('SELECT id FROM idiomas', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('i', '')) || 0), 0)
  const newId = 'i' + (max + 1)
  const pid = req.user.rol === 'superadmin' ? plantel_id : req.user.plantel_id
  await run('INSERT INTO idiomas VALUES ($1,$2,$3)', [newId, nombre, pid])
  res.status(201).json(await queryOne('SELECT * FROM idiomas WHERE id = $1', [newId]))
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { nombre } = req.body
  await run('UPDATE idiomas SET nombre = $1 WHERE id = $2', [nombre, req.params.id])
  res.json(await queryOne('SELECT * FROM idiomas WHERE id = $1', [req.params.id]))
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  await run('DELETE FROM idiomas WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// Niveles
router.get('/:id/niveles', requireAuth, async (req, res) => {
  res.json(await query('SELECT * FROM niveles WHERE idioma_id = $1 ORDER BY orden', [req.params.id]))
})

router.post('/:id/niveles', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { nombre, orden } = req.body
  const ids = (await query('SELECT id FROM niveles', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('n', '')) || 0), 0)
  const newId = 'n' + (max + 1)
  await run('INSERT INTO niveles VALUES ($1,$2,$3,$4)', [newId, req.params.id, nombre, orden || 0])
  res.status(201).json(await queryOne('SELECT * FROM niveles WHERE id = $1', [newId]))
})

router.put('/niveles/:nid', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { nombre, orden } = req.body
  await run('UPDATE niveles SET nombre = $1, orden = $2 WHERE id = $3', [nombre, orden, req.params.nid])
  res.json(await queryOne('SELECT * FROM niveles WHERE id = $1', [req.params.nid]))
})

router.delete('/niveles/:nid', requireAuth, async (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  await run('DELETE FROM niveles WHERE id = $1', [req.params.nid])
  res.json({ ok: true })
})

module.exports = router
