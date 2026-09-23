const router = require('express').Router()
const { randomUUID } = require('crypto')
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

function uid() { return 'ch' + Date.now() + Math.random().toString(36).slice(2, 6) }

// ── Público: iniciar sesión de chat ──────────────────────────────────────────
router.post('/sesion', async (req, res) => {
  const { nombre, email } = req.body
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' })
  const id = uid()
  const token = randomUUID()
  const ahora = new Date().toISOString()
  await run(
    'INSERT INTO chat_en_vivo_sesiones (id, token, visitante_nombre, visitante_email, estado, creado_en) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, token, nombre.trim(), email?.trim() || null, 'espera', ahora]
  )
  res.json({ id, token })
})

// ── Público: enviar mensaje como visitante ───────────────────────────────────
router.post('/sesion/:token/mensaje', async (req, res) => {
  const sesion = await queryOne('SELECT * FROM chat_en_vivo_sesiones WHERE token = $1', [req.params.token])
  if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' })
  if (sesion.estado === 'cerrado') return res.status(400).json({ error: 'Esta sesión ya fue cerrada' })
  const { contenido } = req.body
  if (!contenido?.trim()) return res.status(400).json({ error: 'El mensaje no puede estar vacío' })
  const msgId = uid()
  const ahora = new Date().toISOString()
  await run(
    'INSERT INTO chat_en_vivo_mensajes (id, sesion_id, autor_tipo, autor_nombre, contenido, creado_en) VALUES ($1,$2,$3,$4,$5,$6)',
    [msgId, sesion.id, 'visitante', sesion.visitante_nombre, contenido.trim(), ahora]
  )
  await run('UPDATE chat_en_vivo_sesiones SET ultimo_mensaje_en = $1 WHERE id = $2', [ahora, sesion.id])
  res.json({ ok: true, id: msgId })
})

// ── Público: leer mensajes de la sesión (polling) ────────────────────────────
router.get('/sesion/:token/mensajes', async (req, res) => {
  const sesion = await queryOne('SELECT * FROM chat_en_vivo_sesiones WHERE token = $1', [req.params.token])
  if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' })
  const desde = req.query.desde || '1970-01-01T00:00:00.000Z'
  const mensajes = await query(
    'SELECT * FROM chat_en_vivo_mensajes WHERE sesion_id = $1 AND creado_en > $2 ORDER BY creado_en ASC',
    [sesion.id, desde]
  )
  res.json({ mensajes, estado: sesion.estado, agente_id: sesion.agente_id })
})

// ── Agente: listar sesiones activas ──────────────────────────────────────────
router.get('/sesiones', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const rows = await query(`
    SELECT s.*, u.nombre AS agente_nombre,
      (SELECT COUNT(*) FROM chat_en_vivo_mensajes m WHERE m.sesion_id = s.id) AS num_mensajes,
      (SELECT COUNT(*) FROM chat_en_vivo_mensajes m WHERE m.sesion_id = s.id AND m.autor_tipo = 'visitante') AS mensajes_visitante
    FROM chat_en_vivo_sesiones s
    LEFT JOIN usuarios u ON u.id = s.agente_id
    WHERE s.estado != 'cerrado'
    ORDER BY s.ultimo_mensaje_en DESC NULLS LAST, s.creado_en DESC
    LIMIT 100
  `)
  res.json(rows)
})

// ── Agente: leer mensajes de una sesión ──────────────────────────────────────
router.get('/sesiones/:id/mensajes', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const sesion = await queryOne('SELECT * FROM chat_en_vivo_sesiones WHERE id = $1', [req.params.id])
  if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' })
  const mensajes = await query(
    'SELECT * FROM chat_en_vivo_mensajes WHERE sesion_id = $1 ORDER BY creado_en ASC',
    [sesion.id]
  )
  res.json({ sesion, mensajes })
})

// ── Agente: enviar mensaje ───────────────────────────────────────────────────
router.post('/sesiones/:id/mensaje', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const sesion = await queryOne('SELECT * FROM chat_en_vivo_sesiones WHERE id = $1', [req.params.id])
  if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' })
  if (sesion.estado === 'cerrado') return res.status(400).json({ error: 'Sesión cerrada' })
  const { contenido } = req.body
  if (!contenido?.trim()) return res.status(400).json({ error: 'Mensaje vacío' })
  const msgId = uid()
  const ahora = new Date().toISOString()
  await run(
    'INSERT INTO chat_en_vivo_mensajes (id, sesion_id, autor_tipo, autor_nombre, contenido, creado_en) VALUES ($1,$2,$3,$4,$5,$6)',
    [msgId, sesion.id, 'agente', me.nombre, contenido.trim(), ahora]
  )
  // Asignar agente si no tenía y activar sesión
  const update = ['ultimo_mensaje_en = $1']
  const vals = [ahora]
  if (!sesion.agente_id) { update.push(`agente_id = $${update.length + 1}`); vals.push(me.id) }
  if (sesion.estado === 'espera') { update.push(`estado = $${update.length + 1}`); vals.push('activo') }
  vals.push(sesion.id)
  await run(`UPDATE chat_en_vivo_sesiones SET ${update.join(', ')} WHERE id = $${vals.length}`, vals)
  res.json({ ok: true, id: msgId })
})

// ── Agente: cambiar estado de sesión ─────────────────────────────────────────
router.put('/sesiones/:id/estado', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { estado } = req.body
  if (!['activo', 'espera', 'cerrado'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' })
  await run('UPDATE chat_en_vivo_sesiones SET estado = $1 WHERE id = $2', [estado, req.params.id])
  res.json({ ok: true })
})

module.exports = router
