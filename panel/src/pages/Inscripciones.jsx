import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

const PIPELINE_STEPS = [
  { id: 'nueva',              label: 'Formulario recibido', icon: '📋', color: '#95a5a6' },
  { id: 'bienvenida_enviada', label: 'Bienvenida enviada',  icon: '📧', color: '#3498db' },
  { id: 'alumno_respondio',   label: 'Alumno respondió',    icon: '💬', color: '#f39c12' },
  { id: 'boucher_enviado',    label: 'Bóucher enviado',     icon: '🧾', color: '#9b59b6' },
  { id: 'pagada',             label: 'Pagada',              icon: '💳', color: '#2ecc71' },
  { id: 'asignada',           label: 'Asignada a grupo',    icon: '✅', color: '#27ae60' },
]

const NEXT_ESTADO = {
  nueva: 'bienvenida_enviada',
  bienvenida_enviada: 'alumno_respondio',
  alumno_respondio: 'boucher_enviado',
  boucher_enviado: 'pagada',
  pagada: 'asignada',
}

const ESTADOS = ['nueva', 'bienvenida_enviada', 'alumno_respondio', 'boucher_enviado', 'pagada', 'asignada', 'espera', 'baja', 'pendiente_autorizacion']
const ESTADOS_LABEL = {
  nueva: 'Formulario recibido',
  bienvenida_enviada: 'Bienvenida enviada',
  alumno_respondio: 'Alumno respondió',
  boucher_enviado: 'Bóucher enviado',
  asignada: 'Asignada',
  pagada: 'Pagada',
  espera: 'Lista de espera',
  baja: 'Baja',
  pendiente_autorizacion: '⏳ Pend. autorización',
}

// Parsea TSV (Google Sheets copy-paste) o CSV
function parsearCSV(texto) {
  const lineas = texto.trim().split('\n').filter(l => l.trim())
  if (lineas.length < 2) return null

  const sep = lineas[0].includes('\t') ? '\t' : ','
  const heads = lineas[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())

  const ci = (...words) => heads.findIndex(h => words.some(w => h.includes(w)))
  const iNombre = ci('nombre', 'name', 'alumno', 'participante', 'full')
  const iEmail  = ci('correo', 'email', 'mail')
  const iTel    = ci('tel', 'celular', 'whatsapp', 'phone', 'cel', 'móvil', 'movil')

  const filas = lineas.slice(1).map((l, idx) => {
    const cols = l.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    return {
      num:    idx + 1,
      nombre: iNombre >= 0 ? (cols[iNombre] || '') : '',
      email:  iEmail  >= 0 ? (cols[iEmail]  || '') : '',
      tel:    iTel    >= 0 ? (cols[iTel]    || '') : '',
    }
  }).filter(f => f.nombre.trim() || f.email.trim())

  return { filas, detectado: { nombre: iNombre >= 0, email: iEmail >= 0, tel: iTel >= 0 } }
}

