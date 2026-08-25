const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { randomBytes } = require('crypto')
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

// Rate limiting para el endpoint público (5 por 15 min por IP)
const _preRegRL = new Map()
function checkPreRegRL(ip) {
  const now = Date.now()
  const rec = _preRegRL.get(ip) || { n: 0, reset: now + 15 * 60 * 1000 }
  if (now > rec.reset) { rec.n = 0; rec.reset = now + 15 * 60 * 1000 }
  rec.n++
  _preRegRL.set(ip, rec)
  return rec.n <= 5
}

// POST público — sin auth
router.post('/publico', async (req, res) => { try {
  if (!checkPreRegRL(req.ip)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Espera unos minutos e intenta de nuevo.' })
  }
  const { nombre, email, tel, curp, fecha_nacimiento, estado_entidad, idioma_interes, proveedor_interes,
    horario_preferido, como_entero, tutor_nombre, tutor_tel, tutor_email, grupo_interes_id,
    genero_nacimiento, estado_nacimiento, acepto_aviso, aviso_id } = req.body
  if (!nombre || !email) return res.status(400).json({ error: 'Nombre y email son requeridos' })
  if (!acepto_aviso) return res.status(400).json({ error: 'Debes aceptar el aviso de privacidad para continuar.' })
  const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/
  if (!curp || !CURP_REGEX.test(curp.trim().toUpperCase())) {
    return res.status(400).json({ error: 'CURP inválido. Verifica que tenga el formato correcto (18 caracteres).' })
  }

  // Verificar CURP duplicado
  const curpExistePre = await queryOne('SELECT id FROM pre_registros WHERE curp = $1', [curp.trim().toUpperCase()])
  if (curpExistePre) return res.status(400).json({ error: 'Ya existe un pre-registro con ese CURP' })
  const curpExisteUser = await queryOne('SELECT id FROM usuarios WHERE matricula = $1', [curp.trim().toUpperCase()])
  if (curpExisteUser) return res.status(400).json({ error: 'Ya existe una cuenta vinculada a ese CURP' })

  const esMenor = fecha_nacimiento && calcularEdad(fecha_nacimiento) < 18
  if (esMenor && (!tutor_nombre || !tutor_tel || !tutor_email)) {
    return res.status(400).json({ error: 'Los menores de edad deben registrar los datos de su tutor' })
  }

  const { m: maxNum } = await queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)), 0) AS m FROM pre_registros WHERE id ~ '^pr[0-9]+'`, []
  )
  const folio = 'PRE-' + String(maxNum + 1).padStart(4, '0')
  const newId = 'pr' + (maxNum + 1)
  const fecha = new Date().toISOString()

  await run(`INSERT INTO pre_registros
    (id, folio, nombre, email, tel, curp, fecha_nacimiento, estado_entidad,
     idioma_interes, proveedor_interes, horario_preferido, como_entero,
     estado, fecha_registro, fecha_pago, usuario_id,
     tutor_nombre, tutor_tel, tutor_email, grupo_interes_id,
     genero_nacimiento, estado_nacimiento)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    [newId, folio, nombre, email, tel || '', (curp || '').toUpperCase(), fecha_nacimiento || '', estado_entidad || '',
    idioma_interes || '', proveedor_interes || '', horario_preferido || '', como_entero || '',
    'pendiente_pago', fecha, null, null,
    tutor_nombre || null, tutor_tel || null, tutor_email || null,
    grupo_interes_id || null,
    genero_nacimiento || null, estado_nacimiento || null])
  // Registrar aceptación del aviso de privacidad
  try {
    let avisoData = null
    if (aviso_id) {
      avisoData = await queryOne('SELECT id, nombre, version FROM avisos_privacidad WHERE id = $1', [aviso_id])
    }
    if (!avisoData) {
      avisoData = await queryOne(
        'SELECT id, nombre, version FROM avisos_privacidad WHERE activo = true ORDER BY creado_en DESC LIMIT 1'
      )
    }
    if (avisoData) {
      const esMenor = fecha_nacimiento && calcularEdad(fecha_nacimiento) < 18
      await run(
        `INSERT INTO avisos_aceptaciones
           (aviso_id, aviso_nombre, aviso_version, titular_tipo, titular_nombre, titular_email, pre_registro_id, ip)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          avisoData.id, avisoData.nombre, avisoData.version,
          esMenor ? 'tutor' : 'pre_registro',
          esMenor ? (tutor_nombre || nombre) : nombre,
          esMenor ? (tutor_email || email) : email,
          newId,
          req.ip,
        ]
      )
    }
  } catch (e) {
    console.error('[aviso_aceptacion]', e.message)
  }

  res.status(201).json({ folio, id: newId })
  } catch (e) {
    console.error('[pre_registros/publico]', e.message)
    res.status(500).json({ error: 'Error al procesar el pre-registro. Intenta de nuevo.' })
  }
})

function calcularEdad(fechaNac) {
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

router.get('/', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  res.json(await query('SELECT * FROM pre_registros ORDER BY fecha_registro DESC', []))
})

router.get('/:id', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const p = await queryOne('SELECT * FROM pre_registros WHERE id = $1', [req.params.id])
  if (!p) return res.status(404).json({ error: 'No encontrado' })
  res.json(p)
})

router.put('/:id/marcar-pagado', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador', 'admin_ventas'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const pr = await queryOne('SELECT * FROM pre_registros WHERE id = $1', [req.params.id])
  if (!pr) return res.status(404).json({ error: 'No encontrado' })

  const fecha = new Date().toISOString()
  await run("UPDATE pre_registros SET estado = 'pagado', fecha_pago = $1 WHERE id = $2", [fecha, req.params.id])

  // Registrar pago automáticamente en la tabla pagos
  const cfg = await queryOne("SELECT value FROM config WHERE key = 'costo_inscripcion'", [])
  const monto = cfg ? parseFloat(cfg.value) || 0 : 0
  const pagId = 'pag_pr_' + pr.id + '_' + Date.now()
  await run(`INSERT INTO pagos (id, alumno_id, inscripcion_id, monto, fecha, estado, metodo_pago, referencia)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
    [pagId, pr.usuario_id || null, null, monto, fecha, 'pagado', req.body.metodo_pago || 'efectivo', `PRE-${pr.folio}`])

  res.json(await queryOne('SELECT * FROM pre_registros WHERE id = $1', [req.params.id]))
})

