require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3001

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim())
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true)
    else cb(new Error('CORS: origen no permitido'))
  },
  credentials: true
}))

// Rate limiting simple en memoria
const _rateCounts = new Map()
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + req.path
    const now = Date.now()
    const rec = _rateCounts.get(key) || { n: 0, reset: now + windowMs }
    if (now > rec.reset) { rec.n = 0; rec.reset = now + windowMs }
    rec.n++
    _rateCounts.set(key, rec)
    if (rec.n > max) return res.status(429).json({ error: 'Demasiados intentos. Espera un momento e intenta de nuevo.' })
    next()
  }
}
app.set('rateLimit', rateLimit)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Servir archivos subidos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Rutas públicas (sin auth)
app.use('/api/ofertas', require('./routes/ofertas'))
app.use('/api/pre-registros', require('./routes/pre_registros'))
app.use('/api/periodos', require('./routes/periodos'))

// Endpoints públicos para landing page (solo lectura, sin datos sensibles)
const db = require('./db')
app.get('/api/publico/planteles', (req, res) => {
  res.json(db.prepare(`
    SELECT DISTINCT p.id, p.nombre, p.ciudad
    FROM planteles p
    INNER JOIN ofertas o ON o.plantel_id = p.id
    ORDER BY p.nombre
  `).all())
})
app.get('/api/publico/idiomas', (req, res) => {
  res.json(db.prepare('SELECT id, nombre FROM idiomas ORDER BY nombre').all())
})

// Rutas protegidas
app.use('/api/auth', require('./routes/auth'))
app.use('/api/usuarios', require('./routes/usuarios'))
app.use('/api/planteles', require('./routes/planteles'))
app.use('/api/idiomas', require('./routes/idiomas'))
app.use('/api/grupos', require('./routes/grupos'))
app.use('/api/inscripciones', require('./routes/inscripciones'))
app.use('/api/tareas', require('./routes/tareas'))
app.use('/api/asistencia', require('./routes/asistencia'))
app.use('/api/evaluacion', require('./routes/evaluacion'))
app.use('/api/mensajes', require('./routes/mensajes'))
app.use('/api/avisos', require('./routes/avisos'))
app.use('/api/notificaciones', require('./routes/notificaciones'))
app.use('/api/buzon', require('./routes/buzon'))
app.use('/api/config', require('./routes/config'))
app.use('/api/pagos', require('./routes/pagos'))
app.use('/api/actividad', require('./routes/actividad'))
app.use('/api/planteles', require('./routes/convenio'))
app.use('/api/planteles/:id/documentos', require('./routes/documentos_convenio'))
app.use('/api/banorte', require('./routes/banorte'))

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }))

app.listen(PORT, () => {
  console.log(`Lengua Joven API corriendo en http://localhost:${PORT}`)
})
