const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')
const db = require('../db')
const { signToken, requireAuth } = require('../middleware/auth')

// Rate limiting: se inyecta desde server.js vía app.set
function getRL(req) { return req.app.get('rateLimit') }
const rl5per60m  = (req, res, next) => (getRL(req)?.(5, 60 * 60 * 1000)  || ((r,s,n) => n()))(req, res, next)

// Login: rastrear intentos FALLIDOS en DB — persiste entre reinicios
const WINDOW_LOGIN = 5 * 60 * 60 * 1000 // 5 horas
const MAX_FAILS    = 3

function getLoginRecord(ip) {
  const now = new Date().toISOString()
  const rec = db.prepare('SELECT * FROM login_bloqueos WHERE ip = ?').get(ip)
  if (!rec || rec.reset_en < now) {
    const reset = new Date(Date.now() + WINDOW_LOGIN).toISOString()
    db.prepare('INSERT OR REPLACE INTO login_bloqueos (ip, intentos, reset_en) VALUES (?,0,?)').run(ip, reset)
    return { intentos: 0, reset_en: reset }
  }
  return rec
}
function recordFail(ip) {
  getLoginRecord(ip) // asegura que existe y no está expirado
  db.prepare('UPDATE login_bloqueos SET intentos = intentos + 1 WHERE ip = ?').run(ip)
}
function clearFails(ip) {
  db.prepare('DELETE FROM login_bloqueos WHERE ip = ?').run(ip)
}

function logActividad(usuario_id, tipo, descripcion, req) {
  const id = 'log' + Date.now() + Math.random().toString(36).slice(2, 6)
  const ip = req?.ip || ''
  db.prepare('INSERT INTO logs_actividad VALUES (?,?,?,?,?,?)').run(
    id, usuario_id, tipo, descripcion, ip, new Date().toISOString()
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const ip = req.ip
  const rec = getLoginRecord(ip)
  if (rec.intentos >= MAX_FAILS) {
    const waitH = Math.ceil((new Date(rec.reset_en) - Date.now()) / (60 * 60 * 1000))
    return res.status(429).json({ error: `Demasiados intentos fallidos. Espera ${waitH} hora${waitH !== 1 ? 's' : ''} e intenta de nuevo.` })
  }

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

  const user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email.trim().toLowerCase())
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordFail(ip)
    const restantes = MAX_FAILS - getLoginRecord(ip).intentos
    const msg = restantes > 0
      ? `Credenciales incorrectas. ${restantes} intento${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''}.`
      : 'Demasiados intentos fallidos. Espera 5 horas e intenta de nuevo.'
    return res.status(401).json({ error: msg })
  }

  clearFails(ip)
  const token = signToken(user)
  const { password_hash, ...safeUser } = user
  res.json({ token, user: { ...safeUser, activo: user.activo === 1 } })
})

// ── Cambiar contraseña (usuario autenticado) ──────────────────────────────────
router.post('/cambiar-password', requireAuth, (req, res) => {
  const { actual, nueva, password_actual, nueva_password } = req.body
  const actualPwd = actual || password_actual
  const nuevaPwd = nueva || nueva_password

  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id)
  if (!bcrypt.compareSync(actualPwd, user.password_hash)) {
    return res.status(400).json({ error: 'Contraseña actual incorrecta' })
  }
  if (!nuevaPwd || nuevaPwd.length < 6) return res.status(400).json({ error: 'Nueva contraseña muy corta' })
  const hash = bcrypt.hashSync(nuevaPwd, 10)
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, req.user.id)
  logActividad(req.user.id, 'CAMBIO_PASSWORD', `Usuario ${user.email} cambió su contraseña`, req)
  res.json({ ok: true })
})

// ── Solicitar recuperación de contraseña ──────────────────────────────────────
router.post('/forgot-password', rl5per60m, async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email requerido' })

  const user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email.trim().toLowerCase())
  if (!user) return res.json({ ok: true })

  // Invalidar tokens anteriores del mismo usuario
  db.prepare("UPDATE reset_tokens SET usado = 1 WHERE usuario_id = ? AND usado = 0").run(user.id)

  const token = randomUUID()
  const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hora
  db.prepare('INSERT INTO reset_tokens VALUES (?,?,?,?)').run(token, user.id, expira, 0)

  logActividad(user.id, 'SOLICITUD_RECUPERACION', `Se solicitó recuperación de contraseña para ${user.email}`, req)

  try {
    const { enviarRecuperacion } = require('../services/email')
    await enviarRecuperacion(user.email, user.nombre, token)
  } catch (e) {
    console.error('Error enviando email de recuperación:', e.message)
    // No fallar si el email no se envía — el token ya está generado
    // En desarrollo: loguear el token en consola
    if (process.env.NODE_ENV !== 'production') console.log(`[DEV] Token de recuperación para ${user.email}: ${token}`)
  }

  res.json({ ok: true })
})

// ── Verificar token de recuperación ───────────────────────────────────────────
router.get('/reset-password/:token', (req, res) => {
  const row = db.prepare('SELECT * FROM reset_tokens WHERE token = ? AND usado = 0').get(req.params.token)
  if (!row) return res.status(400).json({ error: 'Token inválido o expirado' })
  if (new Date(row.expira_en) < new Date()) {
    return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' })
  }
  const user = db.prepare('SELECT id, nombre, email FROM usuarios WHERE id = ?').get(row.usuario_id)
  res.json({ ok: true, email: user?.email })
})

// ── Restablecer contraseña con token ─────────────────────────────────────────
router.post('/reset-password/:token', (req, res) => {
  const { nueva } = req.body
  if (!nueva || nueva.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

  const row = db.prepare('SELECT * FROM reset_tokens WHERE token = ? AND usado = 0').get(req.params.token)
  if (!row) return res.status(400).json({ error: 'Token inválido o expirado' })
  if (new Date(row.expira_en) < new Date()) {
    return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' })
  }

  const hash = bcrypt.hashSync(nueva, 10)
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, row.usuario_id)
  db.prepare('UPDATE reset_tokens SET usado = 1 WHERE token = ?').run(req.params.token)

  logActividad(row.usuario_id, 'RESET_PASSWORD', 'Contraseña restablecida vía enlace de recuperación', req)
  res.json({ ok: true })
})

// ── Logout (invalida el token actual) ────────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  db.prepare('UPDATE usuarios SET token_invalid_before = ? WHERE id = ?')
    .run(new Date().toISOString(), req.user.id)
  res.json({ ok: true })
})

module.exports = router
