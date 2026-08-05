// Store basado en localStorage — simula la BD del diagrama ER
const KEY = 'injuve_panel_v2'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// FNV-1a hash — las contraseñas se almacenan siempre como hash de 8 hex chars
export function hashPwd(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
function isHashed(s) { return typeof s === 'string' && /^[0-9a-f]{8}$/.test(s) }

const SEED = {
  usuarios: [
    { id: 'u1', nombre: 'Super Administrador', email: 'superadmin@injuve.mx', password: '7045830c', rol: 'superadmin', plantel_id: null, activo: true },
    { id: 'u2', nombre: 'Carmen Lozano', email: 'director@injuve.mx', password: '52e2318c', rol: 'director', plantel_id: 'p1', activo: true },
    { id: 'u3', nombre: 'Roberto Méndez', email: 'coord@injuve.mx', password: 'f31af9ba', rol: 'coordinador', plantel_id: 'p1', activo: true },
    { id: 'u4', nombre: 'Fernanda Reyes', email: 'prof@injuve.mx', password: '4e3cb63e', rol: 'profesor', plantel_id: 'p1', activo: true },
    { id: 'u5', nombre: 'Luis García', email: 'alumno@injuve.mx', password: '90bf66ab', rol: 'alumno', plantel_id: 'p1', activo: true, matricula: 'INJUVE-2026-001', fecha_nacimiento: '2002-03-15', estado_entidad: 'Nuevo León' },
    { id: 'u6', nombre: 'Patricia Salinas', email: 'ventas@injuve.mx', password: '71a2839e', rol: 'admin_ventas', plantel_id: 'p1', activo: true },
    { id: 'u7', nombre: 'Ana Torres', email: 'ana@example.com', password: '90bf66ab', rol: 'alumno', plantel_id: 'p2', activo: true, matricula: 'INJUVE-2026-002', fecha_nacimiento: '2001-07-22', estado_entidad: 'Jalisco' },
  ],
  planteles: [
    { id: 'p1', nombre: 'Plantel Monterrey Centro', ciudad: 'Monterrey', convenio_vencimiento: '2026-09-15', convenio_notificado: false },
    { id: 'p2', nombre: 'Plantel Guadalupe', ciudad: 'Guadalupe', convenio_vencimiento: '2027-01-20', convenio_notificado: false },
  ],
  idiomas: [
    { id: 'i1', nombre: 'Inglés', plantel_id: 'p1' },
    { id: 'i2', nombre: 'Francés', plantel_id: 'p1' },
    { id: 'i3', nombre: 'Inglés', plantel_id: 'p2' },
    { id: 'i4', nombre: 'Italiano', plantel_id: 'p2' },
  ],
  niveles: [
    { id: 'n1', idioma_id: 'i1', nombre: 'A1 — Básico', orden: 1 },
    { id: 'n2', idioma_id: 'i1', nombre: 'A2 — Elemental', orden: 2 },
    { id: 'n3', idioma_id: 'i1', nombre: 'B1 — Intermedio', orden: 3 },
    { id: 'n4', idioma_id: 'i1', nombre: 'B2 — Intermedio Alto', orden: 4 },
    { id: 'n5', idioma_id: 'i2', nombre: 'A1 — Básico', orden: 1 },
    { id: 'n6', idioma_id: 'i2', nombre: 'A2 — Elemental', orden: 2 },
    { id: 'n7', idioma_id: 'i3', nombre: 'Nivel 1', orden: 1 },
    { id: 'n8', idioma_id: 'i3', nombre: 'Nivel 2', orden: 2 },
    { id: 'n9', idioma_id: 'i3', nombre: 'Nivel 3', orden: 3 },
    { id: 'n10', idioma_id: 'i4', nombre: 'Principiante', orden: 1 },
    { id: 'n11', idioma_id: 'i4', nombre: 'Básico', orden: 2 },
  ],
  grupos: [
    { id: 'g1', idioma_id: 'i1', nivel_id: 'n1', plantel_id: 'p1', profesor_id: 'u4', codigo: 'ING-A1-01', horario: 'Lun-Mié-Vie 9:00-10:30', cupo: 20, activo: true, fecha_inicio_inscripciones: '2026-07-01', fecha_fin_inscripciones: '2026-08-02', fecha_inicio_clases: '2026-08-03', fecha_fin_clases: '2026-11-30' },
    { id: 'g2', idioma_id: 'i1', nivel_id: 'n2', plantel_id: 'p1', profesor_id: 'u4', codigo: 'ING-A2-01', horario: 'Mar-Jue 18:00-19:30', cupo: 20, activo: true, fecha_inicio_inscripciones: '2026-07-01', fecha_fin_inscripciones: '2026-08-02', fecha_inicio_clases: '2026-08-04', fecha_fin_clases: '2026-11-30' },
    { id: 'g3', idioma_id: 'i3', nivel_id: 'n7', plantel_id: 'p2', profesor_id: null, codigo: 'ING-N1-01', horario: 'Sáb 9:00-12:00', cupo: 25, activo: true, fecha_inicio_inscripciones: '', fecha_fin_inscripciones: '', fecha_inicio_clases: '', fecha_fin_clases: '' },
    { id: 'g4', idioma_id: 'i2', nivel_id: 'n5', plantel_id: 'p1', profesor_id: null, codigo: 'FRA-A1-01', horario: 'Mar-Jue 10:00-11:30', cupo: 15, activo: true, fecha_inicio_inscripciones: '', fecha_fin_inscripciones: '', fecha_inicio_clases: '', fecha_fin_clases: '' },
  ],
  sesiones: [
    { id: 's0', grupo_id: 'g1', titulo: 'Clase de bienvenida — Demo', tipo: 'unica', fecha: '2026-07-30', hora_inicio: '09:00', hora_fin: '10:30', activa: true },
    { id: 's6', grupo_id: 'g2', titulo: 'Repaso general — Demo', tipo: 'unica', fecha: '2026-07-30', hora_inicio: '18:00', hora_fin: '19:30', activa: true },
    { id: 's1', grupo_id: 'g1', titulo: 'Inglés A1', tipo: 'semanal', dia_semana: 1, hora_inicio: '09:00', hora_fin: '10:30', fecha_inicio: '2026-08-03', fecha_fin: '2026-11-30', activa: true },
    { id: 's2', grupo_id: 'g1', titulo: 'Inglés A1', tipo: 'semanal', dia_semana: 3, hora_inicio: '09:00', hora_fin: '10:30', fecha_inicio: '2026-08-05', fecha_fin: '2026-11-30', activa: true },
    { id: 's3', grupo_id: 'g1', titulo: 'Inglés A1', tipo: 'semanal', dia_semana: 5, hora_inicio: '09:00', hora_fin: '10:30', fecha_inicio: '2026-08-01', fecha_fin: '2026-11-30', activa: true },
    { id: 's4', grupo_id: 'g2', titulo: 'Inglés A2', tipo: 'semanal', dia_semana: 2, hora_inicio: '18:00', hora_fin: '19:30', fecha_inicio: '2026-08-04', fecha_fin: '2026-11-30', activa: true },
    { id: 's5', grupo_id: 'g2', titulo: 'Inglés A2', tipo: 'semanal', dia_semana: 4, hora_inicio: '18:00', hora_fin: '19:30', fecha_inicio: '2026-08-07', fecha_fin: '2026-11-30', activa: true },
  ],
  asistencias_sesion: [],
  mensajes: [
    { id: 'm1', de: 'u4', para: 'u5', contenido: '¡Hola Luis! Recuerda que hoy tenemos clase virtual. Conéctate puntual.', fecha: '2026-07-30T08:30:00.000Z', leido: true, grupo_id: 'g1' },
    { id: 'm2', de: 'u5', para: 'u4', contenido: 'Entendido maestra, ahí estaré. ¿Cubriremos el capítulo 3?', fecha: '2026-07-30T08:35:00.000Z', leido: true, grupo_id: 'g1' },
    { id: 'm3', de: 'u4', para: 'u5', contenido: 'Exacto, capítulo 3 y ejercicios de pronunciación. Trae audífonos 🎧', fecha: '2026-07-30T08:40:00.000Z', leido: false, grupo_id: 'g1' },
  ],
  inscripciones: [
    { id: 'ins1', alumno_id: 'u5', grupo_id: 'g1', plantel_id: 'p1', estado: 'asignada', folio: 'INJ-0001', fecha_registro: '2026-06-01', placement_nivel: 'n1', sugerida_por: 'sistema' },
    { id: 'ins2', alumno_id: 'u7', grupo_id: 'g3', plantel_id: 'p2', estado: 'pagada', folio: 'INJ-0002', fecha_registro: '2026-06-05', placement_nivel: 'n7', sugerida_por: 'sistema' },
    { id: 'ins3', alumno_id: null, grupo_id: null, plantel_id: 'p1', estado: 'nueva', folio: 'INJ-0003', fecha_registro: '2026-07-10', placement_nivel: null, sugerida_por: null, nombre_externo: 'Marco Ruiz', email_externo: 'marco@email.com', tel_externo: '8112345678' },
    { id: 'ins4', alumno_id: null, grupo_id: null, plantel_id: 'p1', estado: 'bienvenida_enviada', folio: 'INJ-0004', fecha_registro: '2026-07-15', placement_nivel: null, sugerida_por: null, nombre_externo: 'Sofía Luna', email_externo: 'sofia@email.com', tel_externo: '8119876543' },
    { id: 'ins5', alumno_id: null, grupo_id: 'g2', plantel_id: 'p1', estado: 'boucher_enviado', folio: 'INJ-0005', fecha_registro: '2026-07-20', placement_nivel: 'n2', sugerida_por: 'sistema', nombre_externo: 'Pedro Vega', email_externo: 'pedro@email.com', tel_externo: '8115551234' },
  ],
  pagos: [
    { id: 'pag1', alumno_id: 'u5', inscripcion_id: 'ins1', monto: 1500, fecha: '2026-06-10', estado: 'pagado', metodo_pago: 'transferencia', referencia: 'REF-001' },
    { id: 'pag2', alumno_id: 'u7', inscripcion_id: 'ins2', monto: 1500, fecha: '2026-06-12', estado: 'pagado', metodo_pago: 'efectivo', referencia: 'REF-002' },
    { id: 'pag3', alumno_id: null, inscripcion_id: 'ins5', monto: 1500, fecha: null, estado: 'pendiente', metodo_pago: null, referencia: 'REF-003' },
  ],
  asistencias: [
    { id: 'a1', grupo_id: 'g1', alumno_id: 'u5', fecha: '2026-07-01', presente: true, registrado_por: 'u4' },
    { id: 'a2', grupo_id: 'g1', alumno_id: 'u5', fecha: '2026-07-03', presente: true, registrado_por: 'u4' },
    { id: 'a3', grupo_id: 'g1', alumno_id: 'u5', fecha: '2026-07-08', presente: false, registrado_por: 'u4' },
    { id: 'a4', grupo_id: 'g1', alumno_id: 'u5', fecha: '2026-07-10', presente: true, registrado_por: 'u4' },
  ],
  evaluaciones: [
    { id: 'e1', alumno_id: 'u5', grupo_id: 'g1', tipo: 'parcial', calificacion: 85, fecha: '2026-06-30', registrado_por: 'u4', observaciones: 'Buen progreso' },
    { id: 'e2', alumno_id: 'u5', grupo_id: 'g1', tipo: 'final', calificacion: 90, fecha: '2026-07-28', registrado_por: 'u4', observaciones: 'Listo para avanzar' },
  ],
  placements: [
    { id: 'pl1', alumno_id: 'u5', nivel_sugerido: 'n1', calificacion: 45, fecha: '2026-05-28', aplicado_por: 'u6', notas: 'Responde bien a vocabulario básico' },
    { id: 'pl2', alumno_id: 'u7', nivel_sugerido: 'n7', calificacion: 50, fecha: '2026-06-02', aplicado_por: 'u6', notas: '' },
  ],
  avisos: [
    { id: 'av1', titulo: 'Inicio de ciclo agosto 2026', contenido: 'El nuevo ciclo inicia el 4 de agosto. Confirma tu grupo en el portal.', plantel_id: null, grupo_id: null, autor_id: 'u3', fecha: '2026-07-25', activo: true },
    { id: 'av2', titulo: 'Horario especial semana 31', contenido: 'El viernes 31 de julio no habrá clases por día festivo.', plantel_id: 'p1', grupo_id: 'g1', autor_id: 'u4', fecha: '2026-07-28', activo: true },
  ],
  // Tareas asignadas por el profesor
  tareas: [
    { id: 't1', grupo_id: 'g1', titulo: 'Vocabulario capítulo 1', descripcion: 'Aprende 20 palabras del capítulo 1 y escribe 5 oraciones de ejemplo con cada una.', fecha_limite: '2026-08-15', ponderacion: 15, creado_por: 'u4', creado_en: '2026-07-28' },
    { id: 't2', grupo_id: 'g1', titulo: 'Pronunciación — audio', descripcion: 'Graba un audio de 2 minutos pronunciando las palabras del capítulo 2 y súbelo al portal.', fecha_limite: '2026-08-22', ponderacion: 10, creado_por: 'u4', creado_en: '2026-07-30' },
    { id: 't3', grupo_id: 'g1', titulo: 'Examen parcial escrito', descripcion: 'Completa el examen parcial del módulo 1. 50 reactivos de opción múltiple.', fecha_limite: '2026-08-29', ponderacion: 25, creado_por: 'u4', creado_en: '2026-07-30' },
  ],
  // Calificaciones por tarea
  calificaciones_tareas: [
    { id: 'ct1', tarea_id: 't1', alumno_id: 'u5', calificacion: 85, fecha_entrega: '2026-08-14', comentario: 'Buen trabajo, faltaron 2 oraciones.', calificado_por: 'u4' },
  ],
  // Entregas de tareas por alumno
  entregas_tareas: [],
  ofertas: [
  {
    "id": "of1",
    "proveedor": "Instituto Mexicano Norteamericano de Relaciones Culturales",
    "sede": "Escuela secundaria técnica No. 38 \"Juan Olivas Franco\". Lic. Generoso Garza Chapa, Valle Verde 3, 64339, Monterrey, Nuevo León",
    "idioma": "Inglés",
    "costo": 1500,
    "costo_tipo": "bimestral",
    "categoria": "Teens",
    "edades": "12-15 años",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": 750,
    "horario": "Sábados de 9 am a 12:30 pm",
    "examen_ubicacion": "Si",
    "nivel": "N/A"
  },
  {
    "id": "of2",
    "proveedor": "Instituto Mexicano Norteamericano de Relaciones Culturales",
    "sede": "Escuela secundaria técnica No. 38 \"Juan Olivas Franco\". Lic. Generoso Garza Chapa, Valle Verde 3, 64339, Monterrey, Nuevo León",
    "idioma": "Inglés",
    "costo": 1500,
    "costo_tipo": "bimestral",
    "categoria": "Teens",
    "edades": "12-15 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": 750,
    "horario": "sábados de 13:30 hrs a 16:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": "N/A"
  },
  {
    "id": "of3",
    "proveedor": "Instituto Mexicano Norteamericano de Relaciones Culturales",
    "sede": "Escuela secundaria técnica No. 38 \"Juan Olivas Franco\". Lic. Generoso Garza Chapa, Valle Verde 3, 64339, Monterrey, Nuevo León",
    "idioma": "Inglés",
    "costo": 1500,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": 750,
    "horario": "Sábados de 9 am a 12:30 pm",
    "examen_ubicacion": "Si",
    "nivel": "N/A"
  },
  {
    "id": "of4",
    "proveedor": "Instituto Mexicano Norteamericano de Relaciones Culturales",
    "sede": "Escuela secundaria técnica No. 38 \"Juan Olivas Franco\". Lic. Generoso Garza Chapa, Valle Verde 3, 64339, Monterrey, Nuevo León",
    "idioma": "Inglés",
    "costo": 1500,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": 750,
    "horario": "sábados de 13:30 hrs a 16:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": "N/A"
  },
  {
    "id": "of5",
    "proveedor": "Instituto Mexicano Norteamericano de Relaciones Culturales",
    "sede": "Escuela secundaria técnica No. 38 \"Juan Olivas Franco\". Lic. Generoso Garza Chapa, Valle Verde 3, 64339, Monterrey, Nuevo León",
    "idioma": "Inglés",
    "costo": 1500,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": 750,
    "horario": "Sábados de 9 am a 12:30 pm",
    "examen_ubicacion": "Si",
    "nivel": "N/A"
  },
  {
    "id": "of6",
    "proveedor": "Instituto Mexicano Norteamericano de Relaciones Culturales",
    "sede": "Escuela secundaria técnica No. 38 \"Juan Olivas Franco\". Lic. Generoso Garza Chapa, Valle Verde 3, 64339, Monterrey, Nuevo León",
    "idioma": "Inglés",
    "costo": 1500,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": 750,
    "horario": "sábados de 13:30 hrs a 16:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": "N/A"
  },
  {
    "id": "of7",
    "proveedor": "Idiomas en Serio",
    "sede": "Universidad:C. Gonzalitos 1000-Local 4, Plaza comercial Las Américas, Chapultepec 66450, San Nicolás de los Garza",
    "idioma": "Inglés",
    "costo": 990,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Sábados de 9 a 12 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of8",
    "proveedor": "Idiomas en Serio",
    "sede": "Universidad:C. Gonzalitos 1000-Local 4, Plaza comercial Las Américas, Chapultepec 66450, San Nicolás de los Garza",
    "idioma": "Inglés",
    "costo": 1090,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Sábados de 9 a 12 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of9",
    "proveedor": "Idiomas en Serio",
    "sede": "Universidad:C. Gonzalitos 1000-Local 4, Plaza comercial Las Américas, Chapultepec 66450, San Nicolás de los Garza",
    "idioma": "Inglés",
    "costo": 990,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Sábados de 9 a 12 hrs",
    "examen_ubicacion": "Si",
    "nivel": 2
  },
  {
    "id": "of10",
    "proveedor": "Idiomas en Serio",
    "sede": "Universidad:C. Gonzalitos 1000-Local 4, Plaza comercial Las Américas, Chapultepec 66450, San Nicolás de los Garza",
    "idioma": "Inglés",
    "costo": 1090,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Sábados de 9 a 12 hrs",
    "examen_ubicacion": "Si",
    "nivel": 2
  },
  {
    "id": "of11",
    "proveedor": "Idiomas en Serio",
    "sede": "Apodaca: Gral. Mariano Escobedo 115, Cabecera Municipal (Apodaca), Apodaca Centro, 66600 Cdad, Apodaca, NL",
    "idioma": "Inglés",
    "costo": 990,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Sábados de 9 a 12 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of12",
    "proveedor": "Idiomas en Serio",
    "sede": "Apodaca: Gral. Mariano Escobedo 115, Cabecera Municipal (Apodaca), Apodaca Centro, 66600 Cdad, Apodaca, NL",
    "idioma": "Inglés",
    "costo": 1090,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Sábados de 9 a 12 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of13",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 990,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Sábados de 9 a 12 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of14",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1090,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Sábados de 9 a 12 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of15",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 990,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Martes y jueves de 19:30-21 horas",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of16",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1090,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Martes y jueves de 19:30-21 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of17",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 990,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Lunes y miercoles de 19:30 - 21 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of18",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1090,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Lunes y miercoles de 19:30 - 21 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of19",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 990,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Lunes y miercoles de 19:30 - 21 hrs",
    "examen_ubicacion": "Si",
    "nivel": 3
  },
  {
    "id": "of20",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1090,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 450,
    "horario": "Lunes y miercoles de 19:30 - 21 hrs",
    "examen_ubicacion": "Si",
    "nivel": 3
  },
  {
    "id": "of21",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 850,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "12-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 15,
    "material_nivel": 400,
    "horario": "Sábados de 9 hrs a 15 hrs",
    "examen_ubicacion": "No",
    "nivel": "N/A"
  },
  {
    "id": "of22",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1100,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 15,
    "material_nivel": 400,
    "horario": "Sábados de 9 hrs a 15 hrs",
    "examen_ubicacion": "No",
    "nivel": "N/A"
  },
  {
    "id": "of23",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 946,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "12-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Lunes y miercoles de 20 hrs a 21:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of24",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 996,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Lunes y miercoles de 20 hrs a 21:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of25",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 946,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "12-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Martes y jueves de 9:45 hrs - 11:00 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of26",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 996,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Martes y jueves de 9:45 hrs - 11:00 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of27",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 946,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "12-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Sábado de 9 hrs - 12:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of28",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 996,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Sábado de 9 hrs - 12:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of29",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 946,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "12-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Sábado de 9 hrs - 12:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": 4
  },
  {
    "id": "of30",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 996,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Sábado de 9 hrs - 12:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": 4
  },
  {
    "id": "of31",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 946,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "12-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Sábado de 9 hrs - 12:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": 6
  },
  {
    "id": "of32",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 996,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Sábado de 9 hrs - 12:30 hrs",
    "examen_ubicacion": "Si",
    "nivel": 6
  },
  {
    "id": "of33",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 946,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "12-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Domingo de 15 hrs a 18 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of34",
    "proveedor": "U talk",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 996,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": "Sin costo",
    "horario": "Domingo de 15 hrs a 18 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of35",
    "proveedor": "ITEM Idiomas",
    "sede": "ICET Felix U. Gomez - Av. Félix U. Gomez 750, Centro, 64000, Monterrey, Nuevo León",
    "idioma": "Inglés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of36",
    "proveedor": "ITEM Idiomas",
    "sede": "ICET Felix U. Gomez - Av. Félix U. Gomez 750, Centro, 64000, Monterrey, Nuevo León",
    "idioma": "Inglés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of37",
    "proveedor": "ITEM Idiomas",
    "sede": "ICET Felix U. Gomez - Av. Félix U. Gomez 750, Centro, 64000, Monterrey, Nuevo León",
    "idioma": "Inglés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Children",
    "edades": "10-15 años",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of38",
    "proveedor": "ITEM Idiomas",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of39",
    "proveedor": "ITEM Idiomas",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of40",
    "proveedor": "ITEM Idiomas",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Children",
    "edades": "10-15 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of41",
    "proveedor": "ITEM Idiomas",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9:30 hrs a 12:15 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of42",
    "proveedor": "ITEM Idiomas",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9:30 hrs a 12:15 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of43",
    "proveedor": "ITEM Idiomas",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Children",
    "edades": "10-15 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9:30 hrs a 12:15 hrs",
    "examen_ubicacion": "Si",
    "nivel": 1
  },
  {
    "id": "of44",
    "proveedor": "Idiomas en Serio",
    "sede": "Universidad:C. Gonzalitos 1000-Local 4, Plaza comercial Las Américas, Chapultepec 66450, San Nicolás de los Garza",
    "idioma": "Francés",
    "costo": 1085,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": 6,
    "material_nivel": 400,
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of45",
    "proveedor": "Idiomas en Serio",
    "sede": "Universidad:C. Gonzalitos 1000-Local 4, Plaza comercial Las Américas, Chapultepec 66450, San Nicolás de los Garza",
    "idioma": "Francés",
    "costo": 1185,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "",
    "modalidad": "Presencial",
    "sistema": "Bimestral",
    "no_niveles": 6,
    "material_nivel": 400,
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of46",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Francés",
    "costo": 1085,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 6,
    "material_nivel": 400,
    "horario": "Sabados de 15 hrs a 18 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of47",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Francés",
    "costo": 1185,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 6,
    "material_nivel": 400,
    "horario": "Sabados de 15 hrs a 18 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of48",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Francés",
    "costo": 1085,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 6,
    "material_nivel": 400,
    "horario": "Martes y jueves de 19:30 hrs a 21 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of49",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Francés",
    "costo": 1185,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 6,
    "material_nivel": 400,
    "horario": "Martes y jueves de 19:30 hrs a 21 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of50",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Francés",
    "costo": 880,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": 900,
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of51",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Francés",
    "costo": 1080,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 12,
    "material_nivel": 900,
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of52",
    "proveedor": "ITEM Idiomas",
    "sede": "Item Línea",
    "idioma": "Francés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of53",
    "proveedor": "ITEM Idiomas",
    "sede": "Item Línea",
    "idioma": "Francés",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of54",
    "proveedor": "Centro cultural Alemán",
    "sede": "Cultural Línea",
    "idioma": "Alemán",
    "costo": 2300,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 6,
    "material_nivel": "Desde $700",
    "horario": "Sábados de 15 hrs a 18 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of55",
    "proveedor": "Centro cultural Alemán",
    "sede": "Cultural Línea",
    "idioma": "Alemán",
    "costo": 2300,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 6,
    "material_nivel": "Desde $700",
    "horario": "Sábados de 15 hrs a 18 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of56",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Alemán",
    "costo": 990,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "12-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 10,
    "material_nivel": "$900 (físico) o Sin costo (digital)",
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of57",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Alemán",
    "costo": 1120,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 10,
    "material_nivel": "$900 (físico) o Sin costo (digital)",
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of58",
    "proveedor": "ITEM Idiomas",
    "sede": "Item Línea",
    "idioma": "Italiano",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of59",
    "proveedor": "ITEM Idiomas",
    "sede": "Item Línea",
    "idioma": "Italiano",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of60",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Portugués",
    "costo": 1080,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 400,
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of61",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Portugués",
    "costo": 1180,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 400,
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of62",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Portugués",
    "costo": 930,
    "costo_tipo": "bimestral",
    "categoria": "Teens",
    "edades": "12-15 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 10,
    "material_nivel": 900,
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of63",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Portugués",
    "costo": 930,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 10,
    "material_nivel": 900,
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of64",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Portugués",
    "costo": 1050,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 10,
    "material_nivel": 900,
    "horario": "Sábados de 9 hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of65",
    "proveedor": "ITEM Idiomas",
    "sede": "Item Línea",
    "idioma": "Portugués",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of66",
    "proveedor": "ITEM Idiomas",
    "sede": "Item Línea",
    "idioma": "Portugués",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": 16,
    "material_nivel": "Sin costo",
    "horario": "Sábados de 9 hrs a 12:40 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of67",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Chino",
    "costo": 1080,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 900,
    "horario": "Sábados de 9hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of68",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Chino",
    "costo": 1160,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 900,
    "horario": "Sábados de 9hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of69",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Chino",
    "costo": 1080,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 900,
    "horario": "Sábados de 9hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 2
  },
  {
    "id": "of70",
    "proveedor": "Lenglobal",
    "sede": "En Línea",
    "idioma": "Chino",
    "costo": 1160,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 900,
    "horario": "Sábados de 9hrs a 12 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 2
  },
  {
    "id": "of71",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Coreano",
    "costo": 1100,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 400,
    "horario": "Sábados de 15 hrs a 18 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of72",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Coreano",
    "costo": 1200,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 400,
    "horario": "Sábados de 15 hrs a 18 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of73",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Japonés",
    "costo": 1105,
    "costo_tipo": "bimestral",
    "categoria": "Jóvenes",
    "edades": "16-29 años",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 400,
    "horario": "Sábados de 12 hrs a 15 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of74",
    "proveedor": "Idiomas en Serio",
    "sede": "En Línea",
    "idioma": "Japonés",
    "costo": 1205,
    "costo_tipo": "bimestral",
    "categoria": "Plus",
    "edades": "30 en adelante",
    "modalidad": "En Línea",
    "sistema": "Bimestral",
    "no_niveles": "Pendiente",
    "material_nivel": 400,
    "horario": "Sábados de 12 hrs a 15 hrs",
    "examen_ubicacion": "Pendiente",
    "nivel": 1
  },
  {
    "id": "of75",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Inglés",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of76",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Bulgaro",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of77",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Checo",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of78",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Danés",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of79",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Alemán",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of80",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Griego",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of81",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Español",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of82",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Estonio",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of83",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Francés",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of84",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Croata",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of85",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Húngaro",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of86",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Italiano",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of87",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Lituano",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of88",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Letón",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of89",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Neerlandés",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of90",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Polaco",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of91",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Portugués",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of92",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Rumano",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of93",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Eslovaco",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of94",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Eslovenio",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  },
  {
    "id": "of95",
    "proveedor": "Altissia",
    "sede": "En Línea",
    "idioma": "Sueco",
    "costo": 970,
    "costo_tipo": "anual",
    "categoria": "Jóvenes y Plus",
    "edades": "12 en adelante",
    "modalidad": "Autodidacta",
    "sistema": "Anual",
    "no_niveles": "",
    "material_nivel": "",
    "horario": "Flexible (autodidacta, en línea)",
    "examen_ubicacion": "No aplica",
    "nivel": "N/A"
  }
],
  // Buzón de quejas y sugerencias
  buzon: [
    { id: 'bz1', tipo: 'sugerencia', asunto: 'Aire acondicionado salón 3', mensaje: 'Sería bueno revisar el aire acondicionado del salón 3, se siente muy caliente en las clases de la tarde.', anonimo: false, autor_id: 'u5', plantel_id: 'p1', estado: 'nueva', fecha: '2026-07-29T12:00:00.000Z', respuesta: '', respondido_por: null, fecha_respuesta: null },
  ],
  // Notificaciones internas
  notificaciones: [
    { id: 'nf1', usuario_id: 'u5', tipo: 'aviso', titulo: 'Horario especial semana 31', contenido: 'El viernes 31 de julio no habrá clases por día festivo.', fecha: '2026-07-28T10:00:00.000Z', leida: false, ref_id: 'av2' },
  ],
  config: {
    nombre_sistema: 'Lengua Joven',
    correo_soporte: 'soporte@injuve.mx',
    ciclo_activo: 'Agosto 2026',
    costo_inscripcion: 1500,
    dias_gracia_pago: 5,
  },
}

function cargar() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function guardar(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('store-updated'))
}

export function getStore() {
  const data = cargar()
  if (!data) return JSON.parse(JSON.stringify(SEED))
  let dirty = false
  // Migraciones
  if (!data.mensajes) { data.mensajes = JSON.parse(JSON.stringify(SEED.mensajes)); dirty = true }
  if (!data.tareas) { data.tareas = JSON.parse(JSON.stringify(SEED.tareas)); dirty = true }
  if (!data.calificaciones_tareas) { data.calificaciones_tareas = JSON.parse(JSON.stringify(SEED.calificaciones_tareas)); dirty = true }
  if (!data.notificaciones) { data.notificaciones = JSON.parse(JSON.stringify(SEED.notificaciones)); dirty = true }
  if (!data.entregas_tareas) { data.entregas_tareas = []; dirty = true }
  if (!data.buzon) { data.buzon = JSON.parse(JSON.stringify(SEED.buzon)); dirty = true }
  if (!data.ofertas) { data.ofertas = JSON.parse(JSON.stringify(SEED.ofertas)); dirty = true }
  if (!data.pre_registros) { data.pre_registros = []; dirty = true }
  // Migración: campo oferta_id en inscripciones (inscripción a oferta educativa externa)
  ;(data.inscripciones || []).forEach(ins => {
    if (ins.oferta_id === undefined) { ins.oferta_id = null; dirty = true }
  })
  // Migración: fechas de ciclo/inscripción en grupos
  ;(data.grupos || []).forEach(g => {
    if (g.fecha_inicio_clases === undefined) { g.fecha_inicio_clases = ''; dirty = true }
    if (g.fecha_fin_clases === undefined) { g.fecha_fin_clases = ''; dirty = true }
    if (g.fecha_inicio_inscripciones === undefined) { g.fecha_inicio_inscripciones = ''; dirty = true }
    if (g.fecha_fin_inscripciones === undefined) { g.fecha_fin_inscripciones = ''; dirty = true }
  })
  // Migración: convenio por plantel
  ;(data.planteles || []).forEach(p => {
    if (p.convenio_vencimiento === undefined) { p.convenio_vencimiento = ''; dirty = true }
    if (p.convenio_notificado === undefined) { p.convenio_notificado = false; dirty = true }
  })
  // Migración: renombrar estados del pipeline de pre-inscripción
  ;(data.inscripciones || []).forEach((ins, i) => {
    if (ins.estado === 'validada') { data.inscripciones[i] = { ...ins, estado: 'bienvenida_enviada' }; dirty = true }
    if (ins.estado === 'liga_enviada') { data.inscripciones[i] = { ...ins, estado: 'boucher_enviado' }; dirty = true }
  })
  // Migración: campos de perfil en alumnos
  ;(data.usuarios || []).forEach(u => {
    if (u.rol === 'alumno') {
      const seed = SEED.usuarios.find(s => s.id === u.id)
      if (seed && !u.matricula) { u.matricula = seed.matricula || ''; dirty = true }
      if (seed && !u.fecha_nacimiento) { u.fecha_nacimiento = seed.fecha_nacimiento || ''; dirty = true }
      if (seed && !u.estado_entidad) { u.estado_entidad = seed.estado_entidad || ''; dirty = true }
    }
  })
  // Migración: campo proveedor en usuarios (escuela socia externa, null = sin restricción)
  ;(data.usuarios || []).forEach(u => {
    if (u.proveedor === undefined) { u.proveedor = null; dirty = true }
  })
  // Migración: contraseñas en texto plano → hash
  ;(data.usuarios || []).forEach(u => {
    if (u.password && !isHashed(u.password)) { u.password = hashPwd(u.password); dirty = true }
  })
  if (dirty) guardar(data)
  return data
}

export function resetStore() {
  guardar(JSON.parse(JSON.stringify(SEED)))
}

if (!cargar()) {
  guardar(JSON.parse(JSON.stringify(SEED)))
}

function db() { return getStore() }
function save(data) { guardar(data) }

export function login(email, password) {
  const data = db()
  const hash = hashPwd(password)
  const u = data.usuarios.find(x => x.email === email && x.password === hash && x.activo)
  return u ? { ...u, password: undefined } : null
}

// ── PLANTELES ────────────────────────────────────────────────────────────────

export function getPlanteles() { return db().planteles }
// Devuelve solo los planteles que el usuario tiene permitido ver.
// Superadmin (sin plantel_id) ve todos; cualquier otro rol solo ve el suyo.
export function getPlantelesVisibles(usuario) {
  const todos = db().planteles
  if (!usuario || !usuario.plantel_id) return todos
  return todos.filter(p => p.id === usuario.plantel_id)
}
export function crearPlantel(plantel) {
  const data = db(); data.planteles.push({ id: uid(), ...plantel }); save(data)
}
export function editarPlantel(id, campos) {
  const data = db(); const i = data.planteles.findIndex(x => x.id === id)
  if (i >= 0) { data.planteles[i] = { ...data.planteles[i], ...campos }; save(data) }
}

// ── IDIOMAS + NIVELES ─────────────────────────────────────────────────────────

export function getIdiomas() { return db().idiomas }
export function getIdiomasDelPlantel(plantel_id) {
  return db().idiomas.filter(i => !plantel_id || i.plantel_id === plantel_id)
}
export function getNiveles(idioma_id) { return db().niveles.filter(n => n.idioma_id === idioma_id) }
export function getNivelesAll() { return db().niveles }
export function crearIdioma(idioma) {
  const data = db(); data.idiomas.push({ id: uid(), ...idioma }); save(data)
}
export function crearNivel(nivel) {
  const data = db(); data.niveles.push({ id: uid(), ...nivel }); save(data)
}
export function editarNivel(id, campos) {
  const data = db(); const i = data.niveles.findIndex(x => x.id === id)
  if (i >= 0) { data.niveles[i] = { ...data.niveles[i], ...campos }; save(data) }
}
export function eliminarIdioma(id) {
  const data = db()
  data.idiomas = data.idiomas.filter(x => x.id !== id)
  data.niveles = data.niveles.filter(x => x.idioma_id !== id)
  save(data)
}

// ── GRUPOS ────────────────────────────────────────────────────────────────────

export function getGrupos(plantel_id) {
  const grupos = db().grupos
  if (plantel_id) return grupos.filter(g => g.plantel_id === plantel_id)
  return grupos
}
export function getGruposDeProfesor(prof_id) { return db().grupos.filter(g => g.profesor_id === prof_id) }
export function crearGrupo(grupo) {
  const data = db(); data.grupos.push({ id: uid(), ...grupo, activo: true }); save(data)
}
export function editarGrupo(id, campos) {
  const data = db(); const i = data.grupos.findIndex(x => x.id === id)
  if (i >= 0) { data.grupos[i] = { ...data.grupos[i], ...campos }; save(data) }
}

// ── INSCRIPCIONES ─────────────────────────────────────────────────────────────

export function getInscripciones(plantel_id) {
  const ins = db().inscripciones
  if (plantel_id) return ins.filter(i => i.plantel_id === plantel_id)
  return ins
}
export function getInscripcionesDeAlumno(alumno_id) { return db().inscripciones.filter(i => i.alumno_id === alumno_id) }
export function crearInscripcion(ins) {
  const data = db()
  const folio = 'INJ-' + String(data.inscripciones.length + 1).padStart(4, '0')
  data.inscripciones.push({ id: uid(), folio, fecha_registro: new Date().toISOString().slice(0, 10), ...ins })
  save(data)
}
export function editarInscripcion(id, campos) {
  const data = db(); const i = data.inscripciones.findIndex(x => x.id === id)
  if (i >= 0) { data.inscripciones[i] = { ...data.inscripciones[i], ...campos }; save(data) }
}
export function sugerirGrupo(inscripcion_id) {
  const data = db()
  const ins = data.inscripciones.find(x => x.id === inscripcion_id)
  if (!ins || !ins.placement_nivel) return null
  const grupo = data.grupos.find(g => g.nivel_id === ins.placement_nivel && g.plantel_id === ins.plantel_id && g.activo)
  if (grupo) {
    const i = data.inscripciones.findIndex(x => x.id === inscripcion_id)
    data.inscripciones[i] = { ...data.inscripciones[i], grupo_sugerido_id: grupo.id, sugerida_por: 'sistema' }
    save(data); return grupo
  }
  return null
}

// ── PAGOS ─────────────────────────────────────────────────────────────────────

export function getPagos(plantel_id) {
  const data = db()
  if (!plantel_id) return data.pagos
  const insIds = data.inscripciones.filter(i => i.plantel_id === plantel_id).map(i => i.id)
  return data.pagos.filter(p => insIds.includes(p.inscripcion_id))
}
export function getPagosDeAlumno(alumno_id) { return db().pagos.filter(p => p.alumno_id === alumno_id) }
export function registrarPago(pago) {
  const data = db(); data.pagos.push({ id: uid(), ...pago }); save(data)
}
export function editarPago(id, campos) {
  const data = db(); const i = data.pagos.findIndex(x => x.id === id)
  if (i >= 0) { data.pagos[i] = { ...data.pagos[i], ...campos }; save(data) }
}

// Conciliación bancaria: busca un pago pendiente por referencia y lo marca como pagado
export function conciliarPagoBanco(referencia) {
  const data = db()
  const i = data.pagos.findIndex(p => p.referencia === referencia && p.estado === 'pendiente')
  if (i < 0) return null
  data.pagos[i] = { ...data.pagos[i], estado: 'pagado', fecha: new Date().toISOString().slice(0, 10), metodo_pago: data.pagos[i].metodo_pago || 'transferencia' }
  // Auto-avanzar inscripción
  const inscripcion_id = data.pagos[i].inscripcion_id
  const j = data.inscripciones.findIndex(x => x.id === inscripcion_id)
  if (j >= 0 && data.inscripciones[j].estado !== 'pagada') {
    data.inscripciones[j] = { ...data.inscripciones[j], estado: 'pagada' }
  }
  save(data)
  return data.pagos[i]
}

// ── ASISTENCIA PRESENCIAL ─────────────────────────────────────────────────────

export function getAsistencias(grupo_id, fecha) {
  const a = db().asistencias
  if (grupo_id && fecha) return a.filter(x => x.grupo_id === grupo_id && x.fecha === fecha)
  if (grupo_id) return a.filter(x => x.grupo_id === grupo_id)
  return a
}
export function getAsistenciasAlumno(alumno_id) { return db().asistencias.filter(x => x.alumno_id === alumno_id) }
export function guardarAsistencia(registro) {
  const data = db()
  const i = data.asistencias.findIndex(x => x.grupo_id === registro.grupo_id && x.alumno_id === registro.alumno_id && x.fecha === registro.fecha)
  if (i >= 0) { data.asistencias[i] = { ...data.asistencias[i], ...registro } }
  else { data.asistencias.push({ id: uid(), ...registro }) }
  save(data)
}

// ── EVALUACIONES ──────────────────────────────────────────────────────────────

export function getEvaluaciones(grupo_id) {
  if (grupo_id) return db().evaluaciones.filter(e => e.grupo_id === grupo_id)
  return db().evaluaciones
}
export function getEvaluacionesAlumno(alumno_id) { return db().evaluaciones.filter(e => e.alumno_id === alumno_id) }
export function registrarEvaluacion(ev) {
  const data = db(); data.evaluaciones.push({ id: uid(), ...ev }); save(data)
}

// ── PLACEMENT TESTS ───────────────────────────────────────────────────────────

export function getPlacements(plantel_id) {
  if (!plantel_id) return db().placements
  const data = db()
  const alumnosDelPlantel = data.usuarios.filter(u => u.plantel_id === plantel_id).map(u => u.id)
  return data.placements.filter(p => alumnosDelPlantel.includes(p.alumno_id))
}
export function getPlacementDeAlumno(alumno_id) { return db().placements.filter(p => p.alumno_id === alumno_id) }
export function registrarPlacement(pl) {
  const data = db()
  data.placements.push({ id: uid(), ...pl })
  // Auto-avanzar inscripciones de este alumno de 'nueva' a 'bienvenida_enviada'
  if (pl.alumno_id) {
    data.inscripciones.forEach((ins, i) => {
      if (ins.alumno_id === pl.alumno_id && ins.estado === 'nueva') {
        data.inscripciones[i] = { ...ins, estado: 'bienvenida_enviada', placement_nivel: pl.nivel_sugerido }
      }
    })
  }
  save(data)
  // Intentar sugerir grupos para las inscripciones recién avanzadas
  if (pl.alumno_id) {
    const recienAvanzadas = data.inscripciones.filter(i => i.alumno_id === pl.alumno_id && i.estado === 'bienvenida_enviada' && !i.grupo_sugerido_id)
    recienAvanzadas.forEach(ins => sugerirGrupo(ins.id))
  }
}

// ── AVISOS ────────────────────────────────────────────────────────────────────

export function getAvisos(plantel_id, grupo_id) {
  const a = db().avisos.filter(x => x.activo)
  if (grupo_id) return a.filter(x => !x.grupo_id || x.grupo_id === grupo_id)
  if (plantel_id) return a.filter(x => !x.plantel_id || x.plantel_id === plantel_id)
  return a
}
export function crearAviso(aviso) {
  const data = db()
  const nuevo = { id: uid(), fecha: new Date().toISOString().slice(0, 10), activo: true, ...aviso }
  data.avisos.push(nuevo)
  // Auto-crear notificaciones para miembros del grupo
  if (nuevo.grupo_id) {
    const inscripcionesGrupo = (data.inscripciones || []).filter(i => i.grupo_id === nuevo.grupo_id && i.alumno_id)
    const profesorGrupo = (data.grupos || []).find(g => g.id === nuevo.grupo_id)?.profesor_id
    const destinatarios = new Set(inscripcionesGrupo.map(i => i.alumno_id))
    if (profesorGrupo && profesorGrupo !== nuevo.autor_id) destinatarios.add(profesorGrupo)
    destinatarios.forEach(uid_dest => {
      if (uid_dest !== nuevo.autor_id) {
        if (!data.notificaciones) data.notificaciones = []
        data.notificaciones.push({
          id: uid(), usuario_id: uid_dest, tipo: 'aviso',
          titulo: nuevo.titulo, contenido: nuevo.contenido,
          fecha: new Date().toISOString(), leida: false, ref_id: nuevo.id,
        })
      }
    })
  } else if (nuevo.plantel_id) {
    // Notificar a todos en el plantel
    const miembros = (data.usuarios || []).filter(u => u.plantel_id === nuevo.plantel_id && u.activo && u.id !== nuevo.autor_id)
    miembros.forEach(u => {
      if (!data.notificaciones) data.notificaciones = []
      data.notificaciones.push({
        id: uid(), usuario_id: u.id, tipo: 'aviso',
        titulo: nuevo.titulo, contenido: nuevo.contenido,
        fecha: new Date().toISOString(), leida: false, ref_id: nuevo.id,
      })
    })
  }
  save(data)
}
export function editarAviso(id, campos) {
  const data = db(); const i = data.avisos.findIndex(x => x.id === id)
  if (i >= 0) { data.avisos[i] = { ...data.avisos[i], ...campos }; save(data) }
}

// ── SESIONES VIRTUALES ────────────────────────────────────────────────────────

export function getSesiones() { return db().sesiones }
export function getSesionesDeGrupos(grupo_ids) {
  return db().sesiones.filter(s => grupo_ids.includes(s.grupo_id) && s.activa)
}
export function crearSesion(sesion) {
  const data = db(); data.sesiones.push({ id: uid(), activa: true, ...sesion }); save(data)
}
export function editarSesion(id, campos) {
  const data = db(); const i = data.sesiones.findIndex(x => x.id === id)
  if (i >= 0) { data.sesiones[i] = { ...data.sesiones[i], ...campos }; save(data) }
}

export function sesionOcurreEnFecha(sesion, fechaStr) {
  if (!sesion.activa) return false
  if (sesion.tipo === 'unica') return sesion.fecha === fechaStr
  if (sesion.tipo === 'semanal') {
    const d = new Date(fechaStr + 'T12:00:00')
    const diaSemana = d.getDay()
    return diaSemana === sesion.dia_semana
      && fechaStr >= sesion.fecha_inicio
      && fechaStr <= sesion.fecha_fin
  }
  return false
}

// ── ASISTENCIAS DE SESIÓN VIRTUAL ─────────────────────────────────────────────

export function getAsistenciasSesion(sesion_id, fecha) {
  const a = db().asistencias_sesion
  const clave = `${sesion_id}::${fecha}`
  return a.filter(x => x.clave_sesion === clave)
}
export function getAsistenciasSesionDeAlumno(alumno_id) {
  return db().asistencias_sesion.filter(x => x.alumno_id === alumno_id)
}
export function guardarAsistenciaSesion({ sesion_id, fecha, alumno_id, joined_at, left_at, duracion_min }) {
  const data = db()
  const clave = `${sesion_id}::${fecha}`
  const i = data.asistencias_sesion.findIndex(x => x.clave_sesion === clave && x.alumno_id === alumno_id)
  const registro = { id: uid(), clave_sesion: clave, sesion_id, fecha, alumno_id, joined_at, left_at, duracion_min }
  if (i >= 0) data.asistencias_sesion[i] = { ...data.asistencias_sesion[i], ...registro }
  else data.asistencias_sesion.push(registro)
  save(data)
}

// ── MENSAJERÍA ────────────────────────────────────────────────────────────────

export function getContactosMensajes(usuario_id) {
  const data = db()
  const yo = data.usuarios.find(u => u.id === usuario_id)
  if (!yo) return []
  const ids = new Set()
  if (yo.rol === 'alumno') {
    const misIns = (data.inscripciones || []).filter(i => i.alumno_id === usuario_id && i.grupo_id && i.estado === 'asignada')
    const misGrupoIds = misIns.map(i => i.grupo_id)
    ;(data.grupos || []).filter(g => misGrupoIds.includes(g.id) && g.profesor_id).forEach(g => ids.add(g.profesor_id))
    data.usuarios.filter(u => ['coordinador', 'director'].includes(u.rol) && u.plantel_id === yo.plantel_id).forEach(u => ids.add(u.id))
  } else if (yo.rol === 'profesor') {
    const misGrupoIds = (data.grupos || []).filter(g => g.profesor_id === usuario_id).map(g => g.id)
    ;(data.inscripciones || []).filter(i => misGrupoIds.includes(i.grupo_id) && i.alumno_id && i.estado === 'asignada').forEach(i => ids.add(i.alumno_id))
    data.usuarios.filter(u => ['coordinador', 'director'].includes(u.rol) && u.plantel_id === yo.plantel_id).forEach(u => ids.add(u.id))
  } else {
    data.usuarios.filter(u => !yo.plantel_id || u.plantel_id === yo.plantel_id || !u.plantel_id).forEach(u => ids.add(u.id))
  }
  ids.delete(usuario_id)
  return data.usuarios.filter(u => ids.has(u.id) && u.activo).map(u => ({ ...u, password: undefined }))
}
export function getConversacion(user1_id, user2_id) {
  return (db().mensajes || [])
    .filter(m => (m.de === user1_id && m.para === user2_id) || (m.de === user2_id && m.para === user1_id))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}
export function getMensajesNoLeidos(usuario_id) {
  return (db().mensajes || []).filter(m => m.para === usuario_id && !m.leido)
}
export function enviarMensaje({ de, para, contenido, grupo_id }) {
  const data = db()
  if (!data.mensajes) data.mensajes = []
  data.mensajes.push({ id: uid(), de, para, contenido, fecha: new Date().toISOString(), leido: false, grupo_id: grupo_id || null })
  save(data)
}
export function marcarConversacionLeida(mi_id, otro_id) {
  const data = db()
  if (!data.mensajes) return
  let changed = false
  data.mensajes.forEach(m => {
    if (m.de === otro_id && m.para === mi_id && !m.leido) { m.leido = true; changed = true }
  })
  if (changed) save(data)
}

// ── TAREAS ────────────────────────────────────────────────────────────────────

export function getTareas(grupo_id) {
  if (grupo_id) return db().tareas.filter(t => t.grupo_id === grupo_id)
  return db().tareas
}
export function getTareasDeGrupos(grupo_ids) {
  return db().tareas.filter(t => grupo_ids.includes(t.grupo_id))
}
export function crearTarea(tarea) {
  const data = db()
  data.tareas.push({ id: uid(), creado_en: new Date().toISOString().slice(0, 10), ...tarea })
  save(data)
}
export function editarTarea(id, campos) {
  const data = db(); const i = data.tareas.findIndex(x => x.id === id)
  if (i >= 0) { data.tareas[i] = { ...data.tareas[i], ...campos }; save(data) }
}
export function eliminarTarea(id) {
  const data = db()
  data.tareas = data.tareas.filter(x => x.id !== id)
  data.calificaciones_tareas = data.calificaciones_tareas.filter(x => x.tarea_id !== id)
  data.entregas_tareas = (data.entregas_tareas || []).filter(x => x.tarea_id !== id)
  save(data)
}

export function getCalificacionesTareas(tarea_id) {
  if (tarea_id) return db().calificaciones_tareas.filter(c => c.tarea_id === tarea_id)
  return db().calificaciones_tareas
}
export function getCalificacionesTareasAlumno(alumno_id) {
  return db().calificaciones_tareas.filter(c => c.alumno_id === alumno_id)
}
export function registrarCalificacionTarea(cal) {
  const data = db()
  const i = data.calificaciones_tareas.findIndex(x => x.tarea_id === cal.tarea_id && x.alumno_id === cal.alumno_id)
  if (i >= 0) { data.calificaciones_tareas[i] = { ...data.calificaciones_tareas[i], ...cal } }
  else { data.calificaciones_tareas.push({ id: uid(), ...cal }) }
  save(data)
}

// ── ENTREGAS DE TAREAS ────────────────────────────────────────────────────────

export function getEntregaDeAlumno(tarea_id, alumno_id) {
  return (db().entregas_tareas || []).find(e => e.tarea_id === tarea_id && e.alumno_id === alumno_id) || null
}
export function getEntregasDeTarea(tarea_id) {
  return (db().entregas_tareas || []).filter(e => e.tarea_id === tarea_id)
}
export function crearEntregaTarea(entrega) {
  const data = db()
  if (!data.entregas_tareas) data.entregas_tareas = []
  const i = data.entregas_tareas.findIndex(e => e.tarea_id === entrega.tarea_id && e.alumno_id === entrega.alumno_id)
  const ts = new Date().toISOString()
  if (i >= 0) {
    data.entregas_tareas[i] = { ...data.entregas_tareas[i], ...entrega, fecha_entrega: ts }
  } else {
    data.entregas_tareas.push({ id: uid(), fecha_entrega: ts, ...entrega })
  }
  save(data)
}

// ── NOTIFICACIONES ────────────────────────────────────────────────────────────

export function getNotificaciones(usuario_id) {
  return (db().notificaciones || [])
    .filter(n => n.usuario_id === usuario_id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}
export function getNotificacionesNoLeidas(usuario_id) {
  return (db().notificaciones || []).filter(n => n.usuario_id === usuario_id && !n.leida)
}
export function marcarNotificacionLeida(id) {
  const data = db(); const i = data.notificaciones.findIndex(x => x.id === id)
  if (i >= 0) { data.notificaciones[i] = { ...data.notificaciones[i], leida: true }; save(data) }
}
export function marcarTodasLeidas(usuario_id) {
  const data = db(); let changed = false
  ;(data.notificaciones || []).forEach(n => {
    if (n.usuario_id === usuario_id && !n.leida) { n.leida = true; changed = true }
  })
  if (changed) save(data)
}

// ── CONFIG ────────────────────────────────────────────────────────────────────

export function getConfig() { return db().config }
export function guardarConfig(cfg) {
  const data = db(); data.config = { ...data.config, ...cfg }; save(data)
}

// ── USUARIOS ──────────────────────────────────────────────────────────────────

export function getUsuarios() { return db().usuarios.map(u => ({ ...u, password: undefined })) }
export function getUsuariosDelPlantel(plantel_id) {
  return db().usuarios.filter(u => u.plantel_id === plantel_id).map(u => ({ ...u, password: undefined }))
}
export function crearUsuario(u) {
  const data = db()
  const nuevo = { id: uid(), activo: true, ...u }
  if (nuevo.password && !isHashed(nuevo.password)) nuevo.password = hashPwd(nuevo.password)
  data.usuarios.push(nuevo)
  save(data)
}
export function editarUsuario(id, campos) {
  const data = db(); const i = data.usuarios.findIndex(x => x.id === id)
  if (i >= 0) {
    const upd = { ...campos }
    if (!upd.password) {
      delete upd.password
    } else if (!isHashed(upd.password)) {
      upd.password = hashPwd(upd.password)
    }
    data.usuarios[i] = { ...data.usuarios[i], ...upd }
    save(data)
  }
}

// ── BUZÓN DE QUEJAS Y SUGERENCIAS ─────────────────────────────────────────────

export function getBuzon(plantel_id) {
  const b = db().buzon || []
  if (plantel_id) return b.filter(x => x.plantel_id === plantel_id)
  return b
}
export function getBuzonDeUsuario(usuario_id) {
  return (db().buzon || []).filter(x => x.autor_id === usuario_id)
}
export function crearBuzon(entrada) {
  const data = db()
  if (!data.buzon) data.buzon = []
  data.buzon.push({
    id: uid(),
    fecha: new Date().toISOString(),
    estado: 'nueva',
    respuesta: '',
    respondido_por: null,
    fecha_respuesta: null,
    ...entrada,
  })
  save(data)
}
export function editarBuzon(id, campos) {
  const data = db()
  const i = (data.buzon || []).findIndex(x => x.id === id)
  if (i >= 0) { data.buzon[i] = { ...data.buzon[i], ...campos }; save(data) }
}

// ── CONVENIOS POR PLANTEL ─────────────────────────────────────────────────────

// Devuelve planteles cuyo convenio vence dentro de `diasAntes` días (o ya vencido)
export function getConveniosPorVencer(diasAntes = 60) {
  const data = db()
  const hoy = new Date()
  return (data.planteles || [])
    .filter(p => p.convenio_vencimiento)
    .map(p => {
      const venc = new Date(p.convenio_vencimiento + 'T12:00:00')
      const diasRestantes = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24))
      return { ...p, dias_restantes: diasRestantes }
    })
    .filter(p => p.dias_restantes <= diasAntes)
    .sort((a, b) => a.dias_restantes - b.dias_restantes)
}
export function marcarConvenioRenovado(plantel_id, nuevaFechaVencimiento) {
  const data = db()
  const i = data.planteles.findIndex(x => x.id === plantel_id)
  if (i >= 0) {
    data.planteles[i] = {
      ...data.planteles[i],
      convenio_vencimiento: nuevaFechaVencimiento,
      convenio_notificado: false,
      convenio_renovado_en: new Date().toISOString().slice(0, 10),
    }
    save(data)
  }
}

