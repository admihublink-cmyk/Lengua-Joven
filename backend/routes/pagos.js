const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const me = req.user
  const { alumno_id, inscripcion_id } = req.query
  let sql = 'SELECT * FROM pagos WHERE 1=1'
  const vals = []
  if (me.rol === 'alumno') {
    sql += ' AND alumno_id = ?'; vals.push(me.id)
  } else if (me.rol === 'tutor') {
    const alumnos = me.alumnos || []
    if (alumnos.length === 0) return res.json([])
    sql += ` AND alumno_id IN (${alumnos.map(() => '?').join(',')})`
    vals.push(...alumnos)
    // Tutores solo ven pagos pendientes
    sql += " AND estado = 'pendiente'"
    if (alumno_id) { sql += ' AND alumno_id = ?'; vals.push(alumno_id) }
  } else {
    if (alumno_id) { sql += ' AND alumno_id = ?'; vals.push(alumno_id) }
    if (inscripcion_id) { sql += ' AND inscripcion_id = ?'; vals.push(inscripcion_id) }
  }
  res.json(db.prepare(sql + ' ORDER BY fecha DESC').all(...vals))
})

router.post('/', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { alumno_id, inscripcion_id, monto, fecha, estado, metodo_pago, referencia } = req.body
  const ids = db.prepare('SELECT id FROM pagos').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('pag', '')) || 0), 0)
  const newId = 'pag' + (max + 1)
  db.prepare('INSERT INTO pagos VALUES (?,?,?,?,?,?,?,?)').run(
    newId, alumno_id || null, inscripcion_id || null, parseFloat(monto),
    fecha || null, estado || 'pendiente', metodo_pago || null, referencia || ''
  )
  res.status(201).json(db.prepare('SELECT * FROM pagos WHERE id = ?').get(newId))
})

router.get('/txt', requireAuth, (req, res) => {
  if (!['superadmin', 'director'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const { desde, hasta } = req.query
  let sql = `SELECT p.*, u.nombre as alumno_nombre, u.email as alumno_email,
             i.folio as inscripcion_folio
             FROM pagos p
             LEFT JOIN usuarios u ON p.alumno_id = u.id
             LEFT JOIN inscripciones i ON p.inscripcion_id = i.id
             WHERE 1=1`
  const vals = []
  if (desde) { sql += ' AND p.fecha >= ?'; vals.push(desde) }
  if (hasta) { sql += ' AND p.fecha <= ?'; vals.push(hasta) }
  sql += ' ORDER BY p.fecha DESC'
  const rows = db.prepare(sql).all(...vals)

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

  const nombreArchivo = `pagos_${desde || 'inicio'}_al_${hasta || 'hoy'}.txt`
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`)
  res.send(lineas.join('\n'))
})

// Importar pagos masivos desde CSV (acepta array JSON de filas)
router.post('/importar-csv', requireAuth, (req, res) => {
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
      const u = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.trim().toLowerCase())
      if (u) {
        alumno_id = u.id
        const ins = db.prepare("SELECT id FROM inscripciones WHERE alumno_id = ? ORDER BY fecha_registro DESC LIMIT 1").get(u.id)
        if (ins) inscripcion_id = ins.id
      }
    }

    const ids = db.prepare('SELECT id FROM pagos').all().map(r => r.id)
    const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace(/\D/g, '')) || 0), 0)
    const newId = 'pag' + (max + 1)

    db.prepare('INSERT INTO pagos VALUES (?,?,?,?,?,?,?,?)').run(
      newId, alumno_id, inscripcion_id,
      parseFloat(monto) || 0,
      fecha || new Date().toISOString().slice(0, 10),
      'pagado', metodo_pago || 'efectivo', referencia || ''
    )
    resultados.push({ id: newId, email, nombre, ok: true })
  }

  res.json({ importados: resultados.length, detalle: resultados })
})

router.put('/:id', requireAuth, (req, res) => {
  const { monto, fecha, estado, metodo_pago, referencia } = req.body
  const sets = []; const vals = []
  if (monto !== undefined) { sets.push('monto = ?'); vals.push(monto) }
  if (fecha !== undefined) { sets.push('fecha = ?'); vals.push(fecha) }
  if (estado !== undefined) { sets.push('estado = ?'); vals.push(estado) }
  if (metodo_pago !== undefined) { sets.push('metodo_pago = ?'); vals.push(metodo_pago) }
  if (referencia !== undefined) { sets.push('referencia = ?'); vals.push(referencia) }
  if (sets.length) db.prepare(`UPDATE pagos SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM pagos WHERE id = ?').get(req.params.id))
})

module.exports = router
