import { useState, useEffect, createContext, useContext } from 'react'
import { tienePermiso } from './auth.js'
import { getUsuarioActual, logout as apiLogout } from './api.js'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Planteles from './pages/Planteles.jsx'
import Idiomas from './pages/Idiomas.jsx'
import Grupos from './pages/Grupos.jsx'
import Asistencia from './pages/Asistencia.jsx'
import Evaluacion from './pages/Evaluacion.jsx'
import PlacementTest from './pages/PlacementTest.jsx'
import Inscripciones from './pages/Inscripciones.jsx'
import Pagos from './pages/Pagos.jsx'
import Avisos from './pages/Avisos.jsx'
import Reportes from './pages/Reportes.jsx'
import Configuracion from './pages/Configuracion.jsx'
import Calendario from './pages/Calendario.jsx'
import Clase from './pages/Clase.jsx'
import Mensajes from './pages/Mensajes.jsx'
import Tareas from './pages/Tareas.jsx'
import Perfil from './pages/Perfil.jsx'
import Buzon from './pages/Buzon.jsx'
import Convenios from './pages/Convenios.jsx'
import OfertaEducativa from './pages/OfertaEducativa.jsx'
import Actividad from './pages/Actividad.jsx'

export const AuthCtx = createContext(null)
export const NavCtx  = createContext(null)
export const TemaCtx = createContext(null)

export function useAuth() { return useContext(AuthCtx) }
export function useNav()  { return useContext(NavCtx)  }
export function useTema() { return useContext(TemaCtx) }

const RUTAS = {
  dashboard: Dashboard,
  planteles: Planteles,
  idiomas: Idiomas,
  grupos: Grupos,
  asistencia: Asistencia,
  evaluacion: Evaluacion,
  placement: PlacementTest,
  inscripciones: Inscripciones,
  pagos: Pagos,
  avisos: Avisos,
  reportes: Reportes,
  configuracion: Configuracion,
  calendario: Calendario,
  clase: Clase,
  mensajes: Mensajes,
  tareas: Tareas,
  perfil: Perfil,
  buzon: Buzon,
  convenios: Convenios,
  oferta: OfertaEducativa,
  actividad: Actividad,
}

export default function App() {
  const [usuario, setUsuario] = useState(() => getUsuarioActual())
  const [ruta, setRuta] = useState('dashboard')
  const [params, setParams] = useState({})
  const tema = 'light'

  useEffect(() => {
    const currentUser = getUsuarioActual()
    if (!currentUser && typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('lj_user')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed?.id) setUsuario(parsed)
        }
      } catch {}
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
  }, [])

  function entrar(u) {
    setUsuario(u); setRuta('dashboard'); setParams({})
  }
  function salir() {
    apiLogout()
    setUsuario(null)
  }
  function navegar(r, p = {}) { setRuta(r); setParams(p) }

  if (!usuario) return <Login onLogin={entrar} />

  const Pagina = RUTAS[ruta] || Dashboard

  return (
    <AuthCtx.Provider value={{ usuario, salir, tienePermiso: (p) => tienePermiso(usuario, p) }}>
      <NavCtx.Provider value={{ ruta, navegar, params }}>
        <TemaCtx.Provider value={{ tema }}>
          <Layout>
            <Pagina params={params} />
          </Layout>
        </TemaCtx.Provider>
      </NavCtx.Provider>
    </AuthCtx.Provider>
  )
}
