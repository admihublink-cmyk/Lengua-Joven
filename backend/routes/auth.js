const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')
const { query, queryOne, run } = require('../db/pool')
const { signToken, requireAuth } = require('../middleware/auth')

// Rate limiting: se inyecta desde server.js vía app.set
function getRL(req) { return req.app.get('rateLimit') }
const rl5per60m  = (req, res, next) => (getRL(req)?.(5, 60 * 60 * 1000)  || ((r,s,n) => n()))(req, res, next)

// Login: rastrear intentos FALLIDOS en DB — persiste entre reinicios
const WINDOW_LOGIN = 5 * 60 * 60 * 1000 // 5 horas
const MAX_FAILS    = 3

async function getLoginRecord(ip) {
  const now = new Date().toISOString()
  const rec = await queryOne('SELECT * FROM login_bloqueos WHERE ip = $1', [ip])
  if (!rec || rec.reset_en < now) {
    const reset = new Date(Date.now() + WINDOW_LOGIN).toISOString()
    await run('INSERT INTO login_bloqueos (ip, intentos, reset_en) VALUES ($1, 0, $2) ON CONFLICT (ip) DO UPDATE SET intentos=0, reset_en=EXCLUDED.reset_en', [ip, reset])
    return { intentos: 0, reset_en: reset }
  }
  return rec
}
async function recordFail(ip) {
  await getLoginRecord(ip) // asegura que existe y no está expirado
  await run('UPDATE login_bloqueos SET intentos = intentos + 1 WHERE ip = $1', [ip])
}
async function clearFails(ip) {
  await run('DELETE FROM login_bloqueos WHERE ip = $1', [ip])
}

async function logActividad(usuario_id, tipo, descripcion, req) {
  const id = 'log' + Date.now() + Math.random().toString(36).slice(2, 6)
  const ip = req?.ip || ''
  await run('INSERT INTO logs_actividad VALUES ($1,$2,$3,$4,$5,$6)', [
    id, usuario_id, tipo, descripcion, ip, new Date().toISOString()
  ])
}

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const ip = req.ip
  const rec = await getLoginRecord(ip)
  if (rec.intentos >= MAX_FAILS) {
    const waitH = Math.ceil((new Date(rec.reset_en) - Date.now()) / (60 * 60 * 1000))
    return res.status(429).json({ error: `Demasiados intentos fallidos. Espera ${waitH} hora${waitH !== 1 ? 's' : ''} e intenta de nuevo.` })
  }

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

  const user = await queryOne('SELECT * FROM usuarios WHERE email = $1 AND activo = 1', [email.trim().toLowerCase()])
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    await recordFail(ip)
    const restantes = MAX_FAILS - (await getLoginRecord(ip)).intentos
    const msg = restantes > 0
      ? `Credenciales incorrectas. ${restantes} intento${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''}.`
      : 'Demasiados intentos fallidos. Espera 5 horas e intenta de nuevo.'
    return res.status(401).json({ error: msg })
  }

  await clearFails(ip)
  const token = signToken(user)
  const { password_hash, ...safeUser } = user
  res.json({ token, user: { ...safeUser, activo: user.activo === 1 } })
})

// ── Cambiar contraseña (usuario autenticado) ──────────────────────────────────
router.post('/cambiar-password', requireAuth, async (req, res) => {
  const { actual, nueva, password_actual, nueva_password } = req.body
  const actualPwd = actual || password_actual
  const nuevaPwd = nueva || nueva_password

  const user = await queryOne('SELECT * FROM usuarios WHERE id = $1', [req.user.id])
  if (!bcrypt.compareSync(actualPwd, user.password_hash)) {
    return res.status(400).json({ error: 'Contraseña actual incorrecta' })
  }
  if (!nuevaPwd || nuevaPwd.length < 6) return res.status(400).json({ error: 'Nueva contraseña muy corta' })
  const hash = bcrypt.hashSync(nuevaPwd, 10)
  await run('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, req.user.id])
  await logActividad(req.user.id, 'CAMBIO_PASSWORD', `Usuario ${user.email} cambió su contraseña`, req)
  res.json({ ok: true })
})

// ── Solicitar recuperación de contraseña ──────────────────────────────────────
router.post('/forgot-password', rl5per60m, async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email requerido' })

  const user = await queryOne('SELECT * FROM usuarios WHERE email = $1 AND activo = 1', [email.trim().toLowerCase()])
  if (!user) return res.json({ ok: true })

  // Invalidar tokens anteriores del mismo usuario
  await run('UPDATE reset_tokens SET usado = 1 WHERE usuario_id = $1 AND usado = 0', [user.id])

  const token = randomUUID()
  const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hora
  await run('INSERT INTO reset_tokens VALUES ($1,$2,$3,$4)', [token, user.id, expira, 0])

  await logActividad(user.id, 'SOLICITUD_RECUPERACION', `Se solicitó recuperación de contraseña para ${user.email}`, req)

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
router.get('/reset-password/:token', async (req, res) => {
  const row = await queryOne('SELECT * FROM reset_tokens WHERE token = $1 AND usado = 0', [req.params.token])
  if (!row) return res.status(400).json({ error: 'Token inválido o expirado' })
  if (new Date(row.expira_en) < new Date()) {
    return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' })
  }
  const user = await queryOne('SELECT id, nombre, email FROM usuarios WHERE id = $1', [row.usuario_id])
  res.json({ ok: true, email: user?.email })
})

// ── Restablecer contraseña con token ─────────────────────────────────────────
router.post('/reset-password/:token', async (req, res) => {
  const { nueva } = req.body
  if (!nueva || nueva.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

  // Operación atómica: marca como usado solo si aún no lo estaba (previene TOCTOU)
  const row = await queryOne(
    'UPDATE reset_tokens SET usado = 1 WHERE token = $1 AND usado = 0 RETURNING *',
    [req.params.token]
  )
  if (!row) return res.status(400).json({ error: 'Token inválido o expirado' })
  if (new Date(row.expira_en) < new Date()) {
    return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' })
  }

  const hash = bcrypt.hashSync(nueva, 10)
  await run('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, row.usuario_id])

  await logActividad(row.usuario_id, 'RESET_PASSWORD', 'Contraseña restablecida vía enlace de recuperación', req)
  res.json({ ok: true })
})

// ── Logout (invalida el token actual) ────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  await run('UPDATE usuarios SET token_invalid_before = $1 WHERE id = $2', [new Date().toISOString(), req.user.id])
  res.json({ ok: true })
})

module.exports = router
