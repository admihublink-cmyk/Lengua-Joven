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
  const [todos, setTodos] = useState([]) // todos los mensajes del usuario
  const [contactos, setContactos] = useState([])
  const [usuariosMap, setUsuariosMap] = useState({})
  const [selId, setSelId] = useState(params?.contactId || null)
  const [texto, setTexto] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  async function cargar() {
    try {
      const [msgs, u] = await Promise.all([api.getMensajes(), api.getUsuarios()])
      const map = {}
      u.forEach(x => { map[x.id] = x })
      // Si llegamos desde el botón COORDINADOR, cargar ese usuario aunque no esté en la lista
      if (params?.contactId && !map[params.contactId]) {
        try {
          const coordi = await api.getUsuario(params.contactId)
          if (coordi) map[coordi.id] = coordi
        } catch {}
      }
      setUsuariosMap(map)
      setTodos(msgs)

      // Construir lista de contactos: todos los usuarios que compartieron mensaje con el usuario actual
      const ids = new Set()
      msgs.forEach(m => {
        if (m.de === usuario.id) ids.add(m.para)
        if (m.para === usuario.id) ids.add(m.de)
      })
      // También añadir compañeros de grupo
      const grupos = await api.getGrupos()
      const inscripciones = await api.getInscripciones()
      const misGrupos = new Set(inscripciones.filter(i => i.alumno_id === usuario.id || i.grupo_id).map(i => i.grupo_id))
      inscripciones.forEach(i => {
        if (misGrupos.has(i.grupo_id) && i.alumno_id && i.alumno_id !== usuario.id) ids.add(i.alumno_id)
      })

      // Incluir el contacto de params aunque no haya mensajes previos
      if (params?.contactId) ids.add(params.contactId)
      const contactosList = [...ids].map(id => map[id]).filter(Boolean)
      const enriched = contactosList.map(c => {
        const conv = msgs.filter(m => (m.de === usuario.id && m.para === c.id) || (m.de === c.id && m.para === usuario.id))
          .sort((a, b) => (a.fecha || a.creado_en || '').localeCompare(b.fecha || b.creado_en || ''))
        const noLeidos = conv.filter(m => m.para === usuario.id && !m.leido).length
        const ultimo = conv[conv.length - 1]
        return { ...c, noLeidos, ultimoMsg: ultimo?.contenido || '', ultimaFecha: ultimo?.fecha || ultimo?.creado_en || '' }
      }).sort((a, b) => (b.ultimaFecha || '').localeCompare(a.ultimaFecha || ''))
      setContactos(enriched)
    } catch (e) {
      console.error('Error cargando mensajes:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  function mensajesConContacto(contactoId) {
    return todos.filter(m => (m.de === usuario.id && m.para === contactoId) || (m.de === contactoId && m.para === usuario.id))
      .sort((a, b) => (a.fecha || a.creado_en || '').localeCompare(b.fecha || b.creado_en || ''))
  }

  async function seleccionar(contacto) {
    setSelId(contacto.id)
    // Marcar mensajes de este contacto como leídos
    try {
      await api.marcarMensajesLeidos(contacto.id)
      await cargar()
    } catch (e) { /* ignorar */ }
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  function agruparPorDia(msgs) {
    const grupos = []
    let diaActual = ''
    msgs.forEach(m => {
      const fecha = m.fecha || m.creado_en || ''
      const dia = fecha.slice(0, 10)
      if (dia !== diaActual) {
        grupos.push({ tipo: 'sep', fecha, dia })
        diaActual = dia
      }
      grupos.push({ tipo: 'msg', ...m })
    })
    return grupos
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [selId, todos])

  const contactoSel = contactos.find(c => c.id === selId)
  const mensajes = mensajesConContacto(selId)
  const items = agruparPorDia(mensajes)

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2>Mensajes</h2>
      </div>

      <div className="chat-layout">
        <div className="chat-contactos">
          <div className="chat-contactos-head">
            💬 Conversaciones
            {contactos.some(c => c.noLeidos > 0) && (
              <span className="chat-unread" style={{ marginLeft: 8 }}>
                {contactos.reduce((s, c) => s + c.noLeidos, 0)}
              </span>
            )}
          </div>
          <div className="chat-contactos-lista">
            {contactos.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13 }}>
                No hay contactos disponibles.<br />
                <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  Los contactos aparecen según los grupos en los que participas.
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
                {contactoSel?.nombre.charAt(0)}
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
    </div>
  )
}
