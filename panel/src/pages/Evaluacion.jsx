import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

const TIPOS = ['diagnóstico', 'parcial', 'final', 'extraordinario']

export default function Evaluacion() {
  const { usuario, tienePermiso } = useAuth()
  const [grupos, setGrupos] = useState([])
  const [grupoSel, setGrupoSel] = useState('')
  const [evaluaciones, setEvaluaciones] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [tutorAlumnos, setTutorAlumnos] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ alumno_id: '', tipo: 'parcial', calificacion: '', observaciones: '' })

  async function cargar() {
    try {
      if (usuario.rol === 'tutor') {
        const [evs, mis] = await Promise.all([api.getEvaluaciones(), api.getMisAlumnos()])
        setEvaluaciones(evs)
        setTutorAlumnos(mis)
        return
      }
      const [g, u] = await Promise.all([api.getGrupos(), api.getUsuarios()])
      setGrupos(g)
      setUsuarios(u)
      if (!grupoSel && g.length > 0) setGrupoSel(g[0].id)
    } catch (e) {
      console.error('Error cargando evaluación:', e)
    }
  }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (usuario.rol === 'tutor' || !grupoSel) return
    async function cargarEval() {
      try {
        const [evs, ins] = await Promise.all([
          usuario.rol === 'alumno'
            ? api.getEvaluaciones()
            : api.getEvaluaciones({ grupo_id: grupoSel }),
          api.getInscripciones(),
        ])
        setEvaluaciones(evs)
        const lista = ins
          .filter(i => i.grupo_id === grupoSel)
          .map(i => {
            const u = usuarios.find(x => x.id === i.alumno_id)
            return { id: i.alumno_id, nombre: u?.nombre || i.nombre_externo || 'Sin nombre' }
          }).filter(a => a.id)
        setAlumnos(lista)
      } catch (e) {
        console.error('Error cargando evaluaciones del grupo:', e)
      }
    }
    cargarEval()
  }, [grupoSel, usuarios])

  function nombreAlumno(id) {
    if (usuario.rol === 'tutor') return tutorAlumnos.find(x => x.id === id)?.nombre || id || '—'
    return usuarios.find(x => x.id === id)?.nombre || id || '—'
  }

  async function guardar() {
    if (!form.alumno_id || !form.calificacion) return alert('Selecciona alumno y calificación.')
    const cal = Number(form.calificacion)
    if (isNaN(cal) || cal < 0 || cal > 100) return alert('Calificación debe ser entre 0 y 100.')
    try {
      await api.crearEvaluacion({
        ...form, calificacion: cal, grupo_id: grupoSel,
        fecha: new Date().toISOString().slice(0, 10),
        registrado_por: usuario.id,
      })
      setModal(false)
      setForm({ alumno_id: '', tipo: 'parcial', calificacion: '', observaciones: '' })
      // Recargar evaluaciones
      const evs = await api.getEvaluaciones({ grupo_id: grupoSel })
      setEvaluaciones(evs)
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  const evsGrupo = evaluaciones.filter(e => !grupoSel || e.grupo_id === grupoSel)

  return (
    <div>
      <div className="page-header">
        <h2>Evaluación</h2>
        {tienePermiso(P.EVAL_REGISTRAR) && (
          <button className="btn-primario" onClick={() => setModal(true)}>+ Registrar evaluación</button>
        )}
      </div>

      {!['alumno', 'tutor'].includes(usuario.rol) && (
        <div className="filtros-bar">
          <label>Grupo
            <select value={grupoSel} onChange={e => setGrupoSel(e.target.value)}>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.codigo}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Alumno</th><th>Tipo</th><th>Calificación</th><th>Fecha</th><th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {evsGrupo.map(e => (
              <tr key={e.id}>
                <td>{nombreAlumno(e.alumno_id)}</td>
                <td><span className="badge nueva">{e.tipo}</span></td>
                <td>
                  <span className={`calificacion ${e.calificacion >= 70 ? 'aprobado' : 'reprobado'}`}>
                    {e.calificacion}
                  </span>
                </td>
                <td>{e.fecha}</td>
                <td className="texto-muted">{e.observaciones || '—'}</td>
              </tr>
            ))}
            {evsGrupo.length === 0 && (
              <tr><td colSpan={5} className="tabla-vacio">Sin evaluaciones registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal titulo="Registrar evaluación" onClose={() => setModal(false)}>
          <label>Alumno *
            <select value={form.alumno_id} onChange={e => setForm({ ...form, alumno_id: e.target.value })}>
              <option value="">Seleccionar…</option>
              {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </label>
          <label>Tipo de evaluación
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>Calificación (0–100) *
            <input type="number" min="0" max="100" value={form.calificacion}
              onChange={e => setForm({ ...form, calificacion: e.target.value })} />
          </label>
          <label>Observaciones
            <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })}
              placeholder="Notas opcionales…" rows={3} />
          </label>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primario" onClick={guardar}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