router.post('/:id/crear-cuenta', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const { password, plantel_id } = req.body
  if (!password || password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })

  const pr = await queryOne('SELECT * FROM pre_registros WHERE id = $1', [req.params.id])
  if (!pr) return res.status(404).json({ error: 'Pre-registro no encontrado' })
  if (pr.estado === 'cuenta_creada') return res.status(400).json({ error: 'Ya tiene cuenta creada' })

  const existing = await queryOne('SELECT id FROM usuarios WHERE email = $1', [pr.email])
  if (existing) return res.status(400).json({ error: 'Ya existe un usuario con ese email' })

  const ids = (await query('SELECT id FROM usuarios', [])).map(r => r.id)
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace('u', '')) || 0), 0)
  const newId = 'u' + (max + 1)
  const hash = bcrypt.hashSync(password, 10)
  const pid = req.user.rol === 'superadmin' ? plantel_id : req.user.plantel_id

  await run(`INSERT INTO usuarios (id, nombre, email, password_hash, rol, plantel_id, activo, estado_entidad)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [newId, pr.nombre, pr.email, hash, 'alumno', pid || null, 1, pr.estado_entidad || null])

  await run("UPDATE pre_registros SET estado = 'cuenta_creada', usuario_id = $1 WHERE id = $2", [newId, pr.id])

  // Si es menor de edad y tiene datos de tutor, crear/vincular cuenta de tutor
  let tutorResult = null
  if (pr.tutor_email) {
    try {
      const { enviarBienvenidaTutor } = require('../services/email')
      let tutorUsuario = await queryOne('SELECT id FROM usuarios WHERE email = $1', [pr.tutor_email])
      let tutorId
      let tutorPassword

      if (tutorUsuario) {
        tutorId = tutorUsuario.id
      } else {
        // Generar contraseña aleatoria para el tutor
        tutorPassword = randomBytes(8).toString('base64url').slice(0, 10)
        const allIds = (await query('SELECT id FROM usuarios', [])).map(r => r.id)
        const maxId = allIds.reduce((m, id) => Math.max(m, parseInt(id.replace('u', '')) || 0), 0)
        tutorId = 'u' + (maxId + 1)
        const tutorHash = bcrypt.hashSync(tutorPassword, 10)
        await run(`INSERT INTO usuarios (id, nombre, email, password_hash, rol, plantel_id, activo)
          VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [tutorId, pr.tutor_nombre || 'Tutor', pr.tutor_email, tutorHash, 'tutor', null, 1])
        tutorResult = { email: pr.tutor_email, enviado: true }

        // Enviar correo de bienvenida al tutor
        try {
          await enviarBienvenidaTutor(pr.tutor_email, pr.tutor_nombre || 'Tutor', pr.tutor_email, tutorPassword, pr.nombre)
        } catch (e) {
          console.error('Error enviando correo al tutor:', e.message)
        }
      }

      // Vincular tutor con el alumno
      await run('INSERT INTO tutor_alumnos (tutor_id, alumno_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [tutorId, newId])
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

  const pr = await queryOne('SELECT * FROM pre_registros WHERE id = $1', [req.params.id])
  if (!pr) return res.status(404).json({ error: 'Pre-registro no encontrado' })

  try {
    const { enviarBienvenida } = require('../services/email')
    await enviarBienvenida(pr.email, pr.nombre, pr.email, password)
    await run('UPDATE pre_registros SET credenciales_enviadas = 1 WHERE id = $1', [pr.id])
    res.json({ ok: true })
  } catch (e) {
    console.error('Error enviando correo de bienvenida:', e.message)
    res.status(500).json({ error: 'No se pudo enviar el correo. Verifica la configuración de Gmail.' })
  }
})

module.exports = router
