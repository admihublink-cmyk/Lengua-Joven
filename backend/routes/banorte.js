const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const ROLES_BANORTE = ['superadmin', 'director', 'coordinador', 'admin_ventas']
const MAX_LOTE = 95

// ── Helpers ───────────────────────────────────────────────────────────────────

function puedeAcceder(user) {
  return ROLES_BANORTE.includes(user.rol)
}

async function plantelesAccesibles(user) {
  if (user.rol === 'superadmin') return null // null = todos
  if (user.rol === 'coordinador') {
    const rows = await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [user.id])
    const ids = rows.map(r => r.plantel_id)
    if (user.plantel_id && !ids.includes(user.plantel_id)) ids.push(user.plantel_id)
    return ids.length ? ids : ['__ninguno__']
  }
  return [user.plantel_id].filter(Boolean)
}

function addPlantelFiltro(sql, params, plantelIds) {
  if (!plantelIds) return sql
  const ph = plantelIds.map((_, i) => `$${params.length + i + 1}`).join(',')
  params.push(...plantelIds)
  return sql + ` AND i.plantel_id IN (${ph})`
}

// Etapa del pipeline según columnas
function etapa(ins) {
  if (!ins.grupo_id) return 'falta_grupo'
  if (!ins.liga_lote) return 'pendiente'
  if (!ins.liga_bajado_en) return 'en_lote'
  if (!ins.liga_pago) return 'descargado'
  if (!ins.liga_avisada_en) return 'con_liga'
  return 'avisado'
}

async function buildPrecioMap() {
  const rows = await query('SELECT * FROM precios')
  const map = {}
  for (const p of rows) map[`${p.plantel_id}|${p.idioma_id}|${p.categoria}`] = p.monto
  return map
}

async function resolverMonto(ins, precioMap, costoDefault) {
  if (ins.pago_monto) return ins.pago_monto
  if (ins.liga_monto) return ins.liga_monto
  const idiomaId = ins.idioma_id
  const cat = (ins.categoria || '').toLowerCase()
  if (ins.plantel_id && idiomaId) {
    const m = precioMap[`${ins.plantel_id}|${idiomaId}|${cat}`]
              ?? precioMap[`${ins.plantel_id}|${idiomaId}|`]
    if (m != null) return m
  }
  return costoDefault
}

// Siguiente referencia libre (consecutivo global sobre referencias_emitidas)
async function siguienteReferencia() {
  const row = await queryOne(`SELECT referencia FROM referencias_emitidas ORDER BY created_at DESC, referencia DESC LIMIT 1`)
  if (!row) return 'LJ-1001'
  const m = String(row.referencia).match(/(\d+)\s*$/)
  const n = m ? parseInt(m[1], 10) + 1 : 1001
  return `LJ-${n}`
}

// ── GET /banorte/ligas — resumen del pipeline ─────────────────────────────────

router.get('/ligas', requireAuth, async (req, res) => {
  if (!puedeAcceder(req.user)) return res.status(403).json({ error: 'Sin permiso' })

  const plantelIds = await plantelesAccesibles(req.user)
  let sql = `
    SELECT i.id, i.folio, i.plantel_id, i.grupo_id, i.alumno_id,
           i.nombre_externo, i.email_externo, i.estado,
           i.liga_lote, i.liga_referencia, i.liga_monto, i.liga_pago,
           i.liga_bajado_en, i.liga_pago_cargada_en, i.liga_avisada_en,
           COALESCE(u.nombre, i.nombre_externo) AS nombre,
           COALESCE(u.email, i.email_externo) AS email,
           g.idioma_id, o.categoria,
           p.monto AS pago_monto
    FROM inscripciones i
    LEFT JOIN usuarios u ON u.id = i.alumno_id
    LEFT JOIN grupos g ON g.id = i.grupo_id
    LEFT JOIN ofertas o ON o.id = i.oferta_id
    LEFT JOIN pagos p ON p.inscripcion_id = i.id AND p.estado = 'pendiente'
    WHERE i.estado NOT IN ('baja', 'pagada')
  `
  const params = []
  sql = addPlantelFiltro(sql, params, plantelIds)
  sql += ' ORDER BY i.folio'

  const filas = await query(sql, params)
  const con_etapa = filas.map(f => ({ ...f, etapa: etapa(f) }))

  const conteos = { falta_grupo: 0, pendiente: 0, en_lote: 0, descargado: 0, con_liga: 0, avisado: 0 }
  for (const f of con_etapa) conteos[f.etapa] = (conteos[f.etapa] || 0) + 1

  // Lotes activos (en_lote: generados pero CSV no descargado aún)
  const lotes = [...new Set(con_etapa.filter(f => f.etapa === 'en_lote').map(f => f.liga_lote))]

  res.json({ conteos, lotes, inscripciones: con_etapa })
})

// ── POST /banorte/lote — generar nuevo lote (hasta 95) ───────────────────────

