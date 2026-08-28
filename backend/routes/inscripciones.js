const router = require('express').Router()
const { query, queryOne, run, withTransaction } = require('../db/pool')
const { requireAuth, puedeVerPlantel } = require('../middleware/auth')
const { enviarGrupoAsignado } = require('../services/email')

const SEMANAS_LIMITE_EXTEMPORANEA = 2

// Devuelve true si hoy está dentro de las primeras N semanas de clases del grupo
async function esExtemporanea(grupo_id) {
  if (!grupo_id) return false
  const g = await queryOne('SELECT fecha_inicio_clases FROM grupos WHERE id = $1', [grupo_id])
  if (!g?.fecha_inicio_clases) return false
  const inicio = new Date(g.fecha_inicio_clases)
  const hoy = new Date()
  if (hoy < inicio) return false // clases no han empezado = inscripción normal
  const diasTranscurridos = Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24))
  return diasTranscurridos <= SEMANAS_LIMITE_EXTEMPORANEA * 7
}

// Devuelve true si ya pasó el plazo (más de 2 semanas después del inicio)
async function fueraDePlazo(grupo_id) {
  if (!grupo_id) return false
  const g = await queryOne('SELECT fecha_inicio_clases FROM grupos WHERE id = $1', [grupo_id])
  if (!g?.fecha_inicio_clases) return false
  const inicio = new Date(g.fecha_inicio_clases)
  const hoy = new Date()
  const diasTranscurridos = Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24))
  return diasTranscurridos > SEMANAS_LIMITE_EXTEMPORANEA * 7
}

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  if (me.rol === 'superadmin') {
    return res.json(await query('SELECT * FROM inscripciones ORDER BY fecha_registro DESC', []))
  }
  if (me.rol === 'alumno') {
    return res.json(await query('SELECT * FROM inscripciones WHERE alumno_id = $1 ORDER BY fecha_registro DESC', [me.id]))
  }
  if (me.rol === 'coordinador') {
    const ids = me.planteles || []
    if (ids.length === 0) return res.json([])
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    return res.json(await query(`SELECT * FROM inscripciones WHERE plantel_id IN (${placeholders}) ORDER BY fecha_registro DESC`, ids))
  }
  if (me.plantel_id) {
    return res.json(await query('SELECT * FROM inscripciones WHERE plantel_id = $1 ORDER BY fecha_registro DESC', [me.plantel_id]))
  }
  res.json([])
})

router.get('/:id', requireAuth, async (req, res) => {
  const i = await queryOne('SELECT * FROM inscripciones WHERE id = $1', [req.params.id])
  if (!i) return res.status(404).json({ error: 'No encontrado' })
  const me = req.user
  if (me.rol === 'superadmin') return res.json(i)
  if (me.rol === 'alumno' && i.alumno_id !== me.id) return res.status(403).json({ error: 'Sin permiso' })
  if (me.rol === 'tutor') {
    if (!(me.alumnos || []).includes(i.alumno_id)) return res.status(403).json({ error: 'Sin permiso' })
    return res.json(i)
  }
  if (me.rol === 'coordinador') {
    if (!(me.planteles || []).includes(i.plantel_id)) return res.status(403).json({ error: 'Sin permiso' })
    return res.json(i)
  }
  // director, profesor, admin_ventas: solo su plantel
  if (me.plantel_id && i.plantel_id !== me.plantel_id) return res.status(403).json({ error: 'Sin permiso' })
  res.json(i)
})