// ── OFERTA EDUCATIVA (escuelas externas socias) ───────────────────────────────

export function getOfertas() { return db().ofertas || [] }
export function getOferta(id) { return (db().ofertas || []).find(o => o.id === id) || null }
export function getIdiomasOferta() {
  const set = new Set((db().ofertas || []).map(o => o.idioma))
  return [...set].sort()
}
export function getProveedoresOferta() {
  const set = new Set((db().ofertas || []).map(o => o.proveedor))
  return [...set].sort()
}
export function crearOferta(oferta) {
  const data = db()
  if (!data.ofertas) data.ofertas = []
  data.ofertas.push({ id: uid(), ...oferta })
  save(data)
}
export function editarOferta(id, campos) {
  const data = db()
  const i = (data.ofertas || []).findIndex(x => x.id === id)
  if (i >= 0) { data.ofertas[i] = { ...data.ofertas[i], ...campos }; save(data) }
}
export function eliminarOferta(id) {
  const data = db()
  data.ofertas = (data.ofertas || []).filter(x => x.id !== id)
  save(data)
}
// Inscribir a un alumno (o pre-inscripción externa) a una oferta educativa externa
export function inscribirAOferta({ oferta_id, alumno_id, plantel_id, nombre_externo, email_externo, tel_externo }) {
  const data = db()
  const folio = 'INJ-' + String(data.inscripciones.length + 1).padStart(4, '0')
  data.inscripciones.push({
    id: uid(), folio, fecha_registro: new Date().toISOString().slice(0, 10),
    oferta_id, grupo_id: null, alumno_id: alumno_id || null,
    plantel_id: plantel_id || null,
    nombre_externo: nombre_externo || '', email_externo: email_externo || '', tel_externo: tel_externo || '',
    estado: 'nueva', placement_nivel: null, sugerida_por: null,
  })
  save(data)
}

