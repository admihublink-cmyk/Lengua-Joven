import { useState, useEffect, useRef } from 'react'
import { useAuth, useNav } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

export default function Avisos() {
  const { usuario, tienePermiso } = useAuth()
  const { params } = useNav()
  const [avisos, setAvisos] = useState([])
  const [grupos, setGrupos] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titulo: '', contenido: '', plantel_id: '', grupo_id: '' })
  const [error, setError] = useState('')
  const [destacado, setDestacado] = useState(null)
  const avisosRef = useRef({})

  async function cargar() {
    try {
      const [a, g, p] = await Promise.all([
        api.getAvisos(),
        api.getGrupos(),
        api.getPlanteles(),
      ])
      setAvisos(a)
      setGrupos(g)
      setPlanteles(p)
    } catch (e) {
      console.error('Error cargando avisos:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (!params?.avisoId) return
    setDestacado(params.avisoId)
    const el = avisosRef.current[params.avisoId]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      const t = setTimeout(() => {
        const el2 = avisosRef.current[params.avisoId]
        if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 200)
      return () => clearTimeout(t)
    }
    const t2 = setTimeout(() => setDestacado(null), 3000)
    return () => clearTimeout(t2)
  }, [params?.avisoId])

  async function guardar() {
    setError('')
    if (!form.titulo.trim() || !form.contenido.trim()) {
      setError('Título y contenido son requeridos.')
      return
    }
    try {
      await api.crearAviso({ ...form, autor_id: usuario.id })
      setModal(false)
      setForm({ titulo: '', contenido: '', plantel_id: '', grupo_id: '' })
      await cargar()
    } catch (e) {
      setError('Error al publicar el aviso. Intenta de nuevo.')
    }
  }

  async function archivar(id) {
    await api.actualizarAviso(id, { activo: false })
    await cargar()
  }

  function nomPlantel(id) { return planteles.find(p => p.id === id)?.nombre || '—' }
  function nomGrupo(id) { return grupos.find(g => g.id === id)?.codigo || null }

  const canCreate = tienePermiso(P.AVISO_CREAR) || tienePermiso(P.AVISO_CREAR_GRUPO)

  return (
    <div>
      <div className="page-header">
        <h2>Avisos y Comunicados</h2>
        {canCreate && (
          <button className="btn-primario" onClick={() => {
            setForm({ titulo: '', contenido: '', plantel_id: usuario.plantel_id || '', grupo_id: '' })
            setModal(true)
          }}>+ Publicar aviso</button>
        )}
      </div>

      <div className="avisos-lista">
        {avisos.map(a => (
          <div
            key={a.id}
            ref={el => { avisosRef.current[a.id] = el }}
            className="aviso-card"
            style={destacado === a.id ? {
              outline: '2px solid var(--naranja)',
              outlineOffset: 2,
              boxShadow: '0 0 0 4px rgba(241,139,17,0.18)',
              transition: 'outline .2s, box-shadow .2s',
            } : {}}
          >
            <div className="aviso-head">
              <div>
                <h3>{a.titulo}</h3>
                <div className="aviso-meta">
                  <span>📅 {a.fecha}</span>
                  {a.plantel_id && <span>🏫 {nomPlantel(a.plantel_id)}</span>}
                  {a.grupo_id && <span>👥 {nomGrupo(a.grupo_id)}</span>}
                  {!a.plantel_id && !a.grupo_id && <span className="badge asignada">Global</span>}
                </div>
              </div>
              {tienePermiso(P.AVISO_CREAR) && (
                <button className="btn-mini rojo" onClick={() => archivar(a.id)}>Archivar</button>
              )}
            </div>
            <p className="aviso-contenido">{a.contenido}</p>
          </div>
        ))}
        {avisos.length === 0 && (
          <div className="card texto-muted" style={{ textAlign: 'center', padding: 40 }}>
            No hay avisos activos.
          </div>
        )}
      </div>

      {modal && (
        <Modal titulo="Publicar aviso" onClose={() => setModal(false)} ancho={620}>
          <label>Título *
            <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej. Inicio de ciclo agosto 2026" />
          </label>
          <label>Contenido *
            <textarea value={form.contenido} onChange={e => setForm({ ...form, contenido: e.target.value })}
              rows={5} placeholder="Escribe el comunicado aquí…" />
          </label>
          {tienePermiso(P.AVISO_CREAR) && (
            <label>Plantel (dejar vacío = global)
              <select value={form.plantel_id} onChange={e => setForm({ ...form, plantel_id: e.target.value })}>
                <option value="">Todos los planteles</option>
                {planteles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
          )}
          <label>Grupo específico (opcional)
            <select value={form.grupo_id} onChange={e => setForm({ ...form, grupo_id: e.target.value })}>
              <option value="">Todos los grupos</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.codigo}</option>)}
            </select>
          </label>
          {error && <p style={{ color: 'var(--rojo)', fontSize: 13, marginTop: 8 }}>{error}</p>}
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => { setModal(false); setError('') }}>Cancelar</button>
            <button className="btn-primario" onClick={guardar}>Publicar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
