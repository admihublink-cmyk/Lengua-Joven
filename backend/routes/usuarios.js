const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const safe = u => { const { password_hash, ...r } = u; return { ...r, activo: r.activo === 1 } }

// Roles que puede asignar un coordinador (no puede crear superadmin ni otros coordinadores)
const ROLES_INSTITUCION = ['maestro', 'profesor', 'alumno', 'admin_ventas', 'tutor']

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'superadmin') {
    rows = await query('SELECT * FROM usuarios ORDER BY nombre', [])
  } else if (me.rol === 'coordinador') {
    const ids = me.planteles || []
    if (ids.length === 0) return res.json([])
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    rows = await query(`SELECT * FROM usuarios WHERE plantel_id IN (${placeholders}) ORDER BY nombre`, ids)
  } else if (me.plantel_id) {
    rows = await query('SELECT * FROM usuarios WHERE plantel_id = $1 ORDER BY nombre', [me.plantel_id])
  } else {
    rows = []
  }
  res.json(rows.map(safe))
})

// Endpoint admin: obtener todas las relaciones tutor→alumno
router.get('/tutor-alumnos', requireAuth, async (req, res) => {
  if (!['superadmin', 'coordinador', 'director'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const rows = await query('SELECT tutor_id, alumno_id FROM tutor_alumnos', [])
  res.json(rows)
})

// Endpoint para tutores: obtener sus alumnos menores con info básica
router.get('/mis-alumnos', requireAuth, async (req, res) => {
  if (req.user.rol !== 'tutor') return res.status(403).json({ error: 'Sin permiso' })
  const alumnos = req.user.alumnos || []
  if (alumnos.length === 0) return res.json([])
  const placeholders = alumnos.map((_, i) => `$${i + 1}`).join(',')
  const rows = await query(`SELECT id, nombre, email, plantel_id, fecha_nacimiento FROM usuarios WHERE id IN (${placeholders})`, alumnos)
  res.json(rows)
})

router.get('/:id', requireAuth, async (req, res) => {
  const u = await queryOne('SELECT * FROM usuarios WHERE id = $1', [req.params.id])
  if (!u) return res.status(404).json({ error: 'No encontrado' })
  const me = req.user
  if (me.rol === 'superadmin') return res.json(safe(u))
  if (me.rol === 'coordinador') {
    if (!(me.planteles || []).includes(u.plantel_id) && me.id !== req.params.id) {
      return res.status(403).json({ error: 'Sin permiso' })
    }
    return res.json(safe(u))
  }
  if (u.plantel_id !== me.plantel_id && me.id !== req.params.id) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  res.json(safe(u))
})

router.post('/', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { nombre, email, password, rol, plantel_id, activo, matricula, fecha_nacimiento, estado_entidad, proveedor, curp, genero_nacimiento } = req.body
  if (!nombre || !email || !password || !rol) return res.status(400).json({ error: 'Campos requeridos: nombre, email, password, rol' })
  // Coordinadores solo pueden crear personal de la institución
  if (me.rol === 'coordinador' && !ROLES_INSTITUCION.includes(rol)) {
    return res.status(403).json({ error: 'No puedes asignar ese rol' })
  }
  // Coordinadores solo pueden asignar sus planteles
  if (me.rol === 'coordinador' && plantel_id && !(me.planteles || []).includes(plantel_id)) {
    return res.status(403).json({ error: 'Plantel no asignado' })
  }

  const existing = await queryOne('SELECT id FROM usuarios WHERE email = $1', [email.toLowerCase()])
  if (existing) return res.status(400).json({ error: 'Email ya registrado' })

  const { m } = await queryOne(`SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 2) AS INTEGER)), 0) AS m FROM usuarios WHERE id ~ '^u[0-9]+'`)
  const newId = 'u' + (m + 1)

  const hash = bcrypt.hashSync(password, 10)
  await run(`INSERT INTO usuarios (id, nombre, email, password_hash, rol, plantel_id, activo, matricula, fecha_nacimiento, estado_entidad, proveedor, curp, genero_nacimiento, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
    [newId, nombre, email.toLowerCase(), hash, rol,
    plantel_id || null, activo !== false ? 1 : 0,
    matricula || null, fecha_nacimiento || null, estado_entidad || null, proveedor || null,
    curp || null, genero_nacimiento || null])
  const created = await queryOne('SELECT * FROM usuarios WHERE id = $1', [newId])
  res.status(201).json(safe(created))
})

router.put('/:id', requireAuth, async (req, res) => {
  const me = req.user
  const target = await queryOne('SELECT * FROM usuarios WHERE id = $1', [req.params.id])
  if (!target) return res.status(404).json({ error: 'No encontrado' })

  const canEdit = me.rol === 'superadmin' ||
    (me.rol === 'director' && target.plantel_id === me.plantel_id) ||
    (me.rol === 'coordinador' && (me.planteles || []).includes(target.plantel_id)) ||
    me.id === req.params.id

  if (!canEdit) return res.status(403).json({ error: 'Sin permiso' })

  const { nombre, email, password, rol, plantel_id, activo, matricula, fecha_nacimiento, estado_entidad, proveedor, curp, genero_nacimiento } = req.body
  const updates = {}
  if (nombre !== undefined) updates.nombre = nombre
  if (email !== undefined) updates.email = email.toLowerCase()
  if (rol !== undefined && me.rol === 'superadmin') updates.rol = rol
  if (rol !== undefined && me.rol === 'coordinador' && ROLES_INSTITUCION.includes(rol)) updates.rol = rol
  if (plantel_id !== undefined && me.rol === 'superadmin') updates.plantel_id = plantel_id || null
  if (plantel_id !== undefined && me.rol === 'director' && me.plantel_id) updates.plantel_id = me.plantel_id
  if (plantel_id !== undefined && me.rol === 'coordinador' && (me.planteles || []).includes(plantel_id)) updates.plantel_id = plantel_id || null
  if (activo !== undefined && me.id !== req.params.id) {
    updates.activo = activo ? 1 : 0
    if (!activo) updates.token_invalid_before = new Date().toISOString()
  }
  if (matricula !== undefined) updates.matricula = matricula || null
  if (fecha_nacimiento !== undefined) updates.fecha_nacimiento = fecha_nacimiento || null
  if (estado_entidad !== undefined) updates.estado_entidad = estado_entidad || null
  if (proveedor !== undefined) updates.proveedor = proveedor || null
  if (curp !== undefined) updates.curp = curp || null
  if (genero_nacimiento !== undefined) updates.genero_nacimiento = genero_nacimiento || null
  if (password) updates.password_hash = bcrypt.hashSync(password, 10)

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ')
  if (setClauses) {
    await run(`UPDATE usuarios SET ${setClauses} WHERE id = $${Object.keys(updates).length + 1}`, [...Object.values(updates), req.params.id])
  }
  const updated = await queryOne('SELECT * FROM usuarios WHERE id = $1', [req.params.id])
  res.json(safe(updated))
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const target = await queryOne('SELECT plantel_id FROM usuarios WHERE id = $1', [req.params.id])
  if (!target) return res.status(404).json({ error: 'No encontrado' })
  if (req.user.rol === 'director' && target.plantel_id !== req.user.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para este plantel' })
  }
  await run('UPDATE usuarios SET activo = 0, token_invalid_before = $1 WHERE id = $2', [new Date().toISOString(), req.params.id])
  res.json({ ok: true })
})

// ── Asignación de planteles a coordinadores ───────────────────────────────────
router.get('/:id/planteles', requireAuth, async (req, res) => {
  if (req.user.rol !== 'superadmin' && req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const rows = await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [req.params.id])
  res.json(rows.map(r => r.plantel_id))
})

router.put('/:id/planteles', requireAuth, async (req, res) => {
  if (req.user.rol !== 'superadmin') return res.status(403).json({ error: 'Sin permiso' })
  const { plantel_ids } = req.body  // array de IDs
  if (!Array.isArray(plantel_ids)) return res.status(400).json({ error: 'plantel_ids debe ser un array' })
  await run('DELETE FROM coordinador_planteles WHERE coordinador_id = $1', [req.params.id])
  for (const pid of plantel_ids) {
    await run('INSERT INTO coordinador_planteles (coordinador_id, plantel_id) VALUES ($1, $2)', [req.params.id, pid])
  }
  res.json({ ok: true, plantel_ids })
})

module.exports = router
