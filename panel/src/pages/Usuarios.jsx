import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { ROL_PERMISOS } from '../auth.js'
import * as api from '../api.js'

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

export default function Usuarios() {
  const { usuario } = useAuth()
  const puedeToggle = ['superadmin', 'coordinador'].includes(usuario.rol)

  const [usuarios, setUsuarios] = useState([])
  const [grupos, setGrupos] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroEstatus, setFiltroEstatus] = useState('')
  const [filtroPlantel, setFiltroPlantel] = useState('')

  async function cargar() {
    setCargando(true)
    try {
      const [u, g, ins, p] = await Promise.all([
        api.getUsuarios(),
        api.getGrupos(),
        api.getInscripciones(),
        api.getPlanteles(),
      ])
      setUsuarios(u)
      setGrupos(g)
      setInscripciones(ins)
      setPlanteles(p)
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
        <span style={{ fontSize: 13, color: 'var(--texto-muted)' }}>
          {filtrados.length} {filtrados.length === 1 ? 'usuario' : 'usuarios'}
        </span>
      </div>

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
              {filtrados.map(u => {
                const gs = gruposDeUsuario(u)
                const color = ROL_COLOR[u.rol] || '#888'
                return (
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
                          onClick={() => toggleActivo(u)}
                        >
                          {toggling === u.id ? '…' : u.activo ? 'Deshabilitar' : 'Habilitar'}
                        </button>
                      </td>
                    )}
                  </tr>
                )
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
