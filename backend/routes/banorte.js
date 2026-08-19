const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const { enviarBienvenida } = require('../services/email')

// Exportar CSV con el formato que Banorte necesita para generar ligas de pago
// Campos: referencia (folio), monto, nombre, email
router.get('/exportar-csv', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }

  const me = req.user
  let sql = `
    SELECT i.folio, i.id as inscripcion_id, i.plantel_id, i.grupo_id,
           COALESCE(u.nombre, i.nombre_externo) as nombre,
           COALESCE(u.email, i.email_externo) as email,
           p.monto as pago_monto, p.estado as pago_estado
    FROM inscripciones i
    LEFT JOIN usuarios u ON u.id = i.alumno_id
    LEFT JOIN pagos p ON p.inscripcion_id = i.id
    WHERE i.estado NOT IN ('baja', 'pagada') AND (p.estado = 'pendiente' OR p.estado IS NULL)
  `
  const params = []
  if (me.rol !== 'superadmin') {
    if (me.rol === 'coordinador') {
      const pids = (await query('SELECT plantel_id FROM coordinador_planteles WHERE coordinador_id = $1', [me.id])).map(r => r.plantel_id)
      if (me.plantel_id && !pids.includes(me.plantel_id)) pids.push(me.plantel_id)
      if (pids.length === 0) return res.setHeader('Content-Type', 'text/csv; charset=utf-8').send('REFERENCIA,MONTO,NOMBRE,EMAIL\r\n')
      const ph = pids.map((_, i) => `$${i + 1}`).join(',')
      sql += ` AND i.plantel_id IN (${ph})`
      params.push(...pids)
    } else {
      sql += ` AND i.plantel_id = $${params.length + 1}`
      params.push(me.plantel_id)
    }
  }

  const filas = await query(sql, params)
  const cfg = await queryOne("SELECT value FROM config WHERE key = 'costo_inscripcion'")
  const costoDefault = cfg ? parseFloat(cfg.value) || 1500 : 1500

  // Precios configurados por plantel + idioma
  const preciosRows = await query('SELECT * FROM precios')
  const precioMap = {}
  for (const p of preciosRows) precioMap[`${p.plantel_id}|${p.idioma_id}`] = p.monto

  // Idioma de cada grupo (para buscar en precioMap)
  const grupoIds = [...new Set(filas.map(f => f.grupo_id).filter(Boolean))]
  const grupoIdiomas = grupoIds.length
    ? await query(`SELECT g.id, g.idioma_id FROM grupos g WHERE g.id = ANY($1)`, [grupoIds])
    : []
  const grupoIdiomaMap = {}
  for (const g of grupoIdiomas) grupoIdiomaMap[g.id] = g.idioma_id

  // Generar CSV
  const lineas = ['REFERENCIA,MONTO,NOMBRE,EMAIL']
  for (const f of filas) {
    let monto = f.pago_monto  // monto ya registrado en tabla pagos
    if (!monto) {
      const idiomaId = grupoIdiomaMap[f.grupo_id]
      if (f.plantel_id && idiomaId) monto = precioMap[`${f.plantel_id}|${idiomaId}`]
    }
    if (!monto) monto = costoDefault
    const nombre = (f.nombre || 'Alumno').replace(/,/g, ' ')
    const email = (f.email || '').replace(/,/g, '')
    lineas.push(`${f.folio},${monto},${nombre},${email}`)
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="banorte_referencias.csv"')
  res.send('﻿' + lineas.join('\r\n')) // BOM para Excel en Windows
})

// Cargar el Excel de Banorte con las ligas de pago
// Banorte regresa: REFERENCIA (folio) y LIGA_PAGO (URL)
// El frontend parsea el Excel y manda JSON: [{ referencia, liga_pago }]
router.post('/cargar-ligas', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }

  const { ligas } = req.body // [{ referencia, liga_pago }]
  if (!Array.isArray(ligas) || ligas.length === 0) {
    return res.status(400).json({ error: 'Se requiere un arreglo de ligas' })
  }

  let actualizadas = 0
  let noEncontradas = 0
  const errores = []

  for (const { referencia, liga_pago } of ligas) {
    if (!referencia || !liga_pago) continue
    const insc = await queryOne('SELECT id FROM inscripciones WHERE folio = $1', [String(referencia).trim()])
    if (!insc) { noEncontradas++; errores.push(referencia); continue }
    await run('UPDATE inscripciones SET liga_pago = $1 WHERE id = $2', [liga_pago.trim(), insc.id])
    actualizadas++
  }

  res.json({ ok: true, actualizadas, noEncontradas, errores })
})

// Enviar liga de pago por correo al alumno
router.post('/enviar-liga/:inscripcionId', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }

  const insc = await queryOne(`
    SELECT i.*, COALESCE(u.nombre, i.nombre_externo) as nombre_alumno,
           COALESCE(u.email, i.email_externo) as email_alumno
    FROM inscripciones i
    LEFT JOIN usuarios u ON u.id = i.alumno_id
    WHERE i.id = $1
  `, [req.params.inscripcionId])

  if (!insc) return res.status(404).json({ error: 'Inscripción no encontrada' })
  if (!insc.liga_pago) return res.status(400).json({ error: 'Esta inscripción no tiene liga de pago asignada' })
  if (!insc.email_alumno) return res.status(400).json({ error: 'El alumno no tiene correo registrado' })

  const nodemailer = require('nodemailer')
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  })

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="color:#F18B11;margin:0;font-size:24px">Lengua Joven</h1>
      <p style="color:#fff;margin:8px 0 0;opacity:.8">Tu liga de pago está lista</p>
    </div>
    <div style="background:#fff;padding:32px;border:1px solid #eee">
      <p style="font-size:16px;color:#333">Hola <strong>${insc.nombre_alumno}</strong>,</p>
      <p style="color:#555">Tu folio de inscripción es <strong>${insc.folio}</strong>. A continuación encontrarás tu liga de pago segura de Banorte:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${insc.liga_pago}" style="background:#F18B11;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
          💳 Pagar ahora
        </a>
      </div>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#666">
          • La liga es de uso único y personal<br>
          • Puedes pagar con tarjeta de crédito o débito<br>
          • Recibirás confirmación de pago directamente de Banorte<br>
          • Si tienes problemas, contáctanos a <a href="mailto:${process.env.GMAIL_USER}">${process.env.GMAIL_USER}</a>
        </p>
      </div>
      <p style="font-size:13px;color:#999">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
        <a href="${insc.liga_pago}" style="color:#F18B11;word-break:break-all">${insc.liga_pago}</a>
      </p>
    </div>
    <div style="background:#f5f5f5;padding:16px;border-radius:0 0 12px 12px;text-align:center">
      <p style="margin:0;font-size:12px;color:#999">Lengua Joven · INJUVE Nuevo León</p>
    </div>
  </div>`

  try {
    await transporter.sendMail({
      from: `"Lengua Joven" <${process.env.GMAIL_USER}>`,
      to: insc.email_alumno,
      subject: `Tu liga de pago Lengua Joven — Folio ${insc.folio}`,
      html,
    })
  } catch (mailErr) {
    console.error('sendMail error:', mailErr)
    return res.status(502).json({ error: 'No se pudo enviar el correo. Verifica las credenciales de Gmail.' })
  }

  // Marcar que se envió la liga
  await run("UPDATE pagos SET estado = 'liga_enviada' WHERE inscripcion_id = $1 AND estado = 'pendiente'", [insc.id])

  res.json({ ok: true, enviado_a: insc.email_alumno })
})

module.exports = router
