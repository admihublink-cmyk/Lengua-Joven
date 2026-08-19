import { useEffect, useState, useRef } from 'react'
import * as api from '../api'

const ETAPAS = [
  { key: 'falta_grupo', label: 'Sin grupo', color: '#6b7280', desc: 'No se puede generar liga sin grupo asignado.' },
  { key: 'pendiente',   label: 'Pendientes', color: '#d97706', desc: 'Tienen grupo, listos para incluir en el próximo lote.' },
  { key: 'en_lote',     label: 'En lote',    color: '#2563eb', desc: 'CSV generado, pendiente de descargar y subir a Banorte.' },
  { key: 'descargado',  label: 'Descargado', color: '#7c3aed', desc: 'Admin descargó el CSV, esperando que Banorte genere ligas.' },
  { key: 'con_liga',    label: 'Con liga',   color: '#059669', desc: 'Liga cargada desde Banorte, pendiente de notificar.' },
  { key: 'avisado',     label: 'Avisados',   color: '#64748b', desc: 'Alumno notificado por correo.' },
]

export default function LigasPago() {
  const [data, setData] = useState(null)
  const [etapaVista, setEtapaVista] = useState('pendiente')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [loteSeleccionado, setLoteSeleccionado] = useState(null)
  const [cargandoLigas, setCargandoLigas] = useState(false)
  const fileRef = useRef()

  async function cargar() {
    try {
      const d = await api.getLigasPipeline()
      setData(d)
    } catch (e) {
      setMsg({ tipo: 'error', texto: e.message })
    }
  }

  useEffect(() => { cargar() }, [])

  function notif(tipo, texto) {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 5000)
  }

  async function handleGenerarLote() {
    setLoading(true)
    try {
      const { filename } = await api.generarLote()
      notif('ok', `Lote generado: ${filename}. Súbelo a Banorte y luego marca la descarga.`)
      await cargar()
    } catch (e) {
      notif('error', e.message)
    } finally { setLoading(false) }
  }

  async function handleMarcarBajado(lote) {
    setLoading(true)
    try {
      const r = await api.marcarLoteBajado(lote)
      notif('ok', `${r.marcadas} inscripciones del lote "${lote}" marcadas como descargadas.`)
      await cargar()
    } catch (e) {
      notif('error', e.message)
    } finally { setLoading(false) }
  }

  async function handleDevolver(lote, rehacer) {
    if (!confirm(`¿Devolver lote "${lote}" al estado pendiente?${rehacer ? '\nSe eliminarán las referencias (se generarán nuevas).' : ''}`)) return
    setLoading(true)
    try {
      await api.devolverLote(lote, rehacer)
      notif('ok', `Lote "${lote}" devuelto.`)
      await cargar()
    } catch (e) {
      notif('error', e.message)
    } finally { setLoading(false) }
  }

  // Cargar ligas desde CSV de Banorte
  async function handleArchivoBanorte(e) {
    const file = e.target.files[0]
    if (!file) return
    setCargandoLigas(true)
    try {
      const texto = await file.text()
      const lineas = texto.split(/\r?\n/).filter(l => l.trim())
      const cabecera = lineas[0].split(',').map(c => c.trim().toLowerCase())
      const iRef = cabecera.indexOf('referencia')
      const iLiga = cabecera.findIndex(c => c.includes('liga') || c.includes('url') || c.includes('link'))
      if (iRef === -1 || iLiga === -1) {
        notif('error', 'El CSV debe tener columnas "Referencia" y "Liga" (o URL/Link).')
        return
      }
      const ligas = lineas.slice(1).map(l => {
        const cols = l.split(',')
        return { referencia: (cols[iRef] || '').trim(), liga_pago: (cols[iLiga] || '').trim() }
      }).filter(l => l.referencia && l.liga_pago)

      const r = await api.cargarLigasBanorte(ligas)
      notif('ok', `${r.cargadas} ligas cargadas. ${r.noEncontradas} referencias no encontradas.`)
      await cargar()
    } catch (err) {
      notif('error', err.message)
    } finally {
      setCargandoLigas(false)
      e.target.value = ''
    }
  }

  async function handleAvisar(ids) {
    setLoading(true)
    try {
      const r = await api.avisarLigas(ids)
      notif('ok', `Enviados: ${r.enviados} correos. Fallidos: ${r.fallidos}.`)
      await cargar()
    } catch (e) {
      notif('error', e.message)
    } finally { setLoading(false) }
  }

  const inscripciones = data?.inscripciones || []
  const conteos = data?.conteos || {}
  const lotes = data?.lotes || []

  const visibles = inscripciones.filter(i => i.etapa === etapaVista)
  const etapaInfo = ETAPAS.find(e => e.key === etapaVista)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Ligas de Pago Banorte</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-primario"
            onClick={handleGenerarLote}
            disabled={loading || !conteos.pendiente}
            title={!conteos.pendiente ? 'No hay inscripciones pendientes con grupo asignado' : ''}
          >
            Generar lote CSV {conteos.pendiente ? `(${conteos.pendiente})` : ''}
          </button>
          <label
            className="btn-secundario"
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
          >
            {cargandoLigas ? 'Cargando…' : 'Subir ligas de Banorte'}
            <input type="file" accept=".csv" style={{ display: 'none' }} ref={fileRef} onChange={handleArchivoBanorte} />
          </label>
          <button
            className="btn-secundario"
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, cursor: 'pointer' }}
            onClick={() => handleAvisar([])}
            disabled={loading || !conteos.con_liga}
            title={!conteos.con_liga ? 'No hay ligas pendientes de notificar' : ''}
          >
            Avisar por correo {conteos.con_liga ? `(${conteos.con_liga})` : ''}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 16,
          background: msg.tipo === 'ok' ? '#d1fae5' : '#fee2e2',
          color: msg.tipo === 'ok' ? '#065f46' : '#991b1b',
          border: `1px solid ${msg.tipo === 'ok' ? '#6ee7b7' : '#fca5a5'}`
        }}>
          {msg.texto}
        </div>
      )}

      {/* Pipeline visual */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {ETAPAS.map(e => (
          <button
            key={e.key}
            onClick={() => setEtapaVista(e.key)}
            title={e.desc}
            style={{
              flex: '0 0 auto',
              padding: '12px 16px',
              borderRadius: 8,
              border: `2px solid ${etapaVista === e.key ? e.color : '#e5e7eb'}`,
              background: etapaVista === e.key ? e.color + '18' : '#fff',
              cursor: 'pointer',
              textAlign: 'center',
              minWidth: 110,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: e.color }}>{conteos[e.key] ?? 0}</div>
            <div style={{ fontSize: 13, color: '#374151' }}>{e.label}</div>
          </button>
        ))}
      </div>

      {/* Lotes activos en "en_lote" */}
      {etapaVista === 'en_lote' && lotes.length > 0 && (
        <div style={{ marginBottom: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12 }}>
          <strong style={{ fontSize: 13 }}>Lotes generados pendientes de descarga:</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {lotes.map(lote => (
              <div key={lote} style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#fff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
                <span>{lote}</span>
                <button
                  onClick={() => handleMarcarBajado(lote)}
                  disabled={loading}
                  style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, border: '1px solid #2563eb', color: '#2563eb', background: 'transparent', cursor: 'pointer' }}
                >
                  Marcar bajado
                </button>
                <button
                  onClick={() => handleDevolver(lote, false)}
                  disabled={loading}
                  style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, border: '1px solid #dc2626', color: '#dc2626', background: 'transparent', cursor: 'pointer' }}
                >
                  Devolver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de inscripciones de la etapa seleccionada */}
      {!data ? (
        <p style={{ color: '#6b7280' }}>Cargando…</p>
      ) : visibles.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No hay inscripciones en esta etapa.</p>
      ) : (
        <>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#6b7280' }}>
            {etapaInfo?.desc}
          </div>
          {etapaVista === 'con_liga' && (
            <button
              className="btn-primario"
              style={{ marginBottom: 12, fontSize: 13 }}
              onClick={() => handleAvisar(visibles.map(v => v.id))}
              disabled={loading}
            >
              Avisar a todos en esta etapa ({visibles.length})
            </button>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={th}>Folio</th>
                  <th style={th}>Nombre</th>
                  <th style={th}>Email</th>
                  <th style={th}>Monto</th>
                  {['en_lote','descargado','con_liga','avisado'].includes(etapaVista) && <th style={th}>Lote</th>}
                  {['en_lote','descargado','con_liga','avisado'].includes(etapaVista) && <th style={th}>Referencia</th>}
                  {etapaVista === 'con_liga' && <th style={th}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {visibles.map(ins => (
                  <tr key={ins.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={td}>{ins.folio}</td>
                    <td style={td}>{ins.nombre || '—'}</td>
                    <td style={td}>{ins.email || '—'}</td>
                    <td style={td}>
                      {ins.liga_monto ? `$${Number(ins.liga_monto).toLocaleString('es-MX')}` : '—'}
                    </td>
                    {['en_lote','descargado','con_liga','avisado'].includes(etapaVista) && (
                      <td style={td}>{ins.liga_lote || '—'}</td>
                    )}
                    {['en_lote','descargado','con_liga','avisado'].includes(etapaVista) && (
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{ins.liga_referencia || '—'}</td>
                    )}
                    {etapaVista === 'con_liga' && (
                      <td style={td}>
                        <button
                          onClick={() => handleAvisar([ins.id])}
                          disabled={loading}
                          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #059669', color: '#059669', background: 'transparent', cursor: 'pointer' }}
                        >
                          Avisar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const th = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }
const td = { padding: '10px 12px', color: '#374151', verticalAlign: 'middle' }
