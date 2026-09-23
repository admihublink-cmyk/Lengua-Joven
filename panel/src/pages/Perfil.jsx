import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App.jsx'
import { ROL_PERMISOS } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

const ORANGE = '#f18b11'

function edadDesdeCurp(curp) {
  if (!curp || curp.length < 10) return null
  const yy = parseInt(curp.substring(4, 6), 10)
  const mm = parseInt(curp.substring(6, 8), 10) - 1
  const dd = parseInt(curp.substring(8, 10), 10)
  if (isNaN(yy) || isNaN(mm) || isNaN(dd)) return null
  const hoy = new Date()
  const century = yy <= hoy.getFullYear() % 100 ? 2000 : 1900
  const nac = new Date(century + yy, mm, dd)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad > 0 && edad < 120 ? edad : null
}

function resizeImagen(file, maxPx = 160) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.src = url
  })
}

export default function Perfil() {
  const { usuario } = useAuth()
  const [perfil, setPerfil] = useState(null)
  const [inscripciones, setInscripciones] = useState([])
  const [grupos, setGrupos] = useState([])
  const [idiomas, setIdiomas] = useState([])
  const [niveles, setNiveles] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({})
  const [pwdForm, setPwdForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [guardado, setGuardado] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [modalPwd, setModalPwd] = useState(false)
  const [err, setErr] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const fileRef = useRef()

  async function cargar() {
    try {
      const [u, ins, g, i, p] = await Promise.all([
        api.getUsuario(usuario.id),
        api.getInscripciones().catch(() => []),
        api.getGrupos().catch(() => []),
        api.getIdiomas().catch(() => []),
        api.getPlanteles().catch(() => []),
      ])
      setPerfil(u)
      setInscripciones(ins)
      setGrupos(g)
      setIdiomas(i)
      setPlanteles(p)
      if (i.length > 0) {
        const todos = await Promise.all(i.map(id => api.getNiveles(id.id))).catch(() => [])
        setNiveles(todos.flat())
      }
    } catch (e) {
      console.error('Error cargando perfil:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  function iniciarEdicion() {
    setForm({ ...perfil })
    setErr('')
    setEditando(true)
  }

  async function handleAvatar(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return setErr('Solo se permiten imágenes.')
    setSubiendo(true)
    try {
      const b64 = await resizeImagen(file)
      await api.actualizarUsuario(usuario.id, { foto_perfil: b64 })
      await cargar()
      setGuardado('foto')
      setTimeout(() => setGuardado(''), 2500)
    } catch (e) {
      setErr('Error al subir la foto.')
    } finally { setSubiendo(false) }
  }

  async function guardarPerfil() {
    setErr('')
    if (!form.nombre?.trim() || !form.email?.trim()) return setErr('Nombre y correo son requeridos.')
    if (form.whatsapp && form.whatsapp.replace(/\D/g, '').length !== 10) return setErr('WhatsApp debe tener exactamente 10 dígitos.')
    try {
      await api.actualizarUsuario(usuario.id, form)
      setEditando(false)
      setGuardado('perfil')
      setTimeout(() => setGuardado(''), 2500)
      await cargar()
    } catch (e) {
      setErr('Error al guardar: ' + e.message)
    }
  }

  async function cambiarPassword() {
    setPwdErr('')
    if (!pwdForm.actual.trim()) return setPwdErr('Ingresa tu contraseña actual.')
    if (!pwdForm.nueva.trim() || pwdForm.nueva.length < 6) return setPwdErr('La nueva contraseña debe tener al menos 6 caracteres.')
    if (pwdForm.nueva !== pwdForm.confirmar) return setPwdErr('Las contraseñas no coinciden.')
    try {
      await api.cambiarPassword({ password_actual: pwdForm.actual, nueva_password: pwdForm.nueva })
      setModalPwd(false)
      setPwdForm({ actual: '', nueva: '', confirmar: '' })
      setGuardado('pwd')
      setTimeout(() => setGuardado(''), 2500)
    } catch (e) {
      setPwdErr(e.message)
    }
  }

  function nomGrupo(id) {
    const g = grupos.find(x => x.id === id)
    if (!g) return '—'
    const idioma = idiomas.find(i => i.id === g.idioma_id)?.nombre || ''
    const nivel = niveles.find(n => n.id === g.nivel_id)?.nombre || ''
    return `${g.codigo} — ${idioma} ${nivel}`
  }

  function nomPlantel(id) { return planteles.find(p => p.id === id)?.nombre || '—' }

  const rolCfg = ROL_PERMISOS[usuario.rol] || { color: '#888', label: usuario.rol }
  const inscripcionesActivas = inscripciones.filter(i => ['asignada', 'pagada'].includes(i.estado))
  const edad = perfil ? edadDesdeCurp(perfil.curp) : null

  if (!perfil) return null

  return (
    <div>
      <div className="page-header">
        <h2>Mi Perfil</h2>
        {guardado === 'perfil' && <span className="badge asignada">✓ Perfil guardado</span>}
        {guardado === 'pwd' && <span className="badge asignada">✓ Contraseña actualizada</span>}
        {guardado === 'foto' && <span className="badge asignada">✓ Foto actualizada</span>}
      </div>

      <div className="dash-grid">
        <div className="card">
          {/* Avatar + encabezado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {perfil.foto_perfil ? (
                <img src={perfil.foto_perfil} alt="Avatar"
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${ORANGE}` }} />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', background: rolCfg.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 28, flexShrink: 0,
                }}>
                  {perfil.nombre?.charAt(0) || '?'}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={subiendo}
                title="Cambiar foto"
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 24, height: 24, borderRadius: '50%',
                  background: ORANGE, border: '2px solid #fff',
                  cursor: 'pointer', fontSize: 12, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}
              >✎</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{perfil.nombre}</div>
              <div style={{ color: rolCfg.color, fontSize: 13 }}>{rolCfg.label}</div>
              {perfil.plantel_id && <div className="texto-muted" style={{ fontSize: 12 }}>{nomPlantel(perfil.plantel_id)}</div>}
            </div>
          </div>

          {!editando ? (
            <>
              <div className="detalle-grid" style={{ marginBottom: 16 }}>
                <div><label>Nombre completo</label><p>{perfil.nombre}</p></div>
                <div><label>Correo electrónico</label><p>{perfil.email}</p></div>
                {edad !== null && (
                  <div><label>Edad</label><p>{edad} años</p></div>
                )}
                {perfil.municipio && (
                  <div><label>Municipio</label><p>{perfil.municipio}</p></div>
                )}
                {perfil.whatsapp && (
                  <div><label>WhatsApp</label><p>{perfil.whatsapp}</p></div>
                )}
                {perfil.rol === 'alumno' && (
                  <>
                    {perfil.matricula && <div><label>No. Matrícula</label><p>{perfil.matricula}</p></div>}
                    {perfil.fecha_nacimiento && <div><label>Fecha de nacimiento</label><p>{perfil.fecha_nacimiento}</p></div>}
                    {perfil.estado_entidad && <div><label>Estado / Entidad</label><p>{perfil.estado_entidad}</p></div>}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primario" onClick={iniciarEdicion}>Editar perfil</button>
                <button className="btn-sec" onClick={() => { setPwdErr(''); setModalPwd(true) }}>Cambiar contraseña</button>
              </div>
            </>
          ) : (
            <>
              <div className="form-grid">
                <label style={{ gridColumn: '1/-1' }}>Nombre completo *
                  <input value={form.nombre || ''} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </label>
                <label style={{ gridColumn: '1/-1' }}>Correo electrónico *
                  <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                </label>
                <label style={{ gridColumn: '1/-1' }}>WhatsApp *
                  <input value={form.whatsapp || ''} onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="10 dígitos, ej. 8112345678" />
                </label>
                {/* Campos solo lectura */}
                {perfil.municipio && (
                  <label style={{ gridColumn: '1/-1' }}>Municipio
                    <input value={perfil.municipio} readOnly style={{ background: 'rgba(0,0,0,.04)', color: '#666', cursor: 'default' }} />
                  </label>
                )}
                {edad !== null && (
                  <label>Edad
                    <input value={`${edad} años`} readOnly style={{ background: 'rgba(0,0,0,.04)', color: '#666', cursor: 'default' }} />
                  </label>
                )}
                {perfil.rol === 'alumno' && (
                  <>
                    <label>No. Matrícula
                      <input value={form.matricula || ''} onChange={e => setForm({ ...form, matricula: e.target.value })} placeholder="INJUVE-2026-XXX" />
                    </label>
                    <label>Fecha de nacimiento
                      <input type="date" value={form.fecha_nacimiento || ''} onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })} />
                    </label>
                    <label style={{ gridColumn: '1/-1' }}>Estado / Entidad
                      <input value={form.estado_entidad || ''} onChange={e => setForm({ ...form, estado_entidad: e.target.value })} placeholder="Ej. Nuevo León" />
                    </label>
                  </>
                )}
              </div>
              {err && <p style={{ color: 'var(--rojo)', fontSize: 13, margin: '8px 0' }}>{err}</p>}
              <div className="modal-acciones" style={{ marginTop: 12 }}>
                <button className="btn-sec" onClick={() => { setEditando(false); setErr('') }}>Cancelar</button>
                <button className="btn-primario" onClick={guardarPerfil}>Guardar cambios</button>
              </div>
            </>
          )}
        </div>

        {perfil.rol === 'alumno' && (
          <div className="card">
            <h3>Mis cursos y grupos</h3>
            {inscripcionesActivas.length === 0 ? (
              <p className="texto-muted">No tienes inscripciones activas.</p>
            ) : (
              <div className="tabla-wrap">
                <table className="tabla chica">
                  <thead>
                    <tr><th>Folio</th><th>Grupo / Curso</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {inscripcionesActivas.map(ins => (
                      <tr key={ins.id}>
                        <td><code>{ins.folio}</code></td>
                        <td>{nomGrupo(ins.grupo_id)}</td>
                        <td><span className={'badge ' + ins.estado}>{ins.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {modalPwd && (
        <Modal titulo="Cambiar contraseña" onClose={() => setModalPwd(false)} ancho={420}>
          <label>Contraseña actual *
            <input type="password" value={pwdForm.actual} onChange={e => setPwdForm({ ...pwdForm, actual: e.target.value })} />
          </label>
          <label>Nueva contraseña *
            <input type="password" value={pwdForm.nueva} onChange={e => setPwdForm({ ...pwdForm, nueva: e.target.value })} />
          </label>
          <label>Confirmar nueva contraseña *
            <input type="password" value={pwdForm.confirmar} onChange={e => setPwdForm({ ...pwdForm, confirmar: e.target.value })} />
          </label>
          {pwdErr && <p style={{ color: 'var(--rojo)', fontSize: 13, marginTop: 8 }}>{pwdErr}</p>}
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModalPwd(false)}>Cancelar</button>
            <button className="btn-primario" onClick={cambiarPassword}>Cambiar contraseña</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
