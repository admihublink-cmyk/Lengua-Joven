const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const SOLO_ADMIN = ['superadmin', 'director']

router.get('/', requireAuth, async (req, res) => {
  if (!SOLO_ADMIN.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  try {
    const { plantel_id, estado, desde, hasta } = req.query
    const conds = []
    const vals = []

    if (plantel_id) { conds.push(`c.plantel_id = $${vals.length + 1}`); vals.push(plantel_id) }
    if (estado)     { conds.push(`c.estado = $${vals.length + 1}`);     vals.push(estado) }
    if (desde)      { conds.push(`c.fecha >= $${vals.length + 1}`);     vals.push(desde) }
    if (hasta)      { conds.push(`c.fecha <= $${vals.length + 1}`);     vals.push(hasta) }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''

    const rows = await query(
      `SELECT c.*, p.nombre AS plantel_nombre
       FROM comisiones c
       LEFT JOIN planteles p ON p.id = c.plantel_id
       ${where}
       ORDER BY c.fecha DESC`,
      vals
    )
    res.json(rows)
  } catch (e) {
    console.error('[comisiones GET]', e.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

// Resumen agrupado por plantel
router.get('/resumen', requireAuth, async (req, res) => {
  if (!SOLO_ADMIN.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  try {
    const rows = await query(
      `SELECT c.plantel_id, p.nombre AS plantel_nombre,
              COUNT(*) AS total,
              SUM(CASE WHEN c.estado = 'pendiente' THEN c.monto ELSE 0 END) AS monto_pendiente,
              SUM(CASE WHEN c.estado = 'cobrada'   THEN c.monto ELSE 0 END) AS monto_cobrado,
              SUM(c.monto) AS monto_total
       FROM comisiones c
       LEFT JOIN planteles p ON p.id = c.plantel_id
       GROUP BY c.plantel_id, p.nombre
       ORDER BY monto_pendiente DESC`,
      []
    )
    res.json(rows)
  } catch (e) {
    console.error('[comisiones resumen]', e.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

// Marcar una comisión como cobrada
router.patch('/:id/cobrar', requireAuth, async (req, res) => {
  if (!SOLO_ADMIN.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  try {
    const com = await queryOne('SELECT * FROM comisiones WHERE id = $1', [req.params.id])
    if (!com) return res.status(404).json({ error: 'No encontrada' })
    if (com.estado === 'cobrada') return res.status(400).json({ error: 'Ya estaba marcada como cobrada' })

    await run(
      `UPDATE comisiones SET estado = 'cobrada', cobrado_en = $1 WHERE id = $2`,
      [new Date().toISOString(), req.params.id]
    )
    res.json(await queryOne('SELECT * FROM comisiones WHERE id = $1', [req.params.id]))
  } catch (e) {
    console.error('[comisiones cobrar]', e.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

// Marcar múltiples comisiones de un plantel como cobradas
router.patch('/plantel/:plantelId/cobrar-todas', requireAuth, async (req, res) => {
  if (!SOLO_ADMIN.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  try {
    await run(
      `UPDATE comisiones SET estado = 'cobrada', cobrado_en = $1
       WHERE plantel_id = $2 AND estado = 'pendiente'`,
      [new Date().toISOString(), req.params.plantelId]
    )
    const { n } = await queryOne(
      `SELECT COUNT(*) AS n FROM comisiones WHERE plantel_id = $1 AND estado = 'cobrada'`,
      [req.params.plantelId]
    )
    res.json({ ok: true, total_cobradas: n })
  } catch (e) {
    console.error('[comisiones cobrar-todas]', e.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router
