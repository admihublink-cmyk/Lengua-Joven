import { useEffect, useState } from 'react'
import { useAuth } from '../App.jsx'
import * as api from '../api.js'

export default function Reportes() {
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        const [ins, pagos, grupos, asistencias, evaluaciones, idiomas, planteles] = await Promise.all([
          api.getInscripciones(),
          api.getPagos(),
          api.getGrupos(),
          api.getAsistencias(),
          api.getEvaluaciones(),
          api.getIdiomas(),
          api.getPlanteles(),
        ])

        const porEstado = {}
        ins.forEach(i => { porEstado[i.estado] = (porEstado[i.estado] || 0) + 1 })

        const ingresoTotal = pagos.filter(p => p.estado === 'pagado').reduce((s, p) => s + (p.monto || 0), 0)
        const pendienteTotal = pagos.filter(p => p.estado === 'pendiente').reduce((s, p) => s + (p.monto || 0), 0)

        const gruposData = grupos.map(g => {
          const alumnos = ins.filter(i => i.grupo_id === g.id && i.estado !== 'baja').length
          return { ...g, alumnos }
        })

        const promediosPorGrupo = grupos.map(g => {
          const evs = evaluaciones.filter(e => e.grupo_id === g.id)
          const prom = evs.length ? (evs.reduce((s, e) => s + e.calificacion, 0) / evs.length).toFixed(1) : null
          return { codigo: g.codigo, promedio: prom, total: evs.length }
        })

        const gruposIdsVisibles = new Set(grupos.map(g => g.id))
        const asistenciasVisibles = asistencias.filter(a => !gruposIdsVisibles.size || gruposIdsVisibles.has(a.grupo_id))
        const totalAsist = asistenciasVisibles.length
        const presentes = asistenciasVisibles.filter(a => a.presente).length
        const pctAsist = totalAsist ? Math.round(presentes / totalAsist * 100) : 0

        let porPlantelPrograma = null
        if (!usuario.plantel_id) {
          const gruposMap = {}
          grupos.forEach(g => { gruposMap[g.id] = g })
          const filas = {}
          ins.filter(i => i.estado !== 'baja').forEach(i => {
            const plantelNombre = planteles.find(p => p.id === i.plantel_id)?.nombre || 'Sin plantel'
            const grupo = i.grupo_id ? gruposMap[i.grupo_id] : null
            const programa = grupo ? (idiomas.find(x => x.id === grupo.idioma_id)?.nombre || 'Sin definir') : 'Sin grupo asignado'
            const clave = plantelNombre + ' · ' + programa
            if (!filas[clave]) filas[clave] = { plantel: plantelNombre, programa, total: 0 }
            filas[clave].total++
          })
          porPlantelPrograma = Object.values(filas).sort((a, b) => a.plantel.localeCompare(b.plantel) || b.total - a.total)
        }

        setDatos({ porEstado, ingresoTotal, pendienteTotal, gruposData, promediosPorGrupo, pctAsist, totalIns: ins.length, porPlantelPrograma })
      } catch (e) {
        console.error('Error cargando reportes:', e)
      }
    }
    cargar()
  }, [])

  if (!datos) return <div className="texto-muted">Cargando reportes…</div>

  const COLORES_ESTADO = { nueva: '#F18B11', validada: '#3498db', liga_enviada: '#9b59b6', pagada: '#27ae60', asignada: '#2ecc71', baja: '#95a5a6' }

  return (
    <div>
      <div className="page-header"><h2>Reportes</h2></div>

      <div className="metricas-grid">
        <div className="metrica-card naranja">
          <div className="metrica-num">{datos.totalIns}</div>
          <div className="metrica-label">Total inscripciones</div>
        </div>
        <div className="metrica-card verde">
          <div className="metrica-num">${datos.ingresoTotal.toLocaleString()}</div>
          <div className="metrica-label">Ingresos cobrados</div>
        </div>
        <div className="metrica-card">
          <div className="metrica-num">${datos.pendienteTotal.toLocaleString()}</div>
          <div className="metrica-label">Pendiente de cobro</div>
        </div>
        <div className="metrica-card morado">
          <div className="metrica-num">{datos.pctAsist}%</div>
          <div className="metrica-label">Asistencia promedio</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h3>Inscripciones por estado</h3>
          <div className="barras-chart">
            {Object.entries(datos.porEstado).map(([estado, n]) => (
              <div key={estado} className="barra-row">
                <span className="barra-label">{estado}</span>
                <div className="barra-bg">
                  <div className="barra-fill" style={{
                    width: `${Math.round(n / datos.totalIns * 100)}%`,
                    background: COLORES_ESTADO[estado] || '#F18B11'
                  }} />
                </div>
                <span className="barra-val">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Ocupación de grupos</h3>
          <div className="tabla-wrap">
            <table className="tabla chica">
              <thead><tr><th>Grupo</th><th>Alumnos</th><th>Cupo</th><th>Ocup.</th></tr></thead>
              <tbody>
                {datos.gruposData.map(g => (
                  <tr key={g.id}>
                    <td><strong>{g.codigo}</strong></td>
                    <td>{g.alumnos}</td>
                    <td>{g.cupo}</td>
                    <td>
                      <div className="mini-barra-bg">
                        <div className="mini-barra-fill" style={{ width: `${Math.min(100, Math.round(g.alumnos / g.cupo * 100))}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Desempeño académico por grupo</h3>
          <div className="tabla-wrap">
            <table className="tabla chica">
              <thead><tr><th>Grupo</th><th>Evaluaciones</th><th>Promedio</th></tr></thead>
              <tbody>
                {datos.promediosPorGrupo.map(g => (
                  <tr key={g.codigo}>
                    <td>{g.codigo}</td>
                    <td>{g.total}</td>
                    <td>
                      {g.promedio
                        ? <span className={`calificacion ${Number(g.promedio) >= 70 ? 'aprobado' : 'reprobado'}`}>{g.promedio}</span>
                        : <span className="texto-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {datos.porPlantelPrograma && (
          <div className="card">
            <h3>Inscritos por programa y plantel</h3>
            <div className="tabla-wrap">
              <table className="tabla chica">
                <thead><tr><th>Plantel</th><th>Programa</th><th>Inscritos</th></tr></thead>
                <tbody>
                  {datos.porPlantelPrograma.map((f, idx) => (
                    <tr key={idx}>
                      <td>{f.plantel}</td>
                      <td>{f.programa}</td>
                      <td><strong>{f.total}</strong></td>
                    </tr>
                  ))}
                  {datos.porPlantelPrograma.length === 0 && (
                    <tr><td colSpan={3} className="tabla-vacio">Sin inscripciones registradas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <h3>Resumen financiero</h3>
          <div className="reporte-financiero">
            <div className="fin-row">
              <span>Pagos confirmados</span>
              <strong style={{ color: '#27ae60' }}>${datos.ingresoTotal.toLocaleString()}</strong>
            </div>
            <div className="fin-row">
              <span>Pagos pendientes</span>
              <strong style={{ color: '#F18B11' }}>${datos.pendienteTotal.toLocaleString()}</strong>
            </div>
            <div className="fin-row borde-top">
              <span>Total esperado</span>
              <strong>${(datos.ingresoTotal + datos.pendienteTotal).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