router.post('/', requireAuth, async (req, res) => {
  if (!['superadmin', 'coordinador', 'director', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { alumno_id, grupo_id, plantel_id, estado, nombre_externo, email_externo, tel_externo, oferta_id, placement_nivel, sugerida_por, motivo_extemporanea } = req.body
  if (alumno_id && grupo_id) {
    const dup = await queryOne(
      `SELECT id FROM inscripciones WHERE alumno_id = $1 AND grupo_id = $2 AND estado NOT IN ('cancelada','rechazada','baja')`,
      [alumno_id, grupo_id]
    )
    if (dup) return res.status(400).json({ error: 'El alumno ya tiene una inscripción activa en este grupo' })
  }

  // Verificar si ya pasó el plazo límite (más de 2 semanas después del inicio de clases)
  if (grupo_id && await fueraDePlazo(grupo_id)) {
    return res.status(400).json({
      error: 'Ya no se aceptan inscripciones para este grupo. Han transcurrido más de 2 semanas desde el inicio de clases.',
      codigo: 'fuera_de_plazo',
    })
  }

  // Detectar si es extemporánea (clases ya iniciaron pero dentro del plazo)
  const esExt = grupo_id ? await esExtemporanea(grupo_id) : false

  // Solo coordinador/director/superadmin pueden crear extemporáneas directamente con autorización implícita
  // admin_ventas puede crearla pero queda pendiente de autorización
  const puedeAutorizar = ['superadmin', 'coordinador', 'director'].includes(req.user.rol)

  const ids = (await query('SELECT id FROM inscripciones', [])).map(r => r.id)
  const maxN = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('ins', '')) || 0), 0)
  const newId = 'ins' + (maxN + 1)
  const folio = 'INJ-' + String(maxN + 1).padStart(4, '0')
  const fecha = new Date().toISOString().split('T')[0]
  let pid
  if (req.user.rol === 'superadmin') pid = plantel_id
  else if (req.user.rol === 'coordinador') {
    if (plantel_id && !(req.user.planteles || []).includes(plantel_id)) {
      return res.status(403).json({ error: 'Plantel no asignado' })
    }
    pid = plantel_id
  }
  else pid = req.user.plantel_id

  // Estado inicial: si es extemporánea y quien la crea puede autorizar → 'nueva' (autorización implícita)
  // Si la crea admin_ventas → 'pendiente_autorizacion'
  let estadoFinal = estado || 'nueva'
  let autorizadoPor = null
  let fechaAutorizacion = null
  if (esExt && !puedeAutorizar) {
    estadoFinal = 'pendiente_autorizacion'
  } else if (esExt && puedeAutorizar) {
    // Auto-autorización: coordinador/director/superadmin que la crea queda como autorizador
    autorizadoPor = req.user.id
    fechaAutorizacion = fecha
  }

  await run(
    `INSERT INTO inscripciones (id, alumno_id, grupo_id, plantel_id, estado, folio, fecha_registro, placement_nivel, sugerida_por, nombre_externo, email_externo, tel_externo, oferta_id, es_extemporanea, autorizado_por, fecha_autorizacion, motivo_extemporanea)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [newId, alumno_id || null, grupo_id || null, pid, estadoFinal, folio, fecha,
     placement_nivel || null, sugerida_por || null, nombre_externo || null, email_externo || null, tel_externo || null, oferta_id || null,
     esExt ? 1 : 0, autorizadoPor, fechaAutorizacion, motivo_extemporanea || null]
  )
  let nivel_sugerido = null
  if (alumno_id && !placement_nivel) {
    const hoy = new Date().toISOString().split('T')[0]
    const ultimo = await queryOne(`
      SELECT g.nivel_id, g.idioma_id FROM inscripciones i
      JOIN grupos g ON g.id = i.grupo_id
      WHERE i.alumno_id = $1 AND g.fecha_fin_clases < $2 AND g.nivel_id IS NOT NULL
        AND g.nivel_id != '' AND i.id != $3
      ORDER BY g.fecha_fin_clases DESC LIMIT 1
    `, [alumno_id, hoy, newId])
    if (ultimo) {
      const nivelActual = await queryOne('SELECT * FROM niveles WHERE id = $1', [ultimo.nivel_id])
      if (nivelActual) {
        const sig = await queryOne(
          'SELECT * FROM niveles WHERE idioma_id = $1 AND orden = $2 LIMIT 1',
          [nivelActual.idioma_id, nivelActual.orden + 1]
        )
        if (sig) nivel_sugerido = { id: sig.id, nombre: sig.nombre }
      }
    }
  }
  res.status(201).json({ ...await queryOne('SELECT * FROM inscripciones WHERE id = $1', [newId]), nivel_sugerido })
})

router.put('/:id', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }

  const ins = await queryOne('SELECT * FROM inscripciones WHERE id = $1', [req.params.id])
  if (!ins) return res.status(404).json({ error: 'No encontrado' })

  if (me.rol === 'director' && ins.plantel_id !== me.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para este plantel' })
  }
  if (me.rol === 'coordinador') {
    const asignados = me.planteles || []
    if (!asignados.includes(ins.plantel_id) && ins.plantel_id !== me.plantel_id) {
      return res.status(403).json({ error: 'Sin permiso para este plantel' })
    }
  }

  const nuevoGrupo = req.body.grupo_id
  const nuevoEstado = req.body.estado

  // Verificar cupo si se asigna un grupo nuevo y el estado no es 'espera'
  if (nuevoGrupo && nuevoGrupo !== ins.grupo_id && nuevoEstado !== 'espera') {
    const grupo = await queryOne('SELECT cupo FROM grupos WHERE id = $1', [nuevoGrupo])
    if (grupo) {
      const { n } = await queryOne(
        "SELECT COUNT(*) AS n FROM inscripciones WHERE grupo_id = $1 AND estado NOT IN ('baja','espera','cancelada','rechazada')",
        [nuevoGrupo]
      ) || { n: 0 }
      if (parseInt(n) >= (grupo.cupo || 20)) {
        return res.status(409).json({
          razon: 'grupo_lleno',
          cupo: grupo.cupo || 20,
          actuales: parseInt(n),
          error: 'El grupo ya alcanzó su cupo máximo'
        })
      }
    }
  }

  let siguientePromovido = null

  await withTransaction(async (client) => {
    const tqOne = (sql, p = []) => client.query(sql, p).then(r => r.rows[0] || null)
    const tr = (sql, p = []) => client.query(sql, p)

    // Si se pone en espera, asignar posición al final de la cola
    if (nuevoEstado === 'espera' && ins.estado !== 'espera') {
      const grupoTarget = nuevoGrupo || ins.grupo_id
      if (grupoTarget) {
        const row = await tqOne(
          "SELECT COALESCE(MAX(posicion_espera), 0) AS pos FROM inscripciones WHERE grupo_id = $1 AND estado = 'espera'",
          [grupoTarget]
        )
        req.body.posicion_espera = parseInt((row || { pos: 0 }).pos) + 1
      }
    }

    // Si sale de espera (promovida o cancelada), limpiar posición y re-numerar cola
    if (ins.estado === 'espera' && nuevoEstado && nuevoEstado !== 'espera') {
      req.body.posicion_espera = null
      if (ins.grupo_id && ins.posicion_espera) {
        await tr(
          "UPDATE inscripciones SET posicion_espera = posicion_espera - 1 WHERE grupo_id = $1 AND estado = 'espera' AND posicion_espera > $2",
          [ins.grupo_id, ins.posicion_espera]
        )
      }
    }

    // Auto-promover solo cuando se libera un cupo real (ins.estado no era 'espera',
    // porque espera no ocupa cupo y promover sin cupo libre excede el límite del grupo)
    if (nuevoEstado === 'baja' && ins.grupo_id && ins.estado !== 'baja' && ins.estado !== 'espera') {
      const siguiente = await tqOne(
        "SELECT * FROM inscripciones WHERE grupo_id = $1 AND estado = 'espera' ORDER BY posicion_espera ASC LIMIT 1",
        [ins.grupo_id]
      )
      if (siguiente) {
        await tr(
          "UPDATE inscripciones SET estado = 'asignada', posicion_espera = NULL WHERE id = $1",
          [siguiente.id]
        )
        await tr(
          "UPDATE inscripciones SET posicion_espera = posicion_espera - 1 WHERE grupo_id = $1 AND estado = 'espera' AND posicion_espera > $2",
          [ins.grupo_id, siguiente.posicion_espera]
        )
        siguientePromovido = siguiente
      }
    }

    const fields = ['alumno_id','grupo_id','plantel_id','estado','placement_nivel','sugerida_por',
      'nombre_externo','email_externo','tel_externo','oferta_id','grupo_sugerido_id','liga_pago','posicion_espera']
    const sets = []; const vals = []
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = $${sets.length + 1}`); vals.push(req.body[f] ?? null) }
    }
    if (sets.length) await tr(`UPDATE inscripciones SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`, [...vals, req.params.id])
  })

  const actualizada = await queryOne('SELECT * FROM inscripciones WHERE id = $1', [req.params.id])

  // Notificación cuando se asigna grupo por primera vez
  if (nuevoEstado === 'asignada' && ins.estado !== 'asignada') {
    const email = actualizada.email_externo
      || (actualizada.alumno_id && (await queryOne('SELECT email FROM usuarios WHERE id = $1', [actualizada.alumno_id]))?.email)
    const nombreAlumno = actualizada.nombre_externo
      || (actualizada.alumno_id && (await queryOne('SELECT nombre FROM usuarios WHERE id = $1', [actualizada.alumno_id]))?.nombre)
      || 'Alumno'
    const grupoId = actualizada.grupo_id

    if (email && grupoId) {
      const grupo = await queryOne('SELECT * FROM grupos WHERE id = $1', [grupoId])
      const nivel = grupo?.nivel_id ? (await queryOne('SELECT nombre FROM niveles WHERE id = $1', [grupo.nivel_id]))?.nombre : null
      const idioma = grupo?.idioma_id ? (await queryOne('SELECT nombre FROM idiomas WHERE id = $1', [grupo.idioma_id]))?.nombre : null
      const plantel = actualizada.plantel_id ? (await queryOne('SELECT nombre FROM planteles WHERE id = $1', [actualizada.plantel_id]))?.nombre : null

      enviarGrupoAsignado({
        destinatario: email,
        nombre: nombreAlumno,
        folio: actualizada.folio,
        grupo: grupo || {},
        nivel,
        idioma,
        plantel,
      }).catch(err => console.error('enviarGrupoAsignado error:', err.message))
    }
  }

  // Notificación para alumno auto-promovido desde lista de espera
  if (siguientePromovido) {
    const sig = siguientePromovido
    const emailSig = sig.email_externo
      || (sig.alumno_id && (await queryOne('SELECT email FROM usuarios WHERE id = $1', [sig.alumno_id]))?.email)
    const nombreSig = sig.nombre_externo
      || (sig.alumno_id && (await queryOne('SELECT nombre FROM usuarios WHERE id = $1', [sig.alumno_id]))?.nombre)
      || 'Alumno'

    if (emailSig && sig.grupo_id) {
      const grupo = await queryOne('SELECT * FROM grupos WHERE id = $1', [sig.grupo_id])
      const nivel = grupo?.nivel_id ? (await queryOne('SELECT nombre FROM niveles WHERE id = $1', [grupo.nivel_id]))?.nombre : null
      const idioma = grupo?.idioma_id ? (await queryOne('SELECT nombre FROM idiomas WHERE id = $1', [grupo.idioma_id]))?.nombre : null
      const plantel = sig.plantel_id ? (await queryOne('SELECT nombre FROM planteles WHERE id = $1', [sig.plantel_id]))?.nombre : null

      enviarGrupoAsignado({
        destinatario: emailSig,
        nombre: nombreSig,
        folio: sig.folio,
        grupo: grupo || {},
        nivel,
        idioma,
        plantel,
      }).catch(err => console.error('enviarGrupoAsignado (espera→asignada) error:', err.message))
    }
  }

  res.json(actualizada)
})

