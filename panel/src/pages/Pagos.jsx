import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

const METODOS = ['ventanilla', 'terminal', 'liga_pago']
const METODOS_LABEL = { ventanilla: 'Ventanilla', terminal: 'Terminal', liga_pago: 'Liga de pago' }
const ESTADOS_PAGO = ['pendiente', 'pagado', 'cancelado']

function parsearCSVPagos(texto) {
  const lineas = texto.trim().split('\n').filter(l => l.trim())
  if (lineas.length < 2) return null
  const sep = lineas[0].includes('\t') ? '\t' : ','
  const heads = lineas[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  const ci = (...ws) => heads.findIndex(h => ws.some(w => h.includes(w)))
  const iEmail  = ci('correo', 'email', 'mail')
  const iNombre = ci('nombre', 'name', 'alumno')
  const iMonto  = ci('monto', 'importe', 'amount', 'cantidad')
  const iFecha  = ci('fecha', 'date')
  const iMetodo = ci('metodo', 'método', 'forma', 'pago')
  const iRef    = ci('referencia', 'ref', 'comprobante', 'folio')

  const filas = lineas.slice(1).map(l => {
    const cols = l.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    return {
      email:      iEmail  >= 0 ? cols[iEmail]  : '',
      nombre:     iNombre >= 0 ? cols[iNombre] : '',
      monto:      iMonto  >= 0 ? cols[iMonto]  : '0',
      fecha:      iFecha  >= 0 ? cols[iFecha]  : '',
      metodo_pago:iMetodo >= 0 ? cols[iMetodo] : 'ventanilla',
      referencia: iRef    >= 0 ? cols[iRef]    : '',
    }
  }).filter(f => f.email || f.nombre)

  return { filas, detectado: { email: iEmail >= 0, monto: iMonto >= 0 } }
}

function fechaHoy() { return new Date().toISOString().slice(0, 10) }
function fecha30DiasAtras() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
}

