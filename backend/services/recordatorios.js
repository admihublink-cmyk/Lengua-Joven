const { query, queryOne } = require('../db/pool')
const { enviarRecordatorioAlertas } = require('./email')

const DIAS_AVISO = [30, 15, 7]
const INTERVALO_MS = 24 * 60 * 60 * 1000 // cada 24h

async function obtenerSuperadminEmail() {
  const sa = await queryOne("SELECT email FROM usuarios WHERE rol = 'superadmin' AND activo = 1 LIMIT 1")
  return sa?.email || null
}

async function conveniosProximosAVencer() {
  const hoy = new Date()
  const limite = new Date(hoy)
  limite.setDate(limite.getDate() + Math.max(...DIAS_AVISO))
  const limiteStr = limite.toISOString().slice(0, 10)
  const hoyStr = hoy.toISOString().slice(0, 10)

  return query(
    `SELECT id, nombre, ciudad, convenio_vencimiento
     FROM planteles
     WHERE convenio_vencimiento IS NOT NULL
       AND convenio_vencimiento != ''
       AND convenio_vencimiento >= $1
       AND convenio_vencimiento <= $2
       AND (convenio_baja IS NULL OR convenio_baja = false)
     ORDER BY convenio_vencimiento ASC`,
    [hoyStr, limiteStr]
  )
}

async function comisionesPendientesPorPlantel() {
  return query(
    `SELECT c.plantel_id, p.nombre AS plantel_nombre,
            COUNT(*) AS total,
            SUM(c.monto) AS monto_total
     FROM comisiones c
     LEFT JOIN planteles p ON p.id = c.plantel_id
     WHERE c.estado = 'pendiente'
     GROUP BY c.plantel_id, p.nombre
     HAVING SUM(c.monto) > 0
     ORDER BY monto_total DESC`
  )
}

async function correrRecordatorio() {
  try {
    const email = await obtenerSuperadminEmail()
    if (!email) { console.log('[recordatorios] Sin superadmin activo, omitiendo.'); return }

    const [conveniosVencimiento, pagosVencidos] = await Promise.all([
      conveniosProximosAVencer(),
      comisionesPendientesPorPlantel(),
    ])

    if (!conveniosVencimiento.length && !pagosVencidos.length) {
      console.log('[recordatorios] Sin alertas pendientes.')
      return
    }

    await enviarRecordatorioAlertas(email, { conveniosVencimiento, pagosVencidos })
    console.log(`[recordatorios] Correo enviado a ${email}: ${conveniosVencimiento.length} convenios, ${pagosVencidos.length} comisiones`)
  } catch (e) {
    console.error('[recordatorios] Error:', e.message)
  }
}

function iniciarRecordatorios() {
  // Esperar 5 min tras arranque para que la DB esté estable
  setTimeout(async () => {
    await correrRecordatorio()
    setInterval(correrRecordatorio, INTERVALO_MS)
  }, 5 * 60 * 1000)
  console.log('[recordatorios] Servicio iniciado — primer envío en 5 min, luego cada 24h')
}

module.exports = { iniciarRecordatorios, correrRecordatorio }
