import { useEffect, useState, useCallback } from 'react'
import { useAuth, useNav } from '../App.jsx'
import { P, ROL_PERMISOS } from '../auth.js'
import * as api from '../api.js'

export default function Dashboard() {
  const { usuario, tienePermiso } = useAuth()
  const { navegar } = useNav()
  const [datos, setDatos] = useState({})
  const [buscandoCoordi, setBuscandoCoordi] = useState(false)
  const rolCfg = ROL_PERMISOS[usuario.rol]

  async function irACoordi() {
    if (!usuario.plantel_id) return
    setBuscandoCoordi(true)
    try {
      const coordi = await api.getCoordinadorPlantel(usuario.plantel_id)
      navegar('mensajes', { contactId: coordi.id })
    } catch {
      alert('No hay un coordinador asignado a este plantel.')
    } finally {
      setBuscandoCoordi(false)
    }
  }

  useEffect(() => {
    async function cargar() {
      try {
        if (usuario.rol === 'tutor') {
          const [misAlumnos, misEval, misPagos] = await Promise.all([
            api.getTutorAlumnos(),
            api.getEvaluaciones(),
            api.getPagos(),
          ])
          setDatos({ misAlumnos, misEval, misPagos })
          return
        }

        if (usuario.rol === 'alumno') {
          const [misIns, misPagos, misEval, misAsist, avisos] = await Promise.all([
            api.getInscripciones(),
            api.getPagos(),
            api.getEvaluaciones(),
            api.getAsistencias(),
            api.getAvisos(),
          ])
          setDatos({ misIns, misPagos, misEval, misAsist, avisos })
          return
        }

        if (usuario.rol === 'profesor') {
          const [misGrupos, avisos] = await Promise.all([
            api.getGrupos(),
            api.getAvisos(),
          ])
          setDatos({ misGrupos, avisos })
          return
        }

        // Admin / Coordinador / Director / Superadmin
        const [ins, grupos, pagos, avisos] = await Promise.all([
          api.getInscripciones(),
          api.getGrupos(),
          api.getPagos(),
          api.getAvisos(),
        ])
        setDatos({
          totalIns: ins.length,
          nuevas: ins.filter(i => i.estado === 'nueva').length,
          pagadas: ins.filter(i => ['pagada', 'asignada'].includes(i.estado)).length,
          totalGrupos: grupos.length,
          gruposActivos: grupos.filter(g => g.activo).length,
          ingresoTotal: pagos.filter(p => p.estado === 'pagado').reduce((s, p) => s + (p.monto || 0), 0),
          avisos,
          ins,
        })
      } catch (e) {
        console.error('Error cargando dashboard:', e)
      }
    }
    cargar()
  }, [usuario])

  const fecha = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div>
      <div className="dash-bienvenida">
        <div>
          <h2>Hola, {usuario.nombre.split(' ')[0]} 👋</h2>
          <p className="texto-muted">{fecha} · <span style={{ color: rolCfg.color }}>{rolCfg.label}</span></p>
        </div>
      </div>

      {/* Vista Tutor */}
      {usuario.rol === 'tutor' && (
        <>
          <div className="metricas-grid">
            <div className="metrica-card">
              <div className="metrica-num">{datos.misAlumnos?.length ?? 0}</div>
              <div className="metrica-label">Menores asociados</div>
            </div>
            <div className="metrica-card naranja">
              <div className="metrica-num">{datos.misPagos?.length ?? 0}</div>
              <div className="metrica-label">Pagos pendientes</div>
            </div>
            <div className="metrica-card">
              <div className="metrica-num">
                {datos.misEval?.length > 0
                  ? (datos.misEval.reduce((s, e) => s + e.calificacion, 0) / datos.misEval.length).toFixed(1)
                  : '—'}
              </div>
              <div className="metrica-label">Promedio general</div>
            </div>
          </div>

          <div className="dash-grid">
            <div className="card">
              <h3>Mis menores</h3>
              {(datos.misAlumnos || []).length === 0 && <p className="texto-muted">No hay alumnos asociados a tu cuenta.</p>}
              {(datos.misAlumnos || []).map(a => (
                <div key={a.id} className="lista-item">
                  <div>
                    <strong>{a.nombre}</strong>
                    <p className="texto-muted chico">{a.email}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3>Pagos pendientes</h3>
              {(datos.misPagos || []).length === 0 && <p className="texto-muted">Sin pagos pendientes.</p>}
              {(datos.misPagos || []).map(p => (
                <div key={p.id} className="lista-item">
                  <div>
                    <strong>${(p.monto || 0).toLocaleString()}</strong>
                    <p className="texto-muted chico">{p.fecha || 'Sin fecha'}</p>
                  </div>
                  <span className="badge pendiente">pendiente</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Vista Alumno */}
      {usuario.rol === 'alumno' && (
        <>
          <div className="metricas-grid">
            <div className="metrica-card">
              <div className="metrica-num">{datos.misIns?.length ?? 0}</div>
              <div className="metrica-label">Inscripciones</div>
            </div>
            <div className="metrica-card">
              <div className="metrica-num">{datos.misPagos?.filter(p => p.estado === 'pagado').length ?? 0}</div>
              <div className="metrica-label">Pagos realizados</div>
            </div>
            <div className="metrica-card">
              <div className="metrica-num">
                {datos.misEval?.length > 0
                  ? (datos.misEval.reduce((s, e) => s + e.calificacion, 0) / datos.misEval.length).toFixed(1)
                  : '—'}
              </div>
              <div className="metrica-label">Promedio</div>
            </div>
            <div className="metrica-card">
              <div className="metrica-num">
                {datos.misAsist?.length > 0
                  ? Math.round(datos.misAsist.filter(a => a.presente).length / datos.misAsist.length * 100) + '%'
                  : '—'}
              </div>
              <div className="metrica-label">Asistencia</div>
            </div>
          </div>

          {datos.misIns?.map(ins => (
            <div key={ins.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Mi inscripción — <span className={'badge ' + ins.estado}>{ins.estado}</span></h3>
                  <p style={{ margin: '4px 0 0' }}>Folio: <strong>{ins.folio}</strong> · Grupo: <strong>{ins.grupo_id || 'Por asignar'}</strong></p>
                  {ins.estado === 'espera' && ins.posicion_espera && (
                    <p style={{ margin: '4px 0 0', color: '#b45309', fontSize: 13 }}>
                      Estás en la lista de espera — posición <strong>#{ins.posicion_espera}</strong>.
                      Se te asignará automáticamente si se libera un lugar.
                    </p>
                  )}
                </div>
                {ins.liga_pago && (
                  <a href={ins.liga_pago} target="_blank" rel="noopener noreferrer"
                    className="btn-primario" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    Pagar ahora
                  </a>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Vista Profesor */}
      {usuario.rol === 'profesor' && (
        <>
          <div className="metricas-grid">
            <div className="metrica-card">
              <div className="metrica-num">{datos.misGrupos?.length ?? 0}</div>
              <div className="metrica-label">Mis grupos</div>
            </div>
          </div>
          <div className="card">
            <h3>Mis grupos</h3>
            {datos.misGrupos?.length === 0 && <p className="texto-muted">Sin grupos asignados.</p>}
            {datos.misGrupos?.map(g => (
              <div key={g.id} className="lista-item">
                <strong>{g.codigo}</strong> · {g.horario || 'Sin horario'}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Vista Admin/Dirección */}
      {!['alumno', 'profesor', 'tutor'].includes(usuario.rol) && (
        <>
          {usuario.rol === 'director' && (
            <div style={{ marginBottom: 20 }}>
              <button
                className="btn-primario"
                onClick={irACoordi}
                disabled={buscandoCoordi}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                ✉ {buscandoCoordi ? 'Buscando…' : 'COORDINADOR'}
              </button>
            </div>
          )}
          <div className="metricas-grid">
            <div className="metrica-card naranja">
              <div className="metrica-num">{datos.totalIns ?? 0}</div>
              <div className="metrica-label">Inscripciones totales</div>
            </div>
            <div className="metrica-card">
              <div className="metrica-num">{datos.nuevas ?? 0}</div>
              <div className="metrica-label">Nuevas (pendientes)</div>
            </div>
            <div className="metrica-card verde">
              <div className="metrica-num">{datos.pagadas ?? 0}</div>
              <div className="metrica-label">Pagadas / Asignadas</div>
            </div>
            <div className="metrica-card">
              <div className="metrica-num">{datos.gruposActivos ?? 0}</div>
              <div className="metrica-label">Grupos activos</div>
            </div>
            {(tienePermiso(P.REPORTE_VER) || tienePermiso(P.REPORTE_VER_PLANTEL)) && (
              <div className="metrica-card morado">
                <div className="metrica-num">${(datos.ingresoTotal ?? 0).toLocaleString()}</div>
                <div className="metrica-label">Ingresos registrados</div>
              </div>
            )}
          </div>

          <div className="dash-grid">
            <div className="card">
              <h3>Inscripciones recientes</h3>
              {(datos.ins || []).slice(0, 5).map(i => (
                <div key={i.id} className="lista-item">
                  <div>
                    <strong>{i.nombre_externo || i.alumno_id || 'Sin nombre'}</strong>
                    <span className="texto-muted"> · {i.folio}</span>
                  </div>
                  <span className={'badge ' + i.estado}>{i.estado}</span>
                </div>
              ))}
              {(datos.ins || []).length === 0 && <p className="texto-muted">Sin inscripciones.</p>}
            </div>

            <div className="card">
              <h3>Avisos activos</h3>
              {(datos.avisos || []).slice(0, 4).map(a => (
                <div key={a.id} className="lista-item">
                  <div>
                    <strong>{a.titulo}</strong>
                    <p className="texto-muted chico">{a.fecha}</p>
                  </div>
                </div>
              ))}
              {(datos.avisos || []).length === 0 && <p className="texto-muted">Sin avisos.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