router.post('/lote', requireAuth, async (req, res) => {
  if (!puedeAcceder(req.user)) return res.status(403).json({ error: 'Sin permiso' })

  const plantelIds = await plantelesAccesibles(req.user)
  const cfg = await queryOne("SELECT value FROM config WHERE key = 'costo_inscripcion'")
  const costoDefault = cfg ? parseFloat(cfg.value) || 1500 : 1500
  const precioMap = await buildPrecioMap()

  // Inscripciones pendientes (grupo asignado, sin lote)
  let sql = `
    SELECT i.id, i.folio, i.plantel_id, i.grupo_id, i.oferta_id, i.liga_monto,
           COALESCE(u.nombre, i.nombre_externo) AS nombre,
           COALESCE(u.email, i.email_externo) AS email,
           g.idioma_id, o.categoria,
           p.monto AS pago_monto
    FROM inscripciones i
    LEFT JOIN usuarios u ON u.id = i.alumno_id
    LEFT JOIN grupos g ON g.id = i.grupo_id
    LEFT JOIN ofertas o ON o.id = i.oferta_id
    LEFT JOIN pagos p ON p.inscripcion_id = i.id AND p.estado = 'pendiente'
    WHERE i.estado NOT IN ('baja', 'pagada')
      AND i.grupo_id IS NOT NULL
      AND i.liga_lote IS NULL
  `
  const params = []
  sql = addPlantelFiltro(sql, params, plantelIds)
  sql += ` LIMIT ${MAX_LOTE}`

  const filas = await query(sql, params)
  if (filas.length === 0) return res.status(400).json({ error: 'No hay inscripciones pendientes con grupo asignado' })

  // Nombre del lote: LJ-YYYYMM-N
  const hoy = new Date()
  const yymm = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const existentes = await query(
    "SELECT DISTINCT liga_lote FROM inscripciones WHERE liga_lote LIKE $1",
    [`LJ-${yymm}-%`]
  )
  const loteNum = existentes.length + 1
  const loteNombre = `LJ-${yymm}-${loteNum}`

  // Asignar referencias consecutivas
  const primerRef = await siguienteReferencia()
  const baseNum = parseInt(primerRef.replace('LJ-', ''), 10)

  const csvLineas = ['Email,Monto,Referencia,Referencia2']
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i]
    const referencia = `LJ-${baseNum + i}`
    const monto = await resolverMonto(f, precioMap, costoDefault)
    const email = (f.email || '').replace(/,/g, '')
    const nombre = (f.nombre || 'Alumno').replace(/,/g, ' ')

    // Guardar en libro de referencias (quemada, no se reutiliza)
    await run(
      'INSERT INTO referencias_emitidas (referencia, inscripcion_id, lote) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [referencia, f.id, loteNombre]
    )

    // Actualizar inscripción
    await run(
      'UPDATE inscripciones SET liga_lote = $1, liga_referencia = $2, liga_monto = $3 WHERE id = $4',
      [loteNombre, referencia, monto, f.id]
    )

    csvLineas.push(`${email},${monto},${referencia},${nombre}`)
  }

  const csv = '﻿' + csvLineas.join('\r\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${loteNombre}.csv"`)
  res.send(csv)
})

// ── POST /banorte/lote/bajado — marcar que el CSV fue descargado ──────────────

router.post('/lote/bajado', requireAuth, async (req, res) => {
  if (!puedeAcceder(req.user)) return res.status(403).json({ error: 'Sin permiso' })

  const { lote } = req.body
  if (!lote) return res.status(400).json({ error: 'Se requiere el nombre del lote' })

  const { n } = await queryOne(
    "SELECT COUNT(*) AS n FROM inscripciones WHERE liga_lote = $1 AND liga_bajado_en IS NULL",
    [lote]
  ) || { n: 0 }

  if (parseInt(n) === 0) return res.status(400).json({ error: 'El lote no existe o ya fue marcado como bajado' })

  await run(
    'UPDATE inscripciones SET liga_bajado_en = NOW() WHERE liga_lote = $1 AND liga_bajado_en IS NULL',
    [lote]
  )

  res.json({ ok: true, lote, marcadas: parseInt(n) })
})

// ── PATCH /banorte/ligas — cargar ligas de vuelta desde Banorte ───────────────
// Body: [{ referencia, liga_pago }]

router.patch('/ligas', requireAuth, async (req, res) => {
  if (!puedeAcceder(req.user)) return res.status(403).json({ error: 'Sin permiso' })

  const { ligas } = req.body
  if (!Array.isArray(ligas) || ligas.length === 0) {
    return res.status(400).json({ error: 'Se requiere un arreglo de ligas' })
  }

  let cargadas = 0, noEncontradas = 0
  const errores = []

  for (const { referencia, liga_pago } of ligas) {
    if (!referencia || !liga_pago) continue
    const insc = await queryOne(
      'SELECT id FROM inscripciones WHERE liga_referencia = $1',
      [String(referencia).trim()]
    )
    if (!insc) { noEncontradas++; errores.push(referencia); continue }
    await run(
      'UPDATE inscripciones SET liga_pago = $1, liga_pago_cargada_en = NOW() WHERE id = $2',
      [liga_pago.trim(), insc.id]
    )
    cargadas++
  }

  res.json({ ok: true, cargadas, noEncontradas, errores })
})

