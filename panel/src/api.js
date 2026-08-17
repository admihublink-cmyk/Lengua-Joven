// Cliente API — reemplaza store.js para todas las llamadas al backend

const BASE = (import.meta.env.VITE_API_URL || '') + '/api'

function getStorage() {
  return typeof window !== 'undefined' ? window.localStorage : undefined
}

function getToken() {
  try { return getStorage()?.getItem('lj_token') || null } catch { return null }
}

function setToken(t) {
  try {
    if (t) getStorage()?.setItem('lj_token', t)
    else getStorage()?.removeItem('lj_token')
  } catch {}
}

function getUser() {
  try {
    const raw = getStorage()?.getItem('lj_user') || 'null'
    return JSON.parse(raw)
  } catch { return null }
}

function setUser(u) {
  try {
    if (u) getStorage()?.setItem('lj_user', JSON.stringify(u))
    else getStorage()?.removeItem('lj_user')
  } catch {}
}

async function req(method, path, body, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: options.isFormData ? { Authorization: headers['Authorization'] } : headers,
      body: options.isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    throw new Error('No se pudo conectar con el servidor. Revisa la conexión o intenta más tarde.')
  }

  if (!res.ok) {
    let errMessage = res.statusText || 'Error de servidor'
    try {
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const err = await res.json()
        errMessage = err.error || err.message || errMessage
      } else {
        const text = await res.text()
        if (text) errMessage = text
      }
    } catch {}
    throw new Error(errMessage)
  }
  return res.json()
}

const get = (path) => req('GET', path)
const post = (path, body) => req('POST', path, body)
const put = (path, body) => req('PUT', path, body)
const del = (path) => req('DELETE', path)

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function login(email, password) {
  const data = await post('/auth/login', { email, password })
  setToken(data.token)
  setUser(data.user)
  return data.user
}

export async function logout() {
  try { await post('/auth/logout', {}) } catch (_) { /* ignorar si el token ya expiró */ }
  setToken(null)
  setUser(null)
}

export function getUsuarioActual() {
  return getUser()
}

// ── Auth extra ───────────────────────────────────────────────────────────────
export const cambiarPassword = (data) => post('/auth/cambiar-password', data)
export const solicitarRecuperacion = (email) => post('/auth/forgot-password', { email })
export const verificarTokenReset = (token) => get(`/auth/reset-password/${token}`)
export const restablecerPassword = (token, nueva) => post(`/auth/reset-password/${token}`, { nueva })

// ── Usuarios ──────────────────────────────────────────────────────────────────
export const getUsuarios = () => get('/usuarios')
export const getTutorAlumnos = () => get('/usuarios/tutor-alumnos')
export const getUsuario = (id) => get(`/usuarios/${id}`)
export const crearUsuario = (data) => post('/usuarios', data)
export const actualizarUsuario = (id, data) => put(`/usuarios/${id}`, data)
export const desactivarUsuario = (id) => del(`/usuarios/${id}`)
export const getPlantelessCoordinador = (id) => get(`/usuarios/${id}/planteles`)
export const setPlantelessCoordinador = (id, plantel_ids) => put(`/usuarios/${id}/planteles`, { plantel_ids })

// ── Planteles ─────────────────────────────────────────────────────────────────
export const getPlanteles = () => get('/planteles')
export const getPlantel = (id) => get(`/planteles/${id}`)
export const crearPlantel = (data) => post('/planteles', data)
export const actualizarPlantel = (id, data) => put(`/planteles/${id}`, data)
export const getCoordinadorPlantel = (id) => get(`/planteles/${id}/coordinador`)

// ── Idiomas ───────────────────────────────────────────────────────────────────
export const getIdiomas = () => get('/idiomas')
export const crearIdioma = (data) => post('/idiomas', data)
export const actualizarIdioma = (id, data) => put(`/idiomas/${id}`, data)
export const eliminarIdioma = (id) => del(`/idiomas/${id}`)
export const getNiveles = (idioma_id) => get(`/idiomas/${idioma_id}/niveles`)
export const crearNivel = (idioma_id, data) => post(`/idiomas/${idioma_id}/niveles`, data)
export const actualizarNivel = (nid, data) => put(`/idiomas/niveles/${nid}`, data)
export const eliminarNivel = (nid) => del(`/idiomas/niveles/${nid}`)

// ── Grupos ────────────────────────────────────────────────────────────────────
export const getGrupos = () => get('/grupos')
export const getGrupo = (id) => get(`/grupos/${id}`)
export const crearGrupo = (data) => post('/grupos', data)
export const actualizarGrupo = (id, data) => put(`/grupos/${id}`, data)
export const eliminarGrupo = (id) => del(`/grupos/${id}`)
export const getAlumnosGrupo = (id) => get(`/grupos/${id}/alumnos`)

