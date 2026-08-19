import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App.jsx'
import { ROL_PERMISOS } from '../auth.js'
import * as api from '../api.js'

const ROLES_COORDINADOR = ['director', 'profesor', 'alumno', 'admin_ventas']

const ROL_LABEL = Object.fromEntries(
  Object.entries(ROL_PERMISOS).map(([k, v]) => [k, v.label])
)
const ROL_COLOR = Object.fromEntries(
  Object.entries(ROL_PERMISOS).map(([k, v]) => [k, v.color])
)

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00')
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

const FORM_VACIO = { nombre: '', email: '', password: '', rol: '', plantel_id: '', matricula: '', fecha_nacimiento: '', estado_entidad: '', curp: '', genero_nacimiento: '' }

export default function Usuarios() {
  const { usuario } = useAuth()
  const puedeToggle = ['superadmin', 'coordinador'].includes(usuario.rol)
  const puedeCrear  = ['superadmin', 'coordinador'].includes(usuario.rol)

  const [usuarios, setUsuarios] = useState([])
  const [grupos, setGrupos] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [tutorAlumnos, setTutorAlumnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroEstatus, setFiltroEstatus] = useState('')
  const [filtroPlantel, setFiltroPlantel] = useState('')

  const [modalCrear, setModalCrear] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  async function cargar() {
    setCargando(true)
    try {
      const canSeeTutorAlumnos = ['superadmin', 'coordinador', 'director'].includes(usuario.rol)
      const [u, g, ins, p, ta] = await Promise.all([
        api.getUsuarios(),
        api.getGrupos(),
        api.getInscripciones(),
        api.getPlanteles(),
        canSeeTutorAlumnos ? api.getTutorAlumnos() : Promise.resolve([]),
      ])
      setUsuarios(u)
      setGrupos(g)
      setInscripciones(ins)
      setPlanteles(p)
      setTutorAlumnos(ta)
    } catch (e) {
      console.error('Error cargando usuarios:', e)
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  function gruposDeUsuario(u) {
    if (u.rol === 'alumno' || u.rol === 'tutor') {
      const ids = inscripciones
        .filter(i => i.alumno_id === u.id && i.estado !== 'baja')
        .map(i => i.grupo_id)
      return grupos
        .filter(g => ids.includes(g.id))
        .map(g => g.codigo)
    }
    if (u.rol === 'profesor') {
      return grupos
        .filter(g => g.profesor_id === u.id)
        .map(g => g.codigo)
    }
    return []
  }

  function nombrePlantel(id) {
    return planteles.find(p => p.id === id)?.nombre || id || '—'
  }

  function alumnosDelTutor(tutorId) {
    const ids = tutorAlumnos.filter(ta => ta.tutor_id === tutorId).map(ta => ta.alumno_id)
    return usuarios.filter(u => ids.includes(u.id))
  }

  async function toggleActivo(u) {
    if (!puedeToggle) return
    setToggling(u.id)
    try {
      await api.actualizarUsuario(u.id, { activo: !u.activo })
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setToggling(null)
  }

  async function submitCrear(e) {
    e.preventDefault()
    setErrorForm('')
    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim() || !form.rol) {
      return setErrorForm('Nombre, correo, contraseña y rol son requeridos.')
    }
    setGuardando(true)
    try {
      await api.crearUsuario({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        rol: form.rol,
        plantel_id: form.plantel_id || null,
        matricula: form.matricula || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        estado_entidad: form.estado_entidad || null,
        curp: form.curp || null,
        genero_nacimiento: form.genero_nacimiento || null,
      })
      setModalCrear(false)
      setForm(FORM_VACIO)
      await cargar()
    } catch (err) {
      setErrorForm(err.message || 'Error al crear usuario')
    }
    setGuardando(false)
  }

  const rolesDisponibles = usuario.rol === 'superadmin'
    ? Object.keys(ROL_PERMISOS)
    : ROLES_COORDINADOR

  const rolesUnicos = [...new Set(usuarios.map(u => u.rol))].sort()

  const filtrados = usuarios.filter(u => {
    const txt = busqueda.toLowerCase()
    if (txt && !u.nombre.toLowerCase().includes(txt) && !u.email.toLowerCase().includes(txt)) return false
    if (filtroRol && u.rol !== filtroRol) return false
    if (filtroEstatus === 'activo' && !u.activo) return false
    if (filtroEstatus === 'inactivo' && u.activo) return false
    if (filtroPlantel && u.plantel_id !== filtroPlantel) return false
    return true
  })

  return (
    <div>
      <div className="page-header">
        <h2>Usuarios</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--texto-muted)' }}>
            {filtrados.length} {filtrados.length === 1 ? 'usuario' : 'usuarios'}
          </span>
          {puedeCrear && (
            <button className="btn-primario" onClick={() => { setForm(FORM_VACIO); setErrorForm(''); setModalCrear(true) }}>
              + Nuevo usuario
            </button>
          )}
        </div>
      </div>

      {/* Modal crear usuario */}
      {modalCrear && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={e => e.target === e.currentTarget && setModalCrear(false)}>
          <div style={{
            background: 'var(--bg-2)', borderRadius: 14, padding: '28px 32px',
            width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,.25)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ marginBottom: 20 }}>Nuevo usuario</h3>
            <form onSubmit={submitCrear} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Nombre completo *</label>
                <input autoComplete="off" className="input-busqueda" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Correo electrónico *</label>
                <input autoComplete="off" className="input-busqueda" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Contraseña *</label>
                <input autoComplete="new-password" className="input-busqueda" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Rol *</label>
                <select className="select-filtro" value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Selecciona un rol…</option>
                  {rolesDisponibles.map(r => (
                    <option key={r} value={r}>{ROL_PERMISOS[r]?.label || r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Plantel</label>
                <select className="select-filtro" value={form.plantel_id} onChange={e => setForm(f => ({ ...f, plantel_id: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Sin plantel</option>
                  {planteles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Matrícula</label>
                <input className="input-busqueda" value={form.matricula} onChange={e => setForm(f => ({ ...f, matricula: e.target.value }))} placeholder="Opcional" style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Fecha de nacimiento</label>
                  <input className="input-busqueda" type="date" value={form.fecha_nacimiento} onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Estado</label>
                  <input className="input-busqueda" value={form.estado_entidad} onChange={e => setForm(f => ({ ...f, estado_entidad: e.target.value }))} placeholder="Nuevo León" style={{ width: '100%' }} />
                </div>
              </div>

              {form.rol === 'alumno' && (
                <>
                  <div style={{ borderTop: '1px solid var(--borde)', paddingTop: 12, marginTop: 2 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--naranja)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
                      Datos del alumno
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>CURP</label>
                        <input autoComplete="off" className="input-busqueda" value={form.curp} onChange={e => setForm(f => ({ ...f, curp: e.target.value.toUpperCase() }))} placeholder="CURP de 18 caracteres" maxLength={18} style={{ width: '100%', textTransform: 'uppercase' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Género de nacimiento</label>
                        <select className="select-filtro" value={form.genero_nacimiento} onChange={e => setForm(f => ({ ...f, genero_nacimiento: e.target.value }))} style={{ width: '100%' }}>
                          <option value="">Selecciona…</option>
                          <option value="M">Masculino</option>
                          <option value="F">Femenino</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {errorForm && <div style={{ color: '#e74c3c', fontSize: 13, background: 'rgba(231,76,60,.08)', padding: '8px 12px', borderRadius: 8 }}>{errorForm}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn-mini" onClick={() => setModalCrear(false)}>Cancelar</button>
                <button type="submit" className="btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Crear usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <input
          className="input-busqueda"
          type="text"
          placeholder="Buscar por nombre o correo…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          className="select-filtro"
          value={filtroRol}
          onChange={e => setFiltroRol(e.target.value)}
        >
          <option value="">Todos los roles</option>
          {rolesUnicos.map(r => (
            <option key={r} value={r}>{ROL_LABEL[r] || r}</option>
          ))}
        </select>
        <select
          className="select-filtro"
          value={filtroEstatus}
          onChange={e => setFiltroEstatus(e.target.value)}
        >
          <option value="">Todos los estatus</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
        {usuario.rol === 'superadmin' && (
          <select
            className="select-filtro"
            value={filtroPlantel}
            onChange={e => setFiltroPlantel(e.target.value)}
          >
            <option value="">Todos los planteles</option>
            {planteles.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {cargando ? (
        <div className="tabla-wrap" style={{ padding: 40, textAlign: 'center', color: 'var(--texto-muted)' }}>
          Cargando…
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Plantel</th>
                <th>Grupo(s)</th>
                <th>Creado</th>
                <th>Estatus</th>
                {puedeToggle && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.flatMap(u => {
                const gs = gruposDeUsuario(u)
                const color = ROL_COLOR[u.rol] || '#888'
                const menores = u.rol === 'tutor' ? alumnosDelTutor(u.id) : []

                const filaUsuario = (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--texto-muted)' }}>#{u.id}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{u.email}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                        background: color + '22', color,
                      }}>
                        {ROL_LABEL[u.rol] || u.rol}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{nombrePlantel(u.plantel_id)}</td>
                    <td style={{ fontSize: 12 }}>
                      {gs.length === 0
                        ? <span style={{ color: 'var(--texto-muted)' }}>—</span>
                        : gs.map(c => (
                          <span key={c} style={{
                            display: 'inline-block', marginRight: 4, marginBottom: 2,
                            padding: '1px 7px', borderRadius: 6,
                            background: 'var(--bg-3, #f5f5f5)', fontSize: 11, fontWeight: 600,
                          }}>{c}</span>
                        ))
                      }
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtFecha(u.created_at)}</td>
                    <td>
                      <span className={'badge ' + (u.activo ? 'asignada' : 'baja')}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {puedeToggle && (
                      <td>
                        <button
                          className="btn-mini"
                          disabled={toggling === u.id || u.id === usuario.id}
                          title={u.id === usuario.id ? 'No puedes modificar tu propia cuenta' : ''}
                          style={u.activo
                            ? { color: '#e74c3c', borderColor: 'rgba(231,76,60,.4)' }
                            : { color: '#27ae60', borderColor: 'rgba(39,174,96,.4)' }
                          }
                          onClick={() => {
                            if (window.confirm(`¿${u.activo ? 'Deshabilitar' : 'Habilitar'} a ${u.nombre}?`)) toggleActivo(u)
                          }}
                        >
                          {toggling === u.id ? '…' : u.activo ? 'Deshabilitar' : 'Habilitar'}
                        </button>
                      </td>
                    )}
                  </tr>
                )

                if (menores.length === 0) return [filaUsuario]

                const filaMenores = (
                  <tr key={u.id + '_menores'} style={{ background: 'rgba(241,139,17,0.04)' }}>
                    <td colSpan={puedeToggle ? 8 : 7} style={{ paddingLeft: 32, paddingTop: 4, paddingBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--naranja)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                        👦 Menor(es) asociado(s)
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {menores.map(m => {
                          const mGs = gruposDeUsuario(m)
                          return (
                            <div key={m.id} style={{
                              background: 'var(--bg-2)', border: '1px solid var(--borde)',
                              borderRadius: 8, padding: '6px 12px', fontSize: 12,
                            }}>
                              <div style={{ fontWeight: 600 }}>{m.nombre}</div>
                              <div style={{ color: 'var(--texto-muted)', fontSize: 11 }}>{m.email}</div>
                              {mGs.length > 0 && (
                                <div style={{ marginTop: 3 }}>
                                  {mGs.map(c => (
                                    <span key={c} style={{
                                      display: 'inline-block', marginRight: 3,
                                      padding: '1px 6px', borderRadius: 4,
                                      background: 'var(--bg-3)', fontSize: 10, fontWeight: 600,
                                    }}>{c}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )

                return [filaUsuario, filaMenores]
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={puedeToggle ? 8 : 7} className="tabla-vacio">
                    Sin usuarios con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
