import { useState, useEffect } from 'react'
import { login, getOfertas, crearPreRegistro, solicitarRecuperacion, verificarTokenReset, restablecerPassword, getPeriodos } from '../api.js'

const fetchPublico = (path) => fetch('/api/publico/' + path).then(r => r.json())

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

  // Pre-registro form state
  const [pre, setPre] = useState({
    nombre: '', email: '', tel: '', curp: '', fecha_nacimiento: '',
    estado_entidad: '', idioma_interes: '', proveedor_interes: '',
    horario_preferido: '', como_entero: '',
    tutor_nombre: '', tutor_tel: '', tutor_email: '',
  })
  const [preErr, setPreErr] = useState('')
  const [focusedInput, setFocusedInput] = useState('')

  const [ofertas, setOfertas] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [idiomas, setIdiomas] = useState([])
  const [filtroPlantel, setFiltroPlantel] = useState('')
  const [filtroIdioma, setFiltroIdioma] = useState('')
  const [periodo, setPeriodo] = useState(null)
  const [cargandoPeriodo, setCargandoPeriodo] = useState(false)
  const [gruposDisponibles, setGruposDisponibles] = useState([])
  const [grupoInteres, setGrupoInteres] = useState('')

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

  // Planteles que ofrecen el idioma seleccionado en el form de pre-registro
  const plantelesPorIdioma = pre.idioma_interes
    ? planteles.filter(p => ofertas.some(o => o.plantel_id === p.id && o.idioma === pre.idioma_interes))
    : planteles

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

  function calcularEdad(fechaNac) {
    if (!fechaNac) return null
    const hoy = new Date()
    const nac = new Date(fechaNac)
    let edad = hoy.getFullYear() - nac.getFullYear()
    const m = hoy.getMonth() - nac.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
    return edad
  }

  const edadActual = calcularEdad(pre.fecha_nacimiento)
  const esMenorDeEdad = edadActual !== null && edadActual < 18

  async function enviarPreRegistro(e) {
    e.preventDefault()
    setPreErr('')
    if (!pre.nombre.trim()) { setPreErr('El nombre es requerido.'); return }
    if (!pre.email.trim())  { setPreErr('El correo es requerido.'); return }
    if (!pre.tel.trim())    { setPreErr('El teléfono es requerido.'); return }
    if (edadActual !== null && edadActual < 12) { setPreErr('El programa es para personas de 12 años en adelante.'); return }
    if (esMenorDeEdad) {
      if (!pre.tutor_nombre.trim()) { setPreErr('El nombre del tutor es requerido para menores de edad.'); return }
      if (!pre.tutor_tel.trim())   { setPreErr('El teléfono del tutor es requerido para menores de edad.'); return }
      if (!pre.tutor_email.trim()) { setPreErr('El correo del tutor es requerido para menores de edad.'); return }
    }
    try {
      const result = await crearPreRegistro({ ...pre, grupo_interes_id: grupoInteres || null })
      setFolioOk(result.folio)
      setModal('ok')
      setGrupoInteres('')
      setGruposDisponibles([])
      setPre({ nombre: '', email: '', tel: '', curp: '', fecha_nacimiento: '', estado_entidad: '', idioma_interes: '', proveedor_interes: '', horario_preferido: '', como_entero: '', tutor_nombre: '', tutor_tel: '', tutor_email: '' })
    } catch (err) {
      setPreErr(err.message || 'Error al enviar, intenta de nuevo.')
    }
  }

  // Cuando el alumno elige idioma + escuela en el pre-registro, carga grupos disponibles
  useEffect(() => {
    const plantel = planteles.find(p => p.nombre === pre.proveedor_interes)
    if (!plantel || !pre.idioma_interes) { setGruposDisponibles([]); setGrupoInteres(''); return }
    fetchPublico(`grupos?plantel_id=${plantel.id}&idioma=${encodeURIComponent(pre.idioma_interes)}`)
      .then(g => { setGruposDisponibles(g); setGrupoInteres('') })
      .catch(() => { setGruposDisponibles([]); setGrupoInteres('') })
  }, [pre.idioma_interes, pre.proveedor_interes, planteles])

  useEffect(() => {
    if (!filtroPlantel || !filtroIdioma) { setPeriodo(null); return }
    setCargandoPeriodo(true)
    getPeriodos({ plantel_id: filtroPlantel, idioma_id: filtroIdioma })
      .then(data => setPeriodo(data[0] || null))
      .catch(() => setPeriodo(null))
      .finally(() => setCargandoPeriodo(false))
  }, [filtroPlantel, filtroIdioma])

  function fmtFecha(iso) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`
  }

  function cerrar() { setModal(null); setLoginErr(''); setPreErr('') }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff8f2 0%, #fff 60%, #fff8f2 100%)', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' }}>

      {/* ── NAVBAR ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '1px solid #eee', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          <span style={{ color: '#f18b11' }}>Lengua</span>
          <span style={{ fontWeight: 300 }}> Joven</span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {[['quienes', '¿Quiénes somos?'], ['inscripciones', 'Inscripciones'], ['oferta', 'Oferta educativa']].map(([id, label]) => (
            <a key={id} href={`#${id}`} style={{ color: '#555', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{label}</a>
          ))}
          <button onClick={() => setModal('prereg')} style={{ background: '#fff', color: '#f18b11', border: '2px solid #f18b11', borderRadius: 8, padding: '7px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Pre-registrarme</button>
          <button onClick={() => setModal('login')} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Iniciar sesión</button>
        </div>
      </nav>

      {/* ── MODALES ── */}
      {(modal === 'login' || modal === 'prereg' || modal === 'ok' || modal === 'forgot' || modal === 'forgot_ok' || modal === 'reset' || modal === 'reset_ok') && (
        <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: '36px', width: '100%', maxWidth: modal === 'prereg' ? 560 : 380, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>

            {/* LOGIN */}
            {modal === 'login' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}><span style={{ color: '#f18b11' }}>Lengua</span> Joven</div>
                  <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Panel de Gestión Educativa</p>
                </div>
                <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {loginErr && <div style={{ background: '#fff0f0', border: '1px solid #ffbaba', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>{loginErr}</div>}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                    Correo electrónico
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@injuve.mx" autoFocus
                      style={inputStyle(focusedInput === 'loginEmail')}
                      onFocus={() => setFocusedInput('loginEmail')} onBlur={() => setFocusedInput('')} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                    Contraseña
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                      style={inputStyle(focusedInput === 'loginPwd')}
                      onFocus={() => setFocusedInput('loginPwd')} onBlur={() => setFocusedInput('')} />
                  </label>
                  <button type="submit" style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 }}>Iniciar sesión</button>
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

            {/* PRE-REGISTRO */}
            {modal === 'prereg' && (
              <>
                <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Pre-registro</h3>
                <p style={{ color: '#888', fontSize: 13, margin: '0 0 12px' }}>
                  Completa tus datos. Una vez que realices tu pago, recibirás tus credenciales de acceso.
                </p>
                <div style={{ background: '#f5f9ff', border: '1px solid #d0e4ff', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#2c5f8a', marginBottom: 12 }}>
                  <strong>Requisitos:</strong> Tener 12 años en adelante · Identificación oficial o acta de nacimiento · CURP
                </div>
                <form onSubmit={enviarPreRegistro} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {preErr && <div style={{ background: '#fff0f0', border: '1px solid #ffbaba', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>{preErr}</div>}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', gridColumn: '1/-1' }}>
                      Nombre completo *
                      <input value={pre.nombre} onChange={e => setPre({ ...pre, nombre: e.target.value })} placeholder="Ej. Ana González Martínez"
                        style={inputStyle(focusedInput === 'nombre')} onFocus={() => setFocusedInput('nombre')} onBlur={() => setFocusedInput('')} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      Correo electrónico *
                      <input type="email" value={pre.email} onChange={e => setPre({ ...pre, email: e.target.value })} placeholder="correo@ejemplo.com"
                        style={inputStyle(focusedInput === 'email')} onFocus={() => setFocusedInput('email')} onBlur={() => setFocusedInput('')} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      Teléfono / WhatsApp *
                      <input value={pre.tel} onChange={e => setPre({ ...pre, tel: e.target.value })} placeholder="81 1234 5678"
                        style={inputStyle(focusedInput === 'tel')} onFocus={() => setFocusedInput('tel')} onBlur={() => setFocusedInput('')} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      CURP (opcional)
                      <input value={pre.curp} onChange={e => setPre({ ...pre, curp: e.target.value.toUpperCase() })} placeholder="XXXX000000XXXXXX00"
                        style={inputStyle(focusedInput === 'curp')} onFocus={() => setFocusedInput('curp')} onBlur={() => setFocusedInput('')} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      Fecha de nacimiento
                      <input type="date" value={pre.fecha_nacimiento} onChange={e => setPre({ ...pre, fecha_nacimiento: e.target.value })}
                        style={inputStyle(focusedInput === 'fnac')} onFocus={() => setFocusedInput('fnac')} onBlur={() => setFocusedInput('')} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      Municipio de residencia
                      <input value={pre.estado_entidad} onChange={e => setPre({ ...pre, estado_entidad: e.target.value })} placeholder="Ej. Monterrey"
                        style={inputStyle(focusedInput === 'mun')} onFocus={() => setFocusedInput('mun')} onBlur={() => setFocusedInput('')} />
                    </label>
                  </div>

                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      Idioma de interés
                      <select value={pre.idioma_interes} onChange={e => setPre({ ...pre, idioma_interes: e.target.value, proveedor_interes: '' })}
                        style={{ ...inputStyle(false), appearance: 'auto' }}>
                        <option value="">Seleccionar…</option>
                        {[...new Set(ofertas.map(o => o.idioma))].sort().map(i => (
                          <option key={i} value={i}>{ICONOS_IDIOMA[i] || '🌐'} {i}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                      Escuela de preferencia
                      <select value={pre.proveedor_interes} onChange={e => setPre({ ...pre, proveedor_interes: e.target.value })}
                        style={{ ...inputStyle(false), appearance: 'auto' }}>
                        <option value="">Sin preferencia</option>
                        {plantelesPorIdioma.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                      </select>
                    </label>
                    {/* Selector de grupo/horario: si hay grupos disponibles, muestra opciones; si no, texto libre */}
                    {gruposDisponibles.length > 0 ? (
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', gridColumn: '1/-1' }}>
                        Horario preferido
                        <select value={grupoInteres} onChange={e => setGrupoInteres(e.target.value)}
                          style={{ ...inputStyle(false), appearance: 'auto' }}>
                          <option value="">Sin preferencia de horario</option>
                          {gruposDisponibles.map(g => (
                            <option key={g.id} value={g.id} disabled={g.cupo_disponible === 0}>
                              {g.nivel_nombre ? `${g.nivel_nombre} — ` : ''}{g.horario}
                              {g.cupo_disponible === 0 ? ' (sin cupo)' : ` (${g.cupo_disponible} lugar${g.cupo_disponible !== 1 ? 'es' : ''} disponible${g.cupo_disponible !== 1 ? 's' : ''})`}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', gridColumn: '1/-1' }}>
                        Horario preferido (opcional)
                        <input value={pre.horario_preferido} onChange={e => setPre({ ...pre, horario_preferido: e.target.value })} placeholder="Ej. Sábados por la mañana"
                          style={inputStyle(focusedInput === 'horario')} onFocus={() => setFocusedInput('horario')} onBlur={() => setFocusedInput('')} />
                      </label>
                    )}
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', gridColumn: '1/-1' }}>
                      ¿Cómo te enteraste? (opcional)
                      <select value={pre.como_entero} onChange={e => setPre({ ...pre, como_entero: e.target.value })}
                        style={{ ...inputStyle(false), appearance: 'auto' }}>
                        <option value="">Seleccionar…</option>
                        {['Redes sociales', 'Amigo / familiar', 'Escuela', 'INJUVE', 'Internet / búsqueda', 'Otro'].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  </div>

                  {/* SECCIÓN TUTOR — solo si el alumno es menor de edad */}
                  {esMenorDeEdad && (
                    <div style={{ borderTop: '2px solid #f18b11', paddingTop: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#f18b11', marginBottom: 4 }}>
                        Datos del tutor / padre / madre
                      </div>
                      <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px' }}>
                        Como eres menor de edad, es necesario registrar los datos de un tutor responsable. Se le enviará información sobre tu inscripción.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', gridColumn: '1/-1' }}>
                          Nombre del tutor *
                          <input value={pre.tutor_nombre} onChange={e => setPre({ ...pre, tutor_nombre: e.target.value })} placeholder="Nombre completo del padre, madre o tutor"
                            style={inputStyle(focusedInput === 'tutor_nombre')} onFocus={() => setFocusedInput('tutor_nombre')} onBlur={() => setFocusedInput('')} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                          Teléfono / WhatsApp del tutor *
                          <input value={pre.tutor_tel} onChange={e => setPre({ ...pre, tutor_tel: e.target.value })} placeholder="81 1234 5678"
                            style={inputStyle(focusedInput === 'tutor_tel')} onFocus={() => setFocusedInput('tutor_tel')} onBlur={() => setFocusedInput('')} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
                          Correo electrónico del tutor *
                          <input type="email" value={pre.tutor_email} onChange={e => setPre({ ...pre, tutor_email: e.target.value })} placeholder="tutor@ejemplo.com"
                            style={inputStyle(focusedInput === 'tutor_email')} onFocus={() => setFocusedInput('tutor_email')} onBlur={() => setFocusedInput('')} />
                        </label>
                      </div>
                    </div>
                  )}

                  <div style={{ background: '#fff8f0', border: '1px solid #f0e0cc', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#888' }}>
                    ℹ️ Después de enviar tu pre-registro, un coordinador te contactará con los pasos para realizar tu pago. Una vez confirmado, recibirás tu usuario y contraseña.
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={cerrar} style={{ background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                    <button type="submit" style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}>Enviar pre-registro</button>
                  </div>
                </form>
              </>
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
      <section style={{ padding: '80px 32px 60px', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: '#fff4e0', color: '#f18b11', borderRadius: 20, padding: '4px 16px', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>Programa de idiomas INJUVE</div>
        <h1 style={{ fontSize: 48, fontWeight: 900, lineHeight: 1.1, margin: '0 0 20px', color: '#111' }}>
          Aprende un idioma.<br /><span style={{ color: '#f18b11' }}>Abre tu futuro.</span>
        </h1>
        <p style={{ fontSize: 18, color: '#555', lineHeight: 1.6, margin: '0 auto 32px', maxWidth: 540 }}>
          Oferta educativa de idiomas a precios accesibles para jóvenes de Nuevo León, en colaboración con las mejores escuelas de idiomas de la región.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setModal('prereg')} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 36px', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: '0 4px 20px rgba(241,139,17,.35)' }}>
            Pre-registrarme ahora →
          </button>
          <button onClick={() => { const el = document.getElementById('oferta'); if (el) el.scrollIntoView({ behavior: 'smooth' }) }} style={{ background: '#fff', color: '#f18b11', border: '2px solid #f18b11', borderRadius: 10, padding: '14px 28px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            Ver oferta educativa
          </button>
        </div>
      </section>

      {/* ── ¿QUIÉNES SOMOS? ── */}
      <section id="quienes" style={{ background: '#fff', padding: '64px 32px', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24, color: '#111' }}>¿Quiénes somos?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {[
              { icon: '🏛', title: 'INJUVE Nuevo León', desc: 'El Instituto de la Juventud de Nuevo León impulsa el desarrollo integral de los jóvenes del estado a través de programas educativos, culturales y de emprendimiento.' },
              { icon: '🤝', title: 'Programa Lengua Joven', desc: 'Convenios con escuelas de idiomas reconocidas para ofrecer cursos subsidiados a jóvenes entre 12 y 29 años, en modalidad presencial y en línea.' },
              { icon: '🌍', title: 'Nuestra misión', desc: 'Garantizar que el acceso a un segundo idioma no sea una barrera económica, ampliando las oportunidades laborales y académicas de los jóvenes nuevoleoneses.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ background: '#fafafa', borderRadius: 14, padding: '24px', border: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#111' }}>{title}</h3>
                <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PERÍODO DE INSCRIPCIONES ── */}
      <section id="inscripciones" style={{ padding: '64px 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#111' }}>Período de inscripciones</h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
            {periodo?.ciclo || 'Selecciona tu plantel e idioma para ver las fechas de tu ciclo'}
          </p>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
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
              style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, flex: 1, minWidth: 180, cursor: 'pointer' }}>
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
              style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, flex: 1, minWidth: 180, cursor: 'pointer' }}>
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
            <p style={{ color: '#999', textAlign: 'center', padding: '32px 0' }}>Cargando fechas…</p>
          )}

          {!cargandoPeriodo && filtroPlantel && filtroIdioma && !periodo && (
            <div style={{ background: '#fff8f0', border: '1.5px dashed #f18b11', borderRadius: 14, padding: '24px', textAlign: 'center', color: '#888', marginBottom: 28 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
              <strong>Aún no hay fechas configuradas</strong> para este plantel e idioma.<br />
              <span style={{ fontSize: 13 }}>Consulta directamente con tu coordinador.</span>
            </div>
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
                  <div key={titulo} style={{ background: '#fff', border: `2px solid ${color}22`, borderTop: `4px solid ${color}`, borderRadius: 14, padding: '20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>{fecha}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: '#111' }}>{titulo}</div>
                    <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {!cargandoPeriodo && (!filtroPlantel || !filtroIdioma) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28, opacity: 0.35, pointerEvents: 'none' }}>
              {['Pre-registro en línea','Examen de ubicación','Asignación de grupo','Inicio de clases'].map((t, i) => (
                <div key={t} style={{ background: '#fff', borderTop: `4px solid #ccc`, borderRadius: 14, padding: '20px', border: '2px solid #eee' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#bbb', marginBottom: 8, textTransform: 'uppercase' }}>— — —</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#999' }}>{t}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <button onClick={() => setModal('prereg')} style={{ background: '#f18b11', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 36px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
              Iniciar mi pre-registro →
            </button>
          </div>
        </div>
      </section>

      {/* ── INFORMACIÓN PARA INSCRIPCIÓN ── */}
      <section style={{ background: '#fff8f0', padding: '64px 32px', borderTop: '1px solid #f0e0cc' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'start' }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, color: '#111' }}>Información para inscripción</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { req: '📋 Requisitos', items: ['Tener entre 12 y 29 años', 'Ser residente de Nuevo León', 'Identificación oficial o acta de nacimiento', 'CURP'] },
                { req: '💰 Costo', items: ['Cuota bimestral accesible por escuela socia', 'Subsidio INJUVE aplicado automáticamente', 'Material didáctico adicional (varía por escuela)'] },
                { req: '📍 Modalidades', items: ['Presencial en planteles y escuelas socias', 'En línea (plataforma de la escuela socia)', 'Autodidacta (Altissia, acceso 24/7)'] },
              ].map(({ req, items }) => (
                <div key={req} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #f0e0cc' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#f18b11' }}>{req}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {items.map(i => <li key={i} style={{ fontSize: 13, color: '#555' }}>{i}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', border: '2px solid #f0e0cc', boxShadow: '0 4px 20px rgba(241,139,17,.08)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>¿Cómo inscribirte?</h3>
            {[
              ['1', 'Elige tu idioma y escuela en el catálogo de oferta educativa.'],
              ['2', 'Llena tu pre-registro desde esta página (sin necesidad de cuenta).'],
              ['3', 'Realiza el pago correspondiente y envía tu comprobante.'],
              ['4', 'Un coordinador confirmará tu pago y te asignará a un grupo.'],
              ['5', 'Recibirás tu usuario y contraseña para acceder al panel. ¡Listo!'],
            ].map(([n, texto]) => (
              <div key={n} style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f18b11', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>
                <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.6, paddingTop: 6 }}>{texto}</p>
              </div>
            ))}
            <button onClick={() => setModal('prereg')} style={{ width: '100%', background: '#f18b11', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 8 }}>
              Iniciar mi pre-registro →
            </button>
          </div>
        </div>
      </section>

      {/* ── OFERTA EDUCATIVA ── */}
      <section id="oferta" style={{ padding: '64px 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#111' }}>Oferta educativa</h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
            {planteles.length} escuelas socias · {idiomasResumen.length} idiomas disponibles + 21 idiomas autodidacta con Altissia
          </p>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
            Haz clic en un idioma para ver los horarios disponibles.
          </p>

          {/* Chips de idioma — clic abre panel de horarios */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {idiomasResumen.map(idioma => {
              const activo = idiomaAbierto === idioma
              return (
                <button key={idioma} onClick={() => setIdiomaAbierto(activo ? null : idioma)} style={{
                  background: activo ? '#f18b11' : '#fff', color: activo ? '#fff' : '#555',
                  border: activo ? '2px solid #f18b11' : '2px solid #f0e0cc',
                  borderRadius: 20, padding: '8px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  transition: 'all .15s',
                }}>
                  {ICONOS_IDIOMA[idioma] || '🌐'} {idioma}
                </button>
              )
            })}
          </div>

          {/* Panel de horarios del idioma seleccionado */}
          {idiomaAbierto && (
            <div style={{ background: '#fff', border: '2px solid #f0e0cc', borderRadius: 16, padding: '24px', marginBottom: 32, boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  {ICONOS_IDIOMA[idiomaAbierto] || '🌐'} {idiomaAbierto} — Horarios disponibles
                </h3>
                <button onClick={() => setIdiomaAbierto(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#aaa' }}>✕</button>
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
                            <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                              {['Categoría', 'Modalidad', 'Horario', 'Costo', 'Examen ubic.'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', fontWeight: 600, color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {ops.map(o => (
                              <tr key={o.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ display: 'inline-block', background: '#fff4e0', color: '#f18b11', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{o.categoria}</span>
                                  {o.edades && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{o.edades}</div>}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ display: 'inline-block', borderRadius: 8, padding: '2px 10px', fontSize: 12, fontWeight: 600, background: (COLOR_MODALIDAD[o.modalidad] || '#888') + '22', color: COLOR_MODALIDAD[o.modalidad] || '#888' }}>
                                    {o.modalidad === 'Presencial' ? '🏫' : '💻'} {o.modalidad}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', color: '#444' }}>🕐 {o.horario}</td>
                                <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  ${typeof o.costo === 'number' ? o.costo.toLocaleString() : o.costo}
                                  <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}> / {o.costo_tipo === 'anual' ? 'año' : 'bimestral'}</span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: o.examen_ubicacion === 'Si' ? '#27ae60' : o.examen_ubicacion === 'No' ? '#e74c3c' : '#888' }}>
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
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#111' }}>Escuelas socias</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {planteles.map(plantel => {
              const ofsPlantel = ofertas.filter(o => o.plantel_id === plantel.id)
              const idiomasPlantel = [...new Set(ofsPlantel.map(o => o.idioma))]
              const esAltissia = plantel.nombre === 'Altissia'
              return (
                <div key={plantel.id} style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1.5px solid #f0e0cc', borderLeft: esAltissia ? '4px solid #27ae60' : '4px solid #f18b11' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#111' }}>{plantel.nombre}</div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{esAltissia ? '💻 Autodidacta · En línea' : `🏫 ${ofsPlantel[0]?.modalidad || 'Presencial'} · ${plantel.ciudad}`}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {idiomasPlantel.slice(0, 5).map(i => (
                      <button key={i} onClick={() => setIdiomaAbierto(i)} style={{ fontSize: 11, background: '#faf0e6', padding: '2px 8px', borderRadius: 10, color: '#f18b11', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                        {ICONOS_IDIOMA[i] || '🌐'} {i}
                      </button>
                    ))}
                    {idiomasPlantel.length > 5 && <span style={{ fontSize: 11, color: '#999', padding: '2px 6px' }}>+{idiomasPlantel.length - 5} más</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section style={{ background: '#fff8f2', padding: '64px 32px', borderTop: '1px solid #f0e8e0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            Lo que dicen nuestros <span style={{ color: '#f18b11' }}>estudiantes</span>
          </h2>
          <p style={{ textAlign: 'center', color: '#888', fontSize: 14, marginBottom: 48 }}>
            Historias reales de jóvenes que estudian con Lengua Joven
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {[
              {
                nombre: 'Ana Sofía R.',
                edad: '23 años',
                texto: 'Gracias a Lengua Joven obtuve mi certificación en inglés y conseguí trabajo en una empresa internacional. El precio es imbatible para la calidad de enseñanza.',
                nivel: 'Inglés · Nivel 4',
              },
              {
                nombre: 'Carlos M.',
                edad: '19 años',
                texto: 'Aprendí francés desde cero en dos años. Los maestros son excelentes y el ambiente es muy motivador. Ahora tengo una beca para estudiar en Canadá.',
                nivel: 'Francés · Nivel 3',
              },
              {
                nombre: 'Valeria T.',
                edad: '26 años',
                texto: 'Estudié italiano por hobby y terminé enamorándome del idioma. Las clases en línea me permitieron avanzar sin descuidar mi trabajo.',
                nivel: 'Italiano · Nivel 2',
              },
              {
                nombre: 'Diego A.',
                edad: '17 años',
                texto: 'Mi mamá me inscribió casi obligado jaja, pero resultó ser una de las mejores decisiones. Ya puedo hablar inglés con fluidez y eso abrió muchas puertas.',
                nivel: 'Inglés · Nivel 5',
              },
            ].map((t, i) => (
              <div key={i} style={{
                background: '#fff',
                borderRadius: 16,
                padding: '28px 24px',
                boxShadow: '0 4px 20px rgba(0,0,0,.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ fontSize: 28, color: '#f18b11' }}>❝</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: '#444', flex: 1 }}>{t.texto}</p>
                <div style={{ borderTop: '1px solid #f0e8e0', paddingTop: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{t.nombre}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{t.edad} · {t.nivel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#111', color: '#aaa', padding: '32px', textAlign: 'center', fontSize: 13 }}>
        <div style={{ fontWeight: 700, color: '#fff', fontSize: 16, marginBottom: 6 }}>
          <span style={{ color: '#f18b11' }}>Lengua</span> Joven — INJUVE Nuevo León
        </div>
        <p style={{ margin: '4px 0' }}>Programa de idiomas para jóvenes de 12 a 29 años</p>
        <p style={{ margin: '4px 0', fontSize: 12 }}>© 2026 · soporte@injuve.mx</p>
      </footer>
    </div>
  )
}
