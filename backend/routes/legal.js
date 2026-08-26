const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const ROLES_ARCO = ['superadmin', 'director', 'coordinador']

// ── Fecha en Monterrey (Render corre en UTC, NL va 5-6 h atrás según DST) ────
// en-CA da "YYYY-MM-DD" que se ordena lexicográficamente igual que por fecha.
function hoyMX(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' })
}

// ── Días hábiles México — Art. 74 LFT / plazos ARCO (LFPDPPP Art. 32) ────────
const DIA = 86400000
const iso = (ms) => new Date(ms).toISOString().slice(0, 10)

function msDe(fecha) {
  const [a, m, d] = String(fecha || '').split('-').map(Number)
  return a && m && d ? Date.UTC(a, m - 1, d, 12) : NaN
}

function nthWeekdayUTC(year, month0, weekday, n) {
  let ms = Date.UTC(year, month0, 1, 12)
  let c = 0
  while (new Date(ms).getUTCMonth() === month0) {
    if (new Date(ms).getUTCDay() === weekday && ++c === n) return ms
    ms += DIA
  }
  return null
}

const _festivos = {}
function festivosMX(year) {
  const yy = String(year)
  if (_festivos[yy]) return _festivos[yy]
  const h = new Set([`${yy}-01-01`, `${yy}-05-01`, `${yy}-09-16`, `${yy}-12-25`])
  const add = (ms) => { if (ms) h.add(iso(ms)) }
  add(nthWeekdayUTC(year, 1, 1, 1))   // 1er lunes feb — Constitución
  add(nthWeekdayUTC(year, 2, 1, 3))   // 3er lunes mar — Benito Juárez
  add(nthWeekdayUTC(year, 10, 1, 3))  // 3er lunes nov — Revolución
  return (_festivos[yy] = h)
}

function esDiaHabil(ms) {
  const d = new Date(ms)
  if (d.getUTCDay() === 0 || d.getUTCDay() === 6) return false
  return !festivosMX(d.getUTCFullYear()).has(iso(ms))
}

function sumarDiasHabiles(desde, dias) {
  let ms = msDe(desde)
  if (!Number.isFinite(ms)) return null
  let c = 0
  while (c < dias) { ms += DIA; if (esDiaHabil(ms)) c++ }
  return iso(ms)
}

function diasHabilesRestantes(fechaLimite) {
  if (!fechaLimite) return null
  let ms = msDe(hoyMX())
  const lim = msDe(fechaLimite)
  if (!Number.isFinite(ms) || !Number.isFinite(lim) || lim <= ms) return 0
  let c = 0
  while (ms < lim) { ms += DIA; if (esDiaHabil(ms)) c++ }
  return c
}

// El plazo muere al ACABAR el día límite; solo está vencida cuando hoy ya es posterior.
const estaVencida = (fl) => !!fl && String(fl).slice(0, 10) < hoyMX()

function folioDeRow(r) {
  if (!r) return ''
  const yr = String(r.fecha_recepcion || hoyMX()).slice(0, 4)
  const n = r.numero != null ? String(r.numero).padStart(3, '0') : String(r.id || '').slice(0, 6).toUpperCase()
  return `ARCO-${yr}-${n}`
}

