const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

function buildQuery(q) {
  const { tipo, desde, hasta } = q
  let sql = `SELECT l.*, u.nombre as usuario_nombre, u.email as usuario_email
             FROM logs_actividad l
             LEFT JOIN usuarios u ON l.usuario_id = u.id
             WHERE 1=1`
  const vals = []
  if (tipo) { sql += ` AND l.tipo = $${vals.length + 1}`; vals.push(tipo) }
  if (desde) { sql += ` AND l.fecha >= $${vals.length + 1}`; vals.push(desde) }
  if (hasta) { sql += ` AND l.fecha <= $${vals.length + 1}`; vals.push(hasta + 'T23:59:59.999Z') }
  sql += ' ORDER BY l.fecha DESC'
  return { sql, vals }
}

router.get('/', requireAuth, async (req, res) => {
  if (req.user.rol !== 'superadmin') return res.status(403).json({ error: 'Sin permiso' })
  const { sql, vals } = buildQuery(req.query)
  res.json(await query(sql, vals))
})

router.get('/txt', requireAuth, async (req, res) => {
  if (req.user.rol !== 'superadmin') return res.status(403).json({ error: 'Sin permiso' })
  const { desde, hasta, tipo } = req.query
  const { sql, vals } = buildQuery(req.query)
  const logs = await query(sql, vals)

  const sep = '='.repeat(62)
  const lineas = [
    sep,
    '  REPORTE DE ACTIVIDAD — LENGUA JOVEN',
    sep,
    `  Generado: ${new Date().toLocaleString('es-MX')}`,
    desde || hasta ? `  Período:  ${desde || '(inicio)'} → ${hasta || '(hoy)'}` : '  Período:  Todos los registros',
    tipo ? `  Filtro:   ${tipo}` : '',
    `  Total:    ${logs.length} movimiento${logs.length !== 1 ? 's' : ''}`,
    sep,
    '',
  ].filter(l => l !== undefined)

  for (const log of logs) {
    const fecha = new Date(log.fecha).toLocaleString('es-MX', { timeZone: 'America/Monterrey' })
    lineas.push(`[${fecha}]`)
    lineas.push(`  Tipo:    ${log.tipo}`)
    lineas.push(`  Usuario: ${log.usuario_nombre || '—'} <${log.usuario_email || '—'}>`)
    lineas.push(`  Detalle: ${log.descripcion || '—'}`)
    if (log.ip) lineas.push(`  IP:      ${log.ip}`)
    lineas.push('')
  }

  if (logs.length === 0) lineas.push('(Sin movimientos en el período seleccionado)')

  const sanitize = s => (s || '').replace(/[^a-zA-Z0-9_\-]/g, '_')
  const nombreArchivo = `actividad_${sanitize(desde) || 'inicio'}_al_${sanitize(hasta) || 'hoy'}.txt`
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`)
  res.send(lineas.join('\n'))
})

module.exports = router
