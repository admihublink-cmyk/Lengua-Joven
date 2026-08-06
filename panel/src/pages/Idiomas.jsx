import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

const MODALIDAD_COLOR = {
  'Presencial': '#f18b11',
  'En Línea': '#2980b9',
  'Autodidacta': '#27ae60',
}

function fmtFecha(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`
}

export default function Idiomas() {
  const { usuario, tienePermiso } = useAuth()
  const [ofertas, setOfertas]   = useState([])
  const [idiomas, setIdiomas]   = useState([])
  const [planteles, setPlanteles] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [plantelFiltro, setPlantelFiltro] = useState(usuario.plantel_id || '')
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState({})
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    try {
      const [o, i, p] = await Promise.all([
        api.getOfertas(),
        fetch('/api/publico/idiomas').then(r => r.json()),
        api.getPlanteles(),
      ])
      setOfertas(o)
      setIdiomas(i)
      // Coordinadores solo ven y editan su propio plantel
      const visibles = usuario.rol === 'coordinador' && usuario.plantel_id
        ? p.filter(pl => pl.id === usuario.plantel_id)
        : p
      setPlanteles(visibles)
      const perAll = await Promise.all(p.map(pl => api.getPeriodos({ plantel_id: pl.id })))
      setPeriodos(perAll.flat())
    } catch (e) { console.error(e) }
  }

  useEffect(() => { cargar() }, [])

  // Idiomas únicos que ofrece un plantel (desde ofertas)
  function idiomasDelPlantel(plantelId) {
    const vistos = new Set()
    return ofertas
      .filter(o => o.plantel_id === plantelId)
      .filter(o => { if (vistos.has(o.idioma)) return false; vistos.add(o.idioma); return true })
  }

  function periodoDe(plantelId, idiomaNombre) {
    const rec = idiomas.find(i => i.nombre === idiomaNombre)
    if (!rec) return null
    return periodos.find(p => p.plantel_id === plantelId && p.idioma_id === rec.id) || null
  }

  function abrirModal(plantel, idiomaNombre) {
    const rec = idiomas.find(i => i.nombre === idiomaNombre)
    const per = periodoDe(plantel.id, idiomaNombre)
    setForm({
      plantel_id: plantel.id, plantel_nombre: plantel.nombre,
      idioma_nombre: idiomaNombre, idioma_id: rec?.id || null,
      periodo_id: per?.id || null,
      ciclo:               per?.ciclo               || '',
      inicio_prereg:       per?.inicio_prereg        || '',
      fin_prereg:          per?.fin_prereg           || '',
      fecha_examen:        per?.fecha_examen         || '',
      fecha_asignacion:    per?.fecha_asignacion     || '',
      fecha_inicio_clases: per?.fecha_inicio_clases  || '',
    })
    setModal('periodo')
  }

  async function guardar() {
    if (!form.idioma_id) return
    setGuardando(true)
    try {
      const payload = {
        plantel_id: form.plantel_id, idioma_id: form.idioma_id,
        ciclo:               form.ciclo               || null,
        inicio_prereg:       form.inicio_prereg        || null,
        fin_prereg:          form.fin_prereg           || null,
        fecha_examen:        form.fecha_examen         || null,
        fecha_asignacion:    form.fecha_asignacion     || null,
        fecha_inicio_clases: form.fecha_inicio_clases  || null,
      }
      if (form.periodo_id) await api.actualizarPeriodo(form.periodo_id, payload)
      else                 await api.crearPeriodo(payload)
      setModal(null)
      await cargar()
    } catch (e) { alert('Error: ' + e.message) }
    finally { setGuardando(false) }
  }

  async function eliminar() {
    if (!form.periodo_id || !confirm('¿Eliminar este período?')) return
    try { await api.eliminarPeriodo(form.periodo_id); setModal(null); await cargar() }
    catch (e) { alert('Error: ' + e.message) }
  }

  const puedeEditar = tienePermiso(P.IDIOMA_CONFIG)

  function TarjetaIdioma({ plantel, oferta }) {
    const per = periodoDe(plantel.id, oferta.idioma)
    const color = MODALIDAD_COLOR[oferta.modalidad] || '#888'
    return (
      <div className="card">
        <div className="card-head-row">
          <h3 style={{ fontSize: 15 }}>🌐 {oferta.idioma}</h3>
          {puedeEditar && (
            <button className="btn-mini" onClick={() => abrirModal(plantel, oferta.idioma)}>
              📅 {per ? 'Editar período' : 'Configurar período'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ background: color + '22', color, borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
            {oferta.modalidad === 'Presencial' ? '🏫' : '💻'} {oferta.modalidad}
          </span>
          {oferta.categoria && (
            <span style={{ background: '#fff4e0', color: '#f18b11', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
              {oferta.categoria}
            </span>
          )}
        </div>

        {per ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {per.ciclo && (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f18b11', marginBottom: 2 }}>Ciclo {per.ciclo}</div>
            )}
            {[
              { label: 'Pre-registro', value: per.inicio_prereg ? `${fmtFecha(per.inicio_prereg)}${per.fin_prereg ? ' – ' + fmtFecha(per.fin_prereg) : ''}` : null },
              { label: 'Examen ubic.',  value: fmtFecha(per.fecha_examen) },
              { label: 'Asignación',   value: fmtFecha(per.fecha_asignacion) },
              { label: 'Inicio clases',value: fmtFecha(per.fecha_inicio_clases) },
            ].map(({ label, value }) => value ? (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#888' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ) : null)}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>
            {puedeEditar ? 'Sin período configurado — haz clic en "Configurar período".' : 'Sin período de inscripción configurado.'}
          </p>
        )}
      </div>
    )
  }

  const plantelActual = planteles.find(p => p.id === plantelFiltro)
  const idiomasActuales = plantelFiltro ? idiomasDelPlantel(plantelFiltro) : []

  return (
    <div>
      <div className="page-header">
        <h2>Idiomas y Períodos</h2>
      </div>

      {/* Tabs de planteles */}
      <div className="plantel-tabs">
        {!usuario.plantel_id && (
          <button className={`plantel-tab ${plantelFiltro === '' ? 'activo' : ''}`} onClick={() => setPlantelFiltro('')}>
            Todos los planteles
          </button>
        )}
        {planteles.map(p => (
          <button key={p.id} className={`plantel-tab ${plantelFiltro === p.id ? 'activo' : ''}`} onClick={() => setPlantelFiltro(p.id)}>
            {p.nombre}
          </button>
        ))}
      </div>

      {/* Vista plantel seleccionado */}
      {plantelFiltro && idiomasActuales.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--texto-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
          Este plantel no tiene oferta educativa registrada.
        </div>
      )}

      {plantelFiltro && idiomasActuales.length > 0 && (
        <div className="card-grid">
          {idiomasActuales.map(oferta => (
            <TarjetaIdioma key={oferta.idioma} plantel={plantelActual} oferta={oferta} />
          ))}
        </div>
      )}

      {/* Vista todos los planteles */}
      {!plantelFiltro && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {planteles.map(pl => {
            const ids = idiomasDelPlantel(pl.id)
            if (ids.length === 0) return null
            return (
              <div key={pl.id}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {pl.nombre}
                </h3>
                <div className="card-grid">
                  {ids.map(oferta => <TarjetaIdioma key={oferta.idioma} plantel={pl} oferta={oferta} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de período */}
      {modal === 'periodo' && (
        <Modal titulo={`Período — ${form.idioma_nombre}`} onClose={() => setModal(null)}>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>
            Plantel: <strong>{form.plantel_nombre}</strong>
          </p>
          {!form.idioma_id && (
            <div className="alerta error" style={{ marginBottom: 12 }}>
              Este idioma no está en el catálogo del sistema. Contacta al superadmin.
            </div>
          )}
          <label>Nombre del ciclo (opcional)
            <input value={form.ciclo} onChange={e => setForm({ ...form, ciclo: e.target.value })} placeholder="Ej. Ciclo 2026-A" />
          </label>
          <label>Inicio de pre-registro
            <input type="date" value={form.inicio_prereg} onChange={e => setForm({ ...form, inicio_prereg: e.target.value })} />
          </label>
          <label>Fin de pre-registro
            <input type="date" value={form.fin_prereg} onChange={e => setForm({ ...form, fin_prereg: e.target.value })} />
          </label>
          <label>Examen de ubicación
            <input type="date" value={form.fecha_examen} onChange={e => setForm({ ...form, fecha_examen: e.target.value })} />
          </label>
          <label>Asignación de grupo
            <input type="date" value={form.fecha_asignacion} onChange={e => setForm({ ...form, fecha_asignacion: e.target.value })} />
          </label>
          <label>Inicio de clases
            <input type="date" value={form.fecha_inicio_clases} onChange={e => setForm({ ...form, fecha_inicio_clases: e.target.value })} />
          </label>
          <div className="modal-acciones">
            {form.periodo_id && (
              <button className="btn-mini rojo" style={{ marginRight: 'auto' }} onClick={eliminar}>Eliminar período</button>
            )}
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardar} disabled={guardando || !form.idioma_id}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
