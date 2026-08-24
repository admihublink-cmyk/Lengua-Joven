import { useEffect, useState } from 'react'
import * as api from '../api'
import { useAuth } from '../App'

const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function periodoActual() {
  return new Date().toISOString().slice(0, 7)
}

function periodoLabel(p) {
  if (!p) return ''
  const [y, m] = p.split('-')
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${nombres[parseInt(m) - 1]} ${y}`
}

// Lista de períodos recientes (últimos 12 meses)
function periodosRecientes() {
  const lista = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
    lista.push(d.toISOString().slice(0, 7))
  }
  return lista
}

export default function PagosMaestros() {
  const { usuario } = useAuth()
  const [periodo, setPeriodo] = useState(periodoActual)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState(null) // { maestro_id, horas, notas }
  const [detalle, setDetalle] = useState(null)   // { maestro, sesiones, horas, monto }
  const [msg, setMsg] = useState(null)

  async function cargar() {
    setLoading(true)
    try {
      setData(await api.getPagosMaestro(periodo))
    } catch (e) {
      notif('error', e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [periodo])

  function notif(tipo, texto) {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 5000)
  }

  async function guardar(maestroId, campos) {
    try {
      await api.actualizarPagoMaestro({ maestro_id: maestroId, periodo, ...campos })
      setEditando(null)
      await cargar()
    } catch (e) { notif('error', e.message) }
  }

  async function verDetalle(maestroId, maestroNombre) {
    try {
      const r = await api.recalcularHorasMaestro(maestroId, periodo)
      setDetalle({ maestro: maestroNombre, ...r })
    } catch (e) { notif('error', e.message) }
  }

  async function exportar() {
    try { await api.exportarPagosMaestroCSV(periodo) }
    catch (e) { notif('error', e.message) }
  }

  const rows = data?.rows || []
  const pendientes = rows.filter(r => r.estado === 'pendiente' && r.horas > 0)
  const pagados = rows.filter(r => r.estado === 'pagado')

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Pagos a Maestros</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
          >
            {periodosRecientes().map(p => (
              <option key={p} value={p}>{periodoLabel(p)}</option>
            ))}
          </select>
          <button
            onClick={exportar}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, cursor: 'pointer', background: '#fff' }}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 16,
          background: msg.tipo === 'ok' ? '#d1fae5' : '#fee2e2',
          color: msg.tipo === 'ok' ? '#065f46' : '#991b1b',
        }}>
          {msg.texto}
        </div>
      )}

      {/* Resumen */}
      {data && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Total del período', valor: pesos(data.total), color: '#1d4ed8' },
            { label: 'Pendiente de pago', valor: pesos(data.pendiente), color: '#b45309' },
            { label: 'Pagado', valor: pesos(data.pagado), color: '#065f46' },
            { label: 'Tarifa hora', valor: pesos(data.tarifa), color: '#6b7280' },
          ].map(c => (
            <div key={c.label} style={{ flex: '1 1 160px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.valor}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6b7280' }}>Cargando…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No hay profesores registrados en este período.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={th}>Maestro</th>
                <th style={{ ...th, textAlign: 'right' }}>Horas</th>
                <th style={{ ...th, textAlign: 'right' }}>Monto</th>
                <th style={th}>Estado</th>
                <th style={th}>Notas</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.maestro_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={td}>
                    <button
                      onClick={() => verDetalle(r.maestro_id, r.maestro)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', textDecoration: 'underline', padding: 0, fontSize: 14 }}
                    >
                      {r.maestro}
                    </button>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {editando?.maestro_id === r.maestro_id ? (
                      <input
                        type="number" min="0" step="0.5"
                        value={editando.horas}
                        onChange={e => setEditando(v => ({ ...v, horas: e.target.value }))}
                        style={{ width: 70, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
                      />
                    ) : (
                      <span style={{ color: r.horas === 0 ? '#9ca3af' : '#111' }}>{r.horas}h</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {pesos(r.monto)}
                  </td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: r.estado === 'pagado' ? 'rgba(5,150,105,.12)' : 'rgba(217,119,6,.12)',
                      color: r.estado === 'pagado' ? '#065f46' : '#b45309',
                    }}>
                      {r.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                    </span>
                  </td>
                  <td style={td}>
                    {editando?.maestro_id === r.maestro_id ? (
                      <input
                        type="text" placeholder="Notas opcionales"
                        value={editando.notas}
                        onChange={e => setEditando(v => ({ ...v, notas: e.target.value }))}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    ) : (
                      <span style={{ color: '#6b7280', fontSize: 13 }}>{r.notas || '—'}</span>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {editando?.maestro_id === r.maestro_id ? (
                      <>
                        <button onClick={() => guardar(r.maestro_id, { horas: parseFloat(editando.horas) || 0, notas: editando.notas })}
                          style={btnSmall('#2563eb')}>Guardar</button>
                        <button onClick={() => setEditando(null)} style={{ ...btnSmall('#6b7280'), marginLeft: 4 }}>✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditando({ maestro_id: r.maestro_id, horas: r.horas, notas: r.notas || '' })}
                          style={btnSmall('#6b7280')}>Editar</button>
                        <button
                          onClick={() => guardar(r.maestro_id, { estado: r.estado === 'pagado' ? 'pendiente' : 'pagado' })}
                          style={{ ...btnSmall(r.estado === 'pagado' ? '#b45309' : '#065f46'), marginLeft: 4 }}
                        >
                          {r.estado === 'pagado' ? 'Desmarcar' : 'Marcar pagado'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                <td style={{ ...td, fontWeight: 600 }}>Total</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{rows.reduce((s, r) => s + r.horas, 0)}h</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pesos(data?.total)}</td>
                <td colSpan={3} style={td} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal detalle de sesiones */}
      {detalle && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ background: 'var(--fondo)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Sesiones — {detalle.maestro}</h3>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
              {periodoLabel(periodo)} · {detalle.horas}h · {pesos(detalle.monto)}
            </p>
            {detalle.detalle.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No hay sesiones únicas registradas en este período. Las sesiones semanales recurrentes no se calculan automáticamente — edita las horas manualmente.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={th}>Fecha</th>
                    <th style={th}>Grupo</th>
                    <th style={th}>Sesión</th>
                    <th style={{ ...th, textAlign: 'right' }}>Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.detalle.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={td}>{s.fecha}</td>
                      <td style={td}>{s.grupo}</td>
                      <td style={td}>{s.titulo || '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {s.hora_inicio && s.hora_fin ? `${s.hora_inicio}–${s.hora_fin}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
              Solo se muestran sesiones de tipo "única" (fecha específica). Para editar las horas totales, usa el botón Editar en la tabla.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

const th = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }
const td = { padding: '10px 12px', color: '#374151', verticalAlign: 'middle' }
const btnSmall = (color) => ({
  fontSize: 12, padding: '4px 10px', borderRadius: 4,
  border: `1px solid ${color}`, color, background: 'transparent', cursor: 'pointer'
})
