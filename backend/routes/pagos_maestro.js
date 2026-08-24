const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const ROLES = ['superadmin', 'director', 'coordinador']

// Calcula horas de un profesor en un período (YYYY-MM) sumando sesiones únicas
// con hora_inicio y hora_fin registradas. Las sesiones semanales no tienen fecha
// individual fija, así que solo se cuentan las de tipo 'unica'.
async function calcularHoras(maestroId, inicio, fin) {
  const sesiones = await query(`
    SELECT s.hora_inicio, s.hora_fin
    FROM sesiones s
    JOIN grupos g ON g.id = s.grupo_id
    WHERE g.profesor_id = $1
      AND s.tipo = 'unica'
      AND s.activa = 1
      AND s.fecha >= $2 AND s.fecha <= $3
  `, [maestroId, inicio, fin])

  let horas = 0
  for (const s of sesiones) {
    if (!s.hora_inicio || !s.hora_fin) continue
    const [hI, mI] = s.hora_inicio.split(':').map(Number)
    const [hF, mF] = s.hora_fin.split(':').map(Number)
    const diff = (hF * 60 + mF - (hI * 60 + mI)) / 60
    if (diff > 0) horas += diff
  }
  return Math.round(horas * 100) / 100
}

function periodoRango(periodo) {
  // periodo: "YYYY-MM"
  const m = String(periodo || '').match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const y = parseInt(m[1]), mo = parseInt(m[2]) - 1
  const inicio = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10)
  const fin = new Date(Date.UTC(y, mo + 1, 0)).toISOString().slice(0, 10)
  return { inicio, fin }
}

