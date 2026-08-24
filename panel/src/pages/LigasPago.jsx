import { useEffect, useState, useRef } from 'react'
import * as api from '../api'

// Paleta INJUVE-Link
const C = {
  naranja:      '#F18B11',
  naranjaVivo:  '#FF9E2C',
  naranjaOsc:   '#B86500',
  naranjaClaro: '#FFF1DE',
  magenta:      '#D81B60',
  magentaClaro: '#FCE4EC',
  azul:         '#2D7DD2',
  azulOsc:      '#16407E',
  azulClaro:    '#E8F1FB',
  negro:        '#161310',
  texto:        '#2B2118',
  gris:         '#6E6258',
  borde:        'rgba(43,33,24,0.10)',
  exitoBg:      '#E7F5EC',
  exito:        '#1B7A3D',
  alertaBg:     '#FDECEC',
  alerta:       '#B3261E',
}

const ETAPAS = [
  { key: 'falta_grupo', label: 'Sin grupo',   color: C.gris,      colorBg: '#F4F0EB', desc: 'No se puede generar liga sin grupo asignado.' },
  { key: 'pendiente',   label: 'Pendientes',  color: C.naranjaOsc, colorBg: C.naranjaClaro, desc: 'Tienen grupo, listos para el próximo lote.' },
  { key: 'en_lote',     label: 'En lote',     color: C.azulOsc,   colorBg: C.azulClaro, desc: 'CSV generado, pendiente de subir a Banorte.' },
  { key: 'descargado',  label: 'Descargado',  color: C.magenta,   colorBg: C.magentaClaro, desc: 'Admin descargó el CSV, esperando ligas de Banorte.' },
  { key: 'con_liga',    label: 'Con liga',    color: C.exito,     colorBg: C.exitoBg, desc: 'Liga cargada desde Banorte, pendiente de notificar.' },
  { key: 'avisado',     label: 'Avisados',    color: C.texto,     colorBg: '#F4F0EB', desc: 'Alumno notificado por correo.' },
]

