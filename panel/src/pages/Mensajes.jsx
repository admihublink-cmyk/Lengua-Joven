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
  if (isoStr.slice(0, 10) === hoy) return fmtHora(isoStr)
  return new Date(isoStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}
function fmtFechaLarga(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function Mensajes() {
  const { usuario } = useAuth()
  const { params } = useNav()

  const [tipoSel, setTipoSel]         = useState(null) // 'contacto' | 'clase' | 'chat'
  const [selId, setSelId]             = useState(null)

  const [mensajesIndiv, setMensajesIndiv]   = useState([])
  const [mensajesGrupo, setMensajesGrupo]   = useState([])
  const [contactos, setContactos]           = useState([])
  const [contactables, setContactables]     = useState([])
  const [misGruposClase, setMisGruposClase] = useState([])  // grupos de clase
  const [chatGrupos, setChatGrupos]         = useState([])  // chat grupos ad-hoc
  const [usuariosMap, setUsuariosMap]       = useState({})

  // Panel "+ Nuevo"
  const [panel, setPanel]   = useState(null) // null | 'buscar' | 'crear-grupo'
  const [busqueda, setBusqueda] = useState('')

  // Formulario crear grupo
  const [nuevoNombre, setNuevoNombre]       = useState('')
  const [seleccionados, setSeleccionados]   = useState([])  // ids de miembros
  const [creando, setCreando]               = useState(false)
  const [errorCrear, setErrorCrear]         = useState('')

  const [texto, setTexto]     = useState('')
  const bottomRef   = useRef(null)
  const inputRef    = useRef(null)
  const busquedaRef = useRef(null)

  async function cargar() {
    try {
      const [msgs, u, grupos, inscripciones, chatGruposData] = await Promise.all([
        api.getMensajes(), api.getUsuarios(), api.getGrupos(),
        api.getInscripciones(), api.getChatGrupos(),
      ])
      const map = {}
      u.forEach(x => { map[x.id] = x })
      if (params?.contactId && !map[params.contactId]) {
        try { const c = await api.getUsuario(params.contactId); if (c) map[c.id] = c } catch {}
      }
      setUsuariosMap(map)
      setMensajesIndiv(msgs)
      setChatGrupos(chatGruposData)

      // Mis grupos de clase según rol
      const misGruposIds = new Set()
      if (usuario.rol === 'alumno') {
        inscripciones.filter(i => i.alumno_id === usuario.id).forEach(i => misGruposIds.add(i.grupo_id))
      } else if (usuario.rol === 'profesor') {
        grupos.filter(g => g.profesor_id === usuario.id).forEach(g => misGruposIds.add(g.id))
      } else {
        grupos.filter(g => !usuario.plantel_id || g.plantel_id === usuario.plantel_id)
              .forEach(g => misGruposIds.add(g.id))
      }
      setMisGruposClase(grupos.filter(g => misGruposIds.has(g.id)))

      // Personas contactables
      const contactablesIds = new Set()
      inscripciones.forEach(i => {
        if (misGruposIds.has(i.grupo_id) && i.alumno_id && i.alumno_id !== usuario.id)
          contactablesIds.add(i.alumno_id)
      })
      grupos.forEach(g => {
        if (misGruposIds.has(g.id) && g.profesor_id && g.profesor_id !== usuario.id)
          contactablesIds.add(g.profesor_id)
      })
      msgs.forEach(m => {
        if (m.de === usuario.id && m.para) contactablesIds.add(m.para)
        if (m.para === usuario.id) contactablesIds.add(m.de)
      })
      if (params?.contactId) contactablesIds.add(params.contactId)
      const contactablesList = [...contactablesIds].map(id => map[id]).filter(Boolean)
      setContactables(contactablesList)

      // Conversaciones individuales existentes
      const conMensajesIds = new Set()
      msgs.forEach(m => {
        if (!m.grupo_id && !m.chat_grupo_id) {
          if (m.de === usuario.id && m.para) conMensajesIds.add(m.para)
          if (m.para === usuario.id) conMensajesIds.add(m.de)
        }
      })
      if (params?.contactId) conMensajesIds.add(params.contactId)
      const enriched = [...conMensajesIds].map(id => map[id]).filter(Boolean).map(c => {
        const conv = msgs.filter(m => !m.grupo_id && !m.chat_grupo_id &&
          ((m.de === usuario.id && m.para === c.id) || (m.de === c.id && m.para === usuario.id)))
          .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
        const noLeidos = conv.filter(m => m.para === usuario.id && !m.leido).length
        const ultimo = conv[conv.length - 1]
        return { ...c, noLeidos, ultimoMsg: ultimo?.contenido || '', ultimaFecha: ultimo?.fecha || '' }
      }).sort((a, b) => (b.ultimaFecha || '').localeCompare(a.ultimaFecha || ''))
      setContactos(enriched)
    } catch (e) { console.error('Error cargando mensajes:', e) }
  }

  useEffect(() => {
    cargar().then(async () => {
      if (params?.grupoId) {
        const grupos = await api.getGrupos()
        const g = grupos.find(x => x.id === params.grupoId)
        if (g) seleccionarGrupoClase(g)
      } else if (params?.contactId) {
        setTipoSel('contacto'); setSelId(params.contactId)
      }
    })
  }, [])

  async function cargarMensajesGrupo(tipo, id) {
    try {
      const param = tipo === 'chat' ? { chat_grupo_id: id } : { grupo_id: id }
      const msgs = await api.getMensajes(param)
      setMensajesGrupo(msgs)
    } catch {}
  }

  async function seleccionarGrupoClase(g) {
    setTipoSel('clase'); setSelId(g.id); setPanel(null); setBusqueda('')
    await cargarMensajesGrupo('clase', g.id)
    setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); inputRef.current?.focus() }, 80)
  }

  async function seleccionarChatGrupo(cg) {
    setTipoSel('chat'); setSelId(cg.id); setPanel(null); setBusqueda('')
    await cargarMensajesGrupo('chat', cg.id)
    setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); inputRef.current?.focus() }, 80)
  }

  async function seleccionarContacto(c) {
    setTipoSel('contacto'); setSelId(c.id); setPanel(null); setBusqueda('')
    try { await api.marcarMensajesLeidos(c.id); await cargar() } catch {}
    setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); inputRef.current?.focus() }, 80)
  }

  async function enviar() {
    if (!texto.trim() || !selId) return
    try {
      if (tipoSel === 'clase') {
        await api.enviarMensaje({ contenido: texto.trim(), grupo_id: selId })
        await cargarMensajesGrupo('clase', selId)
      } else if (tipoSel === 'chat') {
        await api.enviarMensaje({ contenido: texto.trim(), chat_grupo_id: selId })
        await cargarMensajesGrupo('chat', selId)
      } else {
        await api.enviarMensaje({ de: usuario.id, para: selId, contenido: texto.trim() })
        await cargar()
      }
      setTexto('')
      inputRef.current?.focus()
    } catch (e) { console.error('Error enviando mensaje:', e) }
  }

  async function crearGrupo() {
    if (!nuevoNombre.trim()) { setErrorCrear('Escribe un nombre para el grupo.'); return }
    if (seleccionados.length === 0) { setErrorCrear('Selecciona al menos una persona.'); return }
    setCreando(true); setErrorCrear('')
    try {
      const cg = await api.crearChatGrupo({ nombre: nuevoNombre.trim(), miembros: seleccionados })
      await cargar()
      setPanel(null); setNuevoNombre(''); setSeleccionados([])
      seleccionarChatGrupo(cg)
    } catch (e) {
      setErrorCrear(e.message || 'Error al crear el grupo.')
    } finally { setCreando(false) }
  }

  function toggleMiembro(id) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  function agruparPorDia(msgs) {
    const grupos = []; let diaActual = ''
    msgs.forEach(m => {
      const fecha = m.fecha || m.creado_en || ''
      const dia = fecha.slice(0, 10)
      if (dia !== diaActual) { grupos.push({ tipo: 'sep', fecha }); diaActual = dia }
      grupos.push({ tipo: 'msg', ...m })
    })
    return grupos
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [selId, mensajesIndiv, mensajesGrupo])
  useEffect(() => { if (panel === 'buscar') setTimeout(() => busquedaRef.current?.focus(), 50) }, [panel])

  // Datos derivados
  const contactoSel = tipoSel === 'contacto' ? (contactos.find(c => c.id === selId) || usuariosMap[selId]) : null
  const grupoClaseSel = tipoSel === 'clase' ? misGruposClase.find(g => g.id === selId) : null
  const chatGrupoSel  = tipoSel === 'chat'  ? chatGrupos.find(g => g.id === selId) : null

  const mensajesActuales = (tipoSel === 'clase' || tipoSel === 'chat')
    ? mensajesGrupo
    : mensajesIndiv.filter(m => !m.grupo_id && !m.chat_grupo_id &&
        ((m.de === usuario.id && m.para === selId) || (m.de === selId && m.para === usuario.id)))
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

  const items = agruparPorDia(mensajesActuales)

  const q = busqueda.toLowerCase()
  const contactablesEnLista = new Set(contactos.map(c => c.id))
  const existentesFiltrados = contactos.filter(c => !q || c.nombre.toLowerCase().includes(q))
  const sugeridos = contactables.filter(c => !contactablesEnLista.has(c.id) && (!q || c.nombre.toLowerCase().includes(q)))
  const gruposFiltrados = misGruposClase.filter(g => {
    const txt = `${g.idioma || ''} ${g.nivel_nombre || ''} ${g.horario || ''}`.toLowerCase()
    return !q || txt.includes(q)
  })
  const chatsFiltrados = chatGrupos.filter(g => !q || g.nombre.toLowerCase().includes(q))

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}><h2>Mensajes</h2></div>

      <div className="chat-layout">
        {/* ── Panel izquierdo ── */}
        <div className="chat-contactos">
          <div className="chat-contactos-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              💬 Conversaciones
              {contactos.some(c => c.noLeidos > 0) && (
                <span className="chat-unread" style={{ marginLeft: 8 }}>{contactos.reduce((s, c) => s + c.noLeidos, 0)}</span>
              )}
            </span>
            {!panel && (
              <button onClick={() => setPanel('buscar')}
                style={{ background: 'var(--primario,#F18B11)', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                + Nuevo
              </button>
            )}
          </div>

          {/* ── Panel: buscar ── */}
          {panel === 'buscar' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--borde)' }}>
                <input ref={busquedaRef} value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar persona o grupo…"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                    borderRadius: 7, fontSize: 13, border: '1px solid var(--borde)',
                    background: 'var(--bg-3)', color: 'var(--texto)', outline: 'none' }} />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {/* Opción crear grupo */}
                <div onClick={() => { setPanel('crear-grupo'); setBusqueda(''); setNuevoNombre(''); setSeleccionados([]); setErrorCrear('') }}
                  style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    borderBottom: '1px solid var(--borde)', fontWeight: 600, fontSize: 13, color: 'var(--primario,#F18B11)' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--bg-3)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span style={{ fontSize: 18 }}>👥</span> Crear grupo nuevo
                </div>
                {chatsFiltrados.length > 0 && <SeccionLabel>Mis grupos</SeccionLabel>}
                {chatsFiltrados.map(g => <ChatGrupoItem key={g.id} g={g} activo={false} onClick={() => seleccionarChatGrupo(g)} />)}
                {gruposFiltrados.length > 0 && <SeccionLabel>Grupos de clase</SeccionLabel>}
                {gruposFiltrados.map(g => <GrupoClaseItem key={g.id} g={g} activo={false} onClick={() => seleccionarGrupoClase(g)} />)}
                {existentesFiltrados.length > 0 && <SeccionLabel>Conversaciones recientes</SeccionLabel>}
                {existentesFiltrados.map(c => <ContactoItem key={c.id} c={c} activo={false} onClick={() => seleccionarContacto(c)} />)}
                {sugeridos.length > 0 && <SeccionLabel>De tus grupos</SeccionLabel>}
                {sugeridos.map(c => <ContactoItem key={c.id} c={c} activo={false} onClick={() => seleccionarContacto(c)} />)}
                {!chatsFiltrados.length && !gruposFiltrados.length && !existentesFiltrados.length && !sugeridos.length && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>No se encontraron resultados.</div>
                )}
              </div>
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--borde)' }}>
                <button onClick={() => { setPanel(null); setBusqueda('') }}
                  style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--texto-muted)', cursor: 'pointer', width: '100%', textAlign: 'center' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ── Panel: crear grupo ── */}
          {panel === 'crear-grupo' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--borde)', fontWeight: 700, fontSize: 13 }}>
                Nuevo grupo
              </div>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--borde)' }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                  placeholder="Nombre del grupo…" autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                    borderRadius: 7, fontSize: 13, border: '1px solid var(--borde)',
                    background: 'var(--bg-3)', color: 'var(--texto)', outline: 'none' }} />
              </div>
              <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 700,
                color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Agregar personas ({seleccionados.length} seleccionadas)
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {contactables.map(c => {
                  const sel = seleccionados.includes(c.id)
                  const rolCfg = ROL_PERMISOS[c.rol]
                  return (
                    <div key={c.id} onClick={() => toggleMiembro(c.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        cursor: 'pointer', background: sel ? 'rgba(241,139,17,0.1)' : 'transparent',
                        transition: 'background .12s' }}
                      onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--bg-3)' }}
                      onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? 'var(--primario,#F18B11)' : 'var(--borde)'}`,
                        background: sel ? 'var(--primario,#F18B11)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: '#fff' }}>
                        {sel ? '✓' : ''}
                      </div>
                      <div className="avatar" style={{ background: rolCfg?.color || '#888', width: 30, height: 30, fontSize: 12, flexShrink: 0 }}>
                        {c.nombre.charAt(0)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nombre}</div>
                        <div style={{ fontSize: 11, color: 'var(--texto-muted)' }}>{rolCfg?.label || c.rol}</div>
                      </div>
                    </div>
                  )
                })}
                {contactables.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
                    No hay contactos disponibles.
                  </div>
                )}
              </div>
              {errorCrear && (
                <div style={{ margin: '0 12px', padding: '6px 10px', background: 'rgba(231,76,60,.1)',
                  border: '1px solid rgba(231,76,60,.3)', borderRadius: 6, fontSize: 12, color: '#e74c3c' }}>
                  {errorCrear}
                </div>
              )}
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--borde)', display: 'flex', gap: 8 }}>
                <button onClick={() => setPanel('buscar')}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--borde)',
                    background: 'none', color: 'var(--texto)', cursor: 'pointer', fontSize: 13 }}>
                  ← Atrás
                </button>
                <button onClick={crearGrupo} disabled={creando}
                  style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none',
                    background: 'var(--primario,#F18B11)', color: '#fff',
                    fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  {creando ? 'Creando…' : 'Crear grupo'}
                </button>
              </div>
            </div>
          )}

          {/* ── Lista normal ── */}
          {!panel && (
            <div className="chat-contactos-lista">
              {chatGrupos.length > 0 && (
                <>
                  <SeccionLabel>👥 Mis grupos</SeccionLabel>
                  {chatGrupos.map(g => <ChatGrupoItem key={g.id} g={g} activo={tipoSel==='chat' && selId===g.id} onClick={() => seleccionarChatGrupo(g)} />)}
                </>
              )}
              {misGruposClase.length > 0 && (
                <>
                  <SeccionLabel>🏫 Grupos de clase</SeccionLabel>
                  {misGruposClase.map(g => <GrupoClaseItem key={g.id} g={g} activo={tipoSel==='clase' && selId===g.id} onClick={() => seleccionarGrupoClase(g)} />)}
                </>
              )}
              {contactos.length > 0 && (chatGrupos.length > 0 || misGruposClase.length > 0) && (
                <SeccionLabel>💬 Directos</SeccionLabel>
              )}
              {contactos.map(c => <ContactoItem key={c.id} c={c} activo={tipoSel==='contacto' && selId===c.id} onClick={() => seleccionarContacto(c)} />)}
              {chatGrupos.length === 0 && misGruposClase.length === 0 && contactos.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
                  No hay conversaciones.<br />
                  <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>Usa "+ Nuevo" para iniciar una.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Panel derecho ── */}
        {!selId ? (
          <div className="chat-sin-sel">
            <span style={{ fontSize: 48 }}>💬</span>
            <p>Selecciona una conversación</p>
            <p style={{ fontSize: 12 }}>Mensajes directos, grupos de clase y grupos propios</p>
          </div>
        ) : (
          <div className="chat-conversacion">
            <div className="chat-conv-head">
              {tipoSel === 'clase' ? (
                <>
                  <div style={{ width:34, height:34, borderRadius:'50%', background:'#2980b9',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🏫</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>
                      {grupoClaseSel?.idioma || 'Grupo'}{grupoClaseSel?.nivel_nombre ? ` · ${grupoClaseSel.nivel_nombre}` : ''}
                    </div>
                    <div style={{ fontSize:12, color:'var(--texto-muted)' }}>
                      {grupoClaseSel?.horario || grupoClaseSel?.codigo || 'Grupo de clase'}
                    </div>
                  </div>
                </>
              ) : tipoSel === 'chat' ? (
                <>
                  <div style={{ width:34, height:34, borderRadius:'50%', background:'#8e44ad',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>👥</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>{chatGrupoSel?.nombre || 'Grupo'}</div>
                    <div style={{ fontSize:12, color:'var(--texto-muted)' }}>Grupo de chat</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="avatar" style={{ background:ROL_PERMISOS[contactoSel?.rol]?.color||'#888', width:34, height:34, fontSize:14 }}>
                    {contactoSel?.nombre?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>{contactoSel?.nombre}</div>
                    <div style={{ fontSize:12, color:'var(--texto-muted)' }}>{ROL_PERMISOS[contactoSel?.rol]?.label}</div>
                  </div>
                </>
              )}
            </div>

            <div className="chat-mensajes">
              {items.length === 0 && (
                <div style={{ textAlign:'center', color:'var(--texto-muted)', fontSize:13, marginTop:40 }}>
                  {tipoSel !== 'contacto' ? 'Sé el primero en escribir.' : 'Escribe un mensaje para iniciar la conversación.'}
                </div>
              )}
              {items.map((item, i) => {
                if (item.tipo === 'sep') return (
                  <div key={`sep-${i}`} className="chat-fecha-sep" style={{ textTransform:'capitalize' }}>
                    {fmtFechaLarga(item.fecha)}
                  </div>
                )
                const esMio = item.de === usuario.id
                return (
                  <div key={item.id} className={`chat-burbuja-wrap ${esMio ? 'mia' : 'otra'}`}>
                    {(tipoSel === 'clase' || tipoSel === 'chat') && !esMio && (
                      <div style={{ fontSize:11, color:'var(--texto-muted)', marginBottom:2, marginLeft:4, fontWeight:600 }}>
                        {usuariosMap[item.de]?.nombre || item.de}
                      </div>
                    )}
                    <div className={`chat-burbuja ${esMio ? 'mia' : 'otra'}`}>{item.contenido}</div>
                    <span className="chat-burbuja-hora">{fmtHora(item.fecha || item.creado_en)}</span>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div className="chat-input-bar">
              <textarea ref={inputRef} className="chat-input"
                placeholder={tipoSel !== 'contacto' ? 'Escribe en el grupo… (Enter para enviar)' : 'Escribe un mensaje… (Enter para enviar)'}
                value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={onKeyDown} rows={1} />
              <button className="btn-primario" onClick={enviar} disabled={!texto.trim()}
                style={{ padding:'8px 16px', borderRadius:20, alignSelf:'flex-end' }}>↑</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────

function SeccionLabel({ children }) {
  return (
    <div style={{ padding:'6px 12px 2px', fontSize:11, fontWeight:700,
      color:'var(--texto-muted)', textTransform:'uppercase', letterSpacing:'.05em',
      borderBottom:'1px solid var(--borde)' }}>
      {children}
    </div>
  )
}

function ContactoItem({ c, activo, onClick }) {
  const rolCfg = ROL_PERMISOS[c.rol]
  return (
    <div className={`chat-contacto-item ${activo ? 'activo' : ''}`} onClick={onClick}>
      <div className="avatar" style={{ background:rolCfg?.color||'#888', width:38, height:38, fontSize:15 }}>
        {c.nombre.charAt(0)}
      </div>
      <div className="chat-contacto-info">
        <div className="chat-contacto-nombre">{c.nombre}</div>
        <div className="chat-contacto-preview">
          {c.ultimoMsg
            ? <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.ultimoMsg}</span>
            : <span style={{ fontStyle:'italic', color:'var(--texto-muted)' }}>{ROL_PERMISOS[c.rol]?.label||c.rol}</span>}
        </div>
      </div>
      <div className="chat-contacto-meta">
        {c.ultimaFecha && <span className="chat-contacto-hora">{(function fmtFechaCorta(isoStr){
          if(!isoStr)return'';const hoy=new Date().toISOString().slice(0,10);
          if(isoStr.slice(0,10)===hoy)return new Date(isoStr).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
          return new Date(isoStr).toLocaleDateString('es-MX',{day:'numeric',month:'short'})
        })(c.ultimaFecha)}</span>}
        {c.noLeidos > 0 && <span className="chat-unread">{c.noLeidos}</span>}
      </div>
    </div>
  )
}

function ChatGrupoItem({ g, activo, onClick }) {
  return (
    <div className={`chat-contacto-item ${activo ? 'activo' : ''}`} onClick={onClick}>
      <div style={{ width:38, height:38, borderRadius:'50%', background:'#8e44ad',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
        👥
      </div>
      <div className="chat-contacto-info">
        <div className="chat-contacto-nombre">{g.nombre}</div>
        <div className="chat-contacto-preview" style={{ color:'var(--texto-muted)', fontStyle:'italic' }}>Grupo de chat</div>
      </div>
    </div>
  )
}

function GrupoClaseItem({ g, activo, onClick }) {
  const nombre = [g.idioma, g.nivel_nombre].filter(Boolean).join(' · ')
  return (
    <div className={`chat-contacto-item ${activo ? 'activo' : ''}`} onClick={onClick}>
      <div style={{ width:38, height:38, borderRadius:'50%', background:'#2980b9',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
        🏫
      </div>
      <div className="chat-contacto-info">
        <div className="chat-contacto-nombre">{nombre || 'Grupo'}</div>
        <div className="chat-contacto-preview" style={{ color:'var(--texto-muted)' }}>
          {g.horario || g.codigo || 'Grupo de clase'}
        </div>
      </div>
    </div>
  )
}