export default function Pagos() {
  const { usuario, tienePermiso } = useAuth()
  const [pagos, setPagos] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [modal, setModal] = useState(false)
  const [modalBanco, setModalBanco] = useState(false)
  const [modalCSV, setModalCSV] = useState(false)
  const [modalTxt, setModalTxt] = useState(false)
  const [form, setForm] = useState({ inscripcion_id: '', monto: 1500, metodo_pago: 'ventanilla', referencia: '', estado: 'pagado' })
  const [refBanco, setRefBanco] = useState('')
  const [resultadoBanco, setResultadoBanco] = useState(null)
  const [busca, setBusca] = useState('')
  const [csvTexto, setCsvTexto] = useState('')
  const [csvFilas, setCsvFilas] = useState([])
  const [csvErr, setCsvErr] = useState('')
  const [txtDesde, setTxtDesde] = useState(fecha30DiasAtras())
  const [txtHasta, setTxtHasta] = useState(fechaHoy())
  const [descargando, setDescargando] = useState(false)

  async function cargar() {
    try {
      const [p, ins, u] = await Promise.all([
        api.getPagos(),
        api.getInscripciones(),
        api.getUsuarios(),
      ])
      setPagos(p)
      setInscripciones(ins)
      setUsuarios(u)
    } catch (e) {
      console.error('Error cargando pagos:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  function nomAlumno(ins_id) {
    const ins = inscripciones.find(i => i.id === ins_id)
    if (!ins) return '—'
    if (ins.alumno_id) return usuarios.find(u => u.id === ins.alumno_id)?.nombre || '—'
    return ins.nombre_externo || '—'
  }
  function nomFolio(ins_id) { return inscripciones.find(i => i.id === ins_id)?.folio || '—' }

  const filtrados = pagos.filter(p => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return [nomAlumno(p.inscripcion_id), nomFolio(p.inscripcion_id), p.referencia].some(v => (v || '').toLowerCase().includes(q))
  })

  const totalPagado = pagos.filter(p => p.estado === 'pagado').reduce((s, p) => s + (p.monto || 0), 0)
  const totalPendiente = pagos.filter(p => p.estado === 'pendiente').reduce((s, p) => s + (p.monto || 0), 0)

  async function guardar() {
    if (!form.inscripcion_id || !form.monto) return alert('Selecciona inscripción y monto.')
    try {
      await api.crearPago({ ...form, monto: Number(form.monto), fecha: new Date().toISOString().slice(0, 10) })
      if (form.estado === 'pagado') {
        await api.actualizarInscripcion(form.inscripcion_id, { estado: 'pagada' })
      }
      setModal(false)
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  async function confirmarPago(p) {
    try {
      await api.actualizarPago(p.id, { estado: 'pagado', fecha: new Date().toISOString().slice(0, 10) })
      if (p.inscripcion_id) {
        await api.actualizarInscripcion(p.inscripcion_id, { estado: 'pagada' })
      }
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  function procesarNotificacionBanco() {
    if (!refBanco.trim()) return
    const pago = pagos.find(p => p.referencia?.toLowerCase() === refBanco.trim().toLowerCase() && p.estado === 'pendiente')
    if (!pago) { setResultadoBanco(undefined); return }
    confirmarPago(pago).then(() => {
      setResultadoBanco(pago)
    })
  }

  return (
    <div>
      <div className="page-header">
        <h2>Pagos</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tienePermiso(P.PAGO_REGISTRAR) && (
            <button className="btn-sec" onClick={() => setModalTxt(true)}>⬇ Descargar TXT</button>
          )}
          {tienePermiso(P.PAGO_REGISTRAR) && (
            <button className="btn-sec" onClick={() => { setCsvTexto(''); setCsvFilas([]); setCsvErr(''); setModalCSV(true) }}>
              📥 Importar CSV
            </button>
          )}
          {tienePermiso(P.PAGO_REGISTRAR) && (
            <button className="btn-sec" onClick={() => { setModalBanco(true); setRefBanco(''); setResultadoBanco(null) }}>
              Notificación bancaria
            </button>
          )}
          {tienePermiso(P.PAGO_REGISTRAR) && (
            <button className="btn-primario" onClick={() => {
              setForm({ inscripcion_id: '', monto: 1500, metodo_pago: 'ventanilla', referencia: 'REF-' + Date.now().toString().slice(-4), estado: 'pagado' })
              setModal(true)
            }}>+ Registrar pago</button>
          )}
        </div>
      </div>

      {usuario.rol !== 'alumno' && (
        <div className="metricas-grid chico">
          <div className="metrica-card verde">
            <div className="metrica-num">${totalPagado.toLocaleString()}</div>
            <div className="metrica-label">Ingresos recibidos</div>
          </div>
          <div className="metrica-card">
            <div className="metrica-num">${totalPendiente.toLocaleString()}</div>
            <div className="metrica-label">Pendiente de cobro</div>
          </div>
        </div>
      )}

      <div className="filtros-bar">
        <input placeholder="Buscar alumno, folio, referencia…" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Folio</th><th>Alumno</th><th>Monto</th><th>Método</th>
              <th>Referencia</th><th>Fecha</th><th>Estado</th>
              {tienePermiso(P.PAGO_REGISTRAR) && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.map(p => (
              <tr key={p.id}>
                <td><code>{nomFolio(p.inscripcion_id)}</code></td>
                <td>{nomAlumno(p.inscripcion_id)}</td>
                <td><strong>${(p.monto || 0).toLocaleString()}</strong></td>
                <td>{METODOS_LABEL[p.metodo_pago] || p.metodo_pago || '—'}</td>
                <td className="texto-muted">{p.referencia || '—'}</td>
                <td>{p.fecha || '—'}</td>
                <td><span className={'badge ' + (p.estado === 'pagado' ? 'asignada' : p.estado === 'pendiente' ? 'nueva' : 'baja')}>{p.estado}</span></td>
                {tienePermiso(P.PAGO_REGISTRAR) && (
                  <td>
                    {p.estado === 'pendiente' && (
                      <button className="btn-mini" onClick={() => confirmarPago(p)}>Confirmar</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={8} className="tabla-vacio">Sin pagos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal titulo="Registrar pago" onClose={() => setModal(false)}>
          <label>Inscripción *
            <select value={form.inscripcion_id} onChange={e => setForm({ ...form, inscripcion_id: e.target.value })}>
              <option value="">Seleccionar…</option>
              {inscripciones.filter(i => !['asignada', 'baja'].includes(i.estado)).map(i => (
                <option key={i.id} value={i.id}>{i.folio} — {i.nombre_externo || i.alumno_id}</option>
              ))}
            </select>
          </label>
          <label>Monto ($) *
            <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
          </label>
          <label>Método de pago
            <select value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })}>
              {METODOS.map(m => <option key={m} value={m}>{METODOS_LABEL[m]}</option>)}
            </select>
          </label>
          <label>Referencia / No. de comprobante
            <input value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} />
          </label>
          <label>Estado
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS_PAGO.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primario" onClick={guardar}>Registrar</button>
          </div>
        </Modal>
      )}

      {/* Modal: Descargar TXT */}
      {modalTxt && (
        <Modal titulo="⬇ Descargar reporte de pagos" onClose={() => setModalTxt(false)} ancho={420}>
          <p className="texto-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Selecciona el rango de fechas del reporte. Se descargará un archivo .txt con todos los pagos del período.
          </p>
          <label>Desde
            <input type="date" value={txtDesde} onChange={e => setTxtDesde(e.target.value)} />
          </label>
          <label>Hasta
            <input type="date" value={txtHasta} onChange={e => setTxtHasta(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
            <button className="btn-sec" style={{ fontSize: 12 }} onClick={() => { setTxtDesde(fecha30DiasAtras()); setTxtHasta(fechaHoy()) }}>
              Últimos 30 días
            </button>
            <button className="btn-sec" style={{ fontSize: 12 }} onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 7)
              setTxtDesde(d.toISOString().slice(0, 10)); setTxtHasta(fechaHoy())
            }}>
              Últimos 7 días
            </button>
          </div>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModalTxt(false)}>Cancelar</button>
            <button className="btn-primario" disabled={descargando} onClick={async () => {
              setDescargando(true)
              try { await api.descargarPagosTxt(txtDesde, txtHasta); setModalTxt(false) }
              catch (e) { alert('Error: ' + e.message) }
              finally { setDescargando(false) }
            }}>
              {descargando ? 'Generando...' : '⬇ Descargar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Importar pagos CSV */}
      {modalCSV && (
        <Modal titulo="📥 Importar pagos desde CSV" onClose={() => setModalCSV(false)} ancho={560}>
          <p className="texto-muted" style={{ fontSize: 13, marginBottom: 8 }}>
            Pega aquí el contenido del CSV con los pagos. Columnas esperadas:
          </p>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '8px 14px', fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}>
            correo, nombre, monto, fecha, metodo_pago, referencia
          </div>
          <textarea rows={6} value={csvTexto}
            onChange={e => { setCsvTexto(e.target.value); setCsvFilas([]); setCsvErr('') }}
            placeholder={'correo,nombre,monto,fecha,metodo_pago,referencia\nalumno@gmail.com,Juan Pérez,1500,2026-08-04,transferencia,REF-001'}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
          />
          {csvErr && <div className="alerta error" style={{ marginTop: 8 }}>{csvErr}</div>}

          {csvFilas.length === 0 && (
            <div className="modal-acciones">
              <button className="btn-sec" onClick={() => setModalCSV(false)}>Cancelar</button>
              <button className="btn-primario" onClick={() => {
                setCsvErr('')
                if (!csvTexto.trim()) { setCsvErr('Pega los datos primero.'); return }
                const res = parsearCSVPagos(csvTexto)
                if (!res || res.filas.length === 0) { setCsvErr('No se encontraron filas válidas.'); return }
                if (!res.detectado.monto) { setCsvErr('No se detectó columna de monto.'); return }
                setCsvFilas(res.filas)
              }}>Analizar</button>
            </div>
          )}

          {csvFilas.length > 0 && (
            <>
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <p className="texto-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Se importarán <strong>{csvFilas.length}</strong> pagos:
                </p>
                <table className="tabla" style={{ fontSize: 12 }}>
                  <thead>
                    <tr><th>#</th><th>Correo</th><th>Nombre</th><th>Monto</th><th>Fecha</th><th>Método</th><th>Ref.</th></tr>
                  </thead>
                  <tbody>
                    {csvFilas.map((f, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{f.email || '—'}</td>
                        <td>{f.nombre || '—'}</td>
                        <td>${parseFloat(f.monto || 0).toLocaleString()}</td>
                        <td>{f.fecha || '(hoy)'}</td>
                        <td>{f.metodo_pago || 'efectivo'}</td>
                        <td>{f.referencia || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-acciones">
                <button className="btn-sec" onClick={() => setCsvFilas([])}>← Volver</button>
                <button className="btn-primario" onClick={async () => {
                  try {
                    const r = await api.importarPagosCSV(csvFilas)
                    setModalCSV(false); setCsvTexto(''); setCsvFilas([])
                    await cargar()
                    alert(`✅ ${r.importados} pago${r.importados !== 1 ? 's' : ''} importado${r.importados !== 1 ? 's' : ''} correctamente.`)
                  } catch (e) { alert('Error: ' + e.message) }
                }}>Confirmar importación</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {modalBanco && (
        <Modal titulo="Procesar notificación bancaria" onClose={() => setModalBanco(false)} ancho={500}>
          <p className="texto-muted" style={{ marginBottom: 16 }}>
            Ingresa el número de referencia recibido del banco para conciliar el pago y actualizar automáticamente el estatus de la inscripción.
          </p>
          <label>Número de referencia bancaria *
            <input value={refBanco} onChange={e => setRefBanco(e.target.value)}
              placeholder="Ej. REF-003" />
          </label>
          {resultadoBanco === null && refBanco && (
            <div className="modal-acciones" style={{ marginTop: 12 }}>
              <button className="btn-primario" onClick={procesarNotificacionBanco}>Procesar</button>
            </div>
          )}
          {resultadoBanco === undefined && (
            <div className="alerta error" style={{ marginTop: 12 }}>
              No se encontró ningún pago pendiente con esa referencia.
            </div>
          )}
          {resultadoBanco && resultadoBanco.id && (
            <div className="alerta" style={{ marginTop: 12, background: 'var(--verde-suave)', borderColor: 'var(--verde)', color: 'var(--verde)' }}>
              Pago conciliado correctamente.<br />
              <strong>Referencia:</strong> {resultadoBanco.referencia}<br />
              <strong>Monto:</strong> ${(resultadoBanco.monto || 0).toLocaleString()}<br />
              <strong>Inscripción actualizada a:</strong> Pagada
            </div>
          )}
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModalBanco(false)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