export default function Inscripciones() {
  const { usuario, tienePermiso } = useAuth()
  const [inscripciones, setInscripciones] = useState([])
  const [grupos, setGrupos] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [niveles, setNiveles] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(null)
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState({})
  const [formErr, setFormErr] = useState('')
  const [nivelSugerido, setNivelSugerido] = useState(null) // { inscId, nombre, nivelId }

  // Extemporáneas pendientes de autorización
  const [extemporaneasPendientes, setExtemporaneasPendientes] = useState([])
  const [autorizandoExt, setAutorizandoExt] = useState(null) // id de inscripción

  // Cambios de grupo/nivel
  const [cambios, setCambios] = useState([])
  const [modalCambio, setModalCambio] = useState(null) // inscripcion obj | null
  const [cambioExistente, setCambioExistente] = useState(null) // solicitud guardada
  const [cambioForm, setCambioForm] = useState({ tipo: 'grupo', nivel_deseado: '', horario_preferido: '', notas: '' })
  const [guardandoCambio, setGuardandoCambio] = useState(false)
  const puedeRegistrarCambios = tienePermiso(P.CAMBIO_REGISTRAR)

  // Estado para importación CSV
  const [csvTexto, setCsvTexto] = useState('')
  const [csvFilas, setCsvFilas] = useState([])
  const [csvErr, setCsvErr] = useState('')

  // Pre-registros
  const [tabActivo, setTabActivo] = useState('inscripciones')
  const [preRegistros, setPreRegistros] = useState([])
  const [selPre, setSelPre] = useState(null)
  const [modalPre, setModalPre] = useState(null) // 'detalle' | 'crear_cuenta' | 'credenciales'
  const [pwdNuevo, setPwdNuevo] = useState('')
  const [plantelNuevo, setPlantelNuevo] = useState('')
  const [credenciales, setCredenciales] = useState(null)
  const [enviandoCredenciales, setEnviandoCredenciales] = useState(false)
  const [credencialesEnviadas, setCredencialesEnviadas] = useState(false)
  const [grupoAsignar, setGrupoAsignar] = useState('')
  const [filtroEstadoPre, setFiltroEstadoPre] = useState('todos')
  const [enviandoLiga, setEnviandoLiga] = useState(null) // inscripcion_id
  const [grupoLleno, setGrupoLleno] = useState(null) // { insId, grupoId, cupo, actuales }

  async function cargar() {
    try {
      const puedeVerPre = tienePermiso(P.INSC_CONFIRMAR) || tienePermiso(P.INSC_CREAR)
      const puedeAutorizar = ['superadmin', 'coordinador', 'director'].includes(usuario?.rol)
      const puedeVerCambios = tienePermiso(P.CAMBIO_REGISTRAR)
      const [ins, g, p, u, idiomas, pre, extPend, cambiosArr] = await Promise.all([
        api.getInscripciones(),
        api.getGrupos(),
        api.getPlanteles(),
        api.getUsuarios(),
        api.getIdiomas(),
        puedeVerPre ? api.getPreRegistros() : Promise.resolve([]),
        puedeAutorizar ? api.getExtemporaneasPendientes() : Promise.resolve([]),
        puedeVerCambios ? api.getCambios() : Promise.resolve([]),
      ])
      setInscripciones(ins)
      setGrupos(g)
      setPlanteles(p)
      setUsuarios(u)
      if (puedeVerPre) setPreRegistros(pre)
      if (puedeAutorizar) setExtemporaneasPendientes(extPend)
      if (puedeVerCambios) setCambios(cambiosArr)
      const nivelesArr = await Promise.all(idiomas.map(i => api.getNiveles(i.id)))
      setNiveles(nivelesArr.flat())
    } catch (e) {
      console.error('Error cargando inscripciones:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  function nombre(ins) {
    if (ins.alumno_id) return usuarios.find(x => x.id === ins.alumno_id)?.nombre || ins.alumno_id
    return ins.nombre_externo || '(Sin nombre)'
  }
  function nomGrupo(id) { return grupos.find(g => g.id === id)?.codigo || '—' }
  function nomPlantel(id) { return planteles.find(p => p.id === id)?.nombre || '—' }
  function nomNivel(id) { return niveles.find(n => n.id === id)?.nombre || '—' }

  const puedeGestionar = tienePermiso(P.INSC_CONFIRMAR) || tienePermiso(P.INSC_CREAR)

  const filtradas = inscripciones.filter(i => {
    if (filtroEstado !== 'todos' && i.estado !== filtroEstado) return false
    if (!busca) return true
    const q = busca.toLowerCase()
    return [nombre(i), i.folio, i.email_externo].some(v => (v || '').toLowerCase().includes(q))
  })

  async function cambiarEstado(id, estado) {
    try { await api.actualizarInscripcion(id, { estado }); await cargar() }
    catch (e) { alert('Error al cambiar estado: ' + (e.message || 'intenta de nuevo')) }
  }

  async function avanzarEtapa(id, estadoActual) {
    const next = NEXT_ESTADO[estadoActual]
    if (!next) return
    try { await api.actualizarInscripcion(id, { estado: next }); await cargar() }
    catch (e) { alert('Error al avanzar etapa: ' + (e.message || 'intenta de nuevo')) }
  }

  async function asignarGrupo(insId, grupoId) {
    try {
      await api.actualizarInscripcion(insId, { grupo_id: grupoId, estado: 'asignada' })
      setSel(null); await cargar()
    } catch (e) {
      if (e.status === 409 && e.data?.razon === 'grupo_lleno') {
        setGrupoLleno({ insId, grupoId, cupo: e.data.cupo, actuales: e.data.actuales })
      } else {
        alert('Error al asignar grupo: ' + (e.message || 'intenta de nuevo'))
      }
    }
  }

  async function handleAutorizarExtemporanea(id, accion) {
    let motivo = ''
    if (accion === 'rechazar') {
      motivo = window.prompt('Motivo del rechazo (opcional):') || ''
    }
    setAutorizandoExt(id)
    try {
      await api.autorizarExtemporanea(id, accion, motivo)
      await cargar()
    } catch (e) { alert('Error: ' + e.message) }
    finally { setAutorizandoExt(null) }
  }

  async function ponerEnEspera(insId, grupoId) {
    try {
      await api.actualizarInscripcion(insId, { grupo_id: grupoId, estado: 'espera' })
      setGrupoLleno(null); setSel(null); await cargar()
    } catch (e) { alert('Error: ' + e.message) }
  }

  async function confirmarSugerencia(ins) {
    await asignarGrupo(ins.id, ins.grupo_sugerido_id)
  }

  async function rechazarSugerencia(ins) {
    try {
      await api.actualizarInscripcion(ins.id, { grupo_sugerido_id: null })
      setSel(null); await cargar()
    } catch (e) { alert('Error al rechazar: ' + (e.message || 'intenta de nuevo')) }
  }

  // Import CSV handlers
  function analizarCSV() {
    setCsvErr('')
    setCsvFilas([])
    if (!csvTexto.trim()) { setCsvErr('Pega los datos del formulario primero.'); return }
    const res = parsearCSV(csvTexto)
    if (!res || res.filas.length === 0) {
      setCsvErr('No se encontraron filas válidas. Asegúrate de copiar también la fila de encabezados.')
      return
    }
    if (!res.detectado.nombre) {
      setCsvErr('No se detectó columna de nombre. Verifica que el encabezado contenga "nombre" o "name".')
      return
    }
    setCsvFilas(res.filas)
  }

  async function importarCSV() {
    const pid = usuario.plantel_id || ''
    const emailsExist = new Set(
      inscripciones.map(i => (i.email_externo || '').toLowerCase()).filter(Boolean)
    )
    const nuevas = csvFilas.filter(f => {
      if (!f.nombre.trim()) return false
      if (f.email && emailsExist.has(f.email.toLowerCase())) return false
      return true
    })
    try {
      await Promise.all(nuevas.map(f => api.crearInscripcion({
        plantel_id: pid, estado: 'nueva',
        nombre_externo: f.nombre, email_externo: f.email || '', tel_externo: f.tel || '',
      })))
      cerrarImportar()
      await cargar()
    } catch (e) {
      alert('Error importando: ' + e.message)
    }
  }

  function cerrarImportar() {
    setModal(null)
    setCsvTexto('')
    setCsvFilas([])
    setCsvErr('')
  }

  async function enviarLiga(inscripcionId) {
    setEnviandoLiga(inscripcionId)
    try {
      const r = await api.avisarLigas([inscripcionId])
      alert(`✓ Aviso enviado. Enviados: ${r.enviados}, Fallidos: ${r.fallidos}`)
      await cargar()
    } catch (e) { alert('Error: ' + e.message) } finally { setEnviandoLiga(null) }
  }

  // Count per pipeline stage (only non-baja inscriptions)
  const countByStage = {}
  PIPELINE_STEPS.forEach(s => {
    countByStage[s.id] = inscripciones.filter(i => i.estado === s.id).length
  })

  // Duplicate detection for import preview
  const emailsExistentes = new Set(
    inscripciones.map(i => (i.email_externo || '').toLowerCase()).filter(Boolean)
  )

  const presFiltradas = preRegistros.filter(p =>
    filtroEstadoPre === 'todos' || p.estado === filtroEstadoPre
  )

  const ESTADO_PRE_CONFIG = {
    pendiente_pago: { label: 'Pendiente de pago', color: '#e67e22', bg: '#fff8f0' },
    pagado:         { label: 'Pagado',             color: '#27ae60', bg: '#f0fff4' },
    cuenta_creada:  { label: 'Cuenta creada',      color: '#2980b9', bg: '#f0f8ff' },
  }

  async function confirmarCrearCuenta() {
    if (!pwdNuevo.trim() || pwdNuevo.length < 6) { alert('La contraseña debe tener al menos 6 caracteres.'); return }
    try {
      const resultado = await api.crearCuentaDesdePreRegistro(selPre.id, { password: pwdNuevo, plantel_id: plantelNuevo || null })
      if (resultado) {
        setCredenciales(resultado)
        setCredencialesEnviadas(false)
        setModalPre('credenciales')
        await cargar()
      }
    } catch (e) {
      alert('Error al crear cuenta: ' + (e.message || 'Error desconocido'))
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Inscripciones</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {puedeGestionar && (
            <button className="btn-sec" onClick={() => {
              setCsvTexto(''); setCsvFilas([]); setCsvErr('')
              setModal('importar')
            }}>
              📥 Importar Forms
            </button>
          )}
          {puedeGestionar && (
            <button className="btn-sec" style={{ background: '#1a5276', color: '#fff', borderColor: '#1a5276' }}
              onClick={() => navegar('ligas_pago')}>
              🏦 Ligas de Pago
            </button>
          )}
          {tienePermiso(P.INSC_CREAR) && (
            <button className="btn-primario" onClick={() => {
              setForm({ plantel_id: usuario.plantel_id || '', estado: 'nueva', alumno_id: null, nombre_externo: '', email_externo: '', tel_externo: '' })
              setFormErr('')
              setModal('crear')
            }}>+ Nueva inscripción</button>
          )}
        </div>
      </div>

      {/* Pestañas: Inscripciones / Pre-registros / Cambios */}
      {puedeGestionar && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--borde)' }}>
          {[
            ['inscripciones', '📋 Inscripciones'],
            ['pre_registros', '📝 Pre-registros'],
            ...(puedeRegistrarCambios ? [['cambios', '🔄 Cambios']] : []),
          ].map(([tab, label]) => (
            <button key={tab} onClick={() => setTabActivo(tab)} style={{
              padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: tabActivo === tab ? '2px solid var(--naranja)' : '2px solid transparent',
              color: tabActivo === tab ? 'var(--naranja)' : 'var(--texto-muted)', marginBottom: -2,
            }}>{label}
              {tab === 'pre_registros' && preRegistros.filter(p => p.estado === 'pendiente_pago').length > 0 && (
                <span style={{ marginLeft: 6, background: '#e74c3c', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
                  {preRegistros.filter(p => p.estado === 'pendiente_pago').length}
                </span>
              )}
              {tab === 'cambios' && cambios.filter(c => c.estado === 'pendiente').length > 0 && (
                <span style={{ marginLeft: 6, background: '#e67e22', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
                  {cambios.filter(c => c.estado === 'pendiente').length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB: PRE-REGISTROS ── */}
      {puedeGestionar && tabActivo === 'pre_registros' && (
        <div>
          <div className="filtros-bar" style={{ marginBottom: 16 }}>
            <select value={filtroEstadoPre} onChange={e => setFiltroEstadoPre(e.target.value)}>
              <option value="todos">Todos los estados</option>
              <option value="pendiente_pago">Pendiente de pago</option>
              <option value="pagado">Pagado</option>
              <option value="cuenta_creada">Cuenta creada</option>
            </select>
            <span className="texto-muted chico" style={{ marginLeft: 8 }}>{presFiltradas.length} pre-registro{presFiltradas.length !== 1 ? 's' : ''}</span>
          </div>

          {presFiltradas.length === 0 ? (
            <div className="card texto-muted" style={{ textAlign: 'center', padding: 32 }}>
              No hay pre-registros {filtroEstadoPre !== 'todos' ? `con estado "${ESTADO_PRE_CONFIG[filtroEstadoPre]?.label}"` : ''}.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Folio</th><th>Fecha</th><th>Nombre</th><th>Correo</th><th>Tel.</th>
                    <th>Idioma</th><th>Escuela pref.</th><th>Estado</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {presFiltradas.map(p => {
                    const cfg = ESTADO_PRE_CONFIG[p.estado] || {}
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700, fontSize: 12 }}>{p.folio}</td>
                        <td style={{ fontSize: 12 }}>{p.fecha_registro}</td>
                        <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                        <td style={{ fontSize: 12 }}>{p.email}</td>
                        <td style={{ fontSize: 12 }}>{p.tel}</td>
                        <td style={{ fontSize: 12 }}>{p.idioma_interes || '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--texto-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.proveedor_interes || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
                              {cfg.label}
                            </span>
                            {p.credenciales_enviadas === 1 && (
                              <span style={{ fontSize: 10, color: '#27ae60', fontWeight: 600 }}>📧 Credenciales enviadas</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button className="btn-mini" onClick={() => { setSelPre(p); setModalPre('detalle') }}>Ver</button>
                            {p.estado === 'pendiente_pago' && (
                              <button className="btn-mini" style={{ background: '#27ae60', color: '#fff', borderColor: '#27ae60' }}
                                onClick={async () => { if (window.confirm(`¿Marcar como pagado a ${p.nombre}?`)) { await api.marcarPagadoPreRegistro(p.id); await cargar() } }}>
                                ✓ Pagado
                              </button>
                            )}
                            {p.estado === 'pagado' && (
                              <button className="btn-mini" style={{ background: '#2980b9', color: '#fff', borderColor: '#2980b9' }}
                                onClick={() => { setSelPre(p); setPwdNuevo(''); setPlantelNuevo(''); setModalPre('crear_cuenta') }}>
                                👤 Crear cuenta
                              </button>
                            )}
                            {p.estado === 'cuenta_creada' && p.usuario_id && (
                              <button className="btn-mini" style={{ background: '#8e44ad', color: '#fff', borderColor: '#8e44ad' }}
                                onClick={() => { setSelPre(p); setGrupoAsignar(''); setModalPre('asignar_grupo') }}>
                                📚 Asignar grupo
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal: Detalle pre-registro */}
          {modalPre === 'detalle' && selPre && (
            <Modal titulo={`Pre-registro ${selPre.folio}`} onClose={() => setModalPre(null)} ancho={500}>
              <div className="detalle-grid">
                <div><label>Nombre</label><p style={{ fontWeight: 600 }}>{selPre.nombre}</p></div>
                <div><label>Estado</label><p><span style={{ color: ESTADO_PRE_CONFIG[selPre.estado]?.color, fontWeight: 700 }}>{ESTADO_PRE_CONFIG[selPre.estado]?.label}</span></p></div>
                <div><label>Correo</label><p>{selPre.email}</p></div>
                <div><label>Teléfono</label><p>{selPre.tel}</p></div>
                <div><label>CURP</label><p>{selPre.curp || '—'}</p></div>
                <div><label>Fecha de nacimiento</label><p>{selPre.fecha_nacimiento || '—'}</p></div>
                <div><label>Municipio</label><p>{selPre.estado_entidad || '—'}</p></div>
                <div><label>Folio</label><p>{selPre.folio}</p></div>
                <div style={{ gridColumn: '1/-1' }}><label>Idioma de interés</label><p>{selPre.idioma_interes || '—'}</p></div>
                <div style={{ gridColumn: '1/-1' }}><label>Escuela de preferencia</label><p>{selPre.proveedor_interes || '—'}</p></div>
                <div style={{ gridColumn: '1/-1' }}><label>Horario preferido</label><p>{selPre.horario_preferido || '—'}</p></div>
                <div><label>¿Cómo se enteró?</label><p>{selPre.como_entero || '—'}</p></div>
                <div><label>Fecha de registro</label><p>{selPre.fecha_registro}</p></div>
                {selPre.fecha_pago && <div><label>Fecha de pago</label><p>{selPre.fecha_pago}</p></div>}
              </div>
              <div className="modal-acciones">
                <button className="btn-sec" onClick={() => setModalPre(null)}>Cerrar</button>
                {selPre.estado === 'pendiente_pago' && (
                  <button className="btn-primario" style={{ background: '#27ae60' }}
                    onClick={async () => { await api.marcarPagadoPreRegistro(selPre.id); await cargar(); setModalPre(null) }}>
                    ✓ Marcar como pagado
                  </button>
                )}
                {selPre.estado === 'pagado' && (
                  <button className="btn-primario" onClick={() => { setPwdNuevo(''); setPlantelNuevo(''); setModalPre('crear_cuenta') }}>
                    👤 Crear cuenta
                  </button>
                )}
              </div>
            </Modal>
          )}

          {/* Modal: Crear cuenta */}
          {modalPre === 'crear_cuenta' && selPre && (
            <Modal titulo="Crear cuenta de alumno" onClose={() => setModalPre(null)} ancho={440}>
              <p className="texto-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                Se creará una cuenta de alumno para <strong>{selPre.nombre}</strong> ({selPre.email}).
                Define la contraseña inicial que le enviarás.
              </p>
              <label>Contraseña inicial *
                <input type="text" value={pwdNuevo} onChange={e => setPwdNuevo(e.target.value)}
                  placeholder="Mínimo 6 caracteres" />
              </label>
              <label>Asignar a plantel
                <select value={plantelNuevo} onChange={e => setPlantelNuevo(e.target.value)}>
                  <option value="">Sin plantel (global)</option>
                  {planteles.map(pl => <option key={pl.id} value={pl.id}>{pl.nombre}</option>)}
                </select>
              </label>
              <div className="modal-acciones">
                <button className="btn-sec" onClick={() => setModalPre(null)}>Cancelar</button>
                <button className="btn-primario" onClick={confirmarCrearCuenta}>Crear cuenta</button>
              </div>
            </Modal>
          )}

          {/* Modal: Credenciales generadas */}
          {modalPre === 'credenciales' && credenciales && (
            <Modal titulo="✅ Cuenta creada" onClose={() => { setModalPre(null); setCredenciales(null); setCredencialesEnviadas(false) }} ancho={440}>
              <p className="texto-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                La cuenta ha sido creada. Comparte estas credenciales con el alumno por correo o WhatsApp.
              </p>
              <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '16px 20px', fontFamily: 'monospace', fontSize: 14, lineHeight: 2 }}>
                <div>👤 <strong>Usuario:</strong> {credenciales.email}</div>
                <div>🔑 <strong>Contraseña:</strong> {credenciales.password}</div>
              </div>
              <p className="texto-muted" style={{ fontSize: 12, marginTop: 10 }}>
                Recuerda que el alumno puede cambiar su contraseña desde Mi Perfil una vez que ingrese.
              </p>

              {credencialesEnviadas && (
                <div style={{ background: '#f0fff4', border: '1px solid #27ae6044', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#27ae60', marginTop: 10 }}>
                  ✅ Correo de bienvenida enviado a <strong>{credenciales.email}</strong>
                </div>
              )}

              <div className="modal-acciones">
                <button className="btn-sec" onClick={() => { navigator.clipboard?.writeText(`Usuario: ${credenciales.email}\nContraseña: ${credenciales.password}`).catch(() => {}) }}>
                  📋 Copiar
                </button>
                {!credencialesEnviadas && (
                  <button className="btn-sec" disabled={enviandoCredenciales}
                    style={{ background: '#2980b9', color: '#fff', borderColor: '#2980b9', opacity: enviandoCredenciales ? 0.6 : 1 }}
                    onClick={async () => {
                      setEnviandoCredenciales(true)
                      try {
                        await api.enviarCredenciales(selPre.id, { password: credenciales.password })
                        setCredencialesEnviadas(true)
                        await cargar()
                      } catch (e) {
                        alert('Error al enviar correo: ' + e.message)
                      } finally {
                        setEnviandoCredenciales(false)
                      }
                    }}>
                    {enviandoCredenciales ? 'Enviando...' : '📧 Enviar por correo'}
                  </button>
                )}
                <button className="btn-primario" onClick={() => { setModalPre(null); setCredenciales(null); setCredencialesEnviadas(false) }}>Listo</button>
              </div>
            </Modal>
          )}
          {/* Modal: Asignar a grupo */}
          {modalPre === 'asignar_grupo' && selPre && (
            <Modal titulo="📚 Asignar a grupo" onClose={() => setModalPre(null)} ancho={440}>
              <p className="texto-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                Asigna a <strong>{selPre.nombre}</strong> a un grupo para crear su inscripción.
              </p>
              <label>Grupo *
                <select value={grupoAsignar} onChange={e => setGrupoAsignar(e.target.value)}>
                  <option value="">— Selecciona un grupo —</option>
                  {grupos.filter(g => g.activo).map(g => {
                    const p = planteles.find(x => x.id === g.plantel_id)
                    return <option key={g.id} value={g.id}>{g.codigo} — {p?.nombre || g.plantel_id}</option>
                  })}
                </select>
              </label>
              <div className="modal-acciones">
                <button className="btn-sec" onClick={() => setModalPre(null)}>Cancelar</button>
                <button className="btn-primario" disabled={!grupoAsignar}
                  onClick={async () => {
                    try {
                      const grupo = grupos.find(g => g.id === grupoAsignar)
                      await api.crearInscripcion({
                        alumno_id: selPre.usuario_id,
                        grupo_id: grupoAsignar,
                        plantel_id: grupo?.plantel_id || usuario.plantel_id || '',
                        estado: 'asignada',
                      })
                      setModalPre(null)
                      await cargar()
                      alert(`✅ ${selPre.nombre} fue asignado/a al grupo ${grupo?.codigo || grupoAsignar}.`)
                    } catch (e) {
                      alert('Error al asignar: ' + e.message)
                    }
                  }}>
                  Asignar
                </button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ── TAB: CAMBIOS DE GRUPO/NIVEL ── */}
      {puedeRegistrarCambios && tabActivo === 'cambios' && (
        <div>
          {cambios.length === 0 ? (
            <div className="card texto-muted" style={{ textAlign: 'center', padding: 40 }}>
              No hay solicitudes de cambio registradas.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Folio</th>
                    <th>Tipo</th>
                    <th>Nivel deseado</th>
                    <th>Horario preferido</th>
                    <th>Notas</th>
                    <th>Estado</th>
                    <th>Registrada</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cambios.map(c => {
                    const ESTADO_COLOR = { pendiente: '#e67e22', en_proceso: '#2980b9', resuelto: '#27ae60', cancelado: '#95a5a6' }
                    const ESTADO_LABEL = { pendiente: 'Pendiente', en_proceso: 'En proceso', resuelto: 'Resuelto', cancelado: 'Cancelado' }
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.alumno_nombre || c.alumno_id}</td>
                        <td style={{ fontSize: 12 }}>{c.folio || '—'}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-3)', fontWeight: 600 }}>{c.tipo === 'nivel' ? 'Nivel' : 'Grupo'}</span></td>
                        <td style={{ fontSize: 13 }}>{c.nivel_deseado || '—'}</td>
                        <td style={{ fontSize: 13 }}>{c.horario_preferido || '—'}</td>
                        <td style={{ fontSize: 12, maxWidth: 180, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.notas || '—'}</td>
                        <td>
                          <select value={c.estado} style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: `1px solid ${ESTADO_COLOR[c.estado]}`, color: ESTADO_COLOR[c.estado], background: 'transparent', fontWeight: 600 }}
                            onChange={async e => {
                              try {
                                await api.cambiarEstadoCambio(c.id, e.target.value)
                                await cargar()
                              } catch (err) { alert('Error: ' + err.message) }
                            }}>
                            {['pendiente', 'en_proceso', 'resuelto', 'cancelado'].map(s => (
                              <option key={s} value={s}>{ESTADO_LABEL[s]}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{c.creado_en ? c.creado_en.slice(0, 10) : '—'}</td>
                        <td>
                          <button className="btn-mini" style={{ color: '#e74c3c', borderColor: 'rgba(231,76,60,.4)' }}
                            onClick={async () => {
                              if (!confirm('¿Eliminar esta solicitud?')) return
                              try { await api.eliminarCambio(c.id); await cargar() }
                              catch (err) { alert('Error: ' + err.message) }
                            }}>Eliminar</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: INSCRIPCIONES (contenido original) ── */}
      {(!puedeGestionar || tabActivo === 'inscripciones') && (
      <div>

      {/* Vista alumno: mi proceso de inscripción */}
      {usuario.rol === 'alumno' && (
        <div style={{ marginBottom: 16 }}>
          {inscripciones.length === 0 && (
            <div className="card texto-muted" style={{ textAlign: 'center', padding: 32 }}>
              Aún no tienes una inscripción registrada.
            </div>
          )}
          {inscripciones.map(ins => {
            const idxActual = ins.estado === 'baja' ? -1 : PIPELINE_STEPS.findIndex(s => s.id === ins.estado)
            return (
              <div key={ins.id} className="card" style={{ marginBottom: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      Mi proceso de inscripción · Folio {ins.folio}
                    </div>
                    {ins.grupo_id && <div style={{ fontSize: 13, marginTop: 2 }}>Grupo: <strong>{nomGrupo(ins.grupo_id)}</strong></div>}
                  </div>
                  {ins.estado === 'baja'
                    ? <span className="badge baja">Baja</span>
                    : <span className={'badge ' + ins.estado}>{ESTADOS_LABEL[ins.estado] || ins.estado}</span>}
                </div>

                {ins.estado !== 'baja' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {PIPELINE_STEPS.map((step, idx) => {
                      const completado = idx < idxActual
                      const actual = idx === idxActual
                      return (
                        <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {idx > 0 && (
                            <span style={{ color: completado || actual ? step.color : 'var(--borde)', fontSize: 14, flexShrink: 0 }}>→</span>
                          )}
                          <div style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: `2px solid ${completado ? step.color : actual ? step.color : 'var(--borde)'}`,
                            background: completado ? step.color + '22' : actual ? step.color + '11' : 'var(--bg-3)',
                            color: completado || actual ? step.color : 'var(--texto-muted)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            minWidth: 90, gap: 2,
                          }}>
                            <span style={{ fontSize: 18, lineHeight: 1 }}>{completado ? '✅' : step.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.3, textAlign: 'center' }}>{step.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {ins.grupo_sugerido_id && (
                  <div className="alerta info" style={{ marginTop: 12 }}>
                    El sistema sugirió el grupo <strong>{nomGrupo(ins.grupo_sugerido_id)}</strong>. Espera la confirmación de tu plantel.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pipeline visual */}
      {usuario.rol !== 'alumno' && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Pipeline de pre-inscripción
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {PIPELINE_STEPS.map((step, idx) => {
              const count = countByStage[step.id] || 0
              const isActive = filtroEstado === step.id
              return (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {idx > 0 && (
                    <span style={{ color: 'var(--texto-muted)', fontSize: 14, flexShrink: 0 }}>→</span>
                  )}
                  <button
                    onClick={() => setFiltroEstado(isActive ? 'todos' : step.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `2px solid ${isActive ? step.color : 'var(--borde)'}`,
                      background: isActive ? step.color + '22' : 'var(--bg-3)',
                      color: isActive ? step.color : 'var(--texto)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      minWidth: 84, gap: 2, transition: 'all .15s',
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{step.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.3, textAlign: 'center', whiteSpace: 'pre-line' }}>{step.label}</span>
                    <span style={{
                      fontSize: 15, fontWeight: 700,
                      color: count > 0 ? step.color : 'var(--texto-muted)',
                    }}>{count}</span>
                  </button>
                </div>
              )
            })}
            {filtroEstado !== 'todos' && (
              <button
                onClick={() => setFiltroEstado('todos')}
                style={{ marginLeft: 8, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--borde)', background: 'transparent', color: 'var(--texto-muted)', cursor: 'pointer', fontSize: 12 }}
              >
                × Limpiar filtro
              </button>
            )}
          </div>
        </div>
      )}

      {usuario.rol !== 'alumno' && (
        <div className="filtros-bar">
          <input placeholder="Buscar nombre, folio, correo…" value={busca} onChange={e => setBusca(e.target.value)} />
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{ESTADOS_LABEL[e]}</option>)}
          </select>
        </div>
      )}

      {/* Banner: extemporáneas pendientes de autorización */}
      {extemporaneasPendientes.length > 0 && (
        <div style={{ background: 'rgba(230,126,34,.08)', border: '1.5px solid rgba(230,126,34,.35)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#e67e22', marginBottom: 10, fontSize: 14 }}>
            ⏳ {extemporaneasPendientes.length} inscripción{extemporaneasPendientes.length > 1 ? 'es' : ''} extemporánea{extemporaneasPendientes.length > 1 ? 's' : ''} pendiente{extemporaneasPendientes.length > 1 ? 's' : ''} de autorización
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {extemporaneasPendientes.map(e => (
              <div key={e.id} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, border: '1px solid rgba(230,126,34,.2)' }}>
                <div>
                  <code style={{ fontSize: 12, color: '#888' }}>{e.folio}</code>
                  <span style={{ fontWeight: 600, marginLeft: 10 }}>{e.alumno_nombre || e.nombre_externo || '—'}</span>
                  <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>· {e.grupo_codigo || e.grupo_id} · {e.plantel_nombre}</span>
                  {e.fecha_inicio_clases && (
                    <div style={{ fontSize: 11, color: '#c0392b', marginTop: 2 }}>
                      Clases iniciaron: {e.fecha_inicio_clases} · {e.motivo_extemporanea || 'Sin motivo indicado'}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button disabled={autorizandoExt === e.id}
                    onClick={() => handleAutorizarExtemporanea(e.id, 'autorizar')}
                    style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#27ae60', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    ✓ Autorizar
                  </button>
                  <button disabled={autorizandoExt === e.id}
                    onClick={() => handleAutorizarExtemporanea(e.id, 'rechazar')}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #c0392b', background: '#fff', color: '#c0392b', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    ✗ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Folio</th><th>Alumno</th><th>Plantel</th>
              <th>Estado</th><th>Grupo</th><th>Placement</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(i => (
              <tr key={i.id}>
                <td>
                  <code>{i.folio}</code>
                  {i.es_extemporanea === 1 && (
                    <span title={`Inscripción extemporánea${i.autorizado_por ? ' · Autorizada' : ' · Pendiente autorización'}`}
                      style={{ marginLeft: 6, fontSize: 11, background: i.autorizado_por ? 'rgba(39,174,96,.15)' : 'rgba(230,126,34,.15)', color: i.autorizado_por ? '#27ae60' : '#e67e22', borderRadius: 10, padding: '1px 6px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {i.autorizado_por ? '⏰ Ext. ✓' : '⏰ Ext. ⏳'}
                    </span>
                  )}
                </td>
                <td>
                  <div>{nombre(i)}</div>
                  <div className="texto-muted chico">{i.email_externo || ''}</div>
                </td>
                <td>{nomPlantel(i.plantel_id)}</td>
                <td>
                  {puedeGestionar
                    ? <select className={'select-estado e-' + i.estado} value={i.estado}
                        onChange={e => cambiarEstado(i.id, e.target.value)}>
                        {[...ESTADOS, 'pendiente_autorizacion'].map(e => <option key={e} value={e}>{ESTADOS_LABEL[e] || e}</option>)}
                      </select>
                    : <span className={'badge ' + i.estado}>{ESTADOS_LABEL[i.estado] || i.estado}</span>
                  }
                </td>
                <td>{nomGrupo(i.grupo_id)}</td>
                <td>{nomNivel(i.placement_nivel)}</td>
                <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button className="btn-mini" onClick={() => setSel(i)}>Ver</button>
                  {puedeGestionar && NEXT_ESTADO[i.estado] && (
                    <button className="btn-mini" title={`Avanzar a: ${ESTADOS_LABEL[NEXT_ESTADO[i.estado]]}`}
                      onClick={() => avanzarEtapa(i.id, i.estado)}
                      style={{ background: 'var(--primario-suave, rgba(241,139,17,.12))', borderColor: 'var(--naranja)', color: 'var(--naranja)' }}>
                      →
                    </button>
                  )}
                  {puedeGestionar && i.es_extemporanea === 1 && i.estado === 'pendiente_autorizacion' && (
                    <>
                      <button className="btn-mini" title="Autorizar inscripción extemporánea" disabled={autorizandoExt === i.id}
                        style={{ background: '#27ae60', color: '#fff', borderColor: '#27ae60' }}
                        onClick={() => handleAutorizarExtemporanea(i.id, 'autorizar')}>✓</button>
                      <button className="btn-mini" title="Rechazar" disabled={autorizandoExt === i.id}
                        style={{ borderColor: '#c0392b', color: '#c0392b' }}
                        onClick={() => handleAutorizarExtemporanea(i.id, 'rechazar')}>✗</button>
                    </>
                  )}
                  {puedeGestionar && i.liga_pago && (
                    <button className="btn-mini" title="Enviar liga de pago Banorte al alumno"
                      style={{ background: '#1a5276', color: '#fff', borderColor: '#1a5276' }}
                      disabled={enviandoLiga === i.id}
                      onClick={() => enviarLiga(i.id)}>
                      {enviandoLiga === i.id ? '…' : '🏦 Liga'}
                    </button>
                  )}
                  {puedeRegistrarCambios && i.estado === 'asignada' && i.alumno_id && (
                    <button className="btn-mini" title="Registrar solicitud de cambio de grupo o nivel"
                      style={cambios.some(c => c.inscripcion_id === i.id && c.estado === 'pendiente')
                        ? { background: '#e67e22', color: '#fff', borderColor: '#e67e22' }
                        : {}}
                      onClick={() => {
                        const existente = cambios.find(c => c.inscripcion_id === i.id)
                        setCambioExistente(existente || null)
                        setCambioForm(existente
                          ? { tipo: existente.tipo, nivel_deseado: existente.nivel_deseado || '', horario_preferido: existente.horario_preferido || '', notas: existente.notas || '' }
                          : { tipo: 'grupo', nivel_deseado: '', horario_preferido: '', notas: '' }
                        )
                        setModalCambio(i)
                      }}>
                      🔄{cambios.some(c => c.inscripcion_id === i.id && c.estado === 'pendiente') ? ' ⚠' : ''}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={7} className="tabla-vacio">Sin inscripciones.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear */}
      {modal === 'crear' && (
        <Modal titulo="Nueva inscripción" onClose={() => setModal(null)}>
          <label>Alumno registrado (opcional)
            <select value={form.alumno_id || ''} onChange={e => {
              const alumno = usuarios.find(u => u.id === e.target.value)
              setForm({ ...form, alumno_id: e.target.value || null, nombre_externo: alumno ? alumno.nombre : form.nombre_externo })
            }}>
              <option value="">— Prospecto externo —</option>
              {usuarios.filter(u => u.rol === 'alumno').map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </label>
          {!form.alumno_id && (
            <>
              <label>Nombre completo *
                <input value={form.nombre_externo} onChange={e => setForm({ ...form, nombre_externo: e.target.value })} />
              </label>
              <label>Correo electrónico
                <input type="email" value={form.email_externo} onChange={e => setForm({ ...form, email_externo: e.target.value })} />
              </label>
              <label>Teléfono / WhatsApp
                <input value={form.tel_externo} onChange={e => setForm({ ...form, tel_externo: e.target.value })} />
              </label>
            </>
          )}
          <label>Plantel
            <select value={form.plantel_id} onChange={e => setForm({ ...form, plantel_id: e.target.value })}>
              {planteles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          {formErr && <p style={{ color: 'var(--rojo)', fontSize: 13, marginTop: 8 }}>{formErr}</p>}
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={async () => {
              if (!form.alumno_id && !form.nombre_externo?.trim()) { setFormErr('El nombre es requerido.'); return }
              try {
                const resultado = await api.crearInscripcion({ ...form, estado: 'nueva' })
                setModal(null)
                await cargar()
                if (resultado.nivel_sugerido) {
                  setNivelSugerido({ inscId: resultado.id, nombre: resultado.nivel_sugerido.nombre, nivelId: resultado.nivel_sugerido.id })
                }
              } catch (e) {
                setFormErr('Error: ' + e.message)
              }
            }}>Crear</button>
          </div>
        </Modal>
      )}

      {nivelSugerido && (
        <Modal titulo="Nivel detectado automáticamente" onClose={() => setNivelSugerido(null)}>
          <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
            Este alumno completó un nivel anterior. El sistema sugiere asignarle:
          </p>
          <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '12px 16px', fontWeight: 700, fontSize: 16, marginBottom: 20, textAlign: 'center', color: 'var(--naranja)' }}>
            {nivelSugerido.nombre}
          </div>
          <p style={{ fontSize: 13, color: 'var(--texto-muted)', marginBottom: 20 }}>
            ¿Confirmas asignar este nivel de colocación? Puedes cambiarlo después en el detalle de la inscripción.
          </p>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setNivelSugerido(null)}>Omitir</button>
            <button className="btn-primario" onClick={async () => {
              try {
                await api.actualizarInscripcion(nivelSugerido.inscId, { placement_nivel: nivelSugerido.nivelId })
                setNivelSugerido(null)
                await cargar()
              } catch (e) { alert('Error: ' + e.message) }
            }}>Confirmar nivel</button>
          </div>
        </Modal>
      )}

      {/* Modal importar CSV de Google Forms */}
      {modal === 'importar' && (
        <Modal titulo="Importar respuestas de Google Forms" onClose={cerrarImportar} ancho={680}>
          {csvFilas.length === 0 ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--texto-muted)', background: 'var(--bg-3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, lineHeight: 1.8 }}>
                <strong style={{ color: 'var(--texto)' }}>¿Cómo exportar de Google Forms?</strong>
                <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                  <li>Abre tu Google Form → pestaña <strong>Respuestas</strong> → ícono de Google Sheets</li>
                  <li>En el Sheet: <strong>Ctrl+A</strong> para seleccionar todo, <strong>Ctrl+C</strong> para copiar</li>
                  <li>Pega aquí con <strong>Ctrl+V</strong></li>
                </ol>
              </div>
              <label>Datos del formulario (pegar aquí)
                <textarea
                  value={csvTexto}
                  onChange={e => { setCsvTexto(e.target.value); setCsvErr('') }}
                  rows={7}
                  placeholder={'Marca temporal\tNombre completo\tCorreo electrónico\tTeléfono\n31/07/2026 10:00\tMaría García\tmaria@correo.com\t8112345678'}
                  style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                />
              </label>
              {csvErr && <p style={{ color: 'var(--rojo)', fontSize: 13, margin: '6px 0 0' }}>{csvErr}</p>}
              <div className="modal-acciones">
                <button className="btn-sec" onClick={cerrarImportar}>Cancelar</button>
                <button className="btn-primario" onClick={analizarCSV}>Analizar →</button>
              </div>
            </>
          ) : (() => {
            const nuevas  = csvFilas.filter(f => !f.email || !emailsExistentes.has(f.email.toLowerCase()))
            const dups    = csvFilas.filter(f =>  f.email &&  emailsExistentes.has(f.email.toLowerCase()))
            return (
              <>
                <div style={{ marginBottom: 12, fontSize: 14 }}>
                  Se encontraron <strong>{csvFilas.length}</strong> filas —{' '}
                  <strong style={{ color: 'var(--verde)' }}>{nuevas.length} nuevas</strong>
                  {dups.length > 0 && (
                    <span style={{ color: 'var(--texto-muted)' }}>, {dups.length} duplicada{dups.length !== 1 ? 's' : ''} (se omitirán)</span>
                  )}
                </div>
                <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--borde)', borderRadius: 8, marginBottom: 16 }}>
                  <table className="tabla" style={{ fontSize: 12 }}>
                    <thead>
                      <tr><th>#</th><th>Nombre</th><th>Correo</th><th>Teléfono</th><th></th></tr>
                    </thead>
                    <tbody>
                      {csvFilas.map((f, i) => {
                        const dup = f.email && emailsExistentes.has(f.email.toLowerCase())
                        return (
                          <tr key={i} style={{ opacity: dup ? 0.45 : 1 }}>
                            <td style={{ color: 'var(--texto-muted)' }}>{f.num}</td>
                            <td>{f.nombre || '—'}</td>
                            <td>{f.email || '—'}</td>
                            <td>{f.tel || '—'}</td>
                            <td>{dup && <span className="badge baja" style={{ fontSize: 10, padding: '1px 6px' }}>dup</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="modal-acciones">
                  <button className="btn-sec" onClick={() => setCsvFilas([])}>← Volver</button>
                  <button
                    className="btn-primario"
                    disabled={nuevas.length === 0}
                    onClick={importarCSV}
                  >
                    Importar {nuevas.length} {nuevas.length !== 1 ? 'inscripciones' : 'inscripción'}
                  </button>
                </div>
              </>
            )
          })()}
        </Modal>
      )}

      {/* Detalle */}
      {sel && (
        <Modal titulo={`Inscripción ${sel.folio}`} onClose={() => setSel(null)} ancho={620}>
          <div className="detalle-grid">
            <div><label>Alumno</label><p>{nombre(sel)}</p></div>
            <div><label>Correo</label><p>{sel.email_externo || '—'}</p></div>
            <div><label>Teléfono</label><p>{sel.tel_externo || '—'}</p></div>
            <div><label>Estado</label><p>
              <span className={'badge ' + sel.estado}>{ESTADOS_LABEL[sel.estado] || sel.estado}</span>
              {sel.estado === 'espera' && sel.posicion_espera && (
                <span style={{ marginLeft: 8, fontSize: 13, color: '#b45309' }}>Posición #{sel.posicion_espera}</span>
              )}
            </p></div>
            <div><label>Grupo asignado</label><p>{nomGrupo(sel.grupo_id)}</p></div>
            <div><label>Nivel placement</label><p>{nomNivel(sel.placement_nivel)}</p></div>
            {sel.grupo_sugerido_id && (
              <div style={{ gridColumn: '1/-1' }}>
                <label>Grupo sugerido por el sistema</label>
                <p className="alerta info">
                  Se sugirió el grupo <strong>{nomGrupo(sel.grupo_sugerido_id)}</strong>.
                  {tienePermiso(P.INSC_CONFIRMAR) && (
                    <span className="acciones-inline">
                      <button className="btn-primario mini" onClick={() => confirmarSugerencia(sel)}>Confirmar</button>
                      <button className="btn-sec mini" onClick={() => rechazarSugerencia(sel)}>Rechazar</button>
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          {puedeGestionar && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>Liga de pago Banorte</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  placeholder="https://... (pegar liga generada en Banorte)"
                  defaultValue={sel.liga_pago || ''}
                  id={`liga-input-${sel.id}`}
                  style={{ flex: 1 }}
                />
                <button className="btn-primario" style={{ background: '#1a5276', borderColor: '#1a5276', whiteSpace: 'nowrap' }}
                  onClick={async () => {
                    const url = document.getElementById(`liga-input-${sel.id}`)?.value?.trim() || null
                    try {
                      await api.actualizarInscripcion(sel.id, { liga_pago: url })
                      setSel(s => ({ ...s, liga_pago: url }))
                      await cargar()
                    } catch (e) { alert('Error: ' + e.message) }
                  }}>
                  Guardar
                </button>
                {sel.liga_pago && (
                  <button className="btn-sec" title="Enviar por correo al alumno"
                    disabled={enviandoLiga === sel.id}
                    onClick={() => enviarLiga(sel.id)}>
                    {enviandoLiga === sel.id ? 'Enviando…' : '📧 Enviar'}
                  </button>
                )}
              </div>
              {sel.liga_pago && (
                <p className="texto-muted chico" style={{ marginTop: 4 }}>
                  Liga actual: <a href={sel.liga_pago} target="_blank" rel="noopener noreferrer">{sel.liga_pago}</a>
                </p>
              )}
            </div>
          )}
          {tienePermiso(P.INSC_CONFIRMAR) && !sel.grupo_sugerido_id && (
            <div>
              <h4>Asignar grupo manualmente</h4>
              <select defaultValue={sel.grupo_id || ''} onChange={async e => {
                const grupoId = e.target.value
                if (!grupoId) return
                if (!window.confirm('¿Asignar este grupo a la inscripción?')) return
                await asignarGrupo(sel.id, grupoId)
              }}>
                <option value="">Seleccionar grupo…</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.codigo}</option>)}
              </select>
            </div>
          )}
        </Modal>
      )}
      </div>
      )}

      {/* ── Modal solicitud de cambio ── */}
      {modalCambio && (
        <Modal titulo={`Cambio de grupo/nivel — ${nombre(modalCambio)}`} onClose={() => setModalCambio(null)} ancho={480}>
          {cambioExistente && (
            <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-3)', fontSize: 13 }}>
              Solicitud registrada el {cambioExistente.creado_en?.slice(0, 10)}.
              Estado actual: <strong style={{ color: { pendiente: '#e67e22', en_proceso: '#2980b9', resuelto: '#27ae60', cancelado: '#95a5a6' }[cambioExistente.estado] }}>
                {{ pendiente: 'Pendiente', en_proceso: 'En proceso', resuelto: 'Resuelto', cancelado: 'Cancelado' }[cambioExistente.estado]}
              </strong>
            </div>
          )}
          <label>Tipo de cambio
            <select value={cambioForm.tipo} onChange={e => setCambioForm({ ...cambioForm, tipo: e.target.value })}>
              <option value="grupo">Cambio de grupo / horario</option>
              <option value="nivel">Cambio de nivel</option>
            </select>
          </label>
          <label>Nivel deseado <span style={{ fontWeight: 400, fontSize: 11 }}>(opcional)</span>
            <input value={cambioForm.nivel_deseado} onChange={e => setCambioForm({ ...cambioForm, nivel_deseado: e.target.value })} placeholder="Ej. Inglés Intermedio 2" />
          </label>
          <label>Horario preferido <span style={{ fontWeight: 400, fontSize: 11 }}>(opcional)</span>
            <input value={cambioForm.horario_preferido} onChange={e => setCambioForm({ ...cambioForm, horario_preferido: e.target.value })} placeholder="Ej. Lunes y miércoles 7pm" />
          </label>
          <label>Notas <span style={{ fontWeight: 400, fontSize: 11 }}>(opcional)</span>
            <textarea rows={3} value={cambioForm.notas} onChange={e => setCambioForm({ ...cambioForm, notas: e.target.value })} placeholder="Motivo o detalles adicionales…" style={{ resize: 'vertical' }} />
          </label>
          <div className="modal-acciones">
            {cambioExistente && (
              <button className="btn-sec" style={{ color: '#e74c3c', marginRight: 'auto' }}
                onClick={async () => {
                  if (!confirm('¿Cancelar esta solicitud de cambio?')) return
                  try { await api.cambiarEstadoCambio(cambioExistente.id, 'cancelado'); await cargar(); setModalCambio(null) }
                  catch (e) { alert('Error: ' + e.message) }
                }}>Cancelar solicitud</button>
            )}
            <button className="btn-sec" onClick={() => setModalCambio(null)}>Cerrar</button>
            <button className="btn-primario" disabled={guardandoCambio}
              onClick={async () => {
                setGuardandoCambio(true)
                try {
                  await api.registrarCambio({ inscripcion_id: modalCambio.id, alumno_id: modalCambio.alumno_id, ...cambioForm })
                  await cargar()
                  setModalCambio(null)
                } catch (e) { alert('Error: ' + e.message) }
                finally { setGuardandoCambio(false) }
              }}>
              {guardandoCambio ? 'Guardando…' : cambioExistente ? 'Actualizar' : 'Registrar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal grupo lleno: ¿poner en espera? ── */}
      {grupoLleno && (
        <Modal titulo="Grupo lleno" onClose={() => setGrupoLleno(null)} ancho={420}>
          <p style={{ margin: '0 0 8px' }}>
            Este grupo ya alcanzó su cupo máximo ({grupoLleno.actuales}/{grupoLleno.cupo} lugares).
          </p>
          <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 14 }}>
            ¿Deseas poner al alumno en la lista de espera? Se le asignará automáticamente si alguien se da de baja.
          </p>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setGrupoLleno(null)}>Cancelar</button>
            <button className="btn-primario" onClick={() => ponerEnEspera(grupoLleno.insId, grupoLleno.grupoId)}>
              Poner en lista de espera
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
