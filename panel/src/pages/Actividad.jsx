import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import * as api from '../api.js'

const TIPOS = {
  CAMBIO_PASSWORD:       { label: 'Cambio de contraseña', color: '#e67e22', bg: '#fff8f0' },
  RESET_PASSWORD:        { label: 'Restablecimiento vía correo', color: '#8e44ad', bg: '#f8f0ff' },
  SOLICITUD_RECUPERACION:{ label: 'Solicitud de recuperación', color: '#2980b9', bg: '#f0f8ff' },
}

const TAB_TIPOS = {
  passwords: ['CAMBIO_PASSWORD', 'RESET_PASSWORD'],
  recuperaciones: ['SOLICITUD_RECUPERACION'],
}

function fechaHoy() {
  return new Date().toISOString().slice(0, 10)
}
function fecha30DiasAtras() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

export default function Actividad() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('passwords')
  const [logs, setLogs] = useState([])
  const [desde, setDesde] = useState(fecha30DiasAtras())
  const [hasta, setHasta] = useState(fechaHoy())
  const [cargando, setCargando] = useState(false)
  const [descargando, setDescargando] = useState(false)

  if (usuario.rol !== 'superadmin') {
    return <div className="card texto-muted" style={{ padding: 32, textAlign: 'center' }}>Sin acceso.</div>
  }

  async function cargar() {
    setCargando(true)
    try {
      const data = await api.getActividad({ desde, hasta })
      setLogs(data)
    } catch (e) {
      console.error(e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const tiposFiltro = TAB_TIPOS[tab]
  const filtrados = logs.filter(l => tiposFiltro.includes(l.tipo))

  async function descargar() {
    setDescargando(true)
    try {
      await api.descargarActividadTxt({ desde, hasta })
    } catch (e) {
      alert('Error al descargar: ' + e.message)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Panel de actividad</h2>
        <button className="btn-sec" disabled={descargando} onClick={descargar}>
          {descargando ? 'Generando...' : '⬇ Descargar TXT'}
        </button>
      </div>

      {/* Filtro de fechas */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Desde
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            style={{ display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Hasta
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            style={{ display: 'block', marginTop: 4 }} />
        </label>
        <button className="btn-primario" onClick={cargar} disabled={cargando}>
          {cargando ? 'Buscando...' : 'Buscar'}
        </button>
        <button className="btn-sec" onClick={() => { setDesde(fecha30DiasAtras()); setHasta(fechaHoy()) }}>
          Últimos 30 días
        </button>
        <button className="btn-sec" onClick={() => {
          const d = new Date(); d.setDate(d.getDate() - 7)
          setDesde(d.toISOString().slice(0, 10)); setHasta(fechaHoy())
        }}>
          Últimos 7 días
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--borde)' }}>
        {[
          ['passwords', '🔒 Contraseñas'],
          ['recuperaciones', '📧 Recuperaciones'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            background: 'none', border: 'none',
            borderBottom: tab === id ? '2px solid var(--naranja)' : '2px solid transparent',
            color: tab === id ? 'var(--naranja)' : 'var(--texto-muted)', marginBottom: -2,
          }}>
            {label}
            <span style={{ marginLeft: 6, background: tab === id ? 'var(--naranja)' : 'var(--bg-3)', color: tab === id ? '#fff' : 'var(--texto-muted)', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
              {logs.filter(l => TAB_TIPOS[id].includes(l.tipo)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Tabla de logs */}
      {cargando ? (
        <div className="card texto-muted" style={{ padding: 32, textAlign: 'center' }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="card texto-muted" style={{ padding: 32, textAlign: 'center' }}>
          Sin movimientos en el período seleccionado.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(log => {
                const cfg = TIPOS[log.tipo] || {}
                const fecha = new Date(log.fecha).toLocaleString('es-MX', {
                  timeZone: 'America/Monterrey',
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
                return (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fecha}</td>
                    <td style={{ fontWeight: 600 }}>{log.usuario_nombre || '—'}</td>
                    <td style={{ fontSize: 12 }}>{log.usuario_email || '—'}</td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 9, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
                        {cfg.label || log.tipo}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--texto-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.descripcion || '—'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--texto-muted)' }}>{log.ip || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
