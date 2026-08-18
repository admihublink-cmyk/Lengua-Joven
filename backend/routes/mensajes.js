const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  const { grupo_id, chat_grupo_id, contacto_id } = req.query
  let rows
  if (contacto_id) {
    rows = await query(`
      SELECT * FROM mensajes
      WHERE (de = $1 AND para = $2) OR (de = $3 AND para = $4)
      ORDER BY fecha ASC
    `, [me.id, contacto_id, contacto_id, me.id])
  } else if (chat_grupo_id) {
    // Verificar que el usuario es miembro
    const esMiembro = await queryOne(
      'SELECT 1 FROM chat_grupo_miembros WHERE chat_grupo_id = $1 AND usuario_id = $2',
      [chat_grupo_id, me.id]
    )
    if (!esMiembro) return res.status(403).json({ error: 'No eres miembro de este grupo' })
    rows = await query('SELECT * FROM mensajes WHERE chat_grupo_id = $1 ORDER BY fecha ASC', [chat_grupo_id])
  } else if (grupo_id) {
    const acceso = await queryOne(
      `SELECT 1 FROM grupos g WHERE g.id = $1 AND (
        g.profesor_id = $2
        OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.grupo_id = $1 AND i.alumno_id = $2 AND i.estado NOT IN ('cancelada','rechazada','baja'))
        OR $3 IN ('superadmin','coordinador','director','admin_ventas')
      )`,
      [grupo_id, me.id, me.rol]
    )
    if (!acceso) return res.status(403).json({ error: 'No tienes acceso a este grupo' })
    rows = await query('SELECT * FROM mensajes WHERE grupo_id = $1 ORDER BY fecha ASC', [grupo_id])
  } else {
    rows = await query('SELECT * FROM mensajes WHERE de = $1 OR para = $2 ORDER BY fecha DESC', [me.id, me.id])
  }
  res.json(rows.map(r => ({ ...r, leido: r.leido === 1 })))
})

router.post('/', requireAuth, async (req, res) => {
  const { para, contenido, grupo_id, chat_grupo_id } = req.body
  const { m: maxNum } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 2) AS INTEGER)), 0) AS m FROM mensajes WHERE id ~ '^m[0-9]+'`,
    []
  )
  const newId = 'm' + (maxNum + 1)
  const fecha = new Date().toISOString()
  await run(
    'INSERT INTO mensajes (id, de, para, contenido, fecha, leido, grupo_id, chat_grupo_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [newId, req.user.id, para || null, contenido, fecha, 0, grupo_id || null, chat_grupo_id || null]
  )
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
