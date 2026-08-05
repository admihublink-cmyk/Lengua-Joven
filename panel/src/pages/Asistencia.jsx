import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'

export default function Asistencia() {
  const { usuario, tienePermiso } = useAuth()
  const [tab, setTab] = useState('presencia')

  const [grupos, setGrupos] = useState([])
  const [grupoSel, setGrupoSel] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))

  const [alumnos, setAlumnos] = useState([])
  const [asistencias, setAsistencias] = useState([])
  const [guardando, setGuardando] = useState(false)

  const [sesiones, setSesiones] = useState([])
  const [sesionSel, setSesionSel] = useState('')
  const [asistSesion, setAsistSesion] = useState([])
  const [usuarios, setUsuarios] = useState([])

  useEffect(() => {
    async function init() {
      try {
        const [g, u] = await Promise.all([api.getGrupos(), api.getUsuarios()])
        setGrupos(g)
        setUsuarios(u)
        if (g.length > 0) setGrupoSel(g[0].id)
      } catch (e) {
        console.error('Error cargando grupos:', e)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!grupoSel) return
    async function cargarGrupo() {
      try {
        const [ins, asist, ses] = await Promise.all([
          api.getInscripciones(),
          api.getAsistencias({ grupo_id: grupoSel, fecha }),
          api.getSesiones(grupoSel),
        ])
        const lista = ins
          .filter(i => i.grupo_id === grupoSel && i.estado === 'asignada')
          .map(i => {
            const u = usuarios.find(x => x.id === i.alumno_id)
            return { id: i.alumno_id, nombre: u?.nombre || i.nombre_externo || 'Sin nombre' }
          }).filter(a => a.id)
        setAlumnos(lista)
        setAsistencias(asist)
        const sesHoy = ses.filter(s => !s.fecha || s.fecha === fecha)
        setSesiones(sesHoy)
        if (sesHoy.length > 0) setSesionSel(prev => sesHoy.find(s => s.id === prev) ? prev : sesHoy[0].id)
        else setSesionSel('')
      } catch (e) {
        console.error('Error cargando datos del grupo:', e)
      }
    }
    cargarGrupo()
  }, [grupoSel, fecha, usuarios])

  useEffect(() => {
    if (!sesionSel) { setAsistSesion([]); return }
    api.getAsistenciaSesion(sesionSel).then(setAsistSesion).catch(() => setAsistSesion([]))
  }, [sesionSel])

  function getEstado(alumnoId) {
    const a = asistencias.find(x => x.alumno_id === alumnoId)
    return a ? !!a.presente : true
  }

  function toggle(alumnoId, presente) {
    const nuevo = asistencias.filter(a => a.alumno_id !== alumnoId)
    nuevo.push({ grupo_id: grupoSel, alumno_id: alumnoId, fecha, presente, registrado_por: usuario.id })
    setAsistencias(nuevo)
  }

  async function guardar() {
    setGuardando(true)
    try {
      const registros = alumnos.map(a => ({
        grupo_id: grupoSel, alumno_id: a.id, fecha,
        presente: getEstado(a.id), registrado_por: usuario.id,
      }))
      await api.registrarAsistencias(registros)
    } catch (e) {
      alert('Error al guardar: ' + e.message)
    } finally {
      setTimeout(() => setGuardando(false), 600)
    }
  }

  const grupoCfg = grupos.find(g => g.id === grupoSel)
  const puedeRegistrar = tienePermiso(P.ASIST_REGISTRAR)

  function nombreAlumno(id) {
    return usuarios.find(u => u.id === id)?.nombre || id
  }
  function fmtTime(ts) {
    if (!ts) return '—'
    return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <div className="page-header">
        <h2>Asistencia</h2>
        {tab === 'presencia' && puedeRegistrar && grupoSel && (
          <button className="btn-primario" onClick={guardar} disabled={guardando}>
            {guardando ? '✓ Guardado' : 'Guardar asistencia'}
          </button>
        )}
      </div>

      <div className="filtros-bar">
        <label>Grupo
          <select value={grupoSel} onChange={e => setGrupoSel(e.target.value)}>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.codigo}</option>)}
          </select>
        </label>
        <label>Fecha
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </label>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'presencia' ? 'activo' : ''}`} onClick={() => setTab('presencia')}>
          ✓ Presencia física
        </button>
        <button className={`tab-btn ${tab === 'sesiones' ? 'activo' : ''}`} onClick={() => setTab('sesiones')}>
          🎥 Sesiones virtuales
        </button>
      </div>

      {tab === 'presencia' && grupoSel && (
        <div className="card">
          <div className="card-head-row">
            <h3>{grupoCfg?.codigo} · {grupoCfg?.horario}</h3>
            <span className="texto-muted">{alumnos.length} alumnos</span>
          </div>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>#</th><th>Alumno</th>
                  {puedeRegistrar ? <><th>Presente</th><th>Ausente</th></> : <th>Estado</th>}
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a, i) => {
                  const presente = getEstado(a.id)
                  return (
                    <tr key={a.id} className={presente ? '' : 'fila-ausente'}>
                      <td>{i + 1}</td>
                      <td>{a.nombre}</td>
                      {puedeRegistrar ? (
                        <>
                          <td>
                            <input type="radio" name={`asist-${a.id}`} checked={presente}
                              onChange={() => toggle(a.id, true)} /> ✓
                          </td>
                          <td>
                            <input type="radio" name={`asist-${a.id}`} checked={!presente}
                              onChange={() => toggle(a.id, false)} /> ✗
                          </td>
                        </>
                      ) : (
                        <td>
                          <span className={'badge ' + (presente ? 'asignada' : 'baja')}>
                            {presente ? 'Presente' : 'Ausente'}
                          </span>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {alumnos.length === 0 && (
                  <tr><td colSpan={4} className="tabla-vacio">No hay alumnos asignados a este grupo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sesiones' && (
        <div>
          {sesiones.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--texto-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              No hay sesiones virtuales programadas para este grupo en esta fecha.
            </div>
          ) : (
            <>
              {sesiones.length > 1 && (
                <div className="filtros-bar" style={{ marginBottom: 16 }}>
                  <label>Sesión
                    <select value={sesionSel} onChange={e => setSesionSel(e.target.value)}>
                      {sesiones.map(s => (
                        <option key={s.id} value={s.id}>{s.titulo} · {s.hora_inicio}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {sesionSel && (() => {
                const sesion = sesiones.find(s => s.id === sesionSel)
                return (
                  <div className="card">
                    <div className="card-head-row">
                      <h3>
                        {sesion?.titulo}
                        <span className="texto-muted" style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
                          {sesion?.hora_inicio} – {sesion?.hora_fin}
                        </span>
                      </h3>
                      <span className="texto-muted">{asistSesion.length} registros</span>
                    </div>

                    {asistSesion.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--texto-muted)', fontSize: 14 }}>
                        Nadie ha tomado esta sesión virtual todavía.
                      </div>
                    ) : (
                      <div className="tabla-wrap">
                        <table className="tabla">
                          <thead>
                            <tr>
                              <th>#</th><th>Alumno</th><th>Entrada</th><th>Salida</th><th>Duración</th>
                            </tr>
                          </thead>
                          <tbody>
                            {asistSesion
                              .sort((a, b) => (a.joined_at || 0) - (b.joined_at || 0))
                              .map((a, i) => (
                                <tr key={a.id}>
                                  <td>{i + 1}</td>
                                  <td>{nombreAlumno(a.alumno_id)}</td>
                                  <td>{fmtTime(a.joined_at)}</td>
                                  <td>{fmtTime(a.left_at)}</td>
                                  <td>
                                    {a.duracion_min != null
                                      ? <span className="dur-badge">{a.duracion_min} min</span>
                                      : '—'}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {asistSesion.length > 0 && (() => {
                      const conDuracion = asistSesion.filter(a => a.duracion_min != null)
                      const total = conDuracion.reduce((s, a) => s + a.duracion_min, 0)
                      const prom = conDuracion.length ? Math.round(total / conDuracion.length) : 0
                      const max = conDuracion.length ? Math.max(...conDuracion.map(a => a.duracion_min)) : 0
                      return (
                        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                          <div className="metrica-card naranja" style={{ flex: 1, minWidth: 120 }}>
                            <div className="metrica-num">{asistSesion.length}</div>
                            <div className="metrica-label">Asistentes</div>
                          </div>
                          <div className="metrica-card verde" style={{ flex: 1, minWidth: 120 }}>
                            <div className="metrica-num">{prom} min</div>
                            <div className="metrica-label">Duración promedio</div>
                          </div>
                          <div className="metrica-card morado" style={{ flex: 1, minWidth: 120 }}>
                            <div className="metrica-num">{max} min</div>
                            <div className="metrica-label">Duración máxima</div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
