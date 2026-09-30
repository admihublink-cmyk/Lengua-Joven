const { query } = require('../db/pool')

/**
 * Devuelve los IDs de planteles visibles para el usuario autenticado.
 * Usar en todos los queries que involucren filtros por plantel.
 */
async function getPlantelesVisibles(user) {
  if (user.rol === 'superadmin') {
    const rows = await query('SELECT id FROM planteles WHERE convenio_baja IS NOT TRUE ORDER BY nombre')
    return rows.map(r => r.id)
  }
  if (user.rol === 'coordinador') {
    return user.planteles || []
  }
  if (user.rol === 'tutor') {
    const alumnos = user.alumnos || []
    if (alumnos.length === 0) return []
    const phs = alumnos.map((_, i) => `$${i + 1}`).join(',')
    const rows = await query(
      `SELECT DISTINCT plantel_id FROM usuarios WHERE id IN (${phs}) AND plantel_id IS NOT NULL`,
      alumnos
    )
    return rows.map(r => r.plantel_id)
  }
  if (user.plantel_id) return [user.plantel_id]
  return []
}

/**
 * Verifica si un usuario puede ver/operar sobre un plantel específico.
 * Equivalente a puedeVerPlantel en auth.js pero con soporte a coordinadores multi-plantel.
 */
function puedeOperarEnPlantel(user, plantelId) {
  if (!plantelId) return false
  if (user.rol === 'superadmin') return true
  if (user.rol === 'coordinador') return (user.planteles || []).includes(plantelId)
  return user.plantel_id === plantelId
}

module.exports = { getPlantelesVisibles, puedeOperarEnPlantel }
