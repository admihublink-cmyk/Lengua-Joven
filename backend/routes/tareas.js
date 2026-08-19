const router = require('express').Router()
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { randomUUID } = require('crypto')
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const UPLOAD_DIR = process.env.UPLOADS_PATH || path.join(__dirname, '..', 'uploads')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.uploadSubdir || 'misc')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, randomUUID() + ext)
  }
})
const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
])

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter(req, file, cb) {
    if (MIME_PERMITIDOS.has(file.mimetype)) return cb(null, true)
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan PDF, documentos de Office, imágenes y texto plano.'))
  },
})

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'alumno') {
    const grupos = (await query('SELECT grupo_id FROM inscripciones WHERE alumno_id = $1', [me.id])).map(r => r.grupo_id)
    if (!grupos.length) return res.json([])
    const placeholders = grupos.map((_, i) => `$${i + 1}`).join(',')
    rows = await query(`SELECT * FROM tareas WHERE grupo_id IN (${placeholders}) ORDER BY fecha_limite`, grupos)
  } else if (me.rol === 'profesor') {
    rows = await query('SELECT * FROM tareas WHERE creado_por = $1 ORDER BY fecha_limite', [me.id])
  } else if (me.plantel_id) {
    const gids = (await query('SELECT id FROM grupos WHERE plantel_id = $1', [me.plantel_id])).map(r => r.id)
    if (!gids.length) return res.json([])
    const ph = gids.map((_, i) => `$${i + 1}`).join(',')
    rows = await query(`SELECT * FROM tareas WHERE grupo_id IN (${ph}) ORDER BY fecha_limite`, gids)
  } else {
    rows = await query('SELECT * FROM tareas ORDER BY fecha_limite', [])
  }
  res.json(rows)
})

router.get('/:id', requireAuth, async (req, res) => {
  const me = req.user
  const t = await queryOne('SELECT * FROM tareas WHERE id = $1', [req.params.id])
  if (!t) return res.status(404).json({ error: 'No encontrado' })
  if (me.rol === 'superadmin' || me.rol === 'director' || me.rol === 'coordinador') return res.json(t)
  if (me.rol === 'profesor' && t.creado_por !== me.id) return res.status(403).json({ error: 'Sin permiso' })
  if (me.rol === 'alumno') {
    const ins = await queryOne('SELECT id FROM inscripciones WHERE alumno_id = $1 AND grupo_id = $2', [me.id, t.grupo_id])
    if (!ins) return res.status(403).json({ error: 'Sin permiso' })
  }
  res.json(t)
})

router.post('/', requireAuth, (req, upload_next) => {
  req.uploadSubdir = 'tareas'
  upload_next()
}, upload.single('archivo'), async (req, res) => {
  if (!['profesor', 'superadmin', 'coordinador', 'director'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { grupo_id, titulo, descripcion, fecha_limite, ponderacion } = req.body
  if (req.user.rol === 'profesor') {
    const g = await queryOne('SELECT profesor_id FROM grupos WHERE id = $1', [grupo_id])
    if (!g || g.profesor_id !== req.user.id) return res.status(403).json({ error: 'Solo puedes crear tareas en tus propios grupos' })
  }
  const { m: maxNum } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 2) AS INTEGER)), 0) AS m FROM tareas WHERE id ~ '^t[0-9]+'`, []
  )
  const newId = 't' + (maxNum + 1)
  const fecha = new Date().toISOString().split('T')[0]
  const archivo_nombre = req.file ? req.file.originalname : null
  const archivo_path = req.file ? req.file.filename : null

  await run(`INSERT INTO tareas (id, grupo_id, titulo, descripcion, fecha_limite, ponderacion, creado_por, fecha_creacion, archivo_nombre, archivo_path) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
    newId, grupo_id, titulo, descripcion || '', fecha_limite, parseFloat(ponderacion) || 0,
    req.user.id, fecha, archivo_nombre, archivo_path
  ])
  res.status(201).json(await queryOne('SELECT * FROM tareas WHERE id = $1', [newId]))
})

