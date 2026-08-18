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

  // ── Estado de selección ────────────────────────────────────────────────
  const [tipoSel, setTipoSel]       = useState(null) // 'contacto' | 'grupo'
  const [selId, setSelId]           = useState(params?.contactId || null)

  // ── Datos ──────────────────────────────────────────────────────────────
  const [mensajesIndiv, setMensajesIndiv] = useState([])   // mensajes 1-a-1
  const [mensajesGrupo, setMensajesGrupo] = useState([])   // mensajes del grupo seleccionado
  const [contactos, setContactos]   = useState([])          // conversaciones existentes
  const [contactables, setContactables] = useState([])      // personas del grupo (para "Nuevo")
  const [misGrupos, setMisGrupos]   = useState([])
  const [usuariosMap, setUsuariosMap] = useState({})

  // ── Búsqueda / Nuevo ───────────────────────────────────────────────────
  const [buscando, setBuscando]     = useState(false)
  const [busqueda, setBusqueda]     = useState('')

  // ── UI ─────────────────────────────────────────────────────────────────
  const [texto, setTexto]           = useState('')
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const busquedaRef = useRef(null)

  // ── Carga inicial ──────────────────────────────────────────────────────
  async function cargar() {
    try {
      const [msgs, u, grupos, inscripciones] = await Promise.all([
        api.getMensajes(), api.getUsuarios(), api.getGrupos(), api.getInscripciones(),
      ])
      const map = {}
      u.forEach(x => { map[x.id] = x })
      if (params?.contactId && !map[params.contactId]) {
        try { const c = await api.getUsuario(params.contactId); if (c) map[c.id] = c } catch {}
      }
      setUsuariosMap(map)
      setMensajesIndiv(msgs)

      // Mis grupos según rol
      const misGruposIds = new Set()
      if (usuario.rol === 'alumno') {
        inscripciones.filter(i => i.alumno_id === usuario.id).forEach(i => misGruposIds.add(i.grupo_id))
      } else if (usuario.rol === 'profesor') {
        grupos.filter(g => g.profesor_id === usuario.id).forEach(g => misGruposIds.add(g.id))
      } else {
        grupos.filter(g => !usuario.plantel_id || g.plantel_id === usuario.plantel_id)
              .forEach(g => misGruposIds.add(g.id))
      }
      setMisGrupos(grupos.filter(g => misGruposIds.has(g.id)))

      // Personas contactables (compañeros + profesores de mis grupos + historial)
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
        if (m.de === usuario.id) contactablesIds.add(m.para)
        if (m.para === usuario.id) contactablesIds.add(m.de)
      })
      if (params?.contactId) contactablesIds.add(params.contactId)
      setContactables([...contactablesIds].map(id => map[id]).filter(Boolean))

      // Conversaciones 1-a-1 existentes
      const conMensajesIds = new Set()
      msgs.forEach(m => {
        if (!m.grupo_id) {
          if (m.de === usuario.id) conMensajesIds.add(m.para)
          if (m.para === usuario.id) conMensajesIds.add(m.de)
        }
      })
      if (params?.contactId) conMensajesIds.add(params.contactId)
      const enriched = [...conMensajesIds].map(id => map[id]).filter(Boolean).map(c => {
        const conv = msgs.filter(m => !m.grupo_id &&
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
    cargar()
    if (params?.contactId) setTipoSel('contacto')
  }, [])

  // Cargar mensajes del grupo cuando se selecciona uno
  async function seleccionarGrupo(grupo) {
    setTipoSel('grupo')
    setSelId(grupo.id)
    setBuscando(false)
    setBusqueda('')
    try {
      const msgs = await api.getMensajes({ grupo_id: grupo.id })
      setMensajesGrupo(msgs)
    } catch {}
    setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); inputRef.current?.focus() }, 80)
  }

  async function seleccionarContacto(contacto) {
    setTipoSel('contacto')
    setSelId(contacto.id)
    setBuscando(false)
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
      if (tipoSel === 'grupo') {
        await api.enviarMensaje({ contenido: texto.trim(), grupo_id: selId })
        const msgs = await api.getMensajes({ grupo_id: selId })
        setMensajesGrupo(msgs)
      } else {
        await api.enviarMensaje({ de: usuario.id, para: selId, contenido: texto.trim() })
        await cargar()
      }
      setTexto('')
      inputRef.current?.focus()
    } catch (e) { console.error('Error enviando mensaje:', e) }
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
      if (dia !== diaActual) { grupos.push({ tipo: 'sep', fecha }); diaActual = dia }
      grupos.push({ tipo: 'msg', ...m })
    })
    return grupos
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [selId, mensajesIndiv, mensajesGrupo])

  useEffect(() => { if (buscando) setTimeout(() => busquedaRef.current?.focus(), 50) }, [buscando])

  // ── Datos derivados ────────────────────────────────────────────────────
  const contactoSel = tipoSel === 'contacto'
    ? (contactos.find(c => c.id === selId) || usuariosMap[selId])
    : null
  const grupoSel = tipoSel === 'grupo' ? misGrupos.find(g => g.id === selId) : null

  const mensajesActuales = tipoSel === 'grupo'
    ? mensajesGrupo
    : mensajesIndiv.filter(m => !m.grupo_id &&
        ((m.de === usuario.id && m.para === selId) || (m.de === selId && m.para === usuario.id)))
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

  const items = agruparPorDia(mensajesActuales)

  // Para la búsqueda de "Nuevo mensaje"
  const contactablesEnLista = new Set(contactos.map(c => c.id))
  const q = busqueda.toLowerCase()
  const existentesFiltrados = contactos.filter(c => !q || c.nombre.toLowerCase().includes(q))
  const sugeridos = contactables.filter(c => !contactablesEnLista.has(c.id) && (!q || c.nombre.toLowerCase().includes(q)))
  const gruposFiltrados = misGrupos.filter(g => {
    const nombre = `${g.idioma || ''} ${g.nivel_nombre || ''} ${g.horario || ''}`.toLowerCase()
    return !q || nombre.includes(q)
  })

  // Mensajes no leídos de grupos (simplificado: cuentan los que no son del usuario)
  const noLeidosGrupo = (grupoId) => {
    // Aproximado: no tenemos tracking de leído en grupo todavía
    return 0
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2>Mensajes</h2>
      </div>

      <div className="chat-layout">
        {/* ── Panel izquierdo ── */}
        <div className="chat-contactos">

          {/* Cabecera */}
          <div className="chat-contactos-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              💬 Conversaciones
              {contactos.some(c => c.noLeidos > 0) && (
                <span className="chat-unread" style={{ marginLeft: 8 }}>
                  {contactos.reduce((s, c) => s + c.noLeidos, 0)}
                </span>
              )}
            </span>
            {!buscando && (
              <button onClick={() => { setBuscando(true); setBusqueda('') }}
                style={{ background: 'var(--primario, #F18B11)', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                + Nuevo
              </button>
            )}
          </div>

          {/* ── Modo búsqueda / Nuevo mensaje ── */}
          {buscando ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--borde)' }}>
                <input ref={busquedaRef} value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar persona o grupo…"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                    borderRadius: 7, fontSize: 13, border: '1px solid var(--borde)',
                    background: 'var(--bg-3)', color: 'var(--texto)', outline: 'none' }} />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {/* Grupos */}
                {gruposFiltrados.length > 0 && (
                  <>
                    <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 700,
                      color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Grupos
                    </div>
                    {gruposFiltrados.map(g => (
                      <GrupoItem key={g.id} g={g} activo={false} onClick={() => seleccionarGrupo(g)} />
                    ))}
                  </>
                )}
                {/* Conversaciones existentes */}
                {existentesFiltrados.length > 0 && (
                  <>
                    <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 700,
                      color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Conversaciones recientes
                    </div>
                    {existentesFiltrados.map(c => (
                      <ContactoItem key={c.id} c={c} activo={false} onClick={() => seleccionarContacto(c)} />
                    ))}
                  </>
                )}
                {/* Personas del grupo aún sin conversación */}
                {sugeridos.length > 0 && (
                  <>
                    <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 700,
                      color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      De tus grupos
                    </div>
                    {sugeridos.map(c => (
                      <ContactoItem key={c.id} c={c} activo={false} onClick={() => seleccionarContacto(c)} />
                    ))}
                  </>
                )}
                {gruposFiltrados.length === 0 && existentesFiltrados.length === 0 && sugeridos.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
                    No se encontraron resultados.
                  </div>
                )}
              </div>
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--borde)' }}>
                <button onClick={() => { setBuscando(false); setBusqueda('') }}
                  style={{ background: 'none', border: 'none', fontSize: 12,
                    color: 'var(--texto-muted)', cursor: 'pointer', width: '100%', textAlign: 'center' }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            /* ── Lista normal ── */
            <div className="chat-contactos-lista">
              {/* Grupos */}
              {misGrupos.length > 0 && (
                <>
                  <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 700,
                    color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '.05em',
                    borderBottom: '1px solid var(--borde)' }}>
                    👥 Chats de grupo
                  </div>
                  {misGrupos.map(g => (
                    <GrupoItem key={g.id} g={g} activo={tipoSel === 'grupo' && selId === g.id}
                      onClick={() => seleccionarGrupo(g)} />
                  ))}
                  {contactos.length > 0 && (
                    <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 700,
                      color: 'var(--texto-muted)', textTransform: 'uppercase', letterSpacing: '.05em',
                      borderBottom: '1px solid var(--borde)', marginTop: 4 }}>
                      💬 Directos
                    </div>
                  )}
                </>
              )}
              {/* Conversaciones individuales */}
              {contactos.length === 0 && misGrupos.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
                  No hay conversaciones.<br />
                  <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                    Usa "+ Nuevo" para iniciar una.
                  </span>
                </div>
              )}
              {contactos.map(c => (
                <ContactoItem key={c.id} c={c} activo={tipoSel === 'contacto' && selId === c.id}
                  onClick={() => seleccionarContacto(c)} />
              ))}
            </div>
          )}
        </div>

        {/* ── Panel derecho ── */}
        {!selId ? (
          <div className="chat-sin-sel">
            <span style={{ fontSize: 48 }}>💬</span>
            <p>Selecciona una conversación</p>
            <p style={{ fontSize: 12 }}>Puedes enviar mensajes a profesores, compañeros y en chats de grupo</p>
          </div>
        ) : (
          <div className="chat-conversacion">
            {/* Cabecera de conversación */}
            <div className="chat-conv-head">
              {tipoSel === 'grupo' ? (
                <>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#2980b9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    👥
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {grupoSel?.idioma || 'Grupo'} {grupoSel?.nivel_nombre ? `· ${grupoSel.nivel_nombre}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--texto-muted)' }}>
                      {grupoSel?.horario || 'Chat grupal'} · {grupoSel?.codigo || ''}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="avatar" style={{ background: ROL_PERMISOS[contactoSel?.rol]?.color || '#888',
                    width: 34, height: 34, fontSize: 14 }}>
                    {contactoSel?.nombre?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{contactoSel?.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--texto-muted)' }}>
                      {ROL_PERMISOS[contactoSel?.rol]?.label}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mensajes */}
            <div className="chat-mensajes">
              {items.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13, marginTop: 40 }}>
                  {tipoSel === 'grupo'
                    ? 'Sé el primero en escribir en este grupo.'
                    : 'Escribe un mensaje para iniciar la conversación.'}
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
                    {/* En grupos mostrar el nombre del emisor si no es el usuario */}
                    {tipoSel === 'grupo' && !esMio && (
                      <div style={{ fontSize: 11, color: 'var(--texto-muted)', marginBottom: 2,
                        marginLeft: 4, fontWeight: 600 }}>
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

            {/* Input */}
            <div className="chat-input-bar">
              <textarea ref={inputRef} className="chat-input"
                placeholder={tipoSel === 'grupo' ? 'Escribe en el grupo… (Enter para enviar)' : 'Escribe un mensaje… (Enter para enviar)'}
                value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={onKeyDown} rows={1} />
              <button className="btn-primario" onClick={enviar} disabled={!texto.trim()}
                style={{ padding: '8px 16px', borderRadius: 20, alignSelf: 'flex-end' }}>
                ↑
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────

function ContactoItem({ c, activo, onClick }) {
  const rolCfg = ROL_PERMISOS[c.rol]
  return (
    <div className={`chat-contacto-item ${activo ? 'activo' : ''}`} onClick={onClick}>
      <div className="avatar" style={{ background: rolCfg?.color || '#888', width: 38, height: 38, fontSize: 15 }}>
        {c.nombre.charAt(0)}
      </div>
      <div className="chat-contacto-info">
        <div className="chat-contacto-nombre">{c.nombre}</div>
        <div className="chat-contacto-preview">
          {c.ultimoMsg
            ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ultimoMsg}</span>
            : <span style={{ fontStyle: 'italic', color: 'var(--texto-muted)' }}>{ROL_PERMISOS[c.rol]?.label || c.rol}</span>}
        </div>
      </div>
      <div className="chat-contacto-meta">
        {c.ultimaFecha && <span className="chat-contacto-hora">{fmtFechaCorta(c.ultimaFecha)}</span>}
        {c.noLeidos > 0 && <span className="chat-unread">{c.noLeidos}</span>}
      </div>
    </div>
  )
}

function GrupoItem({ g, activo, onClick }) {
  const nombre = [g.idioma, g.nivel_nombre].filter(Boolean).join(' · ')
  return (
    <div className={`chat-contacto-item ${activo ? 'activo' : ''}`} onClick={onClick}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#2980b9',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
        👥
      </div>
      <div className="chat-contacto-info">
        <div className="chat-contacto-nombre">{nombre || 'Grupo'}</div>
        <div className="chat-contacto-preview" style={{ color: 'var(--texto-muted)' }}>
          {g.horario || g.codigo || 'Chat grupal'}
        </div>
      </div>
    </div>
  )
}
