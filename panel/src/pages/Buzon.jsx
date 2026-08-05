import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

const ESTADOS_LABEL = { nueva: 'Nueva', en_revision: 'En revisión', resuelta: 'Resuelta' }
const ESTADOS = ['nueva', 'en_revision', 'resuelta']
const TIPO_LABEL = { queja: '⚠️ Queja', sugerencia: '💡 Sugerencia' }

export default function Buzon() {
  const { usuario, tienePermiso } = useAuth()
  const [items, setItems] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [modal, setModal] = useState(false)
  const [sel, setSel] = useState(null)
  const [respuestaTxt, setRespuestaTxt] = useState('')
  const [form, setForm] = useState({ tipo: 'sugerencia', asunto: '', mensaje: '', anonimo: false })
  const [error, setError] = useState('')

  const puedeGestionar = tienePermiso(P.BUZON_GESTIONAR)

  async function cargar() {
    try {
      const [b, u, p] = await Promise.all([
        api.getBuzon(),
        api.getUsuarios(),
        api.getPlanteles(),
      ])
      setItems(b)
      setUsuarios(u)
      setPlanteles(p)
    } catch (e) {
      console.error('Error cargando buzón:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  function nombreAutor(item) {
    if (item.anonimo) return 'Anónimo'
    return usuarios.find(u => u.id === item.autor_id)?.nombre || '—'
  }
  function nombrePlantel(id) { return planteles.find(p => p.id === id)?.nombre || '—' }

  async function enviar() {
    setError('')
    if (!form.asunto.trim() || !form.mensaje.trim()) {
      setError('El asunto y el mensaje son requeridos.')
      return
    }
    try {
      await api.crearBuzon({
        tipo: form.tipo,
        asunto: form.asunto.trim(),
        mensaje: form.mensaje.trim(),
        anonimo: form.anonimo,
        autor_id: form.anonimo ? null : usuario.id,
        plantel_id: usuario.plantel_id || null,
      })
      setModal(false)
      setForm({ tipo: 'sugerencia', asunto: '', mensaje: '', anonimo: false })
      await cargar()
    } catch (e) {
      setError('Error al enviar. Intenta de nuevo.')
    }
  }

  function abrirDetalle(item) {
    setSel(item)
    setRespuestaTxt(item.respuesta || '')
  }

  async function guardarRespuesta(nuevoEstado) {
    try {
      await api.responderBuzon(sel.id, {
        respuesta: respuestaTxt,
        estado: nuevoEstado || sel.estado,
        respondido_por: usuario.id,
        fecha_respuesta: new Date().toISOString(),
      })
      setSel(null)
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  const filtrados = items.filter(i => {
    if (filtroEstado !== 'todos' && i.estado !== filtroEstado) return false
    if (filtroTipo !== 'todos' && i.tipo !== filtroTipo) return false
    return true
  }).sort((a, b) => (b.fecha || b.creado_en || '').localeCompare(a.fecha || a.creado_en || ''))

  return (
    <div>
      <div className="page-header">
        <h2>Buzón de Quejas y Sugerencias</h2>
        <button className="btn-primario" onClick={() => { setForm({ tipo: 'sugerencia', asunto: '', mensaje: '', anonimo: false }); setError(''); setModal(true) }}>
          + Nueva queja / sugerencia
        </button>
      </div>

      {puedeGestionar && (
        <div className="filtros-bar">
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            <option value="queja">Quejas</option>
            <option value="sugerencia">Sugerencias</option>
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{ESTADOS_LABEL[e]}</option>)}
          </select>
        </div>
      )}

      <div className="avisos-lista">
        {filtrados.map(item => (
          <div key={item.id} className="aviso-card" style={{ cursor: puedeGestionar ? 'pointer' : 'default' }}
            onClick={() => puedeGestionar && abrirDetalle(item)}>
            <div className="aviso-head">
              <div>
                <h3>{TIPO_LABEL[item.tipo]} · {item.asunto}</h3>
                <div className="aviso-meta">
                  <span>📅 {new Date(item.fecha || item.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span>🙋 {nombreAutor(item)}</span>
                  {puedeGestionar && item.plantel_id && <span>🏫 {nombrePlantel(item.plantel_id)}</span>}
                </div>
              </div>
              <span className={`badge buzon-${item.estado}`}>{ESTADOS_LABEL[item.estado]}</span>
            </div>
            <p className="aviso-contenido">{item.mensaje}</p>
            {item.respuesta && (
              <div className="alerta verde" style={{ marginTop: 10 }}>
                <strong>Respuesta:</strong> {item.respuesta}
              </div>
            )}
          </div>
        ))}
        {filtrados.length === 0 && (
          <div className="card texto-muted" style={{ textAlign: 'center', padding: 40 }}>
            No hay quejas ni sugerencias {puedeGestionar ? 'registradas' : 'enviadas por ti'} todavía.
          </div>
        )}
      </div>

      {modal && (
        <Modal titulo="Nueva queja o sugerencia" onClose={() => setModal(false)} ancho={560}>
          <label>Tipo *
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option value="sugerencia">💡 Sugerencia</option>
              <option value="queja">⚠️ Queja</option>
            </select>
          </label>
          <label>Asunto *
            <input value={form.asunto} onChange={e => setForm({ ...form, asunto: e.target.value })}
              placeholder="Resume tu queja o sugerencia en pocas palabras" />
          </label>
          <label>Mensaje *
            <textarea rows={5} value={form.mensaje} onChange={e => setForm({ ...form, mensaje: e.target.value })}
              placeholder="Describe con detalle tu queja o sugerencia…" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
            <input type="checkbox" checked={form.anonimo} style={{ width: 'auto' }}
              onChange={e => setForm({ ...form, anonimo: e.target.checked })} />
            Enviar de forma anónima
          </label>
          {error && <p style={{ color: 'var(--rojo)', fontSize: 13, marginTop: 8 }}>{error}</p>}
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primario" onClick={enviar}>Enviar</button>
          </div>
        </Modal>
      )}

      {sel && (
        <Modal titulo={`${TIPO_LABEL[sel.tipo]} · ${sel.asunto}`} onClose={() => setSel(null)} ancho={560}>
          <div className="detalle-grid">
            <div><label>Autor</label><p>{nombreAutor(sel)}</p></div>
            <div><label>Fecha</label><p>{new Date(sel.fecha || sel.creado_en).toLocaleDateString('es-MX')}</p></div>
            <div style={{ gridColumn: '1/-1' }}><label>Mensaje</label><p>{sel.mensaje}</p></div>
          </div>
          <label>Respuesta / seguimiento
            <textarea rows={4} value={respuestaTxt} onChange={e => setRespuestaTxt(e.target.value)}
              placeholder="Escribe la respuesta o acción tomada…" />
          </label>
          <div className="modal-acciones" style={{ flexWrap: 'wrap' }}>
            <button className="btn-sec" onClick={() => setSel(null)}>Cerrar</button>
            <button className="btn-sec" onClick={() => guardarRespuesta('en_revision')}>Marcar en revisión</button>
            <button className="btn-primario" onClick={() => guardarRespuesta('resuelta')}>Guardar y marcar resuelta</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