// ── Inscripciones ─────────────────────────────────────────────────────────────
export const getInscripciones = () => get('/inscripciones')
export const getInscripcion = (id) => get(`/inscripciones/${id}`)
export const crearInscripcion = (data) => post('/inscripciones', data)
export const actualizarInscripcion = (id, data) => put(`/inscripciones/${id}`, data)
export const eliminarInscripcion = (id) => del(`/inscripciones/${id}`)

// ── Tareas ────────────────────────────────────────────────────────────────────
export const getTareas = () => get('/tareas')
export const getTarea = (id) => get(`/tareas/${id}`)
export const eliminarTarea = (id) => del(`/tareas/${id}`)

export async function crearTarea(data, archivo) {
  if (archivo) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(data)) fd.append(k, v)
    fd.append('archivo', archivo)
    return req('POST', '/tareas', fd, { isFormData: true })
  }
  return post('/tareas', data)
}

export async function actualizarTarea(id, data, archivo) {
  if (archivo) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(data)) fd.append(k, v)
    fd.append('archivo', archivo)
    return req('PUT', `/tareas/${id}`, fd, { isFormData: true })
  }
  return put(`/tareas/${id}`, data)
}

export const getEntregas = (tareaId) => get(`/tareas/${tareaId}/entregas`)
export const getCalificacionesTarea = (tareaId) => get(`/tareas/${tareaId}/calificaciones`)
export const calificarTarea = (tareaId, data) => post(`/tareas/${tareaId}/calificaciones`, data)

export async function subirEntrega(tareaId, archivo) {
  const fd = new FormData()
  fd.append('archivo', archivo)
  return req('POST', `/tareas/${tareaId}/entregas`, fd, { isFormData: true })
}

export function getArchivoTareaUrl(tareaId) {
  return `${BASE}/tareas/${tareaId}/archivo`
}

export function getArchivoEntregaUrl(tareaId, entregaId) {
  return `${BASE}/tareas/${tareaId}/entregas/${entregaId}/archivo`
}

// Descargar archivo con token en header
export async function descargarArchivo(url, filename) {
  const token = getToken()
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error('Error al descargar')
  const blob = await res.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename || 'archivo'
  link.click()
  URL.revokeObjectURL(link.href)
}

// ── Asistencia ────────────────────────────────────────────────────────────────
export const getAsistencias = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return get('/asistencia' + (q ? '?' + q : ''))
}
export const registrarAsistencias = (data) => post('/asistencia', data)
export const getSesiones = (grupo_id) => get('/asistencia/sesiones' + (grupo_id ? `?grupo_id=${grupo_id}` : ''))
export const crearSesion = (data) => post('/asistencia/sesiones', data)
export const actualizarSesion = (id, data) => put(`/asistencia/sesiones/${id}`, data)
export const getAsistenciaSesion = (sesionId) => get(`/asistencia/sesiones/${sesionId}/asistencia`)
export const registrarAsistenciaSesion = (sesionId, data) => post(`/asistencia/sesiones/${sesionId}/asistencia`, data)

// ── Evaluación ────────────────────────────────────────────────────────────────
export const getEvaluaciones = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return get('/evaluacion' + (q ? '?' + q : ''))
}
export const crearEvaluacion = (data) => post('/evaluacion', data)
export const actualizarEvaluacion = (id, data) => put(`/evaluacion/${id}`, data)
export const getPlacements = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return get('/evaluacion/placements' + (q ? '?' + q : ''))
}
export const crearPlacement = (data) => post('/evaluacion/placements', data)

// ── Mensajes ──────────────────────────────────────────────────────────────────
export const getMensajes = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return get('/mensajes' + (q ? '?' + q : ''))
}
export const enviarMensaje = (data) => post('/mensajes', data)
export const marcarMensajeLeido = (id) => put(`/mensajes/${id}/leido`)
export const marcarMensajesLeidos = (de) => put('/mensajes/marcar-leidos', { de })

// ── Avisos ────────────────────────────────────────────────────────────────────
export const getAvisos = () => get('/avisos')
export const crearAviso = (data) => post('/avisos', data)
export const actualizarAviso = (id, data) => put(`/avisos/${id}`, data)
export const eliminarAviso = (id) => del(`/avisos/${id}`)

// ── Notificaciones ────────────────────────────────────────────────────────────
export const getNotificaciones = () => get('/notificaciones')
export const marcarNotifLeida = (id) => put(`/notificaciones/${id}/leida`)
export const marcarTodasLeidas = () => post('/notificaciones/marcar-todas')

