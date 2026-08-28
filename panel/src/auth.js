// Permisos del sistema
export const P = {
  PLAN_VER: 'PLAN_VER',
  PLAN_CREAR: 'PLAN_CREAR',
  PLAN_EDITAR: 'PLAN_EDITAR',
  IDIOMA_VER: 'IDIOMA_VER',
  IDIOMA_CONFIG: 'IDIOMA_CONFIG',
  GRUPO_VER: 'GRUPO_VER',
  GRUPO_CREAR: 'GRUPO_CREAR',
  GRUPO_ASIGNAR: 'GRUPO_ASIGNAR',
  ASIST_VER: 'ASIST_VER',
  ASIST_REGISTRAR: 'ASIST_REGISTRAR',
  EVAL_VER: 'EVAL_VER',
  EVAL_REGISTRAR: 'EVAL_REGISTRAR',
  PLACEMENT_VER: 'PLACEMENT_VER',
  PLACEMENT_APLICAR: 'PLACEMENT_APLICAR',
  INSC_VER: 'INSC_VER',
  INSC_CREAR: 'INSC_CREAR',
  INSC_SUGERIR: 'INSC_SUGERIR',
  INSC_CONFIRMAR: 'INSC_CONFIRMAR',
  PAGO_VER: 'PAGO_VER',
  PAGO_REALIZAR: 'PAGO_REALIZAR',
  PAGO_REGISTRAR: 'PAGO_REGISTRAR',
  AVISO_VER: 'AVISO_VER',
  AVISO_CREAR: 'AVISO_CREAR',
  AVISO_CREAR_GRUPO: 'AVISO_CREAR_GRUPO',
  REPORTE_VER: 'REPORTE_VER',
  REPORTE_VER_PLANTEL: 'REPORTE_VER_PLANTEL',
  CONFIG_SISTEMA: 'CONFIG_SISTEMA',
  SESION_EDITAR: 'SESION_EDITAR',
  MENSAJE_ENVIAR: 'MENSAJE_ENVIAR',
  // v2.2
  TAREA_CREAR: 'TAREA_CREAR',
  TAREA_VER: 'TAREA_VER',
  USUARIOS_GESTIONAR: 'USUARIOS_GESTIONAR',
  // v2.3
  BUZON_ENVIAR: 'BUZON_ENVIAR',       // enviar queja/sugerencia (todos los roles)
  BUZON_GESTIONAR: 'BUZON_GESTIONAR', // ver, responder y cambiar estatus del buzón
  // v2.4
  CONVENIO_GESTIONAR: 'CONVENIO_GESTIONAR', // gestionar convenios y documentos con planteles
  // v2.5
  USUARIOS_ADMIN: 'USUARIOS_ADMIN', // ver y gestionar TODOS los usuarios (superadmin + coordinador)
  // v2.6
  ARCO_ATENDER: 'ARCO_ATENDER', // acceder al módulo Legal y ARCO
  // v2.7 — Atención a Alumnos
  ATENCION_CREAR: 'ATENCION_CREAR',       // crear solicitudes de atención (todos los roles)
  ATENCION_GESTIONAR: 'ATENCION_GESTIONAR', // ver bandeja, cambiar estado, notas internas
  // v2.8 — Calendario institucional
  CALENDARIO_ADMIN: 'CALENDARIO_ADMIN',   // crear/editar/eliminar eventos institucionales
}

const TODOS = Object.values(P)