export default function LigasPago() {
  const [data, setData] = useState(null)
  const [etapaVista, setEtapaVista] = useState('pendiente')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
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

      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.negro }}>Ligas de Pago Banorte</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleGenerarLote}
            disabled={loading || !conteos.pendiente}
            title={!conteos.pendiente ? 'No hay inscripciones pendientes con grupo asignado' : ''}
            style={{
              background: conteos.pendiente ? C.naranja : '#e5e7eb',
              color: conteos.pendiente ? '#fff' : C.gris,
              border: 'none', borderRadius: 8, padding: '9px 18px',
              fontSize: 14, fontWeight: 700, cursor: conteos.pendiente ? 'pointer' : 'not-allowed',
              transition: 'background .2s',
            }}
          >
            Generar lote CSV {conteos.pendiente ? `(${conteos.pendiente})` : ''}
          </button>
          <label style={{
            background: '#fff', border: `1.5px solid ${C.borde}`, borderRadius: 8,
            padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, color: C.texto,
          }}>
            {cargandoLigas ? 'Cargando…' : 'Subir ligas de Banorte'}
            <input type="file" accept=".csv" style={{ display: 'none' }} ref={fileRef} onChange={handleArchivoBanorte} />
          </label>
          <button
            onClick={() => handleAvisar([])}
            disabled={loading || !conteos.con_liga}
            title={!conteos.con_liga ? 'No hay ligas pendientes de notificar' : ''}
            style={{
              background: '#fff', border: `1.5px solid ${C.borde}`, borderRadius: 8,
              padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: conteos.con_liga ? 'pointer' : 'not-allowed',
              color: conteos.con_liga ? C.texto : C.gris,
            }}
          >
            Avisar por correo {conteos.con_liga ? `(${conteos.con_liga})` : ''}
          </button>
        </div>
      </div>

      {/* Notificación */}
      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: msg.tipo === 'ok' ? C.exitoBg : C.alertaBg,
          color: msg.tipo === 'ok' ? C.exito : C.alerta,
          border: `1px solid ${msg.tipo === 'ok' ? '#6ee7b7' : '#fca5a5'}`,
          fontWeight: 600, fontSize: 14,
        }}>
          {msg.texto}
        </div>
      )}

      {/* Pipeline — tarjetas de etapa */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {ETAPAS.map(e => {
          const activo = etapaVista === e.key
          return (
            <button
              key={e.key}
              onClick={() => setEtapaVista(e.key)}
              title={e.desc}
              style={{
                flex: '0 0 auto', minWidth: 110,
                padding: '14px 16px', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                border: `2px solid ${activo ? e.color : C.borde}`,
                background: activo ? e.colorBg : '#fff',
                transition: 'all .18s',
                boxShadow: activo ? `0 4px 14px -6px ${e.color}55` : 'none',
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 800, color: e.color, lineHeight: 1.1 }}>
                {conteos[e.key] ?? 0}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: activo ? e.color : C.gris, marginTop: 4 }}>
                {e.label}
              </div>
            </button>
          )
        })}
      </div>

      {/* Lotes activos en "en_lote" */}
      {etapaVista === 'en_lote' && lotes.length > 0 && (
        <div style={{
          marginBottom: 16, background: C.azulClaro,
          border: `1px solid ${C.azul}44`, borderRadius: 10, padding: '12px 16px',
        }}>
          <strong style={{ fontSize: 13, color: C.azulOsc }}>Lotes generados pendientes de descarga:</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {lotes.map(lote => (
              <div key={lote} style={{
                display: 'flex', gap: 8, alignItems: 'center',
                background: '#fff', border: `1px solid ${C.azul}55`, borderRadius: 8,
                padding: '7px 12px', fontSize: 13,
              }}>
                <span style={{ fontWeight: 700, color: C.azulOsc }}>{lote}</span>
                <button
                  onClick={() => handleMarcarBajado(lote)}
                  disabled={loading}
                  style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.naranja}`, color: C.naranjaOsc, background: C.naranjaClaro, cursor: 'pointer', fontWeight: 700 }}
                >
                  Marcar bajado
                </button>
                <button
                  onClick={() => handleDevolver(lote, false)}
                  disabled={loading}
                  style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.alerta}55`, color: C.alerta, background: C.alertaBg, cursor: 'pointer', fontWeight: 700 }}
                >
                  Devolver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Descripción de la etapa */}
      {etapaInfo?.desc && (
        <p style={{ fontSize: 13, color: C.gris, marginBottom: 12 }}>{etapaInfo.desc}</p>
      )}

      {/* Botón avisar todos en con_liga */}
      {etapaVista === 'con_liga' && visibles.length > 0 && (
        <button
          onClick={() => handleAvisar(visibles.map(v => v.id))}
          disabled={loading}
          style={{
            marginBottom: 14, background: C.exito, color: '#fff',
            border: 'none', borderRadius: 8, padding: '9px 18px',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Avisar a todos en esta etapa ({visibles.length})
        </button>
      )}

      {/* Tabla */}
      {!data ? (
        <p style={{ color: C.gris }}>Cargando…</p>
      ) : visibles.length === 0 ? (
        <p style={{ color: C.gris }}>No hay inscripciones en esta etapa.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${C.borde}`, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#FAFAF7' }}>
                <th style={th}>Folio</th>
                <th style={th}>Nombre</th>
                <th style={th}>Email</th>
                <th style={th}>Monto</th>
                {['en_lote','descargado','con_liga','avisado'].includes(etapaVista) && <th style={th}>Lote</th>}
                {['en_lote','descargado','con_liga','avisado'].includes(etapaVista) && <th style={th}>Referencia</th>}
                {etapaVista === 'con_liga' && <th style={th}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {visibles.map((ins, idx) => (
                <tr key={ins.id} style={{ borderBottom: `1px solid ${C.borde}`, background: idx % 2 === 0 ? '#fff' : '#FCFBF8' }}>
                  <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 13, color: C.naranjaOsc }}>{ins.folio}</span></td>
                  <td style={td}>{ins.nombre || '—'}</td>
                  <td style={{ ...td, color: C.gris }}>{ins.email || '—'}</td>
                  <td style={{ ...td, fontWeight: 700, color: C.texto }}>
                    {ins.liga_monto ? `$${Number(ins.liga_monto).toLocaleString('es-MX')}` : '—'}
                  </td>
                  {['en_lote','descargado','con_liga','avisado'].includes(etapaVista) && (
                    <td style={{ ...td, fontSize: 12, color: C.azulOsc, fontWeight: 700 }}>{ins.liga_lote || '—'}</td>
                  )}
                  {['en_lote','descargado','con_liga','avisado'].includes(etapaVista) && (
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: C.naranjaOsc }}>{ins.liga_referencia || '—'}</td>
                  )}
                  {etapaVista === 'con_liga' && (
                    <td style={td}>
                      <button
                        onClick={() => handleAvisar([ins.id])}
                        disabled={loading}
                        style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.exito}`, color: C.exito, background: C.exitoBg, cursor: 'pointer', fontWeight: 700 }}
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
      )}
    </div>
  )
}

const th = {
  padding: '11px 14px', textAlign: 'left', fontWeight: 700,
  fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.03em',
  color: '#6E6258', borderBottom: '1px solid rgba(43,33,24,0.10)', whiteSpace: 'nowrap',
}
const td = { padding: '11px 14px', color: '#2B2118', verticalAlign: 'middle' }
