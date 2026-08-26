import { useState, useEffect, useCallback } from 'react'
import Modal from '../components/Modal.jsx'

const BASE = (import.meta.env.VITE_API_URL || '') + '/api'
const get = (path) => fetch(`${BASE}${path}`, { credentials: 'include' }).then(r => r.json())
const post = (path, body) => fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
const patch = (path, body) => fetch(`${BASE}${path}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())

const TIPO_ARCO = { acceso: 'Acceso', rectificacion: 'Rectificación', cancelacion: 'Cancelación', oposicion: 'Oposición' }
const TIPO_TITULAR = { alumno: 'Alumno activo', padre: 'Padre / Tutor', ex_alumno: 'Ex alumno', docente: 'Docente', otro: 'Otro' }
const ESTATUS = { pendiente: 'Pendiente', en_proceso: 'En proceso', resuelta: 'Resuelta', vencida: 'Vencida' }
const TIPO_TITULAR_LABEL = { alumnos_tutores: 'Alumnos y tutores', personal: 'Personal / Docentes', becarios: 'Becarios', general: 'General' }

const colorEst = {
  pendiente:  { color: '#B86500', background: '#FFF1DE' },
  en_proceso: { color: '#2D7DD2', background: '#E8F1FB' },
  resuelta:   { color: '#1B7A3D', background: '#E7F5EC' },
  vencida:    { color: '#B3261E', background: '#FDECEC' },
}

const fmtFecha = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}
const fmtCorta = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

const INP = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--borde)', background: 'var(--bg-3)', color: 'var(--texto)', fontSize: 14, fontFamily: 'inherit' }
const LABEL = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, marginTop: 12 }
const ERR = { color: '#B3261E', background: '#FDECEC', borderRadius: 8, padding: '8px 12px', fontSize: 13.5, marginTop: 10 }

function BadgeEst({ est }) {
  const s = colorEst[est] || colorEst.pendiente
  return <span className="badge" style={s}>{ESTATUS[est] || est}</span>
}

// ── Tab 1: Solicitudes ARCO ───────────────────────────────────────────────────

function ModalNueva({ onClose, onGuardar, ocupado, error }) {
  const [v, setV] = useState({ titular_nombre: '', titular_email: '', titular_tipo: '', tipo_arco: '', descripcion: '', documento_url: '' })
  const set = (k) => (e) => setV(s => ({ ...s, [k]: typeof e === 'string' ? e : e.target.value }))
  const listo = v.titular_nombre.trim().length >= 3 && v.titular_tipo && v.tipo_arco

  return (
    <Modal titulo="Nueva solicitud ARCO" onClose={onClose} ancho={520}>
      <p style={{ color: 'var(--texto-muted)', fontSize: 13.5, marginTop: 0 }}>
        Plazo de respuesta: <b>20 días hábiles</b> a partir de hoy (Art. 32 LFPDPPP).
      </p>

      <label style={LABEL}>Nombre completo del titular <span style={{ color: '#B3261E' }}>*</span></label>
      <input style={INP} placeholder="Nombre y apellidos" value={v.titular_nombre} onChange={set('titular_nombre')} autoFocus />

      <label style={LABEL}>Correo electrónico</label>
      <input style={INP} type="email" placeholder="correo@ejemplo.com" value={v.titular_email} onChange={set('titular_email')} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={LABEL}>Relación con la escuela <span style={{ color: '#B3261E' }}>*</span></label>
          <select style={INP} value={v.titular_tipo} onChange={set('titular_tipo')}>
            <option value="">Elige…</option>
            {Object.entries(TIPO_TITULAR).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={LABEL}>Derecho ARCO <span style={{ color: '#B3261E' }}>*</span></label>
          <select style={INP} value={v.tipo_arco} onChange={set('tipo_arco')}>
            <option value="">Elige…</option>
            {Object.entries(TIPO_ARCO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>

      <label style={LABEL}>Descripción de la solicitud</label>
      <textarea style={{ ...INP, resize: 'vertical' }} rows={3}
        placeholder="¿Qué información desea acceder, rectificar, cancelar u oponerse?"
        value={v.descripcion} onChange={set('descripcion')} />

      <label style={LABEL}>URL del documento de identidad</label>
      <input style={INP} placeholder="https://drive.google.com/… (opcional)" value={v.documento_url} onChange={set('documento_url')} />
      <p style={{ fontSize: 12, color: 'var(--texto-muted)', margin: '4px 0 0' }}>
        Comparte el archivo en Google Drive y pega el enlace aquí.
      </p>

      {error && <div style={ERR}>{error}</div>}
      <div className="modal-acciones">
        <button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className="btn-primario" disabled={!listo || ocupado} onClick={() => listo && onGuardar(v)}>
          {ocupado ? 'Registrando…' : 'Registrar solicitud'}
        </button>
      </div>
    </Modal>
  )
}

function ModalDetalle({ s, onClose, onActualizar, ocupado, errModal }) {
  const [estatus, setEstatus] = useState(s.estatus)
  const [resolucion, setResolucion] = useState(s.resolucion || '')
  const [notas, setNotas] = useState(s.notas || '')
  const pideResolucion = estatus === 'resuelta'
  const listo = estatus && (pideResolucion ? resolucion.trim().length >= 4 : true)

  return (
    <Modal titulo={`Solicitud ${s.folio}`} onClose={onClose} ancho={540}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', marginBottom: 12, fontSize: 13.5 }}>
        <div><span style={{ color: 'var(--texto-muted)' }}>Titular: </span><b>{s.titular_nombre}</b></div>
        <div><span style={{ color: 'var(--texto-muted)' }}>Relación: </span>{TIPO_TITULAR[s.titular_tipo] || s.titular_tipo}</div>
        <div><span style={{ color: 'var(--texto-muted)' }}>Derecho: </span><b>{TIPO_ARCO[s.tipo_arco] || s.tipo_arco}</b></div>
        <div><span style={{ color: 'var(--texto-muted)' }}>Recepción: </span>{fmtFecha(s.fecha_recepcion)}</div>
        <div><span style={{ color: 'var(--texto-muted)' }}>Límite: </span><b>{fmtFecha(s.fecha_limite)}</b></div>
        {s.titular_email && <div><span style={{ color: 'var(--texto-muted)' }}>Correo: </span>{s.titular_email}</div>}
      </div>

      {s.descripcion && (
        <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
          {s.descripcion}
        </div>
      )}
      {s.documento_url && (
        <a href={s.documento_url} target="_blank" rel="noopener noreferrer" className="btn-mini" style={{ display: 'inline-block', marginBottom: 12 }}>
          Ver documento ↗
        </a>
      )}

      <div style={{ borderTop: '1px solid var(--borde)', paddingTop: 12 }}>
        <label style={LABEL}>Actualizar estatus</label>
        <select style={INP} value={estatus} onChange={e => setEstatus(e.target.value)}>
          {Object.entries(ESTATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>

        {pideResolucion && (
          <>
            <label style={LABEL}>Resolución <span style={{ color: '#B3261E' }}>*</span></label>
            <textarea style={{ ...INP, resize: 'vertical' }} rows={3}
              placeholder="¿Cómo se atendió la solicitud? Esta nota queda en el expediente."
              value={resolucion} onChange={e => setResolucion(e.target.value)} autoFocus />
          </>
        )}

        <label style={LABEL}>Notas internas</label>
        <textarea style={{ ...INP, resize: 'vertical' }} rows={2}
          placeholder="Observaciones para el equipo (no se comparten con el titular)"
          value={notas} onChange={e => setNotas(e.target.value)} />
      </div>

      {errModal && <div style={ERR}>{errModal}</div>}
      <div className="modal-acciones">
        <button className="btn-sec" onClick={onClose}>Cerrar</button>
        <button className="btn-primario" disabled={!listo || ocupado}
          onClick={() => onActualizar({ id: s.id, estatus, resolucion: resolucion || null, notas: notas || null })}>
          {ocupado ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  )
}

function TabArco() {
  const [d, setD] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('pendientes')
  const [modalNueva, setModalNueva] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [errModal, setErrModal] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const x = await get('/legal')
      if (x.error) throw new Error(x.error)
      setD(x)
    } catch (e) { setError(e.message) }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function nueva(form) {
    setOcupado(true); setErrModal('')
    try {
      const x = await post('/legal', form)
      if (x.error) throw new Error(x.error)
      setModalNueva(false); await cargar()
    } catch (e) { setErrModal(e.message) }
    setOcupado(false)
  }

  async function actualizar(patch_body) {
    setOcupado(true); setErrModal('')
    try {
      const x = await patch('/legal', patch_body)
      if (x.error) throw new Error(x.error)
      setDetalle(null); await cargar()
    } catch (e) { setErrModal(e.message) }
    setOcupado(false)
  }

  const R = d?.resumen
  const todas = d?.rows || []
  const filas = todas.filter(s => {
    if (filtro === 'pendientes') return s.estatus === 'pendiente'
    if (filtro === 'en_proceso') return s.estatus === 'en_proceso'
    if (filtro === 'vencidas') return s.estatus === 'vencida'
    if (filtro === 'resueltas') return s.estatus === 'resuelta'
    return true
  })

  const FILTROS = [
    { id: 'todos', t: 'Todas' },
    { id: 'pendientes', t: 'Pendientes' },
    { id: 'en_proceso', t: 'En proceso' },
    { id: 'vencidas', t: 'Vencidas' },
    { id: 'resueltas', t: 'Resueltas' },
  ]

  return (
    <>
      {R && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { n: R.total, t: 'Total' },
            { n: R.pendientes, t: 'Pendientes', c: R.pendientes ? '#B86500' : undefined },
            { n: R.en_proceso, t: 'En proceso', c: R.en_proceso ? '#2D7DD2' : undefined },
            { n: R.vencidas, t: 'Vencidas', c: R.vencidas ? '#B3261E' : undefined },
            { n: R.en_alerta, t: 'Alertas (≤5 días)', c: R.en_alerta ? '#B86500' : undefined },
          ].map(({ n, t, c }) => (
            <div key={t} style={{ background: 'var(--bg-2)', border: '1px solid var(--borde)', borderRadius: 10, padding: '10px 16px', minWidth: 100 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c || 'var(--texto)', lineHeight: 1.1 }}>{n ?? '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--texto-muted)', marginTop: 2 }}>{t}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTROS.map(f => (
            <button key={f.id} className="btn-mini" onClick={() => setFiltro(f.id)}
              style={filtro === f.id ? { background: '#FFF1DE', color: '#B86500', fontWeight: 700 } : undefined}>
              {f.t}
            </button>
          ))}
        </div>
        <button className="btn-primario" style={{ marginLeft: 'auto' }}
          onClick={() => { setErrModal(''); setModalNueva(true) }}>
          + Nueva solicitud
        </button>
      </div>

      {error && <div style={{ ...ERR, marginBottom: 12 }}>{error}</div>}

      {cargando ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--texto-muted)' }}>Cargando…</div>
      ) : !filas.length ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--texto-muted)', background: 'var(--bg-2)', borderRadius: 12 }}>
          No hay solicitudes en esta categoría.
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Folio</th><th>Titular</th><th>Derecho</th>
                <th>Recepción</th><th>Límite / Días</th><th>Estatus</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map(s => {
                const bordei = s.estatus === 'vencida' ? '4px solid #B3261E' : s.alerta ? '4px solid #F18B11' : undefined
                return (
                  <tr key={s.id} style={bordei ? { borderLeft: bordei } : undefined}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13, color: '#B86500', whiteSpace: 'nowrap' }}>{s.folio}</td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.titular_nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--texto-muted)', marginTop: 2 }}>
                        {TIPO_TITULAR[s.titular_tipo] || s.titular_tipo}
                        {s.titular_email ? ` · ${s.titular_email}` : ''}
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: '#E8F1FB', color: '#2D7DD2' }}>
                        {TIPO_ARCO[s.tipo_arco] || s.tipo_arco}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{fmtCorta(s.fecha_recepcion)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                      <div>{fmtCorta(s.fecha_limite)}</div>
                      {s.estatus !== 'resuelta' && s.dias_habiles_restantes !== null && (
                        <div style={{
                          fontSize: 11, fontWeight: 800, marginTop: 2,
                          color: s.estatus === 'vencida' || s.dias_habiles_restantes === 0
                            ? '#B3261E' : s.alerta ? '#B86500' : 'var(--texto-muted)',
                        }}>
                          {s.estatus === 'vencida' || s.dias_habiles_restantes === 0
                            ? 'VENCIDA'
                            : `${s.dias_habiles_restantes} día${s.dias_habiles_restantes === 1 ? '' : 's'} hábil${s.dias_habiles_restantes === 1 ? '' : 'es'}`}
                        </div>
                      )}
                    </td>
                    <td><BadgeEst est={s.estatus} /></td>
                    <td>
                      <button className="btn-mini" onClick={() => { setErrModal(''); setDetalle(s) }}>
                        Ver / Actualizar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalNueva && <ModalNueva onClose={() => setModalNueva(false)} onGuardar={nueva} ocupado={ocupado} error={errModal} />}
      {detalle && <ModalDetalle s={detalle} onClose={() => setDetalle(null)} onActualizar={actualizar} ocupado={ocupado} errModal={errModal} />}
    </>
  )
}

// ── Tab 2: Avisos de privacidad ───────────────────────────────────────────────

function ModalNuevoAviso({ onClose, onGuardar, ocupado, error }) {
  const [v, setV] = useState({ nombre: '', version: '', tipo_titular: '', archivo_url: '', fecha_vigencia: '', desactivar_anteriores: true })
  const set = (k) => (e) => setV(s => ({ ...s, [k]: e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))
  const listo = v.nombre.trim() && v.version.trim() && v.tipo_titular

  return (
    <Modal titulo="Nuevo aviso de privacidad" onClose={onClose} ancho={500}>
      <label style={LABEL}>Nombre del aviso <span style={{ color: '#B3261E' }}>*</span></label>
      <input style={INP} placeholder="Ej: Aviso de Privacidad Integral" value={v.nombre} onChange={set('nombre')} autoFocus />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={LABEL}>Versión <span style={{ color: '#B3261E' }}>*</span></label>
          <input style={INP} placeholder="Ej: v2.0 · junio 2026" value={v.version} onChange={set('version')} />
        </div>
        <div>
          <label style={LABEL}>Vigente desde</label>
          <input style={INP} type="date" value={v.fecha_vigencia} onChange={set('fecha_vigencia')} />
        </div>
      </div>

      <label style={LABEL}>Tipo de titular <span style={{ color: '#B3261E' }}>*</span></label>
      <select style={INP} value={v.tipo_titular} onChange={set('tipo_titular')}>
        <option value="">Elige…</option>
        <option value="alumnos_tutores">Alumnos y tutores</option>
        <option value="personal">Personal / Docentes</option>
        <option value="becarios">Becarios</option>
        <option value="general">General</option>
      </select>

      <label style={LABEL}>URL del PDF</label>
      <input style={INP} placeholder="https://drive.google.com/… (opcional)" value={v.archivo_url} onChange={set('archivo_url')} />

      <label style={LABEL}>Texto del aviso</label>
      <textarea style={{ ...INP, resize: 'vertical', minHeight: 120 }} rows={5}
        placeholder="Pega aquí el texto completo del aviso (opcional si subes PDF)"
        value={v.contenido || ''} onChange={set('contenido')} />

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 13.5, cursor: 'pointer' }}>
        <input type="checkbox" checked={v.desactivar_anteriores} onChange={set('desactivar_anteriores')}
          style={{ width: 16, height: 16, accentColor: '#F18B11' }} />
        Desactivar versiones anteriores del mismo aviso
      </label>

      {error && <div style={ERR}>{error}</div>}
      <div className="modal-acciones">
        <button className="btn-sec" onClick={onClose}>Cancelar</button>
        <button className="btn-primario" disabled={!listo || ocupado} onClick={() => listo && onGuardar(v)}>
          {ocupado ? 'Guardando…' : 'Guardar aviso'}
        </button>
      </div>
    </Modal>
  )
}

function TabAvisos() {
  const [rows, setRows] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [errModal, setErrModal] = useState('')
  const [verTexto, setVerTexto] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const x = await get('/legal/avisos')
      if (x.error) throw new Error(x.error)
      setRows(x.rows || [])
    } catch (e) { setError(e.message) }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar(form) {
    setOcupado(true); setErrModal('')
    try {
      const x = await post('/legal/avisos', form)
      if (x.error) throw new Error(x.error)
      setModal(false); await cargar()
    } catch (e) { setErrModal(e.message) }
    setOcupado(false)
  }

  const grupos = {}
  ;(rows || []).forEach(r => {
    const g = r.tipo_titular || 'general';
    (grupos[g] = grupos[g] || []).push(r)
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-primario" onClick={() => { setErrModal(''); setModal(true) }}>+ Nuevo aviso</button>
      </div>

      {error && <div style={{ ...ERR, marginBottom: 12 }}>{error}</div>}

      {cargando ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--texto-muted)' }}>Cargando…</div>
      ) : !rows?.length ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--texto-muted)', background: 'var(--bg-2)', borderRadius: 12 }}>
          Aún no hay avisos de privacidad registrados.
        </div>
      ) : (
        Object.entries(grupos).map(([tipo, lista]) => (
          <div key={tipo} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--texto-muted)', marginBottom: 8 }}>
              {TIPO_TITULAR_LABEL[tipo] || tipo}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {lista.map(av => (
                <div key={av.id} style={{
                  background: 'var(--bg-2)', border: '1px solid var(--borde)', borderRadius: 10,
                  padding: '14px 18px', borderLeft: `4px solid ${av.activo ? '#1B7A3D' : 'var(--borde)'}`,
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 15 }}>{av.nombre}</b>
                        <span className="badge" style={av.activo ? { background: '#E7F5EC', color: '#1B7A3D' } : { background: 'var(--bg-3)', color: 'var(--texto-muted)' }}>
                          {av.activo ? 'Vigente' : 'Inactivo'}
                        </span>
                        <span style={{ fontSize: 12.5, color: 'var(--texto-muted)' }}>{av.version}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--texto-muted)', marginTop: 4 }}>
                        {av.fecha_vigencia ? `Vigente desde ${fmtFecha(av.fecha_vigencia)}` : 'Sin fecha de vigencia'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {av.contenido && (
                        <button className="btn-mini" onClick={() => setVerTexto(av)}>Ver texto</button>
                      )}
                      {av.archivo_url && (
                        <a href={av.archivo_url} target="_blank" rel="noopener noreferrer" className="btn-mini">
                          Ver PDF ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {modal && <ModalNuevoAviso onClose={() => setModal(false)} onGuardar={guardar} ocupado={ocupado} error={errModal} />}

      {verTexto && (
        <Modal titulo={`${verTexto.nombre} — v${verTexto.version}`} onClose={() => setVerTexto(null)} ancho={700}>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
            fontSize: 13.5, lineHeight: 1.7, color: 'var(--texto)',
            background: 'var(--bg-3)', borderRadius: 10, padding: '16px 20px',
            maxHeight: '60vh', overflowY: 'auto', margin: 0,
          }}>
            {verTexto.contenido}
          </pre>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setVerTexto(null)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Tab 3: Reportes ───────────────────────────────────────────────────────────

function TabReportes() {
  const [d, setD] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const x = await get('/legal?tab=reporte')
      if (x.error) throw new Error(x.error)
      setD(x)
    } catch (e) { setError(e.message) }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function exportarCSV() {
    if (!d) return
    const filas = [
      ['Tipo ARCO', 'Cantidad'],
      ['Acceso', d.por_tipo.acceso], ['Rectificación', d.por_tipo.rectificacion],
      ['Cancelación', d.por_tipo.cancelacion], ['Oposición', d.por_tipo.oposicion],
      [],
      ['Estatus', 'Cantidad'],
      ['Pendiente', d.por_estatus.pendiente], ['En proceso', d.por_estatus.en_proceso],
      ['Resuelta', d.por_estatus.resuelta], ['Vencida', d.por_estatus.vencida],
      [],
      ['Promedio días respuesta', d.promedio_dias ?? 'Sin datos'],
      ['% resueltas a tiempo', d.porcentaje_tiempo != null ? d.porcentaje_tiempo + '%' : 'Sin datos'],
    ]
    const csv = filas.map(f => f.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `reporte-arco-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const COLEST = { pendiente: '#FFF1DE|#B86500', en_proceso: '#E8F1FB|#2D7DD2', resuelta: '#E7F5EC|#1B7A3D', vencida: '#FDECEC|#B3261E' }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14, gap: 8 }}>
        <button className="btn-mini" onClick={exportarCSV} disabled={!d}>Exportar CSV</button>
        <button className="btn-mini" onClick={cargar}>Actualizar</button>
      </div>

      {error && <div style={{ ...ERR, marginBottom: 12 }}>{error}</div>}

      {cargando ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--texto-muted)' }}>Calculando…</div>
      ) : !d ? null : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { v: d.total, e: 'Total de solicitudes', c: undefined },
              { v: d.por_estatus?.resuelta ?? 0, e: 'Resueltas', c: '#1B7A3D' },
              { v: d.por_estatus?.vencida ?? 0, e: 'Vencidas', c: d.por_estatus?.vencida ? '#B3261E' : 'var(--texto-muted)' },
              { v: d.promedio_dias != null ? `${d.promedio_dias} d` : '—', e: 'Promedio de respuesta', c: undefined },
              { v: d.porcentaje_tiempo != null ? `${d.porcentaje_tiempo}%` : '—', e: 'Resueltas a tiempo', c: d.porcentaje_tiempo >= 90 ? '#1B7A3D' : d.porcentaje_tiempo >= 70 ? '#B86500' : '#B3261E' },
            ].map(({ v, e, c }) => (
              <div key={e} style={{ background: 'var(--bg-2)', border: '1px solid var(--borde)', borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: c || '#B86500', lineHeight: 1.1 }}>{v ?? '—'}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginTop: 4 }}>{e}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--borde)', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--texto-muted)', marginBottom: 12 }}>
                Por tipo de derecho
              </div>
              {Object.entries(TIPO_ARCO).map(([k, label]) => {
                const n = d.por_tipo?.[k] ?? 0
                const total = d.total || 1
                return (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 3 }}>
                      <span>{label}</span><b>{n}</b>
                    </div>
                    <div style={{ height: 6, background: 'var(--borde)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round((n / total) * 100)}%`, background: '#2D7DD2', borderRadius: 999 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--borde)', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--texto-muted)', marginBottom: 12 }}>
                Por estatus
              </div>
              {Object.entries(ESTATUS).map(([k, label]) => {
                const n = d.por_estatus?.[k] ?? 0
                const [bg, c] = (COLEST[k] || '#eee|#666').split('|')
                return (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--borde)', fontSize: 13.5 }}>
                    <span className="badge" style={{ background: bg, color: c }}>{label}</span>
                    <b>{n}</b>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--borde)', borderRadius: 10, padding: '14px 18px', marginTop: 14, fontSize: 13, color: 'var(--texto-muted)', lineHeight: 1.6 }}>
            <b style={{ color: 'var(--texto)' }}>Para auditorías del INAI:</b>{' '}
            descarga el CSV con el botón de arriba. Incluye todos los conteos y métricas.
            El tiempo promedio se calcula en días calendario sobre solicitudes ya resueltas.
          </div>
        </>
      )}
    </>
  )
}

// ── Componente raíz ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'arco', label: 'Solicitudes ARCO' },
  { id: 'avisos', label: 'Avisos de privacidad' },
  { id: 'reportes', label: 'Reportes' },
]

export default function Legal() {
  const [tab, setTab] = useState('arco')

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Legal y ARCO</h2>
          <p style={{ fontSize: 13, color: 'var(--texto-muted)', margin: '2px 0 0' }}>
            Derechos de protección de datos · Art. 32 LFPDPPP · Plazo: 20 días hábiles
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1.5px solid var(--borde)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: tab === t.id ? 700 : 400,
              background: tab === t.id ? 'var(--bg-3)' : 'transparent',
              color: tab === t.id ? '#B86500' : 'var(--texto-muted)',
              borderBottom: tab === t.id ? '2.5px solid #F18B11' : '2.5px solid transparent',
              marginBottom: -1.5,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'arco' && <TabArco />}
      {tab === 'avisos' && <TabAvisos />}
      {tab === 'reportes' && <TabReportes />}
    </div>
  )
}
