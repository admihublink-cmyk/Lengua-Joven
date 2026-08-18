const jwt = require('jsonwebtoken')
const { queryOne, query } = require('../db/pool')

if (!process.env.JWT_SECRET) {
  console.warn('[SEGURIDAD] JWT_SECRET no configurado — usando clave por defecto. No usar en producción.')
}
const JWT_SECRET = process.env.JWT_SECRET || 'lengua-joven-secret-2026'

function requireAuth(req, res, next) {
  _authAsync(req, res, next).catch(next)
}

async function _authAsync(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' })
  }
  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, JWT_SECRET)

    const userData = await queryOne('SELECT token_invalid_before FROM usuarios WHERE id = $1', [payload.id])
    if (userData?.token_invalid_before) {
      const invalidBefore = new Date(userData.token_invalid_before).getTime() / 1000
      if (payload.iat < invalidBefore) {
        return res.status(401).json({ error: 'Sesión cerrada. Inicia sesión de nuevo.' })
      }
    }

    req.user = payload

    if (req.user.rol === 'coordinador') {
      const rows = await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [req.user.id])
      req.user.planteles = rows.map(r => r.plantel_id)
    }
    if (req.user.rol === 'tutor') {
      const rows = await query('SELECT alumno_id FROM tutor_alumnos WHERE tutor_id = $1', [req.user.id])
      req.user.alumnos = rows.map(r => r.alumno_id)
    }
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Sin permiso' })
    }
    next()
  }
}

function puedeVerPlantel(user, plantelId) {
  if (user.rol === 'superadmin') return true
  if (user.rol === 'coordinador') return (user.planteles || []).includes(plantelId)
  return user.plantel_id === plantelId
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, plantel_id: user.plantel_id, nombre: user.nombre, proveedor: user.proveedor },
    JWT_SECRET,
    { expiresIn: '8h' }
  )
}

module.exports = { requireAuth, requireRole, signToken, JWT_SECRET, puedeVerPlantel }
