const { DatabaseSync } = require('node:sqlite')
const path = require('path')
const bcrypt = require('bcryptjs')

const DB_PATH = path.join(__dirname, '..', 'injuve.db')
const db = new DatabaseSync(DB_PATH)

db.exec("PRAGMA journal_mode = WAL")
db.exec("PRAGMA foreign_keys = ON")

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL,
      plantel_id TEXT,
      activo INTEGER DEFAULT 1,
      matricula TEXT,
      fecha_nacimiento TEXT,
      estado_entidad TEXT,
      proveedor TEXT
    );
    CREATE TABLE IF NOT EXISTS planteles (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      ciudad TEXT,
      convenio_vencimiento TEXT,
      convenio_notificado INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS idiomas (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      plantel_id TEXT
    );
    CREATE TABLE IF NOT EXISTS niveles (
      id TEXT PRIMARY KEY,
      idioma_id TEXT NOT NULL,
      nombre TEXT NOT NULL,
      orden INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS grupos (
      id TEXT PRIMARY KEY,
      idioma_id TEXT,
      nivel_id TEXT,
      plantel_id TEXT,
      profesor_id TEXT,
      codigo TEXT,
      horario TEXT,
      cupo INTEGER DEFAULT 20,
      activo INTEGER DEFAULT 1,
      fecha_inicio_inscripciones TEXT,
      fecha_fin_inscripciones TEXT,
      fecha_inicio_clases TEXT,
      fecha_fin_clases TEXT
    );
    CREATE TABLE IF NOT EXISTS sesiones (
      id TEXT PRIMARY KEY,
      grupo_id TEXT,
      titulo TEXT,
      tipo TEXT,
      fecha TEXT,
      hora_inicio TEXT,
      hora_fin TEXT,
      activa INTEGER DEFAULT 1,
      dia_semana INTEGER,
      fecha_inicio TEXT,
      fecha_fin TEXT
    );
    CREATE TABLE IF NOT EXISTS asistencias_sesion (
      id TEXT PRIMARY KEY,
      sesion_id TEXT,
      alumno_id TEXT,
      presente INTEGER DEFAULT 0,
      registrado_por TEXT
    );
    CREATE TABLE IF NOT EXISTS mensajes (
      id TEXT PRIMARY KEY,
      de TEXT NOT NULL,
      para TEXT NOT NULL,
      contenido TEXT,
      fecha TEXT,
      leido INTEGER DEFAULT 0,
      grupo_id TEXT
    );
    CREATE TABLE IF NOT EXISTS inscripciones (
      id TEXT PRIMARY KEY,
      alumno_id TEXT,
      grupo_id TEXT,
      plantel_id TEXT,
      estado TEXT DEFAULT 'nueva',
      folio TEXT,
      fecha_registro TEXT,
      placement_nivel TEXT,
      sugerida_por TEXT,
      nombre_externo TEXT,
      email_externo TEXT,
      tel_externo TEXT,
      oferta_id TEXT
    );
    CREATE TABLE IF NOT EXISTS pagos (
      id TEXT PRIMARY KEY,
      alumno_id TEXT,
      inscripcion_id TEXT,
      monto REAL,
      fecha TEXT,
      estado TEXT,
      metodo_pago TEXT,
      referencia TEXT
    );
    CREATE TABLE IF NOT EXISTS asistencias (
      id TEXT PRIMARY KEY,
      grupo_id TEXT,
      alumno_id TEXT,
      fecha TEXT,
      presente INTEGER DEFAULT 0,
      registrado_por TEXT
    );
    CREATE TABLE IF NOT EXISTS evaluaciones (
      id TEXT PRIMARY KEY,
      alumno_id TEXT,
      grupo_id TEXT,
      tipo TEXT,
      calificacion REAL,
      fecha TEXT,
      registrado_por TEXT,
      observaciones TEXT
    );
    CREATE TABLE IF NOT EXISTS placements (
      id TEXT PRIMARY KEY,
      alumno_id TEXT,
      nivel_sugerido TEXT,
      calificacion REAL,
      fecha TEXT,
      aplicado_por TEXT,
      notas TEXT
    );
    CREATE TABLE IF NOT EXISTS avisos (
      id TEXT PRIMARY KEY,
      titulo TEXT,
      contenido TEXT,
      plantel_id TEXT,
      grupo_id TEXT,
      autor_id TEXT,
      fecha TEXT,
      activo INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS tareas (
      id TEXT PRIMARY KEY,
      grupo_id TEXT,
      titulo TEXT,
      descripcion TEXT,
      fecha_limite TEXT,
      ponderacion REAL,
      creado_por TEXT,
      creado_en TEXT,
      archivo_nombre TEXT,
      archivo_path TEXT
    );
    CREATE TABLE IF NOT EXISTS calificaciones_tareas (
      id TEXT PRIMARY KEY,
      tarea_id TEXT,
      alumno_id TEXT,
      calificacion REAL,
      fecha_entrega TEXT,
      comentario TEXT,
      calificado_por TEXT
    );
    CREATE TABLE IF NOT EXISTS entregas_tareas (
      id TEXT PRIMARY KEY,
      tarea_id TEXT,
      alumno_id TEXT,
      fecha_entrega TEXT,
      archivo_nombre TEXT,
      archivo_path TEXT
    );
    CREATE TABLE IF NOT EXISTS ofertas (
      id TEXT PRIMARY KEY,
      proveedor TEXT,
      sede TEXT,
      idioma TEXT,
      costo REAL,
      costo_tipo TEXT,
      categoria TEXT,
      edades TEXT,
      modalidad TEXT,
      sistema TEXT,
      no_niveles TEXT,
      material_nivel TEXT,
      horario TEXT,
      examen_ubicacion TEXT,
      nivel TEXT
    );
    CREATE TABLE IF NOT EXISTS buzon (
      id TEXT PRIMARY KEY,
      tipo TEXT,
      asunto TEXT,
      mensaje TEXT,
      anonimo INTEGER DEFAULT 0,
      autor_id TEXT,
      plantel_id TEXT,
      estado TEXT DEFAULT 'nueva',
      fecha TEXT,
      respuesta TEXT,
      respondido_por TEXT,
      fecha_respuesta TEXT
    );
    CREATE TABLE IF NOT EXISTS notificaciones (
      id TEXT PRIMARY KEY,
      usuario_id TEXT,
      tipo TEXT,
      titulo TEXT,
      contenido TEXT,
      fecha TEXT,
      leida INTEGER DEFAULT 0,
      ref_id TEXT
    );
    CREATE TABLE IF NOT EXISTS pre_registros (
      id TEXT PRIMARY KEY,
      folio TEXT UNIQUE,
      nombre TEXT,
      email TEXT,
      tel TEXT,
      curp TEXT,
      fecha_nacimiento TEXT,
      estado_entidad TEXT,
      idioma_interes TEXT,
      proveedor_interes TEXT,
      horario_preferido TEXT,
      como_entero TEXT,
      estado TEXT DEFAULT 'pendiente_pago',
      fecha_registro TEXT,
      fecha_pago TEXT,
      usuario_id TEXT
    );
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS reset_tokens (
      token TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      expira_en TEXT NOT NULL,
      usado INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS logs_actividad (
      id TEXT PRIMARY KEY,
      usuario_id TEXT,
      tipo TEXT NOT NULL,
      descripcion TEXT,
      ip TEXT,
      fecha TEXT NOT NULL
    );
  `)

  const count = db.prepare('SELECT COUNT(*) as n FROM usuarios').get()
  if (count.n === 0) seed()
}

function seed() {
  const SEED_USUARIOS = [
    { id: 'u1', nombre: 'Super Administrador', email: 'superadmin@injuve.mx', password: 'admin123', rol: 'superadmin', plantel_id: null, activo: 1 },
    { id: 'u2', nombre: 'Carmen Lozano', email: 'director@injuve.mx', password: 'dir123', rol: 'director', plantel_id: 'p1', activo: 1 },
    { id: 'u3', nombre: 'Roberto Méndez', email: 'coord@injuve.mx', password: 'coord123', rol: 'coordinador', plantel_id: 'p1', activo: 1 },
    { id: 'u4', nombre: 'Fernanda Reyes', email: 'prof@injuve.mx', password: 'prof123', rol: 'profesor', plantel_id: 'p1', activo: 1 },
    { id: 'u5', nombre: 'Luis García', email: 'alumno@injuve.mx', password: 'alum123', rol: 'alumno', plantel_id: 'p1', activo: 1, matricula: 'INJUVE-2026-001', fecha_nacimiento: '2002-03-15', estado_entidad: 'Nuevo León' },
    { id: 'u6', nombre: 'Patricia Salinas', email: 'ventas@injuve.mx', password: 'ventas123', rol: 'admin_ventas', plantel_id: 'p1', activo: 1 },
    { id: 'u7', nombre: 'Ana Torres', email: 'ana@example.com', password: 'alum123', rol: 'alumno', plantel_id: 'p2', activo: 1, matricula: 'INJUVE-2026-002', fecha_nacimiento: '2001-07-22', estado_entidad: 'Jalisco' },
  ]

  const insertUsuario = db.prepare(`
    INSERT OR IGNORE INTO usuarios (id, nombre, email, password_hash, rol, plantel_id, activo, matricula, fecha_nacimiento, estado_entidad, proveedor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const u of SEED_USUARIOS) {
    const hash = bcrypt.hashSync(u.password, 10)
    insertUsuario.run(u.id, u.nombre, u.email, hash, u.rol, u.plantel_id || null, u.activo ? 1 : 0,
      u.matricula || null, u.fecha_nacimiento || null, u.estado_entidad || null, u.proveedor || null)
  }

  const insertPlantel = db.prepare('INSERT OR IGNORE INTO planteles VALUES (?,?,?,?,?)')
  insertPlantel.run('p1', 'Plantel Monterrey Centro', 'Monterrey', '2026-09-15', 0)
  insertPlantel.run('p2', 'Plantel Guadalupe', 'Guadalupe', '2027-01-20', 0)

  const insertIdioma = db.prepare('INSERT OR IGNORE INTO idiomas VALUES (?,?,?)')
  insertIdioma.run('i1', 'Inglés', 'p1')
  insertIdioma.run('i2', 'Francés', 'p1')
  insertIdioma.run('i3', 'Inglés', 'p2')
  insertIdioma.run('i4', 'Italiano', 'p2')

  const insertNivel = db.prepare('INSERT OR IGNORE INTO niveles VALUES (?,?,?,?)')
  const niveles = [
    ['n1','i1','A1 — Básico',1], ['n2','i1','A2 — Elemental',2], ['n3','i1','B1 — Intermedio',3], ['n4','i1','B2 — Intermedio Alto',4],
    ['n5','i2','A1 — Básico',1], ['n6','i2','A2 — Elemental',2],
    ['n7','i3','Nivel 1',1], ['n8','i3','Nivel 2',2], ['n9','i3','Nivel 3',3],
    ['n10','i4','Principiante',1], ['n11','i4','Básico',2],
  ]
  for (const n of niveles) insertNivel.run(...n)

  const insertGrupo = db.prepare('INSERT OR IGNORE INTO grupos VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
  insertGrupo.run('g1','i1','n1','p1','u4','ING-A1-01','Lun-Mié-Vie 9:00-10:30',20,1,'2026-07-01','2026-08-02','2026-08-03','2026-11-30')
  insertGrupo.run('g2','i1','n2','p1','u4','ING-A2-01','Mar-Jue 18:00-19:30',20,1,'2026-07-01','2026-08-02','2026-08-04','2026-11-30')
  insertGrupo.run('g3','i3','n7','p2',null,'ING-N1-01','Sáb 9:00-12:00',25,1,'','','','')
  insertGrupo.run('g4','i2','n5','p1',null,'FRA-A1-01','Mar-Jue 10:00-11:30',15,1,'','','','')

  const insertSesion = db.prepare('INSERT OR IGNORE INTO sesiones VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  insertSesion.run('s0','g1','Clase de bienvenida — Demo','unica','2026-07-30','09:00','10:30',1,null,null,null)
  insertSesion.run('s6','g2','Repaso general — Demo','unica','2026-07-30','18:00','19:30',1,null,null,null)
  insertSesion.run('s1','g1','Inglés A1','semanal',null,'09:00','10:30',1,1,'2026-08-03','2026-11-30')
  insertSesion.run('s2','g1','Inglés A1','semanal',null,'09:00','10:30',1,3,'2026-08-05','2026-11-30')
  insertSesion.run('s3','g1','Inglés A1','semanal',null,'09:00','10:30',1,5,'2026-08-01','2026-11-30')
  insertSesion.run('s4','g2','Inglés A2','semanal',null,'18:00','19:30',1,2,'2026-08-04','2026-11-30')
  insertSesion.run('s5','g2','Inglés A2','semanal',null,'18:00','19:30',1,4,'2026-08-07','2026-11-30')

  const insertMensaje = db.prepare('INSERT OR IGNORE INTO mensajes VALUES (?,?,?,?,?,?,?)')
  insertMensaje.run('m1','u4','u5','¡Hola Luis! Recuerda que hoy tenemos clase virtual. Conéctate puntual.','2026-07-30T08:30:00.000Z',1,'g1')
  insertMensaje.run('m2','u5','u4','Entendido maestra, ahí estaré. ¿Cubriremos el capítulo 3?','2026-07-30T08:35:00.000Z',1,'g1')
  insertMensaje.run('m3','u4','u5','Exacto, capítulo 3 y ejercicios de pronunciación. Trae audífonos','2026-07-30T08:40:00.000Z',0,'g1')

  const insertInscripcion = db.prepare('INSERT OR IGNORE INTO inscripciones VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
  insertInscripcion.run('ins1','u5','g1','p1','asignada','INJ-0001','2026-06-01','n1','sistema',null,null,null,null)
  insertInscripcion.run('ins2','u7','g3','p2','pagada','INJ-0002','2026-06-05','n7','sistema',null,null,null,null)
  insertInscripcion.run('ins3',null,null,'p1','nueva','INJ-0003','2026-07-10',null,null,'Marco Ruiz','marco@email.com','8112345678',null)
  insertInscripcion.run('ins4',null,null,'p1','bienvenida_enviada','INJ-0004','2026-07-15',null,null,'Sofía Luna','sofia@email.com','8119876543',null)
  insertInscripcion.run('ins5',null,'g2','p1','boucher_enviado','INJ-0005','2026-07-20','n2','sistema','Pedro Vega','pedro@email.com','8115551234',null)

  db.prepare('INSERT OR IGNORE INTO pagos VALUES (?,?,?,?,?,?,?,?)').run('pag1','u5','ins1',1500,'2026-06-10','pagado','transferencia','REF-001')
  db.prepare('INSERT OR IGNORE INTO pagos VALUES (?,?,?,?,?,?,?,?)').run('pag2','u7','ins2',1500,'2026-06-12','pagado','efectivo','REF-002')
  db.prepare('INSERT OR IGNORE INTO pagos VALUES (?,?,?,?,?,?,?,?)').run('pag3',null,'ins5',1500,null,'pendiente',null,'REF-003')

  const insertAsist = db.prepare('INSERT OR IGNORE INTO asistencias VALUES (?,?,?,?,?,?)')
  insertAsist.run('a1','g1','u5','2026-07-01',1,'u4')
  insertAsist.run('a2','g1','u5','2026-07-03',1,'u4')
  insertAsist.run('a3','g1','u5','2026-07-08',0,'u4')
  insertAsist.run('a4','g1','u5','2026-07-10',1,'u4')

  const insertEval = db.prepare('INSERT OR IGNORE INTO evaluaciones VALUES (?,?,?,?,?,?,?,?)')
  insertEval.run('e1','u5','g1','parcial',85,'2026-06-30','u4','Buen progreso')
  insertEval.run('e2','u5','g1','final',90,'2026-07-28','u4','Listo para avanzar')

  db.prepare('INSERT OR IGNORE INTO placements VALUES (?,?,?,?,?,?,?)').run('pl1','u5','n1',45,'2026-05-28','u6','Responde bien a vocabulario básico')
  db.prepare('INSERT OR IGNORE INTO placements VALUES (?,?,?,?,?,?,?)').run('pl2','u7','n7',50,'2026-06-02','u6','')

  db.prepare('INSERT OR IGNORE INTO avisos VALUES (?,?,?,?,?,?,?,?)').run('av1','Inicio de ciclo agosto 2026','El nuevo ciclo inicia el 4 de agosto. Confirma tu grupo en el portal.',null,null,'u3','2026-07-25',1)
  db.prepare('INSERT OR IGNORE INTO avisos VALUES (?,?,?,?,?,?,?,?)').run('av2','Horario especial semana 31','El viernes 31 de julio no habrá clases por día festivo.','p1','g1','u4','2026-07-28',1)

  const insertTarea = db.prepare('INSERT OR IGNORE INTO tareas VALUES (?,?,?,?,?,?,?,?,?,?)')
  insertTarea.run('t1','g1','Vocabulario capítulo 1','Aprende 20 palabras del capítulo 1 y escribe 5 oraciones de ejemplo con cada una.','2026-08-15',15,'u4','2026-07-28',null,null)
  insertTarea.run('t2','g1','Pronunciación — audio','Graba un audio de 2 minutos pronunciando las palabras del capítulo 2 y súbelo al portal.','2026-08-22',10,'u4','2026-07-30',null,null)
  insertTarea.run('t3','g1','Examen parcial escrito','Completa el examen parcial del módulo 1. 50 reactivos de opción múltiple.','2026-08-29',25,'u4','2026-07-30',null,null)

  db.prepare('INSERT OR IGNORE INTO calificaciones_tareas VALUES (?,?,?,?,?,?,?)').run('ct1','t1','u5',85,'2026-08-14','Buen trabajo, faltaron 2 oraciones.','u4')

  db.prepare('INSERT OR IGNORE INTO buzon VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('bz1','sugerencia','Aire acondicionado salón 3','Sería bueno revisar el aire acondicionado del salón 3, se siente muy caliente en las clases de la tarde.',0,'u5','p1','nueva','2026-07-29T12:00:00.000Z','',null,null)

  db.prepare('INSERT OR IGNORE INTO notificaciones VALUES (?,?,?,?,?,?,?,?)').run('nf1','u5','aviso','Horario especial semana 31','El viernes 31 de julio no habrá clases por día festivo.','2026-07-28T10:00:00.000Z',0,'av2')

  const insertOferta = db.prepare('INSERT OR IGNORE INTO ofertas VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const OFERTAS = require('./ofertas_seed.js')
  for (const o of OFERTAS) {
    insertOferta.run(
      o.id, o.proveedor, o.sede, o.idioma,
      typeof o.costo === 'number' ? o.costo : null,
      o.costo_tipo, o.categoria, o.edades || '', o.modalidad,
      o.sistema, String(o.no_niveles ?? ''), String(o.material_nivel ?? ''),
      o.horario, o.examen_ubicacion, String(o.nivel ?? '')
    )
  }

  const insertConfig = db.prepare('INSERT OR IGNORE INTO config VALUES (?,?)')
  insertConfig.run('nombre_sistema', 'Lengua Joven')
  insertConfig.run('correo_soporte', 'soporte@injuve.mx')
  insertConfig.run('ciclo_activo', 'Agosto 2026')
  insertConfig.run('costo_inscripcion', '1500')
  insertConfig.run('dias_gracia_pago', '5')

  console.log('Base de datos inicializada con datos de prueba.')
}

init()

// Migraciones incrementales (seguras si la columna ya existe)
try { db.exec("ALTER TABLE pre_registros ADD COLUMN credenciales_enviadas INTEGER DEFAULT 0") } catch (_) {}
try { db.exec("ALTER TABLE planteles ADD COLUMN razon_social TEXT") } catch (_) {}
try { db.exec("ALTER TABLE planteles ADD COLUMN representante_legal TEXT") } catch (_) {}
try { db.exec("ALTER TABLE planteles ADD COLUMN rfc TEXT") } catch (_) {}
try { db.exec("ALTER TABLE planteles ADD COLUMN domicilio_fiscal TEXT") } catch (_) {}
try { db.exec("ALTER TABLE planteles ADD COLUMN tipo_persona TEXT DEFAULT 'moral'") } catch (_) {}
try { db.exec("ALTER TABLE planteles ADD COLUMN proveedor_nombre TEXT") } catch (_) {}
try { db.exec("ALTER TABLE inscripciones ADD COLUMN liga_pago TEXT") } catch (_) {}
try {
  db.exec(`CREATE TABLE IF NOT EXISTS documentos_convenio (
    id TEXT PRIMARY KEY,
    plantel_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    nombre_original TEXT,
    ruta TEXT,
    fecha_subida TEXT,
    mimetype TEXT
  )`)
} catch (_) {}
try {
  db.exec(`CREATE TABLE IF NOT EXISTS coordinador_planteles (
    coordinador_id TEXT NOT NULL,
    plantel_id TEXT NOT NULL,
    PRIMARY KEY (coordinador_id, plantel_id)
  )`)
} catch (_) {}
try {
  db.exec(`CREATE TABLE IF NOT EXISTS periodos_inscripcion (
    id TEXT PRIMARY KEY,
    plantel_id TEXT NOT NULL,
    idioma_id TEXT,
    ciclo TEXT,
    inicio_prereg TEXT,
    fin_prereg TEXT,
    fecha_examen TEXT,
    fecha_asignacion TEXT,
    fecha_inicio_clases TEXT,
    UNIQUE(plantel_id, idioma_id)
  )`)
} catch (_) {}
try { db.exec("ALTER TABLE pre_registros ADD COLUMN tutor_nombre TEXT") } catch (_) {}
try { db.exec("ALTER TABLE pre_registros ADD COLUMN tutor_tel TEXT") } catch (_) {}
try { db.exec("ALTER TABLE pre_registros ADD COLUMN tutor_email TEXT") } catch (_) {}
try { db.exec("ALTER TABLE pre_registros ADD COLUMN grupo_interes_id TEXT") } catch (_) {}
try {
  db.exec(`CREATE TABLE IF NOT EXISTS tutor_alumnos (
    tutor_id TEXT NOT NULL,
    alumno_id TEXT NOT NULL,
    PRIMARY KEY (tutor_id, alumno_id)
  )`)
} catch (_) {}

// Migración: vincular ofertas con planteles
try { db.exec("ALTER TABLE ofertas ADD COLUMN plantel_id TEXT") } catch (_) {}

// Crear un plantel por cada proveedor distinto en ofertas y vincularlo
const CIUDADES_PROV = {
  'Altissia': 'En línea',
  'Centro cultural Alemán': 'Monterrey',
  'ITEM Idiomas': 'Monterrey',
  'Idiomas en Serio': 'San Nicolás de los Garza',
  'Instituto Mexicano Norteamericano de Relaciones Culturales': 'Monterrey',
  'Lenglobal': 'En línea',
  'U talk': 'En línea',
}
try {
  const provs = db.prepare("SELECT DISTINCT proveedor FROM ofertas WHERE proveedor IS NOT NULL AND proveedor != ''").all()
  for (const { proveedor } of provs) {
    let plantel = db.prepare("SELECT id FROM planteles WHERE nombre = ?").get(proveedor)
    if (!plantel) {
      const allIds = db.prepare("SELECT id FROM planteles").all().map(r => r.id)
      const max = allIds.reduce((m, id) => Math.max(m, parseInt(id.replace('p', '')) || 0), 0)
      const newId = 'p' + (max + 1)
      db.prepare("INSERT INTO planteles (id, nombre, ciudad, convenio_vencimiento, convenio_notificado) VALUES (?,?,?,?,?)").run(newId, proveedor, CIUDADES_PROV[proveedor] || '', '', 0)
      plantel = { id: newId }
    }
    db.prepare("UPDATE ofertas SET plantel_id = ? WHERE proveedor = ? AND (plantel_id IS NULL OR plantel_id = '')").run(plantel.id, proveedor)
  }
} catch (_) {}

// Seed de usuarios demo: un juego por cada escuela de la oferta educativa
try {
  const pwHash = bcrypt.hashSync('Abc12345', 10)
  const insU = db.prepare(`INSERT OR IGNORE INTO usuarios
    (id, nombre, email, password_hash, rol, plantel_id, activo, matricula, fecha_nacimiento, estado_entidad)
    VALUES (?,?,?,?,?,?,1,?,?,?)`)
  const insCP = db.prepare('INSERT OR IGNORE INTO coordinador_planteles (coordinador_id, plantel_id) VALUES (?,?)')
  const insTA = db.prepare('INSERT OR IGNORE INTO tutor_alumnos (tutor_id, alumno_id) VALUES (?,?)')

  const ESCUELAS = [
    { pid: 'p8',  abbr: 'item',  nom: 'ITEM Idiomas',         base: 20 },
    { pid: 'p5',  abbr: 'ies',   nom: 'Idiomas en Serio',     base: 26 },
    { pid: 'p4',  abbr: 'imnar', nom: 'Inst. Mex. Norteam.',  base: 32 },
    { pid: 'p9',  abbr: 'cca',   nom: 'C. Cultural Alemán',   base: 38 },
    { pid: 'p6',  abbr: 'len',   nom: 'Lenglobal',            base: 44 },
    { pid: 'p7',  abbr: 'utk',   nom: 'U talk',               base: 50 },
    { pid: 'p10', abbr: 'alt',   nom: 'Altissia',             base: 56 },
  ]

  for (const { pid, abbr, nom, base } of ESCUELAS) {
    const uid  = n => `u${base + n}`
    const mail = role => `${role}.${abbr}@lj.test`
    // coordinador
    insU.run(uid(0), `Coord ${nom}`,   mail('coord'),  pwHash, 'coordinador', pid, null, null, 'Nuevo León')
    insCP.run(uid(0), pid)
    // director
    insU.run(uid(1), `Dir ${nom}`,     mail('dir'),    pwHash, 'director',    pid, null, null, 'Nuevo León')
    // alumno adulto (nacido 2000)
    insU.run(uid(2), `Alumno ${nom}`,  mail('alumno'), pwHash, 'alumno',      pid, `MAT-${abbr.toUpperCase()}-01`, '2000-05-10', 'Nuevo León')
    // menor 1 (nacido 2012)
    insU.run(uid(3), `Menor1 ${nom}`,  mail('menor1'), pwHash, 'alumno',      pid, `MAT-${abbr.toUpperCase()}-02`, '2012-03-15', 'Nuevo León')
    // menor 2 (nacido 2013)
    insU.run(uid(4), `Menor2 ${nom}`,  mail('menor2'), pwHash, 'alumno',      pid, `MAT-${abbr.toUpperCase()}-03`, '2013-09-22', 'Nuevo León')
    // tutor compartido para los 2 menores
    insU.run(uid(5), `Tutor ${nom}`,   mail('tutor'),  pwHash, 'tutor',       null, null, null, 'Nuevo León')
    insTA.run(uid(5), uid(3))
    insTA.run(uid(5), uid(4))
  }
} catch (e) { console.error('Seed demo usuarios:', e.message) }

// Sincronizar idiomas: agregar a la tabla idiomas cualquier idioma que exista en ofertas y no esté registrado
try {
  const idiomasOferta = db.prepare("SELECT DISTINCT idioma FROM ofertas WHERE idioma IS NOT NULL AND idioma != ''").all()
  for (const { idioma } of idiomasOferta) {
    const existe = db.prepare("SELECT id FROM idiomas WHERE nombre = ?").get(idioma)
    if (!existe) {
      const allIds = db.prepare("SELECT id FROM idiomas").all().map(r => r.id)
      const max = allIds.reduce((m, id) => Math.max(m, parseInt(id.replace('i', '')) || 0), 0)
      db.prepare("INSERT INTO idiomas (id, nombre) VALUES (?,?)").run('i' + (max + 1), idioma)
    }
  }
} catch (_) {}

module.exports = db
