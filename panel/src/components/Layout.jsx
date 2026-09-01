import { useState, useEffect, useRef } from 'react'
import { useAuth, useNav } from '../App.jsx'
import { P, ROL_PERMISOS } from '../auth.js'
import * as api from '../api.js'

const NAV_ITEMS = [
  // — General —
  { id: 'portal_alumno', icon: '🏠', label: 'Mi Portal',          permiso: P.PORTAL_VER },
  { id: 'dashboard',     icon: '⊞',  label: 'Inicio',            permiso: null },
  { id: 'calendario',    icon: '📅',  label: 'Calendario',        permiso: P.GRUPO_VER },
  { id: 'mensajes',      icon: '💬',  label: 'Mensajes',          permiso: P.MENSAJE_ENVIAR },
  { id: 'tareas',        icon: '📝',  label: 'Tareas',            permiso: P.TAREA_VER },
  // — Académico —
  { seccion: 'Académico', icon: '🏫' },
  { id: 'planteles',     icon: '🏫',  label: 'Planteles',         permiso: P.PLAN_VER },
  { id: 'oferta',        icon: '🏷',   label: 'Oferta Educativa',  permiso: P.CONFIG_SISTEMA },
  { id: 'idiomas',       icon: '🌐',  label: 'Idiomas y Niveles', permiso: P.IDIOMA_VER },
  { id: 'grupos',        icon: '👥',  label: 'Grupos',            permiso: P.GRUPO_VER },
  // — Alumnos —
  { seccion: 'Alumnos', icon: '🎓' },
  { id: 'placement',     icon: '🎯',  label: 'Placement Test',    permiso: P.PLACEMENT_VER },
  { id: 'inscripciones', icon: '📋',  label: 'Inscripciones',     permiso: P.INSC_VER },
  { id: 'ligas_pago',   icon: '🏦',  label: 'Ligas de Pago',     permiso: P.PAGO_VER },
  { id: 'pagos',         icon: '💳',  label: 'Pagos',             permiso: P.PAGO_VER },
  { id: 'pagos_maestro', icon: '💰', label: 'Liquidaciones',      permiso: P.PAGO_VER },
  // — Seguimiento —
  { seccion: 'Seguimiento', icon: '📊' },
  { id: 'asistencia',    icon: '✓',   label: 'Asistencia',        permiso: P.ASIST_VER },
  { id: 'evaluacion',    icon: '📊',  label: 'Evaluación',        permiso: P.EVAL_VER },
  { id: 'avisos',        icon: '📢',  label: 'Avisos',            permiso: P.AVISO_VER },
  { id: 'buzon',         icon: '📮',  label: 'Buzón',             permiso: P.BUZON_ENVIAR },
  // — Atención —
  { seccion: 'Atención', icon: '🎧' },
  { id: 'atencion',      icon: '🎧',  label: 'Atención a Alumnos', permiso: P.ATENCION_CREAR },
  // — Administración —
  { seccion: 'Administración', icon: '📄' },
  { id: 'convenios',     icon: '📄',  label: 'Convenios',         permiso: P.CONVENIO_GESTIONAR },
  { id: 'legal',         icon: '⚖️',  label: 'Legal y ARCO',      permiso: P.ARCO_ATENDER },
  { id: 'reportes',      icon: '📈',  label: 'Reportes',          permiso: P.REPORTE_VER_PLANTEL },
  // — Sistema —
  { seccion: 'Sistema', icon: '⚙' },
  { id: 'usuarios',      icon: '🧑‍💼', label: 'Usuarios',          permiso: P.USUARIOS_ADMIN },
  { id: 'configuracion', icon: '⚙',   label: 'Configuración',     permiso: [P.CONFIG_SISTEMA, P.USUARIOS_GESTIONAR] },
  { id: 'actividad',    icon: '🛡',   label: 'Panel de actividad', permiso: P.CONFIG_SISTEMA },
  { id: 'perfil',        icon: '👤',  label: 'Mi Perfil',         permiso: null },
]

const ROLES_SIMULABLES = [
  { rol: 'coordinador',  label: 'Coordinador' },
  { rol: 'director',     label: 'Director' },
  { rol: 'profesor',     label: 'Profesor' },
  { rol: 'alumno',       label: 'Alumno' },
  { rol: 'admin_ventas', label: 'Admin Ventas' },
  { rol: 'tutor',        label: 'Tutor / Padre' },
]

