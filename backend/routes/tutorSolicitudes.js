const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

// GET /tutor-solicitudes — tutor ve sus solicitudes (con datos del menor); alumno ve la suya
router.get('/', requireAuth, async (req, res) => {
  try {
    const me = req.user
    if (me.rol === 'tutor') {
      const rows = await query(`
        SELECT ts.*, u.nombre AS alumno_nombre, u.email AS alumno_email, u.matricula, u.foto_perfil
        FROM tutor_solicitudes ts
        JOIN usuarios u ON u.id = ts.alumno_id
        WHERE ts.tutor_id = $1
        ORDER BY ts.creado_en DESC
      `, [me.id])
      return res.json(rows)
    }
    if (me.rol === 'alumno') {
      const rows = await query(`SELECT ts.*, u.nombre AS tutor_nombre, u.email AS tutor_email FROM tutor_solicitudes ts JOIN usuarios u ON u.id = ts.tutor_id WHERE ts.alumno_id = $1 ORDER BY ts.creado_en DESC`, [me.id])
      return res.json(rows)
    }
    return res.status(403).json({ error: 'Sin permiso' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /tutor-solicitudes — alumno crea solicitud buscando tutor por CURP
router.post('/', requireAuth, async (req, res) => {
  try {
    const me = req.user
    if (me.rol !== 'alumno') return res.status(403).json({ error: 'Solo alumnos pueden vincular un tutor' })

    const { tutor_curp } = req.body
    if (!tutor_curp || tutor_curp.trim().length < 10) return res.status(400).json({ error: 'CURP del tutor inválido' })

    // Buscar tutor por curp (campo curp en usuarios)
    const tutor = await queryOne(`SELECT id, nombre, rol FROM usuarios WHERE UPPER(curp) = UPPER($1) AND activo = 1`, [tutor_curp.trim()])
    if (!tutor) return res.status(404).json({ error: 'No se encontró ningún tutor con ese CURP' })
    if (tutor.rol !== 'tutor') return res.status(400).json({ error: 'El usuario con ese CURP no tiene rol de tutor' })

    // Verificar que el alumno no tiene ya tutor aprobado
    const yaVinculado = await queryOne(`SELECT 1 FROM tutor_alumnos WHERE alumno_id = $1`, [me.id])
    if (yaVinculado) return res.status(409).json({ error: 'Ya tienes un tutor vinculado' })

    // Verificar solicitud pendiente preexistente
    const yaExiste = await queryOne(`SELECT id, estado FROM tutor_solicitudes WHERE alumno_id = $1`, [me.id])
    if (yaExiste) {
      if (yaExiste.estado === 'pendiente') return res.status(409).json({ error: 'Ya tienes una solicitud pendiente', solicitud: yaExiste })
      // Si fue rechazada o cancelada, la eliminamos para permitir nueva
      await run(`DELETE FROM tutor_solicitudes WHERE id = $1`, [yaExiste.id])
    }

    const id = 'ts-' + Date.now()
    await run(`INSERT INTO tutor_solicitudes (id, tutor_id, alumno_id, estado, creado_en) VALUES ($1,$2,$3,'pendiente',$4)`,
      [id, tutor.id, me.id, new Date().toISOString()])

    res.status(201).json({ ok: true, id, tutor_nombre: tutor.nombre, mensaje: 'Solicitud enviada. Espera que el tutor la apruebe.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /tutor-solicitudes/:id — tutor aprueba o rechaza
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const me = req.user
    if (me.rol !== 'tutor') return res.status(403).json({ error: 'Solo tutores' })

    const sol = await queryOne(`SELECT * FROM tutor_solicitudes WHERE id = $1`, [req.params.id])
    if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada' })
    if (sol.tutor_id !== me.id) return res.status(403).json({ error: 'No es tu solicitud' })
    if (sol.estado !== 'pendiente') return res.status(409).json({ error: 'La solicitud ya fue resuelta' })

    const { accion } = req.body // 'aprobar' | 'rechazar'
    if (!['aprobar', 'rechazar'].includes(accion)) return res.status(400).json({ error: 'accion debe ser aprobar o rechazar' })

    const nuevoEstado = accion === 'aprobar' ? 'aprobada' : 'rechazada'
    await run(`UPDATE tutor_solicitudes SET estado = $1, resuelto_en = $2 WHERE id = $3`,
      [nuevoEstado, new Date().toISOString(), req.params.id])

    if (accion === 'aprobar') {
      await run(`INSERT INTO tutor_alumnos (tutor_id, alumno_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [me.id, sol.alumno_id])
    }

    res.json({ ok: true, estado: nuevoEstado })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /tutor-solicitudes/:id — alumno cancela su solicitud pendiente
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const me = req.user
    const sol = await queryOne(`SELECT * FROM tutor_solicitudes WHERE id = $1`, [req.params.id])
    if (!sol) return res.status(404).json({ error: 'No encontrada' })
    if (sol.alumno_id !== me.id && sol.tutor_id !== me.id) return res.status(403).json({ error: 'Sin permiso' })
    if (sol.estado !== 'pendiente') return res.status(409).json({ error: 'Solo se pueden cancelar solicitudes pendientes' })
    await run(`UPDATE tutor_solicitudes SET estado = 'cancelada', resuelto_en = $1 WHERE id = $2`, [new Date().toISOString(), req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