export const ROL_PERMISOS = {
  superadmin: {
    permisos: TODOS,
    scope: 'global',
    label: 'Super Admin',
    color: '#e74c3c',
    esLenguaJoven: true,
  },
  director: {
    permisos: [
      P.PLAN_EDITAR, P.IDIOMA_VER, P.IDIOMA_CONFIG,
      P.GRUPO_VER, P.GRUPO_CREAR, P.GRUPO_ASIGNAR,
      P.ASIST_VER, P.ASIST_REGISTRAR,
      P.EVAL_VER, P.EVAL_REGISTRAR,
      P.PLACEMENT_VER, P.PLACEMENT_APLICAR,
      P.INSC_VER, P.INSC_CREAR, P.INSC_CONFIRMAR,
      P.PAGO_VER, P.PAGO_REGISTRAR,
      P.AVISO_VER, P.AVISO_CREAR,
      P.REPORTE_VER_PLANTEL,
      P.SESION_EDITAR,
      P.MENSAJE_ENVIAR,
      P.TAREA_CREAR, P.TAREA_VER,
      P.USUARIOS_GESTIONAR,
      P.BUZON_ENVIAR, P.BUZON_GESTIONAR,
      P.ARCO_ATENDER,
      P.ATENCION_CREAR, P.ATENCION_GESTIONAR,
      P.CALENDARIO_ADMIN,
    ],
    scope: 'plantel',
    label: 'Director',
    color: '#8e44ad',
  },
  coordinador: {
    permisos: [
      P.IDIOMA_VER, P.IDIOMA_CONFIG,
      P.GRUPO_VER, P.GRUPO_CREAR, P.GRUPO_ASIGNAR,
      P.INSC_VER, P.INSC_CREAR, P.INSC_CONFIRMAR,
      P.PAGO_VER, P.PAGO_REGISTRAR,
      P.AVISO_VER, P.AVISO_CREAR, P.AVISO_CREAR_GRUPO,
      P.REPORTE_VER_PLANTEL,
      P.MENSAJE_ENVIAR,
      P.BUZON_ENVIAR,
      P.CONVENIO_GESTIONAR,
      P.USUARIOS_GESTIONAR,
      P.USUARIOS_ADMIN,
      P.ARCO_ATENDER,
      P.ATENCION_CREAR, P.ATENCION_GESTIONAR,
      P.CALENDARIO_ADMIN,
    ],
    scope: 'multi-plantel',
    label: 'Coordinador LJ',
    color: '#2980b9',
    esLenguaJoven: true,
  },
  profesor: {
    permisos: [
      P.GRUPO_VER,
      P.ASIST_VER, P.ASIST_REGISTRAR,
      P.EVAL_VER, P.EVAL_REGISTRAR,
      P.PLACEMENT_VER,
      P.AVISO_VER, P.AVISO_CREAR_GRUPO,
      P.SESION_EDITAR,
      P.MENSAJE_ENVIAR,
      P.TAREA_CREAR, P.TAREA_VER,
      P.USUARIOS_GESTIONAR,
      P.BUZON_ENVIAR,
      P.ATENCION_CREAR,
    ],
    scope: 'propio',
    label: 'Profesor',
    color: '#27ae60',
  },
  alumno: {
    permisos: [
      P.GRUPO_VER,
      P.ASIST_VER,
      P.EVAL_VER,
      P.PLACEMENT_VER,
      P.INSC_VER,
      P.PAGO_VER, P.PAGO_REALIZAR,
      P.AVISO_VER,
      P.MENSAJE_ENVIAR,
      P.TAREA_VER,
      P.BUZON_ENVIAR,
      P.ATENCION_CREAR,
    ],
    scope: 'propio',
    label: 'Alumno',
    color: '#F18B11',
  },
  admin_ventas: {
    permisos: [
      P.GRUPO_VER,
      P.PLACEMENT_VER, P.PLACEMENT_APLICAR,
      P.INSC_VER, P.INSC_CREAR, P.INSC_CONFIRMAR,
      P.PAGO_VER, P.PAGO_REGISTRAR,
      P.AVISO_VER, P.AVISO_CREAR_GRUPO,
      P.REPORTE_VER_PLANTEL,
      P.MENSAJE_ENVIAR,
      P.TAREA_VER,
      P.BUZON_ENVIAR,
      P.ATENCION_CREAR, P.ATENCION_GESTIONAR,
    ],
    scope: 'plantel',
    label: 'Admin / Ventas',
    color: '#16a085',
  },
  tutor: {
    permisos: [
      P.EVAL_VER,
      P.PAGO_VER,
    ],
    scope: 'menores',
    label: 'Tutor / Padre de familia',
    color: '#6c757d',
  },
}

export function tienePermiso(usuario, permiso) {
  if (!usuario) return false
  const rolCfg = ROL_PERMISOS[usuario.rol]
  if (!rolCfg) return false
  return rolCfg.permisos.includes(permiso)
}
