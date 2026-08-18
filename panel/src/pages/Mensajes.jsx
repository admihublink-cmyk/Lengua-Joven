import { useState, useEffect, useRef } from 'react'
import { useAuth, useNav } from '../App.jsx'
import { ROL_PERMISOS } from '../auth.js'
import * as api from '../api.js'

function fmtHora(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
function fmtFechaCorta(isoStr) {
  if (!isoStr) return ''
  const hoy = new Date().toISOString().slice(0, 10)
  const dStr = isoStr.slice(0, 10)
  if (dStr === hoy) return fmtHora(isoStr)
  return new Date(isoStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}
function fmtFechaLarga(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function Mensajes() {
  const { usuario } = useAuth()
  const { params } = useNav()
  const [todos, setTodos] = useState([])
  const [contactos, setContactos] = useState([])
  const [contactables, setContactables] = useState([])
  const [usuariosMap, setUsuariosMap] = useState({})
  const [selId, setSelId] = useState(params?.contactId || null)
  const [texto, setTexto] = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const busquedaRef = useRef(null)

  async function cargar() {
    try {
      const [msgs, u, grupos, inscripciones] = await Promise.all([
        api.getMensajes(), api.getUsuarios(), api.getGrupos(), api.getInscripciones(),
      ])
      const map = {}
      u.forEach(x => { map[x.id] = x })
      if (params?.contactId && !map[params.contactId]) {
        try {
          const c = await api.getUsuario(params.contactId)
          if (c) map[c.id] = c
        } catch {}
      }
      setUsuariosMap(map)
      setTodos(msgs)

      // Mis grupos según rol
      const misGruposIds = new Set()
      if (usuario.rol === 'alumno') {
        inscripciones.filter(i => i.alumno_id === usuario.id).forEach(i => misGruposIds.add(i.grupo_id))
      } else if (usuario.rol === 'profesor') {
        grupos.filter(g => g.profesor_id === usuario.id).forEach(g => misGruposIds.add(g.id))
      } else {
        // Para otros roles: todos los grupos de su plantel
        grupos.filter(g => !usuario.plantel_id || g.plantel_id === usuario.plantel_id).forEach(g => misGruposIds.add(g.id))
      }

      // Personas contactables: compañeros + profesores de mis grupos + historial de mensajes
      const contactablesIds = new Set()
      inscripciones.forEach(i => {
        if (misGruposIds.has(i.grupo_id) && i.alumno_id && i.alumno_id !== usuario.id) {
          contactablesIds.add(i.alumno_id)
        }
      })
      grupos.forEach(g => {
        if (misGruposIds.has(g.id) && g.profesor_id && g.profesor_id !== usuario.id) {
          contactablesIds.add(g.profesor_id)
        }
      })
      msgs.forEach(m => {
        if (m.de === usuario.id) contactablesIds.add(m.para)
        if (m.para === usuario.id) contactablesIds.add(m.de)
      })
      if (params?.contactId) contactablesIds.add(params.contactId)

      setContactables([...contactablesIds].map(id => map[id]).filter(Boolean))

      // Contactos que ya tienen historial de mensajes (para la lista principal)
      const conMensajesIds = new Set()
      msgs.forEach(m => {
        if (m.de === usuario.id) conMensajesIds.add(m.para)
        if (m.para === usuario.id) conMensajesIds.add(m.de)
      })
      if (params?.contactId) conMensajesIds.add(params.contactId)

      const enriched = [...conMensajesIds]
        .map(id => map[id]).filter(Boolean)
        .map(c => {
          const conv = msgs
            .filter(m => (m.de === usuario.id && m.para === c.id) || (m.de === c.id && m.para === usuario.id))
            .sort((a, b) => (a.fecha || a.creado_en || '').localeCompare(b.fecha || b.creado_en || ''))
          const noLeidos = conv.filter(m => m.para === usuario.id && !m.leido).length
          const ultimo = conv[conv.length - 1]
          return { ...c, noLeidos, ultimoMsg: ultimo?.contenido || '', ultimaFecha: ultimo?.fecha || ultimo?.creado_en || '' }
        })
        .sort((a, b) => (b.ultimaFecha || '').localeCompare(a.ultimaFecha || ''))
      setContactos(enriched)
    } catch (e) {
      console.error('Error cargando mensajes:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  function mensajesConContacto(contactoId) {
    return todos
      .filter(m => (m.de === usuario.id && m.para === contactoId) || (m.de === contactoId && m.para === usuario.id))
      .sort((a, b) => (a.fecha || a.creado_en || '').localeCompare(b.fecha || b.creado_en || ''))
  }

  async function seleccionar(contacto) {
    setSelId(contacto.id)
    setModalNuevo(false)
    setBusqueda('')
    try {
      await api.marcarMensajesLeidos(contacto.id)
      await cargar()
    } catch {}
    setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); inputRef.current?.focus() }, 80)
  }

  async function enviar() {
    if (!texto.trim() || !selId) return
    try {
      await api.enviarMensaje({ de: usuario.id, para: selId, contenido: texto.trim() })
      setTexto('')
      await cargar()
      inputRef.current?.focus()
    } catch (e) {
      console.error('Error enviando mensaje:', e)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  function agruparPorDia(msgs) {
    const grupos = []
    let diaActual = ''
    msgs.forEach(m => {
      const fecha = m.fecha || m.creado_en || ''
      const dia = fecha.slice(0, 10)
      if (dia !== diaActual) { grupos.push({ tipo: 'sep', fecha, dia }); diaActual = dia }
      grupos.push({ tipo: 'msg', ...m })
    })
    return grupos
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [selId, todos])

  // Abrir modal: enfocar el buscador automáticamente
  useEffect(() => {
    if (modalNuevo) setTimeout(() => busquedaRef.current?.focus(), 50)
  }, [modalNuevo])

  const contactoSel = contactos.find(c => c.id === selId) || (selId ? usuariosMap[selId] : null)
  const mensajes = mensajesConContacto(selId)
  const items = agruparPorDia(mensajes)

  // Filtrar contactables por búsqueda, excluyendo los que ya están en la lista de contactos
  const contactablesEnLista = new Set(contactos.map(c => c.id))
  const sugeridos = contactables.filter(c => {
    if (contactablesEnLista.has(c.id)) return false
    if (!busqueda.trim()) return true
    return c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  })
  const existentesFiltrados = contactos.filter(c =>
    !busqueda.trim() || c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2>Mensajes</h2>
      </div>

      <div className="chat-layout">
        <div className="chat-contactos">
          <div className="chat-contactos-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              💬 Conversaciones
              {contactos.some(c => c.noLeidos > 0) && (
                <span className="chat-unread" style={{ marginLeft: 8 }}>
                  {contactos.reduce((s, c) => s + c.noLeidos, 0)}
                </span>
              )}
            </span>
            <button
              onClick={() => { setModalNuevo(v => !v); setBusqueda('') }}
              title="Nuevo mensaje"
              style={{
                background: 'var(--primario, #F18B11)', color: '#fff',
                border: 'none', borderRadius: 8, padding: '3px 10px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              + Nuevo
            </button>
          </div>

          {/* Modal "Nuevo mensaje" */}
          {modalNuevo && (
            <div style={{
              position: 'absolute', zIndex: 50,
              background: 'var(--bg-2)', border: '1px solid var(--borde)',
              borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              width: 280, maxHeight: 360, display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--borde)' }}>
                <input
                  ref={busquedaRef}
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar persona…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '7px 10px', borderRadius: 7, fontSize: 13,
                    border: '1px solid var(--borde)', background: 'var(--bg-3)',
                    color: 'var(--texto)', outline: 'none',
                  }}
                />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {existentesFiltrados.length > 0 && (
                  <>
                    <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 700, color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Conversaciones recientes
                    </div>
                    {existentesFiltrados.map(c => (
                      <NuevoMsgItem key={c.id} c={c} onSelect={() => seleccionar(c)} />
                    ))}
                  </>
                )}
                {sugeridos.length > 0 && (
                  <>
                    <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 700, color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      De tus grupos
                    </div>
                    {sugeridos.map(c => (
                      <NuevoMsgItem key={c.id} c={c} onSelect={() => seleccionar(c)} />
                    ))}
                  </>
                )}
                {existentesFiltrados.length === 0 && sugeridos.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
                    No se encontraron personas.
                  </div>
                )}
              </div>
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--borde)', textAlign: 'right' }}>
                <button onClick={() => { setModalNuevo(false); setBusqueda('') }}
                  style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--texto-muted)', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="chat-contactos-lista">
            {contactos.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
                No hay conversaciones aún.<br />
                <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  Usa "+ Nuevo" para iniciar una.
                </span>
              </div>
            )}
            {contactos.map(c => {
              const rolCfg = ROL_PERMISOS[c.rol]
              return (
                <div key={c.id} className={`chat-contacto-item ${selId === c.id ? 'activo' : ''}`} onClick={() => seleccionar(c)}>
                  <div className="avatar" style={{ background: rolCfg?.color || '#888', width: 38, height: 38, fontSize: 15 }}>
                    {c.nombre.charAt(0)}
                  </div>
                  <div className="chat-contacto-info">
                    <div className="chat-contacto-nombre">{c.nombre}</div>
                    <div className="chat-contacto-preview">
                      {c.ultimoMsg || <span style={{ fontStyle: 'italic' }}>Sin mensajes</span>}
                    </div>
                  </div>
                  <div className="chat-contacto-meta">
                    {c.ultimaFecha && <span className="chat-contacto-hora">{fmtFechaCorta(c.ultimaFecha)}</span>}
                    {c.noLeidos > 0 && <span className="chat-unread">{c.noLeidos}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {!selId ? (
          <div className="chat-sin-sel">
            <span style={{ fontSize: 48 }}>💬</span>
            <p>Selecciona una conversación</p>
            <p style={{ fontSize: 12 }}>Puedes enviar mensajes a profesores y compañeros de grupo</p>
          </div>
        ) : (
          <div className="chat-conversacion">
            <div className="chat-conv-head">
              <div className="avatar" style={{ background: ROL_PERMISOS[contactoSel?.rol]?.color || '#888', width: 34, height: 34, fontSize: 14 }}>
                {contactoSel?.nombre?.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{contactoSel?.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--texto-muted)' }}>
                  {ROL_PERMISOS[contactoSel?.rol]?.label}
                </div>
              </div>
            </div>

            <div className="chat-mensajes">
              {items.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13, marginTop: 40 }}>
                  Escribe un mensaje para iniciar la conversación.
                </div>
              )}
              {items.map((item, i) => {
                if (item.tipo === 'sep') {
                  return (
                    <div key={`sep-${i}`} className="chat-fecha-sep" style={{ textTransform: 'capitalize' }}>
                      {fmtFechaLarga(item.fecha)}
                    </div>
                  )
                }
                const esMio = item.de === usuario.id
                return (
                  <div key={item.id} className={`chat-burbuja-wrap ${esMio ? 'mia' : 'otra'}`}>
                    <div className={`chat-burbuja ${esMio ? 'mia' : 'otra'}`}>{item.contenido}</div>
                    <span className="chat-burbuja-hora">{fmtHora(item.fecha || item.creado_en)}</span>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div className="chat-input-bar">
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="Escribe un mensaje… (Enter para enviar)"
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
              />
              <button
                className="btn-primario"
                onClick={enviar}
                disabled={!texto.trim()}
                style={{ padding: '8px 16px', borderRadius: 20, alignSelf: 'flex-end' }}
              >
                ↑
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cerrar modal al hacer clic fuera */}
      {modalNuevo && (
        <div onClick={() => { setModalNuevo(false); setBusqueda('') }}
          style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      )}
    </div>
  )
}

function NuevoMsgItem({ c, onSelect }) {
  const rolCfg = ROL_PERMISOS[c.rol]
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', cursor: 'pointer',
        transition: 'background .12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div className="avatar" style={{ background: rolCfg?.color || '#888', width: 32, height: 32, fontSize: 13, flexShrink: 0 }}>
        {c.nombre.charAt(0)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
        <div style={{ fontSize: 11, color: 'var(--texto-muted)' }}>{rolCfg?.label || c.rol}</div>
      </div>
    </div>
  )
}