// ── GET / — lista de solicitudes y resumen (o reporte ejecutivo) ───────────────
router.get('/', requireAuth, async (req, res) => {
  if (!ROLES_ARCO.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  // Reporte ejecutivo
  if (req.query.tab === 'reporte') {
    const rows = await query('SELECT tipo_arco, estatus, fecha_recepcion, fecha_limite, actualizado_en FROM solicitudes_arco', [])
    const porTipo = { acceso: 0, rectificacion: 0, cancelacion: 0, oposicion: 0 }
    const porEstatus = { pendiente: 0, en_proceso: 0, resuelta: 0, vencida: 0 }
    let sumaDias = 0; let contResueltas = 0; let aTiempo = 0
    for (const r of rows) {
      if (porTipo[r.tipo_arco] !== undefined) porTipo[r.tipo_arco]++
      if (porEstatus[r.estatus] !== undefined) porEstatus[r.estatus]++
      if (r.estatus === 'resuelta' && r.fecha_recepcion && r.actualizado_en) {
        const d1 = msDe(String(r.fecha_recepcion).slice(0, 10))
        const d2 = msDe(hoyMX(new Date(r.actualizado_en)))
        if (Number.isFinite(d1) && Number.isFinite(d2)) {
          sumaDias += Math.max(0, Math.round((d2 - d1) / DIA))
          contResueltas++
          if (r.fecha_limite && iso(d2) <= String(r.fecha_limite).slice(0, 10)) aTiempo++
        }
      }
    }
    return res.json({
      total: rows.length,
      por_tipo: porTipo,
      por_estatus: porEstatus,
      promedio_dias: contResueltas ? Math.round(sumaDias / contResueltas) : null,
      porcentaje_tiempo: contResueltas ? Math.round((aTiempo / contResueltas) * 100) : null,
    })
  }

  // Lista normal
  const rows = await query(
    `SELECT id, numero, titular_nombre, titular_email, titular_tipo, tipo_arco, descripcion,
            documento_url, fecha_recepcion, fecha_limite, estatus, resolucion, notas, creado_por, actualizado_en
     FROM solicitudes_arco ORDER BY fecha_recepcion DESC`,
    []
  )

  const result = rows.map(r => {
    const fl = r.fecha_limite ? String(r.fecha_limite).slice(0, 10) : null
    const restantes = diasHabilesRestantes(fl)
    const vencida = r.estatus !== 'resuelta' && estaVencida(fl)
    return {
      ...r,
      fecha_recepcion: r.fecha_recepcion ? String(r.fecha_recepcion).slice(0, 10) : null,
      fecha_limite: fl,
      folio: folioDeRow(r),
      dias_habiles_restantes: restantes,
      alerta: restantes !== null && restantes <= 5 && r.estatus !== 'resuelta' && r.estatus !== 'vencida',
      vencida_ahora: vencida,
    }
  })

  // Auto-marcar vencidas
  const ids_vencidas = result.filter(r => r.vencida_ahora && r.estatus !== 'vencida').map(r => r.id)
  if (ids_vencidas.length) {
    await run("UPDATE solicitudes_arco SET estatus = 'vencida', actualizado_en = now() WHERE id = ANY($1::uuid[])", [ids_vencidas])
    result.forEach(r => { if (ids_vencidas.includes(r.id)) r.estatus = 'vencida' })
  }

  const resumen = {
    total: result.length,
    pendientes: result.filter(r => r.estatus === 'pendiente').length,
    en_proceso: result.filter(r => r.estatus === 'en_proceso').length,
    resueltas: result.filter(r => r.estatus === 'resuelta').length,
    vencidas: result.filter(r => r.estatus === 'vencida').length,
    en_alerta: result.filter(r => r.alerta).length,
  }

  res.json({ rows: result, resumen })
})

// ── POST / — nueva solicitud ARCO ─────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  if (!ROLES_ARCO.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const b = req.body
  const nombre = String(b.titular_nombre || '').trim().slice(0, 120)
  const email = String(b.titular_email || '').trim().slice(0, 120)
  const tipo_titular = ['alumno', 'padre', 'ex_alumno', 'docente', 'otro'].includes(b.titular_tipo) ? b.titular_tipo : null
  const tipo_arco = ['acceso', 'rectificacion', 'cancelacion', 'oposicion'].includes(b.tipo_arco) ? b.tipo_arco : null
  const descripcion = String(b.descripcion || '').trim().slice(0, 2000)
  const documento_url = b.documento_url ? String(b.documento_url).trim().slice(0, 500) : null

  if (!nombre) return res.status(400).json({ error: 'El nombre del titular es requerido.' })
  if (!tipo_titular) return res.status(400).json({ error: 'Elige la relación con la escuela.' })
  if (!tipo_arco) return res.status(400).json({ error: 'Elige el tipo de derecho ARCO.' })

  const hoy = hoyMX()
  const fecha_limite = sumarDiasHabiles(hoy, 20) // Art. 32 LFPDPPP

  const creada = await queryOne(
    `INSERT INTO solicitudes_arco
       (titular_nombre, titular_email, titular_tipo, tipo_arco, descripcion, documento_url,
        fecha_recepcion, fecha_limite, estatus, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente',$9)
     RETURNING id, numero, fecha_recepcion`,
    [nombre, email || null, tipo_titular, tipo_arco, descripcion || null, documento_url,
     hoy, fecha_limite, req.user.id]
  )

  res.status(201).json({ ok: true, folio: folioDeRow(creada) })
})

