import { useState, useEffect } from 'react'
import { login, getOfertas, solicitarRecuperacion, verificarTokenReset, restablecerPassword, getPeriodos } from '../api.js'
import PreRegistro from './PreRegistro.jsx'

const API_BASE = import.meta.env.VITE_API_URL || ''
const fetchPublico = (path) => fetch(API_BASE + '/api/publico/' + path).then(r => r.json())

const ICONOS_IDIOMA = {
  'Inglés': '🇺🇸', 'Francés': '🇫🇷', 'Alemán': '🇩🇪', 'Italiano': '🇮🇹',
  'Portugués': '🇧🇷', 'Chino': '🇨🇳', 'Coreano': '🇰🇷', 'Japonés': '🇯🇵',
}

const COLOR_MODALIDAD = { 'Presencial': '#f18b11', 'En Línea': '#2980b9', 'Autodidacta': '#27ae60' }

function inputStyle(focused) {
  return {
    padding: '10px 14px', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
    border: focused ? '1.5px solid #f18b11' : '1.5px solid #ddd',
  }
}

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loginErr, setLoginErr] = useState('')
  const [modal, setModal]       = useState(null) // 'login' | 'prereg' | 'ok' | 'forgot' | 'forgot_ok' | 'reset' | 'reset_ok'
  const [folioOk, setFolioOk]   = useState('')
  const [idiomaAbierto, setIdiomaAbierto] = useState(null)

  // Recuperación de contraseña
  const [forgotEmail, setForgotEmail]   = useState('')
  const [forgotErr, setForgotErr]       = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [resetToken, setResetToken]     = useState('')
  const [resetNueva, setResetNueva]     = useState('')
  const [resetNueva2, setResetNueva2]   = useState('')
  const [resetErr, setResetErr]         = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const [focusedInput, setFocusedInput] = useState('')

  const [ofertas, setOfertas] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [idiomas, setIdiomas] = useState([])
  const [filtroPlantel, setFiltroPlantel] = useState('')
  const [filtroIdioma, setFiltroIdioma] = useState('')
  const [periodo, setPeriodo] = useState(null)
  const [cargandoPeriodo, setCargandoPeriodo] = useState(false)
  const [gruposPeriodo, setGruposPeriodo] = useState([])
  const [subForm, setSubForm] = useState({ nombre: '', email: '', whatsapp: '', municipio: '' })
  const [subOk, setSubOk] = useState(false)
  const [subErr, setSubErr] = useState('')
  const [subLoading, setSubLoading] = useState(false)

  useEffect(() => {
    getOfertas().then(setOfertas).catch(() => {})
    fetchPublico('planteles').then(setPlanteles).catch(() => {})
    fetchPublico('idiomas').then(setIdiomas).catch(() => {})
    // Detectar token de recuperación en URL (?reset=TOKEN)
    const params = new URLSearchParams(window.location.search)
    const token = params.get('reset')
    if (token) {
      setResetToken(token)
      verificarTokenReset(token)
        .then(() => setModal('reset'))
        .catch(() => {
          setResetToken('')
          setResetErr('El enlace de recuperación es inválido o ha expirado.')
          setModal('login')
        })
      // Limpiar la URL sin recargar
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const idiomasResumen = [...new Set(ofertas.filter(o => o.proveedor !== 'Altissia').map(o => o.idioma))].sort()

  // Ofertas del idioma seleccionado en la sección pública (para el panel de horarios)
  const ofertasIdioma = idiomaAbierto
    ? ofertas.filter(o => o.idioma === idiomaAbierto)
    : []

  async function entrar(e) {
    e.preventDefault()
    setLoginErr('')
    try {
      const u = await login(email.trim(), password)
      onLogin(u)
    } catch (err) {
      console.error('Login error:', err)
      setLoginErr(err.message || 'Correo o contraseña incorrectos.')
    }
  }

  async function enviarForgot(e) {
    e.preventDefault()
    if (!forgotEmail.trim()) { setForgotErr('Ingresa tu correo.'); return }
    setForgotLoading(true); setForgotErr('')
    try {
      await solicitarRecuperacion(forgotEmail.trim())
      setModal('forgot_ok')
    } catch {
      setForgotErr('Ocurrió un error. Intenta de nuevo.')
    } finally {
      setForgotLoading(false)
    }
  }

  async function enviarReset(e) {
    e.preventDefault()
    if (!resetNueva || resetNueva.length < 6) { setResetErr('La contraseña debe tener al menos 6 caracteres.'); return }
    if (resetNueva !== resetNueva2) { setResetErr('Las contraseñas no coinciden.'); return }
    setResetLoading(true); setResetErr('')
    try {
      await restablecerPassword(resetToken, resetNueva)
      setModal('reset_ok')
    } catch (err) {
      setResetErr(err.message || 'El enlace ha expirado. Solicita uno nuevo.')
    } finally {
      setResetLoading(false)
    }
  }

  useEffect(() => {
    if (!filtroPlantel || !filtroIdioma) { setPeriodo(null); setGruposPeriodo([]); return }
    setCargandoPeriodo(true)
    const idiomaName = idiomas.find(i => i.id === filtroIdioma)?.nombre || ''
    Promise.all([
      getPeriodos({ plantel_id: filtroPlantel, idioma_id: filtroIdioma }),
      idiomaName
        ? fetchPublico(`grupos?plantel_id=${filtroPlantel}&idioma=${encodeURIComponent(idiomaName)}`)
        : Promise.resolve([]),
    ])
      .then(([periodos, grupos]) => { setPeriodo(periodos[0] || null); setGruposPeriodo(grupos) })
      .catch(() => { setPeriodo(null); setGruposPeriodo([]) })
      .finally(() => setCargandoPeriodo(false))
  }, [filtroPlantel, filtroIdioma, idiomas])

  function fmtFecha(iso) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`
  }

  function cerrar() { setModal(null); setLoginErr(''); setPreErr('') }

  async function enviarSuscripcion(e) {
    e.preventDefault()
    setSubErr('')
    if (!subForm.nombre.trim()) { setSubErr('El nombre es requerido.'); return }
    if (!subForm.email.trim())  { setSubErr('El correo es requerido.'); return }
    setSubLoading(true)
    try {
      const plantelNombre = planteles.find(p => p.id === filtroPlantel)?.nombre || ''
      const idiomaName = idiomas.find(i => i.id === filtroIdioma)?.nombre || ''
      const res = await fetch('/api/publico/suscribir-apertura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...subForm, idioma: idiomaName, plantel_nombre: plantelNombre }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al suscribirse') }
      setSubOk(true)
      setModal('suscribir_ok')
    } catch (err) {
      setSubErr(err.message || 'Error al enviar, intenta de nuevo.')
    } finally {
      setSubLoading(false)
    }
  }

  const glass = {
    bg:     'rgba(255,255,255,0.65)',
    border: 'rgba(0,0,0,0.07)',
    blur:   'blur(24px) saturate(160%)',
    shadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
  }
  const txt    = '#1a1a2e'
  const txtMid = '#555e70'
  const txtDim = '#8892a4'

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f0f2f8',
      backgroundImage: `
        radial-gradient(ellipse 70% 55% at 12% 8%,  rgba(241,139,17,0.10) 0%, transparent 65%),
        radial-gradient(ellipse 55% 70% at 88% 92%, rgba(52,152,219,0.08) 0%, transparent 65%),
        radial-gradient(ellipse 45% 45% at 60% 40%, rgba(155,89,182,0.05) 0%, transparent 60%)`,
      backgroundAttachment: 'fixed',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      color: txt,
    }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(240,242,248,0.75)',
        backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur,
        borderBottom: `1px solid ${glass.border}`,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/logo-injuve.jpeg" alt="INJUVE NL" style={{ height: 52, objectFit: 'contain', mixBlendMode: 'multiply' }} />
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {[['quienes', '¿Quiénes somos?'], ['inscripciones', 'Inscripciones'], ['oferta', 'Oferta educativa']].map(([id, label]) => (
            <a key={id} href={`#${id}`} style={{ color: txtMid, textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'color .15s' }}
               onMouseEnter={e => e.target.style.color=txt} onMouseLeave={e => e.target.style.color=txtMid}>{label}</a>
          ))}
          <button onClick={() => setModal('login')} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 12px rgba(241,139,17,.35)' }}>Iniciar sesión</button>
        </div>
      </nav>

      {/* ── PRE-REGISTRO (componente nuevo) ── */}
      {modal === 'prereg' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', zIndex: 200, overflowY: 'auto', padding: '24px 16px' }}>
          <PreRegistro onVolver={cerrar} />
        </div>
      )}

      {/* ── MODALES ── */}
      {(modal === 'login' || modal === 'ok' || modal === 'forgot' || modal === 'forgot_ok' || modal === 'reset' || modal === 'reset_ok' || modal === 'suscribir' || modal === 'suscribir_ok') && (
        <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: modal === 'prereg' ? 'rgba(255,246,228,0.95)' : glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, borderRadius: 20, padding: '36px', width: '100%', maxWidth: modal === 'prereg' ? 560 : 380, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.9)', color: txt }}>

            {/* LOGIN */}
            {modal === 'login' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}><span style={{ color: '#f18b11' }}>Lengua</span><span style={{ color: txt }}> Joven</span></div>
                  <p style={{ color: txtDim, fontSize: 13, marginTop: 4 }}>Panel de Gestión Educativa</p>
                </div>
                <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {loginErr && <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ff6b6b' }}>{loginErr}</div>}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: txtMid }}>
                    Correo electrónico
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@injuve.mx" autoFocus
                      style={inputStyle(focusedInput === 'loginEmail')}
                      onFocus={() => setFocusedInput('loginEmail')} onBlur={() => setFocusedInput('')} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: txtMid }}>
                    Contraseña
                    <div style={{ position: 'relative' }}>
                      <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                        style={{ ...inputStyle(focusedInput === 'loginPwd'), paddingRight: 40 }}
                        onFocus={() => setFocusedInput('loginPwd')} onBlur={() => setFocusedInput('')} />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', lineHeight: 1, padding: 4, display: 'flex', alignItems: 'center' }}
                        tabIndex={-1} aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                        {showPwd ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>
                  <button type="submit" style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4, boxShadow: '0 4px 18px rgba(241,139,17,.4)' }}>Iniciar sesión</button>
                  <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', margin: 0 }}>
                    <button type="button" onClick={() => { setForgotEmail(''); setForgotErr(''); setModal('forgot') }} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline' }}>
                      ¿Olvidaste tu contraseña? Recupérala aquí
                    </button>
                  </p>
                  <p style={{ textAlign: 'center', fontSize: 13, color: '#888', margin: 0 }}>
                    ¿Aún no tienes cuenta?{' '}
                    <button type="button" onClick={() => setModal('prereg')} style={{ background: 'none', border: 'none', color: '#f18b11', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13 }}>Pre-regístrate aquí</button>
                  </p>
                </form>
              </>
            )}

            {/* OLVIDÉ MI CONTRASEÑA */}
            {modal === 'forgot' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🔑</div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>Recuperar contraseña</h3>
                  <p style={{ color: '#888', fontSize: 13, margin: 0 }}>
                    Te enviaremos un enlace a tu correo para crear una nueva contraseña.
                  </p>
                </div>
                <form onSubmit={enviarForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {forgotErr && <div style={{ background: '#fff0f0', border: '1px solid #ffbaba', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>{forgotErr}</div>}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                    Correo electrónico de tu cuenta
                    <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="usuario@injuve.mx" autoFocus
                      style={inputStyle(focusedInput === 'forgotEmail')}
                      onFocus={() => setFocusedInput('forgotEmail')} onBlur={() => setFocusedInput('')} />
                  </label>
                  <button type="submit" disabled={forgotLoading} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {forgotLoading ? 'Enviando…' : 'Enviar enlace de recuperación'}
                  </button>
                  <button type="button" onClick={() => setModal('login')} style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                    ← Volver al inicio de sesión
                  </button>
                </form>
              </>
            )}

            {/* CORREO ENVIADO */}
            {modal === 'forgot_ok' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>📧</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Revisa tu correo</h3>
                <p style={{ color: '#888', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
                  Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.<br />
                  <span style={{ fontSize: 12 }}>Revisa también tu carpeta de spam.</span>
                </p>
                <button onClick={() => setModal('login')} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontWeight: 700, cursor: 'pointer' }}>
                  Volver al inicio de sesión
                </button>
              </div>
            )}

            {/* NUEVA CONTRASEÑA (desde enlace del email) */}
            {modal === 'reset' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>Nueva contraseña</h3>
                  <p style={{ color: '#888', fontSize: 13, margin: 0 }}>Elige una contraseña segura de al menos 6 caracteres.</p>
                </div>
                <form onSubmit={enviarReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {resetErr && <div style={{ background: '#fff0f0', border: '1px solid #ffbaba', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>{resetErr}</div>}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                    Nueva contraseña
                    <input type="password" value={resetNueva} onChange={e => setResetNueva(e.target.value)} placeholder="Mínimo 6 caracteres" autoFocus
                      style={inputStyle(focusedInput === 'r1')} onFocus={() => setFocusedInput('r1')} onBlur={() => setFocusedInput('')} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                    Confirmar contraseña
                    <input type="password" value={resetNueva2} onChange={e => setResetNueva2(e.target.value)} placeholder="Repite tu nueva contraseña"
                      style={inputStyle(focusedInput === 'r2')} onFocus={() => setFocusedInput('r2')} onBlur={() => setFocusedInput('')} />
                  </label>
                  <button type="submit" disabled={resetLoading} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {resetLoading ? 'Guardando…' : 'Guardar nueva contraseña'}
                  </button>
                </form>
              </>
            )}

            {/* CONTRASEÑA RESTABLECIDA */}
            {modal === 'reset_ok' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>¡Contraseña actualizada!</h3>
                <p style={{ color: '#888', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
                  Tu contraseña fue restablecida exitosamente.<br />Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
                <button onClick={() => { setResetNueva(''); setResetNueva2(''); setModal('login') }} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontWeight: 700, cursor: 'pointer' }}>
                  Ir al inicio de sesión
                </button>
              </div>
            )}

            {/* SUSCRIBIRSE A APERTURA DE GRUPOS */}
            {modal === 'suscribir' && (() => {
              const plantelNombre = planteles.find(p => p.id === filtroPlantel)?.nombre || ''
              const idiomaName = idiomas.find(i => i.id === filtroIdioma)?.nombre || ''
              return (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🔔</div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>¡Te avisamos cuando abra un grupo!</h3>
                    <p style={{ color: '#888', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                      Te enviaremos un correo en cuanto se abra un grupo de <strong>{idiomaName}</strong> en <strong>{plantelNombre}</strong>.
                    </p>
                  </div>
                  <form onSubmit={enviarSuscripcion} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {subErr && <div style={{ background: '#fff0f0', border: '1px solid #ffbaba', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>{subErr}</div>}
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      Nombre completo *
                      <input value={subForm.nombre} onChange={e => setSubForm({ ...subForm, nombre: e.target.value })} placeholder="Ana González"
                        style={inputStyle(focusedInput === 'sub_nombre')} onFocus={() => setFocusedInput('sub_nombre')} onBlur={() => setFocusedInput('')} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      Correo electrónico *
                      <input type="email" value={subForm.email} onChange={e => setSubForm({ ...subForm, email: e.target.value })} placeholder="correo@ejemplo.com"
                        style={inputStyle(focusedInput === 'sub_email')} onFocus={() => setFocusedInput('sub_email')} onBlur={() => setFocusedInput('')} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      WhatsApp (opcional)
                      <input value={subForm.whatsapp} onChange={e => setSubForm({ ...subForm, whatsapp: e.target.value })} placeholder="81 1234 5678"
                        style={inputStyle(focusedInput === 'sub_wa')} onFocus={() => setFocusedInput('sub_wa')} onBlur={() => setFocusedInput('')} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      Municipio (opcional)
                      <input value={subForm.municipio} onChange={e => setSubForm({ ...subForm, municipio: e.target.value })} placeholder="Monterrey"
                        style={inputStyle(focusedInput === 'sub_mun')} onFocus={() => setFocusedInput('sub_mun')} onBlur={() => setFocusedInput('')} />
                    </label>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                      <button type="button" onClick={cerrar} style={{ background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                      <button type="submit" disabled={subLoading} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}>
                        {subLoading ? 'Enviando…' : '🔔 Avisarme cuando haya grupos'}
                      </button>
                    </div>
                  </form>
                </>
              )
            })()}

            {modal === 'suscribir_ok' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>¡Listo! Te notificaremos</h3>
                <p style={{ color: '#888', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
                  En cuanto abra un nuevo grupo te enviaremos un correo para que puedas pre-registrarte.
                </p>
                <button onClick={cerrar} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
              </div>
            )}

            {/* CONFIRMACIÓN */}
            {modal === 'ok' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>¡Pre-registro recibido!</h3>
                <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>
                  Tu folio es <strong style={{ color: '#f18b11', fontSize: 16 }}>{folioOk}</strong>.<br />
                  Un coordinador se pondrá en contacto contigo para indicarte cómo realizar el pago.<br />
                  Una vez confirmado, recibirás tu usuario y contraseña por correo.
                </p>
                <button onClick={cerrar} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 32px', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 8 }}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ padding: '96px 32px 72px', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <img src="/logo-lengua-joven.jpeg" alt="Lengua Joven" style={{ height: 200, objectFit: 'contain', display: 'block', margin: '0 auto 24px', mixBlendMode: 'multiply' }} />
        <div style={{ display: 'inline-block', background: 'rgba(241,139,17,0.12)', color: '#c96e00', border: '1px solid rgba(241,139,17,0.25)', borderRadius: 20, padding: '4px 16px', fontSize: 13, fontWeight: 600, marginBottom: 20, backdropFilter: 'blur(8px)' }}>Programa de idiomas INJUVE</div>
        <h1 style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.08, margin: '0 0 22px', color: txt, letterSpacing: '-0.5px' }}>
          Aprende un idioma.<br /><span style={{ color: '#f18b11' }}>Abre tu futuro.</span>
        </h1>
        <p style={{ fontSize: 18, color: txtMid, lineHeight: 1.65, margin: '0 auto 36px', maxWidth: 540 }}>
          Oferta educativa de idiomas a precios accesibles para jóvenes de Nuevo León, en colaboración con las mejores escuelas de idiomas de la región.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setModal('prereg')} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 12, padding: '15px 38px', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: '0 4px 24px rgba(241,139,17,.35)' }}>
            Pre-registrarme ahora →
          </button>
          <button onClick={() => { const el = document.getElementById('oferta'); if (el) el.scrollIntoView({ behavior: 'smooth' }) }} style={{ background: 'rgba(255,255,255,0.65)', color: '#f18b11', border: '1.5px solid rgba(241,139,17,0.35)', borderRadius: 12, padding: '15px 30px', fontWeight: 700, fontSize: 16, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
            Ver oferta educativa
          </button>
        </div>
      </section>

      {/* ── ¿QUIÉNES SOMOS? ── */}
      <section id="quienes" style={{ padding: '88px 32px', borderTop: `1px solid ${glass.border}`, borderBottom: `1px solid ${glass.border}` }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* Encabezado */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-block', background: 'rgba(241,139,17,0.12)', color: '#c96e00', border: '1px solid rgba(241,139,17,0.25)', borderRadius: 20, padding: '4px 16px', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 16, backdropFilter: 'blur(8px)' }}>Sobre el programa</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 12px', color: txt, lineHeight: 1.2 }}>¿Quiénes somos?</h2>
            <p style={{ fontSize: 15, color: txtMid, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
              Conoce la iniciativa que está transformando el acceso a la educación en idiomas para los jóvenes de Nuevo León.
            </p>
          </div>

          {/* Tarjeta principal — Descripción */}
          <div style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, boxShadow: glass.shadow, borderRadius: 20, padding: '36px 40px', marginBottom: 24, display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #f18b11, #f5a940)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, boxShadow: '0 4px 20px rgba(241,139,17,.4)' }}>📖</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f18b11', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Descripción</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 10px', color: txt }}>¿Qué es Lengua Joven?</h3>
              <p style={{ fontSize: 14, color: txtMid, lineHeight: 1.8, margin: 0 }}>
                Es una línea de acción del programa MIR <strong style={{ color: txt }}>"PRO-EDUCACIÓN"</strong>, enfocada en incrementar las oportunidades de obtener un empleo digno y mejor remunerado para las y los jóvenes del estado de Nuevo León, a través de la gestión de becas en el estudio de lenguas extranjeras. En un mundo globalizado, las personas jóvenes merecen acceso a esta parte fundamental de su vida académica.
              </p>
            </div>
          </div>

          {/* Fila inferior — Objetivos + Alcance */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

            {/* Objetivos */}
            <div style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, boxShadow: glass.shadow, borderRadius: 20, padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(241,139,17,0.18)', border: '1px solid rgba(241,139,17,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎯</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f18b11', letterSpacing: '.08em', textTransform: 'uppercase' }}>Del programa</div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: txt }}>Objetivos</h3>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  'Incrementar las oportunidades de formación educativa en idiomas extranjeros para que las y los jóvenes puedan acceder a más y mejores oportunidades laborales.',
                  'Brindar a las juventudes del estado cursos de idiomas extranjeros de calidad a bajo costo.',
                  'Reanudar el programa con mecanismos de inscripción y gestión rápidos y eficaces para las y los jóvenes, así como para el INJUVE e instituciones asociadas.',
                ].map((texto, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f18b11', color: '#fff', fontWeight: 800, fontSize: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</div>
                    <p style={{ margin: 0, fontSize: 13, color: txtMid, lineHeight: 1.7 }}>{texto}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Alcance */}
            <div style={{ background: 'linear-gradient(135deg, rgba(241,139,17,0.85) 0%, rgba(245,169,64,0.85) 100%)', backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: '1px solid rgba(241,139,17,0.5)', borderRadius: 20, padding: '32px', boxShadow: '0 8px 40px rgba(241,139,17,.22)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🌍</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.8)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Impacto</div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#fff' }}>Alcance</h3>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.92)', lineHeight: 1.8, margin: '0 0 28px' }}>
                  Brindar apoyo a las y los jóvenes a través de herramientas que impulsen su desarrollo académico, contribuyendo al incremento del índice de jóvenes con un segundo idioma en Nuevo León.
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,.18)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🏆</span>
                <p style={{ margin: 0, fontSize: 13, color: '#fff', fontWeight: 600, lineHeight: 1.5 }}>
                  Programa MIR <span style={{ fontWeight: 800 }}>"PRO-EDUCACIÓN"</span> · INJUVE Nuevo León
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── PERÍODO DE INSCRIPCIONES ── */}
      <section id="inscripciones" style={{ padding: `72px 32px ${(!filtroPlantel || !filtroIdioma) ? '40px' : '72px'}`, borderTop: `1px solid ${glass.border}` }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: txt }}>Período de inscripciones</h2>
          <p style={{ color: txtMid, fontSize: 14, marginBottom: 24 }}>
            {periodo?.ciclo || 'Selecciona tu plantel e idioma para ver las fechas de tu ciclo'}
          </p>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 12, marginBottom: (!filtroPlantel || !filtroIdioma) ? 0 : 28, flexWrap: 'wrap' }}>
            <select value={filtroPlantel} onChange={e => {
                const nuevoPlantel = e.target.value
                setFiltroPlantel(nuevoPlantel)
                // Si el idioma actual ya no es válido para el nuevo plantel, limpiarlo
                if (filtroIdioma && nuevoPlantel) {
                  const nombreIdioma = idiomas.find(i => i.id === filtroIdioma)?.nombre || ''
                  const sigueValido = ofertas.some(o => o.plantel_id === nuevoPlantel && o.idioma === nombreIdioma)
                  if (!sigueValido) setFiltroIdioma('')
                }
              }}
              style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${glass.border}`, fontSize: 14, flex: 1, minWidth: 180, cursor: 'pointer', background: glass.bg, color: txt }}>
              <option value="">📍 Selecciona tu plantel…</option>
              {planteles
                .filter(p => {
                  if (!filtroIdioma) return true
                  const nombreIdioma = idiomas.find(i => i.id === filtroIdioma)?.nombre || ''
                  return ofertas.some(o => o.plantel_id === p.id && o.idioma === nombreIdioma)
                })
                .map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select value={filtroIdioma} onChange={e => {
                const nuevoIdioma = e.target.value
                setFiltroIdioma(nuevoIdioma)
                // Si el plantel actual ya no ofrece el nuevo idioma, limpiarlo
                if (filtroPlantel && nuevoIdioma) {
                  const nombreIdioma = idiomas.find(i => i.id === nuevoIdioma)?.nombre || ''
                  const sigueValido = ofertas.some(o => o.plantel_id === filtroPlantel && o.idioma === nombreIdioma)
                  if (!sigueValido) setFiltroPlantel('')
                }
              }}
              style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${glass.border}`, fontSize: 14, flex: 1, minWidth: 180, cursor: 'pointer', background: glass.bg, color: txt }}>
              <option value="">🌐 Selecciona tu idioma…</option>
              {[...new Map(
                idiomas
                  .filter(i => !filtroPlantel || ofertas.some(o => o.plantel_id === filtroPlantel && o.idioma === i.nombre))
                  .map(i => [i.nombre, i])
              ).values()].map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </div>

          {/* Tarjetas dinámicas */}
          {cargandoPeriodo && (
            <p style={{ color: 'rgba(226,232,240,0.5)', textAlign: 'center', padding: '32px 0' }}>Cargando fechas…</p>
          )}


          {!cargandoPeriodo && periodo && (() => {
            const tarjetas = [
              periodo.inicio_prereg && {
                titulo: 'Pre-registro en línea',
                fecha: `${fmtFecha(periodo.inicio_prereg)}${periodo.fin_prereg ? ' – ' + fmtFecha(periodo.fin_prereg) : ''}`,
                desc: 'Completa tu pre-registro desde esta página, sin necesidad de cuenta.',
                color: '#2980b9',
              },
              periodo.fecha_examen && {
                titulo: 'Examen de ubicación',
                fecha: fmtFecha(periodo.fecha_examen),
                desc: 'Aplicación del examen de ubicación en tu plantel.',
                color: '#8e44ad',
              },
              periodo.fecha_asignacion && {
                titulo: 'Asignación de grupo',
                fecha: fmtFecha(periodo.fecha_asignacion),
                desc: 'Notificación de tu grupo y horario asignado por correo.',
                color: '#16a085',
              },
              periodo.fecha_inicio_clases && {
                titulo: 'Inicio de clases',
                fecha: fmtFecha(periodo.fecha_inicio_clases),
                desc: periodo.ciclo ? `Primer día del ciclo ${periodo.ciclo}.` : 'Primer día de clases.',
                color: '#f18b11',
              },
            ].filter(Boolean)

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                {tarjetas.map(({ fecha, titulo, desc, color }) => (
                  <div key={titulo} style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, borderTop: `3px solid ${color}`, borderRadius: 14, padding: '20px', boxShadow: glass.shadow }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>{fecha}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: txt }}>{titulo}</div>
                    <p style={{ fontSize: 13, color: txtMid, lineHeight: 1.5, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            )
          })()}


          {/* Grupos disponibles para el plantel+idioma seleccionado */}
          {!cargandoPeriodo && filtroPlantel && filtroIdioma && gruposPeriodo.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 14px', color: txt }}>
                Grupos abiertos
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {gruposPeriodo.map(g => (
                  <div key={g.id} style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, borderLeft: '3px solid #f18b11', borderRadius: 12, padding: '16px 18px', boxShadow: glass.shadow }}>
                    {g.nivel_nombre && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f18b11', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{g.nivel_nombre}</div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 700, color: txt, marginBottom: 6 }}>🕐 {g.horario || 'Horario por confirmar'}</div>
                    <div style={{ fontSize: 13, color: g.cupo_disponible > 0 ? '#4cd964' : '#ff6b6b', fontWeight: 600 }}>
                      {g.cupo_disponible > 0
                        ? `${g.cupo_disponible} lugar${g.cupo_disponible !== 1 ? 'es' : ''} disponible${g.cupo_disponible !== 1 ? 's' : ''}`
                        : 'Sin cupo disponible'}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 18, textAlign: 'center' }}>
                <button onClick={() => setModal('prereg')} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  Pre-registrarme en este idioma →
                </button>
              </div>
            </div>
          )}

          {/* Sin fechas ni grupos: caja única combinada */}
          {!cargandoPeriodo && filtroPlantel && filtroIdioma && gruposPeriodo.length === 0 && (
            <div style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: '1px dashed rgba(52,152,219,0.45)', borderRadius: 14, padding: '28px 24px', textAlign: 'center', marginBottom: 28, boxShadow: glass.shadow }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
              <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 15, color: txt }}>
                ¿Te gustaría que te notifiquemos cuando se abra un grupo?
              </p>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: txtMid }}>
                {!periodo
                  ? <><strong>Aún no hay fechas configuradas</strong> para este plantel e idioma, pero puedes suscribirte y te avisaremos en cuanto haya disponibilidad.</>
                  : 'Aún no hay grupos abiertos para este idioma en este plantel, pero puedes suscribirte y te avisaremos en cuanto haya disponibilidad.'
                }
              </p>
              <button onClick={() => { setSubForm({ nombre: '', email: '', whatsapp: '', municipio: '' }); setSubErr(''); setModal('suscribir') }}
                style={{ background: '#2980b9', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Sí, notifícame cuando haya grupos
              </button>
            </div>
          )}

        </div>
      </section>

      {/* ── INFORMACIÓN PARA INSCRIPCIÓN ── */}
      <section style={{ padding: '72px 32px', borderTop: `1px solid ${glass.border}` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'start' }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, color: txt }}>Información para inscripción</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { req: '📋 Requisitos', items: ['Tener de 12 años en adelante', 'Identificación oficial o acta de nacimiento', 'CURP'] },
                { req: '💰 Costo', items: ['Cuota bimestral accesible por escuela socia', 'Subsidio INJUVE aplicado automáticamente', 'Material didáctico adicional (varía por escuela)'] },
                { req: '📍 Modalidades', items: ['Presencial en planteles y escuelas socias', 'En línea (plataforma de la escuela socia)', 'Autodidacta (Altissia, acceso 24/7)'] },
              ].map(({ req, items }) => (
                <div key={req} style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, borderRadius: 12, padding: '16px 20px', boxShadow: glass.shadow }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#f18b11' }}>{req}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {items.map(i => <li key={i} style={{ fontSize: 13, color: txtMid }}>{i}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, borderRadius: 18, padding: '32px', boxShadow: glass.shadow }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800, color: txt }}>¿Cómo inscribirte?</h3>
            {[
              ['1', 'Elige tu idioma y escuela en el catálogo de oferta educativa.'],
              ['2', 'Llena tu pre-registro desde esta página (sin necesidad de cuenta).'],
              ['3', 'Realiza el pago correspondiente y envía tu comprobante.'],
              ['4', 'Un coordinador confirmará tu pago y te asignará a un grupo.'],
              ['5', 'Recibirás tu usuario y contraseña para acceder al panel. ¡Listo!'],
            ].map(([n, texto]) => (
              <div key={n} style={{ display: 'flex', gap: 16, marginBottom: 18, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f18b11', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(241,139,17,.4)' }}>{n}</div>
                <p style={{ margin: 0, fontSize: 13, color: txtMid, lineHeight: 1.6, paddingTop: 6 }}>{texto}</p>
              </div>
            ))}
            <button onClick={() => setModal('prereg')} style={{ width: '100%', background: '#f18b11', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 4, boxShadow: '0 4px 18px rgba(241,139,17,.4)' }}>
              Iniciar mi pre-registro →
            </button>
          </div>
        </div>
      </section>

      {/* ── OFERTA EDUCATIVA ── */}
      <section id="oferta" style={{ padding: '72px 32px', borderTop: `1px solid ${glass.border}` }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: txt }}>Oferta educativa</h2>
          <p style={{ color: txtMid, fontSize: 14, marginBottom: 24 }}>
            {planteles.length} escuelas socias · {idiomasResumen.length} idiomas disponibles + 21 idiomas autodidacta con Altissia
          </p>
          <p style={{ color: txtDim, fontSize: 13, marginBottom: 20 }}>
            Haz clic en un idioma para ver los horarios disponibles.
          </p>

          {/* Chips de idioma — clic abre panel de horarios */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {idiomasResumen.map(idioma => {
              const activo = idiomaAbierto === idioma
              return (
                <button key={idioma} onClick={() => setIdiomaAbierto(activo ? null : idioma)} style={{
                  background: activo ? '#f18b11' : glass.bg,
                  backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur,
                  color: activo ? '#fff' : txtMid,
                  border: activo ? '1px solid #f18b11' : `1px solid ${glass.border}`,
                  borderRadius: 20, padding: '8px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  transition: 'all .15s',
                  boxShadow: activo ? '0 2px 14px rgba(241,139,17,.4)' : glass.shadow,
                }}>
                  {ICONOS_IDIOMA[idioma] || '🌐'} {idioma}
                </button>
              )
            })}
          </div>

          {/* Panel de horarios del idioma seleccionado */}
          {idiomaAbierto && (
            <div style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, borderRadius: 16, padding: '24px', marginBottom: 32, boxShadow: glass.shadow }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: txt }}>
                  {ICONOS_IDIOMA[idiomaAbierto] || '🌐'} {idiomaAbierto} — Horarios disponibles
                </h3>
                <button onClick={() => setIdiomaAbierto(null)} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${glass.border}`, borderRadius: 8, fontSize: 16, cursor: 'pointer', color: 'rgba(226,232,240,0.6)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...new Set(ofertasIdioma.map(o => o.proveedor))].map(prov => {
                  const ops = ofertasIdioma.filter(o => o.proveedor === prov)
                  return (
                    <div key={prov}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#f18b11', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>{prov}</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ textAlign: 'left' }}>
                              {['Categoría', 'Modalidad', 'Horario', 'Costo', 'Examen ubic.'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', fontWeight: 600, color: txtDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: `1px solid ${glass.border}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {ops.map(o => (
                              <tr key={o.id} style={{ borderBottom: `1px solid ${glass.border}` }}>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ display: 'inline-block', background: 'rgba(241,139,17,0.18)', color: '#faa63a', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{o.categoria}</span>
                                  {o.edades && <div style={{ fontSize: 11, color: 'rgba(226,232,240,0.45)', marginTop: 2 }}>{o.edades}</div>}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ display: 'inline-block', borderRadius: 8, padding: '2px 10px', fontSize: 12, fontWeight: 600, background: (COLOR_MODALIDAD[o.modalidad] || '#888') + '22', color: COLOR_MODALIDAD[o.modalidad] || '#888' }}>
                                    {o.modalidad === 'Presencial' ? '🏫' : '💻'} {o.modalidad}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', color: txtMid }}>🕐 {o.horario}</td>
                                <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap', color: txt }}>
                                  ${typeof o.costo === 'number' ? o.costo.toLocaleString() : o.costo}
                                  <span style={{ fontSize: 11, color: txtDim, fontWeight: 400 }}> / {o.costo_tipo === 'anual' ? 'año' : 'bimestral'}</span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: o.examen_ubicacion === 'Si' ? '#27ae60' : o.examen_ubicacion === 'No' ? '#e74c3c' : txtDim }}>
                                    {o.examen_ubicacion === 'Si' ? '✓ Sí' : o.examen_ubicacion === 'No' ? '✗ No' : o.examen_ubicacion}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 20, textAlign: 'right' }}>
                <button onClick={() => setModal('prereg')} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Pre-registrarme para {idiomaAbierto} →
                </button>
              </div>
            </div>
          )}

          {/* Escuelas socias */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#f0f4ff' }}>Escuelas socias</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {planteles.map(plantel => {
              const ofsPlantel = ofertas.filter(o => o.plantel_id === plantel.id)
              const idiomasPlantel = [...new Set(ofsPlantel.map(o => o.idioma))]
              const esAltissia = plantel.nombre === 'Altissia'
              return (
                <div key={plantel.id} style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, borderLeft: esAltissia ? '3px solid #27ae60' : '3px solid #f18b11', borderRadius: 14, padding: '20px', boxShadow: glass.shadow }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: txt }}>{plantel.nombre}</div>
                  <div style={{ fontSize: 12, color: txtDim, marginBottom: 10 }}>{esAltissia ? '💻 Autodidacta · En línea' : `🏫 ${ofsPlantel[0]?.modalidad || 'Presencial'} · ${plantel.ciudad}`}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {idiomasPlantel.slice(0, 5).map(i => (
                      <button key={i} onClick={() => setIdiomaAbierto(i)} style={{ fontSize: 11, background: 'rgba(241,139,17,0.15)', padding: '2px 8px', borderRadius: 10, color: '#faa63a', fontWeight: 600, border: '1px solid rgba(241,139,17,0.25)', cursor: 'pointer' }}>
                        {ICONOS_IDIOMA[i] || '🌐'} {i}
                      </button>
                    ))}
                    {idiomasPlantel.length > 5 && <span style={{ fontSize: 11, color: txtDim, padding: '2px 6px' }}>+{idiomasPlantel.length - 5} más</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section style={{ padding: '72px 32px', borderTop: `1px solid ${glass.border}` }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 8, color: txt }}>
            Lo que dicen nuestros <span style={{ color: '#f18b11' }}>estudiantes</span>
          </h2>
          <p style={{ textAlign: 'center', color: txtMid, fontSize: 14, marginBottom: 48 }}>
            Historias reales de jóvenes que estudian con Lengua Joven
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {[
              { nombre: 'Ana Sofía R.', edad: '23 años', texto: 'Gracias a Lengua Joven obtuve mi certificación en inglés y conseguí trabajo en una empresa internacional. El precio es imbatible para la calidad de enseñanza.', nivel: 'Inglés · Nivel 4' },
              { nombre: 'Carlos M.', edad: '19 años', texto: 'Aprendí francés desde cero en dos años. Los maestros son excelentes y el ambiente es muy motivador. Ahora tengo una beca para estudiar en Canadá.', nivel: 'Francés · Nivel 3' },
              { nombre: 'Valeria T.', edad: '26 años', texto: 'Estudié italiano por hobby y terminé enamorándome del idioma. Las clases en línea me permitieron avanzar sin descuidar mi trabajo.', nivel: 'Italiano · Nivel 2' },
              { nombre: 'Diego A.', edad: '17 años', texto: 'Mi mamá me inscribió casi obligado jaja, pero resultó ser una de las mejores decisiones. Ya puedo hablar inglés con fluidez y eso abrió muchas puertas.', nivel: 'Inglés · Nivel 5' },
            ].map((t, i) => (
              <div key={i} style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, borderRadius: 16, padding: '28px 24px', boxShadow: glass.shadow, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 28, color: '#f18b11' }}>❝</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: txtMid, flex: 1 }}>{t.texto}</p>
                <div style={{ borderTop: `1px solid ${glass.border}`, paddingTop: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: txt }}>{t.nombre}</div>
                  <div style={{ fontSize: 12, color: txtDim }}>{t.edad} · {t.nivel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NÚMEROS DE EMERGENCIA ── */}
      <section style={{ padding: '56px 32px', borderTop: `1px solid ${glass.border}`, background: 'rgba(240,242,248,0.6)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24, color: txt }}>
            Números de emergencia <span style={{ fontWeight: 400, fontSize: 15, color: txtMid }}>| ¿Necesitas ayuda? Estamos para servirte.</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { label: 'EMERGENCIAS',        numero: '911' },
              { label: 'DENUNCIA ANÓNIMA',   numero: '089' },
              { label: 'ATENCIÓN CIUDADANA', numero: '070' },
              { label: 'AGUA Y DRENAJE',     numero: '073' },
            ].map(({ label, numero }) => (
              <a key={numero} href={`tel:${numero}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: glass.bg, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, border: `1px solid ${glass.border}`, borderRadius: 14, padding: '24px 16px', textAlign: 'center', boxShadow: glass.shadow, transition: 'transform .15s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#c96e00', marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#f18b11', lineHeight: 1 }}>{numero}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'rgba(240,242,248,0.85)', backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur, borderTop: `1px solid ${glass.border}`, color: txtDim, fontSize: 13 }}>
        {/* Main row — 1fr 1fr so each half fills evenly */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, maxWidth: 1200, margin: '0 auto', padding: '40px 48px 32px', alignItems: 'start' }}>

          {/* Left: logos + gobierno */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 28 }}>
              <img src="/logo-injuve.jpeg" alt="INJUVE NL" style={{ height: 140, objectFit: 'contain', mixBlendMode: 'multiply' }} />
              <div style={{ width: 1, height: 100, background: 'rgba(0,0,0,0.12)' }} />
              <img src="/logo-lengua-joven.jpeg" alt="Lengua Joven" style={{ height: 125, objectFit: 'contain', mixBlendMode: 'multiply' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', color: txtMid }}>GOBIERNO DE NUEVO LEÓN</span>
              <div style={{ width: 1, height: 22, background: 'rgba(0,0,0,0.18)' }} />
              <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: txtMid, letterSpacing: '.02em' }}>NL</div>
              <div style={{ width: 1, height: 22, background: 'rgba(0,0,0,0.18)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', color: txtMid }}>UN NUEVO NUEVO LEÓN</span>
            </div>
          </div>

          {/* Right: social media */}
          <div>
            <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: txtMid }}>Mantente informado:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { name: 'Instagram', href: '#', svg: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z' },
                { name: 'Telegram', href: '#', svg: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' },
                { name: 'Facebook', href: '#', svg: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
                { name: 'TikTok', href: '#', svg: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
                { name: 'X', href: '#', svg: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
                { name: 'YouTube', href: '#', svg: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
              ].map(({ name, href, svg }) => (
                <a key={name} href={href} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.04)', color: txtMid, textDecoration: 'none', fontSize: 13, fontWeight: 500, transition: 'background .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(241,139,17,0.1)'; e.currentTarget.style.color = '#f18b11' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = txtMid }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d={svg} />
                  </svg>
                  {name}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: `1px solid ${glass.border}`, padding: '12px 32px', textAlign: 'center', fontSize: 12 }}>
          © 2026. soporte@injuve.mx
          {' · '}
          <a href="/tratamiento-datos.html" target="_blank" rel="noopener noreferrer"
            style={{ color: '#f18b11', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.textDecoration = 'underline'}
            onMouseLeave={e => e.target.style.textDecoration = 'none'}>
            Sobre el tratamiento de los datos personales
          </a>
        </div>
      </footer>
    </div>
  )
}
