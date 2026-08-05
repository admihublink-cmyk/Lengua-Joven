import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

export default function PlacementTest() {
  const { usuario, tienePermiso } = useAuth()
  const [placements, setPlacements] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [niveles, setNiveles] = useState([])
  const [idiomas, setIdiomas] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ alumno_id: '', idioma_id: '', nivel_sugerido: '', calificacion: '', notas: '' })

  async function cargar() {
    try {
      const params = usuario.rol === 'alumno' ? { alumno_id: usuario.id } : {}
      const [pl, u, i] = await Promise.all([
        api.getPlacements(params),
        api.getUsuarios(),
        api.getIdiomas(),
      ])
      setPlacements(pl)
      setUsuarios(u)
      setIdiomas(i)
      if (i.length > 0) {
        const todos = await Promise.all(i.map(id => api.getNiveles(id.id)))
        setNiveles(todos.flat())
      }
    } catch (e) {
      console.error('Error cargando placements:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  function nombre(id) { return usuarios.find(x => x.id === id)?.nombre || '—' }
  function nomNivel(id) { return niveles.find(x => x.id === id)?.nombre || '—' }
  const alumnos = usuarios.filter(u => u.rol === 'alumno')
  const nivelesDelIdioma = form.idioma_id ? niveles.filter(n => n.idioma_id === form.idioma_id) : []

  async function guardar() {
    if (!form.alumno_id || !form.nivel_sugerido || !form.calificacion) return alert('Completa todos los campos requeridos.')
    const cal = Number(form.calificacion)
    if (isNaN(cal)) return alert('Calificación inválida.')
    try {
      await api.crearPlacement({
        alumno_id: form.alumno_id,
        nivel_sugerido: form.nivel_sugerido,
        calificacion: cal,
        fecha: new Date().toISOString().slice(0, 10),
        aplicado_por: usuario.id,
        notas: form.notas,
      })
      setModal(false)
      setForm({ alumno_id: '', idioma_id: '', nivel_sugerido: '', calificacion: '', notas: '' })
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Placement Test</h2>
        {tienePermiso(P.PLACEMENT_APLICAR) && (
          <button className="btn-primario" onClick={() => setModal(true)}>+ Capturar resultado</button>
        )}
      </div>

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Alumno</th><th>Nivel asignado</th><th>Calificación</th><th>Fecha</th><th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {placements.map(pl => (
              <tr key={pl.id}>
                <td>{nombre(pl.alumno_id)}</td>
                <td><span className="badge validada">{nomNivel(pl.nivel_sugerido)}</span></td>
                <td><strong>{pl.calificacion}</strong>/100</td>
                <td>{pl.fecha}</td>
                <td className="texto-muted">{pl.notas || '—'}</td>
              </tr>
            ))}
            {placements.length === 0 && (
              <tr><td colSpan={5} className="tabla-vacio">Sin exámenes de placement registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal titulo="Capturar resultado de Placement Test" onClose={() => setModal(false)}>
          <label>Alumno *
            <select value={form.alumno_id} onChange={e => setForm({ ...form, alumno_id: e.target.value })}>
              <option value="">Seleccionar…</option>
              {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </label>
          <label>Idioma
            <select value={form.idioma_id} onChange={e => setForm({ ...form, idioma_id: e.target.value, nivel_sugerido: '' })}>
              <option value="">Seleccionar…</option>
              {idiomas.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </label>
          <label>Nivel sugerido *
            <select value={form.nivel_sugerido} onChange={e => setForm({ ...form, nivel_sugerido: e.target.value })}>
              <option value="">Seleccionar…</option>
              {nivelesDelIdioma.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
          </label>
          <label>Calificación (0–100) *
            <input type="number" min="0" max="100" value={form.calificacion}
              onChange={e => setForm({ ...form, calificacion: e.target.value })} />
          </label>
          <label>Notas
            <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
              placeholder="Observaciones del examinador…" rows={3} />
          </label>
          <div className="alerta info">
            Al guardar se registra el resultado del placement test.
          </div>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primario" onClick={guardar}>Guardar resultado</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
