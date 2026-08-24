require('dotenv').config()
require('express-async-errors')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const path = require('path')

const app = express()
const PORT = Number(process.env.PORT || 3001)

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET no configurado en producción. Abortando.')
    process.exit(1)
  }
  console.warn('[SEGURIDAD] JWT_SECRET no configurado — usando clave por defecto. No usar en producción.')
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(o => o.trim()).filter(Boolean)

function isAllowedOrigin(origin) {
  if (!origin) return true
  try {
    const requestUrl = new URL(origin)
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(requestUrl.hostname)
    if (isLocalhost) return true
    return ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))
  } catch {
    return false
  }
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  contentSecurityPolicy: false, // API-only, no HTML served
}))
app.use(cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Servir archivos subidos — requiere autenticación
const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads')
const { requireAuth: _requireAuth } = require('./middleware/auth')
app.use('/uploads', _requireAuth, (req, res, next) => {
  const safe = path.normalize(req.path)
  if (safe.includes('..')) return res.status(400).json({ error: 'Ruta inválida' })
  next()
}, express.static(UPLOADS_PATH))

// Rutas públicas (sin auth)
app.use('/api/ofertas', require('./routes/ofertas'))
app.use('/api/pre-registros', require('./routes/pre_registros'))
app.use('/api/periodos', require('./routes/periodos'))

// Endpoints públicos para landing page
const { query, queryOne, run } = require('./db/pool')

app.get('/api/publico/planteles', async (req, res) => {
  try {
    const rows = await query(`
      SELECT DISTINCT p.id, p.nombre, p.ciudad
      FROM planteles p
      INNER JOIN ofertas o ON o.plantel_id = p.id
      ORDER BY p.nombre
    `)
    res.json(rows)
  } catch (e) { console.error('[publico/planteles]', e.message); res.status(500).json({ error: 'Error interno' }) }
})

app.get('/api/publico/idiomas', async (req, res) => {
  try {
    const rows = await query('SELECT id, nombre FROM idiomas ORDER BY nombre')
    res.json(rows)
  } catch (e) { console.error('[publico/idiomas]', e.message); res.status(500).json({ error: 'Error interno' }) }
})

app.post('/api/publico/suscribir-apertura', async (req, res) => {
  const { nombre, email, whatsapp, municipio, idioma, plantel_nombre } = req.body
  if (!nombre?.trim() || !email?.trim()) return res.status(400).json({ error: 'Nombre y email son requeridos' })
  try {
    const id = 'sub' + Date.now() + Math.random().toString(36).slice(2, 6)
    await run(
      `INSERT INTO suscripciones_apertura (id, nombre, email, whatsapp, municipio, idioma, plantel_nombre, fecha) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, nombre.trim(), email.trim().toLowerCase(), whatsapp || '', municipio || '', idioma || '', plantel_nombre || '', new Date().toISOString()]
    )
    res.status(201).json({ ok: true })
  } catch (e) { console.error('[publico/suscribir]', e.message); res.status(500).json({ error: 'Error interno' }) }
})

app.get('/api/publico/grupos', async (req, res) => {
  const { plantel_id, idioma } = req.query
  if (!plantel_id || !idioma) return res.json([])
  try {
    const rows = await query(`
      SELECT g.id, g.codigo, g.horario, g.cupo, g.nivel_id,
             n.nombre AS nivel_nombre, n.orden AS nivel_orden,
             (SELECT COUNT(*) FROM inscripciones
              WHERE grupo_id = g.id AND estado NOT IN ('cancelada','rechazada','baja')) AS inscritos
      FROM grupos g
      LEFT JOIN niveles n ON n.id = g.nivel_id
      LEFT JOIN idiomas i ON i.id = g.idioma_id
      WHERE g.plantel_id = $1 AND i.nombre = $2 AND g.activo = 1
      ORDER BY n.orden, g.horario
    `, [plantel_id, idioma])
    res.json(rows.map(r => ({ ...r, cupo_disponible: Math.max(0, r.cupo - r.inscritos) })))
  } catch (e) { console.error('[publico/grupos]', e.message); res.status(500).json({ error: 'Error interno' }) }
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
app.use('/api/chat-grupos', require('./routes/chat_grupos'))
app.use('/api/avisos', require('./routes/avisos'))
app.use('/api/notificaciones', require('./routes/notificaciones'))
app.use('/api/buzon', require('./routes/buzon'))
app.use('/api/config', require('./routes/config'))
app.use('/api/pagos', require('./routes/pagos'))
app.use('/api/actividad', require('./routes/actividad'))
app.use('/api/planteles', require('./routes/convenio'))
app.use('/api/planteles/:id/documentos', require('./routes/documentos_convenio'))
app.use('/api/banorte', require('./routes/banorte'))
app.use('/api/pagos-maestro', require('./routes/pagos_maestro'))
app.use('/api/liquidaciones', require('./routes/liquidaciones'))
app.use('/api/legal', require('./routes/legal'))

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }))

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.warn(`JSON inválido en ${req.method} ${req.path}`)
    return res.status(400).json({ error: 'JSON inválido' })
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido (20 MB).' })
  }
  if (err.message?.startsWith('Tipo de archivo no permitido')) {
    return res.status(400).json({ error: err.message })
  }
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)
  res.status(500).json({ error: 'Error interno del servidor' })
})

// Inicializar DB y arrancar servidor
const { initDB } = require('./db/init')
initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Lengua Joven API corriendo en http://0.0.0.0:${PORT}`)
    })
  })
  .catch(err => {
    console.error('Error inicializando la base de datos:', err)
    process.exit(1)
  })
