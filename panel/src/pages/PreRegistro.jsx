import { useState, useEffect } from 'react'

const API = (import.meta.env.VITE_API_URL || '') + '/api'
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/

const RANGOS = [
  { v: 'CHILDREN', l: 'Children', s: '10–11 años' },
  { v: 'TEENS',    l: 'Teens',    s: '12–15 años' },
  { v: 'JOVEN',    l: 'Joven',    s: '16–29 años' },
  { v: 'PLUS',     l: 'Plus',     s: '30+ años'   },
]

const esMenor = (r) => r === 'CHILDREN' || r === 'TEENS'

export default function PreRegistro({ onVolver }) {
  const [paso, setPaso] = useState(1)
  const [d, setD] = useState({
    nombre: '', apellido_paterno: '', apellido_materno: '',
    email: '', tel: '', curp: '', sexo: '', rango_edad: '',
    domicilio: '', num_exterior: '', colonia: '', municipio: '',
    idioma_interes: '', plantel_id: '', grupo_interes_id: '',
    tutor_nombre: '', tutor_tel: '', tutor_email: '',
    acepto_aviso: false,
  })
  const [errs, setErrs] = useState({})
  const [idiomas, setIdiomas] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [grupos, setGrupos] = useState([])
  const [aviso, setAviso] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [folio, setFolio] = useState(null)
  const [errorGlobal, setErrorGlobal] = useState('')

  useEffect(() => {
    fetch(`${API}/publico/idiomas`).then(r => r.json()).then(rows => setIdiomas(rows.map(r => r.nombre))).catch(() => {})
    fetch(`${API}/publico/planteles`).then(r => r.json()).then(setPlanteles).catch(() => {})
    fetch(`${API}/publico/aviso-privacidad`).then(r => r.json()).then(setAviso).catch(() => {})
  }, [])

  useEffect(() => {
    if (!d.plantel_id || !d.idioma_interes) { setGrupos([]); return }
    fetch(`${API}/publico/grupos?plantel_id=${d.plantel_id}&idioma=${encodeURIComponent(d.idioma_interes)}`)
      .then(r => r.json()).then(setGrupos).catch(() => {})
  }, [d.plantel_id, d.idioma_interes])

  const pasoAviso = esMenor(d.rango_edad) ? 5 : 4
  const esUltimo = paso === pasoAviso

  function set(campo, valor) {
    setD(prev => ({ ...prev, [campo]: valor }))
    setErrs(prev => ({ ...prev, [campo]: '' }))
    setErrorGlobal('')
  }

  function setAndRerender(campo, valor) {
    setD(prev => ({ ...prev, [campo]: valor }))
    setErrs(prev => ({ ...prev, [campo]: '' }))
  }

  function validar() {
    const e = {}
    if (paso === 1) {
      if (!d.nombre.trim()) e.nombre = 'El nombre es requerido'
      if (!d.apellido_paterno.trim()) e.apellido_paterno = 'El apellido paterno es requerido'
      if (!d.apellido_materno.trim()) e.apellido_materno = 'El apellido materno es requerido'
      if (!d.curp.trim()) e.curp = 'El CURP es requerido'
      else if (!CURP_RE.test(d.curp.trim().toUpperCase())) e.curp = 'CURP inválido (exactamente 18 caracteres)'
      if (!d.email.trim() || !/\S+@\S+\.\S+/.test(d.email)) e.email = 'Escribe un correo válido'
      if (!d.tel.trim() || d.tel.replace(/\D/g, '').length !== 10) e.tel = 'El WhatsApp debe tener exactamente 10 dígitos'
      if (!d.sexo) e.sexo = 'Selecciona una opción'
      if (!d.rango_edad) e.rango_edad = 'Selecciona tu rango de edad'
    } else if (paso === 2) {
      if (!d.domicilio.trim()) e.domicilio = 'Escribe el nombre de tu calle'
      if (!d.colonia.trim()) e.colonia = 'Escribe tu colonia'
      if (!d.municipio.trim()) e.municipio = 'Escribe tu municipio'
    } else if (paso === 3) {
      if (!d.idioma_interes) e.idioma_interes = 'Elige el idioma que quieres aprender'
      if (!d.plantel_id) e.plantel_id = 'Elige una sede'
    } else if (paso === 4 && esMenor(d.rango_edad)) {
      if (!d.tutor_nombre.trim()) e.tutor_nombre = 'El nombre del tutor es requerido'
      if (!d.tutor_tel.trim()) e.tutor_tel = 'El WhatsApp del tutor es requerido'
      if (!d.tutor_email.trim() || !/\S+@\S+\.\S+/.test(d.tutor_email)) e.tutor_email = 'Email del tutor inválido'
    } else if (esUltimo) {
      if (!d.acepto_aviso) e.acepto_aviso = 'Debes aceptar el aviso de privacidad para continuar'
    }
    setErrs(e)
    return Object.keys(e).length === 0
  }

  function siguiente() {
    if (!validar()) return
    if (esUltimo) { enviar(); return }
    setPaso(p => p + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function anterior() {
    setErrorGlobal('')
    setErrs({})
    setPaso(p => Math.max(1, p - 1))
  }

  async function enviar() {
    if (enviando) return
    setEnviando(true)
    setErrorGlobal('')
    try {
      const r = await fetch(`${API}/pre-registros/publico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...d,
          curp: d.curp.trim().toUpperCase(),
          nombre: d.nombre.trim().toUpperCase(),
          apellido_paterno: d.apellido_paterno.trim().toUpperCase(),
          apellido_materno: d.apellido_materno.trim().toUpperCase(),
          tel: d.tel.replace(/\D/g, ''),
          proveedor_interes: planteles.find(p => p.id === d.plantel_id)?.nombre || '',
          aviso_id: aviso?.id || null,
        }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Error al enviar el formulario')
      setFolio(body.folio)
    } catch (e) {
      setErrorGlobal(e.message)
    } finally {
      setEnviando(false)
    }
  }

  // ── Estilos inline (consistent with the project) ──
  const s = {
    wrap: { maxWidth: 640, margin: '0 auto', padding: '16px' },
    card: {
      background: '#ffffff', border: '1px solid #e5e7eb',
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 8px 40px rgba(0,0,0,.3)',
    },
    head: {
      background: '#F18B11', padding: '22px 28px', color: '#fff',
      display: 'flex', alignItems: 'center', gap: 14,
    },
    headMark: {
      width: 46, height: 46, background: 'rgba(255,255,255,.18)',
      borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: 17, flexShrink: 0,
    },
    stepper: {
      display: 'flex', background: 'var(--fondo-2, #f9fafb)',
      borderBottom: '1px solid var(--borde, #e5e7eb)',
      padding: '0 20px', overflowX: 'auto',
    },
    formArea: { padding: '28px 28px 20px' },
    stepTitle: { fontWeight: 800, fontSize: 19, marginBottom: 5, color: '#1a1a2e' },
    stepSub: { color: '#6b7280', fontSize: 13.5, marginBottom: 24, lineHeight: 1.5 },
    fields: { display: 'flex', flexDirection: 'column', gap: 15 },
    field: { display: 'flex', flexDirection: 'column', gap: 5 },
    label: { fontSize: 11.5, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .5 },
    input: {
      width: '100%', padding: '10px 13px', border: '1.5px solid #e5e7eb',
      borderRadius: 10, fontSize: 15, background: '#fff', color: '#1a1a2e',
      fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    },
    inputErr: { borderColor: '#DC2626' },
    errTxt: { fontSize: 12, color: '#DC2626' },
    hint: { fontSize: 12, color: 'var(--gris)' },
    chips: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 },
    nav: { display: 'flex', gap: 10, padding: '16px 28px 24px', borderTop: '1px solid var(--borde, #e5e7eb)' },
    btnPrimary: {
      flex: 1, maxWidth: 260, marginLeft: 'auto', padding: '12px 22px',
      background: '#F18B11', color: '#fff', border: 'none', borderRadius: 12,
      fontSize: 15, fontWeight: 700, cursor: 'pointer',
    },
    btnSec: {
      padding: '12px 20px', background: 'transparent', color: 'var(--gris)',
      border: '1.5px solid var(--borde, #e5e7eb)', borderRadius: 12,
      fontSize: 14, fontWeight: 600, cursor: 'pointer',
    },
    errBanner: {
      margin: '0 28px 8px', background: '#FEF2F2', color: '#DC2626',
      borderRadius: 10, padding: '10px 14px', fontSize: 13.5,
    },
  }

  if (folio) {
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={s.head}>
            <div style={s.headMark}>LJ</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>Pre-registro enviado</div>
              <div style={{ opacity: .85, fontSize: 13 }}>Lengua Joven · INJUVE NL</div>
            </div>
          </div>
          <div style={{ padding: '44px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>¡Listo!</div>
            <div style={{ color: 'var(--gris)', fontSize: 14, marginBottom: 10 }}>Tu número de folio es:</div>
            <div style={{
              display: 'inline-block', background: '#FEF3E2', color: '#C97309',
              borderRadius: 12, padding: '10px 24px', fontWeight: 800, fontSize: 24,
              letterSpacing: 1.5, margin: '6px 0 18px',
            }}>
              {folio}
            </div>
            <p style={{ color: 'var(--gris)', fontSize: 14, lineHeight: 1.65, maxWidth: 360, margin: '0 auto' }}>
              Guarda este folio para cualquier aclaración.<br /><br />
              Recibirás instrucciones de pago en <strong>{d.email}</strong>.
              Una vez confirmado tu pago se activará tu acceso al sistema.
            </p>
            {onVolver && (
              <button onClick={onVolver} style={{ ...s.btnSec, marginTop: 24 }}>
                ← Volver al inicio
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const pasosDef = [
    { n: 1, l: 'Datos' },
    { n: 2, l: 'Domicilio' },
    { n: 3, l: 'Inscripción' },
    ...(esMenor(d.rango_edad) ? [{ n: 4, l: 'Tutor' }] : []),
    { n: pasoAviso, l: 'Aviso' },
  ]

  const titulos = {
    1: { t: 'Datos del alumno', s: 'Escribe tu nombre tal como aparece en tu identificación oficial.' },
    2: { t: 'Domicilio', s: '¿Dónde vives? Puedes indicar tu dirección aproximada.' },
    3: { t: 'Tu inscripción', s: 'Elige el idioma y la sede más cercana a ti.' },
    4: esMenor(d.rango_edad)
      ? { t: 'Datos del tutor', s: 'Como eres menor de edad, necesitamos los datos de tu tutor.' }
      : { t: 'Aviso de privacidad', s: 'Lee y acepta para completar tu pre-registro.' },
    5: { t: 'Aviso de privacidad', s: 'Lee y acepta para completar tu pre-registro.' },
  }
  const { t: tit, s: sub } = titulos[paso] || {}

  function calcularRangoDesdeCurp(curp) {
    if (!curp || curp.length < 10) return null
    const yy = curp.slice(4, 6)
    const mm = curp.slice(6, 8)
    const dd = curp.slice(8, 10)
    const yyNum = parseInt(yy, 10)
    const currentYY = new Date().getFullYear() % 100
    const century = yyNum <= currentYY ? '20' : '19'
    const nac = new Date(`${century}${yy}-${mm}-${dd}`)
    if (isNaN(nac.getTime())) return null
    const hoy = new Date()
    let edad = hoy.getFullYear() - nac.getFullYear()
    const m = hoy.getMonth() - nac.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
    if (edad >= 10 && edad <= 11) return 'CHILDREN'
    if (edad >= 12 && edad <= 15) return 'TEENS'
    if (edad >= 16 && edad <= 29) return 'JOVEN'
    if (edad >= 30) return 'PLUS'
    return null
  }

  function Inp({ k, label, type = 'text', placeholder = '', hint = '', maxLength, transform, onAfterChange }) {
    const err = errs[k] || ''
    return (
      <div style={s.field}>
        <label style={s.label}>{label}</label>
        <input
          type={type} value={d[k] || ''} placeholder={placeholder}
          maxLength={maxLength}
          onChange={e => {
            const val = transform ? transform(e.target.value) : e.target.value
            set(k, val)
            if (onAfterChange) onAfterChange(val)
          }}
          style={{ ...s.input, ...(err ? s.inputErr : {}) }}
        />
        {hint && <span style={s.hint} dangerouslySetInnerHTML={{ __html: hint }} />}
        {err && <span style={s.errTxt}>⚠ {err}</span>}
      </div>
    )
  }

  function Sel({ k, label, opts, placeholder = '' }) {
    const err = errs[k] || ''
    return (
      <div style={s.field}>
        <label style={s.label}>{label}</label>
        <select value={d[k] || ''} onChange={e => set(k, e.target.value)}
          style={{ ...s.input, ...(err ? s.inputErr : {}), appearance: 'none' }}>
          <option value="">{placeholder}</option>
          {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        {err && <span style={s.errTxt}>⚠ {err}</span>}
      </div>
    )
  }

  function Chips({ k, label, opts, onChangeOverride }) {
    const err = errs[k] || ''
    return (
      <div style={s.field}>
        <label style={s.label}>{label}</label>
        <div style={s.chips}>
          {opts.map((o, i) => (
            <label key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '10px 8px 8px', border: `1.5px solid ${d[k] === o.v ? '#F18B11' : 'var(--borde, #e5e7eb)'}`,
              borderRadius: 12, cursor: 'pointer', textAlign: 'center', gap: 2, minHeight: 58,
              background: d[k] === o.v ? '#FEF3E2' : 'var(--fondo)',
              color: d[k] === o.v ? '#C97309' : 'var(--texto)',
              fontWeight: 600, fontSize: 13.5,
            }}>
              <input type="radio" name={k} value={o.v} checked={d[k] === o.v}
                onChange={() => onChangeOverride ? onChangeOverride(o.v) : set(k, o.v)}
                style={{ display: 'none' }} />
              {o.l}
              {o.s && <span style={{ fontSize: 11, fontWeight: 400, color: d[k] === o.v ? '#C97309' : 'var(--gris)', opacity: .8 }}>{o.s}</span>}
            </label>
          ))}
        </div>
        {err && <span style={s.errTxt}>⚠ {err}</span>}
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.head}>
          <div style={s.headMark}>LJ</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>Pre-registro</div>
            <div style={{ opacity: .85, fontSize: 13 }}>Programa de idiomas · Lengua Joven · INJUVE NL</div>
          </div>
        </div>

        {/* Stepper */}
        <div style={s.stepper}>
          {pasosDef.map(p => {
            const est = paso > p.n ? 'done' : paso === p.n ? 'active' : 'pending'
            const color = est === 'done' ? '#16A34A' : est === 'active' ? '#F18B11' : 'var(--gris)'
            return (
              <div key={p.n} style={{
                flex: 1, minWidth: 70, display: 'flex', flexDirection: 'column',
                alignItems: 'center', padding: '12px 10px 9px',
                borderBottom: `2.5px solid ${est === 'pending' ? 'transparent' : color}`,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, marginBottom: 4,
                  background: est === 'pending' ? 'var(--borde, #e5e7eb)' : color,
                  color: est === 'pending' ? 'var(--gris)' : '#fff',
                }}>
                  {est === 'done' ? '✓' : p.n}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {p.l}
                </div>
              </div>
            )
          })}
        </div>

        {/* Form body */}
        <div style={s.formArea}>
          <div style={s.stepTitle}>{tit}</div>
          <div style={s.stepSub}>{sub}</div>
          <div style={s.fields}>

            {paso === 1 && <>
              <Inp k="nombre" label="Nombre(s) *" placeholder="Ej. Ana Sofía"
                hint='Tal como aparece en tu identificación oficial.' />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Inp k="apellido_paterno" label="Apellido paterno *" placeholder="Ej. González" />
                <Inp k="apellido_materno" label="Apellido materno *" placeholder="Ej. Martínez" />
              </div>
              <Inp k="curp" label="CURP * (18 caracteres)" placeholder="XXXX000000XXXXXX00"
                maxLength={18} transform={v => v.toUpperCase()}
                onAfterChange={curp => {
                  const rango = calcularRangoDesdeCurp(curp)
                  if (rango) setD(prev => ({ ...prev, rango_edad: rango }))
                }}
                hint='Si no lo recuerdas: <a href="https://www.gob.mx/curp/" target="_blank" style="color:#F18B11;font-weight:600;">consulta tu CURP aquí</a>.' />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Inp k="email" label="Correo electrónico *" type="email" placeholder="tu@correo.com" />
                <Inp k="tel" label="WhatsApp * 📱" type="tel" placeholder="10 dígitos" maxLength={10}
                  transform={v => v.replace(/\D/g, '').slice(0, 10)}
                  hint="Exactamente 10 dígitos, solo números." />
              </div>
              <Chips k="sexo" label="Sexo" opts={[
                { v: 'Masculino', l: 'Masculino' },
                { v: 'Femenino', l: 'Femenino' },
                { v: 'Prefiero no indicar', l: 'Prefiero no indicar' },
              ]} />
              <Chips k="rango_edad" label="Rango de edad" opts={RANGOS}
                onChangeOverride={(v) => setAndRerender('rango_edad', v)} />
            </>}

            {paso === 2 && <>
              <Inp k="domicilio" label="Calle" placeholder="Nombre de la calle" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Inp k="num_exterior" label="Número exterior" placeholder="Ej: 204" />
                <Inp k="colonia" label="Colonia" placeholder="Nombre de la colonia" />
              </div>
              <Inp k="municipio" label="Municipio / Ciudad" placeholder="Ej: Monterrey, Guadalupe…" />
            </>}

            {paso === 3 && <>
              <Sel k="idioma_interes" label="Idioma"
                opts={idiomas.map(i => ({ v: i, l: i }))}
                placeholder="Elige el idioma que quieres aprender…" />
              <Sel k="plantel_id" label="Sede"
                opts={planteles.map(p => ({ v: p.id, l: p.nombre }))}
                placeholder="Elige la sede más cercana…" />
              <span style={s.hint}>Si no hay sede en tu zona, elige "Clases en línea".</span>
              {grupos.length > 0 && (
                <Sel k="grupo_interes_id" label="Horario preferido (opcional)"
                  opts={grupos.map(g => ({ v: g.id, l: g.horario }))}
                  placeholder="Sin preferencia de horario" />
              )}
            </>}

            {paso === 4 && esMenor(d.rango_edad) && <>
              <div style={{ background: '#FEF3E2', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, color: '#C97309', lineHeight: 1.5 }}>
                Como eres menor de edad, necesitamos los datos de tu papá, mamá o tutor para que acepte el aviso de privacidad.
              </div>
              <Inp k="tutor_nombre" label="Nombre del tutor" placeholder="Nombre completo" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Inp k="tutor_tel" label="WhatsApp del tutor 📱" type="tel" placeholder="10 dígitos" />
                <Inp k="tutor_email" label="Email del tutor" type="email" placeholder="tutor@correo.com" />
              </div>
            </>}

            {esUltimo && <>
              <div style={{ background: '#FEF3E2', borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#C97309', marginBottom: 8 }}>
                  Aviso de Privacidad · Lengua Joven Internacional
                </div>
                <div style={{ fontSize: 13, color: 'var(--gris)', lineHeight: 1.65, maxHeight: 150, overflowY: 'auto' }}>
                  {aviso?.contenido || `El Instituto de la Juventud del Estado de Nuevo León (INJUVE NL) es el responsable del tratamiento de tus datos personales. Los datos serán utilizados para fines de inscripción y operación del programa de idiomas, sin compartirse con terceros ajenos al programa salvo obligación legal.`}
                  {' '}
                  <a href="https://www.nl.gob.mx/aviso-de-privacidad-integral-para-cursos-de-idiomas-lengua-joven-internacional-del-injuve-nuevo-leon"
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: '#F18B11', fontWeight: 600, textDecoration: 'none' }}>
                    👉 Ver aviso completo
                  </a>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={d.acepto_aviso}
                  onChange={e => set('acepto_aviso', e.target.checked)}
                  style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1, accentColor: '#F18B11' }} />
                <span style={{ fontSize: 14, lineHeight: 1.45 }}>
                  He leído y <strong>acepto el Aviso de Privacidad</strong> del programa de idiomas Lengua Joven.
                </span>
              </label>
              {errs.acepto_aviso && <span style={s.errTxt}>⚠ {errs.acepto_aviso}</span>}
            </>}

          </div>
        </div>

        {errorGlobal && <div style={s.errBanner}>⚠ {errorGlobal}</div>}

        {/* Nav */}
        <div style={s.nav}>
          {paso > 1 && (
            <button style={s.btnSec} onClick={anterior} disabled={enviando}>
              ← Anterior
            </button>
          )}
          <button style={{ ...s.btnPrimary, opacity: enviando ? .6 : 1, cursor: enviando ? 'not-allowed' : 'pointer' }}
            onClick={siguiente} disabled={enviando}>
            {enviando ? 'Enviando��' : esUltimo ? 'Enviar pre-registro' : 'Siguiente →'}
          </button>
        </div>

        {onVolver && (
          <div style={{ textAlign: 'center', padding: '0 0 20px' }}>
            <button onClick={onVolver} style={{ background: 'none', border: 'none', color: 'var(--gris)', fontSize: 13, cursor: 'pointer' }}>
              ← Volver al inicio de sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
