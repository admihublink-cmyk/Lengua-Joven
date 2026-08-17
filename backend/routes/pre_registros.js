const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { randomBytes } = require('crypto')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

// POST público — sin auth
router.post('/publico', (req, res) => {
  const { nombre, email, tel, curp, fecha_nacimiento, estado_entidad, idioma_interes, proveedor_interes,
    horario_preferido, como_entero, tutor_nombre, tutor_tel, tutor_email, grupo_interes_id,
    genero_nacimiento, estado_nacimiento } = req.body
  if (!nombre || !email) return res.status(400).json({ error: 'Nombre y email son requeridos' })
  if (!curp || curp.trim().length < 18) return res.status(400).json({ error: 'El CURP es requerido' })

  // Verificar CURP duplicado
  const curpExistePre = db.prepare('SELECT id FROM pre_registros WHERE curp = ?').get(curp.trim().toUpperCase())
  if (curpExistePre) return res.status(400).json({ error: 'Ya existe un pre-registro con ese CURP' })
  const curpExisteUser = db.prepare('SELECT id FROM usuarios WHERE matricula = ?').get(curp.trim().toUpperCase())
  if (curpExisteUser) return res.status(400).json({ error: 'Ya existe una cuenta vinculada a ese CURP' })

  const esMenor = fecha_nacimiento && calcularEdad(fecha_nacimiento) < 18
  if (esMenor && (!tutor_nombre || !tutor_tel || !tutor_email)) {
    return res.status(400).json({ error: 'Los menores de edad deben registrar los datos de su tutor' })
  }

  const count = db.prepare('SELECT COUNT(*) as n FROM pre_registros').get().n
  const folio = 'PRE-' + String(count + 1).padStart(4, '0')
  const newId = 'pr' + (count + 1)
  const fecha = new Date().toISOString()

  db.prepare(`INSERT INTO pre_registros
    (id, folio, nombre, email, tel, curp, fecha_nacimiento, estado_entidad,
     idioma_interes, proveedor_interes, horario_preferido, como_entero,
     estado, fecha_registro, fecha_pago, usuario_id,
     tutor_nombre, tutor_tel, tutor_email, grupo_interes_id,
     genero_nacimiento, estado_nacimiento)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    newId, folio, nombre, email, tel || '', (curp || '').toUpperCase(), fecha_nacimiento || '', estado_entidad || '',
    idioma_interes || '', proveedor_interes || '', horario_preferido || '', como_entero || '',
    'pendiente_pago', fecha, null, null,
    tutor_nombre || null, tutor_tel || null, tutor_email || null,
    grupo_interes_id || null,
    genero_nacimiento || null, estado_nacimiento || null
  )
  res.status(201).json({ folio, id: newId })
})

function calcularEdad(fechaNac) {
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

router.get('/', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  res.json(db.prepare('SELECT * FROM pre_registros ORDER BY fecha_registro DESC').all())
})

router.get('/:id', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const p = db.prepare('SELECT * FROM pre_registros WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ error: 'No encontrado' })
  res.json(p)
})

router.put('/:id/marcar-pagado', requireAuth, (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const pr = db.prepare('SELECT * FROM pre_registros WHERE id = ?').get(req.params.id)
  if (!pr) return res.status(404).json({ error: 'No encontrado' })

  const fecha = new Date().toISOString()
  db.prepare("UPDATE pre_registros SET estado = 'pagado', fecha_pago = ? WHERE id = ?").run(fecha, req.params.id)

  // Registrar pago automáticamente en la tabla pagos
  const cfg = db.prepare("SELECT value FROM config WHERE key = 'costo_inscripcion'").get()
  const monto = cfg ? parseFloat(cfg.value) || 0 : 0
  const pagId = 'pag_pr_' + pr.id + '_' + Date.now()
  db.prepare(`INSERT OR IGNORE INTO pagos (id, alumno_id, inscripcion_id, monto, fecha, estado, metodo_pago, referencia)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(pagId, pr.usuario_id || null, null, monto, fecha, 'pagado', req.body.metodo_pago || 'efectivo', `PRE-${pr.folio}`)

  res.json(db.prepare('SELECT * FROM pre_registros WHERE id = ?').get(req.params.id))
})

router.post('/:id/crear-cuenta', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { password, plantel_id } = req.body
  if (!password || password.length < 6) return res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' })

  const pr = db.prepare('SELECT * FROM pre_registros WHERE id = ?').get(req.params.id)
  if (!pr) return res.status(404).json({ error: 'Pre-registro no encontrado' })
  if (pr.estado === 'cuenta_creada') return res.status(400).json({ error: 'Ya tiene cuenta creada' })

  const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(pr.email)
  if (existing) return res.status(400).json({ error: 'Ya existe un usuario con ese email' })

  const ids = db.prepare('SELECT id FROM usuarios').all().map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('u', '')) || 0), 0)
  const newId = 'u' + (max + 1)
  const hash = bcrypt.hashSync(password, 10)
  const pid = req.user.rol === 'superadmin' ? plantel_id : req.user.plantel_id

  db.prepare(`INSERT INTO usuarios (id, nombre, email, password_hash, rol, plantel_id, activo, estado_entidad)
    VALUES (?,?,?,?,?,?,?,?)`).run(newId, pr.nombre, pr.email, hash, 'alumno', pid || null, 1, pr.estado_entidad || null)

  db.prepare("UPDATE pre_registros SET estado = 'cuenta_creada', usuario_id = ? WHERE id = ?").run(newId, pr.id)

  // Si es menor de edad y tiene datos de tutor, crear/vincular cuenta de tutor
  let tutorResult = null
  if (pr.tutor_email) {
    try {
      const { enviarBienvenidaTutor } = require('../services/email')
      let tutorUsuario = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(pr.tutor_email)
      let tutorId
      let tutorPassword

      if (tutorUsuario) {
        tutorId = tutorUsuario.id
      } else {
        // Generar contraseña aleatoria para el tutor
        tutorPassword = randomBytes(8).toString('base64url').slice(0, 10)
        const allIds = db.prepare('SELECT id FROM usuarios').all().map(r => r.id)
        const maxId = allIds.reduce((m, id) => Math.max(m, parseInt(id.replace('u', '')) || 0), 0)
        tutorId = 'u' + (maxId + 1)
        const tutorHash = bcrypt.hashSync(tutorPassword, 10)
        db.prepare(`INSERT INTO usuarios (id, nombre, email, password_hash, rol, plantel_id, activo)
          VALUES (?,?,?,?,?,?,?)`).run(tutorId, pr.tutor_nombre || 'Tutor', pr.tutor_email, tutorHash, 'tutor', null, 1)
        tutorResult = { email: pr.tutor_email, password: tutorPassword }

        // Enviar correo de bienvenida al tutor
        try {
          await enviarBienvenidaTutor(pr.tutor_email, pr.tutor_nombre || 'Tutor', pr.tutor_email, tutorPassword, pr.nombre)
        } catch (e) {
          console.error('Error enviando correo al tutor:', e.message)
        }
      }

      // Vincular tutor con el alumno
      db.prepare('INSERT OR IGNORE INTO tutor_alumnos (tutor_id, alumno_id) VALUES (?,?)').run(tutorId, newId)
    } catch (e) {
      console.error('Error creando cuenta de tutor:', e.message)
    }
  }

  res.json({ nombre: pr.nombre, email: pr.email, usuario_id: newId, tutor: tutorResult })
})

router.post('/:id/enviar-credenciales', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { password } = req.body
  if (!password) return res.status(400).json({ error: 'Contraseña requerida' })

  const pr = db.prepare('SELECT * FROM pre_registros WHERE id = ?').get(req.params.id)
  if (!pr) return res.status(404).json({ error: 'Pre-registro no encontrado' })

  try {
    const { enviarBienvenida } = require('../services/email')
    await enviarBienvenida(pr.email, pr.nombre, pr.email, password)
    db.prepare('UPDATE pre_registros SET credenciales_enviadas = 1 WHERE id = ?').run(pr.id)
    res.json({ ok: true })
  } catch (e) {
    console.error('Error enviando correo de bienvenida:', e.message)
    res.status(500).json({ error: 'No se pudo enviar el correo. Verifica la configuración de Gmail.' })
  }
})

module.exports = router
