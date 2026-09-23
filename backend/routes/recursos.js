const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const PUEDE_ADMIN = ['superadmin', 'coordinador']

// GET /recursos — lista para el rol del usuario (sin base64)
router.get('/', requireAuth, async (req, res) => {
  try {
    const me = req.user
    const rows = await query(`
      SELECT id, titulo, descripcion, rol_destino, archivo_nombre, archivo_tipo, subido_por, creado_en,
             u.nombre AS subido_por_nombre
      FROM recursos r LEFT JOIN usuarios u ON u.id = r.subido_por
      WHERE r.activo = 1 AND (r.rol_destino = 'todos' OR r.rol_destino = $1)
      ORDER BY r.creado_en DESC
    `, [me.rol])
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /recursos/todos — superadmin/coordinador ven todos los recursos
router.get('/todos', requireAuth, async (req, res) => {
  try {
    if (!PUEDE_ADMIN.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
    const rows = await query(`
      SELECT r.id, r.titulo, r.descripcion, r.rol_destino, r.archivo_nombre, r.archivo_tipo, r.creado_en,
             u.nombre AS subido_por_nombre
      FROM recursos r LEFT JOIN usuarios u ON u.id = r.subido_por
      WHERE r.activo = 1
      ORDER BY r.rol_destino, r.creado_en DESC
    `)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /recursos/:id/descargar — descarga el archivo
router.get('/:id/descargar', requireAuth, async (req, res) => {
  try {
    const me = req.user
    const row = await queryOne('SELECT * FROM recursos WHERE id = $1 AND activo = 1', [req.params.id])
    if (!row) return res.status(404).json({ error: 'Recurso no encontrado' })
    if (row.rol_destino !== 'todos' && row.rol_destino !== me.rol && !PUEDE_ADMIN.includes(me.rol)) {
      return res.status(403).json({ error: 'Sin permiso' })
    }
    res.json({ nombre: row.archivo_nombre, tipo: row.archivo_tipo, datos: row.archivo_base64 })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /recursos — subir un recurso
router.post('/', requireAuth, async (req, res) => {
  try {
    if (!PUEDE_ADMIN.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
    const { titulo, descripcion, rol_destino, archivo_nombre, archivo_base64, archivo_tipo } = req.body
    if (!titulo || !rol_destino || !archivo_nombre || !archivo_base64) {
      return res.status(400).json({ error: 'titulo, rol_destino, archivo_nombre y archivo_base64 son requeridos' })
    }
    const id = 'rec-' + Date.now()
    await run(`INSERT INTO recursos (id, titulo, descripcion, rol_destino, archivo_nombre, archivo_base64, archivo_tipo, subido_por, creado_en, activo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1)`,
      [id, titulo, descripcion || null, rol_destino, archivo_nombre, archivo_base64, archivo_tipo || 'application/pdf', req.user.id, new Date().toISOString()])
    const nuevo = await queryOne('SELECT id, titulo, descripcion, rol_destino, archivo_nombre, archivo_tipo, creado_en FROM recursos WHERE id = $1', [id])
    res.status(201).json(nuevo)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /recursos/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!PUEDE_ADMIN.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
    const row = await queryOne('SELECT id FROM recursos WHERE id = $1', [req.params.id])
    if (!row) return res.status(404).json({ error: 'No encontrado' })
    await run('UPDATE recursos SET activo = 0 WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
