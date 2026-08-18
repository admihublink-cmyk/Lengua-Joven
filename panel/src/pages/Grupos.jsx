import { useState, useEffect } from 'react'
import { useAuth, useNav } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

const ROLES_CHAT_GRUPAL = ['superadmin', 'coordinador', 'director', 'profesor']

export default function Grupos({ params = {} }) {
  const { usuario, tienePermiso } = useAuth()
  const { navegar } = useNav()
  const [grupos, setGrupos] = useState([])
  const [idiomas, setIdiomas] = useState([])
  const [niveles, setNiveles] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [ofertas, setOfertas] = useState([])
  const [profesores, setProfesores] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  async function cargar() {
    try {
      // Idiomas: usar endpoint público para que coordinadores vean todos los idiomas
      const [g, i, o, p, u, ins] = await Promise.all([
        api.getGrupos(),
        fetch('/api/publico/idiomas').then(r => r.json()),
        api.getOfertas(),
        api.getPlanteles(),
        api.getUsuarios(),
        api.getInscripciones(),
      ])
      setGrupos(g)
      setIdiomas(i)
      setOfertas(o)
      setPlanteles(p)
      setProfesores(u.filter(x => x.rol === 'profesor'))
      setInscripciones(ins)
      // Niveles: cargar usando los IDs del catálogo público
      if (i.length > 0) {
        const todos = await Promise.all(i.map(id => api.getNiveles(id.id).catch(() => [])))
        setNiveles(todos.flat())
      }
    } catch (e) {
      console.error('Error cargando grupos:', e)
    }
  }

  useEffect(() => {
    cargar().then(() => {
      if (params.abrirCrear) {
        setForm({
          idioma_id: params.idioma_id || '',
          nivel_id: '',
          plantel_id: params.plantel_id || usuario.plantel_id || '',
          profesor_id: '',
          codigo: '',
          horario: '',
          cupo: 20,
          fecha_inicio_inscripciones: '',
          fecha_fin_inscripciones: '',
          fecha_inicio_clases: '',
          fecha_fin_clases: '',
        })
        setModal('crear')
      }
    })
  }, [])

  function alumnosEnGrupo(gid) {
    return inscripciones.filter(i => i.grupo_id === gid && i.estado !== 'baja').length
  }
  function nombreIdioma(id) { return idiomas.find(x => x.id === id)?.nombre || '—' }
  function nombreNivel(id)  { return niveles.find(x => x.id === id)?.nombre || '—' }
  function nombrePlantel(id) { return planteles.find(x => x.id === id)?.nombre || '—' }
  function nombreProfesor(id) { return profesores.find(x => x.id === id)?.nombre || 'Sin asignar' }

  // Filtra idiomas por los que el plantel realmente ofrece (vía ofertas)
  const idiomasDelPlantel = form.plantel_id
    ? idiomas.filter(i => ofertas.some(o => o.plantel_id === form.plantel_id && o.idioma === i.nombre))
    : idiomas

  const nivelesDelIdioma = form.idioma_id
    ? niveles.filter(n => n.idioma_id === form.idioma_id)
    : []

  function abrirCrear() {
    setForm({
      idioma_id: '',
      nivel_id: '',
      plantel_id: usuario.plantel_id || '',
      profesor_id: '',
      codigo: '',
      horario: '',
      cupo: 20,
      fecha_inicio_inscripciones: '',
      fecha_fin_inscripciones: '',
      fecha_inicio_clases: '',
      fecha_fin_clases: '',
    })
    setModal('crear')
  }

  async function guardar() {
    if (!form.codigo || !form.idioma_id || !form.nivel_id || !form.plantel_id) {
      alert('Completa los campos requeridos: código, plantel, idioma y nivel.')
      return
    }
    try {
      if (modal === 'crear') await api.crearGrupo({ ...form, activo: true })
      else await api.actualizarGrupo(form.id, form)
      setModal(null)
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Grupos / Cohortes</h2>
        {tienePermiso(P.GRUPO_CREAR) && (
          <button className="btn-primario" onClick={abrirCrear}>+ Nuevo grupo</button>
        )}
      </div>

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Código</th><th>Idioma</th><th>Nivel</th><th>Plantel</th>
              <th>Profesor</th><th>Horario</th><th>Alumnos</th><th>Estado</th>
              <th>Inscripciones</th><th>Ciclo de clases</th>
              {tienePermiso(P.GRUPO_ASIGNAR) && <th></th>}
            </tr>
          </thead>
          <tbody>
            {grupos.map(g => (
              <tr key={g.id}>
                <td><strong>{g.codigo}</strong></td>
                <td>{nombreIdioma(g.idioma_id)}</td>
                <td>{nombreNivel(g.nivel_id)}</td>
                <td>{nombrePlantel(g.plantel_id)}</td>
                <td>{nombreProfesor(g.profesor_id)}</td>
                <td>{g.horario || '—'}</td>
                <td>{alumnosEnGrupo(g.id)} / {g.cupo}</td>
                <td>
                  <span className={'badge ' + (g.activo ? 'asignada' : 'baja')}>
                    {g.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {g.fecha_inicio_inscripciones || g.fecha_fin_inscripciones
                    ? <>{g.fecha_inicio_inscripciones || '—'} → {g.fecha_fin_inscripciones || '—'}</>
                    : <span className="texto-muted">Sin definir</span>}
                </td>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {g.fecha_inicio_clases || g.fecha_fin_clases
                    ? <>{g.fecha_inicio_clases || '—'} → {g.fecha_fin_clases || '—'}</>
                    : <span className="texto-muted">Sin definir</span>}
                </td>
                {tienePermiso(P.GRUPO_ASIGNAR) && (
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn-mini" onClick={() => { setForm({ ...g }); setModal('editar') }}>
                        Editar
                      </button>
                      {['superadmin', 'director', 'coordinador'].includes(usuario.rol) && (
                        <button className="btn-mini" style={{ background: '#2980b9', color: '#fff', borderColor: '#2980b9' }}
                          onClick={() => { setForm({ ...g }); setModal('fechas') }}>
                          📅 Fechas
                        </button>
                      )}
                      {ROLES_CHAT_GRUPAL.includes(usuario.rol) && (
                        <button className="btn-mini"
                          style={{ background: '#27ae60', color: '#fff', borderColor: '#27ae60' }}
                          onClick={() => navegar('mensajes', { grupoId: g.id })}
                          title="Abrir chat grupal">
                          💬 Chat
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {grupos.length === 0 && (
              <tr><td colSpan={11} className="tabla-vacio">Sin grupos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === 'fechas' && form.id && (
        <Modal titulo={`📅 Fechas del ciclo — ${form.codigo}`} onClose={() => setModal(null)} ancho={480}>
          <p className="texto-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Edita las fechas de inicio y fin de inscripciones y clases para este grupo.
          </p>
          <div className="form-grid">
            <label>Inicio de inscripciones
              <input type="date" value={form.fecha_inicio_inscripciones || ''}
                onChange={e => setForm({ ...form, fecha_inicio_inscripciones: e.target.value })} />
            </label>
            <label>Fin de inscripciones
              <input type="date" value={form.fecha_fin_inscripciones || ''}
                onChange={e => setForm({ ...form, fecha_fin_inscripciones: e.target.value })} />
            </label>
            <label>Inicio de clases
              <input type="date" value={form.fecha_inicio_clases || ''}
                onChange={e => setForm({ ...form, fecha_inicio_clases: e.target.value })} />
            </label>
            <label>Fin de clases
              <input type="date" value={form.fecha_fin_clases || ''}
                onChange={e => setForm({ ...form, fecha_fin_clases: e.target.value })} />
            </label>
          </div>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={async () => {
              try {
                await api.actualizarGrupo(form.id, {
                  fecha_inicio_inscripciones: form.fecha_inicio_inscripciones || null,
                  fecha_fin_inscripciones: form.fecha_fin_inscripciones || null,
                  fecha_inicio_clases: form.fecha_inicio_clases || null,
                  fecha_fin_clases: form.fecha_fin_clases || null,
                })
                setModal(null)
                await cargar()
              } catch (e) { alert('Error: ' + e.message) }
            }}>Guardar fechas</button>
          </div>
        </Modal>
      )}

      {modal && modal !== 'fechas' && (
        <Modal
          titulo={modal === 'crear' ? 'Nuevo grupo' : 'Editar grupo'}
          onClose={() => setModal(null)}
          ancho={620}
        >
          <div className="form-grid">
            <label>Código *
              <input
                value={form.codigo || ''}
                onChange={e => setForm({ ...form, codigo: e.target.value })}
                placeholder="ING-A1-01"
              />
            </label>
            <label>Plantel *
              <select
                value={form.plantel_id || ''}
                disabled={!!usuario.plantel_id}
                onChange={e => setForm({ ...form, plantel_id: e.target.value, idioma_id: '', nivel_id: '' })}
              >
                <option value="">Seleccionar…</option>
                {planteles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label>Idioma * {form.plantel_id && <small className="texto-muted">(del plantel seleccionado)</small>}
              <select
                value={form.idioma_id || ''}
                onChange={e => setForm({ ...form, idioma_id: e.target.value, nivel_id: '' })}
                disabled={!form.plantel_id}
              >
                <option value="">Seleccionar…</option>
                {idiomasDelPlantel.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </label>
            <label>Nivel *
              <select
                value={form.nivel_id || ''}
                onChange={e => setForm({ ...form, nivel_id: e.target.value })}
                disabled={!form.idioma_id}
              >
                <option value="">Seleccionar…</option>
                {nivelesDelIdioma.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
              </select>
            </label>
            <label>Profesor
              <select
                value={form.profesor_id || ''}
                onChange={e => setForm({ ...form, profesor_id: e.target.value })}
              >
                <option value="">Sin asignar</option>
                {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label>Cupo
              <input
                type="number"
                min="1"
                value={form.cupo || 20}
                onChange={e => setForm({ ...form, cupo: Number(e.target.value) })}
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>Horario
              <input
                value={form.horario || ''}
                onChange={e => setForm({ ...form, horario: e.target.value })}
                placeholder="Lun-Mié-Vie 9:00-10:30"
              />
            </label>
          </div>

          <h4 style={{ margin: '18px 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--texto-muted)' }}>
            Fechas del ciclo
          </h4>
          <div className="form-grid">
            <label>Inicio de inscripciones
              <input type="date" value={form.fecha_inicio_inscripciones || ''}
                onChange={e => setForm({ ...form, fecha_inicio_inscripciones: e.target.value })} />
            </label>
            <label>Fin de inscripciones
              <input type="date" value={form.fecha_fin_inscripciones || ''}
                onChange={e => setForm({ ...form, fecha_fin_inscripciones: e.target.value })} />
            </label>
            <label>Inicio de clases
              <input type="date" value={form.fecha_inicio_clases || ''}
                onChange={e => setForm({ ...form, fecha_inicio_clases: e.target.value })} />
            </label>
            <label>Fin de clases
              <input type="date" value={form.fecha_fin_clases || ''}
                onChange={e => setForm({ ...form, fecha_fin_clases: e.target.value })} />
            </label>
          </div>

          {!idiomasDelPlantel.length && form.plantel_id && (
            <div className="alerta info">
              Este plantel no tiene idiomas configurados aún. Ve a Idiomas y Niveles para agregarlos.
            </div>
          )}

          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardar}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
