const router = require('express').Router({ mergeParams: true })
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const TIPOS_VALIDOS = [
  'carta_constitutiva',
  'id_representante_frente',
  'id_representante_reverso',
  'comprobante_domicilio',
  'rfc',
]

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(process.env.UPLOADS_PATH || path.join(__dirname, '..', 'uploads'), 'convenios', req.params.id)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname)
    cb(null, req.params.tipo + '_' + Date.now() + ext)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    const allowed = ['image/png', 'application/pdf']
    cb(null, allowed.includes(file.mimetype))
  }
})

const { puedeVerPlantel } = require('../middleware/auth')

function puedeGestionar(req) {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return false
  return puedeVerPlantel(req.user, req.params.id)
}

// GET /api/planteles/:id/documentos
router.get('/', requireAuth, async (req, res) => {
  const docs = await query('SELECT * FROM documentos_convenio WHERE plantel_id = $1 ORDER BY tipo', [req.params.id])
  res.json(docs)
})

// POST /api/planteles/:id/documentos/:tipo  (sube o reemplaza)
router.post('/:tipo', requireAuth, (req, res) => {
  if (!puedeGestionar(req)) return res.status(403).json({ error: 'Sin permiso' })
  if (!TIPOS_VALIDOS.includes(req.params.tipo)) return res.status(400).json({ error: 'Tipo de documento no válido' })

  upload.single('archivo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' })

    // Borrar el anterior si existe
    const anterior = await queryOne('SELECT * FROM documentos_convenio WHERE plantel_id = $1 AND tipo = $2', [req.params.id, req.params.tipo])
    if (anterior) {
      try { fs.unlinkSync(path.join(__dirname, '..', anterior.ruta)) } catch (_) {}
      await run('DELETE FROM documentos_convenio WHERE id = $1', [anterior.id])
    }

    const id = crypto.randomUUID()
    const rutaRelativa = path.join('uploads', 'convenios', req.params.id, req.file.filename)
    await run('INSERT INTO documentos_convenio VALUES ($1,$2,$3,$4,$5,$6,$7)', [
      id, req.params.id, req.params.tipo,
      req.file.originalname,
      rutaRelativa,
      new Date().toISOString(),
      req.file.mimetype
    ])

    res.status(201).json(await queryOne('SELECT * FROM documentos_convenio WHERE id = $1', [id]))
  })
})

// DELETE /api/planteles/:id/documentos/:tipo
router.delete('/:tipo', requireAuth, async (req, res) => {
  if (!puedeGestionar(req)) return res.status(403).json({ error: 'Sin permiso' })
  const doc = await queryOne('SELECT * FROM documentos_convenio WHERE plantel_id = $1 AND tipo = $2', [req.params.id, req.params.tipo])
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' })
  try { fs.unlinkSync(path.join(__dirname, '..', doc.ruta)) } catch (_) {}
  await run('DELETE FROM documentos_convenio WHERE id = $1', [doc.id])
  res.json({ ok: true })
})

// GET /api/planteles/:id/documentos/:tipo/archivo  (sirve el archivo)
router.get('/:tipo/archivo', requireAuth, async (req, res) => {
  const doc = await queryOne('SELECT * FROM documentos_convenio WHERE plantel_id = $1 AND tipo = $2', [req.params.id, req.params.tipo])
  if (!doc) return res.status(404).json({ error: 'No encontrado' })
  const filePath = path.join(__dirname, '..', doc.ruta)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado en disco' })
  res.setHeader('Content-Type', doc.mimetype)
  res.setHeader('Content-Disposition', `inline; filename="${doc.nombre_original}"`)
  res.sendFile(path.resolve(filePath))
})

module.exports = router