// GET /inscripciones/extemporaneas — lista de inscripciones pendientes de autorización
router.get('/extemporaneas/pendientes', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'coordinador', 'director'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  let where = `WHERE i.es_extemporanea = 1 AND i.estado = 'pendiente_autorizacion'`
  const params = []
  if (me.rol === 'director' && me.plantel_id) {
    where += ` AND i.plantel_id = $1`; params.push(me.plantel_id)
  } else if (me.rol === 'coordinador') {
    const ids = me.planteles || []
    if (ids.length) {
      where += ` AND i.plantel_id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`
      params.push(...ids)
    }
  }
  const rows = await query(
    `SELECT i.*, u.nombre AS alumno_nombre, u.email AS alumno_email,
            g.codigo AS grupo_codigo, g.fecha_inicio_clases,
            p.nombre AS plantel_nombre
     FROM inscripciones i
     LEFT JOIN usuarios u ON u.id = i.alumno_id
     LEFT JOIN grupos g ON g.id = i.grupo_id
     LEFT JOIN planteles p ON p.id = i.plantel_id
     ${where}
     ORDER BY i.fecha_registro DESC`,
    params
  )
  res.json(rows)
})

// PATCH /inscripciones/:id/autorizar — autorizar o rechazar inscripción extemporánea
router.patch('/:id/autorizar', requireAuth, async (req, res) => {
  const me = req.user
  if (!['superadmin', 'coordinador', 'director'].includes(me.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const ins = await queryOne('SELECT * FROM inscripciones WHERE id = $1', [req.params.id])
  if (!ins) return res.status(404).json({ error: 'No encontrada' })
  if (!ins.es_extemporanea) return res.status(400).json({ error: 'Esta inscripción no es extemporánea' })
  if (ins.estado !== 'pendiente_autorizacion') return res.status(400).json({ error: 'Solo se pueden autorizar inscripciones en estado pendiente_autorizacion' })

  const { accion, motivo } = req.body // accion: 'autorizar' | 'rechazar'
  if (!['autorizar', 'rechazar'].includes(accion)) return res.status(400).json({ error: 'Acción inválida' })

  const nuevoEstado = accion === 'autorizar' ? 'nueva' : 'rechazada'
  const fecha = new Date().toISOString().split('T')[0]

  await run(
    `UPDATE inscripciones SET estado = $1, autorizado_por = $2, fecha_autorizacion = $3, motivo_extemporanea = COALESCE($4, motivo_extemporanea)
     WHERE id = $5`,
    [nuevoEstado, me.id, fecha, motivo || null, ins.id]
  )

  // Notificar a quien creó la inscripción (si hay alumno registrado)
  if (ins.alumno_id) {
    try {
      const notifId = 'not' + Date.now() + Math.random().toString(36).slice(2, 4)
      const msg = accion === 'autorizar'
        ? `Tu inscripción extemporánea (${ins.folio}) fue autorizada.`
        : `Tu inscripción extemporánea (${ins.folio}) fue rechazada.${motivo ? ' Motivo: ' + motivo : ''}`
      await run(
        `INSERT INTO notificaciones (id, usuario_id, tipo, mensaje, fecha, leida) VALUES ($1,$2,$3,$4,$5,0)`,
        [notifId, ins.alumno_id, 'inscripcion_extemporanea', msg, fecha]
      )
    } catch (_) {}
  }

  res.json({ ok: true, estado: nuevoEstado })
})

// GET /inscripciones/extemporaneas/verificar-grupo/:grupo_id — info sobre si un grupo acepta extemporáneas
router.get('/extemporaneas/verificar-grupo/:grupo_id', requireAuth, async (req, res) => {
  const g = await queryOne('SELECT id, codigo, fecha_inicio_clases, fecha_fin_clases FROM grupos WHERE id = $1', [req.params.grupo_id])
  if (!g) return res.status(404).json({ error: 'Grupo no encontrado' })
  if (!g.fecha_inicio_clases) return res.json({ tipo: 'normal', mensaje: 'El grupo no tiene fecha de inicio de clases configurada.' })

  const inicio = new Date(g.fecha_inicio_clases)
  const hoy = new Date()
  if (hoy < inicio) return res.json({ tipo: 'normal', mensaje: 'Las clases aún no han iniciado. Inscripción normal.' })

  const dias = Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24))
  const limite = SEMANAS_LIMITE_EXTEMPORANEA * 7

  if (dias > limite) {
    return res.json({
      tipo: 'fuera_de_plazo',
      dias_transcurridos: dias,
      plazo_dias: limite,
      mensaje: `Ya no se aceptan inscripciones. Han transcurrido ${dias} días desde el inicio de clases (límite: ${limite} días).`,
    })
  }

  return res.json({
    tipo: 'extemporanea',
    dias_transcurridos: dias,
    plazo_dias: limite,
    dias_restantes: limite - dias,
    mensaje: `Inscripción extemporánea. Han transcurrido ${dias} de ${limite} días permitidos desde el inicio de clases. Requiere autorización del coordinador.`,
    requiere_autorizacion: true,
  })
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  const ins = await queryOne('SELECT plantel_id FROM inscripciones WHERE id = $1', [req.params.id])
  if (!ins) return res.status(404).json({ error: 'No encontrada' })
  if (req.user.rol !== 'superadmin' && ins.plantel_id !== req.user.plantel_id) {
    return res.status(403).json({ error: 'Sin permiso para esta inscripción' })
  }
  await run('DELETE FROM inscripciones WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
