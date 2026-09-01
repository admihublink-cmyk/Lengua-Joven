const { pool, query, queryOne, run } = require('./pool')
const bcrypt = require('bcryptjs')

async function initDB() {
  // Schema
  await pool.query(`
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
      proveedor TEXT,
      token_invalid_before TEXT
    );
    CREATE TABLE IF NOT EXISTS planteles (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      ciudad TEXT,
      convenio_vencimiento TEXT,
      convenio_notificado INTEGER DEFAULT 0,
      razon_social TEXT,
      representante_legal TEXT,
      rfc TEXT,
      domicilio_fiscal TEXT,
      tipo_persona TEXT DEFAULT 'moral',
      proveedor_nombre TEXT
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
      oferta_id TEXT,
      liga_pago TEXT,
      grupo_sugerido_id TEXT
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
      nivel TEXT,
      plantel_id TEXT
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
      usuario_id TEXT,
      credenciales_enviadas INTEGER DEFAULT 0,
      tutor_nombre TEXT,
      tutor_tel TEXT,
      tutor_email TEXT,
      grupo_interes_id TEXT,
      genero_nacimiento TEXT,
      estado_nacimiento TEXT
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
    CREATE TABLE IF NOT EXISTS login_bloqueos (
      ip TEXT PRIMARY KEY,
      intentos INTEGER DEFAULT 0,
      reset_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documentos_convenio (
      id TEXT PRIMARY KEY,
      plantel_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      nombre_original TEXT,
      ruta TEXT,
      fecha_subida TEXT,
      mimetype TEXT
    );
    CREATE TABLE IF NOT EXISTS coordinador_planteles (
      coordinador_id TEXT NOT NULL,
      plantel_id TEXT NOT NULL,
      PRIMARY KEY (coordinador_id, plantel_id)
    );
    CREATE TABLE IF NOT EXISTS periodos_inscripcion (
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
    );
    CREATE TABLE IF NOT EXISTS suscripciones_apertura (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL,
      whatsapp TEXT,
      municipio TEXT,
      idioma TEXT,
      plantel_nombre TEXT,
      fecha TEXT NOT NULL,
      notificado INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tutor_alumnos (
      tutor_id TEXT NOT NULL,
      alumno_id TEXT NOT NULL,
      PRIMARY KEY (tutor_id, alumno_id)
    );
  `)

  // Columnas agregadas después del despliegue inicial
  await pool.query(`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS curp TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS genero_nacimiento TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  `)

  // Tabla de precios por plantel + idioma + categoría
  await pool.query(`
    DROP TABLE IF EXISTS precios;
    CREATE TABLE precios (
      plantel_id TEXT NOT NULL,
      idioma_id  TEXT NOT NULL,
      categoria  TEXT NOT NULL DEFAULT '',
      monto      REAL NOT NULL,
      PRIMARY KEY (plantel_id, idioma_id, categoria)
    );
  `)

  // Deduplicar idiomas con mismo nombre + plantel_id
  await pool.query(`
    DO $$
    DECLARE
      dup RECORD;
      keep_id TEXT;
      del_id TEXT;
    BEGIN
      FOR dup IN
        SELECT nombre, plantel_id, array_agg(id ORDER BY id) AS ids
        FROM idiomas
        GROUP BY nombre, plantel_id
        HAVING COUNT(*) > 1
      LOOP
        keep_id := dup.ids[1];
        FOR i IN 2..array_length(dup.ids, 1) LOOP
          del_id := dup.ids[i];
          UPDATE grupos  SET idioma_id = keep_id WHERE idioma_id = del_id;
          UPDATE niveles SET idioma_id = keep_id WHERE idioma_id = del_id;
          DELETE FROM idiomas WHERE id = del_id;
        END LOOP;
      END LOOP;
    END $$;
  `)

  // Seed if empty
  const { n } = await queryOne('SELECT COUNT(*) AS n FROM usuarios') || { n: '0' }
  if (parseInt(n) === 0) {
    await seed()
  }

  // Force superadmin password
  const SA_HASH = '$2a$10$zxGtzTyHQo6J.pkJCBU7YOAlJxm7Lr4iwub02/45VJp4thsUCl/qO'
  await run("UPDATE usuarios SET password_hash = $1 WHERE email = 'superadmin@injuve.mx'", [SA_HASH])

  // Sync idiomas from ofertas
  await syncIdiomasOferta()

  // Sync planteles from ofertas providers
  await syncPlantalesOferta()

  // Migraciones incrementales
  await pool.query(`ALTER TABLE grupos ADD COLUMN IF NOT EXISTS link_meet TEXT`)
  await pool.query(`ALTER TABLE sesiones ADD COLUMN IF NOT EXISTS link_meet TEXT`)
  await pool.query(`ALTER TABLE pre_registros ADD COLUMN IF NOT EXISTS domicilio TEXT`)
  await pool.query(`ALTER TABLE pre_registros ADD COLUMN IF NOT EXISTS num_exterior TEXT`)
  await pool.query(`ALTER TABLE pre_registros ADD COLUMN IF NOT EXISTS colonia TEXT`)
  await pool.query(`ALTER TABLE pre_registros ADD COLUMN IF NOT EXISTS municipio TEXT`)
  await pool.query(`ALTER TABLE pre_registros ADD COLUMN IF NOT EXISTS rango_edad TEXT`)
  await pool.query(`ALTER TABLE pre_registros ADD COLUMN IF NOT EXISTS apellido_paterno TEXT`)
  await pool.query(`ALTER TABLE pre_registros ADD COLUMN IF NOT EXISTS apellido_materno TEXT`)
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS curp TEXT`)
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS genero_nacimiento TEXT`)

  // Lista de espera
  await pool.query(`ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS posicion_espera INTEGER`)

  // Pagos a maestros por período
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pagos_maestro (
      id          TEXT PRIMARY KEY,
      maestro_id  TEXT NOT NULL,
      periodo     TEXT NOT NULL,
      horas       REAL NOT NULL DEFAULT 0,
      monto       REAL NOT NULL DEFAULT 0,
      estado      TEXT NOT NULL DEFAULT 'pendiente',
      notas       TEXT,
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(maestro_id, periodo)
    )
  `)

  // Tabla de referencias emitidas — nunca se reusan (ver comentario en referencia.js)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referencias_emitidas (
      referencia    TEXT PRIMARY KEY,
      inscripcion_id TEXT NOT NULL,
      lote          TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Columnas del pipeline Banorte en inscripciones
  await pool.query(`
    ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS liga_referencia TEXT;
    ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS liga_monto REAL;
    ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS liga_lote TEXT;
    ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS liga_bajado_en TIMESTAMPTZ;
    ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS liga_pago_cargada_en TIMESTAMPTZ;
    ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS liga_avisada_en TIMESTAMPTZ;
  `)

  // Chat grupos ad-hoc (independientes de los grupos de clase)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_grupos (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      creado_por TEXT NOT NULL,
      created_at TEXT
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_grupo_miembros (
      chat_grupo_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      PRIMARY KEY (chat_grupo_id, usuario_id)
    )
  `)
  // Hacer nullable la columna "para" en mensajes (para mensajes de chat grupal)
  await pool.query(`ALTER TABLE mensajes ALTER COLUMN para DROP NOT NULL`)
  await pool.query(`ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS chat_grupo_id TEXT`)

  // ── Inscripción extemporánea ─────────────────────────────────────────────────
  await pool.query(`ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS es_extemporanea INTEGER DEFAULT 0`)
  await pool.query(`ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS autorizado_por TEXT`)
  await pool.query(`ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS fecha_autorizacion TEXT`)
  await pool.query(`ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS motivo_extemporanea TEXT`)
  await pool.query(`ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS posicion_espera INTEGER`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ins_extemporanea ON inscripciones (es_extemporanea, estado)`)

  // ── Atención a Alumnos ───────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS atencion_solicitudes (
      id TEXT PRIMARY KEY,
      alumno_id TEXT NOT NULL,
      categoria TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'nueva',
      prioridad TEXT NOT NULL DEFAULT 'media',
      confidencial INTEGER DEFAULT 0,
      asignado_a TEXT,
      plantel_id TEXT,
      satisfaccion INTEGER,
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS atencion_mensajes (
      id TEXT PRIMARY KEY,
      solicitud_id TEXT NOT NULL,
      autor_id TEXT NOT NULL,
      contenido TEXT NOT NULL,
      interno INTEGER DEFAULT 0,
      tipo TEXT DEFAULT 'mensaje',
      meta TEXT,
      creado_en TEXT NOT NULL
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS atencion_adjuntos (
      id TEXT PRIMARY KEY,
      solicitud_id TEXT NOT NULL,
      mensaje_id TEXT,
      nombre_original TEXT NOT NULL,
      ruta TEXT NOT NULL,
      mimetype TEXT,
      subido_por TEXT NOT NULL,
      creado_en TEXT NOT NULL
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS atencion_docs_solicitados (
      id TEXT PRIMARY KEY,
      solicitud_id TEXT NOT NULL,
      mensaje_id TEXT NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      estado TEXT DEFAULT 'pendiente',
      motivo_rechazo TEXT,
      adjunto_id TEXT,
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    )
  `)
  // Índices para búsquedas frecuentes
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_atencion_sol_alumno ON atencion_solicitudes (alumno_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_atencion_sol_estado ON atencion_solicitudes (estado)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_atencion_msg_sol ON atencion_mensajes (solicitud_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_atencion_adj_sol ON atencion_adjuntos (solicitud_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_atencion_adj_msg ON atencion_adjuntos (mensaje_id)`)

  // Columna meta en notificaciones (para guardar solicitud_id, etc.)
  await pool.query(`ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS meta TEXT`)

  // ── Calendario institucional (v2.8) ─────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos_calendario (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      tipo TEXT NOT NULL DEFAULT 'general',
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT,
      creado_por TEXT NOT NULL,
      activo INTEGER DEFAULT 1,
      creado_en TEXT NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_eventos_cal_fecha ON eventos_calendario (fecha_inicio, activo)`)
  await pool.query(`ALTER TABLE eventos_calendario ADD COLUMN IF NOT EXISTS plantel_id TEXT`)

  // ── Solicitudes de cambio de grupo/nivel (v2.9) ──────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS solicitudes_cambio (
      id TEXT PRIMARY KEY,
      inscripcion_id TEXT NOT NULL UNIQUE,
      alumno_id TEXT NOT NULL,
      plantel_id TEXT,
      tipo TEXT NOT NULL DEFAULT 'grupo',
      nivel_deseado TEXT,
      horario_preferido TEXT,
      notas TEXT,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      creado_por TEXT NOT NULL,
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cambios_estado ON solicitudes_cambio (estado, plantel_id)`)

  console.log('PostgreSQL inicializado correctamente.')
}

async function seed() {
  const SEED_USUARIOS = [
    { id: 'u1', nombre: 'Super Administrador', email: 'superadmin@injuve.mx', password: 'Admin2025!', rol: 'superadmin', plantel_id: null },
    { id: 'u2', nombre: 'Carmen Lozano',        email: 'director@injuve.mx',  password: 'dir123',    rol: 'director',    plantel_id: 'p1' },
    { id: 'u3', nombre: 'Roberto Méndez',        email: 'coord@injuve.mx',     password: 'coord123',  rol: 'coordinador', plantel_id: 'p1' },
    { id: 'u4', nombre: 'Fernanda Reyes',        email: 'prof@injuve.mx',      password: 'prof123',   rol: 'profesor',    plantel_id: 'p1' },
    { id: 'u5', nombre: 'Luis García',           email: 'alumno@injuve.mx',    password: 'alum123',   rol: 'alumno',      plantel_id: 'p1', matricula: 'INJUVE-2026-001', fecha_nacimiento: '2002-03-15', estado_entidad: 'Nuevo León' },
    { id: 'u6', nombre: 'Patricia Salinas',      email: 'ventas@injuve.mx',    password: 'ventas123', rol: 'admin_ventas',plantel_id: 'p1' },
    { id: 'u7', nombre: 'Ana Torres',            email: 'ana@example.com',     password: 'alum123',   rol: 'alumno',      plantel_id: 'p2', matricula: 'INJUVE-2026-002', fecha_nacimiento: '2001-07-22', estado_entidad: 'Jalisco' },
  ]
  for (const u of SEED_USUARIOS) {
    const hash = bcrypt.hashSync(u.password, 10)
    await run(
      `INSERT INTO usuarios (id, nombre, email, password_hash, rol, plantel_id, activo, matricula, fecha_nacimiento, estado_entidad)
       VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [u.id, u.nombre, u.email, hash, u.rol, u.plantel_id || null, u.matricula || null, u.fecha_nacimiento || null, u.estado_entidad || null]
    )
  }

  await run("INSERT INTO planteles (id, nombre, ciudad, convenio_vencimiento, convenio_notificado) VALUES ('p1','Plantel Monterrey Centro','Monterrey','2026-09-15',0) ON CONFLICT DO NOTHING")
  await run("INSERT INTO planteles (id, nombre, ciudad, convenio_vencimiento, convenio_notificado) VALUES ('p2','Plantel Guadalupe','Guadalupe','2027-01-20',0) ON CONFLICT DO NOTHING")

  const idiomas = [
    ['i1','Inglés','p1'],['i2','Francés','p1'],['i3','Inglés','p2'],['i4','Italiano','p2']
  ]
  for (const [id, nombre, pid] of idiomas) {
    await run('INSERT INTO idiomas VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [id, nombre, pid])
  }

  const niveles = [
    ['n1','i1','A1 — Básico',1],['n2','i1','A2 — Elemental',2],['n3','i1','B1 — Intermedio',3],['n4','i1','B2 — Intermedio Alto',4],
    ['n5','i2','A1 — Básico',1],['n6','i2','A2 — Elemental',2],
    ['n7','i3','Nivel 1',1],['n8','i3','Nivel 2',2],['n9','i3','Nivel 3',3],
    ['n10','i4','Principiante',1],['n11','i4','Básico',2],
  ]
  for (const n of niveles) {
    await run('INSERT INTO niveles VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', n)
  }

  const grupos = [
    ['g1','i1','n1','p1','u4','ING-A1-01','Lun-Mié-Vie 9:00-10:30',20,1,'2026-07-01','2026-08-02','2026-08-03','2026-11-30'],
    ['g2','i1','n2','p1','u4','ING-A2-01','Mar-Jue 18:00-19:30',20,1,'2026-07-01','2026-08-02','2026-08-04','2026-11-30'],
    ['g3','i3','n7','p2',null,'ING-N1-01','Sáb 9:00-12:00',25,1,'','','',''],
    ['g4','i2','n5','p1',null,'FRA-A1-01','Mar-Jue 10:00-11:30',15,1,'','','',''],
  ]
  for (const g of grupos) {
    await run('INSERT INTO grupos VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING', g)
  }

  const sesiones = [
    ['s0','g1','Clase de bienvenida — Demo','unica','2026-07-30','09:00','10:30',1,null,null,null],
    ['s6','g2','Repaso general — Demo','unica','2026-07-30','18:00','19:30',1,null,null,null],
    ['s1','g1','Inglés A1','semanal',null,'09:00','10:30',1,1,'2026-08-03','2026-11-30'],
    ['s2','g1','Inglés A1','semanal',null,'09:00','10:30',1,3,'2026-08-05','2026-11-30'],
    ['s3','g1','Inglés A1','semanal',null,'09:00','10:30',1,5,'2026-08-01','2026-11-30'],
    ['s4','g2','Inglés A2','semanal',null,'18:00','19:30',1,2,'2026-08-04','2026-11-30'],
    ['s5','g2','Inglés A2','semanal',null,'18:00','19:30',1,4,'2026-08-07','2026-11-30'],
  ]
  for (const s of sesiones) {
    await run('INSERT INTO sesiones VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING', s)
  }

  const mensajes = [
    ['m1','u4','u5','¡Hola Luis! Recuerda que hoy tenemos clase virtual. Conéctate puntual.','2026-07-30T08:30:00.000Z',1,'g1'],
    ['m2','u5','u4','Entendido maestra, ahí estaré. ¿Cubriremos el capítulo 3?','2026-07-30T08:35:00.000Z',1,'g1'],
    ['m3','u4','u5','Exacto, capítulo 3 y ejercicios de pronunciación. Trae audífonos','2026-07-30T08:40:00.000Z',0,'g1'],
  ]
  for (const m of mensajes) {
    await run('INSERT INTO mensajes VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING', m)
  }

  const inscripciones = [
    ['ins1','u5','g1','p1','asignada','INJ-0001','2026-06-01','n1','sistema',null,null,null,null],
    ['ins2','u7','g3','p2','pagada','INJ-0002','2026-06-05','n7','sistema',null,null,null,null],
    ['ins3',null,null,'p1','nueva','INJ-0003','2026-07-10',null,null,'Marco Ruiz','marco@email.com','8112345678',null],
    ['ins4',null,null,'p1','bienvenida_enviada','INJ-0004','2026-07-15',null,null,'Sofía Luna','sofia@email.com','8119876543',null],
    ['ins5',null,'g2','p1','boucher_enviado','INJ-0005','2026-07-20','n2','sistema','Pedro Vega','pedro@email.com','8115551234',null],
  ]
  for (const ins of inscripciones) {
    await run(
      `INSERT INTO inscripciones (id,alumno_id,grupo_id,plantel_id,estado,folio,fecha_registro,placement_nivel,sugerida_por,nombre_externo,email_externo,tel_externo,oferta_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
      ins
    )
  }

  const pagos = [
    ['pag1','u5','ins1',1500,'2026-06-10','pagado','transferencia','REF-001'],
    ['pag2','u7','ins2',1500,'2026-06-12','pagado','efectivo','REF-002'],
    ['pag3',null,'ins5',1500,null,'pendiente',null,'REF-003'],
  ]
  for (const p of pagos) {
    await run('INSERT INTO pagos VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING', p)
  }

  const asistencias = [
    ['a1','g1','u5','2026-07-01',1,'u4'],
    ['a2','g1','u5','2026-07-03',1,'u4'],
    ['a3','g1','u5','2026-07-08',0,'u4'],
    ['a4','g1','u5','2026-07-10',1,'u4'],
  ]
  for (const a of asistencias) {
    await run('INSERT INTO asistencias VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', a)
  }

  await run("INSERT INTO evaluaciones VALUES ('e1','u5','g1','parcial',85,'2026-06-30','u4','Buen progreso') ON CONFLICT DO NOTHING")
  await run("INSERT INTO evaluaciones VALUES ('e2','u5','g1','final',90,'2026-07-28','u4','Listo para avanzar') ON CONFLICT DO NOTHING")
  await run("INSERT INTO placements VALUES ('pl1','u5','n1',45,'2026-05-28','u6','Responde bien a vocabulario básico') ON CONFLICT DO NOTHING")
  await run("INSERT INTO placements VALUES ('pl2','u7','n7',50,'2026-06-02','u6','') ON CONFLICT DO NOTHING")
  await run("INSERT INTO avisos VALUES ('av1','Inicio de ciclo agosto 2026','El nuevo ciclo inicia el 4 de agosto. Confirma tu grupo en el portal.',null,null,'u3','2026-07-25',1) ON CONFLICT DO NOTHING")
  await run("INSERT INTO avisos VALUES ('av2','Horario especial semana 31','El viernes 31 de julio no habrá clases por día festivo.','p1','g1','u4','2026-07-28',1) ON CONFLICT DO NOTHING")

  const tareas = [
    ['t1','g1','Vocabulario capítulo 1','Aprende 20 palabras del capítulo 1 y escribe 5 oraciones de ejemplo con cada una.','2026-08-15',15,'u4','2026-07-28',null,null],
    ['t2','g1','Pronunciación — audio','Graba un audio de 2 minutos pronunciando las palabras del capítulo 2 y súbelo al portal.','2026-08-22',10,'u4','2026-07-30',null,null],
    ['t3','g1','Examen parcial escrito','Completa el examen parcial del módulo 1. 50 reactivos de opción múltiple.','2026-08-29',25,'u4','2026-07-30',null,null],
  ]
  for (const t of tareas) {
    await run('INSERT INTO tareas VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING', t)
  }

  await run("INSERT INTO calificaciones_tareas VALUES ('ct1','t1','u5',85,'2026-08-14','Buen trabajo, faltaron 2 oraciones.','u4') ON CONFLICT DO NOTHING")
  await run("INSERT INTO buzon VALUES ('bz1','sugerencia','Aire acondicionado salón 3','Sería bueno revisar el aire acondicionado del salón 3, se siente muy caliente en las clases de la tarde.',0,'u5','p1','nueva','2026-07-29T12:00:00.000Z','',null,null) ON CONFLICT DO NOTHING")
  await run("INSERT INTO notificaciones VALUES ('nf1','u5','aviso','Horario especial semana 31','El viernes 31 de julio no habrá clases por día festivo.','2026-07-28T10:00:00.000Z',0,'av2') ON CONFLICT DO NOTHING")

  const OFERTAS = require('./ofertas_seed.js')
  for (const o of OFERTAS) {
    await run(
      `INSERT INTO ofertas (id,proveedor,sede,idioma,costo,costo_tipo,categoria,edades,modalidad,sistema,no_niveles,material_nivel,horario,examen_ubicacion,nivel)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT DO NOTHING`,
      [
        o.id, o.proveedor, o.sede, o.idioma,
        typeof o.costo === 'number' ? o.costo : null,
        o.costo_tipo, o.categoria, o.edades || '', o.modalidad,
        o.sistema, String(o.no_niveles ?? ''), String(o.material_nivel ?? ''),
        o.horario, o.examen_ubicacion, String(o.nivel ?? '')
      ]
    )
  }

  const configRows = [
    ['nombre_sistema','Lengua Joven'],
    ['correo_soporte','soporte@injuve.mx'],
    ['ciclo_activo','Agosto 2026'],
    ['costo_inscripcion','1500'],
    ['dias_gracia_pago','5'],
    ['tarifa_hora_profesor','150'],
  ]
  for (const [k, v] of configRows) {
    await run('INSERT INTO config VALUES ($1,$2) ON CONFLICT DO NOTHING', [k, v])
  }

  // Seed demo users
  const pwHash = bcrypt.hashSync('Abc12345', 10)
  const ESCUELAS = [
    { pid: 'p8',  abbr: 'item',  base: 20 },
    { pid: 'p5',  abbr: 'ies',   base: 26 },
    { pid: 'p4',  abbr: 'imnar', base: 32 },
    { pid: 'p9',  abbr: 'cca',   base: 38 },
    { pid: 'p6',  abbr: 'len',   base: 44 },
    { pid: 'p7',  abbr: 'utk',   base: 50 },
    { pid: 'p10', abbr: 'alt',   base: 56 },
  ]
  for (const { pid, abbr, base } of ESCUELAS) {
    const uid  = n => `u${base + n}`
    const mail = role => `${role}.${abbr}@lj.test`
    const ins = async (id, nom, email, rol, plantelId, mat, fnac) => {
      await run(
        `INSERT INTO usuarios (id,nombre,email,password_hash,rol,plantel_id,activo,matricula,fecha_nacimiento,estado_entidad)
         VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,'Nuevo León') ON CONFLICT DO NOTHING`,
        [id, nom, email, pwHash, rol, plantelId, mat || null, fnac || null]
      )
    }
    await ins(uid(0), `Coord ${abbr}`, mail('coord'), 'coordinador', pid)
    await run('INSERT INTO coordinador_planteles VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid(0), pid])
    await ins(uid(1), `Dir ${abbr}`, mail('dir'), 'director', pid)
    await ins(uid(2), `Alumno ${abbr}`, mail('alumno'), 'alumno', pid, `MAT-${abbr.toUpperCase()}-01`, '2000-05-10')
    await ins(uid(3), `Menor1 ${abbr}`, mail('menor1'), 'alumno', pid, `MAT-${abbr.toUpperCase()}-02`, '2012-03-15')
    await ins(uid(4), `Menor2 ${abbr}`, mail('menor2'), 'alumno', pid, `MAT-${abbr.toUpperCase()}-03`, '2013-09-22')
    await ins(uid(5), `Tutor ${abbr}`, mail('tutor'), 'tutor', null)
    await run('INSERT INTO tutor_alumnos VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid(5), uid(3)])
    await run('INSERT INTO tutor_alumnos VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid(5), uid(4)])
  }

  console.log('Datos de prueba insertados.')
}

const CIUDADES_PROV = {
  'Altissia': 'En línea',
  'Centro cultural Alemán': 'Monterrey',
  'ITEM Idiomas': 'Monterrey',
  'Idiomas en Serio': 'San Nicolás de los Garza',
  'Instituto Mexicano Norteamericano de Relaciones Culturales': 'Monterrey',
  'Lenglobal': 'En línea',
  'U talk': 'En línea',
}

async function syncPlantalesOferta() {
  const provs = await query("SELECT DISTINCT proveedor FROM ofertas WHERE proveedor IS NOT NULL AND proveedor != ''")
  for (const { proveedor } of provs) {
    let plantel = await queryOne('SELECT id FROM planteles WHERE nombre = $1', [proveedor])
    if (!plantel) {
      const allIds = await query('SELECT id FROM planteles')
      const max = allIds.reduce((m, r) => Math.max(m, parseInt(r.id.replace('p', '')) || 0), 0)
      const newId = 'p' + (max + 1)
      await run(
        'INSERT INTO planteles (id, nombre, ciudad, convenio_vencimiento, convenio_notificado) VALUES ($1,$2,$3,$4,0) ON CONFLICT DO NOTHING',
        [newId, proveedor, CIUDADES_PROV[proveedor] || '', '']
      )
      plantel = { id: newId }
    }
    await run(
      "UPDATE ofertas SET plantel_id = $1 WHERE proveedor = $2 AND (plantel_id IS NULL OR plantel_id = '')",
      [plantel.id, proveedor]
    )
  }
}

async function syncIdiomasOferta() {
  const idiomasOferta = await query("SELECT DISTINCT idioma FROM ofertas WHERE idioma IS NOT NULL AND idioma != ''")
  for (const { idioma } of idiomasOferta) {
    const existe = await queryOne('SELECT id FROM idiomas WHERE nombre = $1', [idioma])
    if (!existe) {
      const allIds = await query('SELECT id FROM idiomas')
      const max = allIds.reduce((m, r) => Math.max(m, parseInt(r.id.replace('i', '')) || 0), 0)
      await run('INSERT INTO idiomas (id, nombre) VALUES ($1,$2) ON CONFLICT DO NOTHING', ['i' + (max + 1), idioma])
    }
  }
}

module.exports = { initDB }