router.put('/:id', requireAuth, upload.single('archivo'), async (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  if (req.user.rol === 'profesor') {
    const t = await queryOne('SELECT creado_por FROM tareas WHERE id = $1', [req.params.id])
    if (!t) return res.status(404).json({ error: 'No encontrado' })
    if (t.creado_por !== req.user.id) return res.status(403).json({ error: 'Solo puedes editar tus propias tareas' })
  }
  const fields = ['titulo', 'descripcion', 'fecha_limite', 'ponderacion']
  const sets = []; const vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = $${sets.length + 1}`); vals.push(req.body[f]) }
  }
  if (req.file) {
    sets.push(`archivo_nombre = $${sets.length + 1}`); vals.push(req.file.originalname)
    sets.push(`archivo_path = $${sets.length + 1}`); vals.push(req.file.filename)
  }
  if (sets.length) await run(`UPDATE tareas SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  res.json(await queryOne('SELECT * FROM tareas WHERE id = $1', [req.params.id]))
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  if (req.user.rol === 'profesor') {
    const t = await queryOne('SELECT creado_por FROM tareas WHERE id = $1', [req.params.id])
    if (!t) return res.status(404).json({ error: 'No encontrado' })
    if (t.creado_por !== req.user.id) return res.status(403).json({ error: 'Solo puedes eliminar tus propias tareas' })
  }
  await run('DELETE FROM tareas WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// Descargar archivo adjunto de una tarea
router.get('/:id/archivo', requireAuth, async (req, res) => {
  const t = await queryOne('SELECT * FROM tareas WHERE id = $1', [req.params.id])
  if (!t || !t.archivo_path) return res.status(404).json({ error: 'Sin archivo' })
  const filePath = path.join(UPLOAD_DIR, 'tareas', t.archivo_path)
  res.download(filePath, t.archivo_nombre || 'archivo')
})

// Entregas
router.get('/:id/entregas', requireAuth, async (req, res) => {
  const me = req.user
  if (me.rol === 'alumno') {
    res.json(await query('SELECT * FROM entregas_tareas WHERE tarea_id = $1 AND alumno_id = $2', [req.params.id, me.id]))
  } else {
    res.json(await query('SELECT * FROM entregas_tareas WHERE tarea_id = $1', [req.params.id]))
  }
})

router.post('/:id/entregas', requireAuth, (req, res_outer) => {
  req.uploadSubdir = 'entregas'
  upload.single('archivo')(req, res_outer, async (err) => {
    if (err) return res_outer.status(400).json({ error: err.message })
    const me = req.user
    if (me.rol !== 'alumno') return res_outer.status(403).json({ error: 'Solo alumnos' })

    const { m: maxEt } = await queryOne(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)), 0) AS m FROM entregas_tareas WHERE id ~ '^et[0-9]+'`, []
    )
    const newId = 'et' + (maxEt + 1)
    const fecha = new Date().toISOString()
    const archivo_nombre = req.file ? req.file.originalname : null
    const archivo_path = req.file ? req.file.filename : null

    await run('INSERT INTO entregas_tareas (id, tarea_id, alumno_id, fecha_entrega, archivo_nombre, archivo_path) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tarea_id, alumno_id) DO UPDATE SET id=EXCLUDED.id, fecha_entrega=EXCLUDED.fecha_entrega, archivo_nombre=EXCLUDED.archivo_nombre, archivo_path=EXCLUDED.archivo_path',
      [newId, req.params.id, me.id, fecha, archivo_nombre, archivo_path])
    res_outer.status(201).json(await queryOne('SELECT * FROM entregas_tareas WHERE id = $1', [newId]))
  })
})

router.get('/:id/entregas/:eid/archivo', requireAuth, async (req, res) => {
  const e = await queryOne('SELECT * FROM entregas_tareas WHERE id = $1', [req.params.eid])
  if (!e || !e.archivo_path) return res.status(404).json({ error: 'Sin archivo' })
  const filePath = path.join(UPLOAD_DIR, 'entregas', e.archivo_path)
  res.download(filePath, e.archivo_nombre || 'entrega')
})

// Calificaciones
router.get('/:id/calificaciones', requireAuth, async (req, res) => {
  const me = req.user
  if (me.rol === 'alumno') {
    return res.json(await query('SELECT * FROM calificaciones_tareas WHERE tarea_id = $1 AND alumno_id = $2', [req.params.id, me.id]))
  }
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  res.json(await query('SELECT * FROM calificaciones_tareas WHERE tarea_id = $1', [req.params.id]))
})

router.post('/:id/calificaciones', requireAuth, async (req, res) => {
  if (!['profesor', 'coordinador', 'director', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { alumno_id, calificacion, comentario } = req.body
  const existing = await queryOne('SELECT id FROM calificaciones_tareas WHERE tarea_id = $1 AND alumno_id = $2', [req.params.id, alumno_id])
  const fecha = new Date().toISOString().split('T')[0]
  if (existing) {
    await run('UPDATE calificaciones_tareas SET calificacion = $1, comentario = $2, calificado_por = $3 WHERE id = $4',
      [calificacion, comentario, req.user.id, existing.id])
    res.json(await queryOne('SELECT * FROM calificaciones_tareas WHERE id = $1', [existing.id]))
  } else {
    const { m: maxCt } = await queryOne(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)), 0) AS m FROM calificaciones_tareas WHERE id ~ '^ct[0-9]+'`, []
    )
    const newId = 'ct' + (maxCt + 1)
    await run('INSERT INTO calificaciones_tareas (id, tarea_id, alumno_id, calificacion, fecha, comentario, calificado_por) VALUES ($1,$2,$3,$4,$5,$6,$7)', [newId, req.params.id, alumno_id, calificacion, fecha, comentario || '', req.user.id])
    res.status(201).json(await queryOne('SELECT * FROM calificaciones_tareas WHERE id = $1', [newId]))
  }
})

module.exports = router
