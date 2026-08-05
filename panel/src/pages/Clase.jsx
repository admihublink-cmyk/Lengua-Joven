import { useEffect, useRef, useState } from 'react'
import { useAuth, useNav } from '../App.jsx'
import * as api from '../api.js'

const EMOJIS_REAC = [
  { emoji: '👍', label: 'Me gusta' },
  { emoji: '❤️', label: 'Corazón' },
  { emoji: '✋', label: 'Mano levantada' },
  { emoji: '😢', label: 'Triste' },
]

export default function Clase({ params }) {
  const { usuario } = useAuth()
  const { navegar } = useNav()

  const { sesion_id, fecha, titulo } = params || {}
  const fechaClase = fecha || new Date().toISOString().slice(0, 10)
  const roomName = `injuve-${(sesion_id || 'demo')}-${fechaClase}`.replace(/[^a-zA-Z0-9-]/g, '-')

  const CHAT_KEY = `injuve_chat_${sesion_id || 'demo'}_${fechaClase}`
  const REAC_KEY = `injuve_reac_${sesion_id || 'demo'}_${fechaClase}`

  const containerRef   = useRef(null)
  const apiRef         = useRef(null)
  const joinedAtRef    = useRef(null)
  const savedRef       = useRef(false)
  const chatBottomRef  = useRef(null)
  const chatAbiertoRef = useRef(true)

  const [estado, setEstado]             = useState('cargando')
  const [duracion, setDuracion]         = useState(0)
  const [error, setError]               = useState('')
  const [chatAbierto, setChatAbierto]   = useState(true)
  const [mensajesChat, setMensajesChat] = useState([])
  const [chatInput, setChatInput]       = useState('')
  const [noLeidosChat, setNoLeidosChat] = useState(0)
  const [reacciones, setReacciones]     = useState([])

  // ── localStorage helpers ──
  function leerChat() {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]') } catch { return [] }
  }
  function leerReacs() {
    try { return JSON.parse(localStorage.getItem(REAC_KEY) || '[]') } catch { return [] }
  }

  // ── Chat ──
  function enviarChat(e) {
    e?.preventDefault()
    const texto = chatInput.trim()
    if (!texto) return
    const msgs = leerChat()
    const nuevo = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      usuario_id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      texto,
      hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    }
    msgs.push(nuevo)
    localStorage.setItem(CHAT_KEY, JSON.stringify(msgs))
    setMensajesChat(msgs)
    setChatInput('')
  }

  // ── Reacciones ──
  function agregarReaccionLocal(r, delay) {
    setReacciones(prev => [...prev, r])
    setTimeout(() => setReacciones(prev => prev.filter(x => x.id !== r.id)), delay ?? 3500)
  }

  function enviarReaccion(emoji) {
    const now = Date.now()
    const reacs = leerReacs().filter(r => now - r.ts < 4000)
    const nueva = {
      id: `${now}_${Math.random().toString(36).slice(2)}`,
      emoji,
      nombre: usuario.nombre,
      x: 8 + Math.random() * 78,
      ts: now,
    }
    reacs.push(nueva)
    localStorage.setItem(REAC_KEY, JSON.stringify(reacs))
    agregarReaccionLocal(nueva, 3500)
  }

  // ── Sync cross-tab via storage event ──
  useEffect(() => {
    function onStorage(e) {
      if (e.key === CHAT_KEY) {
        const msgs = JSON.parse(e.newValue || '[]')
        setMensajesChat(msgs)
        if (!chatAbiertoRef.current) setNoLeidosChat(n => n + 1)
      }
      if (e.key === REAC_KEY) {
        const now = Date.now()
        const fresh = JSON.parse(e.newValue || '[]').filter(r => now - r.ts < 3500)
        setReacciones(prev => {
          const ids = new Set(prev.map(r => r.id))
          const nuevas = fresh.filter(r => !ids.has(r.id))
          nuevas.forEach(r => {
            const remaining = 3500 - (Date.now() - r.ts)
            if (remaining > 0) setTimeout(() => setReacciones(p => p.filter(x => x.id !== r.id)), remaining)
          })
          return [...prev, ...nuevas]
        })
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [CHAT_KEY, REAC_KEY])

  // ── Auto-scroll y carga inicial ──
  useEffect(() => {
    if (sesion_id) setMensajesChat(leerChat())
  }, [sesion_id])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajesChat])

  function toggleChat() {
    const next = !chatAbierto
    setChatAbierto(next)
    chatAbiertoRef.current = next
    if (next) setNoLeidosChat(0)
  }

  // ── Jitsi ──
  useEffect(() => {
    if (!sesion_id) return
    const script = document.createElement('script')
    script.src = 'https://meet.jit.si/external_api.js'
    script.async = true
    script.onerror = () => setError('No se pudo cargar Jitsi. Verifica tu conexión a internet.')
    script.onload = () => initJitsi()
    document.head.appendChild(script)
    return () => {
      try { document.head.removeChild(script) } catch {}
      if (apiRef.current) { try { apiRef.current.dispose() } catch {}; apiRef.current = null }
    }
  }, [sesion_id])

  function registrarSalida(leftAt) {
    if (savedRef.current) return
    savedRef.current = true
    const min = joinedAtRef.current ? Math.round((leftAt - joinedAtRef.current) / 60000) : 0
    setDuracion(min)
    if (sesion_id && usuario.rol === 'alumno') {
      api.registrarAsistenciaSesion(sesion_id, {
        fecha: fechaClase, alumno_id: usuario.id,
        joined_at: joinedAtRef.current, left_at: leftAt, duracion_min: min,
      })
    }
    setEstado('fin')
  }

  function initJitsi() {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) {
      setError('Error al inicializar Jitsi.')
      return
    }
    try {
      const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        width: '100%',
        height: '100%',
        parentNode: containerRef.current,
        userInfo: { displayName: usuario.nombre },
        configOverwrite: {
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          toolbarButtons: ['microphone', 'camera', 'desktop', 'fullscreen', 'hangup', 'participants-pane'],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          TOOLBAR_ALWAYS_VISIBLE: true,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          DEFAULT_REMOTE_DISPLAY_NAME: 'Participante',
        },
      })
      apiRef.current = api
      api.addEventListeners({
        videoConferenceJoined: () => { joinedAtRef.current = Date.now(); setEstado('en_clase') },
        videoConferenceLeft:   () => registrarSalida(Date.now()),
        readyToClose:          () => registrarSalida(Date.now()),
      })
    } catch (e) {
      setError('Error iniciando la sala: ' + e.message)
    }
  }

  // ── Sin params: acceso directo ──
  if (!sesion_id) {
    return (
      <div className="clase-wrapper">
        <div className="clase-topbar">
          <div className="clase-titulo">Sala de clase</div>
          <button className="btn-sec mini" onClick={() => navegar('calendario')}>← Volver</button>
        </div>
        <div className="clase-fin" style={{ background: 'var(--bg)' }}>
          <div className="clase-fin-card">
            <div className="clase-fin-icon">📅</div>
            <h2>Accede desde el calendario</h2>
            <p>Para unirte a una clase, abre el calendario, selecciona el día de hoy y haz clic en <strong>Unirse a la clase</strong>.</p>
            <button className="btn-primario" onClick={() => navegar('calendario')}>Ir al calendario</button>
          </div>
        </div>
      </div>
    )
  }

  const puedeReaccionar = usuario.rol === 'alumno'
  const puedeChat = usuario.rol === 'alumno' || usuario.rol === 'profesor'

  return (
    <div className="clase-wrapper">
      {/* Topbar */}
      <div className="clase-topbar">
        <div className="clase-titulo">
          {estado === 'en_clase' && <div className="clase-dot" />}
          {titulo || 'Clase virtual'}
          <span style={{ color: '#888', fontWeight: 400 }}>· {fechaClase}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {puedeChat && estado === 'en_clase' && (
            <button className="clase-chat-toggle" onClick={toggleChat}>
              💬 Chat
              {noLeidosChat > 0 && (
                <span className="clase-badge-chat">{noLeidosChat > 9 ? '9+' : noLeidosChat}</span>
              )}
            </button>
          )}
          {estado !== 'fin' && (
            <button className="btn-sec mini" onClick={() => {
              if (apiRef.current) { try { apiRef.current.executeCommand('hangup') } catch {} }
              else navegar('calendario')
            }}>
              ← Salir
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="clase-body">
        {/* Área de video */}
        <div className="clase-video-area">
          {estado === 'cargando' && !error && (
            <div className="clase-cargando">
              <div className="clase-spinner" />
              <p>Conectando a la sala de clase…</p>
              <p style={{ fontSize: 12, marginTop: 4, opacity: .6 }}>Espera mientras carga Jitsi Meet</p>
            </div>
          )}

          {error && (
            <div className="clase-cargando">
              <span style={{ fontSize: 40 }}>⚠️</span>
              <p style={{ color: 'var(--rojo)', maxWidth: 340, textAlign: 'center' }}>{error}</p>
              <button className="btn-primario" style={{ marginTop: 16 }} onClick={() => navegar('calendario')}>
                ← Volver al calendario
              </button>
            </div>
          )}

          {estado === 'fin' && (
            <div className="clase-fin">
              <div className="clase-fin-card">
                <div className="clase-fin-icon">✅</div>
                <h2>Clase finalizada</h2>
                <p>{titulo || 'La sesión ha concluido.'}</p>
                {duracion > 0 && (
                  <>
                    <div className="texto-muted" style={{ fontSize: 13, marginBottom: 4 }}>Tiempo en clase</div>
                    <div className="clase-duracion">{duracion} min</div>
                  </>
                )}
                {duracion === 0 && <p className="texto-muted" style={{ fontSize: 13 }}>Sesión muy breve (menos de 1 minuto).</p>}
                <button className="btn-primario" style={{ marginTop: 24 }} onClick={() => navegar('calendario')}>
                  ← Volver al calendario
                </button>
              </div>
            </div>
          )}

          {/* Jitsi siempre montado mientras no sea fin/error */}
          <div
            ref={containerRef}
            id="jitsi-root"
            style={{ width: '100%', height: '100%', display: (estado === 'fin' || error) ? 'none' : 'block' }}
          />

          {/* Reacciones flotantes */}
          <div className="reacciones-flotantes">
            {reacciones.map(r => (
              <span key={r.id} className="reaccion-flotante" style={{ left: `${r.x}%` }} title={r.nombre}>
                {r.emoji}
              </span>
            ))}
          </div>

          {/* Botones de reacción — solo alumnos, solo en clase activa */}
          {puedeReaccionar && estado === 'en_clase' && (
            <div className="reacciones-bar">
              {EMOJIS_REAC.map(({ emoji, label }) => (
                <button key={emoji} className="reaccion-btn" title={label} onClick={() => enviarReaccion(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Panel de chat lateral */}
        {puedeChat && chatAbierto && estado === 'en_clase' && (
          <div className="clase-chat-panel">
            <div className="clase-chat-head">
              <span>💬 Chat de clase</span>
              <button
                onClick={toggleChat}
                title="Cerrar chat"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-muted)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
              >
                ×
              </button>
            </div>

            <div className="clase-chat-mensajes">
              {mensajesChat.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--texto-muted)', fontSize: 13, marginTop: 32 }}>
                  Sin mensajes aún.<br />¡Sé el primero! 👋
                </div>
              )}
              {mensajesChat.map(m => {
                const esMio = m.usuario_id === usuario.id
                return (
                  <div key={m.id} className={`clase-chat-burbuja ${esMio ? 'mia' : 'otra'}`}>
                    {!esMio && (
                      <div className="clase-chat-nombre">
                        {m.nombre}{m.rol === 'profesor' ? ' · Maestro/a' : ''}
                      </div>
                    )}
                    {m.texto}
                    <div className="clase-chat-hora">{m.hora}</div>
                  </div>
                )
              })}
              <div ref={chatBottomRef} />
            </div>

            <form className="clase-chat-input" onSubmit={enviarChat}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Escribe un mensaje…"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChat() } }}
              />
              <button type="submit" className="btn-primario mini">➤</button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
