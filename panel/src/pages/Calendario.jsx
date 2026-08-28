import { useState, useEffect } from 'react'
import { useAuth, useNav } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

const COLORES = ['color-g1', 'color-g2', 'color-g3', 'color-g4', 'color-g5']
const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const TIPO_EVENTO = {
  general:       { label: 'General',               color: '#7f8c8d' },
  inscripciones: { label: 'Inscripciones',          color: '#2980b9' },
  inicio_ciclo:  { label: 'Inicio de ciclo',        color: '#27ae60' },
  cambio_grupo:  { label: 'Cambio de grupo',        color: '#e67e22' },
  examen:        { label: 'Exámenes',               color: '#8e44ad' },
}

function formatRango(fi, ff) {
  const fmt = (iso) => {
    const [y, m, d] = iso.split('-')
    return `${parseInt(d)} ${MESES[parseInt(m) - 1].slice(0, 3)} ${y}`
  }
  return ff && ff !== fi ? `Del ${fmt(fi)} al ${fmt(ff)}` : fmt(fi)
}

function fs(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function Calendario() {
  const { usuario, tienePermiso } = useAuth()
  const { navegar } = useNav()

  const hoyFecha = new Date().toISOString().slice(0, 10)
  const ahora = new Date()

  const [anio, setAnio] = useState(ahora.getFullYear())
  const [mes, setMes] = useState(ahora.getMonth())
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoyFecha)
  const [vista, setVista] = useState('mes') // 'mes' | 'semana' | 'dia'
  const [grupos, setGrupos] = useState([])
  const [sesiones, setSesiones] = useState([])
  const [idiomas, setIdiomas] = useState([])
  const [niveles, setNiveles] = useState([])
  const [eventos, setEventos] = useState([])

  // Modal de reprogramación
  const [modalRepro, setModalRepro] = useState(null)
  const [reprForm, setReprForm] = useState({})

  // Modal de evento institucional
  const [modalEvento, setModalEvento] = useState(null) // null | 'nuevo' | evento-obj
  const [eventoForm, setEvenForm] = useState({ titulo: '', descripcion: '', tipo: 'general', fecha_inicio: hoyFecha, fecha_fin: '' })
  const [guardandoEvento, setGuardandoEvento] = useState(false)

  const puedeAdminCalendario = tienePermiso(P.CALENDARIO_ADMIN)

  async function cargar() {
    try {
      const [todosGrupos, ins, idiomas, evArr] = await Promise.all([
        api.getGrupos(),
        api.getInscripciones(),
        api.getIdiomas(),
        api.getEventosCalendario(),
      ])
      let g = []
      if (usuario.rol === 'alumno') {
        const gids = new Set(ins.filter(i => i.grupo_id && i.estado === 'asignada').map(i => i.grupo_id))
        g = todosGrupos.filter(x => gids.has(x.id))
      } else if (usuario.rol === 'profesor') {
        g = todosGrupos.filter(x => x.profesor_id === usuario.id)
      } else {
        g = todosGrupos
      }
      setGrupos(g)
      setIdiomas(idiomas)
      setEventos(evArr)
      const gids2 = g.map(x => x.id)
      const [sesArr, nivelesArr] = await Promise.all([
        gids2.length > 0
          ? Promise.all(gids2.map(gid => api.getSesiones(gid))).then(r => r.flat())
          : Promise.resolve([]),
        Promise.all(idiomas.map(i => api.getNiveles(i.id))).then(r => r.flat()),
      ])
      setSesiones(sesArr)
      setNiveles(nivelesArr)
    } catch (e) {
      console.error('Error cargando calendario:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  // ── Navegación mes ──
  function prevMes() {
    if (mes === 0) { setAnio(a => a - 1); setMes(11) }
    else setMes(m => m - 1)
  }
  function nextMes() {
    if (mes === 11) { setAnio(a => a + 1); setMes(0) }
    else setMes(m => m + 1)
  }
  function irHoy() {
    const n = new Date()
    setAnio(n.getFullYear()); setMes(n.getMonth()); setDiaSeleccionado(hoyFecha)
  }

  function getSemana(fechaStr) {
    const d = new Date(fechaStr + 'T12:00:00')
    const dow = d.getDay()
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(d)
      dd.setDate(dd.getDate() - dow + i)
      return { fecha: dd.toISOString().slice(0, 10), dia: dd.getDate(), dow: i }
    })
  }
  function prevPeriodo() {
    if (vista === 'mes') { prevMes(); return }
    const d = new Date(diaSeleccionado + 'T12:00:00')
    d.setDate(d.getDate() - (vista === 'semana' ? 7 : 1))
    const nueva = d.toISOString().slice(0, 10)
    setDiaSeleccionado(nueva); setAnio(d.getFullYear()); setMes(d.getMonth())
  }
  function nextPeriodo() {
    if (vista === 'mes') { nextMes(); return }
    const d = new Date(diaSeleccionado + 'T12:00:00')
    d.setDate(d.getDate() + (vista === 'semana' ? 7 : 1))
    const nueva = d.toISOString().slice(0, 10)
    setDiaSeleccionado(nueva); setAnio(d.getFullYear()); setMes(d.getMonth())
  }

  function eventosEnFecha(fecha) {
    return eventos.filter(e => fecha >= e.fecha_inicio && fecha <= (e.fecha_fin || e.fecha_inicio))
  }

  async function guardarEvento() {
    if (!eventoForm.titulo.trim() || !eventoForm.fecha_inicio) return
    setGuardandoEvento(true)
    try {
      const data = {
        titulo: eventoForm.titulo.trim(),
        descripcion: eventoForm.descripcion.trim() || undefined,
        tipo: eventoForm.tipo,
        fecha_inicio: eventoForm.fecha_inicio,
        fecha_fin: eventoForm.fecha_fin || undefined,
      }
      if (modalEvento === 'nuevo') {
        await api.crearEventoCalendario(data)
      } else {
        await api.actualizarEventoCalendario(modalEvento.id, data)
      }
      setModalEvento(null)
      await cargar()
    } catch (e) {
      alert('Error al guardar: ' + e.message)
    } finally {
      setGuardandoEvento(false)
    }
  }

  async function eliminarEvento(id) {
    if (!confirm('¿Eliminar este evento?')) return
    try {
      await api.eliminarEventoCalendario(id)
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  function abrirNuevoEvento() {
    setEvenForm({ titulo: '', descripcion: '', tipo: 'general', fecha_inicio: diaSeleccionado, fecha_fin: '' })
    setModalEvento('nuevo')
  }

  function abrirEditarEvento(ev) {
    setEvenForm({ titulo: ev.titulo, descripcion: ev.descripcion || '', tipo: ev.tipo, fecha_inicio: ev.fecha_inicio, fecha_fin: ev.fecha_fin || '' })
    setModalEvento(ev)
  }

  // ── Generar celdas del grid (42 = 6 semanas) ──
  const primerDia = new Date(anio, mes, 1).getDay()
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const celdas = []

  const diasMesAnt = new Date(anio, mes, 0).getDate()
  for (let i = primerDia - 1; i >= 0; i--) {
    const d = diasMesAnt - i
    celdas.push({ fecha: fs(mes === 0 ? anio - 1 : anio, mes === 0 ? 11 : mes - 1, d), dia: d, otro: true })
  }
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push({ fecha: fs(anio, mes, d), dia: d, otro: false })
  }
  let d2 = 1
  while (celdas.length < 42) {
    celdas.push({ fecha: fs(mes === 11 ? anio + 1 : anio, mes === 11 ? 0 : mes + 1, d2++), dia: d2 - 1, otro: true })
  }

  // ── Helpers ──
  const colorMap = {}
  grupos.forEach((g, i) => { colorMap[g.id] = COLORES[i % COLORES.length] })

  function sesionOcurreEnFecha(s, fecha) {
    if (s.tipo === 'unica') return s.fecha === fecha
    const dow = new Date(fecha + 'T12:00:00').getDay()
    if (s.dia_semana !== dow) return false
    if (s.fecha_inicio && fecha < s.fecha_inicio) return false
    if (s.fecha_fin && fecha > s.fecha_fin) return false
    return true
  }
  function sesionesEnFecha(fecha) {
    return sesiones.filter(s => sesionOcurreEnFecha(s, fecha))
  }
  function labelGrupo(gid) {
    const g = grupos.find(x => x.id === gid)
    if (!g) return gid
    const idioma = idiomas.find(i => i.id === g.idioma_id)?.nombre || ''
    const nivel = niveles.find(n => n.id === g.nivel_id)?.nombre || ''
    return `${idioma} · ${nivel}`
  }

  // Puede reprogramar si: profesor dueño del grupo, o coordinador/director
  function puedeReprogramar(sesion) {
    if (!tienePermiso(P.SESION_EDITAR)) return false
    if (usuario.rol === 'profesor') {
      const grupo = grupos.find(g => g.id === sesion.grupo_id)
      return grupo?.profesor_id === usuario.id
    }
    return true // coordinador, director, superadmin
  }

  function abrirReprogramar(sesion) {
    setReprForm({
      hora_inicio: sesion.hora_inicio,
      hora_fin: sesion.hora_fin,
      fecha: sesion.fecha || diaSeleccionado,
      dia_semana: sesion.dia_semana ?? new Date(diaSeleccionado + 'T12:00:00').getDay(),
      fecha_inicio: sesion.fecha_inicio || '',
      fecha_fin: sesion.fecha_fin || '',
    })
    setModalRepro(sesion)
  }

  async function guardarReprogramacion() {
    if (!modalRepro) return
    const campos = { hora_inicio: reprForm.hora_inicio, hora_fin: reprForm.hora_fin }
    if (modalRepro.tipo === 'unica') {
      campos.fecha = reprForm.fecha
    } else {
      campos.dia_semana = Number(reprForm.dia_semana)
      campos.fecha_inicio = reprForm.fecha_inicio
      campos.fecha_fin = reprForm.fecha_fin
    }
    try {
      await api.actualizarSesion(modalRepro.id, campos)
      setModalRepro(null)
      await cargar()
    } catch (e) {
      alert('Error al guardar: ' + e.message)
    }
  }

  const sesionesDia = sesionesEnFecha(diaSeleccionado)
  const puedeUnirse = usuario.rol === 'alumno' || usuario.rol === 'profesor'
  const fechaLabel = new Date(diaSeleccionado + 'T12:00:00')
    .toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  const semanaActual = vista === 'semana' ? getSemana(diaSeleccionado) : []
  const headerTitle = vista === 'mes'
    ? `${MESES[mes]} ${anio}`
    : vista === 'semana' && semanaActual.length === 7
      ? (() => {
          const fd = new Date(semanaActual[0].fecha + 'T12:00:00')
          const ld = new Date(semanaActual[6].fecha + 'T12:00:00')
          return fd.getMonth() === ld.getMonth()
            ? `${semanaActual[0].dia}–${semanaActual[6].dia} ${MESES[ld.getMonth()]} ${ld.getFullYear()}`
            : `${semanaActual[0].dia} ${MESES[fd.getMonth()]} – ${semanaActual[6].dia} ${MESES[ld.getMonth()]} ${ld.getFullYear()}`
        })()
      : fechaLabel

  return (
    <div>
      {/* Cabecera */}
      <div className="cal-header">
        <button className="cal-nav-btn" onClick={prevPeriodo}>‹</button>
        <h2>{headerTitle}</h2>
        <button className="cal-nav-btn" onClick={nextPeriodo}>›</button>
        <button className="cal-hoy-btn" onClick={irHoy}>Hoy</button>
        {puedeAdminCalendario && (
          <button onClick={abrirNuevoEvento} style={{
            marginLeft: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: 'none', borderRadius: 8, background: 'var(--naranja)', color: '#fff',
          }}>+ Evento</button>
        )}
        <div style={{ display: 'flex', gap: 0, marginLeft: 'auto' }}>
          {[['mes', 'Mes'], ['semana', 'Semana'], ['dia', 'Día']].map(([v, label]) => (
            <button key={v} onClick={() => setVista(v)} style={{
              padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--borde)',
              borderRadius: v === 'mes' ? '8px 0 0 8px' : v === 'dia' ? '0 8px 8px 0' : '0',
              background: vista === v ? 'var(--naranja)' : 'var(--bg-3)',
              color: vista === v ? '#fff' : 'var(--texto)',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div className="cal-layout" style={vista === 'dia' ? { gridTemplateColumns: '1fr' } : undefined}>
        {/* Columna izquierda: grid mensual o semanal (oculto en vista día) */}
        {vista !== 'dia' && (
          <div style={{ overflowX: 'auto' }}>

            {/* Vista Mes */}
            {vista === 'mes' && (
              <table className="cal-grid" style={{ minWidth: 420 }}>
                <thead>
                  <tr>{DIAS_CORTO.map(d => <th key={d}>{d}</th>)}</tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }, (_, fila) => (
                    <tr key={fila}>
                      {celdas.slice(fila * 7, fila * 7 + 7).map(celda => {
                        const sels = sesionesEnFecha(celda.fecha)
                        const esHoy = celda.fecha === hoyFecha
                        const esSel = celda.fecha === diaSeleccionado
                        return (
                          <td
                            key={celda.fecha}
                            className={['cal-cell', celda.otro ? 'otro-mes' : '', esHoy ? 'hoy' : ''].join(' ')}
                            style={esSel ? { outline: '2px solid var(--naranja)', outlineOffset: -2 } : undefined}
                            onClick={() => setDiaSeleccionado(celda.fecha)}
                          >
                            <div className="cal-fecha">{celda.dia}</div>
                            <div className="cal-chips">
                              {eventosEnFecha(celda.fecha).map(ev => (
                                <div key={ev.id} style={{
                                  fontSize: 10, padding: '1px 5px', borderRadius: 3, marginBottom: 1,
                                  background: TIPO_EVENTO[ev.tipo]?.color || '#7f8c8d',
                                  color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }} title={ev.titulo}>
                                  {ev.titulo}
                                </div>
                              ))}
                              {sels.slice(0, 2).map(s => (
                                <div key={s.id}
                                  className={`cal-chip ${esHoy ? 'activa' : 'futura'} ${colorMap[s.grupo_id] || 'color-g1'}`}
                                  title={`${s.titulo} ${s.hora_inicio}`}
                                >
                                  {s.hora_inicio} {s.titulo}
                                </div>
                              ))}
                              {sels.length > 2 && (
                                <div className="cal-chip futura" style={{ color: 'var(--texto-muted)', borderLeftColor: 'transparent' }}>
                                  +{sels.length - 2}
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Vista Semana — fila de 7 días con todas las sesiones */}
            {vista === 'semana' && (
              <table className="cal-grid" style={{ minWidth: 560, tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {semanaActual.map(d => {
                      const esHoy = d.fecha === hoyFecha
                      return (
                        <th key={d.fecha} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--texto-muted)', marginBottom: 2 }}>{DIAS_CORTO[d.dow]}</div>
                          <div style={{
                            fontWeight: 700, fontSize: 15,
                            background: esHoy ? 'var(--naranja)' : 'transparent',
                            color: esHoy ? '#fff' : 'inherit',
                            borderRadius: '50%', width: 28, height: 28,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}>{d.dia}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ verticalAlign: 'top' }}>
                    {semanaActual.map(d => {
                      const sels = sesionesEnFecha(d.fecha)
                      const esHoy = d.fecha === hoyFecha
                      const esSel = d.fecha === diaSeleccionado
                      return (
                        <td
                          key={d.fecha}
                          className={['cal-cell', esHoy ? 'hoy' : ''].join(' ')}
                          style={{
                            verticalAlign: 'top', cursor: 'pointer', minHeight: 80,
                            outline: esSel ? '2px solid var(--naranja)' : undefined,
                            outlineOffset: esSel ? -2 : undefined,
                          }}
                          onClick={() => setDiaSeleccionado(d.fecha)}
                        >
                          <div className="cal-chips">
                            {eventosEnFecha(d.fecha).map(ev => (
                              <div key={ev.id} style={{
                                fontSize: 10, padding: '1px 5px', borderRadius: 3, marginBottom: 1,
                                background: TIPO_EVENTO[ev.tipo]?.color || '#7f8c8d',
                                color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }} title={ev.titulo}>
                                {ev.titulo}
                              </div>
                            ))}
                            {sels.map(s => (
                              <div key={s.id}
                                className={`cal-chip ${esHoy ? 'activa' : 'futura'} ${colorMap[s.grupo_id] || 'color-g1'}`}
                                title={`${s.titulo} ${s.hora_inicio}`}
                              >
                                {s.hora_inicio} {s.titulo}
                              </div>
                            ))}
                            {sels.length === 0 && eventosEnFecha(d.fecha).length === 0 && <div style={{ height: 28 }} />}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Panel lateral — siempre visible; ocupa todo el ancho en vista día */}
        <div className="cal-side">
          <div className="cal-side-card">
            <div className="cal-side-head" style={{ textTransform: 'capitalize' }}>
              {fechaLabel}
            </div>

            {/* Eventos institucionales del día */}
            {eventosEnFecha(diaSeleccionado).map(ev => (
              <div key={ev.id} style={{
                borderLeft: `4px solid ${TIPO_EVENTO[ev.tipo]?.color || '#7f8c8d'}`,
                paddingLeft: 10, marginBottom: 12,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.titulo}</div>
                <div style={{ fontSize: 11, color: 'var(--texto-muted)', marginTop: 2 }}>
                  📅 {formatRango(ev.fecha_inicio, ev.fecha_fin)}
                  <span style={{
                    marginLeft: 8, padding: '1px 6px', borderRadius: 10,
                    background: TIPO_EVENTO[ev.tipo]?.color || '#7f8c8d',
                    color: '#fff', fontSize: 10,
                  }}>{TIPO_EVENTO[ev.tipo]?.label || ev.tipo}</span>
                </div>
                {ev.descripcion && <div style={{ fontSize: 12, color: 'var(--texto-muted)', marginTop: 4 }}>{ev.descripcion}</div>}
                {puedeAdminCalendario && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn-sec mini" onClick={() => abrirEditarEvento(ev)}>Editar</button>
                    <button className="btn-sec mini" style={{ color: '#e74c3c' }} onClick={() => eliminarEvento(ev.id)}>Eliminar</button>
                  </div>
                )}
              </div>
            ))}

            {sesionesDia.length === 0 && eventosEnFecha(diaSeleccionado).length === 0 ? (
              <div className="cal-sesion-vacio">
                <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📭</span>
                Sin clases ni eventos.
              </div>
            ) : sesionesDia.length === 0 ? null : (
              sesionesDia.map(s => {
                const grupo = grupos.find(g => g.id === s.grupo_id)
                const esHoy = diaSeleccionado === hoyFecha
                return (
                  <div key={s.id} className="cal-sesion-item">
                    <div className="cal-sesion-titulo"
                      style={{ borderLeft: '3px solid var(--naranja)', paddingLeft: 8 }}>
                      {s.titulo}
                    </div>
                    <div className="cal-sesion-meta">
                      🕐 {s.hora_inicio} – {s.hora_fin}
                      {s.tipo === 'semanal' && (
                        <span style={{ color: 'var(--azul)', marginLeft: 6, fontSize: 11 }}>
                          · Recurrente ({DIAS_LARGO[s.dia_semana]})
                        </span>
                      )}
                      {grupo && <><br />📚 {labelGrupo(grupo.id)}<br />📍 {grupo.horario}</>}
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {esHoy && puedeUnirse && (
                        <button className="btn-primario mini" onClick={() =>
                          navegar('clase', { sesion_id: s.id, fecha: diaSeleccionado, titulo: s.titulo, grupo_id: s.grupo_id })
                        }>
                          🎥 Unirse
                        </button>
                      )}
                      {puedeReprogramar(s) && (
                        <button className="btn-sec mini" onClick={() => abrirReprogramar(s)}>
                          📅 Reprogramar
                        </button>
                      )}
                    </div>

                    {!esHoy && (
                      <span className="texto-muted chico">
                        {diaSeleccionado < hoyFecha ? '✓ Clase pasada' : '🔒 Próximamente'}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Leyenda de grupos */}
          {grupos.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 10, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--texto-muted)' }}>
                Mis grupos
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {grupos.map((g, i) => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div className={`cal-chip activa ${COLORES[i % COLORES.length]}`} style={{ flex: 'none', padding: '2px 8px' }}>
                      {g.codigo}
                    </div>
                    <span className="texto-muted">{labelGrupo(g.id)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leyenda de tipos de evento */}
          <div className="card" style={{ marginTop: 12 }}>
            <h4 style={{ marginBottom: 10, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--texto-muted)' }}>
              Eventos institucionales
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {Object.entries(TIPO_EVENTO).map(([key, { label, color }]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <span className="texto-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal de reprogramación ── */}
      {modalRepro && (
        <Modal titulo="Reprogramar clase" onClose={() => setModalRepro(null)} ancho={440}>
          <div style={{ marginBottom: 12 }}>
            <strong>{modalRepro.titulo}</strong>
            <span className="texto-muted" style={{ fontSize: 12, marginLeft: 8 }}>
              ({modalRepro.tipo === 'unica' ? 'Sesión única' : `Recurrente · ${DIAS_LARGO[modalRepro.dia_semana]}`})
            </span>
          </div>

          {modalRepro.tipo === 'unica' && (
            <label>Nueva fecha
              <input type="date" value={reprForm.fecha || ''} onChange={e => setReprForm({ ...reprForm, fecha: e.target.value })} />
            </label>
          )}

          {modalRepro.tipo === 'semanal' && (
            <>
              <label>Día de la semana
                <select value={reprForm.dia_semana ?? ''} onChange={e => setReprForm({ ...reprForm, dia_semana: Number(e.target.value) })}>
                  {DIAS_LARGO.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </label>
              <div className="form-grid">
                <label>Inicio del ciclo
                  <input type="date" value={reprForm.fecha_inicio || ''} onChange={e => setReprForm({ ...reprForm, fecha_inicio: e.target.value })} />
                </label>
                <label>Fin del ciclo
                  <input type="date" value={reprForm.fecha_fin || ''} onChange={e => setReprForm({ ...reprForm, fecha_fin: e.target.value })} />
                </label>
              </div>
            </>
          )}

          <div className="form-grid">
            <label>Hora inicio
              <input type="time" value={reprForm.hora_inicio || ''} onChange={e => setReprForm({ ...reprForm, hora_inicio: e.target.value })} />
            </label>
            <label>Hora fin
              <input type="time" value={reprForm.hora_fin || ''} onChange={e => setReprForm({ ...reprForm, hora_fin: e.target.value })} />
            </label>
          </div>

          {modalRepro.tipo === 'semanal' && (
            <div className="alerta info">
              Cambiar el día o la fecha modifica <strong>todas</strong> las ocurrencias del ciclo.
            </div>
          )}

          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModalRepro(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardarReprogramacion}>Guardar cambios</button>
          </div>
        </Modal>
      )}

      {/* ── Modal evento institucional ── */}
      {modalEvento && (
        <Modal
          titulo={modalEvento === 'nuevo' ? 'Nuevo evento institucional' : 'Editar evento'}
          onClose={() => setModalEvento(null)}
          ancho={480}
        >
          <label>Título *
            <input
              value={eventoForm.titulo}
              onChange={e => setEvenForm({ ...eventoForm, titulo: e.target.value })}
              placeholder="Ej. Inicio de inscripciones"
              maxLength={100}
            />
          </label>

          <label>Tipo
            <select value={eventoForm.tipo} onChange={e => setEvenForm({ ...eventoForm, tipo: e.target.value })}>
              {Object.entries(TIPO_EVENTO).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>

          <div className="form-grid">
            <label>Fecha inicio *
              <input
                type="date"
                value={eventoForm.fecha_inicio}
                onChange={e => setEvenForm({ ...eventoForm, fecha_inicio: e.target.value })}
              />
            </label>
            <label>Fecha fin <span style={{ fontWeight: 400, fontSize: 11 }}>(opcional)</span>
              <input
                type="date"
                value={eventoForm.fecha_fin}
                min={eventoForm.fecha_inicio}
                onChange={e => setEvenForm({ ...eventoForm, fecha_fin: e.target.value })}
              />
            </label>
          </div>

          <label>Descripción <span style={{ fontWeight: 400, fontSize: 11 }}>(opcional)</span>
            <textarea
              value={eventoForm.descripcion}
              onChange={e => setEvenForm({ ...eventoForm, descripcion: e.target.value })}
              rows={3}
              placeholder="Detalles adicionales..."
              style={{ resize: 'vertical' }}
            />
          </label>

          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModalEvento(null)}>Cancelar</button>
            <button
              className="btn-primario"
              onClick={guardarEvento}
              disabled={guardandoEvento || !eventoForm.titulo.trim() || !eventoForm.fecha_inicio}
            >
              {guardandoEvento ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