// ── PUT /banorte/ligas/avisar — enviar correos SIN la liga ────────────────────
// El correo avisa que la liga está lista; el alumno entra al portal a verla.
// (La liga nunca viaja por correo para evitar que alguien más pague)

router.put('/ligas/avisar', requireAuth, async (req, res) => {
  if (!puedeAcceder(req.user)) return res.status(403).json({ error: 'Sin permiso' })

  const { ids } = req.body // array de ids de inscripciones; si vacío, avisa todas con liga sin avisar
  const plantelIds = await plantelesAccesibles(req.user)

  let sql = `
    SELECT i.id, i.folio, i.plantel_id, i.liga_monto,
           COALESCE(u.nombre, i.nombre_externo) AS nombre,
           COALESCE(u.email, i.email_externo) AS email
    FROM inscripciones i
    LEFT JOIN usuarios u ON u.id = i.alumno_id
    WHERE i.liga_pago IS NOT NULL AND i.liga_avisada_en IS NULL
  `
  const params = []
  if (ids && ids.length > 0) {
    const ph = ids.map((_, i) => `$${i + 1}`).join(',')
    params.push(...ids)
    sql += ` AND i.id IN (${ph})`
  }
  if (plantelIds) {
    const ph = plantelIds.map((_, i) => `$${params.length + i + 1}`).join(',')
    params.push(...plantelIds)
    sql += ` AND i.plantel_id IN (${ph})`
  }

  const filas = await query(sql, params)
  if (filas.length === 0) return res.status(400).json({ error: 'No hay inscripciones con liga sin avisar' })

  const nodemailer = require('nodemailer')
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })

  const portalUrl = process.env.PORTAL_URL || 'https://lengua-joven.vercel.app'
  let enviados = 0, fallidos = 0

  for (const f of filas) {
    if (!f.email) { fallidos++; continue }

    const nombreCorto = String(f.nombre || '').trim().split(/\s+/)[0] || 'Alumno'
    const monto = f.liga_monto ? `$${Number(f.liga_monto).toLocaleString('es-MX')}` : ''

    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#F18B11;margin:0;font-size:24px">Lengua Joven</h1>
    <p style="color:#fff;margin:8px 0 0;opacity:.8">Tu liga de pago está lista</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #eee">
    <p style="font-size:16px;color:#333">Hola <strong>${nombreCorto}</strong>,</p>
    <p style="color:#555">
      Tu liga de pago Banorte ya está disponible en el portal.${monto ? ` El monto a pagar es <strong>${monto}</strong>.` : ''}
    </p>
    <p style="color:#555">
      Ingresa al portal con tu usuario y contraseña para ver tu liga de pago personalizada.
    </p>
    <div style="text-align:center;margin:32px 0">
      <a href="${portalUrl}" style="background:#F18B11;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
        Ir al portal
      </a>
    </div>
    <div style="background:#f8f9fa;border-radius:8px;padding:16px">
      <p style="margin:0;font-size:13px;color:#666">
        Folio: <strong>${f.folio}</strong><br>
        • La liga es de uso único y personal<br>
        • Puedes pagar con tarjeta de crédito o débito<br>
        • Si tienes dudas, contáctanos a <a href="mailto:${process.env.GMAIL_USER}">${process.env.GMAIL_USER}</a>
      </p>
    </div>
  </div>
  <div style="background:#f5f5f5;padding:16px;border-radius:0 0 12px 12px;text-align:center">
    <p style="margin:0;font-size:12px;color:#999">Lengua Joven · INJUVE Nuevo León</p>
  </div>
</div>`

    try {
      await transporter.sendMail({
        from: `"Lengua Joven" <${process.env.GMAIL_USER}>`,
        to: f.email,
        subject: `Tu liga de pago está lista — Folio ${f.folio}`,
        html,
      })
      await run('UPDATE inscripciones SET liga_avisada_en = NOW() WHERE id = $1', [f.id])
      enviados++
    } catch (err) {
      console.error('sendMail error:', err.message)
      fallidos++
    }
  }

  res.json({ ok: true, enviados, fallidos })
})

// ── DELETE /banorte/lote — devolver inscripciones al estado pendiente ──────────
// ?rehacer=1 también borra la referencia para que se genere una nueva

router.delete('/lote', requireAuth, async (req, res) => {
  if (!puedeAcceder(req.user)) return res.status(403).json({ error: 'Sin permiso' })

  const { lote, rehacer } = req.body
  if (!lote) return res.status(400).json({ error: 'Se requiere el nombre del lote' })

  await run(
    `UPDATE inscripciones
     SET liga_lote = NULL, liga_bajado_en = NULL
     ${rehacer ? ', liga_referencia = NULL, liga_monto = NULL, liga_pago = NULL, liga_pago_cargada_en = NULL' : ''}
     WHERE liga_lote = $1`,
    [lote]
  )

  if (rehacer) {
    await run('DELETE FROM referencias_emitidas WHERE lote = $1', [lote])
  }

  res.json({ ok: true, lote, rehacer: !!rehacer })
})

module.exports = router
