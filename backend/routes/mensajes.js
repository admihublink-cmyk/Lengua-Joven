const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  const { grupo_id, contacto_id } = req.query
  let rows
  if (contacto_id) {
    rows = await query(`
      SELECT * FROM mensajes
      WHERE (de = $1 AND para = $2) OR (de = $3 AND para = $4)
      ORDER BY fecha ASC
    `, [me.id, contacto_id, contacto_id, me.id])
  } else if (grupo_id) {
    rows = await query('SELECT * FROM mensajes WHERE grupo_id = $1 ORDER BY fecha ASC', [grupo_id])
  } else {
    rows = await query('SELECT * FROM mensajes WHERE de = $1 OR para = $2 ORDER BY fecha DESC', [me.id, me.id])
  }
  res.json(rows.map(r => ({ ...r, leido: r.leido === 1 })))
})

router.post('/', requireAuth, async (req, res) => {
  const { para, contenido, grupo_id } = req.body
  const ids = (await query('SELECT id FROM mensajes', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('m', '')) || 0), 0)
  const newId = 'm' + (max + 1)
  const fecha = new Date().toISOString()
  await run('INSERT INTO mensajes VALUES ($1,$2,$3,$4,$5,$6,$7)', [
    newId, req.user.id, para, contenido, fecha, 0, grupo_id || null
  ])
  res.status(201).json(await queryOne('SELECT * FROM mensajes WHERE id = $1', [newId]))
})

router.put('/:id/leido', requireAuth, async (req, res) => {
  await run('UPDATE mensajes SET leido = 1 WHERE id = $1 AND para = $2', [req.params.id, req.user.id])
  res.json({ ok: true })
})

router.put('/marcar-leidos', requireAuth, async (req, res) => {
  const { de } = req.body
  await run('UPDATE mensajes SET leido = 1 WHERE para = $1 AND de = $2', [req.user.id, de])
  res.json({ ok: true })
})

module.exports = router
