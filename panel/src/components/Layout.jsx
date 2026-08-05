import { useState, useEffect, useRef } from 'react'
import { useAuth, useNav } from '../App.jsx'
import { P, ROL_PERMISOS } from '../auth.js'
import * as api from '../api.js'

const NAV_ITEMS = [
  { id: 'dashboard',     icon: '⊞',  label: 'Inicio',            permiso: null },
  { id: 'calendario',    icon: '📅',  label: 'Calendario',        permiso: P.GRUPO_VER },
  { id: 'mensajes',      icon: '💬',  label: 'Mensajes',          permiso: P.MENSAJE_ENVIAR },
  { id: 'tareas',        icon: '📝',  label: 'Tareas',            permiso: P.TAREA_VER },
  { id: 'planteles',     icon: '🏫',  label: 'Planteles',         permiso: P.PLAN_VER },
  { id: 'idiomas',       icon: '🌐',  label: 'Idiomas y Niveles', permiso: P.IDIOMA_VER },
  { id: 'grupos',        icon: '👥',  label: 'Grupos',            permiso: P.GRUPO_VER },
  { id: 'asistencia',    icon: '✓',   label: 'Asistencia',        permiso: P.ASIST_VER },
  { id: 'evaluacion',    icon: '📊',  label: 'Evaluación',        permiso: P.EVAL_VER },
  { id: 'placement',     icon: '🎯',  label: 'Placement Test',    permiso: P.PLACEMENT_VER },
  { id: 'inscripciones', icon: '📋',  label: 'Inscripciones',     permiso: P.INSC_VER },
  { id: 'pagos',         icon: '💳',  label: 'Pagos',             permiso: P.PAGO_VER },
  { id: 'avisos',        icon: '📢',  label: 'Avisos',            permiso: P.AVISO_VER },
  { id: 'reportes',      icon: '📈',  label: 'Reportes',          permiso: P.REPORTE_VER_PLANTEL },
  { id: 'buzon',         icon: '📮',  label: 'Buzón',             permiso: P.BUZON_ENVIAR },
  { id: 'convenios',     icon: '📄',  label: 'Convenios',         permiso: P.CONVENIO_GESTIONAR },
  { id: 'oferta',        icon: '🏷',   label: 'Oferta Educativa',  permiso: P.CONFIG_SISTEMA },
  { id: 'configuracion', icon: '⚙',   label: 'Configuración',     permiso: [P.CONFIG_SISTEMA, P.USUARIOS_GESTIONAR] },
  { id: 'actividad',    icon: '🛡',   label: 'Panel de actividad', permiso: P.CONFIG_SISTEMA },
  { id: 'perfil',        icon: '👤',  label: 'Mi Perfil',         permiso: null },
]

