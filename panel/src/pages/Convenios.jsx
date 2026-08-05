import { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import * as api from '../api.js'
import Modal from '../components/Modal.jsx'

function estadoConvenio(dias, tieneVencimiento) {
  if (!tieneVencimiento) return { label: 'Sin fecha registrada', clase: 'buzon-en_revision' }
  if (dias < 0) return { label: `Vencido hace ${Math.abs(dias)} días`, clase: 'baja' }
  if (dias <= 60) return { label: `Vence en ${dias} días`, clase: 'nueva' }
  return { label: `Vence en ${dias} días`, clase: 'asignada' }
}

const CAMPOS_INSTITUCION = [
  { key: 'razon_social', label: 'Razón social / nombre de la institución *', placeholder: 'ITEM Idiomas S. de R.L. de C.V.' },
  { key: 'representante_legal', label: 'Nombre completo del representante legal *', placeholder: 'Juan Pérez García' },
  { key: 'rfc', label: 'RFC *', placeholder: 'PEGJ850102ABC' },
  { key: 'domicilio_fiscal', label: 'Domicilio fiscal completo *', placeholder: 'Av. Constitución 123, Col. Centro, C.P. 64000, Monterrey, NL' },
  { key: 'proveedor_nombre', label: 'Nombre del proveedor (como aparece en la oferta educativa)', placeholder: 'ITEM Idiomas' },
]

const DOCUMENTOS = [
  { tipo: 'carta_constitutiva',        label: 'Carta constitutiva' },
  { tipo: 'id_representante_frente',   label: 'Identificación del representante legal (frente)' },
  { tipo: 'id_representante_reverso',  label: 'Identificación del representante legal (reverso)' },
  { tipo: 'comprobante_domicilio',     label: 'Comprobante de domicilio' },
  { tipo: 'rfc',                       label: 'RFC (persona física o moral)' },
]

export default function Convenios() {
  const { usuario } = useAuth()
  const [planteles, setPlanteles] = useState([])
  const [modal, setModal] = useState(null) // 'renovar' | 'datos' | 'documentos' | 'nuevo'
  const [plantelSel, setPlantelSel] = useState(null)
  const [form, setForm] = useState({})
  const [formNuevo, setFormNuevo] = useState({ nombre: '', ciudad: '' })
  const [guardando, setGuardando] = useState(false)
  const [generando, setGenerando] = useState(false)
  // Documentos
  const [docs, setDocs] = useState([])
  const [subiendo, setSubiendo] = useState({})
  const [borrando, setBorrando] = useState({})
  const [preview, setPreview] = useState(null) // { url, mimetype, nombre }
  const [thumbs, setThumbs] = useState({}) // { tipo: blobUrl }

  async function cargar() {
    try { setPlanteles(await api.getPlanteles()) } catch (e) { console.error(e) }
  }

  useEffect(() => { cargar() }, [])

  const hoy = new Date()
  const filas = planteles.map(p => {
    const tieneVencimiento = !!p.convenio_vencimiento
    let dias = null
    if (tieneVencimiento) {
      const venc = new Date(p.convenio_vencimiento + 'T12:00:00')
      dias = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24))
    }
    return { ...p, dias, estadoInfo: estadoConvenio(dias, tieneVencimiento) }
  }).sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity))

  const porVencer = filas.filter(f => f.dias !== null && f.dias <= 60)

  function abrirRenovar(p) {
    setPlantelSel(p)
    setForm({ convenio_vencimiento: p.convenio_vencimiento || '' })
    setModal('renovar')
  }

  function abrirDatos(p) {
    setPlantelSel(p)
    setForm({
      razon_social: p.razon_social || '',
      representante_legal: p.representante_legal || '',
      rfc: p.rfc || '',
      domicilio_fiscal: p.domicilio_fiscal || '',
      tipo_persona: p.tipo_persona || 'moral',
      proveedor_nombre: p.proveedor_nombre || '',
    })
    setModal('datos')
  }

  async function abrirDocumentos(p) {
    setPlantelSel(p)
    setModal('documentos')
    setThumbs({})
    try {
      const lista = await api.getDocumentosConvenio(p.id)
      setDocs(lista)
      cargarThumbs(p.id, lista)
    } catch { setDocs([]) }
  }

  async function cargarThumbs(plantelId, lista) {
    const token = localStorage.getItem('lj_token')
    for (const doc of lista) {
      if (!doc.mimetype?.startsWith('image/')) continue
      try {
        const res = await fetch(`/api/planteles/${plantelId}/documentos/${doc.tipo}/archivo`,
          { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          setThumbs(t => ({ ...t, [doc.tipo]: url }))
        }
      } catch {}
    }
  }

  async function subirDoc(tipo, archivo) {
    if (!archivo) return
    setSubiendo(s => ({ ...s, [tipo]: true }))
    try {
      await api.subirDocumentoConvenio(plantelSel.id, tipo, archivo)
      const lista = await api.getDocumentosConvenio(plantelSel.id)
      setDocs(lista)
      // Regenerar thumb si es imagen
      const docNuevo = lista.find(d => d.tipo === tipo)
      if (docNuevo?.mimetype?.startsWith('image/')) {
        await cargarThumbs(plantelSel.id, [docNuevo])
      }
    } catch (e) { alert('Error al subir: ' + e.message) }
    finally { setSubiendo(s => ({ ...s, [tipo]: false })) }
  }

  async function borrarDoc(tipo) {
    if (!window.confirm('¿Eliminar este documento?')) return
    setBorrando(b => ({ ...b, [tipo]: true }))
    try {
      await api.eliminarDocumentoConvenio(plantelSel.id, tipo)
      setDocs(d => d.filter(x => x.tipo !== tipo))
    } catch (e) { alert('Error: ' + e.message) }
    finally { setBorrando(b => ({ ...b, [tipo]: false })) }
  }

  async function abrirPreview(doc) {
    const token = localStorage.getItem('lj_token')
    try {
      const res = await fetch(`/api/planteles/${plantelSel.id}/documentos/${doc.tipo}/archivo`,
        { headers: { Authorization: `Bearer ${token}` } })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPreview({ url, mimetype: doc.mimetype, nombre: doc.nombre_original })
    } catch (e) { alert('No se pudo cargar el documento.') }
  }

  async function guardarFecha() {
    if (!form.convenio_vencimiento) return
    setGuardando(true)
    try {
      await api.actualizarPlantel(plantelSel.id, {
        convenio_vencimiento: form.convenio_vencimiento,
        convenio_notificado: true,
      })
      setModal(null)
      await cargar()
    } catch (e) { alert('Error: ' + e.message) } finally { setGuardando(false) }
  }

  async function guardarDatos() {
    if (!form.razon_social || !form.representante_legal || !form.rfc || !form.domicilio_fiscal) {
      alert('Completa los campos obligatorios marcados con *')
      return
    }
    setGuardando(true)
    try {
      await api.actualizarPlantel(plantelSel.id, form)
      setModal(null)
      await cargar()
    } catch (e) { alert('Error: ' + e.message) } finally { setGuardando(false) }
  }

  async function generarDOCX() {
    const p = planteles.find(x => x.id === plantelSel.id)
    if (!p?.razon_social) {
      alert('Primero guarda los datos de la institución antes de generar el convenio.')
      return
    }
    setGenerando(true)
    try {
      await api.descargarConvenioDOCX(plantelSel.id)
    } catch (e) { alert('Error al generar: ' + e.message) } finally { setGenerando(false) }
  }

  async function crearPlantel() {
    if (!formNuevo.nombre.trim()) return alert('El nombre de la escuela es requerido.')
    setGuardando(true)
    try {
      await api.crearPlantel(formNuevo)
      setModal(null)
      setFormNuevo({ nombre: '', ciudad: '' })
      await cargar()
    } catch (e) { alert('Error: ' + e.message) } finally { setGuardando(false) }
  }

  const datosCompletos = (p) => !!(p.razon_social && p.representante_legal && p.rfc && p.domicilio_fiscal)

  return (
    <div>
      <div className="page-header">
        <h2>Convenios con planteles</h2>
        <button className="btn-primario" onClick={() => { setFormNuevo({ nombre: '', ciudad: '' }); setModal('nuevo') }}>
          + Nuevo convenio
        </button>
      </div>

      {porVencer.length > 0 && (
        <div className="alerta info" style={{ marginBottom: 16 }}>
          ⏰ Tienes <strong>{porVencer.length}</strong> convenio{porVencer.length !== 1 ? 's' : ''} que vence
          {porVencer.length !== 1 ? 'n' : ''} en los próximos 60 días o ya vencido{porVencer.length !== 1 ? 's' : ''}.
        </div>
      )}

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Plantel</th><th>Ciudad</th><th>Razón social</th>
              <th>Vencimiento</th><th>Estado</th><th>Datos</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(p => (
              <tr key={p.id}>
                <td><strong>{p.nombre}</strong></td>
                <td>{p.ciudad}</td>
                <td style={{ fontSize: 12 }}>
                  {p.razon_social
                    ? <span style={{ color: 'var(--verde, #27ae60)' }}>✓ {p.razon_social}</span>
                    : <span className="texto-muted">Sin datos legales</span>}
                </td>
                <td>{p.convenio_vencimiento || '—'}</td>
                <td><span className={'badge ' + p.estadoInfo.clase}>{p.estadoInfo.label}</span></td>
                <td>
                  <span className={'badge ' + (datosCompletos(p) ? 'asignada' : 'buzon-en_revision')}>
                    {datosCompletos(p) ? '✓ Completo' : 'Pendiente'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn-mini" onClick={() => abrirRenovar(p)}>
                      {p.convenio_vencimiento ? 'Renovar' : 'Fecha'}
                    </button>
                    <button className="btn-mini" style={{ background: '#2980b9', color: '#fff', borderColor: '#2980b9' }}
                      onClick={() => abrirDatos(p)}>
                      📋 Datos
                    </button>
                    <button className="btn-mini" style={{ background: '#8e44ad', color: '#fff', borderColor: '#8e44ad' }}
                      onClick={() => abrirDocumentos(p)}>
                      📎 Docs
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={7} className="tabla-vacio">Sin planteles registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p className="texto-muted" style={{ fontSize: 13 }}>
          💡 Recibirás un recordatorio en tu Dashboard cuando falten 60 días o menos para que venza el convenio.
          Usa <strong>"Renovar"</strong> para actualizar la fecha. Usa <strong>"📋 Datos"</strong> para registrar
          los datos legales de la institución y generar el convenio en Word.
        </p>
      </div>

      {/* Modal: renovar fecha */}
      {modal === 'renovar' && plantelSel && (
        <Modal titulo={`Convenio — ${plantelSel.nombre}`} onClose={() => setModal(null)}>
          <label>Nueva fecha de vencimiento del convenio
            <input type="date" value={form.convenio_vencimiento}
              onChange={e => setForm({ ...form, convenio_vencimiento: e.target.value })} />
          </label>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={guardarFecha} disabled={guardando}>
              {guardando ? 'Guardando…' : '✓ Guardar fecha'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: datos legales de la institución */}
      {modal === 'datos' && plantelSel && (
        <Modal titulo={`📋 Datos legales — ${plantelSel.nombre}`} onClose={() => setModal(null)} ancho={600}>
          <p className="texto-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Estos datos se usarán para generar el convenio en formato Word (.docx).
          </p>

          <label>Tipo de persona *
            <select value={form.tipo_persona} onChange={e => setForm({ ...form, tipo_persona: e.target.value })}>
              <option value="moral">Persona moral (S.A., S. de R.L., A.C., etc.)</option>
              <option value="fisica">Persona física</option>
            </select>
          </label>

          {CAMPOS_INSTITUCION.map(c => (
            <label key={c.key}>{c.label}
              {c.key === 'domicilio_fiscal'
                ? <textarea rows={2} value={form[c.key] || ''} placeholder={c.placeholder}
                    onChange={e => setForm({ ...form, [c.key]: e.target.value })} />
                : <input value={form[c.key] || ''} placeholder={c.placeholder}
                    onChange={e => setForm({ ...form, [c.key]: e.target.value })} />
              }
            </label>
          ))}

          <div className="modal-acciones" style={{ flexWrap: 'wrap' }}>
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-sec" onClick={guardarDatos} disabled={guardando}>
              {guardando ? 'Guardando…' : '💾 Guardar datos'}
            </button>
            <button className="btn-primario" onClick={async () => { await guardarDatos(); if (!guardando) await generarDOCX() }}
              disabled={guardando || generando}>
              {generando ? 'Generando…' : '📄 Guardar y generar convenio DOCX'}
            </button>
          </div>

          {datosCompletos(plantelSel) && (
            <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 13 }}>
                ✓ Este plantel ya tiene datos completos.{' '}
                <button className="btn-mini" style={{ background: '#27ae60', color: '#fff', borderColor: '#27ae60' }}
                  onClick={generarDOCX} disabled={generando}>
                  {generando ? 'Generando…' : '📄 Generar convenio DOCX ahora'}
                </button>
              </p>
            </div>
          )}
        </Modal>
      )}

      {/* Modal: documentos del convenio (subida + preview) */}
      {modal === 'documentos' && plantelSel && (
        <Modal titulo={`📎 Documentos — ${plantelSel.nombre}`} onClose={() => { setModal(null); setPreview(null) }} ancho={580}>
          <p className="texto-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Sube los documentos requeridos para el convenio. Formatos aceptados: PNG, PDF (máx. 10 MB).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DOCUMENTOS.map(({ tipo, label }) => {
              const docGuardado = docs.find(d => d.tipo === tipo)
              const cargando = subiendo[tipo] || borrando[tipo]
              const esImagen = docGuardado && docGuardado.mimetype?.startsWith('image/')
              const esPDF = docGuardado && docGuardado.mimetype === 'application/pdf'

              return (
                <div key={tipo} style={{
                  borderRadius: 10,
                  border: '1px solid ' + (docGuardado ? '#27ae60' : 'var(--borde)'),
                  background: docGuardado ? 'rgba(39,174,96,0.06)' : 'var(--bg-3)',
                  overflow: 'hidden',
                  transition: 'all .2s',
                }}>
                  {/* Fila principal */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>
                      {docGuardado ? (esImagen ? '🖼' : '📄') : '📋'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13,
                        color: docGuardado ? '#27ae60' : 'inherit' }}>
                        {label}
                      </div>
                      {docGuardado && (
                        <div style={{ fontSize: 11, color: 'var(--texto-muted)', marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {docGuardado.nombre_original} · {new Date(docGuardado.fecha_subida).toLocaleDateString('es-MX')}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {docGuardado && (
                        <button className="btn-mini"
                          style={{ background: '#2980b9', color: '#fff', borderColor: '#2980b9' }}
                          onClick={() => abrirPreview(docGuardado)}>
                          👁 Ver
                        </button>
                      )}
                      {/* Botón subir / reemplazar */}
                      <label style={{
                        cursor: cargando ? 'not-allowed' : 'pointer',
                        opacity: cargando ? .6 : 1,
                      }}>
                        <input type="file" accept="image/png,.pdf" style={{ display: 'none' }}
                          disabled={cargando}
                          onChange={e => { if (e.target.files[0]) subirDoc(tipo, e.target.files[0]); e.target.value = '' }} />
                        <span className="btn-mini" style={{
                          background: docGuardado ? '#f39c12' : 'var(--naranja)',
                          color: '#fff', borderColor: docGuardado ? '#f39c12' : 'var(--naranja)',
                          display: 'inline-block', cursor: 'pointer',
                        }}>
                          {subiendo[tipo] ? '⏳' : docGuardado ? '🔄 Reemplazar' : '⬆ Subir'}
                        </span>
                      </label>
                      {docGuardado && (
                        <button className="btn-mini"
                          style={{ background: '#e74c3c', color: '#fff', borderColor: '#e74c3c' }}
                          disabled={cargando}
                          onClick={() => borrarDoc(tipo)}>
                          {borrando[tipo] ? '⏳' : '🗑'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail inline para imágenes */}
                  {esImagen && thumbs[tipo] && (
                    <div style={{ padding: '0 14px 10px', cursor: 'pointer' }}
                      onClick={() => abrirPreview(docGuardado)}>
                      <img
                        src={thumbs[tipo]}
                        alt={label}
                        style={{ maxHeight: 80, maxWidth: '100%', borderRadius: 6,
                          border: '1px solid var(--borde)', objectFit: 'contain' }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-3)',
            border: '1px solid var(--borde)', fontSize: 13, color: 'var(--texto-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{docs.length} de {DOCUMENTOS.length} documentos subidos</span>
            {docs.length === DOCUMENTOS.length && <span style={{ color: '#27ae60', fontWeight: 700 }}>✓ Expediente completo</span>}
          </div>

          <div className="modal-acciones">
            <button className="btn-primario" onClick={() => { setModal(null); setPreview(null) }}>Cerrar</button>
          </div>
        </Modal>
      )}

      {/* Modal: nuevo convenio / plantel */}
      {modal === 'nuevo' && (
        <Modal titulo="+ Nuevo convenio con escuela" onClose={() => setModal(null)}>
          <p className="texto-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Registra la escuela con la que se establecerá el convenio. Después podrás capturar sus datos legales y subir los documentos.
          </p>
          <label>Nombre de la escuela / institución *
            <input
              value={formNuevo.nombre}
              onChange={e => setFormNuevo({ ...formNuevo, nombre: e.target.value })}
              placeholder="Ej. ITEM Idiomas"
              autoFocus
            />
          </label>
          <label>Ciudad
            <input
              value={formNuevo.ciudad}
              onChange={e => setFormNuevo({ ...formNuevo, ciudad: e.target.value })}
              placeholder="Ej. Monterrey"
            />
          </label>
          <div className="modal-acciones">
            <button className="btn-sec" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primario" onClick={crearPlantel} disabled={guardando}>
              {guardando ? 'Guardando…' : '✓ Crear convenio'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: previsualización de documento */}
      {preview && (
        <Modal titulo={`👁 ${preview.nombre}`} onClose={() => setPreview(null)} ancho={700}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
            minHeight: 300, background: '#111', borderRadius: 8, overflow: 'hidden' }}>
            {preview.mimetype?.startsWith('image/') ? (
              <img
                src={preview.url}
                alt={preview.nombre}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
              />
            ) : preview.mimetype === 'application/pdf' ? (
              <iframe
                src={preview.url}
                title={preview.nombre}
                style={{ width: '100%', height: '70vh', border: 'none', display: 'block' }}
              />
            ) : (
              <p style={{ color: '#fff', padding: 32 }}>No se puede previsualizar este tipo de archivo.</p>
            )}
          </div>
          <div className="modal-acciones">
            <a href={preview.url} download={preview.nombre} className="btn-sec">⬇ Descargar</a>
            <button className="btn-primario" onClick={() => setPreview(null)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
