import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

export default function Idiomas() {
  const { usuario, tienePermiso } = useAuth()
  const [idiomas, setIdiomas] = useState([])
  const [niveles, setNiveles] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const plantelDefault = usuario.plantel_id || ''
  const [plantelFiltro, setPlantelFiltro] = useState(plantelDefault)

  async function cargar() {
    try {
      const [i, p] = await Promise.all([api.getIdiomas(), api.getPlanteles()])
      setIdiomas(i)
      setPlanteles(p)
      if (i.length > 0) {
        const todos = await Promise.all(i.map(id => api.getNiveles(id.id)))
        setNiveles(todos.flat())
      }
    } catch (e) {
      console.error('Error cargando idiomas:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  const idiomasFiltrados = plantelFiltro
    ? idiomas.filter(i => i.plantel_id === plantelFiltro)
    : idiomas

  function nivelesDeIdioma(id) {
    return niveles.filter(n => n.idioma_id === id).sort((a, b) => a.orden - b.orden)
  }
  function nombrePlantel(id) {
    return planteles.find(p => p.id === id)?.nombre || id
  }

  function abrirCrearIdioma() {
    setForm({ nombre: '', plantel_id: plantelFiltro || '' })
    setModal('idioma')
  }

  async function guardarIdioma() {
    if (!form.nombre?.trim() || !form.plantel_id) {
      alert('Ingresa el nombre del idioma y selecciona el plantel.')
      return
    }
    try {
      await api.crearIdioma({ nombre: form.nombre.trim(), plantel_id: form.plantel_id })
      setModal(null)
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  function abrirCrearNivel(idiomaId) {
    setForm({
      nombre: '',
      orden: nivelesDeIdioma(idiomaId).length + 1,
      idioma_id: idiomaId,
    })
    setModal('nivel')
  }

  async function guardarNivel() {
    if (!form.nombre?.trim()) return
    try {
      await api.crearNivel(form.idioma_id, { nombre: form.nombre.trim(), orden: form.orden })
      setModal(null)
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  async function eliminarIdioma(id, nombre) {
    if (!confirm(`¿Eliminar "${nombre}" y todos sus niveles?`)) return
    try {
      await api.eliminarIdioma(id)
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Idiomas y Niveles</h2>
        {tienePermiso(P.IDIOMA_CONFIG) && (
          <button className="btn-primario" onClick={abrirCrearIdioma}>+ Idioma</button>
        )}
      </div>

      <div className="plantel-tabs">
        {!usuario.plantel_id && (
          <button
            className={`plantel-tab ${plantelFiltro === '' ? 'activo' : ''}`}
            onClick={() => setPlantelFiltro('')}
          >
            Todos los planteles
          </button>
        )}
        {planteles.map(p => (
          <button
            key={p.id}
            className={`plantel-tab ${plantelFiltro === p.id ? 'activo' : ''}`}
            onClick={() => setPlantelFiltro(p.id)}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {idiomasFiltrados.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--texto-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
          Este plantel aún no tiene idiomas configurados.
          {tienePermiso(P.IDIOMA_CONFIG) && (
            <div style={{ marginTop: 12 }}>
              <button className="btn-primario" onClick={abrirCrearIdioma}>Agregar idioma</button>
            </div>
          )}
        </div>
      )}

      <div className="card-grid">
        {idiomasFiltrados.map(id => (
          <div key={id.id} className="card">
            <div className="card-head-row">
              <h3>🌐 {id.nombre}</h3>
              {tienePermiso(P.IDIOMA_CONFIG) && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-mini" onClick={() => abrirCrearNivel(id.id)}>+ Nivel</button>
                  <button className="btn-mini rojo" onClick={() => eliminarIdioma(id.id, id.nombre)}>✕</button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 10 }}>
              <span className="badge nueva" style={{ fontSize: 11 }}>
                📍 {nombrePlantel(id.plantel_id)}
              </span>
            </div>

            <div className="niveles-lista">
              {nivelesDeIdioma(id.id).map(n => (
                <div key={n.id} className="nivel-chip">{n.nombre}</div>
              ))}
              {nivelesDeIdioma(id.id).length === 0 && (
                <p className="texto-muted chico">Sin niveles configurados.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal === 'idioma' && (
        <Modal titulo="Nuevo idioma" onClose={() => setModal(null)}>
          <label>Plantel *
            <select
              value={form.plantel_id || ''}
              onChange={e => setForm({ ...form, plantel_id: e.target.value })}
              disabled={!!usuario.plantel_id}
            >
              <option value="">Seleccionar plantel…</option>
              {planteles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label>Nombre del idioma *
            <input
              value={form.nombre || ''}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej. Inglés, Francés, Alemán…"
            />
          </label>
          <div className="alerta info">
            Cada plantel mantiene su propio catálogo de idiomas y puede usar escalas de nivel distintas.
          </div>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardarIdioma}>Guardar</button>
          </div>
        </Modal>
      )}

      {modal === 'nivel' && (
        <Modal titulo="Nuevo nivel" onClose={() => setModal(null)}>
          <label>Nombre del nivel *
            <input
              value={form.nombre || ''}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej. A1 — Básico, Nivel 1, Principiante…"
            />
          </label>
          <label>Orden
            <input
              type="number"
              min="1"
              value={form.orden || 1}
              onChange={e => setForm({ ...form, orden: Number(e.target.value) })}
            />
          </label>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardarNivel}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
