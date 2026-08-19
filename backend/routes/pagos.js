const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  const { alumno_id, inscripcion_id } = req.query
  let sql = 'SELECT * FROM pagos WHERE 1=1'
  const vals = []
  if (me.rol === 'alumno') {
    sql += ' AND alumno_id = $1'; vals.push(me.id)
  } else if (me.rol === 'tutor') {
    const alumnos = me.alumnos || []
    if (alumnos.length === 0) return res.json([])
    const placeholders = alumnos.map((_, i) => `$${i + 1}`).join(',')
    sql += ` AND alumno_id IN (${placeholders})`
    vals.push(...alumnos)
    // Tutores solo ven pagos pendientes
    sql += ` AND estado = 'pendiente'`
    if (alumno_id) { sql += ` AND alumno_id = $${vals.length + 1}`; vals.push(alumno_id) }
  } else {
    if (alumno_id) { sql += ` AND alumno_id = $${vals.length + 1}`; vals.push(alumno_id) }
    if (inscripcion_id) { sql += ` AND inscripcion_id = $${vals.length + 1}`; vals.push(inscripcion_id) }
  }
  res.json(await query(sql + ' ORDER BY fecha DESC', vals))
})

router.post('/', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { alumno_id, inscripcion_id, monto, fecha, estado, metodo_pago, referencia } = req.body

  // Validar monto
  const montoNum = parseFloat(monto)
  if (monto === undefined || monto === null || monto === '' || isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número positivo' })
  }

  // Director y coordinador solo pueden registrar pagos de inscripciones/alumnos de sus planteles
  if (['director', 'coordinador'].includes(me.rol)) {
    let plantelPago = null
    if (inscripcion_id) {
      const ins = await queryOne('SELECT plantel_id FROM inscripciones WHERE id = $1', [inscripcion_id])
      plantelPago = ins?.plantel_id
    } else if (alumno_id) {
      const alu = await queryOne('SELECT plantel_id FROM usuarios WHERE id = $1', [alumno_id])
      plantelPago = alu?.plantel_id
    }
    if (plantelPago) {
      if (me.rol === 'director' && plantelPago !== me.plantel_id) {
        return res.status(403).json({ error: 'Sin permiso para este plantel' })
      }
      if (me.rol === 'coordinador') {
        const asignados = me.planteles || []
        if (!asignados.includes(plantelPago) && plantelPago !== me.plantel_id) {
          return res.status(403).json({ error: 'Sin permiso para este plantel' })
        }
      }
    }
  }

  const { m: maxNum } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 4) AS INTEGER)), 0) AS m FROM pagos WHERE id ~ '^pag[0-9]+'`, []
  )
  const newId = 'pag' + (maxNum + 1)
  await run(
    'INSERT INTO pagos (id, alumno_id, inscripcion_id, monto, fecha, estado, metodo_pago, referencia) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [newId, alumno_id || null, inscripcion_id || null, montoNum, fecha || null, estado || 'pendiente', metodo_pago || null, referencia || '']
  )
  res.status(201).json(await queryOne('SELECT * FROM pagos WHERE id = $1', [newId]))
})

router.get('/txt', requireAuth, async (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { desde, hasta } = req.query
  let sql = `SELECT p.*, u.nombre as alumno_nombre, u.email as alumno_email,
             i.folio as inscripcion_folio
             FROM pagos p
             LEFT JOIN usuarios u ON p.alumno_id = u.id
             LEFT JOIN inscripciones i ON p.inscripcion_id = i.id
             WHERE 1=1`
  const vals = []
  if (desde) { sql += ` AND p.fecha >= $${vals.length + 1}`; vals.push(desde) }
  if (hasta) { sql += ` AND p.fecha <= $${vals.length + 1}`; vals.push(hasta) }
  sql += ' ORDER BY p.fecha DESC'
  const rows = await query(sql, vals)

  const totalPagado = rows.filter(r => r.estado === 'pagado').reduce((s, r) => s + (r.monto || 0), 0)
  const sep = '='.repeat(62)
  const lineas = [
    sep,
    '  REPORTE DE PAGOS — LENGUA JOVEN',
    sep,
    `  Generado:      ${new Date().toLocaleString('es-MX')}`,
    desde || hasta ? `  Período:      ${desde || '(inicio)'} → ${hasta || '(hoy)'}` : '  Período:      Todos los registros',
    `  Total pagos:   ${rows.length}`,
    `  Total pagado:  $${totalPagado.toLocaleString('es-MX')}`,
    sep,
    '',
  ]

  for (const r of rows) {
    lineas.push(`Folio inscripción: ${r.inscripcion_folio || '—'}`)
    lineas.push(`  Alumno:    ${r.alumno_nombre || r.alumno_id || '—'} <${r.alumno_email || '—'}>`)
    lineas.push(`  Monto:     $${(r.monto || 0).toLocaleString('es-MX')}`)
    lineas.push(`  Método:    ${r.metodo_pago || '—'}`)
    lineas.push(`  Referencia:${r.referencia || '—'}`)
    lineas.push(`  Fecha:     ${r.fecha || '—'}`)
    lineas.push(`  Estado:    ${r.estado}`)
    lineas.push('')
  }

  if (rows.length === 0) lineas.push('(Sin pagos en el período seleccionado)')

  const sanitize = s => (s || '').replace(/[^a-zA-Z0-9_\-]/g, '_')
  const nombreArchivo = `pagos_${sanitize(desde) || 'inicio'}_al_${sanitize(hasta) || 'hoy'}.txt`
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`)
  res.send(lineas.join('\n'))
})

