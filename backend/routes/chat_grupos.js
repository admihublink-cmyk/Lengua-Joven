const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

// GET / — chat grupos donde el usuario es miembro
router.get('/', requireAuth, async (req, res) => {
  const rows = await query(`
    SELECT cg.* FROM chat_grupos cg
    INNER JOIN chat_grupo_miembros cgm ON cgm.chat_grupo_id = cg.id
    WHERE cgm.usuario_id = $1
    ORDER BY cg.created_at DESC
  `, [req.user.id])
  res.json(rows)
})

// POST / — crear chat grupal {nombre, miembros: [userId, ...]}
router.post('/', requireAuth, async (req, res) => {
  const { nombre, miembros } = req.body
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' })
  if (!Array.isArray(miembros) || miembros.length === 0)
    return res.status(400).json({ error: 'Selecciona al menos un participante' })

  const ids = (await query('SELECT id FROM chat_grupos', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('cg', '')) || 0), 0)
  const newId = 'cg' + (max + 1)
  const now = new Date().toISOString()

  await run('INSERT INTO chat_grupos VALUES ($1,$2,$3,$4)', [newId, nombre.trim(), req.user.id, now])

  // Agregar al creador + los miembros seleccionados
  const todos = [...new Set([req.user.id, ...miembros])]
  for (const uid of todos) {
    await run('INSERT INTO chat_grupo_miembros VALUES ($1,$2) ON CONFLICT DO NOTHING', [newId, uid])
  }

  res.status(201).json(await queryOne('SELECT * FROM chat_grupos WHERE id = $1', [newId]))
})

// GET /:id/miembros — lista de miembros del grupo
router.get('/:id/miembros', requireAuth, async (req, res) => {
  const esMiembro = await queryOne(
    'SELECT 1 FROM chat_grupo_miembros WHERE chat_grupo_id = $1 AND usuario_id = $2',
    [req.params.id, req.user.id]
  )
  if (!esMiembro) return res.status(403).json({ error: 'No eres miembro de este grupo' })
  const rows = await query(`
    SELECT u.id, u.nombre, u.rol FROM usuarios u
    INNER JOIN chat_grupo_miembros cgm ON cgm.usuario_id = u.id
    WHERE cgm.chat_grupo_id = $1
  `, [req.params.id])
  res.json(rows)
})

// DELETE /:id — eliminar el grupo (solo el creador)
router.delete('/:id', requireAuth, async (req, res) => {
  const g = await queryOne('SELECT * FROM chat_grupos WHERE id = $1', [req.params.id])
  if (!g) return res.status(404).json({ error: 'No encontrado' })
  if (g.creado_por !== req.user.id && req.user.rol !== 'superadmin')
    return res.status(403).json({ error: 'Solo el creador puede eliminar el grupo' })
  await run('DELETE FROM chat_grupo_miembros WHERE chat_grupo_id = $1', [req.params.id])
  await run('DELETE FROM mensajes WHERE chat_grupo_id = $1', [req.params.id])
  await run('DELETE FROM chat_grupos WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
