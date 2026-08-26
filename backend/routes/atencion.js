const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

// ── Categorías y auto-asignación de área ──────────────────────────────────────
const CATEGORIAS = [
  'inscripcion_reinscripcion',
  'pagos_facturacion',
  'becas',
  'constancias_documentos',
  'problemas_academicos',
  'problemas_profesores',
  'problemas_plataforma',
  'quejas',
  'sugerencias',
  'otro',
]

const AREA_ROL = {
  inscripcion_reinscripcion: 'coordinador',
  pagos_facturacion: 'admin_ventas',
  becas: 'coordinador',
  constancias_documentos: 'coordinador',
  problemas_academicos: 'coordinador',
  problemas_profesores: 'coordinador',
  problemas_plataforma: 'superadmin',
  quejas: 'superadmin',
  sugerencias: 'coordinador',
  otro: 'coordinador',
}

const ROLES_GESTIONAR = ['superadmin', 'director', 'coordinador', 'admin_ventas']

function esGestor(user) { return ROLES_GESTIONAR.includes(user.rol) }

// ── Multer ────────────────────────────────────────────────────────────────────
const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx']

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(
      process.env.UPLOADS_PATH || path.join(__dirname, '..', 'uploads'),
      'atencion',
      req._solicitudId || 'tmp'
    )
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, Date.now() + '_' + crypto.randomBytes(4).toString('hex') + ext)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED_MIMES.includes(file.mimetype) || !ALLOWED_EXTS.includes(ext)) {
      return cb(new Error('Tipo de archivo no permitido. Se aceptan PDF, JPG, PNG, DOC y DOCX.'))
    }
    cb(null, true)
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────
async function generarFolio() {
  const year = new Date().getFullYear()
  const { n } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM LENGTH($1) + 1) AS INTEGER)), 0) AS n
     FROM atencion_solicitudes WHERE id LIKE $2`,
    [`AT-${year}-`, `AT-${year}-%`]
  ) || { n: 0 }
  const seq = String(parseInt(n) + 1).padStart(6, '0')
  return `AT-${year}-${seq}`
}

async function crearNotificacion(usuarioId, tipo, mensaje, solicitudId) {
  try {
    const id = 'not' + Date.now() + Math.random().toString(36).slice(2, 5)
    await run(
      `INSERT INTO notificaciones (id, usuario_id, tipo, mensaje, fecha, leida, meta)
       VALUES ($1,$2,$3,$4,$5,0,$6)`,
      [id, usuarioId, tipo, mensaje, new Date().toISOString(),
       JSON.stringify({ solicitud_id: solicitudId })]
    )
  } catch (_) { /* notificaciones no bloquean el flujo */ }
}

async function autoAsignar(categoria, plantelId) {
  const rolTarget = AREA_ROL[categoria] || 'coordinador'
  try {
    // Buscar agente del rol en el mismo plantel primero; luego cualquier superadmin
    const candidatos = await query(
      `SELECT id FROM usuarios WHERE rol = $1 AND activo = 1
       AND (plantel_id = $2 OR $2 IS NULL OR rol = 'superadmin')
       ORDER BY (plantel_id = $2) DESC NULLS LAST, id LIMIT 1`,
      [rolTarget, plantelId || null]
    )
    if (candidatos.length) return candidatos[0].id
    // Fallback: cualquier superadmin
    const sa = await queryOne(`SELECT id FROM usuarios WHERE rol = 'superadmin' AND activo = 1 LIMIT 1`)
    return sa?.id || null
  } catch (_) { return null }
}

async function adjuntosDeMsg(mensajeId) {
  try {
    return await query('SELECT * FROM atencion_adjuntos WHERE mensaje_id = $1 ORDER BY creado_en', [mensajeId])
  } catch (_) { return [] }
}

async function adjuntosDeSolicitud(solicitudId) {
  try {
    return await query('SELECT * FROM atencion_adjuntos WHERE solicitud_id = $1 AND mensaje_id IS NULL ORDER BY creado_en', [solicitudId])
  } catch (_) { return [] }
}

// ── GET /api/atencion/solicitudes ─────────────────────────────────────────────
// Alumno ve sus propias. Gestor ve todas (con filtros).
router.get('/solicitudes', requireAuth, async (req, res) => {
  const me = req.user
  const { estado, categoria, prioridad, asignado_a, q, limit = 50, offset = 0 } = req.query

  let where = []
  let params = []
  let i = 1

  if (!esGestor(me)) {
    where.push(`s.alumno_id = $${i++}`); params.push(me.id)
  } else {
    if (me.rol === 'director' && me.plantel_id) {
      where.push(`s.plantel_id = $${i++}`); params.push(me.plantel_id)
    }
    if (estado)      { where.push(`s.estado = $${i++}`);      params.push(estado) }
    if (categoria)   { where.push(`s.categoria = $${i++}`);   params.push(categoria) }
    if (prioridad)   { where.push(`s.prioridad = $${i++}`);   params.push(prioridad) }
    if (asignado_a)  { where.push(`s.asignado_a = $${i++}`);  params.push(asignado_a) }
    if (q)           { where.push(`(s.id ILIKE $${i} OR s.titulo ILIKE $${i} OR s.descripcion ILIKE $${i})`); params.push(`%${q}%`); i++ }
  }

  const cond = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const rows = await query(
    `SELECT s.*,
       u.nombre AS alumno_nombre, u.email AS alumno_email, u.plantel_id AS alumno_plantel_id,
       p.nombre AS plantel_nombre,
       a.nombre AS agente_nombre,
       (SELECT COUNT(*) FROM atencion_mensajes m WHERE m.solicitud_id = s.id AND m.interno = 0) AS num_mensajes,
       (SELECT MAX(m.creado_en) FROM atencion_mensajes m WHERE m.solicitud_id = s.id) AS ultimo_mensaje
     FROM atencion_solicitudes s
     LEFT JOIN usuarios u ON u.id = s.alumno_id
     LEFT JOIN planteles p ON p.id = s.plantel_id
     LEFT JOIN usuarios a ON a.id = s.asignado_a
     ${cond}
     ORDER BY
       CASE s.estado WHEN 'nueva' THEN 0 WHEN 'recibida' THEN 1 WHEN 'en_revision' THEN 2
         WHEN 'esperando_informacion' THEN 3 WHEN 'en_proceso' THEN 4 ELSE 5 END,
       CASE s.prioridad WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
       s.creado_en DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, parseInt(limit), parseInt(offset)]
  )

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM atencion_solicitudes s ${cond}`, params
  )

  res.json({ rows, total: parseInt(total) })
})

// ── GET /api/atencion/dashboard (solo gestores) ───────────────────────────────
router.get('/dashboard', requireAuth, async (req, res) => {
  if (!esGestor(req.user)) return res.status(403).json({ error: 'Sin permiso' })

  const plantelFilter = req.user.rol === 'director' && req.user.plantel_id
    ? `WHERE plantel_id = '${req.user.plantel_id}'` : ''

  const estados = await query(
    `SELECT estado, COUNT(*) AS n FROM atencion_solicitudes ${plantelFilter}
     GROUP BY estado`
  )
  const porCategoria = await query(
    `SELECT categoria, COUNT(*) AS n FROM atencion_solicitudes ${plantelFilter}
     GROUP BY categoria ORDER BY n DESC`
  )
  const recientes = await query(
    `SELECT s.id, s.titulo, s.categoria, s.estado, s.prioridad, s.creado_en,
            u.nombre AS alumno_nombre
     FROM atencion_solicitudes s
     LEFT JOIN usuarios u ON u.id = s.alumno_id
     ${plantelFilter}
     ORDER BY s.creado_en DESC LIMIT 10`
  )

  const conteo = {}
  for (const r of estados) conteo[r.estado] = parseInt(r.n)

  res.json({
    nueva: conteo.nueva || 0,
    recibida: conteo.recibida || 0,
    en_revision: conteo.en_revision || 0,
    esperando_informacion: conteo.esperando_informacion || 0,
    en_proceso: conteo.en_proceso || 0,
    resuelta: conteo.resuelta || 0,
    cerrada: conteo.cerrada || 0,
    total: Object.values(conteo).reduce((a, b) => a + b, 0),
    porCategoria,
    recientes,
  })
})

// ── POST /api/atencion/solicitudes (crear) ────────────────────────────────────
router.post('/solicitudes', requireAuth, (req, res) => {
  // necesitamos el folio antes de que multer guarde los archivos
  ;(async () => {
    const folio = await generarFolio()
    req._solicitudId = folio
    upload.array('adjuntos', 5)(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message })

      const { categoria, titulo, descripcion, confidencial } = req.body
      if (!categoria || !CATEGORIAS.includes(categoria))
        return res.status(400).json({ error: 'Categoría inválida' })
      if (!titulo?.trim())       return res.status(400).json({ error: 'Título requerido' })
      if (!descripcion?.trim())  return res.status(400).json({ error: 'Descripción requerida' })

      const me = req.user
      const ahora = new Date().toISOString()
      const asignadoA = await autoAsignar(categoria, me.plantel_id)

      await run(
        `INSERT INTO atencion_solicitudes
           (id, alumno_id, categoria, titulo, descripcion, estado, prioridad, confidencial,
            asignado_a, plantel_id, creado_en, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,'nueva','media',$6,$7,$8,$9,$9)`,
        [folio, me.id, categoria, titulo.trim(), descripcion.trim(),
         confidencial === '1' || confidencial === 'true' ? 1 : 0,
         asignadoA, me.plantel_id || null, ahora]
      )

      // Guardar adjuntos de la solicitud inicial
      for (const f of (req.files || [])) {
        const adjId = crypto.randomUUID()
        const ruta = path.join('uploads', 'atencion', folio, f.filename)
        await run(
          `INSERT INTO atencion_adjuntos (id, solicitud_id, mensaje_id, nombre_original, ruta, mimetype, subido_por, creado_en)
           VALUES ($1,$2,NULL,$3,$4,$5,$6,$7)`,
          [adjId, folio, f.originalname, ruta, f.mimetype, me.id, ahora]
        )
      }

      // Mensaje inicial automático
      const msgId = crypto.randomUUID()
      await run(
        `INSERT INTO atencion_mensajes (id, solicitud_id, autor_id, contenido, interno, tipo, meta, creado_en)
         VALUES ($1,$2,$3,$4,0,'sistema',$5,$6)`,
        [msgId, folio, me.id, 'Solicitud creada.', JSON.stringify({ estado: 'nueva' }), ahora]
      )

      // Notificar al alumno (confirmación)
      await crearNotificacion(me.id, 'atencion_recibida',
        `Tu solicitud ha sido recibida. Folio ${folio}.`, folio)

      // Notificar al agente asignado
      if (asignadoA && asignadoA !== me.id) {
        await crearNotificacion(asignadoA, 'atencion_nueva',
          `Nueva solicitud de atención asignada a ti. Folio ${folio}.`, folio)
      }

      res.status(201).json({ folio })
    })
  })().catch(e => { console.error('[atencion/crear]', e.message); res.status(500).json({ error: 'Error interno' }) })
})

// ── GET /api/atencion/solicitudes/:folio ──────────────────────────────────────
router.get('/solicitudes/:folio', requireAuth, async (req, res) => {
  const me = req.user
  const sol = await queryOne(
    `SELECT s.*, u.nombre AS alumno_nombre, u.email AS alumno_email,
            p.nombre AS plantel_nombre, a.nombre AS agente_nombre
     FROM atencion_solicitudes s
     LEFT JOIN usuarios u ON u.id = s.alumno_id
     LEFT JOIN planteles p ON p.id = s.plantel_id
     LEFT JOIN usuarios a ON a.id = s.asignado_a
     WHERE s.id = $1`,
    [req.params.folio]
  )
  if (!sol) return res.status(404).json({ error: 'No encontrado' })
  if (!esGestor(me) && sol.alumno_id !== me.id)
    return res.status(403).json({ error: 'Sin permiso' })

  // Mensajes (alumno no ve internos)
  const msgs = await query(
    `SELECT m.*, u.nombre AS autor_nombre, u.rol AS autor_rol
     FROM atencion_mensajes m
     LEFT JOIN usuarios u ON u.id = m.autor_id
     WHERE m.solicitud_id = $1 ${!esGestor(me) ? 'AND m.interno = 0' : ''}
     ORDER BY m.creado_en`,
    [sol.id]
  )

  // Adjuntar archivos a cada mensaje + adjuntos iniciales de la solicitud
  const mensajesConAdj = await Promise.all(msgs.map(async m => ({
    ...m, adjuntos: await adjuntosDeMsg(m.id)
  })))
  const adjuntosIniciales = await adjuntosDeSolicitud(sol.id)

  // Documentos solicitados
  const docs = await query(
    `SELECT d.*, adj.nombre_original AS archivo_nombre, adj.ruta AS archivo_ruta
     FROM atencion_docs_solicitados d
     LEFT JOIN atencion_adjuntos adj ON adj.id = d.adjunto_id
     WHERE d.solicitud_id = $1 ORDER BY d.creado_en`,
    [sol.id]
  )

  res.json({ ...sol, mensajes: mensajesConAdj, adjuntosIniciales, docs })
})

// ── POST /api/atencion/solicitudes/:folio/mensajes ────────────────────────────
router.post('/solicitudes/:folio/mensajes', requireAuth, (req, res) => {
  req._solicitudId = req.params.folio
  upload.array('adjuntos', 5)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })

    const me = req.user
    const { contenido, interno } = req.body
    if (!contenido?.trim()) return res.status(400).json({ error: 'El mensaje no puede estar vacío' })

    const sol = await queryOne('SELECT * FROM atencion_solicitudes WHERE id = $1', [req.params.folio])
    if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada' })
    if (!esGestor(me) && sol.alumno_id !== me.id) return res.status(403).json({ error: 'Sin permiso' })

    // Solo gestores pueden enviar notas internas
    const esInterno = esGestor(me) && (interno === '1' || interno === 'true') ? 1 : 0

    const msgId = crypto.randomUUID()
    const ahora = new Date().toISOString()
    await run(
      `INSERT INTO atencion_mensajes (id, solicitud_id, autor_id, contenido, interno, tipo, meta, creado_en)
       VALUES ($1,$2,$3,$4,$5,'mensaje',NULL,$6)`,
      [msgId, sol.id, me.id, contenido.trim(), esInterno, ahora]
    )

    // Adjuntos del mensaje
    for (const f of (req.files || [])) {
      const adjId = crypto.randomUUID()
      const ruta = path.join('uploads', 'atencion', sol.id, f.filename)
      await run(
        `INSERT INTO atencion_adjuntos (id, solicitud_id, mensaje_id, nombre_original, ruta, mimetype, subido_por, creado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [adjId, sol.id, msgId, f.originalname, ruta, f.mimetype, me.id, ahora]
      )
    }

    // Actualizar timestamp
    await run('UPDATE atencion_solicitudes SET actualizado_en = $1 WHERE id = $2', [ahora, sol.id])

    // Si el alumno responde y el estado era "esperando_informacion", volver a en_revision
    if (!esGestor(me) && sol.estado === 'esperando_informacion') {
      await run(`UPDATE atencion_solicitudes SET estado = 'en_revision', actualizado_en = $1 WHERE id = $2`, [ahora, sol.id])
    }

    // Notificaciones (no internas)
    if (!esInterno) {
      if (esGestor(me)) {
        // Notificar al alumno
        await crearNotificacion(sol.alumno_id, 'atencion_respuesta',
          `Atención a alumnos respondió a tu solicitud ${sol.id}.`, sol.id)
      } else {
        // Notificar al agente
        if (sol.asignado_a) {
          await crearNotificacion(sol.asignado_a, 'atencion_alumno_responde',
            `El alumno respondió en la solicitud ${sol.id}.`, sol.id)
        }
      }
    }

    const msg = await queryOne(
      `SELECT m.*, u.nombre AS autor_nombre, u.rol AS autor_rol
       FROM atencion_mensajes m LEFT JOIN usuarios u ON u.id = m.autor_id WHERE m.id = $1`, [msgId]
    )
    res.status(201).json({ ...msg, adjuntos: await adjuntosDeMsg(msgId) })
  })
})

