import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

export default function Planteles() {
  const { usuario, tienePermiso } = useAuth()
  const [planteles, setPlanteles] = useState([])
  const [idiomas, setIdiomas] = useState([])
  const [grupos, setGrupos] = useState([])
  const [ofertas, setOfertas] = useState([])
  const [niveles, setNiveles] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ nombre: '', ciudad: '' })

  async function cargar() {
    try {
      const [p, i, g, o] = await Promise.all([
        api.getPlanteles(),
        api.getIdiomas(),
        api.getGrupos(),
        api.getOfertas(),
      ])
      setPlanteles(p)
      setIdiomas(i)
      setGrupos(g)
      setOfertas(o)
      // Cargar todos los niveles de todos los idiomas
      if (i.length > 0) {
        const todos = await Promise.all(i.map(id => api.getNiveles(id.id)))
        setNiveles(todos.flat())
      }
    } catch (e) {
      console.error('Error cargando planteles:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  function abrirCrear() { setForm({ nombre: '', ciudad: '' }); setModal('crear') }
  function abrirEditar(p) { setForm({ nombre: p.nombre, ciudad: p.ciudad, id: p.id }); setModal('editar') }

  async function guardar() {
    if (!form.nombre.trim()) return
    try {
      if (modal === 'crear') await api.crearPlantel({ nombre: form.nombre, ciudad: form.ciudad })
      else await api.actualizarPlantel(form.id, { nombre: form.nombre, ciudad: form.ciudad })
      setModal(null)
      await cargar()
    } catch (e) {
      console.error('Error guardando plantel:', e)
    }
  }

  function idiomasDelPlantel(plantelId) {
    const vistos = new Set()
    const resultado = []

    // 1. Directamente asignados (idiomas.plantel_id)
    for (const i of idiomas.filter(i => i.plantel_id === plantelId)) {
      if (!vistos.has(i.id)) { vistos.add(i.id); resultado.push(i) }
    }
    // 2. Desde grupos (idioma_id → objeto idioma)
    for (const g of grupos.filter(g => g.plantel_id === plantelId && g.idioma_id)) {
      if (!vistos.has(g.idioma_id)) {
        const obj = idiomas.find(i => i.id === g.idioma_id)
        if (obj) { vistos.add(g.idioma_id); resultado.push(obj) }
      }
    }
    // 3. Desde ofertas (idioma como string → objeto idioma por nombre)
    for (const o of ofertas.filter(o => o.plantel_id === plantelId && o.idioma)) {
      const obj = idiomas.find(i => i.nombre === o.idioma)
      if (obj && !vistos.has(obj.id)) { vistos.add(obj.id); resultado.push(obj) }
      // Si no hay objeto idioma con ese nombre, crear uno virtual para mostrar
      else if (!obj) {
        const key = 'virtual_' + o.idioma
        if (!vistos.has(key)) { vistos.add(key); resultado.push({ id: key, nombre: o.idioma, virtual: true }) }
      }
    }
    return resultado
  }
  function gruposActivos(idioma, plantelId) {
    if (idioma.virtual) {
      // Idioma viene de ofertas — buscar ofertas de ese plantel+nombre
      return ofertas
        .filter(o => o.plantel_id === plantelId && o.idioma === idioma.nombre)
        .map(o => ({ id: o.id, horario: o.horario, cupo: null, nivel_id: null, codigo: o.nivel || o.sistema || '' }))
    }
    return grupos.filter(g => g.idioma_id === idioma.id && g.plantel_id === plantelId && g.activo)
  }
  function nomNivel(nivel_id) {
    return niveles.find(n => n.id === nivel_id)?.nombre || ''
  }

  const esAlumno = usuario.rol === 'alumno'

  return (
    <div>
      <div className="page-header">
        <h2>Planteles</h2>
        {tienePermiso(P.PLAN_CREAR) && (
          <button className="btn-primario" onClick={abrirCrear}>+ Nuevo plantel</button>
        )}
      </div>

      {esAlumno && (
        <p className="texto-muted" style={{ marginBottom: 16, fontSize: 13 }}>
          Consulta los idiomas, horarios y modalidad disponibles en cada plantel.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {planteles.map(p => {
          const idiomasList = idiomasDelPlantel(p.id)
          return (
            <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--borde)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 32 }}>🏫</div>
                  <div>
                    <h3 style={{ margin: 0 }}>{p.nombre}</h3>
                    <p className="texto-muted" style={{ margin: 0, fontSize: 13 }}>📍 {p.ciudad}</p>
                  </div>
                </div>
                {tienePermiso(P.PLAN_EDITAR) && (
                  <button className="btn-sec" onClick={() => abrirEditar(p)}>Editar</button>
                )}
              </div>

              {idiomasList.length === 0 ? (
                <div style={{ padding: '16px 20px' }}>
                  <p className="texto-muted chico">Sin idiomas registrados en este plantel.</p>
                </div>
              ) : (
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--texto-muted)', marginBottom: 12 }}>
                    Idiomas disponibles
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {idiomasList.map(idioma => {
                      const gps = gruposActivos(idioma, p.id)
                      return (
                        <div key={idioma.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--naranja)' }}>
                              🌐 {idioma.nombre}
                            </span>
                            <span className="texto-muted chico">({gps.length} grupo{gps.length !== 1 ? 's' : ''} activo{gps.length !== 1 ? 's' : ''})</span>
                          </div>
                          {gps.length === 0 ? (
                            <p className="texto-muted chico" style={{ paddingLeft: 22 }}>Sin grupos activos por el momento.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {gps.map(g => (
                                <div key={g.id} style={{
                                  display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap',
                                  paddingLeft: 22, fontSize: 13
                                }}>
                                  <span style={{ color: 'var(--texto-muted)', minWidth: 90 }}>
                                    📚 {nomNivel(g.nivel_id) || g.codigo}
                                  </span>
                                  <span>🕐 {g.horario || 'Horario por definir'}</span>
                                  <span className="badge asignada" style={{ fontSize: 11 }}>Presencial</span>
                                  {g.cupo != null && (
                                    <span className="texto-muted" style={{ fontSize: 11 }}>Cupo: {g.cupo}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {planteles.length === 0 && <p className="texto-muted">Sin planteles registrados.</p>}
      </div>

      {modal && (
        <Modal titulo={modal === 'crear' ? 'Nuevo plantel' : 'Editar plantel'} onClose={() => setModal(null)}>
          <label>Nombre del plantel
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Plantel Monterrey Centro" />
          </label>
          <label>Ciudad
            <input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} placeholder="Ej. Monterrey" />
          </label>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardar}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
