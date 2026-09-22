const router = require('express').Router()
const { query } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

// GET /api/alertas — solo superadmin y director ven alertas globales
router.get('/', requireAuth, async (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) {
    return res.json({ convenios: [], comisiones: [] })
  }
  try {
    const hoy = new Date()
    const limite = new Date(hoy)
    limite.setDate(limite.getDate() + 30)
    const hoyStr = hoy.toISOString().slice(0, 10)
    const limiteStr = limite.toISOString().slice(0, 10)

    const [convenios, comisiones] = await Promise.all([
      query(
        `SELECT id, nombre, ciudad, convenio_vencimiento,
                CAST(convenio_vencimiento AS DATE) - CURRENT_DATE AS dias_restantes
         FROM planteles
         WHERE convenio_vencimiento IS NOT NULL
           AND convenio_vencimiento != ''
           AND convenio_vencimiento >= $1
           AND convenio_vencimiento <= $2
           AND (convenio_baja IS NULL OR convenio_baja = false)
         ORDER BY convenio_vencimiento ASC`,
        [hoyStr, limiteStr]
      ),
      query(
        `SELECT c.plantel_id, p.nombre AS plantel_nombre,
                COUNT(*) AS total,
                SUM(c.monto) AS monto_total
         FROM comisiones c
         LEFT JOIN planteles p ON p.id = c.plantel_id
         WHERE c.estado = 'pendiente'
         GROUP BY c.plantel_id, p.nombre
         ORDER BY monto_total DESC`
      ),
    ])

    res.json({ convenios, comisiones })
  } catch (e) {
    console.error('[alertas]', e.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router