// ── PATCH /api/atencion/solicitudes/:folio/estado ─────────────────────────────
const ESTADOS_VALIDOS = ['nueva','recibida','en_revision','esperando_informacion','en_proceso','resuelta','cerrada']

router.patch('/solicitudes/:folio/estado', requireAuth, async (req, res) => {
  if (!esGestor(req.user)) return res.status(403).json({ error: 'Sin permiso' })
  const { estado, nota } = req.body
  if (!ESTADOS_VALIDOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' })

  const sol = await queryOne('SELECT * FROM atencion_solicitudes WHERE id = $1', [req.params.folio])
  if (!sol) return res.status(404).json({ error: 'No encontrada' })

  const ahora = new Date().toISOString()
  await run('UPDATE atencion_solicitudes SET estado = $1, actualizado_en = $2 WHERE id = $3',
    [estado, ahora, sol.id])

  // Mensaje de sistema para el historial
  const msgId = crypto.randomUUID()
  const textoEstado = nota?.trim() || `Estado cambiado a: ${estado.replace(/_/g, ' ')}.`
  await run(
    `INSERT INTO atencion_mensajes (id, solicitud_id, autor_id, contenido, interno, tipo, meta, creado_en)
     VALUES ($1,$2,$3,$4,0,'cambio_estado',$5,$6)`,
    [msgId, sol.id, req.user.id, textoEstado, JSON.stringify({ estado_anterior: sol.estado, estado_nuevo: estado }), ahora]
  )

  // Notificar alumno
  await crearNotificacion(sol.alumno_id, 'atencion_estado',
    `Tu solicitud ${sol.id} cambió de estado a: ${estado.replace(/_/g, ' ')}.`, sol.id)

  // Si se resuelve, pedir satisfacción
  if (estado === 'resuelta') {
    await crearNotificacion(sol.alumno_id, 'atencion_resuelta',
      `Tu solicitud ${sol.id} fue marcada como resuelta. ¿La respuesta solucionó tu problema?`, sol.id)
  }

  res.json({ ok: true, estado })
})

// ── PATCH /api/atencion/solicitudes/:folio/asignar ────────────────────────────
router.patch('/solicitudes/:folio/asignar', requireAuth, async (req, res) => {
  if (!esGestor(req.user)) return res.status(403).json({ error: 'Sin permiso' })
  const { asignado_a } = req.body
  const sol = await queryOne('SELECT id FROM atencion_solicitudes WHERE id = $1', [req.params.folio])
  if (!sol) return res.status(404).json({ error: 'No encontrada' })
  const ahora = new Date().toISOString()
  await run('UPDATE atencion_solicitudes SET asignado_a = $1, actualizado_en = $2 WHERE id = $3',
    [asignado_a || null, ahora, sol.id])
  if (asignado_a) {
    await crearNotificacion(asignado_a, 'atencion_asignada',
      `Se te asignó la solicitud ${sol.id}.`, sol.id)
  }
  res.json({ ok: true })
})

// ── PATCH /api/atencion/solicitudes/:folio/prioridad ──────────────────────────
router.patch('/solicitudes/:folio/prioridad', requireAuth, async (req, res) => {
  if (!esGestor(req.user)) return res.status(403).json({ error: 'Sin permiso' })
  const { prioridad } = req.body
  if (!['baja','media','alta'].includes(prioridad)) return res.status(400).json({ error: 'Prioridad inválida' })
  const sol = await queryOne('SELECT id FROM atencion_solicitudes WHERE id = $1', [req.params.folio])
  if (!sol) return res.status(404).json({ error: 'No encontrada' })
  await run('UPDATE atencion_solicitudes SET prioridad = $1, actualizado_en = $2 WHERE id = $3',
    [prioridad, new Date().toISOString(), sol.id])
  res.json({ ok: true })
})

// ── PATCH /api/atencion/solicitudes/:folio/satisfaccion ───────────────────────
router.patch('/solicitudes/:folio/satisfaccion', requireAuth, async (req, res) => {
  const { satisfaccion } = req.body // 1=sí, 0=no
  const sol = await queryOne('SELECT * FROM atencion_solicitudes WHERE id = $1', [req.params.folio])
  if (!sol) return res.status(404).json({ error: 'No encontrada' })
  if (sol.alumno_id !== req.user.id) return res.status(403).json({ error: 'Sin permiso' })
  if (sol.estado !== 'resuelta') return res.status(400).json({ error: 'Solo se puede valorar cuando la solicitud está resuelta' })

  await run('UPDATE atencion_solicitudes SET satisfaccion = $1, actualizado_en = $2 WHERE id = $3',
    [satisfaccion ? 1 : 0, new Date().toISOString(), sol.id])

  // Si no está satisfecho, reabre el caso
  if (!satisfaccion) {
    await run(`UPDATE atencion_solicitudes SET estado = 'en_revision', actualizado_en = $1 WHERE id = $2`,
      [new Date().toISOString(), sol.id])
    const msgId = crypto.randomUUID()
    await run(
      `INSERT INTO atencion_mensajes (id, solicitud_id, autor_id, contenido, interno, tipo, meta, creado_en)
       VALUES ($1,$2,$3,$4,0,'sistema',$5,$6)`,
      [msgId, sol.id, req.user.id, 'El alumno indicó que su problema no fue resuelto. El caso fue reabierto.',
       null, new Date().toISOString()]
    )
  }

  res.json({ ok: true, estado: satisfaccion ? 'resuelta' : 'en_revision' })
})

// ── POST /api/atencion/solicitudes/:folio/docs-solicitados ────────────────────
// Gestor solicita documentos específicos al alumno
router.post('/solicitudes/:folio/docs-solicitados', requireAuth, async (req, res) => {
  if (!esGestor(req.user)) return res.status(403).json({ error: 'Sin permiso' })
  const sol = await queryOne('SELECT * FROM atencion_solicitudes WHERE id = $1', [req.params.folio])
  if (!sol) return res.status(404).json({ error: 'No encontrada' })

  const { documentos, nota } = req.body
  // documentos: [{ nombre, descripcion }]
  if (!Array.isArray(documentos) || documentos.length === 0)
    return res.status(400).json({ error: 'Debe especificar al menos un documento' })

  const ahora = new Date().toISOString()
  const msgId = crypto.randomUUID()
  const contenido = nota?.trim() || 'Se solicitaron documentos adicionales para continuar con tu trámite.'
  await run(
    `INSERT INTO atencion_mensajes (id, solicitud_id, autor_id, contenido, interno, tipo, meta, creado_en)
     VALUES ($1,$2,$3,$4,0,'solicitud_documento',NULL,$5)`,
    [msgId, sol.id, req.user.id, contenido, ahora]
  )

  const ids = []
  for (const { nombre, descripcion } of documentos) {
    if (!nombre?.trim()) continue
    const id = crypto.randomUUID()
    await run(
      `INSERT INTO atencion_docs_solicitados (id, solicitud_id, mensaje_id, nombre, descripcion, estado, creado_en, actualizado_en)
       VALUES ($1,$2,$3,$4,$5,'pendiente',$6,$6)`,
      [id, sol.id, msgId, nombre.trim(), descripcion?.trim() || '', ahora]
    )
    ids.push(id)
  }

  // Cambiar estado a esperando_informacion
  await run(`UPDATE atencion_solicitudes SET estado = 'esperando_informacion', actualizado_en = $1 WHERE id = $2`,
    [ahora, sol.id])

  await crearNotificacion(sol.alumno_id, 'atencion_doc_solicitado',
    `Se solicitó documentación adicional para tu solicitud ${sol.id}.`, sol.id)

  res.status(201).json({ ok: true, mensaje_id: msgId, doc_ids: ids })
})

// ── POST /api/atencion/docs/:id/subir  (alumno sube un documento solicitado) ──
router.post('/docs/:id/subir', requireAuth, (req, res) => {
  upload.single('archivo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    const doc = await queryOne('SELECT * FROM atencion_docs_solicitados WHERE id = $1', [req.params.id])
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' })

    const sol = await queryOne('SELECT * FROM atencion_solicitudes WHERE id = $1', [doc.solicitud_id])
    if (sol.alumno_id !== req.user.id) return res.status(403).json({ error: 'Sin permiso' })
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' })

    // Mover archivo al directorio correcto
    const dir = path.join(
      process.env.UPLOADS_PATH || path.join(__dirname, '..', 'uploads'),
      'atencion', sol.id
    )
    fs.mkdirSync(dir, { recursive: true })
    const newFilename = Date.now() + '_' + crypto.randomBytes(4).toString('hex') +
      path.extname(req.file.originalname).toLowerCase()
    const newPath = path.join(dir, newFilename)
    fs.renameSync(req.file.path, newPath)

    const adjId = crypto.randomUUID()
    const ruta = path.join('uploads', 'atencion', sol.id, newFilename)
    const ahora = new Date().toISOString()
    await run(
      `INSERT INTO atencion_adjuntos (id, solicitud_id, mensaje_id, nombre_original, ruta, mimetype, subido_por, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [adjId, sol.id, doc.mensaje_id, req.file.originalname, ruta, req.file.mimetype, req.user.id, ahora]
    )
    await run('UPDATE atencion_docs_solicitados SET estado = $1, adjunto_id = $2, actualizado_en = $3 WHERE id = $4',
      ['subido', adjId, ahora, doc.id])
    await run('UPDATE atencion_solicitudes SET actualizado_en = $1 WHERE id = $2', [ahora, sol.id])

    if (sol.asignado_a) {
      await crearNotificacion(sol.asignado_a, 'atencion_doc_subido',
        `El alumno subió un documento en la solicitud ${sol.id}.`, sol.id)
    }
    res.json({ ok: true, adjunto_id: adjId })
  })
})

// ── PATCH /api/atencion/docs/:id/estado  (gestor acepta/rechaza documento) ───
router.patch('/docs/:id/estado', requireAuth, async (req, res) => {
  if (!esGestor(req.user)) return res.status(403).json({ error: 'Sin permiso' })
  const { estado, motivo_rechazo } = req.body
  if (!['aceptado', 'rechazado'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' })

  const doc = await queryOne('SELECT * FROM atencion_docs_solicitados WHERE id = $1', [req.params.id])
  if (!doc) return res.status(404).json({ error: 'No encontrado' })

  const ahora = new Date().toISOString()
  await run('UPDATE atencion_docs_solicitados SET estado = $1, motivo_rechazo = $2, actualizado_en = $3 WHERE id = $4',
    [estado, motivo_rechazo || null, ahora, doc.id])

  const sol = await queryOne('SELECT * FROM atencion_solicitudes WHERE id = $1', [doc.solicitud_id])
  if (sol) {
    const tipo = estado === 'rechazado' ? 'atencion_doc_rechazado' : 'atencion_doc_aceptado'
    const msg = estado === 'rechazado'
      ? `Tu documento "${doc.nombre}" fue rechazado en la solicitud ${sol.id}.${motivo_rechazo ? ' Motivo: ' + motivo_rechazo : ''}`
      : `Tu documento "${doc.nombre}" fue aceptado en la solicitud ${sol.id}.`
    await crearNotificacion(sol.alumno_id, tipo, msg, sol.id)
  }

  res.json({ ok: true })
})

// ── GET /api/atencion/categorias ──────────────────────────────────────────────
router.get('/categorias', requireAuth, (req, res) => {
  res.json(CATEGORIAS)
})

module.exports = router