// Importar pagos masivos desde CSV (acepta array JSON de filas)
router.post('/importar-csv', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { filas } = req.body
  if (!Array.isArray(filas) || filas.length === 0) return res.status(400).json({ error: 'Sin filas' })

  const resultados = []
  for (const fila of filas) {
    const { email, nombre, monto, fecha, metodo_pago, referencia } = fila
    let alumno_id = null
    let inscripcion_id = null

    if (email) {
      const u = await queryOne('SELECT id FROM usuarios WHERE email = $1', [email.trim().toLowerCase()])
      if (u) {
        alumno_id = u.id
        const ins = await queryOne('SELECT id FROM inscripciones WHERE alumno_id = $1 ORDER BY fecha_registro DESC LIMIT 1', [u.id])
        if (ins) inscripcion_id = ins.id
      }
    }

    const { m: maxNum } = await queryOne(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 4) AS INTEGER)), 0) AS m FROM pagos WHERE id ~ '^pag[0-9]+'`, []
    )
    const newId = 'pag' + (maxNum + 1)

    await run(
      'INSERT INTO pagos (id, alumno_id, inscripcion_id, monto, fecha, estado, metodo_pago, referencia) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [newId, alumno_id, inscripcion_id,
       Math.max(0, parseFloat(monto) || 0),
       fecha || new Date().toISOString().slice(0, 10),
       'pagado', metodo_pago || 'efectivo', referencia || '']
    )
    resultados.push({ id: newId, email, nombre, ok: true })
  }

  res.json({ importados: resultados.length, detalle: resultados })
})

router.put('/:id', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }

  // Director y coordinador solo pueden modificar pagos de inscripciones de sus planteles
  if (['director', 'coordinador'].includes(me.rol)) {
    const pago = await queryOne('SELECT inscripcion_id FROM pagos WHERE id = $1', [req.params.id])
    if (pago?.inscripcion_id) {
      const ins = await queryOne('SELECT plantel_id FROM inscripciones WHERE id = $1', [pago.inscripcion_id])
      if (ins) {
        if (me.rol === 'director' && ins.plantel_id !== me.plantel_id) {
          return res.status(403).json({ error: 'Sin permiso para este plantel' })
        }
        if (me.rol === 'coordinador') {
          const asignados = me.planteles || []
          if (!asignados.includes(ins.plantel_id) && ins.plantel_id !== me.plantel_id) {
            return res.status(403).json({ error: 'Sin permiso para este plantel' })
          }
        }
      }
    }
  }

  const { monto, fecha, estado, metodo_pago, referencia } = req.body
  const ESTADOS_VALIDOS = ['pendiente', 'pagado', 'cancelado']
  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}` })
  }
  const sets = []; const vals = []
  if (monto !== undefined) { sets.push(`monto = $${sets.length + 1}`); vals.push(monto) }
  if (fecha !== undefined) { sets.push(`fecha = $${sets.length + 1}`); vals.push(fecha) }
  if (estado !== undefined) { sets.push(`estado = $${sets.length + 1}`); vals.push(estado) }
  if (metodo_pago !== undefined) { sets.push(`metodo_pago = $${sets.length + 1}`); vals.push(metodo_pago) }
  if (referencia !== undefined) { sets.push(`referencia = $${sets.length + 1}`); vals.push(referencia) }
  if (sets.length) await run(`UPDATE pagos SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  res.json(await queryOne('SELECT * FROM pagos WHERE id = $1', [req.params.id]))
})

module.exports = router
