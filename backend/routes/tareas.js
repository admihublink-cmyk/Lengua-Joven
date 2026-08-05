const router = require('express').Router()
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.uploadSubdir || 'misc')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, uuidv4() + ext)
  }
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

router.get('/', requireAuth, (req, res) => {
  const me = req.user
  let rows
  if (me.rol === 'alumno') {
    const grupos = db.prepare('SELECT grupo_id FROM inscripciones WHERE alumno_id = ?').all(me.id).map(r => r.grupo_id)
    if (!grupos.length) return res.json([])
    const placeholders = grupos.map(() => '?').join(',')
    rows = db.prepare(`SELECT * FROM tareas WHERE grupo_id IN (${placeholders}) ORDER BY fecha_limite`).all(...grupos)
  } else if (me.rol === 'profesor') {
    rows = db.prepare('SELECT * FROM tareas WHERE creado_por = ? ORDER BY fecha_limite').all(me.id)
  } else if (me.plantel_id) {
    const gids = db.prepare('SELECT id FROM grupos WHERE plantel_id = ?').all(me.plantel_id).map(r => r.id)
    if (!gids.length) return res.json([])
    const ph = gids.map(() => '?').join(',')
    rows = db.prepare(`SELECT * FROM tareas WHERE grupo_id IN (${ph}) ORDER BY fecha_limite`).all(...gids)
  } else {
    rows = db.prepare('SELECT * FROM tareas ORDER BY fecha_limite').all()
  }
  res.json(rows)
})

router.get('/:id', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tareas WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'No encontrado' })
  res.json(t)
})

router.post('/', requireAuth, (req, upload_next) => {
  req.uploadSubdir = 'tareas'
  upload_next()
}, upload.single('archivo'), (req, res) => {
  if (!['profesor', 'superadmin', 'coordinador', 'director'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { grupo_id, titulo, descripcion, fecha_limite, ponderacion } = req.body
  const ids = db.prepare('SELECT id FROM tareas').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('t', '')) || 0), 0)
  const newId = 't' + (max + 1)
  const fecha = new Date().toISOString().split('T')[0]
  const archivo_nombre = req.file ? req.file.originalname : null
  const archivo_path = req.file ? req.file.filename : null

  db.prepare(`INSERT INTO tareas VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    newId, grupo_id, titulo, descripcion || '', fecha_limite, parseFloat(ponderacion) || 0,
    req.user.id, fecha, archivo_nombre, archivo_path
  )
  res.status(201).json(db.prepare('SELECT * FROM tareas WHERE id = ?').get(newId))
})

router.put('/:id', requireAuth, upload.single('archivo'), (req, res) => {
  const fields = ['titulo', 'descripcion', 'fecha_limite', 'ponderacion']
  const sets = []; const vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f]) }
  }
  if (req.file) {
    sets.push('archivo_nombre = ?'); vals.push(req.file.originalname)
    sets.push('archivo_path = ?'); vals.push(req.file.filename)
  }
  if (sets.length) db.prepare(`UPDATE tareas SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM tareas WHERE id = ?').get(req.params.id))
})

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tareas WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Descargar archivo adjunto de una tarea
router.get('/:id/archivo', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tareas WHERE id = ?').get(req.params.id)
  if (!t || !t.archivo_path) return res.status(404).json({ error: 'Sin archivo' })
  const filePath = path.join(UPLOAD_DIR, 'tareas', t.archivo_path)
  res.download(filePath, t.archivo_nombre || 'archivo')
})

// Entregas
router.get('/:id/entregas', requireAuth, (req, res) => {
  const me = req.user
  if (me.rol === 'alumno') {
    res.json(db.prepare('SELECT * FROM entregas_tareas WHERE tarea_id = ? AND alumno_id = ?').all(req.params.id, me.id))
  } else {
    res.json(db.prepare('SELECT * FROM entregas_tareas WHERE tarea_id = ?').all(req.params.id))
  }
})

router.post('/:id/entregas', requireAuth, (req, res_outer) => {
  req.uploadSubdir = 'entregas'
  upload.single('archivo')(req, res_outer, (err) => {
    if (err) return res_outer.status(400).json({ error: err.message })
    const me = req.user
    if (me.rol !== 'alumno') return res_outer.status(403).json({ error: 'Solo alumnos' })

    const ids = db.prepare('SELECT id FROM entregas_tareas').all().map(r => r.id)
    const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('et', '')) || 0), 0)
    const newId = 'et' + (max + 1)
    const fecha = new Date().toISOString()
    const archivo_nombre = req.file ? req.file.originalname : null
    const archivo_path = req.file ? req.file.filename : null

    db.prepare('INSERT OR REPLACE INTO entregas_tareas VALUES (?,?,?,?,?,?)').run(
      newId, req.params.id, me.id, fecha, archivo_nombre, archivo_path
    )
    res_outer.status(201).json(db.prepare('SELECT * FROM entregas_tareas WHERE id = ?').get(newId))
  })
})

router.get('/:id/entregas/:eid/archivo', requireAuth, (req, res) => {
  const e = db.prepare('SELECT * FROM entregas_tareas WHERE id = ?').get(req.params.eid)
  if (!e || !e.archivo_path) return res.status(404).json({ error: 'Sin archivo' })
  const filePath = path.join(UPLOAD_DIR, 'entregas', e.archivo_path)
  res.download(filePath, e.archivo_nombre || 'entrega')
})

// Calificaciones
router.get('/:id/calificaciones', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM calificaciones_tareas WHERE tarea_id = ?').all(req.params.id))
})

router.post('/:id/calificaciones', requireAuth, (req, res) => {
  const { alumno_id, calificacion, comentario } = req.body
  const existing = db.prepare('SELECT id FROM calificaciones_tareas WHERE tarea_id = ? AND alumno_id = ?').get(req.params.id, alumno_id)
  const fecha = new Date().toISOString().split('T')[0]
  if (existing) {
    db.prepare('UPDATE calificaciones_tareas SET calificacion = ?, comentario = ?, calificado_por = ? WHERE id = ?')
      .run(calificacion, comentario, req.user.id, existing.id)
    res.json(db.prepare('SELECT * FROM calificaciones_tareas WHERE id = ?').get(existing.id))
  } else {
    const ids = db.prepare('SELECT id FROM calificaciones_tareas').all().map(r => r.id)
    const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('ct', '')) || 0), 0)
    const newId = 'ct' + (max + 1)
    db.prepare('INSERT INTO calificaciones_tareas VALUES (?,?,?,?,?,?,?)').run(newId, req.params.id, alumno_id, calificacion, fecha, comentario || '', req.user.id)
    res.status(201).json(db.prepare('SELECT * FROM calificaciones_tareas WHERE id = ?').get(newId))
  }
})

module.exports = router