export default function Layout({ children }) {
  const { usuario, salir, tienePermiso } = useAuth()
  const { ruta, navegar } = useNav()
  const [abierto, setAbierto] = useState(false)
  const [noLeidos, setNoLeidos] = useState(0)
  const [notifCount, setNotifCount] = useState(0)
  const [notifAbiertas, setNotifAbiertas] = useState(false)
  const [notificaciones, setNotificaciones] = useState([])
  const [plantelNombre, setPlantelNombre] = useState('')
  const notifRef = useRef(null)

  const rolCfg = ROL_PERMISOS[usuario.rol]

  // Soporte para permiso array: visible si tiene al menos uno
  const items = NAV_ITEMS.filter(item => {
    if (!item.permiso) return true
    if (Array.isArray(item.permiso)) return item.permiso.some(p => tienePermiso(p))
    return tienePermiso(item.permiso)
  })

  async function actualizarContadores() {
    try {
      const [msgs, notifs, planteles] = await Promise.all([
        api.getMensajes(),
        api.getNotificaciones(),
        usuario.plantel_id ? api.getPlanteles() : Promise.resolve([]),
      ])
      setNoLeidos(msgs.filter(m => m.para === usuario.id && !m.leido).length)
      setNotificaciones(notifs)
      setNotifCount(notifs.filter(n => !n.leida).length)
      if (usuario.plantel_id) {
        setPlantelNombre(planteles.find(p => p.id === usuario.plantel_id)?.nombre || usuario.plantel_id)
      }
    } catch { /* layout errors are non-critical */ }
  }

  useEffect(() => { actualizarContadores() }, [])

  // Cerrar dropdown de notificaciones al hacer clic fuera
  useEffect(() => {
    function onClickFuera(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifAbiertas(false)
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  function abrirNotificaciones() {
    setNotifAbiertas(v => !v)
  }

  async function marcarTodas() {
    try { await api.marcarTodasLeidas() } catch { /* ignorar */ }
    setNotifAbiertas(false)
    await actualizarContadores()
  }

  function irAAviso(avisoId) {
    navegar('avisos', avisoId ? { avisoId } : {})
    setNotifAbiertas(false)
  }

  // Modo full-screen para clase
  if (ruta === 'clase') return <>{children}</>

  return (
    <div className="layout">
      {abierto && <div className="sidebar-overlay" onClick={() => setAbierto(false)} />}

      <aside className={`sidebar ${abierto ? 'abierto' : ''}`}>
        <div className="sidebar-logo">
          <span className="logo-marca">Lengua</span>
          <span className="logo-link"> Joven</span>
        </div>

        <div className="sidebar-usuario" style={{ cursor: 'pointer' }} onClick={() => { navegar('perfil'); setAbierto(false) }}>
          <div className="avatar" style={{ background: rolCfg.color }}>
            {usuario.nombre.charAt(0)}
          </div>
          <div>
            <div className="usuario-nombre">{usuario.nombre}</div>
            <div className="usuario-rol" style={{ color: rolCfg.color }}>{rolCfg.label}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {items.map(item => (
            <button
              key={item.id}
              className={`nav-item ${ruta === item.id ? 'activo' : ''}`}
              onClick={() => { navegar(item.id); setAbierto(false) }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.id === 'mensajes' && noLeidos > 0 && (
                <span className="nav-badge">{noLeidos > 9 ? '9+' : noLeidos}</span>
              )}
            </button>
          ))}
        </nav>

        <button className="nav-salir" onClick={salir}>
          <span>↩</span> Cerrar sesión
        </button>
      </aside>

      <div className="main-wrapper">
        <header className="topbar">
          <button className="hamburger" onClick={() => setAbierto(!abierto)}>☰</button>
          <h1 className="topbar-titulo">
            {items.find(i => i.id === ruta)?.label || 'Inicio'}
          </h1>
          <div className="topbar-derecha">
            {/* Campana de notificaciones */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button className="btn-tema" onClick={abrirNotificaciones} title="Notificaciones"
                style={{ position: 'relative' }}>
                🔔
                {notifCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    background: 'var(--rojo, #e74c3c)', color: '#fff',
                    fontSize: 10, fontWeight: 700, borderRadius: '50%',
                    minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: '0 3px',
                  }}>
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>

              {notifAbiertas && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 320, maxHeight: 400, overflow: 'auto',
                  background: 'var(--bg-2)', border: '1px solid var(--borde)',
                  borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                  zIndex: 200,
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>Notificaciones</strong>
                    {notifCount > 0 && (
                      <button className="btn-mini" onClick={marcarTodas}>Marcar todas leídas</button>
                    )}
                  </div>
                  {notificaciones.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--texto-muted)' }}>Sin notificaciones</div>
                  ) : (
                    notificaciones.slice(0, 15).map(n => (
                      <div key={n.id}
                        onClick={() => { api.marcarNotifLeida(n.id).catch(() => {}); irAAviso(n.ref_id) }}
                        style={{
                          padding: '10px 16px', cursor: 'pointer',
                          borderBottom: '1px solid var(--borde)',
                          background: n.leida ? 'var(--bg-3)' : 'rgba(241,139,17,0.14)',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 16, marginTop: 1 }}>📢</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: n.leida ? 400 : 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {n.titulo}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--texto-muted)', marginTop: 2 }}>
                              {new Date(n.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {!n.leida && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primario, #F18B11)', flexShrink: 0, marginTop: 4 }} />}
                        </div>
                      </div>
                    ))
                  )}
                  <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <button className="btn-mini" onClick={() => irAAviso()}>Ver todos los avisos</button>
                  </div>
                </div>
              )}
            </div>

            <span className="badge-plantel">
              {usuario.plantel_id
                ? '📍 ' + (plantelNombre || usuario.plantel_id)
                : '🌐 Global'}
            </span>
          </div>
        </header>
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
