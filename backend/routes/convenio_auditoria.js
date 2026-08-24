const router = require('express').Router()
const { query } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const ROLES = ['superadmin', 'director', 'coordinador']

// GET /convenios/auditoria?plantel_id=&limit=100
router.get('/', requireAuth, async (req, res) => {
  if (!ROLES.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { plantel_id, limit = 100 } = req.query
  const cond = plantel_id ? 'WHERE plantel_id = $1' : ''
  const params = plantel_id ? [plantel_id] : []
  const rows = await query(
    `SELECT id, folio, plantel_id, plantel_nombre, usuario_nombre, accion, detalle, ip, created_at
     FROM convenios_auditoria ${cond}
     ORDER BY created_at DESC
     LIMIT ${Number(limit) || 100}`,
    params
  )
  res.json(rows)
})

module.exports = router
