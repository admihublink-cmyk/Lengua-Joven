import { useEffect, useState, useCallback } from 'react'
import * as api from '../api'

const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function periodoActual() { return new Date().toISOString().slice(0, 7) }

function periodoLabel(p) {
  if (!p) return ''
  const [y, m] = p.split('-')
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${nombres[parseInt(m) - 1]} ${y}`
}

function periodosRecientes() {
  const lista = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
    lista.push(d.toISOString().slice(0, 7))
  }
  return lista
}

const BADGE = {
  liquidado: { background: '#E7F5EC', color: '#1B7A3D' },
  pendiente:  { background: '#FFF1DE', color: '#B86500' },
}

export default function Liquidaciones() {
  const [periodo, setPeriodo]   = useState(periodoActual)
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState(null)
  const [notasModal, setNotasModal] = useState(null) // { plantel_id, notas }

  function notif(tipo, texto) {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 5000)
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setData(await api.getLiquidaciones(periodo)) }
    catch (e) { notif('error', e.message) }
    finally { setLoading(false) }
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  async function marcar(plantelId, estadoActual) {
    const nuevoEstado = estadoActual === 'liquidado' ? 'pendiente' : 'liquidado'
    try {
      await api.actualizarLiquidacion({ plantel_id: plantelId, periodo, estado: nuevoEstado })
      await cargar()
    } catch (e) { notif('error', e.message) }
  }

  async function guardarNotas(plantelId, notas) {
    try {
      await api.actualizarLiquidacion({ plantel_id: plantelId, periodo, notas })
      setNotasModal(null)
      await cargar()
    } catch (e) { notif('error', e.message) }
  }

  async function exportar() {
    try { await api.exportarLiquidacionesCSV(periodo) }
    catch (e) { notif('error', e.message) }
  }

  const rows = data?.rows || []

  return (
    <div>
      {/* Encabezado */}
      <div className="page-header">
        <div>
          <h2>Liquidaciones por Plantel</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--texto-muted)' }}>
            Cuota Lengua Joven por inscripción: <b>{data ? pesos(data.cuota_lj) : '$200.00'}</b>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input-base" value={periodo} onChange={e => setPeriodo(e.target.value)}
            style={{ padding: '8px 12px', fontSize: 14 }}>
            {periodosRecientes().map(p => <option key={p} value={p}>{periodoLabel(p)}</option>)}
          </select>
          <button className="btn-sec" onClick={exportar}>Exportar CSV</button>
        </div>
      </div>

      {/* Resumen */}
      {data && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: 'Planteles con inscritos', valor: rows.filter(r => r.num_inscripciones > 0).length, unit: '' },
            { label: 'Total inscritos', valor: data.totalInscritos, unit: '' },
            { label: 'Cuota total LJ', valor: pesos(data.totalCuota), unit: '', color: '#B86500' },
            { label: 'A transferir a planteles', valor: pesos(data.totalTransferir), unit: '', color: '#1B7A3D' },
            { label: 'Pendientes de liquidar', valor: data.pendientes, unit: '', color: data.pendientes ? '#B3261E' : undefined },
          ].map(c => (
            <div key={c.label} style={{ flex: '1 1 150px', background: 'var(--bg-2)', border: '1px solid var(--borde)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: 'var(--texto-muted)', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color || 'var(--texto)' }}>{c.valor}</div>
            </div>
          ))}
        </div>
      )}

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 16,
          background: msg.tipo === 'ok' ? '#E7F5EC' : '#FDECEC',
          color: msg.tipo === 'ok' ? '#1B7A3D' : '#B3261E',
          border: `1px solid ${msg.tipo === 'ok' ? '#6ee7b7' : '#fca5a5'}`,
          fontWeight: 600, fontSize: 14,
        }}>
          {msg.texto}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--texto-muted)' }}>Cargando…</div>
      ) : !rows.length ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--texto-muted)', background: 'var(--bg-2)', borderRadius: 12 }}>
          No hay planteles registrados.
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Plantel</th>
                <th style={{ textAlign: 'right' }}>Inscritos</th>
                <th style={{ textAlign: 'right' }}>Cobrado</th>
                <th style={{ textAlign: 'right' }}>Cuota LJ</th>
                <th style={{ textAlign: 'right' }}>A transferir</th>
                <th>Estado</th>
                <th>Notas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.plantel_id} style={r.num_inscripciones === 0 ? { opacity: 0.5 } : undefined}>
                  <td style={{ fontWeight: 600 }}>{r.plantel_nombre}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {r.num_inscripciones}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--texto-muted)', fontSize: 13 }}>
                    {r.cobrado > 0 ? pesos(r.cobrado) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#B86500', fontWeight: 700 }}>
                    {r.num_inscripciones > 0 ? pesos(r.cuota_lj) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1B7A3D', fontWeight: 700 }}>
                    {r.num_inscripciones > 0 ? pesos(r.transferir) : '—'}
                  </td>
                  <td>
                    {r.num_inscripciones > 0 ? (
                      <span className="badge" style={BADGE[r.estado] || BADGE.pendiente}>
                        {r.estado === 'liquidado' ? 'Liquidado' : 'Pendiente'}
                      </span>
                    ) : <span style={{ color: 'var(--texto-muted)', fontSize: 12 }}>Sin movimientos</span>}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--texto-muted)', maxWidth: 180 }}>
                    {r.notas || '—'}
                  </td>
                  <td>
                    {r.num_inscripciones > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn-mini"
                          onClick={() => marcar(r.plantel_id, r.estado)}
                          style={r.estado === 'liquidado'
                            ? { color: '#B86500', borderColor: '#B86500' }
                            : { color: '#1B7A3D', borderColor: '#1B7A3D' }}>
                          {r.estado === 'liquidado' ? 'Desmarcar' : 'Marcar liquidado'}
                        </button>
                        <button className="btn-mini"
                          onClick={() => setNotasModal({ plantel_id: r.plantel_id, nombre: r.plantel_nombre, notas: r.notas || '' })}>
                          Notas
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--borde)', fontWeight: 700 }}>
                <td>Total</td>
                <td style={{ textAlign: 'right' }}>{data?.totalInscritos ?? 0}</td>
                <td />
                <td style={{ textAlign: 'right', color: '#B86500' }}>{pesos(data?.totalCuota)}</td>
                <td style={{ textAlign: 'right', color: '#1B7A3D' }}>{pesos(data?.totalTransferir)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal notas */}
      {notasModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-2)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, border: '1px solid var(--borde)' }}>
            <h3 style={{ margin: '0 0 4px' }}>Notas — {notasModal.nombre}</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--texto-muted)' }}>{periodoLabel(periodo)}</p>
            <textarea
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--borde)', background: 'var(--bg-3)', color: 'var(--texto)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
              value={notasModal.notas}
              onChange={e => setNotasModal(v => ({ ...v, notas: e.target.value }))}
              placeholder="Observaciones sobre esta liquidación…"
              autoFocus
            />
            <div className="modal-acciones">
              <button className="btn-sec" onClick={() => setNotasModal(null)}>Cancelar</button>
              <button className="btn-primario" onClick={() => guardarNotas(notasModal.plantel_id, notasModal.notas)}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
