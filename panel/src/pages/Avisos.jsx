import { useState, useEffect, useRef } from 'react'
import { useAuth, useNav } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

const ROL_LABEL = {
  superadmin: 'Super Admin',
  coordinador: 'Coordinador',
  director: 'Director',
  profesor: 'Maestro',
  alumno: 'Alumno',
}

function fechaHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const MAX_PDF_MB = 8

function leerArchivoPDF(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_PDF_MB * 1024 * 1024) return reject(new Error(`El archivo no debe superar ${MAX_PDF_MB} MB`))
    if (file.type !== 'application/pdf') return reject(new Error('Solo se permiten archivos PDF'))
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result) // data:application/pdf;base64,...
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsDataURL(file)
  })
}

async function descargarAdjunto(avisoId, nombre) {
  try {
    const { datos } = await api.getAvisoAdjunto(avisoId)
    const link = document.createElement('a')
    link.href = datos
    link.download = nombre
    link.click()
  } catch { alert('No se pudo descargar el adjunto') }
}

export default function Avisos() {
  const { usuario, tienePermiso } = useAuth()
  const { params } = useNav()
  const [avisos, setAvisos] = useState([])
  const [grupos, setGrupos] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null) // id del aviso que se edita
  const [form, setForm] = useState({ titulo: '', contenido: '', plantel_id: '', grupo_id: '' })
  const [adjunto, setAdjunto] = useState(null) // { nombre, base64 }
  const [error, setError] = useState('')
  const [destacado, setDestacado] = useState(null)
  const avisosRef = useRef({})

  async function cargar() {
    const [a, g, p] = await Promise.all([
      api.getAvisos().catch(() => []),
      api.getGrupos().catch(() => []),
      api.getPlanteles().catch(() => []),
    ])
    setAvisos(a)
    setGrupos(g)
    setPlanteles(p)
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
      if (editando) {
        await api.actualizarAviso(editando, { titulo: form.titulo, contenido: form.contenido })
      } else {
        await api.crearAviso({
          ...form,
          autor_id: usuario.id,
          adjunto_nombre: adjunto?.nombre || null,
          adjunto_base64: adjunto?.base64 || null,
        })
      }
      setModal(false)
      setEditando(null)
      setForm({ titulo: '', contenido: '', plantel_id: '', grupo_id: '' })
      setAdjunto(null)
      await cargar()
    } catch (e) {
      setError('Error al guardar el aviso. Intenta de nuevo.')
    }
  }

  async function manejarArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return setAdjunto(null)
    try {
      const base64 = await leerArchivoPDF(file)
      setAdjunto({ nombre: file.name, base64 })
      setError('')
    } catch (err) {
      setError(err.message)
      e.target.value = ''
    }
  }

  function abrirEditar(a) {
    setForm({ titulo: a.titulo, contenido: a.contenido, plantel_id: a.plantel_id || '', grupo_id: a.grupo_id || '' })
    setEditando(a.id)
    setError('')
    setAdjunto(null)
    setModal(true)
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
            setEditando(null)
            setForm({ titulo: '', contenido: '', plantel_id: usuario.plantel_id || '', grupo_id: '' })
            setError('')
            setModal(true)
          }}>+ Publicar aviso</button>
        )}
      </div>

      <div className="avisos-lista">
        {avisos.map(a => {
          const esMio = a.creado_por === usuario.id
          const puedeEditar = esMio || tienePermiso(P.AVISO_CREAR)
          return (
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
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{a.titulo}</h3>
                    {a.editado_en && (
                      <span style={{ fontSize: 11, color: '#888', background: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: '2px 8px' }}>
                        Editado
                      </span>
                    )}
                  </div>
                  <div className="aviso-meta">
                    {a.autor_nombre && (
                      <span>👤 {a.autor_nombre}{a.autor_rol && (
                        <span style={{ marginLeft: 4, fontSize: 10, background: 'rgba(241,139,17,0.12)', color: '#c47209', borderRadius: 8, padding: '1px 7px', fontWeight: 600, letterSpacing: 0.2 }}>
                          {ROL_LABEL[a.autor_rol] || a.autor_rol}
                        </span>
                      )}</span>
                    )}
                    <span>📅 {fechaHora(a.creado_en) || a.fecha}</span>
                    {a.plantel_id && <span>🏫 {nomPlantel(a.plantel_id)}</span>}
                    {a.grupo_id && <span>👥 {nomGrupo(a.grupo_id)}</span>}
                    {!a.plantel_id && !a.grupo_id && <span className="badge asignada">Global</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {puedeEditar && (
                    <button className="btn-mini" onClick={() => abrirEditar(a)}>Editar</button>
                  )}
                  {tienePermiso(P.AVISO_CREAR) && (
                    <button className="btn-mini rojo" onClick={() => archivar(a.id)}>Archivar</button>
                  )}
                </div>
              </div>
              <p className="aviso-contenido">{a.contenido}</p>
              {a.adjunto_nombre && (
                <button onClick={() => descargarAdjunto(a.id, a.adjunto_nombre)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: 'rgba(241,139,17,.1)', border: '1.5px solid rgba(241,139,17,.3)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: '#c47209', fontWeight: 600 }}>
                  📎 {a.adjunto_nombre}
                </button>
              )}
            </div>
          )
        })}
        {avisos.length === 0 && (
          <div className="card texto-muted" style={{ textAlign: 'center', padding: 40 }}>
            No hay avisos activos.
          </div>
        )}
      </div>

      {modal && (
        <Modal titulo={editando ? 'Editar aviso' : 'Publicar aviso'} onClose={() => { setModal(false); setEditando(null) }} ancho={620}>
          <label>Título *
            <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej. Inicio de ciclo agosto 2026" />
          </label>
          <label>Contenido *
            <textarea value={form.contenido} onChange={e => setForm({ ...form, contenido: e.target.value })}
              rows={5} placeholder="Escribe el comunicado aquí…" />
          </label>
          {!editando && tienePermiso(P.AVISO_CREAR) && (
            <label>Plantel (dejar vacío = global)
              <select value={form.plantel_id} onChange={e => setForm({ ...form, plantel_id: e.target.value })}>
                <option value="">Todos los planteles</option>
                {planteles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
          )}
          {!editando && (
            <label>Grupo específico (opcional)
              <select value={form.grupo_id} onChange={e => setForm({ ...form, grupo_id: e.target.value })}>
                <option value="">Todos los grupos</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.codigo}</option>)}
              </select>
            </label>
          )}
          {!editando && (
            <label>Adjunto PDF (opcional, máx. {MAX_PDF_MB} MB)
              <input type="file" accept="application/pdf" onChange={manejarArchivo} />
              {adjunto && (
                <span style={{ fontSize: 12, color: '#27ae60', marginTop: 4, display: 'block' }}>
                  ✓ {adjunto.nombre}
                  <button onClick={() => setAdjunto(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12 }}>✕ quitar</button>
                </span>
              )}
            </label>
          )}
          {error && <p style={{ color: 'var(--rojo)', fontSize: 13, marginTop: 8 }}>{error}</p>}
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => { setModal(false); setEditando(null); setError(''); setAdjunto(null) }}>Cancelar</button>
            <button className="btn-primario" onClick={guardar}>{editando ? 'Guardar cambios' : 'Publicar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
