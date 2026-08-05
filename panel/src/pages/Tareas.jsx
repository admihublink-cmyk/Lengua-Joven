import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

const TIPOS_PERMITIDOS = '.pdf,.zip,.doc,.docx,.xls,.xlsx,.txt,.ppt,.pptx,.mp3,.mp4'
const MAX_MB = 50

function estaVencida(fecha_limite) {
  if (!fecha_limite) return false
  return new Date(fecha_limite + 'T23:59:59') < new Date()
}

function diasRestantes(fecha_limite) {
  if (!fecha_limite) return null
  const diff = new Date(fecha_limite + 'T23:59:59') - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function iconoArchivo(nombre = '') {
  const ext = nombre.split('.').pop().toLowerCase()
  if (ext === 'pdf') return '📄'
  if (['zip', 'rar'].includes(ext)) return '🗜️'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx'].includes(ext)) return '📊'
  if (['ppt', 'pptx'].includes(ext)) return '📑'
  if (['mp3', 'm4a', 'ogg'].includes(ext)) return '🎵'
  if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬'
  return '📎'
}

export default function Tareas() {
  const { usuario, tienePermiso } = useAuth()
  const [grupos, setGrupos] = useState([])
  const [grupoSel, setGrupoSel] = useState('')
  const [tareas, setTareas] = useState([])
  const [calificaciones, setCalificaciones] = useState([])
  const [entregas, setEntregas] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [tab, setTab] = useState('tareas')
  const [modal, setModal] = useState(null)
  const [selTarea, setSelTarea] = useState(null)
  const [formTarea, setFormTarea] = useState({ titulo: '', descripcion: '', fecha_limite: '', ponderacion: 10 })
  const [archivoTarea, setArchivoTarea] = useState(null) // File object
  const [formCal, setFormCal] = useState({ alumno_id: '', calificacion: '', comentario: '' })
  const [archivoEntrega, setArchivoEntrega] = useState(null) // File object
  const [tareaErr, setTareaErr] = useState('')
  const [calErr, setCalErr] = useState('')
  const [entregaErr, setEntregaErr] = useState('')
  const [cargando, setCargando] = useState(false)
  const fileInputRef = useRef(null)
  const fileInputTareaRef = useRef(null)

  const esAlumno = usuario.rol === 'alumno'

  async function cargar(gid) {
    try {
      const [todosGrupos, todasTareas] = await Promise.all([
        api.getGrupos(),
        api.getTareas(),
      ])

      let misGrupos = todosGrupos
      setGrupos(misGrupos)
      const grupoActual = gid || grupoSel || misGrupos[0]?.id || ''
      if (!grupoSel && misGrupos.length > 0) setGrupoSel(misGrupos[0].id)

      const tareasGrupo = grupoActual
        ? todasTareas.filter(t => t.grupo_id === grupoActual)
        : []
      setTareas(tareasGrupo)

      // Cargar calificaciones y entregas por cada tarea
      if (tareasGrupo.length > 0) {
        const [cals, ents] = await Promise.all([
          Promise.all(tareasGrupo.map(t => api.getCalificacionesTarea(t.id))).then(r => r.flat()),
          Promise.all(tareasGrupo.map(t => api.getEntregas(t.id))).then(r => r.flat()),
        ])
        setCalificaciones(cals)
        setEntregas(ents)
      } else {
        setCalificaciones([])
        setEntregas([])
      }

      // Alumnos del grupo (para profesor)
      if (!esAlumno && grupoActual) {
        const alums = await api.getAlumnosGrupo(grupoActual)
        setAlumnos(alums)
      }
    } catch (err) {
      console.error('Error cargando tareas:', err)
    }
  }

  useEffect(() => { cargar() }, [])
  useEffect(() => { if (grupoSel) cargar(grupoSel) }, [grupoSel])

  function calDe(tarea_id, alumno_id) {
    return calificaciones.find(c => c.tarea_id === tarea_id && c.alumno_id === alumno_id)
  }
  function miCal(tarea_id) {
    return calificaciones.find(c => c.tarea_id === tarea_id && c.alumno_id === usuario.id)
  }
  function entregaDe(tarea_id, alumno_id) {
    return entregas.find(e => e.tarea_id === tarea_id && e.alumno_id === alumno_id) || null
  }
  function miEntrega(tarea_id) {
    return entregas.find(e => e.tarea_id === tarea_id && e.alumno_id === usuario.id) || null
  }

  async function guardarTarea() {
    setTareaErr('')
    if (!formTarea.titulo.trim()) { setTareaErr('El título es requerido.'); return }
    if (!formTarea.fecha_limite) { setTareaErr('La fecha límite es requerida.'); return }
    const p = Number(formTarea.ponderacion)
    if (isNaN(p) || p < 1 || p > 100) { setTareaErr('La ponderación debe ser entre 1 y 100.'); return }

    setCargando(true)
    try {
      const data = { ...formTarea, ponderacion: p, grupo_id: grupoSel }
      if (modal === 'nueva') {
        await api.crearTarea(data, archivoTarea)
      } else {
        await api.actualizarTarea(selTarea.id, data, archivoTarea)
      }
      setModal(null)
      setSelTarea(null)
      setArchivoTarea(null)
      await cargar(grupoSel)
    } catch (err) {
      setTareaErr(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function guardarCalificacion() {
    setCalErr('')
    if (!formCal.alumno_id) { setCalErr('Selecciona un alumno.'); return }
    const cal = Number(formCal.calificacion)
    if (isNaN(cal) || cal < 0 || cal > 100) { setCalErr('La calificación debe ser entre 0 y 100.'); return }

    setCargando(true)
    try {
      await api.calificarTarea(selTarea.id, {
        alumno_id: formCal.alumno_id,
        calificacion: cal,
        comentario: formCal.comentario,
      })
      setModal(null)
      setFormCal({ alumno_id: '', calificacion: '', comentario: '' })
      await cargar(grupoSel)
    } catch (err) {
      setCalErr(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function eliminarTarea(t) {
    if (!confirm(`¿Eliminar la tarea "${t.titulo}"?`)) return
    await api.eliminarTarea(t.id)
    await cargar(grupoSel)
  }

  async function guardarEntrega() {
    setEntregaErr('')
    if (!archivoEntrega) {
      setEntregaErr('Selecciona un archivo para entregar.')
      return
    }
    setCargando(true)
    try {
      await api.subirEntrega(selTarea.id, archivoEntrega)
      setModal(null)
      setArchivoEntrega(null)
      await cargar(grupoSel)
    } catch (err) {
      setEntregaErr(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function descargarArchivoTarea(tarea) {
    if (!tarea.archivo_nombre) return
    const url = api.getArchivoTareaUrl(tarea.id)
    await api.descargarArchivo(url, tarea.archivo_nombre)
  }

  async function descargarEntrega(tarea_id, entrega) {
    if (!entrega.archivo_nombre) return
    const url = api.getArchivoEntregaUrl(tarea_id, entrega.id)
    await api.descargarArchivo(url, entrega.archivo_nombre)
  }

  const totalPonderacion = tareas.reduce((s, t) => s + (t.ponderacion || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h2>Tareas</h2>
        {tienePermiso(P.TAREA_CREAR) && !esAlumno && (
          <button className="btn-primario" onClick={() => {
            setFormTarea({ titulo: '', descripcion: '', fecha_limite: '', ponderacion: 10 })
            setTareaErr(''); setArchivoTarea(null)
            setModal('nueva')
          }}>+ Nueva tarea</button>
        )}
      </div>

      {grupos.length > 1 && (
        <div className="filtros-bar">
          <label>Grupo
            <select value={grupoSel} onChange={e => setGrupoSel(e.target.value)}>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.codigo}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="tabs-bar" style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button className={`tab-btn ${tab === 'tareas' ? 'activo' : ''}`} onClick={() => setTab('tareas')}>
          Tareas del grupo
        </button>
        <button className={`tab-btn ${tab === 'calificaciones' ? 'activo' : ''}`} onClick={() => setTab('calificaciones')}>
          Calificaciones
        </button>
      </div>

      {/* ── Tab: Tareas ── */}
      {tab === 'tareas' && (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Tarea</th>
                <th>Descripción</th>
                <th>Fecha límite</th>
                <th>Ponderación</th>
                <th>Estado</th>
                {esAlumno && <th>Entrega</th>}
                {!esAlumno && tienePermiso(P.TAREA_CREAR) && <th></th>}
              </tr>
            </thead>
            <tbody>
              {tareas.map(t => {
                const vencida = estaVencida(t.fecha_limite)
                const dias = diasRestantes(t.fecha_limite)
                const entrega = esAlumno ? miEntrega(t.id) : null
                return (
                  <tr key={t.id} style={vencida ? { opacity: 0.75 } : {}}>
                    <td>
                      <strong>{t.titulo}</strong>
                      {vencida && <span className="badge baja" style={{ marginLeft: 8 }}>Cerrada</span>}
                    </td>
                    <td className="texto-muted">
                      {t.descripcion || '—'}
                      {t.archivo_nombre && (
                        <div style={{ marginTop: 6 }}>
                          <button className="btn-mini"
                            onClick={() => descargarArchivoTarea(t)}
                            style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                            {iconoArchivo(t.archivo_nombre)} {t.archivo_nombre} ⬇
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ color: vencida ? 'var(--rojo)' : dias !== null && dias <= 3 ? 'var(--naranja)' : 'inherit' }}>
                        {t.fecha_limite}
                      </span>
                      {!vencida && dias !== null && dias <= 7 && (
                        <div className="texto-muted" style={{ fontSize: 11 }}>
                          {dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `${dias} días`}
                        </div>
                      )}
                    </td>
                    <td>{t.ponderacion}%</td>
                    <td>
                      {vencida
                        ? <span className="badge baja">Cerrada</span>
                        : <span className="badge asignada">Abierta</span>}
                    </td>
                    {esAlumno && (
                      <td>
                        {entrega ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="badge pagada" style={{ fontSize: 11 }}>✓ Entregada</span>
                            {entrega.archivo_nombre && (
                              <button className="btn-mini" onClick={() => descargarEntrega(t.id, entrega)}
                                style={{ fontSize: 10 }}>
                                {iconoArchivo(entrega.archivo_nombre)} {entrega.archivo_nombre} ⬇
                              </button>
                            )}
                            {!vencida && (
                              <button className="btn-mini" onClick={() => {
                                setSelTarea(t); setArchivoEntrega(null); setEntregaErr(''); setModal('entregar')
                              }} style={{ fontSize: 11 }}>Actualizar</button>
                            )}
                          </div>
                        ) : (
                          <button
                            className="btn-mini"
                            disabled={vencida}
                            onClick={() => { setSelTarea(t); setArchivoEntrega(null); setEntregaErr(''); setModal('entregar') }}
                            style={!vencida ? { borderColor: 'var(--naranja)', color: 'var(--naranja)' } : {}}
                          >
                            Entregar
                          </button>
                        )}
                      </td>
                    )}
                    {!esAlumno && tienePermiso(P.TAREA_CREAR) && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-mini" style={{ marginRight: 4 }} onClick={() => {
                          setSelTarea(t)
                          setFormTarea({ titulo: t.titulo, descripcion: t.descripcion || '', fecha_limite: t.fecha_limite, ponderacion: t.ponderacion })
                          setTareaErr(''); setArchivoTarea(null)
                          setModal('editar')
                        }}>Editar</button>
                        <button className="btn-mini rojo" onClick={() => eliminarTarea(t)}>Eliminar</button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {tareas.length === 0 && (
                <tr><td colSpan={7} className="tabla-vacio">Sin tareas asignadas.</td></tr>
              )}
            </tbody>
            {tareas.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600, paddingRight: 8 }}>Total ponderación:</td>
                  <td style={{ fontWeight: 700, color: totalPonderacion > 100 ? 'var(--rojo)' : 'inherit' }}>{totalPonderacion}%</td>
                  <td colSpan={esAlumno ? 2 : 2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── Tab: Calificaciones ── */}
      {tab === 'calificaciones' && (
        <div>
          {esAlumno ? (
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Tarea</th><th>Fecha límite</th><th>Ponderación</th>
                    <th>Entrega</th><th>Calificación</th><th>Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {tareas.map(t => {
                    const cal = miCal(t.id)
                    const entrega = miEntrega(t.id)
                    const vencida = estaVencida(t.fecha_limite)
                    return (
                      <tr key={t.id}>
                        <td>{t.titulo} {vencida && <span className="badge baja" style={{ marginLeft: 4 }}>Cerrada</span>}</td>
                        <td>{t.fecha_limite}</td>
                        <td>{t.ponderacion}%</td>
                        <td>
                          {entrega?.archivo_nombre ? (
                            <button className="btn-mini" onClick={() => descargarEntrega(t.id, entrega)}
                              style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                              {iconoArchivo(entrega.archivo_nombre)} {entrega.archivo_nombre} ⬇
                            </button>
                          ) : <span className="texto-muted">—</span>}
                        </td>
                        <td>
                          {cal
                            ? <span className={`calificacion ${cal.calificacion >= 70 ? 'aprobado' : 'reprobado'}`}>{cal.calificacion}</span>
                            : <span className="texto-muted">—</span>}
                        </td>
                        <td className="texto-muted">{cal?.comentario || '—'}</td>
                      </tr>
                    )
                  })}
                  {tareas.length === 0 && (
                    <tr><td colSpan={6} className="tabla-vacio">Sin tareas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Tarea</th>
                    <th>Pond.</th>
                    {alumnos.map(a => <th key={a.id}>{a.nombre}</th>)}
                    {tienePermiso(P.TAREA_CREAR) && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {tareas.map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.titulo}</strong></td>
                      <td>{t.ponderacion}%</td>
                      {alumnos.map(a => {
                        const cal = calDe(t.id, a.id)
                        const entrega = entregaDe(t.id, a.id)
                        return (
                          <td key={a.id}>
                            {cal
                              ? <span className={`calificacion ${cal.calificacion >= 70 ? 'aprobado' : 'reprobado'}`}>{cal.calificacion}</span>
                              : <span className="texto-muted">—</span>}
                            {entrega?.archivo_nombre && (
                              <div style={{ marginTop: 4 }}>
                                <button className="btn-mini"
                                  onClick={() => descargarEntrega(t.id, entrega)}
                                  style={{ fontSize: 10, display: 'flex', gap: 3, alignItems: 'center', marginBottom: 2 }}>
                                  {iconoArchivo(entrega.archivo_nombre)} {entrega.archivo_nombre} ⬇
                                </button>
                              </div>
                            )}
                          </td>
                        )
                      })}
                      {tienePermiso(P.TAREA_CREAR) && (
                        <td>
                          <button className="btn-mini" onClick={() => {
                            setSelTarea(t)
                            setFormCal({ alumno_id: '', calificacion: '', comentario: '' })
                            setCalErr('')
                            setModal('calificar')
                          }}>Calificar</button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {tareas.length === 0 && (
                    <tr><td colSpan={3 + alumnos.length} className="tabla-vacio">Sin tareas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: nueva/editar tarea ── */}
      {(modal === 'nueva' || modal === 'editar') && (
        <Modal titulo={modal === 'nueva' ? 'Nueva tarea' : 'Editar tarea'} onClose={() => setModal(null)} ancho={560}>
          <div className="form-grid">
            <label style={{ gridColumn: '1/-1' }}>Título *
              <input value={formTarea.titulo} onChange={e => setFormTarea({ ...formTarea, titulo: e.target.value })}
                placeholder="Ej. Vocabulario capítulo 1" />
            </label>
            <label style={{ gridColumn: '1/-1' }}>Descripción / Instrucciones
              <textarea value={formTarea.descripcion} onChange={e => setFormTarea({ ...formTarea, descripcion: e.target.value })}
                rows={3} placeholder="Describe la actividad que deben realizar…" />
            </label>
            <label>Fecha límite *
              <input type="date" value={formTarea.fecha_limite} onChange={e => setFormTarea({ ...formTarea, fecha_limite: e.target.value })} />
            </label>
            <label>Ponderación (%) *
              <input type="number" min="1" max="100" value={formTarea.ponderacion}
                onChange={e => setFormTarea({ ...formTarea, ponderacion: e.target.value })} />
            </label>
          </div>

          <label style={{ marginTop: 4 }}>
            Material de apoyo (opcional — PDF, Word, Excel, audio, video…)
            {selTarea?.archivo_nombre && !archivoTarea && (
              <div style={{ fontSize: 12, color: 'var(--texto-muted)', marginBottom: 4 }}>
                Actual: {iconoArchivo(selTarea.archivo_nombre)} {selTarea.archivo_nombre}
              </div>
            )}
            <div style={{ border: '2px dashed var(--borde)', borderRadius: 8, padding: '14px', textAlign: 'center', cursor: 'pointer', marginTop: 4, background: 'var(--bg-3)' }}
              onClick={() => fileInputTareaRef.current?.click()}>
              {archivoTarea
                ? <div style={{ fontWeight: 600 }}>{iconoArchivo(archivoTarea.name)} {archivoTarea.name} ({(archivoTarea.size / 1024 / 1024).toFixed(1)} MB)</div>
                : <div style={{ fontSize: 12, color: 'var(--texto-muted)' }}>📎 Haz clic para adjuntar un archivo (máx. {MAX_MB} MB)</div>}
            </div>
            <input ref={fileInputTareaRef} type="file" accept={TIPOS_PERMITIDOS} style={{ display: 'none' }}
              onChange={e => { setArchivoTarea(e.target.files[0] || null); e.target.value = '' }} />
          </label>

          {tareaErr && <p style={{ color: 'var(--rojo)', fontSize: 13, marginTop: 8 }}>{tareaErr}</p>}
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardarTarea} disabled={cargando}>
              {cargando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: calificar ── */}
      {modal === 'calificar' && selTarea && (
        <Modal titulo={`Calificar: ${selTarea.titulo}`} onClose={() => setModal(null)} ancho={480}>
          <p className="texto-muted" style={{ marginBottom: 12 }}>Fecha límite: {selTarea.fecha_limite} · Ponderación: {selTarea.ponderacion}%</p>
          <label>Alumno *
            <select value={formCal.alumno_id} onChange={e => setFormCal({ ...formCal, alumno_id: e.target.value })}>
              <option value="">Seleccionar…</option>
              {alumnos.map(a => {
                const cal = calDe(selTarea.id, a.id)
                const entrega = entregaDe(selTarea.id, a.id)
                return (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                    {cal ? ` (actual: ${cal.calificacion})` : ''}
                    {entrega?.archivo_nombre ? ' 📎' : ''}
                  </option>
                )
              })}
            </select>
          </label>
          {formCal.alumno_id && (() => {
            const entrega = entregaDe(selTarea.id, formCal.alumno_id)
            if (!entrega?.archivo_nombre) return null
            return (
              <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '10px 14px', margin: '8px 0', fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Entrega del alumno:</div>
                <button className="btn-mini"
                  onClick={() => descargarEntrega(selTarea.id, entrega)}
                  style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                  {iconoArchivo(entrega.archivo_nombre)} {entrega.archivo_nombre} ⬇ Descargar
                </button>
              </div>
            )
          })()}
          <label>Calificación (0–100) *
            <input type="number" min="0" max="100" value={formCal.calificacion}
              onChange={e => setFormCal({ ...formCal, calificacion: e.target.value })} />
          </label>
          <label>Comentario / Retroalimentación
            <textarea value={formCal.comentario} onChange={e => setFormCal({ ...formCal, comentario: e.target.value })}
              rows={2} placeholder="Retroalimentación opcional…" />
          </label>
          {calErr && <p style={{ color: 'var(--rojo)', fontSize: 13, marginTop: 8 }}>{calErr}</p>}
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardarCalificacion} disabled={cargando}>
              {cargando ? 'Guardando…' : 'Guardar calificación'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: entregar (alumno) ── */}
      {modal === 'entregar' && selTarea && (
        <Modal titulo={`Entregar: ${selTarea.titulo}`} onClose={() => { setModal(null); setArchivoEntrega(null) }} ancho={500}>
          <p className="texto-muted" style={{ marginBottom: 16, fontSize: 13 }}>
            Fecha límite: <strong>{selTarea.fecha_limite}</strong> · Ponderación: <strong>{selTarea.ponderacion}%</strong>
          </p>
          {selTarea.archivo_nombre && (
            <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
              <strong>Material del profesor:</strong>{' '}
              <button className="btn-mini" onClick={() => descargarArchivoTarea(selTarea)}
                style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                {iconoArchivo(selTarea.archivo_nombre)} {selTarea.archivo_nombre} ⬇
              </button>
            </div>
          )}
          <label>
            Tu entrega (PDF, Word, audio, video… máx. {MAX_MB} MB)
            <div style={{ border: '2px dashed var(--borde)', borderRadius: 8, padding: '20px', textAlign: 'center', cursor: 'pointer', marginTop: 4, background: 'var(--bg-3)' }}
              onClick={() => fileInputRef.current?.click()}>
              {archivoEntrega
                ? <div style={{ fontWeight: 600 }}>{iconoArchivo(archivoEntrega.name)} {archivoEntrega.name} ({(archivoEntrega.size / 1024 / 1024).toFixed(1)} MB)</div>
                : <div style={{ fontSize: 13, color: 'var(--texto-muted)' }}>📎 Haz clic para seleccionar tu archivo</div>}
            </div>
            <input ref={fileInputRef} type="file" accept={TIPOS_PERMITIDOS} style={{ display: 'none' }}
              onChange={e => { setArchivoEntrega(e.target.files[0] || null); e.target.value = '' }} />
          </label>

          {entregaErr && <p style={{ color: 'var(--rojo)', fontSize: 13, marginTop: 8 }}>{entregaErr}</p>}
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => { setModal(null); setArchivoEntrega(null) }}>Cancelar</button>
            <button className="btn-primario" onClick={guardarEntrega} disabled={cargando}>
              {cargando ? 'Subiendo…' : (miEntrega(selTarea.id) ? 'Actualizar entrega' : 'Entregar')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