// ── PATCH / — actualizar estatus ──────────────────────────────────────────────
router.patch('/', requireAuth, async (req, res) => {
  if (!ROLES_ARCO.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const b = req.body
  const id = String(b.id || '')
  const estatus = ['pendiente', 'en_proceso', 'resuelta', 'vencida'].includes(b.estatus) ? b.estatus : null
  const resolucion = b.resolucion ? String(b.resolucion).trim().slice(0, 2000) : null
  const notas = b.notas != null ? String(b.notas).trim().slice(0, 2000) : undefined

  if (!id) return res.status(400).json({ error: 'Falta el ID de la solicitud.' })
  if (!estatus) return res.status(400).json({ error: 'Estatus no válido.' })
  if (estatus === 'resuelta' && !resolucion) {
    return res.status(400).json({ error: 'Escribe la resolución antes de marcar como resuelta.' })
  }

  const sets = ['estatus = $1', 'actualizado_en = now()']
  const vals = [estatus]
  if (resolucion) { sets.push(`resolucion = $${vals.length + 1}`); vals.push(resolucion) }
  if (notas !== undefined) { sets.push(`notas = $${vals.length + 1}`); vals.push(notas || null) }
  vals.push(id)

  await run(`UPDATE solicitudes_arco SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals)
  res.json({ ok: true, estatus })
})

// ── GET /avisos ───────────────────────────────────────────────────────────────
router.get('/avisos', requireAuth, async (req, res) => {
  if (!ROLES_ARCO.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const rows = await query('SELECT id, nombre, version, tipo_titular, archivo_url, contenido, fecha_vigencia, activo, creado_en FROM avisos_privacidad ORDER BY creado_en DESC', [])
  res.json({ rows })
})

// ── POST /avisos ──────────────────────────────────────────────────────────────
router.post('/avisos', requireAuth, async (req, res) => {
  if (!ROLES_ARCO.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })

  const b = req.body
  const nombre = String(b.nombre || '').trim().slice(0, 120)
  const version = String(b.version || '').trim().slice(0, 40)
  const tipo_titular = String(b.tipo_titular || '').trim().slice(0, 80)
  const archivo_url = b.archivo_url ? String(b.archivo_url).trim().slice(0, 500) : null
  const contenido = b.contenido ? String(b.contenido).trim() : null
  const fecha_vigencia = b.fecha_vigencia || null

  if (!nombre) return res.status(400).json({ error: 'El nombre del aviso es requerido.' })
  if (!version) return res.status(400).json({ error: 'La versión es requerida.' })
  if (!tipo_titular) return res.status(400).json({ error: 'El tipo de titular es requerido.' })

  if (b.desactivar_anteriores) {
    await run('UPDATE avisos_privacidad SET activo = false WHERE nombre = $1 AND version != $2', [nombre, version])
  }

  try {
    await run(
      'INSERT INTO avisos_privacidad (nombre, version, tipo_titular, archivo_url, contenido, fecha_vigencia, activo) VALUES ($1,$2,$3,$4,$5,$6,true)',
      [nombre, version, tipo_titular, archivo_url, contenido, fecha_vigencia || null]
    )
  } catch (e) {
    const msg = e.code === '23505' ? 'Ya existe un aviso con ese nombre y versión.' : 'No se pudo guardar el aviso.'
    return res.status(400).json({ error: msg })
  }

  res.status(201).json({ ok: true })
})

// GET /legal/avisos/aceptaciones?aviso_id=&limit=200
router.get('/avisos/aceptaciones', requireAuth, async (req, res) => {
  if (!ROLES_ARCO.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { aviso_id } = req.query
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 200, 1), 1000)
  const cond = aviso_id ? 'WHERE a.aviso_id = $1' : ''
  const params = aviso_id ? [aviso_id] : []
  const rows = await query(
    `SELECT a.id, a.aviso_nombre, a.aviso_version, a.titular_tipo,
            a.titular_nombre, a.titular_email, a.ip, a.aceptado_en,
            pr.folio AS pre_registro_folio
     FROM avisos_aceptaciones a
     LEFT JOIN pre_registros pr ON pr.id = a.pre_registro_id
     ${cond}
     ORDER BY a.aceptado_en DESC
     LIMIT ${Number(limit) || 200}`,
    params
  )
  res.json(rows)
})

module.exports = router