export default function Layout({ children }) {
  const { usuario, usuarioReal, vistaComoRol, setVistaComoRol, salir, tienePermiso } = useAuth()
  const { ruta, navegar } = useNav()
  const [abierto, setAbierto] = useState(false)
  const [rolPickerAbierto, setRolPickerAbierto] = useState(false)
  const rolPickerRef = useRef(null)

  // Secciones colapsables — inicializa abriendo la sección que contiene la ruta actual
  const [seccionesAbiertas, setSeccionesAbiertas] = useState(() => {
    const abiertas = new Set()
    let secActual = null
    for (const item of NAV_ITEMS) {
      if (item.seccion) { secActual = item.seccion }
      else if (item.id === ruta && secActual) abiertas.add(secActual)
    }
    return abiertas
  })

  function toggleSeccion(nombre) {
    setSeccionesAbiertas(prev => {
      const next = new Set(prev)
      next.has(nombre) ? next.delete(nombre) : next.add(nombre)
      return next
    })
  }
  const [noLeidos, setNoLeidos] = useState(0)
  const [notifCount, setNotifCount] = useState(0)
  const [notifAbiertas, setNotifAbiertas] = useState(false)
  const [notificaciones, setNotificaciones] = useState([])
  const [plantelNombre, setPlantelNombre] = useState('')
  const notifRef = useRef(null)

  const rolCfg = ROL_PERMISOS[usuario.rol]

  // Soporte para permiso array y secciones
  const itemsConPermiso = NAV_ITEMS.filter(item => {
    if (item.seccion) return true
    if (!item.permiso) return true
    if (Array.isArray(item.permiso)) return item.permiso.some(p => tienePermiso(p))
    return tienePermiso(item.permiso)
  })
  // Eliminar secciones que no tienen ningún ítem visible debajo de ellas
  const items = itemsConPermiso.filter((item, i) => {
    if (!item.seccion) return true
    for (let j = i + 1; j < itemsConPermiso.length; j++) {
      if (itemsConPermiso[j].seccion) break
      return true
    }
    return false
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

  // Abrir sección automáticamente al navegar a una ruta dentro de ella
  useEffect(() => {
    let sec = null
    for (const item of NAV_ITEMS) {
      if (item.seccion) sec = item.seccion
      else if (item.id === ruta && sec) {
        setSeccionesAbiertas(prev => prev.has(sec) ? prev : new Set([...prev, sec]))
        break
      }
    }
  }, [ruta])

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    function onClickFuera(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifAbiertas(false)
      }
      if (rolPickerRef.current && !rolPickerRef.current.contains(e.target)) {
        setRolPickerAbierto(false)
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
          {(() => {
            let seccionActual = null
            return items.map((item, i) => {
              if (item.seccion) {
                seccionActual = item.seccion
                const abierta = seccionesAbiertas.has(item.seccion)
                return (
                  <button key={'sec-' + i} onClick={() => toggleSeccion(item.seccion)}
                    className="nav-item"
                    style={{ marginTop: 6, fontWeight: 600, fontSize: 13 }}>
                    <span className="nav-icon">{item.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.seccion}</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" style={{ transition: 'transform .2s', transform: abierta ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0, opacity: 0.5 }}>
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )
              }

              const visible = !seccionActual || seccionesAbiertas.has(seccionActual)
              if (!visible) return null

              return (
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
              )
            })
          })()}
        </nav>

        <button className="nav-salir" onClick={salir}>
          <span>↩</span> Cerrar sesión
        </button>
      </aside>

      <div className="main-wrapper">
        {vistaComoRol && (
          <div style={{
            background: '#f59e0b', color: '#7c2d12',
            padding: '7px 20px', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, borderBottom: '1px solid #d97706',
          }}>
            <span>👁 Vista simulada como: <strong>{ROL_PERMISOS[vistaComoRol]?.label || vistaComoRol}</strong> — los cambios que hagas son reales</span>
            <button onClick={() => setVistaComoRol(null)} style={{
              background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: 6,
              padding: '3px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: 'inherit',
            }}>
              ✕ Volver a Super Admin
            </button>
          </div>
        )}

        <header className="topbar">
          <button className="hamburger" onClick={() => setAbierto(!abierto)}>☰</button>
          <h1 className="topbar-titulo">
            {items.find(i => !i.seccion && i.id === ruta)?.label || 'Inicio'}
          </h1>
          <div className="topbar-derecha">
            {/* Selector de vista por rol — solo para superadmin real */}
            {usuarioReal?.rol === 'superadmin' && (
              <div ref={rolPickerRef} style={{ position: 'relative' }}>
                <button
                  className="btn-tema"
                  onClick={() => setRolPickerAbierto(v => !v)}
                  title="Cambiar vista de rol"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                    padding: '4px 10px', borderRadius: 8,
                    background: vistaComoRol ? 'rgba(245,158,11,0.18)' : undefined,
                    fontWeight: vistaComoRol ? 700 : undefined,
                  }}
                >
                  <span>👁</span>
                  <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {vistaComoRol ? ROL_PERMISOS[vistaComoRol]?.label : 'Vista'}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.5 }}>
                    <path d="M2 3l3 4 3-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  </svg>
                </button>

                {rolPickerAbierto && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: 200, background: 'var(--bg-2)',
                    border: '1px solid var(--borde)', borderRadius: 10,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.22)', zIndex: 200, overflow: 'hidden',
                  }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--borde)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--texto-muted)' }}>
                      Simular vista como
                    </div>
                    <button
                      onClick={() => { setVistaComoRol(null); setRolPickerAbierto(false) }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '9px 14px',
                        border: 'none', cursor: 'pointer', fontSize: 13,
                        background: !vistaComoRol ? 'rgba(241,139,17,0.12)' : 'transparent',
                        fontWeight: !vistaComoRol ? 700 : 400, color: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <span>⚡</span> Modo Super Admin
                    </button>
                    {ROLES_SIMULABLES.map(r => (
                      <button
                        key={r.rol}
                        onClick={() => { setVistaComoRol(r.rol); setRolPickerAbierto(false) }}
                        style={{
                          width: '100%', textAlign: 'left', padding: '9px 14px',
                          border: 'none', cursor: 'pointer', fontSize: 13,
                          background: vistaComoRol === r.rol ? 'rgba(241,139,17,0.12)' : 'transparent',
                          fontWeight: vistaComoRol === r.rol ? 700 : 400, color: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 8,
                          borderTop: '1px solid var(--borde)',
                        }}
                      >
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: ROL_PERMISOS[r.rol]?.color || '#888',
                        }} />
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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
