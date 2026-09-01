import { useState, useEffect } from 'react'
import { getPortalAlumno } from '../api.js'
import { useAuth } from '../App.jsx'

const TAB_INICIO = 'inicio'
const TAB_CLASES = 'clases'
const TAB_CALIFICACIONES = 'calificaciones'
const TAB_TAREAS = 'tareas'
const TAB_AVISOS = 'avisos'

function fmtFecha(f) {
  if (!f) return '—'
  const [y, m, d] = f.split('-').map(Number)
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${meses[m - 1]} ${y}`
}

function fmtHora(h) {
  if (!h) return ''
  return String(h).slice(0, 5)
}

function BadgeAsistencia({ valor }) {
  if (valor == null) return <span style={{ color: 'var(--gris-2)', fontSize: 12 }}>—</span>
  return (
    <span style={{
      display: 'inline-block', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600,
      background: valor ? '#D1FAE5' : '#FEE2E2',
      color: valor ? '#059669' : '#DC2626',
    }}>
      {valor ? 'Asistí' : 'Falta'}
    </span>
  )
}

function TarjetaProxima({ sesion, grupo }) {
  const linkMeet = sesion?.link_meet || grupo?.link_meet
  return (
    <div style={{
      background: 'linear-gradient(135deg, #F18B11 0%, #e07d0b 100%)',
      borderRadius: 16, padding: '20px 22px', color: '#fff', marginBottom: 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        Próxima clase
      </div>
      {sesion ? (
        <>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{sesion.titulo || 'Clase'}</div>
          <div style={{ fontSize: 15, opacity: 0.9, marginBottom: 12 }}>
            {fmtFecha(sesion.fecha)} · {fmtHora(sesion.hora_inicio)}
            {sesion.hora_fin ? `–${fmtHora(sesion.hora_fin)}` : ''}
          </div>
          {linkMeet && (
            <a
              href={linkMeet}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 14,
                textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.5)',
              }}
            >
              <span>📹</span> Unirse a Meet
            </a>
          )}
          {!linkMeet && (
            <div style={{ opacity: 0.7, fontSize: 13 }}>Sin enlace Meet asignado</div>
          )}
        </>
      ) : (
        <div style={{ opacity: 0.85, fontSize: 15 }}>No hay clases próximas programadas</div>
      )}
    </div>
  )
}

function EstadisticaCard({ label, valor, color, icono }) {
  return (
    <div style={{
      background: 'var(--fondo-2, #f7f7f7)', borderRadius: 12, padding: '14px 16px',
      flex: '1 1 100px', minWidth: 0,
    }}>
      <div style={{ fontSize: 22, marginBottom: 2 }}>{icono}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--texto)' }}>
        {valor ?? '—'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--gris)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function TabInicio({ data }) {
  const { inscripcion, proximaClase, stats } = data
  const hoy = new Date().toISOString().slice(0, 10)
  const sesionesRecientes = (data.sesiones || []).filter(s => s.fecha <= hoy).slice(-5).reverse()

  return (
    <div>
      <TarjetaProxima sesion={proximaClase} grupo={inscripcion} />

      {inscripcion && (
        <div style={{ background: 'var(--fondo-2, #f7f7f7)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gris)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mi grupo</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
            {inscripcion.idioma_nombre} — {inscripcion.nivel_nombre}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gris)' }}>{inscripcion.horario}</div>
          {inscripcion.profesor_nombre && (
            <div style={{ fontSize: 13, color: 'var(--gris)', marginTop: 2 }}>Maestro: {inscripcion.profesor_nombre}</div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <EstadisticaCard
          icono="📊" label="Asistencia"
          valor={stats.pctAsistencia != null ? `${stats.pctAsistencia}%` : null}
          color={stats.pctAsistencia >= 80 ? '#059669' : stats.pctAsistencia != null ? '#D97706' : undefined}
        />
        <EstadisticaCard
          icono="⭐" label="Promedio"
          valor={stats.promedio != null ? stats.promedio : null}
          color={stats.promedio >= 7 ? '#059669' : stats.promedio != null ? '#D97706' : undefined}
        />
        <EstadisticaCard
          icono="📝" label="Tareas pendientes"
          valor={stats.tareasPendientes}
          color={stats.tareasPendientes > 0 ? '#DC2626' : '#059669'}
        />
      </div>

      {sesionesRecientes.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Últimas clases</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sesionesRecientes.map(s => (
              <div key={s.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--fondo-2, #f7f7f7)', borderRadius: 10, padding: '10px 14px',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.titulo || 'Clase'}</div>
                  <div style={{ fontSize: 12, color: 'var(--gris)' }}>{fmtFecha(s.fecha)} · {fmtHora(s.hora_inicio)}</div>
                </div>
                <BadgeAsistencia valor={s.asistio} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TabClases({ sesiones }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const futuras = sesiones.filter(s => s.fecha >= hoy)
  const pasadas = sesiones.filter(s => s.fecha < hoy).reverse()

  return (
    <div>
      {futuras.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#F18B11' }}>Próximas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {futuras.map(s => (
              <div key={s.id} style={{
                background: 'var(--fondo-2, #f7f7f7)', borderRadius: 12, padding: '12px 16px',
                borderLeft: '3px solid #F18B11',
              }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.titulo || 'Clase'}</div>
                <div style={{ fontSize: 13, color: 'var(--gris)', marginTop: 2 }}>
                  {fmtFecha(s.fecha)} · {fmtHora(s.hora_inicio)}
                  {s.hora_fin ? `–${fmtHora(s.hora_fin)}` : ''}
                </div>
                {(s.link_meet) && (
                  <a href={s.link_meet} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: '#F18B11', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    📹 Unirse a Meet
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pasadas.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: 'var(--gris)' }}>Clases anteriores</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pasadas.map(s => (
              <div key={s.id} style={{
                background: 'var(--fondo-2, #f7f7f7)', borderRadius: 12, padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.titulo || 'Clase'}</div>
                  <div style={{ fontSize: 12, color: 'var(--gris)', marginTop: 2 }}>
                    {fmtFecha(s.fecha)} · {fmtHora(s.hora_inicio)}
                  </div>
                </div>
                <BadgeAsistencia valor={s.asistio} />
              </div>
            ))}
          </div>
        </div>
      )}

      {futuras.length === 0 && pasadas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gris)' }}>
          No hay sesiones registradas
        </div>
      )}
    </div>
  )
}

function TabCalificaciones({ evaluaciones }) {
  return (
    <div>
      {evaluaciones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gris)' }}>
          No hay evaluaciones registradas
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {evaluaciones.map(e => (
            <div key={e.id} style={{
              background: 'var(--fondo-2, #f7f7f7)', borderRadius: 12, padding: '14px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>
                  {e.tipo === 'parcial' ? 'Parcial' : e.tipo === 'final' ? 'Final' : e.tipo || 'Evaluación'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gris)', marginTop: 2 }}>{fmtFecha(e.fecha)}</div>
                {e.observaciones && (
                  <div style={{ fontSize: 13, color: 'var(--gris)', marginTop: 4 }}>{e.observaciones}</div>
                )}
              </div>
              <div style={{
                fontSize: 24, fontWeight: 800,
                color: e.calificacion >= 7 ? '#059669' : e.calificacion >= 6 ? '#D97706' : '#DC2626',
              }}>
                {e.calificacion ?? '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabTareas({ tareas }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const pendientes = tareas.filter(t => !t.entrega_id && t.fecha_limite >= hoy)
  const entregadas = tareas.filter(t => !!t.entrega_id)
  const vencidas = tareas.filter(t => !t.entrega_id && t.fecha_limite < hoy)

  function TareaCard({ t }) {
    return (
      <div style={{
        background: 'var(--fondo-2, #f7f7f7)', borderRadius: 12, padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.titulo}</div>
            {t.descripcion && (
              <div style={{ fontSize: 13, color: 'var(--gris)', marginTop: 3 }}>{t.descripcion}</div>
            )}
            <div style={{ fontSize: 12, color: 'var(--gris)', marginTop: 4 }}>
              Fecha límite: {fmtFecha(t.fecha_limite)}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {t.entrega_id ? (
              <span style={{ display: 'inline-block', background: '#D1FAE5', color: '#059669', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                Entregada
              </span>
            ) : t.fecha_limite < hoy ? (
              <span style={{ display: 'inline-block', background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                Vencida
              </span>
            ) : (
              <span style={{ display: 'inline-block', background: '#FEF3C7', color: '#D97706', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                Pendiente
              </span>
            )}
            {t.tarea_calificacion != null && (
              <div style={{ fontSize: 18, fontWeight: 800, color: '#F18B11', marginTop: 4 }}>
                {t.tarea_calificacion}
              </div>
            )}
          </div>
        </div>
        {t.tarea_comentario && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--gris)', background: 'var(--fondo)', borderRadius: 8, padding: '6px 10px' }}>
            💬 {t.tarea_comentario}
          </div>
        )}
      </div>
    )
  }

  if (tareas.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gris)' }}>No hay tareas asignadas</div>
  }

  return (
    <div>
      {pendientes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#D97706' }}>
            Pendientes ({pendientes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendientes.map(t => <TareaCard key={t.id} t={t} />)}
          </div>
        </div>
      )}
      {entregadas.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#059669' }}>
            Entregadas ({entregadas.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entregadas.map(t => <TareaCard key={t.id} t={t} />)}
          </div>
        </div>
      )}
      {vencidas.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#DC2626' }}>
            Vencidas ({vencidas.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {vencidas.map(t => <TareaCard key={t.id} t={t} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function TabAvisos({ avisos }) {
  return (
    <div>
      {avisos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gris)' }}>
          No hay avisos
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {avisos.map(a => (
            <div key={a.id} style={{
              background: 'var(--fondo-2, #f7f7f7)', borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{a.titulo}</div>
              <div style={{ fontSize: 13, color: 'var(--gris)', lineHeight: 1.5 }}>{a.contenido}</div>
              <div style={{ fontSize: 11, color: 'var(--gris-2)', marginTop: 6 }}>{fmtFecha(a.fecha)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: TAB_INICIO, label: 'Inicio', icono: '🏠' },
  { id: TAB_CLASES, label: 'Mis clases', icono: '📅' },
  { id: TAB_CALIFICACIONES, label: 'Calificaciones', icono: '⭐' },
  { id: TAB_TAREAS, label: 'Tareas', icono: '📝' },
  { id: TAB_AVISOS, label: 'Avisos', icono: '📢' },
]

export default function PortalAlumno() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState(TAB_INICIO)
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setCargando(true)
    getPortalAlumno()
      .then(d => setData(d))
      .catch(e => setError(e.message || 'No se pudo cargar tu portal'))
      .finally(() => setCargando(false))
  }, [])

  const tareasPendientes = data?.stats?.tareasPendientes || 0
  const avisosCount = data?.avisos?.length || 0

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Encabezado */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          Hola, {usuario?.nombre?.split(' ')[0] || 'alumno'} 👋
        </div>
        <div style={{ color: 'var(--gris)', fontSize: 14 }}>Tu portal de Lengua Joven</div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        background: 'var(--fondo-2, #f0f0f0)', borderRadius: 12, padding: 4, overflowX: 'auto',
      }}>
        {TABS.map(t => {
          const badge = t.id === TAB_TAREAS && tareasPendientes > 0 ? tareasPendientes
            : t.id === TAB_AVISOS && avisosCount > 0 ? null : null
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: '1 0 auto', border: 'none', borderRadius: 9, cursor: 'pointer',
                padding: '8px 10px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                background: tab === t.id ? '#fff' : 'transparent',
                color: tab === t.id ? '#F18B11' : 'var(--gris)',
                boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                transition: 'all .15s', position: 'relative', whiteSpace: 'nowrap',
              }}
            >
              <span style={{ marginRight: 4 }}>{t.icono}</span>
              <span style={{ display: 'none' }}>{t.label}</span>
              {badge > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4, background: '#DC2626', color: '#fff',
                  borderRadius: 100, fontSize: 9, fontWeight: 800, padding: '1px 4px', lineHeight: 1.5,
                }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Nombre de la tab activa */}
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 14 }}>
        {TABS.find(t => t.id === tab)?.icono} {TABS.find(t => t.id === tab)?.label}
      </div>

      {/* Contenido */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gris)' }}>
          Cargando tu portal…
        </div>
      ) : error ? (
        <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 12, padding: '16px 20px' }}>
          {error}
        </div>
      ) : !data?.inscripcion ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gris)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Aún no tienes grupo asignado</div>
          <div style={{ fontSize: 14 }}>Cuando un administrador te asigne a un grupo, aquí verás tu horario, clases y más.</div>
        </div>
      ) : (
        <>
          {tab === TAB_INICIO && <TabInicio data={data} />}
          {tab === TAB_CLASES && <TabClases sesiones={data.sesiones || []} />}
          {tab === TAB_CALIFICACIONES && <TabCalificaciones evaluaciones={data.evaluaciones || []} />}
          {tab === TAB_TAREAS && <TabTareas tareas={data.tareas || []} />}
          {tab === TAB_AVISOS && <TabAvisos avisos={data.avisos || []} />}
        </>
      )}
    </div>
  )
}
