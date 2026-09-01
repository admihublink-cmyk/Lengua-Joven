const router = require('express').Router()
const { query, queryOne } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

router.get('/', requireAuth, async (req, res) => {
  const me = req.user
  if (me.rol !== 'alumno') return res.status(403).json({ error: 'Solo para alumnos' })

  const hoy = new Date().toISOString().slice(0, 10)

  // Inscripciones del alumno con info del grupo
  const inscripciones = await query(`
    SELECT i.*,
      g.codigo AS grupo_codigo, g.horario, g.link_meet, g.fecha_inicio_clases, g.fecha_fin_clases,
      n.nombre AS nivel_nombre,
      id2.nombre AS idioma_nombre,
      u.nombre AS profesor_nombre
    FROM inscripciones i
    LEFT JOIN grupos g ON g.id = i.grupo_id
    LEFT JOIN niveles n ON n.id = g.nivel_id
    LEFT JOIN idiomas id2 ON id2.id = g.idioma_id
    LEFT JOIN usuarios u ON u.id = g.profesor_id
    WHERE i.alumno_id = $1
    ORDER BY i.creado_en DESC
  `, [me.id])

  const inscripcion = inscripciones.find(i => i.estado === 'asignada') || inscripciones[0] || null

  let sesiones = []
  let evaluaciones = []
  let tareas = []
  let proximaClase = null

  if (inscripcion?.grupo_id) {
    const grupoId = inscripcion.grupo_id

    // Sesiones del grupo con asistencia del alumno
    const todasSesiones = await query(`
      SELECT s.*,
        a.presente AS asistio
      FROM sesiones s
      LEFT JOIN asistencias_sesion a ON a.sesion_id = s.id AND a.alumno_id = $1
      WHERE s.grupo_id = $2
      ORDER BY s.fecha, s.hora_inicio
    `, [me.id, grupoId])

    sesiones = todasSesiones.slice(-30) // Últimas 30 sesiones

    // Proxima clase: hoy o la más cercana futura
    const futuras = todasSesiones.filter(s => s.fecha >= hoy)
    proximaClase = futuras[0] || null
    if (proximaClase && !proximaClase.link_meet && inscripcion.link_meet) {
      proximaClase = { ...proximaClase, link_meet: inscripcion.link_meet }
    }

    // Evaluaciones del alumno en este grupo
    evaluaciones = await query(`
      SELECT * FROM evaluaciones WHERE alumno_id = $1 AND grupo_id = $2 ORDER BY fecha DESC
    `, [me.id, grupoId])

    // Tareas del grupo con estado de entrega y calificación del alumno
    tareas = await query(`
      SELECT t.*,
        et.id AS entrega_id, et.fecha_entrega,
        ct.calificacion AS tarea_calificacion, ct.comentario AS tarea_comentario
      FROM tareas t
      LEFT JOIN entregas_tareas et ON et.tarea_id = t.id AND et.alumno_id = $1
      LEFT JOIN calificaciones_tareas ct ON ct.tarea_id = t.id AND ct.alumno_id = $1
      WHERE t.grupo_id = $2
      ORDER BY t.fecha_limite
    `, [me.id, grupoId])
  }

  // Avisos para este alumno (globales + por plantel + por grupo)
  const plantelId = inscripcion?.plantel_id || me.plantel_id || null
  const grupoId2 = inscripcion?.grupo_id || null
  const avisos = await query(`
    SELECT * FROM avisos
    WHERE activo = 1 AND (
      (plantel_id IS NULL AND grupo_id IS NULL)
      OR plantel_id = $1
      OR grupo_id = $2
    )
    ORDER BY fecha DESC LIMIT 15
  `, [plantelId, grupoId2])

  // Estadísticas
  const totalSesiones = sesiones.filter(s => s.fecha <= hoy).length
  const presentes = sesiones.filter(s => s.fecha <= hoy && s.asistio).length
  const pctAsistencia = totalSesiones > 0 ? Math.round(presentes / totalSesiones * 100) : null

  const promedioEval = evaluaciones.length > 0
    ? Math.round(evaluaciones.reduce((s, e) => s + (e.calificacion || 0), 0) / evaluaciones.length * 10) / 10
    : null

  const tareasPendientes = tareas.filter(t => !t.entrega_id && t.fecha_limite >= hoy).length

  res.json({
    inscripcion,
    proximaClase,
    sesiones,
    evaluaciones,
    tareas,
    avisos,
    stats: { pctAsistencia, promedio: promedioEval, tareasPendientes }
  })
})

module.exports = router