// ── Buzón ─────────────────────────────────────────────────────────────────────
export const getBuzon = () => get('/buzon')
export const crearBuzon = (data) => post('/buzon', data)
export const responderBuzon = (id, data) => put(`/buzon/${id}/responder`, data)

// ── Ofertas ───────────────────────────────────────────────────────────────────
export const getOfertas = () => get('/ofertas')
export const getProveedoresOferta = () => get('/ofertas/proveedores')
export const crearOferta = (data) => post('/ofertas', data)
export const actualizarOferta = (id, data) => put(`/ofertas/${id}`, data)
export const eliminarOferta = (id) => del(`/ofertas/${id}`)

// ── Pre-registros ─────────────────────────────────────────────────────────────
export const crearPreRegistro = (data) => post('/pre-registros/publico', data)
export const getPreRegistros = () => get('/pre-registros')
export const getPreRegistro = (id) => get(`/pre-registros/${id}`)
export const marcarPagadoPreRegistro = (id) => put(`/pre-registros/${id}/marcar-pagado`)
export const crearCuentaDesdePreRegistro = (id, data) => post(`/pre-registros/${id}/crear-cuenta`, data)
export const enviarCredenciales = (id, data) => post(`/pre-registros/${id}/enviar-credenciales`, data)

// ── Config ────────────────────────────────────────────────────────────────────
export const getConfig = () => get('/config')
export const actualizarConfig = (data) => put('/config', data)

// ── Pagos ─────────────────────────────────────────────────────────────────────
export const getPagos = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return get('/pagos' + (q ? '?' + q : ''))
}
export const crearPago = (data) => post('/pagos', data)
export const actualizarPago = (id, data) => put(`/pagos/${id}`, data)
export const importarPagosCSV = (filas) => post('/pagos/importar-csv', { filas })

export async function descargarPagosTxt(desde, hasta) {
  const token = getToken()
  const q = new URLSearchParams({ ...(desde && { desde }), ...(hasta && { hasta }) }).toString()
  const res = await fetch(`${BASE}/pagos/txt?${q}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error('Error al generar reporte')
  const blob = await res.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `pagos_${desde || 'todos'}.txt`
  link.click()
  URL.revokeObjectURL(link.href)
}

export const getActividad = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return get('/actividad' + (q ? '?' + q : ''))
}

export async function descargarActividadTxt(params = {}) {
  const token = getToken()
  const q = new URLSearchParams(params).toString()
  const res = await fetch(`${BASE}/actividad/txt?${q}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error('Error al generar reporte')
  const blob = await res.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `actividad_${params.desde || 'todos'}.txt`
  link.click()
  URL.revokeObjectURL(link.href)
}

// ── Documentos de convenio ────────────────────────────────────────────────────
export const getDocumentosConvenio = (plantelId) => get(`/planteles/${plantelId}/documentos`)
export const eliminarDocumentoConvenio = (plantelId, tipo) => del(`/planteles/${plantelId}/documentos/${tipo}`)

export function getUrlDocumentoConvenio(plantelId, tipo) {
  return `${BASE}/planteles/${plantelId}/documentos/${tipo}/archivo`
}

export async function subirDocumentoConvenio(plantelId, tipo, archivo) {
  const token = getToken()
  const fd = new FormData()
  fd.append('archivo', archivo)
  const res = await fetch(`${BASE}/planteles/${plantelId}/documentos/${tipo}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Error al subir')
  }
  return res.json()
}

// ── Convenios ─────────────────────────────────────────────────────────────────
export async function descargarConvenioDOCX(plantelId) {
  const token = getToken()
  const res = await fetch(`${BASE}/planteles/${plantelId}/generar-convenio`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al generar convenio')
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const match = cd.match(/filename="([^"]+)"/)
  const filename = match ? match[1] : `convenio_${plantelId}.docx`
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

// ── Tutor ─────────────────────────────────────────────────────────────────────
export const getMisAlumnos = () => get('/usuarios/mis-alumnos')

// ── Períodos de inscripción ───────────────────────────────────────────────────
export const getPeriodos = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return get('/periodos' + (q ? '?' + q : ''))
}
export const crearPeriodo = (data) => post('/periodos', data)
export const actualizarPeriodo = (id, data) => put(`/periodos/${id}`, data)
export const eliminarPeriodo = (id) => del(`/periodos/${id}`)

// ── Banorte ───────────────────────────────────────────────────────────────────
export async function descargarCSVBanorte() {
  const token = getToken()
  const res = await fetch(`${BASE}/banorte/exportar-csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) throw new Error('Error al exportar CSV')
  const blob = await res.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'banorte_referencias.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

export const cargarLigasBanorte = (ligas) => post('/banorte/cargar-ligas', { ligas })
export const enviarLigaPago = (inscripcionId) => post(`/banorte/enviar-liga/${inscripcionId}`)
