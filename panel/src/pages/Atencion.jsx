import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import AvisosPage from './Avisos.jsx'

// ─── Constantes ───────────────────────────────────────────────────────────────
const CATEGORIAS_LABEL = {
  inscripcion_reinscripcion: 'Inscripción / Reinscripción',
  pagos_facturacion: 'Pagos y Facturación',
  becas: 'Becas',
  constancias_documentos: 'Constancias y Documentos',
  problemas_academicos: 'Problemas Académicos',
  problemas_profesores: 'Problemas con Profesores',
  problemas_plataforma: 'Problemas con la Plataforma',
  quejas: 'Quejas',
  sugerencias: 'Sugerencias',
  otro: 'Otro',
}

const ESTADO_LABEL = {
  nueva: 'Nueva',
  recibida: 'Recibida',
  en_revision: 'En revisión',
  esperando_informacion: 'Esperando información',
  en_proceso: 'En proceso',
  turno_alumno: 'Turno del alumno',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
}

const ESTADO_COLOR = {
  nueva: '#e67e22',
  recibida: '#2980b9',
  en_revision: '#8e44ad',
  esperando_informacion: '#c0392b',
  en_proceso: '#27ae60',
  turno_alumno: '#1abc9c',
  resuelta: '#16a085',
  cerrada: '#7f8c8d',
}

const PRIORIDAD_COLOR = { alta: '#e74c3c', media: '#f39c12', baja: '#27ae60' }

const ORANGE = '#f18b11'
const BASE_API = (import.meta.env.VITE_API_URL || '') + '/api'

function badge(estado) {
  return (
    <span style={{
      background: ESTADO_COLOR[estado] || '#999',
      color: '#fff', borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 700, letterSpacing: '.03em', whiteSpace: 'nowrap',
    }}>{ESTADO_LABEL[estado] || estado}</span>
  )
}

function prioridadBadge(p) {
  return (
    <span style={{
      background: PRIORIDAD_COLOR[p] || '#aaa',
      color: '#fff', borderRadius: 20, padding: '1px 8px',
      fontSize: 10, fontWeight: 700, letterSpacing: '.03em',
    }}>{p === 'alta' ? '↑ Alta' : p === 'baja' ? '↓ Baja' : '— Media'}</span>
  )
}