export function lookupNombre(coleccion, id) {
  const data = db()
  const arr = data[coleccion] || []
  const item = arr.find(x => x.id === id)
  return item ? (item.nombre || item.codigo || item.titulo || id) : '—'
}

// ── PRE-REGISTROS PÚBLICOS ──────────────────────────────────────────────────────
// Estados: 'pendiente_pago' → 'pagado' → 'cuenta_creada'

export function crearPreRegistro({ nombre, email, tel, curp, fecha_nacimiento, estado_entidad, idioma_interes, proveedor_interes, horario_preferido, como_entero }) {
  const data = db()
  if (!data.pre_registros) data.pre_registros = []
  const num = data.pre_registros.length + 1
  const folio = 'PRE-' + String(num).padStart(4, '0')
  data.pre_registros.push({
    id: uid(), folio,
    fecha_registro: new Date().toISOString().slice(0, 10),
    nombre: nombre || '', email: email || '', tel: tel || '',
    curp: curp || '', fecha_nacimiento: fecha_nacimiento || '',
    estado_entidad: estado_entidad || '',
    idioma_interes: idioma_interes || '', proveedor_interes: proveedor_interes || '',
    horario_preferido: horario_preferido || '', como_entero: como_entero || '',
    estado: 'pendiente_pago', fecha_pago: null, usuario_id: null,
  })
  save(data)
  return folio
}

