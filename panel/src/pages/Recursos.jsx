import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App.jsx'
import { P } from '../auth.js'
import * as api from '../api.js'

const ORANGE = '#f18b11'

const ROL_OPCIONES = [
  { value: 'todos',       label: 'Todos los usuarios' },
  { value: 'alumno',      label: 'Alumnos' },
  { value: 'tutor',       label: 'Tutores / Padres de familia' },
  { value: 'profesor',    label: 'Maestros' },
  { value: 'director',    label: 'Directores' },
  { value: 'admin_ventas',label: 'Admin / Ventas' },
  { value: 'coordinador', label: 'Coordinadores' },
  { value: 'superadmin',  label: 'Super Admin' },
]

const MAX_MB = 10

function leerPDF(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_MB * 1024 * 1024) return reject(new Error(`El archivo no debe superar ${MAX_MB} MB`))
    if (file.type !== 'application/pdf') return reject(new Error('Solo se permiten archivos PDF'))
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsDataURL(file)
  })
}

async function descargar(recurso) {
  try {
    const { datos, nombre } = await api.descargarRecurso(recurso.id)
    const link = document.createElement('a')
    link.href = datos
    link.download = nombre || recurso.archivo_nombre
    link.click()
  } catch { alert('No se pudo descargar el documento') }
}

function RecursoCard({ r, puedeAdmin, onEliminar }) {
  const [descargando, setDescargando] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: '#fff', borderRadius: 12, border: '1.5px solid rgba(0,0,0,.08)', marginBottom: 10 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(241,139,17,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
        📄
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{r.titulo}</div>
        {r.descripcion && <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{r.descripcion}</div>}
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
          {r.archivo_nombre}
          {r.subido_por_nombre && ` · Subido por ${r.subido_por_nombre}`}
          {puedeAdmin && r.rol_destino && (
            <span style={{ marginLeft: 8, background: 'rgba(241,139,17,.12)', color: '#c47209', borderRadius: 6, padding: '1px 7px', fontWeight: 600 }}>
              {ROL_OPCIONES.find(o => o.value === r.rol_destino)?.label || r.rol_destino}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={async () => { setDescargando(true); await descargar(r); setDescargando(false) }}
          disabled={descargando}
          style={{ background: ORANGE, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          {descargando ? '...' : '⬇ Descargar'}
        </button>
        {puedeAdmin && (
          <button onClick={() => onEliminar(r.id)}
            style={{ background: '#e74c3c18', color: '#e74c3c', border: '1.5px solid #e74c3c44', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}

export default function Recursos() {
  const { usuario, tienePermiso } = useAuth()
  const puedeAdmin = tienePermiso(P.RECURSOS_ADMIN)

  const [recursos, setRecursos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', rol_destino: 'alumno' })
  const [archivo, setArchivo] = useState(null) // { nombre, base64, tipo }
  const [subiendo, setSubiendo] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef()

  const cargar = () => {
    const fn = puedeAdmin ? api.getRecursosTodos : api.getRecursos
    fn().then(data => setRecursos(Array.isArray(data) ? data : [])).catch(() => setRecursos([])).finally(() => setLoading(false))
  }
  useEffect(cargar, [])

  async function manejarArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return setArchivo(null)
    try {
      const base64 = await leerPDF(file)
      setArchivo({ nombre: file.name, base64, tipo: file.type })
      setErr('')
    } catch (ex) {
      setErr(ex.message)
      e.target.value = ''
    }
  }

  async function subir() {
    setErr('')
    if (!form.titulo.trim()) return setErr('El título es requerido')
    if (!archivo) return setErr('Selecciona un archivo PDF')
    setSubiendo(true)
    try {
      await api.crearRecurso({
        titulo: form.titulo,
        descripcion: form.descripcion,
        rol_destino: form.rol_destino,
        archivo_nombre: archivo.nombre,
        archivo_base64: archivo.base64,
        archivo_tipo: archivo.tipo,
      })
      setModal(false)
      setForm({ titulo: '', descripcion: '', rol_destino: 'alumno' })
      setArchivo(null)
      if (fileRef.current) fileRef.current.value = ''
      cargar()
    } catch (ex) { setErr(ex.message || 'Error al subir el documento') }
    finally { setSubiendo(false) }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return
    try { await api.eliminarRecurso(id); cargar() }
    catch { alert('Error al eliminar') }
  }

  // Agrupar recursos por rol_destino cuando el admin ve todos
  const grupos = puedeAdmin
    ? ROL_OPCIONES.filter(o => recursos.some(r => r.rol_destino === o.value))
    : null

  return (
    <div>
      <div className="page-header">
        <h2>Recursos y Manuales</h2>
        {puedeAdmin && (
          <button className="btn-primario" onClick={() => { setModal(true); setErr('') }}>+ Subir documento</button>
        )}
      </div>

      {loading ? (
        <div className="card texto-muted" style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : recursos.length === 0 ? (
        <div className="card texto-muted" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
          <p>No hay documentos disponibles aún.</p>
          {puedeAdmin && <p style={{ fontSize: 13 }}>Usa el botón "Subir documento" para agregar manuales.</p>}
        </div>
      ) : puedeAdmin ? (
        // Vista admin: agrupada por rol
        grupos.map(grupo => (
          <div key={grupo.value} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 14, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 3, height: 16, background: ORANGE, borderRadius: 2, display: 'inline-block' }} />
              {grupo.label}
            </h3>
            {recursos.filter(r => r.rol_destino === grupo.value).map(r => (
              <RecursoCard key={r.id} r={r} puedeAdmin={puedeAdmin} onEliminar={eliminar} />
            ))}
          </div>
        ))
      ) : (
        // Vista usuario: lista plana
        <div>
          {recursos.map(r => (
            <RecursoCard key={r.id} r={r} puedeAdmin={false} onEliminar={() => {}} />
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ margin: '0 0 20px' }}>Subir documento</h3>
            <label style={{ display: 'block', marginBottom: 14 }}>Título *
              <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Manual de usuario para maestros" style={{ width: '100%', marginTop: 6 }} />
            </label>
            <label style={{ display: 'block', marginBottom: 14 }}>Descripción (opcional)
              <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} placeholder="Breve descripción del documento" style={{ width: '100%', marginTop: 6 }} />
            </label>
            <label style={{ display: 'block', marginBottom: 14 }}>Destinatario *
              <select value={form.rol_destino} onChange={e => setForm({ ...form, rol_destino: e.target.value })} style={{ width: '100%', marginTop: 6 }}>
                {ROL_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 14 }}>Archivo PDF * (máx. {MAX_MB} MB)
              <input type="file" accept="application/pdf" ref={fileRef} onChange={manejarArchivo} style={{ marginTop: 6 }} />
              {archivo && <span style={{ fontSize: 12, color: '#27ae60', display: 'block', marginTop: 4 }}>✓ {archivo.nombre}</span>}
            </label>
            {err && <p style={{ color: '#e74c3c', fontSize: 13, margin: '0 0 12px' }}>{err}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setModal(false); setErr(''); setArchivo(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ background: 'rgba(0,0,0,.06)', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={subir} disabled={subiendo}
                style={{ background: ORANGE, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 700, opacity: subiendo ? 0.6 : 1 }}>
                {subiendo ? 'Subiendo...' : 'Subir documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