function fechaCorta(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Card de solicitud en la lista ────────────────────────────────────────────
function SolicitudCard({ sol, onClick, selected }) {
  return (
    <div onClick={() => onClick(sol.id)} style={{
      padding: '14px 16px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
      border: selected ? `2px solid ${ORANGE}` : '1.5px solid rgba(0,0,0,0.1)',
      background: selected ? 'rgba(241,139,17,0.06)' : '#fff',
      transition: 'border .15s, background .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{sol.id}</span>
        {badge(sol.estado)}
        {prioridadBadge(sol.prioridad)}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, color: '#222' }}>{sol.titulo}</div>
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#888', flexWrap: 'wrap' }}>
        <span>{CATEGORIAS_LABEL[sol.categoria] || sol.categoria}</span>
        {sol.alumno_nombre && <span>· {sol.alumno_nombre}</span>}
        <span>· {fechaCorta(sol.creado_en)}</span>
        {sol.num_mensajes > 0 && <span>· 💬 {sol.num_mensajes}</span>}
      </div>
    </div>
  )
}

// ─── Formulario nueva solicitud ───────────────────────────────────────────────
function NuevaSolicitudForm({ onCreated, onClose }) {
  const [form, setForm] = useState({ categoria: '', titulo: '', descripcion: '', confidencial: false })
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.categoria) return setErr('Selecciona una categoría.')
    if (!form.titulo.trim()) return setErr('El asunto es requerido.')
    if (!form.descripcion.trim()) return setErr('La descripción es requerida.')
    setLoading(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('categoria', form.categoria)
      fd.append('titulo', form.titulo.trim())
      fd.append('descripcion', form.descripcion.trim())
      if (form.confidencial) fd.append('confidencial', '1')
      for (const f of files) fd.append('adjuntos', f)
      const { folio } = await api.crearAtencionSolicitud(fd)
      onCreated(folio)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const inp = (field) => ({
    value: form[field],
    onChange: e => setForm(p => ({ ...p, [field]: e.target.value })),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#222' }}>Nueva solicitud</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={lbl}>Categoría *</label>
          <select {...inp('categoria')} style={sel} required>
            <option value="">Selecciona...</option>
            {Object.entries(CATEGORIAS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          <label style={lbl}>Asunto *</label>
          <input {...inp('titulo')} placeholder="Describe brevemente tu solicitud" style={inpStyle} maxLength={120} required />

          <label style={lbl}>Descripción *</label>
          <textarea {...inp('descripcion')} rows={5} placeholder="Explica con detalle tu situación..." style={{ ...inpStyle, resize: 'vertical' }} required />

          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 400 }}>
            <input type="checkbox" checked={form.confidencial} onChange={e => setForm(p => ({ ...p, confidencial: e.target.checked }))} />
            <span>Marcar como confidencial (solo staff administrativo)</span>
          </label>

          <label style={lbl}>Adjuntos (máx. 5, 20 MB c/u)</label>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={e => setFiles(Array.from(e.target.files))}
            style={{ fontSize: 13, marginBottom: 16, display: 'block' }} />
          {files.length > 0 && <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{files.map(f => f.name).join(', ')}</div>}

          {err && <p style={{ color: '#c0392b', fontSize: 13, margin: '0 0 12px' }}>{err}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose} style={btnSec}>Cancelar</button>
            <button type="submit" disabled={loading} style={btnPri}>{loading ? 'Enviando...' : 'Enviar solicitud'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Timeline de mensajes ─────────────────────────────────────────────────────
function Timeline({ mensajes, adjuntosIniciales, esGestor, currentUser, onReload }) {
  const [msgText, setMsgText] = useState('')
  const [interno, setInterno] = useState(false)
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const endRef = useRef(null)
  const folio = mensajes[0]?.solicitud_id

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])

  async function sendMsg() {
    if (!msgText.trim() && files.length === 0) return
    setSending(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('contenido', msgText.trim() || '(adjunto)')
      if (interno) fd.append('interno', '1')
      for (const f of files) fd.append('adjuntos', f)
      await api.enviarMensajeAtencion(folio, fd)
      setMsgText(''); setFiles([]); setInterno(false)
      onReload()
    } catch (e) { setErr(e.message) }
    finally { setSending(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Adjuntos iniciales de la solicitud */}
        {adjuntosIniciales?.length > 0 && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            Adjuntos iniciales: {adjuntosIniciales.map(a => (
              <a key={a.id} href={`${BASE_API.replace('/api', '')}/${a.ruta}`} target="_blank" rel="noopener noreferrer"
                style={{ color: ORANGE, marginLeft: 4 }}>{a.nombre_original}</a>
            ))}
          </div>
        )}

        {mensajes.map(m => {
          const isMe = m.autor_id === currentUser.id
          const isSystem = m.tipo === 'sistema' || m.tipo === 'cambio_estado'
          const isDocReq = m.tipo === 'solicitud_documento'

          if (isSystem || isDocReq) {
            return (
              <div key={m.id} style={{ textAlign: 'center', fontSize: 12, color: '#888', padding: '4px 0' }}>
                <span style={{ background: isDocReq ? 'rgba(231,76,60,.09)' : 'rgba(0,0,0,.06)', borderRadius: 20, padding: '3px 12px' }}>
                  {isDocReq ? '📎 ' : '🔄 '}{m.contenido}
                </span>
                <span style={{ marginLeft: 8, color: '#bbb' }}>{fechaCorta(m.creado_en)}</span>
              </div>
            )
          }

          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
              <div style={{
                maxWidth: '72%', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.interno ? 'rgba(142,68,173,.1)' : (isMe ? `rgba(241,139,17,0.12)` : '#f0f2f8'),
                border: m.interno ? '1.5px solid rgba(142,68,173,.25)' : 'none',
              }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>
                  {m.autor_nombre} {m.interno && <span style={{ color: '#8e44ad', fontWeight: 700 }}>· nota interna</span>}
                </div>
                <div style={{ fontSize: 14, color: '#222', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.contenido}</div>
                {m.adjuntos?.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {m.adjuntos.map(a => (
                      <a key={a.id} href={`${BASE_API.replace('/api', '')}/${a.ruta}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: ORANGE, textDecoration: 'none', background: 'rgba(241,139,17,.1)', padding: '2px 8px', borderRadius: 8 }}>
                        📎 {a.nombre_original}
                      </a>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>{fechaCorta(m.creado_en)}</div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* Redactor */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,.1)', paddingTop: 12 }}>
        {esGestor && (
          <label style={{ fontSize: 12, color: '#8e44ad', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={interno} onChange={e => setInterno(e.target.checked)} />
            Nota interna (no visible al alumno)
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
              placeholder="Escribe un mensaje... (Enter para enviar)" rows={2}
              style={{ ...inpStyle, resize: 'none', marginBottom: 4 }} />
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={e => setFiles(Array.from(e.target.files))}
              style={{ fontSize: 12 }} />
          </div>
          <button onClick={sendMsg} disabled={sending} style={{ ...btnPri, padding: '10px 16px', flexShrink: 0 }}>
            {sending ? '...' : '→'}
          </button>
        </div>
        {err && <p style={{ color: '#c0392b', fontSize: 12, margin: '4px 0 0' }}>{err}</p>}
      </div>
    </div>
  )
}

// ─── Panel de documentos solicitados ─────────────────────────────────────────
function DocsPanel({ docs, esGestor, currentUser, folio, onReload }) {
  const [subiendo, setSubiendo] = useState({})
  const [revisando, setRevisando] = useState({})
  const [solicitando, setSolicitando] = useState(false)
  const [nuevosDocs, setNuevosDocs] = useState([{ nombre: '', descripcion: '' }])
  const [nota, setNota] = useState('')
  const [err, setErr] = useState('')

  async function handleSubir(docId, file) {
    setSubiendo(p => ({ ...p, [docId]: true }))
    try {
      const fd = new FormData(); fd.append('archivo', file)
      await api.subirDocAtencion(docId, fd)
      onReload()
    } catch (e) { setErr(e.message) }
    finally { setSubiendo(p => ({ ...p, [docId]: false })) }
  }

  async function handleRevisar(docId, estado, motivo) {
    setRevisando(p => ({ ...p, [docId]: true }))
    try {
      await api.revisarDocAtencion(docId, estado, motivo)
      onReload()
    } catch (e) { setErr(e.message) }
    finally { setRevisando(p => ({ ...p, [docId]: false })) }
  }

  async function handleSolicitar() {
    const validos = nuevosDocs.filter(d => d.nombre.trim())
    if (!validos.length) return setErr('Agrega al menos un documento.')
    setSolicitando(true); setErr('')
    try {
      await api.solicitarDocsAtencion(folio, validos, nota)
      setNuevosDocs([{ nombre: '', descripcion: '' }]); setNota('')
      onReload()
    } catch (e) { setErr(e.message) }
    finally { setSolicitando(false) }
  }

  const estadoDoc = { pendiente: '⏳ Pendiente', subido: '📤 Subido', aceptado: '✅ Aceptado', rechazado: '❌ Rechazado' }

  return (
    <div>
      {docs.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>No hay documentos solicitados.</p>}
      {docs.map(d => (
        <div key={d.id} style={{ border: '1.5px solid rgba(0,0,0,.1)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{d.nombre}</span>
            <span style={{ fontSize: 12, color: '#888' }}>{estadoDoc[d.estado] || d.estado}</span>
          </div>
          {d.descripcion && <p style={{ fontSize: 13, color: '#666', margin: '0 0 8px' }}>{d.descripcion}</p>}
          {d.archivo_nombre && (
            <a href={`${BASE_API.replace('/api', '')}/${d.archivo_ruta}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: ORANGE }}>📎 {d.archivo_nombre}</a>
          )}
          {d.motivo_rechazo && <p style={{ color: '#c0392b', fontSize: 12, margin: '4px 0 0' }}>Motivo: {d.motivo_rechazo}</p>}

          {/* Alumno sube */}
          {!esGestor && (d.estado === 'pendiente' || d.estado === 'rechazado') && (
            <label style={{ display: 'block', marginTop: 8, fontSize: 13, color: ORANGE, cursor: 'pointer' }}>
              {subiendo[d.id] ? 'Subiendo...' : '↑ Subir archivo'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style={{ display: 'none' }}
                onChange={e => e.target.files[0] && handleSubir(d.id, e.target.files[0])} />
            </label>
          )}

          {/* Gestor acepta/rechaza */}
          {esGestor && d.estado === 'subido' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button disabled={revisando[d.id]} onClick={() => handleRevisar(d.id, 'aceptado')} style={btnPri}>Aceptar</button>
              <button disabled={revisando[d.id]} onClick={() => {
                const m = window.prompt('Motivo del rechazo (opcional):')
                handleRevisar(d.id, 'rechazado', m || '')
              }} style={{ ...btnSec, borderColor: '#c0392b', color: '#c0392b' }}>Rechazar</button>
            </div>
          )}
        </div>
      ))}

      {esGestor && (
        <div style={{ borderTop: '1.5px dashed rgba(0,0,0,.1)', paddingTop: 14, marginTop: 8 }}>
          <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 10px' }}>Solicitar documentos adicionales</p>
          {nuevosDocs.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={d.nombre} placeholder="Nombre del documento"
                onChange={e => { const n = [...nuevosDocs]; n[i] = { ...n[i], nombre: e.target.value }; setNuevosDocs(n) }}
                style={{ ...inpStyle, flex: 1, marginBottom: 0 }} />
              <input value={d.descripcion} placeholder="Descripción (opcional)"
                onChange={e => { const n = [...nuevosDocs]; n[i] = { ...n[i], descripcion: e.target.value }; setNuevosDocs(n) }}
                style={{ ...inpStyle, flex: 2, marginBottom: 0 }} />
              {nuevosDocs.length > 1 && (
                <button onClick={() => setNuevosDocs(nuevosDocs.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 18 }}>×</button>
              )}
            </div>
          ))}
          <button onClick={() => setNuevosDocs([...nuevosDocs, { nombre: '', descripcion: '' }])}
            style={{ ...btnSec, fontSize: 12, marginBottom: 10 }}>+ Agregar otro</button>
          <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota al alumno (opcional)" rows={2}
            style={{ ...inpStyle, resize: 'none' }} />
          {err && <p style={{ color: '#c0392b', fontSize: 12 }}>{err}</p>}
          <button onClick={handleSolicitar} disabled={solicitando} style={btnPri}>
            {solicitando ? 'Enviando...' : 'Solicitar documentos'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Detalle de solicitud ─────────────────────────────────────────────────────
function SolicitudDetalle({ folio, currentUser, esGestor, onBack, onStatusChange }) {
  const [sol, setSol] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('chat')
  const [accionLoading, setAccionLoading] = useState(false)
  const [err, setErr] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setSol(await api.getAtencionSolicitud(folio)) }
    catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }, [folio])

  useEffect(() => { cargar() }, [cargar])

  async function cambiarEstado(estado) {
    let nota = ''
    if (estado === 'esperando_informacion') {
      nota = window.prompt('Indica qué información necesitas (opcional):') || ''
    }
    setAccionLoading(true)
    try { await api.cambiarEstadoAtencion(folio, estado, nota); await cargar(); onStatusChange?.() }
    catch (e) { setErr(e.message) }
    finally { setAccionLoading(false) }
  }

  async function valorar(si) {
    setAccionLoading(true)
    try { await api.valorarAtencion(folio, si); await cargar() }
    catch (e) { setErr(e.message) }
    finally { setAccionLoading(false) }
  }

  if (loading) return <div style={{ padding: 32, color: '#888' }}>Cargando...</div>
  if (!sol)    return <div style={{ padding: 32, color: '#c0392b' }}>{err || 'No encontrada'}</div>

  const ESTADOS_SIGUIENTE = {
    nueva: ['recibida'],
    recibida: ['en_revision', 'turno_alumno', 'esperando_informacion', 'en_proceso'],
    en_revision: ['turno_alumno', 'esperando_informacion', 'en_proceso'],
    esperando_informacion: ['turno_alumno', 'en_revision', 'en_proceso'],
    en_proceso: ['turno_alumno', 'resuelta'],
    turno_alumno: ['en_proceso', 'cerrada'],
    resuelta: ['cerrada', 'en_proceso'],
  }
  const siguientes = esGestor ? (ESTADOS_SIGUIENTE[sol.estado] || []) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,.1)', background: '#fafafa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{sol.id}</span>
              {badge(sol.estado)}
              {prioridadBadge(sol.prioridad)}
              {sol.confidencial === 1 && <span style={{ fontSize: 11, background: '#8e44ad', color: '#fff', borderRadius: 20, padding: '1px 8px' }}>🔒 Conf.</span>}
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#222' }}>{sol.titulo}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {CATEGORIAS_LABEL[sol.categoria]} · {sol.alumno_nombre}
              {sol.agente_nombre && ` · Asignado a: ${sol.agente_nombre}`}
              {' · '}{fechaCorta(sol.creado_en)}
            </div>
          </div>
        </div>

        {/* Descripción original */}
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(0,0,0,.04)', borderRadius: 8, fontSize: 13, color: '#444', whiteSpace: 'pre-wrap' }}>
          {sol.descripcion}
        </div>

        {/* Acciones gestor */}
        {esGestor && siguientes.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {siguientes.map(e => (
              <button key={e} disabled={accionLoading} onClick={() => cambiarEstado(e)}
                style={{ ...btnSec, fontSize: 12, padding: '5px 12px' }}>
                {ESTADO_LABEL[e]}
              </button>
            ))}
          </div>
        )}

        {/* Valoración alumno — aparece en turno_alumno y resuelta */}
        {!esGestor && ['turno_alumno', 'resuelta'].includes(sol.estado) && sol.satisfaccion == null && (
          <div style={{ marginTop: 12, padding: 14, background: 'rgba(26,188,156,.1)', borderRadius: 8, border: '1.5px solid rgba(26,188,156,.3)' }}>
            <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 4px', color: '#0d6e5c' }}>¿Tu duda fue resuelta?</p>
            <p style={{ fontSize: 13, color: '#555', margin: '0 0 10px' }}>Un agente respondió a tu solicitud. Cuéntanos cómo te fue.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={accionLoading} onClick={() => valorar(true)} style={btnPri}>✓ Sí, resuelta</button>
              <button disabled={accionLoading} onClick={() => valorar(false)} style={{ ...btnSec, borderColor: '#c0392b', color: '#c0392b' }}>✗ No, sigue sin resolverse</button>
            </div>
          </div>
        )}

        {err && <p style={{ color: '#c0392b', fontSize: 12, margin: '8px 0 0' }}>{err}</p>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,.1)' }}>
        {['chat', 'documentos'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', border: 'none', borderBottom: `2.5px solid ${tab === t ? ORANGE : 'transparent'}`,
            background: 'none', cursor: 'pointer', fontWeight: tab === t ? 700 : 400,
            color: tab === t ? ORANGE : '#666', fontSize: 14,
          }}>
            {t === 'chat' ? '💬 Mensajes' : `📎 Documentos${sol.docs?.length ? ` (${sol.docs.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Contenido tab */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 20px 16px' }}>
        {tab === 'chat' ? (
          <Timeline mensajes={sol.mensajes || []} adjuntosIniciales={sol.adjuntosIniciales}
            esGestor={esGestor} currentUser={currentUser} onReload={cargar} />
        ) : (
          <div style={{ paddingTop: 16, overflowY: 'auto', height: '100%' }}>
            <DocsPanel docs={sol.docs || []} esGestor={esGestor}
              currentUser={currentUser} folio={folio} onReload={cargar} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard stats (gestor) ─────────────────────────────────────────────────
function DashboardStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.getAtencionDashboard().then(setStats).catch(() => {})
  }, [])

  if (!stats) return null

  const items = [
    { label: 'Nuevas', val: stats.nueva, color: ESTADO_COLOR.nueva },
    { label: 'En revisión', val: stats.en_revision + stats.recibida, color: ESTADO_COLOR.en_revision },
    { label: 'Esperando info', val: stats.esperando_informacion, color: ESTADO_COLOR.esperando_informacion },
    { label: 'En proceso', val: stats.en_proceso, color: ESTADO_COLOR.en_proceso },
    { label: 'Resueltas', val: stats.resuelta, color: ESTADO_COLOR.resuelta },
    { label: 'Total', val: stats.total, color: '#555' },
  ]

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      {items.map(({ label, val, color }) => (
        <div key={label} style={{ flex: '1 1 100px', minWidth: 90, background: '#fff', borderRadius: 10, padding: '10px 14px', border: `2px solid ${color}22` }}>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Chat en vivo — panel de agente ──────────────────────────────────────────
function ChatEnVivoPane({ currentUser }) {
  const [sesiones, setSesiones] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [sesionActiva, setSesionActiva] = useState(null)
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const endRef = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  const cargarSesiones = useCallback(async () => {
    try { setSesiones(await api.getChatSesiones()) }
    catch (_) {}
    finally { setLoading(false) }
  }, [])

  const cargarMensajes = useCallback(async (id) => {
    if (!id) return
    try {
      const { sesion, mensajes: msgs } = await api.getChatSesionMensajes(id)
      setSesionActiva(sesion)
      setMensajes(msgs)
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (_) {}
  }, [])

  useEffect(() => { cargarSesiones() }, [cargarSesiones])
  useEffect(() => { cargarMensajes(selectedId) }, [selectedId, cargarMensajes])

  // Polling cada 4s
  useEffect(() => {
    const t = setInterval(() => {
      cargarSesiones()
      if (selectedId) cargarMensajes(selectedId)
    }, 4000)
    return () => clearInterval(t)
  }, [selectedId, cargarSesiones, cargarMensajes])

  async function enviar() {
    if (!msgInput.trim() || !selectedId) return
    setSending(true)
    try {
      await api.responderChat(selectedId, msgInput.trim())
      setMsgInput('')
      await cargarMensajes(selectedId)
      await cargarSesiones()
    } catch (_) {}
    finally { setSending(false) }
  }

  async function cerrarSesion(id) {
    await api.cambiarEstadoChat(id, 'cerrado')
    if (selectedId === id) setSelectedId(null)
    await cargarSesiones()
  }

  function fechaMsg(iso) {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  const tieneSeleccionada = !!selectedId

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Lista de sesiones */}
      {(!tieneSeleccionada || !isMobile) && (
        <div style={{ width: tieneSeleccionada ? 280 : '100%', minWidth: tieneSeleccionada ? 240 : undefined, borderRight: tieneSeleccionada ? '1px solid rgba(0,0,0,.1)' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#222' }}>💬 Conversaciones activas</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {loading && <p style={{ color: '#888', fontSize: 13 }}>Cargando...</p>}
            {!loading && sesiones.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: '#888' }}>
                <div style={{ fontSize: 28 }}>💬</div>
                <p style={{ fontSize: 13, margin: '8px 0 0' }}>Sin conversaciones activas</p>
              </div>
            )}
            {sesiones.map(s => (
              <div key={s.id} onClick={() => setSelectedId(s.id)} style={{
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 6,
                border: selectedId === s.id ? `2px solid ${ORANGE}` : '1.5px solid rgba(0,0,0,.1)',
                background: selectedId === s.id ? `rgba(241,139,17,.06)` : '#fff',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#222' }}>{s.visitante_nombre}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 8px', color: '#fff',
                    background: s.estado === 'espera' ? '#e67e22' : s.estado === 'activo' ? '#27ae60' : '#888',
                  }}>{s.estado === 'espera' ? 'En espera' : s.estado === 'activo' ? 'Activo' : 'Cerrado'}</span>
                </div>
                {s.visitante_email && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.visitante_email}</div>}
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                  {s.num_mensajes} mensajes {s.agente_nombre ? `· ${s.agente_nombre}` : '· Sin asignar'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel de chat */}
      {selectedId && sesionActiva && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,.1)', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888', marginRight: 8 }}>←</button>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{sesionActiva.visitante_nombre}</span>
              {sesionActiva.visitante_email && <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{sesionActiva.visitante_email}</span>}
            </div>
            {sesionActiva.estado !== 'cerrado' && (
              <button onClick={() => cerrarSesion(selectedId)} style={{ ...btnSec, fontSize: 12, padding: '5px 10px' }}>Cerrar chat</button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mensajes.map(m => {
              const esAgente = m.autor_tipo === 'agente'
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: esAgente ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{
                    maxWidth: '72%', padding: '8px 12px', borderRadius: esAgente ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: esAgente ? `rgba(241,139,17,.12)` : '#f0f2f8',
                  }}>
                    <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>{m.autor_nombre}</div>
                    <div style={{ fontSize: 14, color: '#222', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.contenido}</div>
                    <div style={{ fontSize: 10, color: '#bbb', marginTop: 3, textAlign: esAgente ? 'right' : 'left' }}>{fechaMsg(m.creado_en)}</div>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
          {sesionActiva.estado !== 'cerrado' && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(0,0,0,.1)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea value={msgInput} onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  placeholder="Responder... (Enter para enviar)" rows={2}
                  style={{ ...inpStyle, resize: 'none', marginBottom: 0, flex: 1 }} />
                <button onClick={enviar} disabled={sending} style={{ ...btnPri, padding: '8px 14px', flexShrink: 0 }}>
                  {sending ? '...' : '→'}
                </button>
              </div>
            </div>
          )}
          {sesionActiva.estado === 'cerrado' && (
            <div style={{ padding: 14, background: 'rgba(0,0,0,.04)', textAlign: 'center', fontSize: 13, color: '#888' }}>
              Esta conversación fue cerrada
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Lista de solicitudes con vista de subpestaña ────────────────────────────
function SolicitudesPane({ usuario, esGestor, selected, setSelected, showNueva, setShowNueva }) {
  const [subTab, setSubTab] = useState(esGestor ? 'sin_tomar' : 'mis_tickets')
  const [solicitudes, setSolicitudes] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tomando, setTomando] = useState(null)
  const offset = useRef(0)

  const SUB_TABS = esGestor
    ? [
        ['sin_tomar', '📥 Sin tomar'],
        ['mis_tickets', '🎧 Mis tickets'],
        ['turno_alumno', '⏳ Turno del alumno'],
        ['cerrados', '✅ Cerrados'],
      ]
    : [['mis_tickets', '🎧 Mis solicitudes'], ['cerrados', '✅ Cerradas']]

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      let params = { limit: 30, offset: offset.current }
      if (q) params.q = q
      if (subTab === 'sin_tomar') {
        params.estado = 'nueva'
      } else if (subTab === 'mis_tickets') {
        if (esGestor) params.asignado_a = usuario.id
        // Para alumnos el backend filtra por alumno_id automáticamente
        // Excluimos cerrados y turno_alumno
      } else if (subTab === 'turno_alumno') {
        params.estado = 'turno_alumno'
        if (esGestor) params.asignado_a = usuario.id
      } else if (subTab === 'cerrados') {
        params.estado = 'cerrada'
        if (esGestor) params.asignado_a = usuario.id
      }
      const res = await api.getAtencionSolicitudes(params)
      let rows = res.rows
      // Filtrar mis_tickets: excluir cerrados y turno_alumno y sin tomar
      if (subTab === 'mis_tickets' && esGestor) {
        rows = rows.filter(s => !['cerrada', 'turno_alumno', 'nueva'].includes(s.estado))
      }
      setSolicitudes(rows)
      setTotal(res.total)
    } catch (_) {}
    finally { setLoading(false) }
  }, [subTab, q, usuario, esGestor])

  useEffect(() => { offset.current = 0; cargar() }, [cargar])

  async function tomar(folio, e) {
    e.stopPropagation()
    setTomando(folio)
    try {
      await api.tomarTicket(folio)
      await cargar()
      setSelected(folio)
    } catch (err) {
      alert(err.message || 'No se pudo tomar el ticket')
    } finally { setTomando(null) }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const hasSelected = !!selected

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', borderBottom: '1.5px solid rgba(0,0,0,.08)', background: '#fafafa', flexShrink: 0, overflowX: 'auto' }}>
        {SUB_TABS.map(([k, label]) => (
          <button key={k} onClick={() => { setSubTab(k); setSelected(null); offset.current = 0 }} style={{
            padding: '10px 16px', border: 'none', borderBottom: `2.5px solid ${subTab === k ? ORANGE : 'transparent'}`,
            background: 'none', cursor: 'pointer', fontWeight: subTab === k ? 700 : 400,
            color: subTab === k ? ORANGE : '#666', fontSize: 13, whiteSpace: 'nowrap', marginBottom: -1.5,
          }}>{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {usuario?.rol !== 'superadmin' && (
          <button onClick={() => setShowNueva(true)} style={{ ...btnPri, margin: '6px 10px', fontSize: 13, padding: '6px 14px' }}>+ Nueva</button>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {(!hasSelected || !isMobile) && (
          <div style={{ width: selected ? 360 : '100%', minWidth: selected ? 300 : undefined, borderRight: selected ? '1px solid rgba(0,0,0,.1)' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Buscador */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar por folio o asunto..."
                style={{ ...inpStyle, marginBottom: 0, padding: '6px 10px', fontSize: 13 }} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 0' }}>
              {loading && <p style={{ color: '#888', fontSize: 13, padding: '16px 8px' }}>Cargando...</p>}
              {!loading && solicitudes.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: '#888' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>
                    {subTab === 'sin_tomar' ? '📥' : subTab === 'cerrados' ? '✅' : subTab === 'turno_alumno' ? '⏳' : '🎧'}
                  </div>
                  <p style={{ margin: 0, fontSize: 14 }}>
                    {subTab === 'sin_tomar' ? 'No hay tickets sin tomar' :
                     subTab === 'cerrados' ? 'No hay tickets cerrados' :
                     subTab === 'turno_alumno' ? 'No hay tickets en turno del alumno' :
                     'No hay solicitudes activas'}
                  </p>
                  {!esGestor && subTab === 'mis_tickets' && (
                    <button onClick={() => setShowNueva(true)} style={{ ...btnPri, marginTop: 12 }}>Crear mi primera solicitud</button>
                  )}
                </div>
              )}

              {solicitudes.map(s => (
                <div key={s.id}>
                  <SolicitudCard sol={s} onClick={setSelected} selected={selected === s.id} />
                  {/* Mostrar contenido + botón tomar — solo gestores en sub-tab sin_tomar */}
                  {esGestor && subTab === 'sin_tomar' && (
                    <div style={{ margin: '-4px 0 8px', padding: '10px 14px', background: 'rgba(241,139,17,.04)', borderRadius: '0 0 10px 10px', borderTop: 'none', border: '1.5px solid rgba(241,139,17,.15)', borderTopWidth: 0, fontSize: 13, color: '#444' }}>
                      <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}>
                        {s.descripcion?.length > 160 ? s.descripcion.slice(0, 160) + '…' : s.descripcion}
                      </p>
                      <button
                        disabled={tomando === s.id}
                        onClick={(e) => tomar(s.id, e)}
                        style={{ ...btnPri, fontSize: 12, padding: '6px 14px' }}
                      >
                        {tomando === s.id ? 'Tomando...' : '✋ Tomar ticket'}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {total > solicitudes.length && (
                <button onClick={() => { offset.current += 30; cargar() }}
                  style={{ ...btnSec, width: '100%', margin: '8px 0 16px', fontSize: 13 }}>
                  Cargar más ({total - solicitudes.length} restantes)
                </button>
              )}
            </div>
          </div>
        )}

        {selected && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <SolicitudDetalle
              folio={selected}
              currentUser={usuario}
              esGestor={esGestor}
              onBack={() => setSelected(null)}
              onStatusChange={cargar}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Atencion() {
  const { usuario } = useAuth()
  const esGestor = ['superadmin', 'coordinador', 'admin_ventas'].includes(usuario?.rol)
  const [tab, setTab] = useState('solicitudes')
  const [selected, setSelected] = useState(null)
  const [showNueva, setShowNueva] = useState(false)

  const TABS = esGestor
    ? [['solicitudes', '🎧 Atención'], ['avisos', '📢 Avisos'], ['chat', '💬 Chat en vivo']]
    : [['solicitudes', '🎧 Atención']]

  function handleCreated(folio) {
    setShowNueva(false)
    setSelected(folio)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      {/* Tab bar principal */}
      <div style={{ display: 'flex', borderBottom: '2px solid rgba(0,0,0,.08)', background: '#fff', flexShrink: 0 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSelected(null) }} style={{
            padding: '12px 20px', border: 'none', borderBottom: `2.5px solid ${tab === k ? ORANGE : 'transparent'}`,
            background: 'none', cursor: 'pointer', fontWeight: tab === k ? 700 : 400,
            color: tab === k ? ORANGE : '#666', fontSize: 14, marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'solicitudes' && (
          <SolicitudesPane
            usuario={usuario}
            esGestor={esGestor}
            selected={selected}
            setSelected={setSelected}
            showNueva={showNueva}
            setShowNueva={setShowNueva}
          />
        )}
        {tab === 'avisos' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 24px' }}>
            <AvisosPage />
          </div>
        )}
        {tab === 'chat' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ChatEnVivoPane currentUser={usuario} />
          </div>
        )}
      </div>

      {showNueva && <NuevaSolicitudForm onCreated={handleCreated} onClose={() => setShowNueva(false)} />}
    </div>
  )
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const inpStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1.5px solid rgba(0,0,0,.15)', borderRadius: 8,
  padding: '8px 12px', fontSize: 14, outline: 'none',
  fontFamily: 'inherit', marginBottom: 12,
  background: '#fff',
}
const sel = { ...inpStyle, cursor: 'pointer' }
const lbl = { display: 'block', fontWeight: 600, fontSize: 13, color: '#444', marginBottom: 4 }
const btnPri = {
  background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8,
  padding: '9px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
  fontFamily: 'inherit',
}
const btnSec = {
  background: '#fff', color: '#555', border: '1.5px solid rgba(0,0,0,.2)', borderRadius: 8,
  padding: '8px 14px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  fontFamily: 'inherit',
}