export function getPreRegistros() {
  return ((db().pre_registros) || []).slice().reverse()
}

export function getPreRegistro(id) {
  return ((db().pre_registros) || []).find(r => r.id === id) || null
}

export function marcarPagadoPreRegistro(id) {
  const data = db()
  const i = (data.pre_registros || []).findIndex(r => r.id === id)
  if (i >= 0 && data.pre_registros[i].estado === 'pendiente_pago') {
    data.pre_registros[i].estado = 'pagado'
    data.pre_registros[i].fecha_pago = new Date().toISOString().slice(0, 10)
    save(data)
  }
}

export function crearCuentaDesdePreRegistro(id, { password, plantel_id }) {
  const data = db()
  const i = (data.pre_registros || []).findIndex(r => r.id === id)
  if (i < 0) return null
  const pre = data.pre_registros[i]
  const pwdHash = hashPwd(password)
  const nuevoId = uid()
  const nuevoUsuario = {
    id: nuevoId, nombre: pre.nombre, email: pre.email,
    password: pwdHash, rol: 'alumno',
    plantel_id: plantel_id || null, activo: true, proveedor: null,
    matricula: '', fecha_nacimiento: pre.fecha_nacimiento || '',
    estado_entidad: pre.estado_entidad || '',
  }
  if (!data.usuarios) data.usuarios = []
  data.usuarios.push(nuevoUsuario)
  data.pre_registros[i].estado = 'cuenta_creada'
  data.pre_registros[i].usuario_id = nuevoId
  save(data)
  return { nombre: pre.nombre, email: pre.email, password }
}
