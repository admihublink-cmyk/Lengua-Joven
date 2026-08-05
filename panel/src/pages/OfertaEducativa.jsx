import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

function formatoCosto(o) {
  const monto = typeof o.costo === 'number' ? `$${o.costo.toLocaleString()}` : o.costo
  return o.costo_tipo === 'anual' ? `${monto} / año` : `${monto} / bimestral`
}

const ICONO_IDIOMA = {
  'Inglés': '🇺🇸', 'Francés': '🇫🇷', 'Alemán': '🇩🇪', 'Italiano': '🇮🇹',
  'Portugués': '🇧🇷', 'Chino': '🇨🇳', 'Coreano': '🇰🇷', 'Japonés': '🇯🇵',
  'Español': '🇪🇸', 'Búlgaro': '🇧🇬', 'Checo': '🇨🇿', 'Danés': '🇩🇰',
  'Griego': '🇬🇷', 'Estonio': '🇪🇪', 'Croata': '🇭🇷', 'Húngaro': '🇭🇺',
  'Lituano': '🇱🇹', 'Letón': '🇱🇻', 'Neerlandés': '🇳🇱', 'Polaco': '🇵🇱',
  'Rumano': '🇷🇴', 'Eslovaco': '🇸🇰', 'Eslovenio': '🇸🇮', 'Sueco': '🇸🇪',
}
function iconoIdioma(nombre) { return ICONO_IDIOMA[nombre] || '🌐' }

const COLOR_CATEGORIA = {
  'Teens': '#9b59b6', 'Jóvenes': '#2980b9', 'Plus': '#16a085',
  'Children': '#e67e22', 'Autodidacta': '#27ae60',
}

