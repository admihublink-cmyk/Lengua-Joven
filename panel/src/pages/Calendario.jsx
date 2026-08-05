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

  // Modal de reprogramación
  const [modalRepro, setModalRepro] = useState(null) // sesion object | null
  const [reprForm, setReprForm] = useState({})

  async function cargar() {
    try {
      const [todosGrupos, ins, idiomas] = await Promise.all([
        api.getGrupos(),
        api.getInscripciones(),
        api.getIdiomas(),
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
                            {sels.map(s => (
                              <div key={s.id}
                                className={`cal-chip ${esHoy ? 'activa' : 'futura'} ${colorMap[s.grupo_id] || 'color-g1'}`}
                                title={`${s.titulo} ${s.hora_inicio}`}
                              >
                                {s.hora_inicio} {s.titulo}
                              </div>
                            ))}
                            {sels.length === 0 && <div style={{ height: 28 }} />}
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

            {sesionesDia.length === 0 ? (
              <div className="cal-sesion-vacio">
                <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📭</span>
                Sin clases programadas.
              </div>
            ) : (
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
    </div>
  )
}