// GET /pagos-maestro?periodo=2026-08
router.get('/', requireAuth, async (req, res) => {
  if (!ROLES.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const periodo = req.query.periodo || new Date().toISOString().slice(0, 7)
  const rango = periodoRango(periodo)

  // Profesores accesibles
  const me = req.user
  let profSql = "SELECT id, nombre, plantel_id FROM usuarios WHERE rol = 'profesor' AND activo = 1"
  const profParams = []
  if (me.rol === 'director' && me.plantel_id) {
    profSql += ' AND plantel_id = $1'
    profParams.push(me.plantel_id)
  } else if (me.rol === 'coordinador') {
    const pids = (me.planteles || [])
    if (me.plantel_id && !pids.includes(me.plantel_id)) pids.push(me.plantel_id)
    if (pids.length) {
      const ph = pids.map((_, i) => `$${i + 1}`).join(',')
      profSql += ` AND plantel_id IN (${ph})`
      profParams.push(...pids)
    }
  }
  const profesores = await query(profSql + ' ORDER BY nombre', profParams)

  const cfg = await queryOne("SELECT value FROM config WHERE key = 'tarifa_hora_profesor'")
  const tarifa = cfg ? parseFloat(cfg.value) || 150 : 150

  // Pagos ya guardados para este periodo
  const pagosGuardados = rango
    ? await query('SELECT * FROM pagos_maestro WHERE periodo = $1', [periodo])
    : []
  const pagosMap = {}
  for (const p of pagosGuardados) pagosMap[p.maestro_id] = p

  const rows = []
  for (const prof of profesores) {
    const pago = pagosMap[prof.id]
    let horas = pago?.horas ?? 0
    // Si no hay pago guardado y hay rango válido, calcular desde sesiones
    if (!pago && rango) {
      horas = await calcularHoras(prof.id, rango.inicio, rango.fin)
    }
    const monto = Math.round(horas * tarifa * 100) / 100
    rows.push({
      maestro_id: prof.id,
      maestro: prof.nombre,
      plantel_id: prof.plantel_id,
      horas,
      monto,
      estado: pago?.estado || 'pendiente',
      notas: pago?.notas || null,
      guardado: !!pago,
    })
  }

  const total = rows.reduce((s, r) => s + r.monto, 0)
  const pagado = rows.filter(r => r.estado === 'pagado').reduce((s, r) => s + r.monto, 0)

  res.json({ rows, periodo, tarifa, total, pagado, pendiente: total - pagado })
})

// PATCH /pagos-maestro — actualizar horas, estado o notas de un maestro en un período
router.patch('/', requireAuth, async (req, res) => {
  if (!ROLES.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const { maestro_id, periodo, horas, estado, notas } = req.body
  if (!maestro_id || !periodo) return res.status(400).json({ error: 'maestro_id y periodo son requeridos' })
  if (estado && !['pendiente', 'pagado'].includes(estado)) {
    return res.status(400).json({ error: 'estado debe ser pendiente o pagado' })
  }

  const cfg = await queryOne("SELECT value FROM config WHERE key = 'tarifa_hora_profesor'")
  const tarifa = cfg ? parseFloat(cfg.value) || 150 : 150

  const h = horas != null ? parseFloat(horas) : null
  const monto = h != null ? Math.round(h * tarifa * 100) / 100 : null

  const existe = await queryOne('SELECT id, horas FROM pagos_maestro WHERE maestro_id = $1 AND periodo = $2', [maestro_id, periodo])

  if (existe) {
    const sets = ['updated_at = NOW()']
    const vals = []
    if (h != null) { sets.push(`horas = $${vals.length + 1}`); vals.push(h) }
    if (monto != null) { sets.push(`monto = $${vals.length + 1}`); vals.push(monto) }
    if (estado) { sets.push(`estado = $${vals.length + 1}`); vals.push(estado) }
    if (notas !== undefined) { sets.push(`notas = $${vals.length + 1}`); vals.push(notas) }
    vals.push(existe.id)
    await run(`UPDATE pagos_maestro SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals)
  } else {
    const id = 'pm' + Date.now()
    const finalHoras = h ?? 0
    const finalMonto = monto ?? 0
    await run(
      'INSERT INTO pagos_maestro (id, maestro_id, periodo, horas, monto, estado, notas) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, maestro_id, periodo, finalHoras, finalMonto, estado || 'pendiente', notas || null]
    )
  }

  res.json({ ok: true })
})

// GET /pagos-maestro/recalcular?maestro_id=X&periodo=YYYY-MM
// Recalcula horas desde sesiones sin guardar nada (solo devuelve el resultado)
router.get('/recalcular', requireAuth, async (req, res) => {
  if (!ROLES.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const { maestro_id, periodo } = req.query
  if (!maestro_id || !periodo) return res.status(400).json({ error: 'maestro_id y periodo requeridos' })

  const rango = periodoRango(periodo)
  if (!rango) return res.status(400).json({ error: 'Formato de período inválido (YYYY-MM)' })

  const horas = await calcularHoras(maestro_id, rango.inicio, rango.fin)
  const cfg = await queryOne("SELECT value FROM config WHERE key = 'tarifa_hora_profesor'")
  const tarifa = cfg ? parseFloat(cfg.value) || 150 : 150

  // Detalle de sesiones del periodo
  const detalle = await query(`
    SELECT s.fecha, s.titulo, s.hora_inicio, s.hora_fin, g.codigo as grupo
    FROM sesiones s
    JOIN grupos g ON g.id = s.grupo_id
    WHERE g.profesor_id = $1
      AND s.tipo = 'unica'
      AND s.activa = 1
      AND s.fecha >= $2 AND s.fecha <= $3
    ORDER BY s.fecha
  `, [maestro_id, rango.inicio, rango.fin])

  res.json({ horas, monto: Math.round(horas * tarifa * 100) / 100, tarifa, detalle })
})

// GET /pagos-maestro/exportar-csv?periodo=YYYY-MM
router.get('/exportar-csv', requireAuth, async (req, res) => {
  if (!ROLES.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const periodo = req.query.periodo || new Date().toISOString().slice(0, 7)

  // Reutilizamos la lógica del GET principal
  const cfgReq = { user: req.user, query: { periodo } }
  const cfg = await queryOne("SELECT value FROM config WHERE key = 'tarifa_hora_profesor'")
  const tarifa = cfg ? parseFloat(cfg.value) || 150 : 150

  const pagos = await query('SELECT pm.*, u.nombre FROM pagos_maestro pm JOIN usuarios u ON u.id = pm.maestro_id WHERE pm.periodo = $1 ORDER BY u.nombre', [periodo])

  const lineas = ['Maestro,Horas,Monto,Estado,Notas']
  for (const p of pagos) {
    const nombre = (p.nombre || '').replace(/,/g, ' ')
    const notas = (p.notas || '').replace(/,/g, ' ')
    lineas.push(`${nombre},${p.horas},${p.monto},${p.estado},${notas}`)
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="pagos_maestros_${periodo}.csv"`)
  res.send('﻿' + lineas.join('\r\n'))
})

module.exports = router