export default function OfertaEducativa() {
  const { usuario, tienePermiso } = useAuth()
  const [ofertas, setOfertas] = useState([])
  const [idiomas, setIdiomas] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [planteles, setPlanteles] = useState([])
  const [alumnos, setAlumnos] = useState([])

  const [vista, setVista] = useState('escuelas')   // 'escuelas' | 'catalogo'
  const [expandidos, setExpandidos] = useState({}) // { proveedorKey: true/false }

  const [fIdioma, setFIdioma] = useState('todos')
  const [fCategoria, setFCategoria] = useState('todos')
  const [fModalidad, setFModalidad] = useState('todos')
  const [fProveedor, setFProveedor] = useState('todos')
  const [busca, setBusca] = useState('')

  const [sel, setSel] = useState(null)
  const [modalInsc, setModalInsc] = useState(false)
  const [formInsc, setFormInsc] = useState({})
  const [inscErr, setInscErr] = useState('')

  const puedeInscribir = tienePermiso(P.INSC_CREAR)
  // Si el usuario tiene proveedor asignado (es staff de una escuela socia), solo ve esa escuela
  const proveedorFijo = usuario.proveedor || null

  async function cargar() {
    try {
      const [todasOfertas, prov, p, u] = await Promise.all([
        api.getOfertas(),
        proveedorFijo ? Promise.resolve([proveedorFijo]) : api.getProveedoresOferta(),
        api.getPlanteles(),
        api.getUsuarios(),
      ])
      const ofertasFiltradas = proveedorFijo
        ? todasOfertas.filter(o => o.proveedor === proveedorFijo)
        : todasOfertas
      setOfertas(ofertasFiltradas)
      setIdiomas([...new Set(ofertasFiltradas.map(o => o.idioma))].sort())
      setProveedores(prov)
      setPlanteles(p)
      const todosAlumnos = u.filter(x => x.rol === 'alumno')
      setAlumnos(usuario.plantel_id ? todosAlumnos.filter(a => a.plantel_id === usuario.plantel_id) : todosAlumnos)
    } catch (e) {
      console.error('Error cargando oferta educativa:', e)
    }
  }
  useEffect(() => { cargar() }, [])

  const categorias = [...new Set(ofertas.map(o => o.categoria))].filter(Boolean).sort()
  const modalidades = [...new Set(ofertas.map(o => o.modalidad))].filter(Boolean).sort()

  const filtradas = ofertas.filter(o => {
    if (fIdioma !== 'todos' && o.idioma !== fIdioma) return false
    if (fCategoria !== 'todos' && o.categoria !== fCategoria) return false
    if (fModalidad !== 'todos' && o.modalidad !== fModalidad) return false
    if (fProveedor !== 'todos' && o.proveedor !== fProveedor) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (![o.proveedor, o.idioma, o.sede, o.horario].some(v => (v || '').toLowerCase().includes(q))) return false
    }
    return true
  })

  // Agrupar por proveedor → idioma para vista por escuela
  const porEscuela = proveedores.map(prov => {
    const ofProv = filtradas.filter(o => o.proveedor === prov)
    const idiomasProv = [...new Set(ofProv.map(o => o.idioma))].sort()
    return {
      proveedor: prov,
      total: ofProv.length,
      idiomas: idiomasProv.map(idioma => ({
        idioma,
        opciones: ofProv.filter(o => o.idioma === idioma),
      })),
    }
  }).filter(e => e.total > 0)

  function toggleExpandido(prov) {
    setExpandidos(prev => ({ ...prev, [prov]: !prev[prov] }))
  }
  function isExpandido(prov) { return expandidos[prov] !== false } // abierto por defecto

  function abrirInscribir(oferta) {
    setFormInsc({
      oferta_id: oferta.id,
      modo: usuario.rol === 'alumno' ? 'yo' : 'alumno_existente',
      alumno_id: usuario.rol === 'alumno' ? usuario.id : '',
      plantel_id: usuario.plantel_id || '',
      nombre_externo: '', email_externo: '', tel_externo: '',
    })
    setInscErr('')
    setModalInsc(true)
  }

  async function confirmarInscripcion() {
    setInscErr('')
    if (formInsc.modo === 'alumno_existente' && !formInsc.alumno_id) {
      setInscErr('Selecciona un alumno.'); return
    }
    if (formInsc.modo === 'externo' && !formInsc.nombre_externo.trim()) {
      setInscErr('El nombre es requerido.'); return
    }
    try {
      await api.crearInscripcion({
        oferta_id: formInsc.oferta_id,
        alumno_id: formInsc.modo !== 'externo' ? formInsc.alumno_id : null,
        plantel_id: formInsc.plantel_id || null,
        nombre_externo: formInsc.modo === 'externo' ? formInsc.nombre_externo : '',
        email_externo: formInsc.email_externo,
        tel_externo: formInsc.tel_externo,
        estado: 'nueva',
      })
      setModalInsc(false)
      setSel(null)
    } catch (e) {
      setInscErr('Error: ' + e.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Oferta Educativa — Escuelas Socias</h2>
        <div style={{ display: 'flex', gap: 0 }}>
          {[['escuelas', 'Por escuela'], ['catalogo', 'Catálogo']].map(([v, label]) => (
            <button key={v} onClick={() => setVista(v)} style={{
              padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--borde)',
              borderRadius: v === 'escuelas' ? '8px 0 0 8px' : '0 8px 8px 0',
              background: vista === v ? 'var(--naranja)' : 'var(--bg-3)',
              color: vista === v ? '#fff' : 'var(--texto)',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {proveedorFijo ? (
        <div className="alerta info" style={{ marginBottom: 14, fontSize: 13 }}>
          Mostrando únicamente la oferta de <strong>{proveedorFijo}</strong>.
        </div>
      ) : (
        <p className="texto-muted" style={{ marginBottom: 14, fontSize: 13 }}>
          Catálogo de cursos de idiomas ofrecidos por escuelas externas aliadas al programa.
          {puedeInscribir && ' Puedes inscribir a un alumno directamente desde aquí.'}
        </p>
      )}

      {/* Filtros comunes a ambas vistas */}
      <div className="filtros-bar" style={{ flexWrap: 'wrap' }}>
        <input placeholder="Buscar escuela, idioma, sede, horario…" value={busca}
          onChange={e => setBusca(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select value={fIdioma} onChange={e => setFIdioma(e.target.value)}>
          <option value="todos">Todos los idiomas</option>
          {idiomas.map(i => <option key={i} value={i}>{iconoIdioma(i)} {i}</option>)}
        </select>
        <select value={fCategoria} onChange={e => setFCategoria(e.target.value)}>
          <option value="todos">Todas las edades</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fModalidad} onChange={e => setFModalidad(e.target.value)}>
          <option value="todos">Toda modalidad</option>
          {modalidades.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {vista === 'catalogo' && (
          <select value={fProveedor} onChange={e => setFProveedor(e.target.value)}>
            <option value="todos">Toda escuela</option>
            {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      <div className="texto-muted chico" style={{ margin: '4px 0 16px' }}>
        {filtradas.length} opciones en {porEscuela.length} escuela{porEscuela.length !== 1 ? 's' : ''}
      </div>

      {/* ── Vista Por Escuela ── */}
      {vista === 'escuelas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {porEscuela.length === 0 && (
            <p className="texto-muted">No hay opciones que coincidan con tu búsqueda.</p>
          )}
          {porEscuela.map(esc => {
            const abierto = isExpandido(esc.proveedor)
            return (
              <div key={esc.proveedor} className="card" style={{ padding: 0, overflow: 'hidden' }}>

                {/* Cabecera de la escuela — clic para colapsar */}
                <button
                  onClick={() => toggleExpandido(esc.proveedor)}
                  style={{
                    width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left', gap: 10,
                    borderBottom: abierto ? '1px solid var(--borde)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{esc.proveedor}</div>
                    <div className="texto-muted chico" style={{ marginTop: 2 }}>
                      {esc.idiomas.length} idioma{esc.idiomas.length !== 1 ? 's' : ''} · {esc.total} opción{esc.total !== 1 ? 'es' : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: 'var(--texto-muted)', flexShrink: 0 }}>
                    {abierto ? '▾' : '▸'}
                  </span>
                </button>

                {/* Contenido desglosado */}
                {abierto && (
                  <div style={{ padding: '12px 20px 20px' }}>
                    {esc.idiomas.map(({ idioma, opciones }) => (
                      <div key={idioma} style={{ marginBottom: 18 }}>
                        {/* Encabezado de idioma */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 20 }}>{iconoIdioma(idioma)}</span>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--naranja)' }}>{idioma}</span>
                          <span className="texto-muted chico">({opciones.length} opción{opciones.length !== 1 ? 'es' : ''})</span>
                        </div>

                        {/* Tabla de opciones */}
                        <div style={{ overflowX: 'auto' }}>
                          <table className="tabla chica" style={{ marginBottom: 0 }}>
                            <thead>
                              <tr>
                                <th>Categoría / Edad</th>
                                <th>Modalidad</th>
                                <th>Sede</th>
                                <th>Horario</th>
                                <th>Costo</th>
                                <th>Niveles</th>
                                <th>Examen ubic.</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {opciones.map(o => (
                                <tr key={o.id}>
                                  <td>
                                    <span style={{
                                      display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11,
                                      fontWeight: 600, background: (COLOR_CATEGORIA[o.categoria] || '#888') + '22',
                                      color: COLOR_CATEGORIA[o.categoria] || '#888',
                                    }}>
                                      {o.categoria}
                                    </span>
                                    {o.edades && <div className="texto-muted" style={{ fontSize: 11, marginTop: 2 }}>{o.edades}</div>}
                                  </td>
                                  <td>
                                    <span className={`badge ${o.modalidad === 'Presencial' ? 'asignada' : 'pagada'}`}>
                                      {o.modalidad === 'Presencial' ? '🏫' : '💻'} {o.modalidad}
                                    </span>
                                  </td>
                                  <td className="texto-muted" style={{ fontSize: 11, maxWidth: 200 }}>
                                    {o.sede && o.sede !== 'En Línea' && o.sede !== 'Item Línea' && o.sede !== 'Cultural Línea'
                                      ? o.sede : <em>En línea</em>}
                                  </td>
                                  <td style={{ fontSize: 12 }}>{o.horario}</td>
                                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatoCosto(o)}</td>
                                  <td style={{ textAlign: 'center' }}>{o.no_niveles || '—'}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span className={`badge ${o.examen_ubicacion === 'Si' ? 'asignada' : o.examen_ubicacion === 'No' ? 'baja' : 'nueva'}`}>
                                      {o.examen_ubicacion}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button className="btn-mini" onClick={() => setSel(o)}>Detalle</button>
                                      {puedeInscribir && (
                                        <button className="btn-mini" style={{ background: 'var(--naranja)', color: '#fff', borderColor: 'var(--naranja)' }}
                                          onClick={() => abrirInscribir(o)}>Inscribir</button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Vista Catálogo (tarjetas) ── */}
      {vista === 'catalogo' && (
        <div className="card-grid">
          {filtradas.map(o => (
            <div key={o.id} className="card plantel-card" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                <h3 style={{ marginBottom: 2 }}>{iconoIdioma(o.idioma)} {o.idioma}</h3>
                <span style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                  background: (COLOR_CATEGORIA[o.categoria] || '#888') + '22',
                  color: COLOR_CATEGORIA[o.categoria] || '#888',
                }}>{o.categoria}</span>
              </div>
              <p className="texto-muted chico" style={{ margin: '2px 0 8px' }}>{o.proveedor}</p>
              <p style={{ fontSize: 13, marginBottom: 4 }}>💰 <strong>{formatoCosto(o)}</strong></p>
              <p style={{ fontSize: 13, marginBottom: 4 }}>
                {o.modalidad === 'Presencial' ? '🏫' : '💻'} {o.modalidad}
              </p>
              <p style={{ fontSize: 13, marginBottom: 8, color: 'var(--texto-muted)' }}>🕐 {o.horario}</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                <button className="btn-sec" onClick={() => setSel(o)}>Ver detalle</button>
                {puedeInscribir && (
                  <button className="btn-primario" onClick={() => abrirInscribir(o)}>Inscribir</button>
                )}
              </div>
            </div>
          ))}
          {filtradas.length === 0 && <p className="texto-muted">No hay opciones que coincidan con tu búsqueda.</p>}
        </div>
      )}

      {/* Modal detalle */}
      {sel && (
        <Modal titulo={`${iconoIdioma(sel.idioma)} ${sel.idioma} — ${sel.proveedor}`} onClose={() => setSel(null)} ancho={580}>
          <div className="detalle-grid">
            <div style={{ gridColumn: '1/-1' }}>
              <label>Escuela / Proveedor</label>
              <p style={{ fontWeight: 600 }}>{sel.proveedor}</p>
            </div>
            <div>
              <label>Idioma</label>
              <p>{iconoIdioma(sel.idioma)} {sel.idioma}</p>
            </div>
            <div>
              <label>Categoría / Edades</label>
              <p>
                <span style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12,
                  fontWeight: 600, background: (COLOR_CATEGORIA[sel.categoria] || '#888') + '22',
                  color: COLOR_CATEGORIA[sel.categoria] || '#888',
                }}>{sel.categoria}</span>
                {sel.edades && <span className="texto-muted" style={{ marginLeft: 6, fontSize: 12 }}>({sel.edades})</span>}
              </p>
            </div>
            <div>
              <label>Modalidad</label>
              <p>{sel.modalidad === 'Presencial' ? '🏫' : '💻'} {sel.modalidad}</p>
            </div>
            <div>
              <label>Sistema</label><p>{sel.sistema}</p>
            </div>
            <div>
              <label>Costo</label>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{formatoCosto(sel)}</p>
            </div>
            <div>
              <label>Material por nivel</label>
              <p>{typeof sel.material_nivel === 'number' ? `$${sel.material_nivel.toLocaleString()}` : (sel.material_nivel || '—')}</p>
            </div>
            <div>
              <label>No. de niveles</label><p>{sel.no_niveles || '—'}</p>
            </div>
            <div>
              <label>Nivel de esta oferta</label><p>{sel.nivel || '—'}</p>
            </div>
            <div>
              <label>Examen de ubicación</label>
              <p><span className={`badge ${sel.examen_ubicacion === 'Si' ? 'asignada' : sel.examen_ubicacion === 'No' ? 'baja' : 'nueva'}`}>{sel.examen_ubicacion}</span></p>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label>Sede / Dirección</label>
              <p>{sel.sede && sel.sede !== 'En Línea' && sel.sede !== 'Item Línea' && sel.sede !== 'Cultural Línea'
                ? sel.sede : '🖥️ En línea'}</p>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label>Horario</label>
              <p>🕐 {sel.horario}</p>
            </div>
          </div>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setSel(null)}>Cerrar</button>
            {puedeInscribir && (
              <button className="btn-primario" onClick={() => abrirInscribir(sel)}>Inscribir alumno</button>
            )}
          </div>
        </Modal>
      )}

      {/* Modal inscribir */}
      {modalInsc && (
        <Modal titulo="Inscribir a oferta educativa" onClose={() => setModalInsc(false)} ancho={520}>
          {usuario.rol !== 'alumno' && (
            <label>¿A quién inscribes?
              <select value={formInsc.modo} onChange={e => setFormInsc({ ...formInsc, modo: e.target.value })}>
                <option value="alumno_existente">Un alumno ya registrado</option>
                <option value="externo">Una persona nueva (aún sin cuenta)</option>
              </select>
            </label>
          )}
          {formInsc.modo === 'alumno_existente' && (
            <label>Alumno *
              <select value={formInsc.alumno_id} onChange={e => setFormInsc({ ...formInsc, alumno_id: e.target.value })}>
                <option value="">Seleccionar…</option>
                {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </label>
          )}
          {formInsc.modo === 'externo' && (
            <>
              <label>Nombre completo *
                <input value={formInsc.nombre_externo} onChange={e => setFormInsc({ ...formInsc, nombre_externo: e.target.value })} />
              </label>
              <label>Correo electrónico
                <input type="email" value={formInsc.email_externo} onChange={e => setFormInsc({ ...formInsc, email_externo: e.target.value })} />
              </label>
              <label>Teléfono / WhatsApp
                <input value={formInsc.tel_externo} onChange={e => setFormInsc({ ...formInsc, tel_externo: e.target.value })} />
              </label>
            </>
          )}
          <div className="alerta info" style={{ marginTop: 10 }}>
            Se creará una inscripción con estado <strong>Nueva</strong>, ligada a la oferta de{' '}
            <strong>{ofertas.find(o => o.id === formInsc.oferta_id)?.proveedor}</strong>{' '}
            ({ofertas.find(o => o.id === formInsc.oferta_id)?.idioma}).
          </div>
          {inscErr && <p style={{ color: 'var(--rojo)', fontSize: 13, marginTop: 8 }}>{inscErr}</p>}
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModalInsc(false)}>Cancelar</button>
            <button className="btn-primario" onClick={confirmarInscripcion}>Confirmar inscripción</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
