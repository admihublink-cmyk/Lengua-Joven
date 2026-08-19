import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'
import { ROL_PERMISOS } from '../auth.js'

const ROLES_PROFESOR = ['alumno', 'profesor']
const ROLES_INSTITUCION = ['director', 'maestro', 'profesor', 'alumno', 'admin_ventas']
const ROLES_ADMIN = Object.entries(ROL_PERMISOS).map(([k, v]) => ({ value: k, label: v.label }))

export default function Configuracion() {
  const { usuario, tienePermiso } = useAuth()
  const [config, setConfig] = useState({})
  const [usuarios, setUsuarios] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [modalUser, setModalUser] = useState(null)
  const [formUser, setFormUser] = useState({})
  const [guardado, setGuardado] = useState(false)
  const [filtroRol, setFiltroRol] = useState('todos')
  const [busca, setBusca] = useState('')
  const [plantelesCoordi, setPlantelesCoordi] = useState([])  // planteles asignados al coordinador en edición

  const esAdmin = tienePermiso(P.CONFIG_SISTEMA)
  const esCoordinador = usuario.rol === 'coordinador'
  const puedeGestionarUsuarios = tienePermiso(P.USUARIOS_GESTIONAR)
  const puedeGestionarPeriodos = tienePermiso(P.CONVENIO_GESTIONAR) || esAdmin

  // Estado para períodos de inscripción
  const [idiomas, setIdiomas] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [modalPeriodo, setModalPeriodo] = useState(null) // null | 'crear' | objeto
  const [formPer, setFormPer] = useState({})
  const [precios, setPrecios] = useState([])
  const [formPrecio, setFormPrecio] = useState({ plantel_id: '', idioma_id: '', categoria: '', monto: '' })

  async function cargar() {
    try {
      const [cfg, p, prov, u, ids, prec] = await Promise.all([
        api.getConfig(),
        api.getPlanteles(),
        api.getProveedoresOferta(),
        api.getUsuarios(),
        api.getIdiomas(),
        api.getPrecios(),
      ])
      setConfig(cfg)
      setPlanteles(p)
      setProveedores(prov)
      setUsuarios(u)
      setIdiomas(ids)
      setPrecios(prec)
    } catch (e) {
      console.error('Error cargando configuración:', e)
    }
  }

  async function cargarPeriodos() {
    try {
      const data = await api.getPeriodos()
      setPeriodos(data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => { cargar(); cargarPeriodos() }, [])

  async function guardarConfig() {
    try {
      await api.actualizarConfig(config)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2000)
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  async function guardarUsuario() {
    if (!formUser.nombre || !formUser.email || !formUser.rol) return alert('Nombre, correo y rol son requeridos.')
    if (!esAdmin && !ROLES_PROFESOR.includes(formUser.rol)) {
      return alert('Solo puedes asignar los roles: Alumno o Profesor.')
    }
    try {
      let userId
      if (modalUser === 'crear') {
        if (!formUser.password) return alert('La contraseña es requerida para usuarios nuevos.')
        const nuevo = { ...formUser }
        if (!esAdmin) nuevo.plantel_id = usuario.plantel_id
        if (nuevo.rol === 'coordinador') nuevo.plantel_id = null
        const creado = await api.crearUsuario(nuevo)
        userId = creado.id
      } else {
        const upd = { ...formUser }
        if (!upd.password) delete upd.password
        if (!esAdmin) upd.plantel_id = usuario.plantel_id
        if (upd.rol === 'coordinador') upd.plantel_id = null
        await api.actualizarUsuario(upd.id, upd)
        userId = upd.id
      }
      // Para coordinadores, guardar planteles asignados
      if (formUser.rol === 'coordinador' && esAdmin) {
        await api.setPlantelessCoordinador(userId, plantelesCoordi)
      }
      setModalUser(null)
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  async function guardarPeriodo() {
    if (!formPer.plantel_id) return alert('Selecciona un plantel.')
    try {
      if (modalPeriodo === 'crear') {
        await api.crearPeriodo(formPer)
      } else {
        await api.actualizarPeriodo(modalPeriodo.id, formPer)
      }
      setModalPeriodo(null)
      await cargarPeriodos()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  async function eliminarPeriodo(id) {
    if (!confirm('¿Eliminar este período?')) return
    await api.eliminarPeriodo(id)
    await cargarPeriodos()
  }

  function nomPlantel(id) { return planteles.find(p => p.id === id)?.nombre || id }
  function nomIdioma(id) { return idiomas.find(i => i.id === id)?.nombre || 'Todos los idiomas' }
  function fmtFecha(iso) {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-')
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`
  }

  // Períodos que puede ver/editar según su rol
  const periodosVisibles = esAdmin
    ? periodos
    : esCoordinador
      ? periodos.filter(p => (usuario.planteles || []).includes(p.plantel_id))
      : periodos.filter(p => p.plantel_id === usuario.plantel_id)

  // Planteles que puede gestionar
  const plantelesGestionables = esAdmin
    ? planteles
    : esCoordinador
      ? planteles.filter(p => (usuario.planteles || []).includes(p.id))
      : planteles.filter(p => p.id === usuario.plantel_id)

  const ROLES_DISPONIBLES = esAdmin
    ? ROLES_ADMIN
    : esCoordinador
      ? ROLES_INSTITUCION.map(k => ({ value: k, label: ROL_PERMISOS[k]?.label || k }))
      : ROLES_PROFESOR.map(k => ({ value: k, label: ROL_PERMISOS[k].label }))

  const usuariosVisibles = esAdmin
    ? usuarios
    : esCoordinador
      ? usuarios  // backend ya filtra por planteles asignados
      : usuarios.filter(u => ROLES_PROFESOR.includes(u.rol))

  const usuariosFiltrados = usuariosVisibles.filter(u => {
    if (filtroRol !== 'todos' && u.rol !== filtroRol) return false
    if (!busca) return true
    return [u.nombre, u.email].some(v => (v || '').toLowerCase().includes(busca.toLowerCase()))
  })

  return (
    <div>
      <div className="page-header">
        <h2>{esAdmin ? 'Configuración del sistema' : 'Gestión de usuarios'}</h2>
      </div>

      <div className="dash-grid">
        {esAdmin && (
          <div className="card">
            <h3>Configuración general</h3>
            <label>Nombre del sistema
              <input value={config.nombre_sistema || ''} onChange={e => setConfig({ ...config, nombre_sistema: e.target.value })} />
            </label>
            <label>Correo de soporte
              <input type="email" value={config.correo_soporte || ''} onChange={e => setConfig({ ...config, correo_soporte: e.target.value })} />
            </label>
            <label>Ciclo activo
              <input value={config.ciclo_activo || ''} onChange={e => setConfig({ ...config, ciclo_activo: e.target.value })} />
            </label>
            <label>Costo de inscripción ($)
              <input type="number" value={config.costo_inscripcion || 0} onChange={e => setConfig({ ...config, costo_inscripcion: Number(e.target.value) })} />
            </label>
            <label>Días de gracia para pago
              <input type="number" value={config.dias_gracia_pago || 0} onChange={e => setConfig({ ...config, dias_gracia_pago: Number(e.target.value) })} />
            </label>
            <label>Liga de pago Banorte (URL)
              <input type="url" value={config.liga_pago_url || ''} onChange={e => setConfig({ ...config, liga_pago_url: e.target.value })} placeholder="https://..." />
            </label>
            <button className="btn-primario" onClick={guardarConfig}>
              {guardado ? '✓ Guardado' : 'Guardar configuración'}
            </button>
          </div>
        )}

        {puedeGestionarUsuarios && (
          <div className="card" style={{ gridColumn: esAdmin ? 'auto' : '1/-1' }}>
            <div className="card-head-row">
              <h3>Usuarios {!esAdmin && `— ${planteles.find(p => p.id === usuario.plantel_id)?.nombre || ''}`}</h3>
              <button className="btn-mini" onClick={() => {
                setFormUser({ nombre: '', email: '', rol: 'alumno', plantel_id: usuario.plantel_id || '', password: '', activo: true, matricula: '', fecha_nacimiento: '', estado_entidad: '' })
                setPlantelesCoordi([])
                setModalUser('crear')
              }}>+ Usuario</button>
            </div>

            <div className="filtros-bar" style={{ marginBottom: 12 }}>
              <input placeholder="Buscar nombre o correo…" value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: 1 }} />
              <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
                <option value="todos">Todos los roles</option>
                {ROLES_DISPONIBLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div className="tabla-wrap">
              <table className="tabla chica">
                <thead>
                  <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map(u => (
                    <tr key={u.id}>
                      <td>{u.nombre}</td>
                      <td className="texto-muted chico">{u.email}</td>
                      <td>
                        <span className="badge validada" style={{ background: ROL_PERMISOS[u.rol]?.color + '22', color: ROL_PERMISOS[u.rol]?.color }}>
                          {ROL_PERMISOS[u.rol]?.label || u.rol}
                        </span>
                      </td>
                      <td>
                        <span className={'badge ' + (u.activo ? 'asignada' : 'baja')}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                      </td>
                      <td>
                        <button className="btn-mini" onClick={async () => {
                          setFormUser({ ...u, password: '' })
                          if (u.rol === 'coordinador') {
                            try {
                              const pids = await api.getPlantelessCoordinador(u.id)
                              setPlantelesCoordi(pids)
                            } catch { setPlantelesCoordi([]) }
                          } else {
                            setPlantelesCoordi([])
                          }
                          setModalUser('editar')
                        }}>Editar</button>
                      </td>
                    </tr>
                  ))}
                  {usuariosFiltrados.length === 0 && (
                    <tr><td colSpan={5} className="tabla-vacio">Sin usuarios.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modalUser && (
        <Modal titulo={modalUser === 'crear' ? 'Nuevo usuario' : 'Editar usuario'} onClose={() => setModalUser(null)}>
          <div className="form-grid">
            <label style={{ gridColumn: '1/-1' }}>Nombre completo *
              <input value={formUser.nombre || ''} onChange={e => setFormUser({ ...formUser, nombre: e.target.value })} />
            </label>
            <label>Correo electrónico *
              <input type="email" value={formUser.email || ''} onChange={e => setFormUser({ ...formUser, email: e.target.value })} />
            </label>
            <label>{modalUser === 'crear' ? 'Contraseña *' : 'Nueva contraseña (vacío = sin cambiar)'}
              <input type="password" value={formUser.password || ''} onChange={e => setFormUser({ ...formUser, password: e.target.value })} />
            </label>
            <label>Rol *
              <select value={formUser.rol || ''} onChange={e => setFormUser({ ...formUser, rol: e.target.value })}>
                <option value="">Seleccionar…</option>
                {ROLES_DISPONIBLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            {esAdmin && formUser.rol === 'coordinador' && (
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>Planteles asignados</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', border: '1px solid var(--borde)', borderRadius: 8, background: 'var(--bg-3)' }}>
                  {planteles.length === 0 && <span className="texto-muted">No hay planteles registrados.</span>}
                  {planteles.map(p => (
                    <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                      <input type="checkbox"
                        checked={plantelesCoordi.includes(p.id)}
                        onChange={e => setPlantelesCoordi(prev =>
                          e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                        )}
                      />
                      {p.nombre} <span className="texto-muted" style={{ fontSize: 12 }}>({p.ciudad})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {(esAdmin || esCoordinador) && formUser.rol !== 'coordinador' && (
              <label>Plantel
                <select value={formUser.plantel_id || ''} onChange={e => setFormUser({ ...formUser, plantel_id: e.target.value })}>
                  {esAdmin && <option value="">Sin plantel (global)</option>}
                  {planteles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
            )}
            {esAdmin && (
              <label>Escuela socia (Oferta Educativa)
                <select value={formUser.proveedor || ''} onChange={e => setFormUser({ ...formUser, proveedor: e.target.value || null })}>
                  <option value="">Todas (sin restricción)</option>
                  {(Array.isArray(proveedores) ? proveedores : []).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            )}
            <label>Estado
              <select value={formUser.activo ? 'true' : 'false'} onChange={e => setFormUser({ ...formUser, activo: e.target.value === 'true' })}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
            {formUser.rol === 'alumno' && (
              <>
                <label>No. Matrícula
                  <input value={formUser.matricula || ''} onChange={e => setFormUser({ ...formUser, matricula: e.target.value })} placeholder="INJUVE-2026-XXX" />
                </label>
                <label>Fecha de nacimiento
                  <input type="date" value={formUser.fecha_nacimiento || ''} onChange={e => setFormUser({ ...formUser, fecha_nacimiento: e.target.value })} />
                </label>
                <label style={{ gridColumn: '1/-1' }}>Estado / Entidad
                  <input value={formUser.estado_entidad || ''} onChange={e => setFormUser({ ...formUser, estado_entidad: e.target.value })} placeholder="Ej. Nuevo León" />
                </label>
              </>
            )}
          </div>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModalUser(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardarUsuario}>Guardar</button>
          </div>
        </Modal>
      )}

      {/* ── Precios por plantel e idioma ── */}
      {esAdmin && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>Precios por plantel e idioma</h3>
          <p className="texto-muted chico" style={{ marginBottom: 16 }}>
            El CSV de Banorte usa estos montos automáticamente. Si un alumno no tiene precio configurado, se usa el costo de inscripción global.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ flex: 1, minWidth: 140 }}>Plantel
              <select value={formPrecio.plantel_id} onChange={e => setFormPrecio({ ...formPrecio, plantel_id: e.target.value, idioma_id: '' })}>
                <option value="">Seleccionar…</option>
                {planteles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 130 }}>Idioma
              <select value={formPrecio.idioma_id} onChange={e => setFormPrecio({ ...formPrecio, idioma_id: e.target.value })}
                disabled={!formPrecio.plantel_id}>
                <option value="">Seleccionar…</option>
                {idiomas.filter(i => i.plantel_id === formPrecio.plantel_id).map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </label>
            <label style={{ minWidth: 120 }}>Categoría
              <select value={formPrecio.categoria} onChange={e => setFormPrecio({ ...formPrecio, categoria: e.target.value })}>
                <option value="">General (todas)</option>
                <option value="teens">Teens</option>
                <option value="jóvenes">Jóvenes</option>
                <option value="plus">Plus</option>
              </select>
            </label>
            <label style={{ width: 120 }}>Monto ($)
              <input type="number" min="0" value={formPrecio.monto}
                onChange={e => setFormPrecio({ ...formPrecio, monto: e.target.value })} />
            </label>
            <button className="btn-primario" style={{ marginBottom: 1 }} onClick={async () => {
              if (!formPrecio.plantel_id || !formPrecio.idioma_id || !formPrecio.monto) return alert('Selecciona plantel, idioma y monto.')
              try {
                await api.upsertPrecio(formPrecio)
                setFormPrecio({ plantel_id: '', idioma_id: '', categoria: '', monto: '' })
                await cargar()
              } catch (e) { alert('Error: ' + e.message) }
            }}>Guardar precio</button>
          </div>

          <div className="tabla-wrap">
            <table className="tabla chica">
              <thead>
                <tr><th>Plantel</th><th>Idioma</th><th>Categoría</th><th>Monto</th><th></th></tr>
              </thead>
              <tbody>
                {precios.map(p => (
                  <tr key={`${p.plantel_id}|${p.idioma_id}|${p.categoria}`}>
                    <td>{planteles.find(pl => pl.id === p.plantel_id)?.nombre || p.plantel_id}</td>
                    <td>{idiomas.find(i => i.id === p.idioma_id)?.nombre || p.idioma_id}</td>
                    <td>{p.categoria || <span className="texto-muted">General</span>}</td>
                    <td>${(p.monto || 0).toLocaleString()}</td>
                    <td>
                      <button className="btn-mini" style={{ color: '#e74c3c' }}
                        onClick={async () => {
                          if (!confirm('¿Eliminar este precio?')) return
                          await api.eliminarPrecio(p.plantel_id, p.idioma_id, p.categoria)
                          await cargar()
                        }}>✕</button>
                    </td>
                  </tr>
                ))}
                {precios.length === 0 && (
                  <tr><td colSpan={5} className="tabla-vacio">Sin precios configurados — se usa el costo global.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Períodos de inscripción ── */}
      {puedeGestionarPeriodos && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-head-row">
            <h3>Períodos de inscripción</h3>
            <button className="btn-mini" onClick={() => {
              setFormPer({ plantel_id: plantelesGestionables[0]?.id || '', idioma_id: '', ciclo: '', inicio_prereg: '', fin_prereg: '', fecha_examen: '', fecha_asignacion: '', fecha_inicio_clases: '' })
              setModalPeriodo('crear')
            }}>+ Período</button>
          </div>
          <p className="texto-muted chico" style={{ marginBottom: 12 }}>
            Define las fechas por plantel e idioma. Si no hay examen de ubicación para un idioma, deja esa fecha vacía.
          </p>
          <div className="tabla-wrap">
            <table className="tabla chica">
              <thead>
                <tr>
                  <th>Plantel</th><th>Idioma</th><th>Ciclo</th>
                  <th>Pre-reg</th><th>Examen ubic.</th><th>Asignación</th><th>Inicio clases</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {periodosVisibles.map(p => (
                  <tr key={p.id}>
                    <td>{nomPlantel(p.plantel_id)}</td>
                    <td>{nomIdioma(p.idioma_id)}</td>
                    <td className="texto-muted chico">{p.ciclo || '—'}</td>
                    <td className="chico">{p.inicio_prereg ? `${fmtFecha(p.inicio_prereg)}${p.fin_prereg ? ' – ' + fmtFecha(p.fin_prereg) : ''}` : '—'}</td>
                    <td className="chico">{p.fecha_examen ? fmtFecha(p.fecha_examen) : <span className="badge baja">Sin examen</span>}</td>
                    <td className="chico">{fmtFecha(p.fecha_asignacion)}</td>
                    <td className="chico">{fmtFecha(p.fecha_inicio_clases)}</td>
                    <td>
                      <button className="btn-mini" onClick={() => { setFormPer({ ...p }); setModalPeriodo(p) }}>Editar</button>
                      <button className="btn-mini" style={{ marginLeft: 4, color: '#e74c3c' }} onClick={() => eliminarPeriodo(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
                {periodosVisibles.length === 0 && (
                  <tr><td colSpan={8} className="tabla-vacio">Sin períodos configurados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalPeriodo && (
        <Modal titulo={modalPeriodo === 'crear' ? 'Nuevo período' : 'Editar período'} onClose={() => setModalPeriodo(null)}>
          <div className="form-grid">
            <label>Plantel *
              <select value={formPer.plantel_id || ''} onChange={e => setFormPer({ ...formPer, plantel_id: e.target.value })}>
                <option value="">Seleccionar…</option>
                {plantelesGestionables.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label>Idioma (vacío = aplica a todos)
              <select value={formPer.idioma_id || ''} onChange={e => setFormPer({ ...formPer, idioma_id: e.target.value || null })}>
                <option value="">Todos los idiomas</option>
                {idiomas.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </label>
            <label style={{ gridColumn: '1/-1' }}>Nombre del ciclo (ej. agosto – octubre 2026)
              <input value={formPer.ciclo || ''} onChange={e => setFormPer({ ...formPer, ciclo: e.target.value })} placeholder="agosto – octubre 2026" />
            </label>
            <label>Inicio pre-registro
              <input type="date" value={formPer.inicio_prereg || ''} onChange={e => setFormPer({ ...formPer, inicio_prereg: e.target.value })} />
            </label>
            <label>Fin pre-registro
              <input type="date" value={formPer.fin_prereg || ''} onChange={e => setFormPer({ ...formPer, fin_prereg: e.target.value })} />
            </label>
            <label>Examen de ubicación (dejar vacío si no aplica)
              <input type="date" value={formPer.fecha_examen || ''} onChange={e => setFormPer({ ...formPer, fecha_examen: e.target.value })} />
            </label>
            <label>Asignación de grupo
              <input type="date" value={formPer.fecha_asignacion || ''} onChange={e => setFormPer({ ...formPer, fecha_asignacion: e.target.value })} />
            </label>
            <label>Inicio de clases
              <input type="date" value={formPer.fecha_inicio_clases || ''} onChange={e => setFormPer({ ...formPer, fecha_inicio_clases: e.target.value })} />
            </label>
          </div>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModalPeriodo(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardarPeriodo}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
