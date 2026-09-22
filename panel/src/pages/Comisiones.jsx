import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../App.jsx'
import * as api from '../api.js'

const ORANGE = '#F18B11'

function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 }) }
function fmtFecha(s) { return s ? new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }

export default function Comisiones() {
  const { usuario } = useAuth()
  const [resumen, setResumen] = useState([])
  const [detalle, setDetalle] = useState([])
  const [plantelFiltro, setPlantelFiltro] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('pendiente')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [cobrando, setCobrando] = useState(null)
  const [vista, setVista] = useState('resumen') // 'resumen' | 'detalle'

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const [res, det] = await Promise.all([
        api.getComisionesResumen(),
        api.getComisiones({ estado: estadoFiltro, plantel_id: plantelFiltro }),
      ])
      setResumen(res)
      setDetalle(det)
    } catch (e) { setError(e.message || 'Error cargando comisiones') }
    finally { setCargando(false) }
  }, [estadoFiltro, plantelFiltro])

  useEffect(() => { cargar() }, [cargar])

  async function cobrarTodas(plantelId, plantelNombre) {
    if (!confirm(`¿Marcar TODAS las comisiones pendientes de "${plantelNombre}" como cobradas?`)) return
    setCobrando(plantelId)
    try {
      await api.cobrarTodasComisiones(plantelId)
      await cargar()
    } catch (e) { alert('Error: ' + (e.message || 'Error')) }
    finally { setCobrando(null) }
  }

  async function cobrarUna(id) {
    setCobrando(id)
    try {
      await api.cobrarComision(id)
      await cargar()
    } catch (e) { alert('Error: ' + (e.message || 'Error')) }
    finally { setCobrando(null) }
  }

  if (!['superadmin', 'director'].includes(usuario?.rol)) {
    return <div className="card"><p className="texto-muted">Sin permiso para ver esta sección.</p></div>
  }

  const totalPendiente = resumen.reduce((s, r) => s + Number(r.monto_pendiente || 0), 0)
  const totalCobrado   = resumen.reduce((s, r) => s + Number(r.monto_cobrado || 0), 0)
  const totalGeneral   = resumen.reduce((s, r) => s + Number(r.monto_total || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Comisiones INJUVE</h2>
        <span style={{ background: '#fff3e0', color: ORANGE, borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>
          $200 por inscripción
        </span>
      </div>

      {/* Métricas globales */}
      <div className="metricas-grid" style={{ marginBottom: 24 }}>
        <div className="metrica-card naranja">
          <div className="metrica-num">{fmt(totalPendiente)}</div>
          <div className="metrica-label">Pendiente de cobro</div>
        </div>
        <div className="metrica-card verde">
          <div className="metrica-num">{fmt(totalCobrado)}</div>
          <div className="metrica-label">Ya cobrado</div>
        </div>
        <div className="metrica-card">
          <div className="metrica-num">{fmt(totalGeneral)}</div>
          <div className="metrica-label">Total acumulado</div>
        </div>
        <div className="metrica-card">
          <div className="metrica-num">{resumen.reduce((s, r) => s + Number(r.total || 0), 0)}</div>
          <div className="metrica-label">Inscripciones con comisión</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['resumen', 'Resumen por escuela'], ['detalle', 'Detalle por comisión']].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: vista === v ? ORANGE : 'var(--fondo-card)', color: vista === v ? '#fff' : 'var(--texto)',
              fontWeight: 600, fontSize: 14 }}>
            {l}
          </button>
        ))}
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {cargando && <p className="texto-muted">Cargando…</p>}

      {/* VISTA RESUMEN */}
      {!cargando && vista === 'resumen' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {resumen.length === 0
            ? <p className="texto-muted" style={{ padding: 24 }}>Sin comisiones registradas.</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--fondo)', borderBottom: '2px solid var(--borde)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Escuela</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Inscripciones</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#e67e22' }}>Pendiente</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#27ae60' }}>Cobrado</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '12px 16px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map(r => (
                    <tr key={r.plantel_id} style={{ borderBottom: '1px solid var(--borde)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.plantel_nombre || r.plantel_id}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{r.total}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#e67e22', fontWeight: 700 }}>
                        {fmt(r.monto_pendiente)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#27ae60' }}>
                        {fmt(r.monto_cobrado)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmt(r.monto_total)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {Number(r.monto_pendiente) > 0 && (
                          <button
                            onClick={() => cobrarTodas(r.plantel_id, r.plantel_nombre)}
                            disabled={cobrando === r.plantel_id}
                            style={{ background: ORANGE, color: '#fff', border: 'none', borderRadius: 6,
                              padding: '6px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {cobrando === r.plantel_id ? 'Marcando…' : '✓ Marcar cobradas'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {/* VISTA DETALLE */}
      {!cargando && vista === 'detalle' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--borde)', background: 'var(--fondo-card)', color: 'var(--texto)' }}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="cobrada">Cobradas</option>
            </select>
            <select value={plantelFiltro} onChange={e => setPlantelFiltro(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--borde)', background: 'var(--fondo-card)', color: 'var(--texto)' }}>
              <option value="">Todas las escuelas</option>
              {resumen.map(r => <option key={r.plantel_id} value={r.plantel_id}>{r.plantel_nombre || r.plantel_id}</option>)}
            </select>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {detalle.length === 0
              ? <p className="texto-muted" style={{ padding: 24 }}>Sin registros con los filtros aplicados.</p>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'var(--fondo)', borderBottom: '2px solid var(--borde)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Escuela</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Concepto</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Fecha</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Monto</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '12px 16px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--borde)' }}>
                        <td style={{ padding: '10px 16px' }}>{c.plantel_nombre || c.plantel_id}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--texto-muted)', fontSize: 13 }}>{c.concepto}</td>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{fmtFecha(c.fecha)}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(c.monto)}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <span style={{
                            background: c.estado === 'cobrada' ? '#d4edda' : '#fff3cd',
                            color: c.estado === 'cobrada' ? '#155724' : '#856404',
                            borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700
                          }}>
                            {c.estado === 'cobrada' ? 'Cobrada' : 'Pendiente'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {c.estado === 'pendiente' && (
                            <button
                              onClick={() => cobrarUna(c.id)}
                              disabled={cobrando === c.id}
                              style={{ background: 'transparent', border: '1px solid ' + ORANGE, color: ORANGE,
                                borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                              {cobrando === c.id ? '…' : '✓ Cobrar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}
    </div>
  )
}
