import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { ROL_PERMISOS } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

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

  async function cargar() {
    try {
      const [u, ins, g, i, p] = await Promise.all([
        api.getUsuario(usuario.id),
        api.getInscripciones(),
        api.getGrupos(),
        api.getIdiomas(),
        api.getPlanteles(),
      ])
      setPerfil(u)
      setInscripciones(ins)
      setGrupos(g)
      setIdiomas(i)
      setPlanteles(p)
      if (i.length > 0) {
        const todos = await Promise.all(i.map(id => api.getNiveles(id.id)))
        setNiveles(todos.flat())
      }
    } catch (e) {
      console.error('Error cargando perfil:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  function iniciarEdicion() {
    setForm({ ...perfil })
    setEditando(true)
  }

  async function guardarPerfil() {
    if (!form.nombre?.trim() || !form.email?.trim()) return alert('Nombre y correo son requeridos.')
    try {
      await api.actualizarUsuario(usuario.id, form)
      setEditando(false)
      setGuardado('perfil')
      setTimeout(() => setGuardado(''), 2500)
      await cargar()
    } catch (e) {
      alert('Error al guardar: ' + e.message)
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

  const rolCfg = ROL_PERMISOS[usuario.rol]
  const inscripcionesActivas = inscripciones.filter(i => ['asignada', 'pagada'].includes(i.estado))

  if (!perfil) return null

  return (
    <div>
      <div className="page-header">
        <h2>Mi Perfil</h2>
        {guardado === 'perfil' && <span className="badge asignada">✓ Perfil guardado</span>}
        {guardado === 'pwd' && <span className="badge asignada">✓ Contraseña actualizada</span>}
      </div>

      <div className="dash-grid">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div className="avatar" style={{ background: rolCfg.color, width: 56, height: 56, fontSize: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
              {perfil.nombre?.charAt(0) || '?'}
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
                {perfil.rol === 'alumno' && (
                  <>
                    <div><label>No. Matrícula</label><p>{perfil.matricula || '—'}</p></div>
                    <div><label>Fecha de nacimiento</label><p>{perfil.fecha_nacimiento || '—'}</p></div>
                    <div><label>Estado / Entidad</label><p>{perfil.estado_entidad || '—'}</p></div>
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
              <div className="modal-acciones" style={{ marginTop: 12 }}>
                <button className="btn-sec" onClick={() => setEditando(false)}>Cancelar</button>
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
