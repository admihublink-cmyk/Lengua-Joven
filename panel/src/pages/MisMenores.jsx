import { useState, useEffect } from 'react'
import * as api from '../api.js'

const ORANGE = '#f18b11'

const TIPO_COLOR = {
  examen: '#e74c3c',
  clase: '#2980b9',
  festivo: '#27ae60',
  receso: '#f39c12',
  general: '#8e44ad',
}
const TIPO_ICON = {
  examen: '📝',
  clase: '📚',
  festivo: '🎉',
  receso: '🌴',
  general: '📅',
}

function CalendarioTab() {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getEventosCalendario().then(data => setEventos(Array.isArray(data) ? data : [])).catch(() => setEventos([])).finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={muted}>Cargando...</p>
  if (eventos.length === 0) return <p style={muted}>Sin eventos próximos.</p>

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const proximos = eventos.filter(e => new Date(e.fecha_inicio) >= hoy)
  const pasados = eventos.filter(e => new Date(e.fecha_inicio) < hoy)

  const EventoRow = ({ e }) => {
    const color = TIPO_COLOR[e.tipo] || TIPO_COLOR.general
    const icon  = TIPO_ICON[e.tipo]  || TIPO_ICON.general
    const dInicio = new Date(e.fecha_inicio)
    const dFin = e.fecha_fin ? new Date(e.fecha_fin) : null
    const mismodia = dFin && dFin.toDateString() === dInicio.toDateString()
    return (
      <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
        <div style={{ width: 46, height: 46, borderRadius: 10, background: `${color}18`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${color}44` }}>
          <div style={{ fontSize: 18, lineHeight: 1 }}>{icon}</div>
          <div style={{ fontSize: 10, color, fontWeight: 700, marginTop: 2 }}>{dInicio.getDate()}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{e.titulo}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {dInicio.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
            {dFin && !mismodia && ` → ${dFin.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
          </div>
          {e.descripcion && <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{e.descripcion}</div>}
          <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, borderRadius: 6, padding: '1px 7px', marginTop: 4, display: 'inline-block', textTransform: 'capitalize' }}>{e.tipo}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {proximos.length > 0 ? (
        <>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#555' }}>Próximos</h4>
          {proximos.map(e => <EventoRow key={e.id} e={e} />)}
        </>
      ) : <p style={muted}>Sin eventos próximos.</p>}
      {pasados.length > 0 && (
        <>
          <h4 style={{ margin: '16px 0 8px', fontSize: 13, color: '#aaa' }}>Pasados</h4>
          {pasados.slice(0, 10).map(e => <EventoRow key={e.id} e={e} />)}
        </>
      )}
    </div>
  )
}

function Avatar({ nombre, foto, size = 48 }) {
  return foto
    ? <img src={foto} alt={nombre} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2.5px solid ${ORANGE}` }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
        {nombre?.charAt(0) || '?'}
      </div>
}

function fecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function PagosTab({ alumnoId }) {
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPagos({ alumno_id: alumnoId }).then(r => setPagos(r.rows ?? r)).catch(() => setPagos([])).finally(() => setLoading(false))
  }, [alumnoId])

  if (loading) return <p style={muted}>Cargando...</p>
  if (pagos.length === 0) return <p style={muted}>Sin pagos pendientes.</p>

  const pendientes = pagos.filter(p => p.estado === 'pendiente')
  const historial  = pagos.filter(p => p.estado !== 'pendiente')

  return (
    <div>
      {pendientes.length > 0 && (
        <>
          <h4 style={{ margin: '0 0 10px', color: '#e67e22' }}>⚠️ Pagos pendientes</h4>
          {pendientes.map(p => (
            <div key={p.id} style={{ border: '1.5px solid #f0a500', borderRadius: 10, padding: '12px 16px', marginBottom: 8, background: 'rgba(241,139,17,.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{p.concepto}</span>
                <span style={{ fontWeight: 700, color: ORANGE, fontSize: 15 }}>${Number(p.monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Vencimiento: {fecha(p.fecha_limite)}</div>
            </div>
          ))}
        </>
      )}
      {historial.length > 0 && (
        <>
          <h4 style={{ margin: '16px 0 10px', color: '#555' }}>Historial</h4>
          <div className="tabla-wrap">
            <table className="tabla chica">
              <thead><tr><th>Concepto</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                {historial.map(p => (
                  <tr key={p.id}>
                    <td>{p.concepto}</td>
                    <td>${Number(p.monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td><span className={'badge ' + p.estado}>{p.estado}</span></td>
                    <td>{fecha(p.fecha_pago || p.fecha_limite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function AsistenciaTab({ alumnoId }) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAsistencias({ alumno_id: alumnoId }).then(setRegistros).catch(() => setRegistros([])).finally(() => setLoading(false))
  }, [alumnoId])

  if (loading) return <p style={muted}>Cargando...</p>
  if (registros.length === 0) return <p style={muted}>Sin registros de asistencia.</p>

  const total = registros.length
  const presentes = registros.filter(r => r.asistio === 1 || r.asistio === true).length
  const pct = total > 0 ? Math.round((presentes / total) * 100) : 0
  const color = pct >= 80 ? '#27ae60' : pct >= 60 ? '#f39c12' : '#e74c3c'

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total clases', val: total, color: '#555' },
          { label: 'Presentes', val: presentes, color: '#27ae60' },
          { label: 'Ausentes', val: total - presentes, color: '#e74c3c' },
          { label: '% Asistencia', val: `${pct}%`, color },
        ].map(({ label, val, color: c }) => (
          <div key={label} style={{ flex: '1 1 90px', background: '#fff', border: `1.5px solid ${c}33`, borderRadius: 10, padding: '10px 14px', minWidth: 80 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{val}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
          </div>
        ))}
      </div>
      <div className="tabla-wrap">
        <table className="tabla chica">
          <thead><tr><th>Fecha</th><th>Asistencia</th><th>Justificación</th></tr></thead>
          <tbody>
            {registros.slice(0, 30).map(r => (
              <tr key={r.id}>
                <td>{fecha(r.fecha)}</td>
                <td>
                  <span style={{ fontWeight: 700, color: (r.asistio === 1 || r.asistio === true) ? '#27ae60' : '#e74c3c' }}>
                    {(r.asistio === 1 || r.asistio === true) ? '✓ Presente' : '✗ Ausente'}
                  </span>
                </td>
                <td style={{ color: '#888', fontSize: 12 }}>{r.justificacion || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CalificacionesTab({ alumnoId }) {
  const [evals, setEvals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getEvaluaciones({ alumno_id: alumnoId }).then(setEvals).catch(() => setEvals([])).finally(() => setLoading(false))
  }, [alumnoId])

  if (loading) return <p style={muted}>Cargando...</p>
  if (evals.length === 0) return <p style={muted}>Sin evaluaciones registradas.</p>

  const nums = evals.map(e => Number(e.calificacion)).filter(n => !isNaN(n))
  const prom = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—'
  const promColor = Number(prom) >= 8 ? '#27ae60' : Number(prom) >= 6 ? '#f39c12' : '#e74c3c'

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 90px', background: '#fff', border: `1.5px solid ${promColor}33`, borderRadius: 10, padding: '10px 14px', minWidth: 90 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: promColor }}>{prom}</div>
          <div style={{ fontSize: 11, color: '#888' }}>Promedio general</div>
        </div>
        <div style={{ flex: '1 1 90px', background: '#fff', border: '1.5px solid #2980b933', borderRadius: 10, padding: '10px 14px', minWidth: 90 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#2980b9' }}>{evals.length}</div>
          <div style={{ fontSize: 11, color: '#888' }}>Evaluaciones</div>
        </div>
      </div>
      <div className="tabla-wrap">
        <table className="tabla chica">
          <thead><tr><th>Tipo</th><th>Calificación</th><th>Fecha</th><th>Observaciones</th></tr></thead>
          <tbody>
            {evals.map(e => {
              const cal = Number(e.calificacion)
              const calColor = cal >= 8 ? '#27ae60' : cal >= 6 ? '#f39c12' : '#e74c3c'
              return (
                <tr key={e.id}>
                  <td style={{ textTransform: 'capitalize' }}>{e.tipo || '—'}</td>
                  <td><span style={{ fontWeight: 700, color: calColor, fontSize: 15 }}>{e.calificacion}</span></td>
                  <td>{fecha(e.fecha)}</td>
                  <td style={{ color: '#888', fontSize: 12 }}>{e.observaciones || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SolicitudesPendientes({ onAprobada }) {
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const cargar = () => {
    api.getTutorSolicitudes().then(data => setSolicitudes(Array.isArray(data) ? data.filter(s => s.estado === 'pendiente') : []))
      .catch(() => setSolicitudes([])).finally(() => setLoading(false))
  }
  useEffect(cargar, [])

  const resolver = async (id, accion) => {
    setBusy(id)
    try {
      await api.resolverTutorSolicitud(id, accion)
      if (accion === 'aprobar') onAprobada()
      cargar()
    } catch (e) { alert(e.message || 'Error') } finally { setBusy(null) }
  }

  if (loading || solicitudes.length === 0) return null

  return (
    <div className="card" style={{ marginBottom: 20, border: `1.5px solid ${ORANGE}44`, background: `rgba(241,139,17,.04)` }}>
      <h4 style={{ margin: '0 0 12px', color: ORANGE, fontSize: 14 }}>🔔 Solicitudes de vinculación pendientes</h4>
      {solicitudes.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
          <Avatar nombre={s.alumno_nombre} foto={s.foto_perfil} size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{s.alumno_nombre}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{s.alumno_email}</div>
          </div>
          <button onClick={() => resolver(s.id, 'aprobar')} disabled={busy === s.id}
            style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            ✓ Aprobar
          </button>
          <button onClick={() => resolver(s.id, 'rechazar')} disabled={busy === s.id}
            style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            ✗ Rechazar
          </button>
        </div>
      ))}
    </div>
  )
}

export default function MisMenores() {
  const [menores, setMenores] = useState([])
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState(null)
  const [tab, setTab] = useState('pagos')

  const cargarMenores = () => {
    api.getMisAlumnos().then(data => {
      setMenores(data)
      if (data.length === 1) setSeleccionado(data[0])
    }).catch(() => setMenores([]))
  }

  useEffect(() => {
    cargarMenores()
    setLoading(false)
  }, [])

  if (loading) return <div style={{ padding: 32, color: '#888' }}>Cargando...</div>

  const TABS = [
    { id: 'pagos', label: '💳 Pagos' },
    { id: 'asistencia', label: '✓ Asistencia' },
    { id: 'calificaciones', label: '📊 Calificaciones' },
    { id: 'calendario', label: '📅 Calendario' },
  ]

  return (
    <div>
      <div className="page-header"><h2>Mis Menores</h2></div>

      <SolicitudesPendientes onAprobada={() => { cargarMenores() }} />

      {menores.length === 0 ? (
        <div className="card texto-muted" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👨‍👩‍👧‍👦</div>
          <p>No tienes alumnos menores asociados a tu cuenta.</p>
          <p style={{ fontSize: 13 }}>Contacta a la coordinación para vincular tu perfil.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Lista de menores */}
          <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {menores.map(m => (
              <div key={m.id} onClick={() => { setSeleccionado(m); setTab('pagos') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                  border: seleccionado?.id === m.id ? `2px solid ${ORANGE}` : '1.5px solid rgba(0,0,0,.12)',
                  background: seleccionado?.id === m.id ? `rgba(241,139,17,.06)` : '#fff',
                  transition: 'all .15s',
                }}>
                <Avatar nombre={m.nombre} foto={m.foto_perfil} size={42} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#222' }}>{m.nombre}</div>
                  {m.fecha_nacimiento && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                      {new Date().getFullYear() - new Date(m.fecha_nacimiento).getFullYear()} años
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Panel del menor seleccionado */}
          {seleccionado && (
            <div style={{ flex: 1, minWidth: 280 }} className="card">
              {/* Header del menor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                <Avatar nombre={seleccionado.nombre} foto={seleccionado.foto_perfil} size={56} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{seleccionado.nombre}</div>
                  <div style={{ fontSize: 13, color: '#888' }}>{seleccionado.email}</div>
                  {seleccionado.matricula && <div style={{ fontSize: 12, color: '#aaa' }}>Matrícula: {seleccionado.matricula}</div>}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1.5px solid rgba(0,0,0,.08)', marginBottom: 16, gap: 0 }}>
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    padding: '9px 18px', border: 'none', cursor: 'pointer', fontWeight: tab === t.id ? 700 : 400,
                    color: tab === t.id ? ORANGE : '#666', fontSize: 13, background: 'none',
                    borderBottom: `2.5px solid ${tab === t.id ? ORANGE : 'transparent'}`, marginBottom: -1.5,
                    fontFamily: 'inherit',
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Contenido */}
              {tab === 'pagos'          && <PagosTab          alumnoId={seleccionado.id} />}
              {tab === 'asistencia'     && <AsistenciaTab     alumnoId={seleccionado.id} />}
              {tab === 'calificaciones' && <CalificacionesTab alumnoId={seleccionado.id} />}
              {tab === 'calendario'     && <CalendarioTab />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const muted = { color: '#888', fontSize: 14, padding: '16px 0' }
