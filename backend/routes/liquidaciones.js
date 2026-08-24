const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const ROLES = ['superadmin', 'director', 'coordinador']

function periodoRango(periodo) {
  const m = String(periodo || '').match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const y = parseInt(m[1]), mo = parseInt(m[2]) - 1
  const inicio = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10)
  const fin    = new Date(Date.UTC(y, mo + 1, 0)).toISOString().slice(0, 10)
  return { inicio, fin }
}

// GET /liquidaciones?periodo=YYYY-MM
router.get('/', requireAuth, async (req, res) => {
  if (!ROLES.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const periodo = req.query.periodo || new Date().toISOString().slice(0, 7)
  const rango   = periodoRango(periodo)
  if (!rango) return res.status(400).json({ error: 'Formato de período inválido (YYYY-MM)' })

  // Cuota LJ por inscripción (configurable)
  const cfgCuota = await queryOne("SELECT value FROM config WHERE key = 'cuota_lj'")
  const cuotaLJ  = cfgCuota ? parseFloat(cfgCuota.value) || 200 : 200

  // Planteles accesibles según rol
  const me = req.user
  let plantelSql = 'SELECT id, nombre FROM planteles ORDER BY nombre'
  const plantelParams = []
  if (me.rol === 'director' && me.plantel_id) {
    plantelSql = 'SELECT id, nombre FROM planteles WHERE id = $1 ORDER BY nombre'
    plantelParams.push(me.plantel_id)
  } else if (me.rol === 'coordinador') {
    const pids = me.planteles || []
    if (pids.length) {
      const ph = pids.map((_, i) => `$${i + 1}`).join(',')
      plantelSql = `SELECT id, nombre FROM planteles WHERE id IN (${ph}) ORDER BY nombre`
      plantelParams.push(...pids)
    }
  }
  const planteles = await query(plantelSql, plantelParams)

  // Inscripciones confirmadas (asignada) en el período, agrupadas por plantel
  const insCounts = await query(`
    SELECT plantel_id,
           COUNT(*) AS total,
           SUM(CASE WHEN liga_monto IS NOT NULL THEN liga_monto ELSE 0 END) AS suma_cobrado
    FROM inscripciones
    WHERE fecha_registro >= $1
      AND fecha_registro <= $2
      AND estado NOT IN ('cancelada', 'rechazada', 'baja', 'espera')
    GROUP BY plantel_id
  `, [rango.inicio, rango.fin])

  const insMap = {}
  for (const r of insCounts) insMap[r.plantel_id] = r

  // Liquidaciones guardadas
  const liquidGuardadas = await query(
    'SELECT * FROM liquidaciones WHERE periodo = $1', [periodo]
  )
  const liquidMap = {}
  for (const l of liquidGuardadas) liquidMap[l.plantel_id] = l

  const rows = planteles.map(p => {
    const ins   = insMap[p.id]
    const liq   = liquidMap[p.id]
    const n     = parseInt(ins?.total || 0)
    const cobrado = parseFloat(ins?.suma_cobrado || 0)
    const cuota = Math.round(n * cuotaLJ * 100) / 100
    const transferir = Math.max(0, Math.round((cobrado - cuota) * 100) / 100)
    return {
      plantel_id:      p.id,
      plantel_nombre:  p.nombre,
      num_inscripciones: n,
      cobrado,
      cuota_lj:        cuota,
      transferir,
      estado:          liq?.estado || 'pendiente',
      notas:           liq?.notas || null,
      liquidado_en:    liq?.liquidado_en || null,
    }
  })

  const totalInscritos = rows.reduce((s, r) => s + r.num_inscripciones, 0)
  const totalCuota     = rows.reduce((s, r) => s + r.cuota_lj, 0)
  const totalTransferir = rows.reduce((s, r) => s + r.transferir, 0)
  const pendientes     = rows.filter(r => r.estado === 'pendiente' && r.num_inscripciones > 0).length

  res.json({ rows, periodo, cuota_lj: cuotaLJ, totalInscritos, totalCuota, totalTransferir, pendientes })
})

// PATCH /liquidaciones — marcar liquidado / actualizar notas
router.patch('/', requireAuth, async (req, res) => {
  if (!ROLES.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const { plantel_id, periodo, estado, notas } = req.body
  if (!plantel_id || !periodo) return res.status(400).json({ error: 'plantel_id y periodo son requeridos' })
  if (estado && !['pendiente', 'liquidado'].includes(estado)) {
    return res.status(400).json({ error: 'estado debe ser pendiente o liquidado' })
  }

  const existe = await queryOne(
    'SELECT id FROM liquidaciones WHERE plantel_id = $1 AND periodo = $2', [plantel_id, periodo]
  )

  if (existe) {
    const sets = ['updated_at = NOW()']
    const vals = []
    if (estado) {
      sets.push(`estado = $${vals.length + 1}`); vals.push(estado)
      if (estado === 'liquidado') { sets.push(`liquidado_en = NOW()`) }
      if (estado === 'pendiente') { sets.push(`liquidado_en = NULL`) }
    }
    if (notas !== undefined) { sets.push(`notas = $${vals.length + 1}`); vals.push(notas ?? null) }
    vals.push(existe.id)
    await run(`UPDATE liquidaciones SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals)
  } else {
    const id = 'liq-' + plantel_id + '-' + periodo
    await run(
      `INSERT INTO liquidaciones (id, plantel_id, periodo, estado, notas, liquidado_en)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, plantel_id, periodo, estado || 'pendiente', notas ?? null,
       estado === 'liquidado' ? new Date().toISOString() : null]
    )
  }

  res.json({ ok: true })
})

// GET /liquidaciones/exportar-csv?periodo=YYYY-MM
router.get('/exportar-csv', requireAuth, async (req, res) => {
  if (!ROLES.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const periodo = req.query.periodo || new Date().toISOString().slice(0, 7)
  const rango   = periodoRango(periodo)
  if (!rango) return res.status(400).json({ error: 'Período inválido' })

  const cfgCuota = await queryOne("SELECT value FROM config WHERE key = 'cuota_lj'")
  const cuotaLJ  = cfgCuota ? parseFloat(cfgCuota.value) || 200 : 200

  const planteles = await query('SELECT id, nombre FROM planteles ORDER BY nombre', [])
  const insCounts = await query(`
    SELECT plantel_id, COUNT(*) AS total,
           SUM(CASE WHEN liga_monto IS NOT NULL THEN liga_monto ELSE 0 END) AS suma_cobrado
    FROM inscripciones
    WHERE fecha_registro >= $1 AND fecha_registro <= $2
      AND estado NOT IN ('cancelada','rechazada','baja','espera')
    GROUP BY plantel_id
  `, [rango.inicio, rango.fin])
  const insMap = {}
  for (const r of insCounts) insMap[r.plantel_id] = r

  const liquidGuardadas = await query('SELECT * FROM liquidaciones WHERE periodo = $1', [periodo])
  const liquidMap = {}
  for (const l of liquidGuardadas) liquidMap[l.plantel_id] = l

  const lineas = ['Plantel,Inscritos,Cobrado,Cuota LJ,A transferir,Estado,Notas']
  for (const p of planteles) {
    const ins  = insMap[p.id]
    const liq  = liquidMap[p.id]
    const n    = parseInt(ins?.total || 0)
    const cobrado = parseFloat(ins?.suma_cobrado || 0)
    const cuota = n * cuotaLJ
    const transf = Math.max(0, cobrado - cuota)
    const nombre = p.nombre.replace(/,/g, ' ')
    const notas  = (liq?.notas || '').replace(/,/g, ' ')
    lineas.push(`${nombre},${n},${cobrado.toFixed(2)},${cuota.toFixed(2)},${transf.toFixed(2)},${liq?.estado || 'pendiente'},${notas}`)
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="liquidaciones_${periodo}.csv"`)
  res.send('﻿' + lineas.join('\r\n'))
})

module.exports = router
