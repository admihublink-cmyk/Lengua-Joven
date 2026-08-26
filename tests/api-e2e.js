#!/usr/bin/env node
/**
 * API E2E Tests — Lengua Joven
 * Uso: node tests/api-e2e.js
 * Variables de entorno opcionales:
 *   API_URL   — base URL del backend (default: https://lengua-joven.onrender.com)
 *   ADMIN_EMAIL / ADMIN_PASS — credenciales del superadmin
 */

const API = process.env.API_URL || 'https://lengua-joven.onrender.com'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin@injuve.mx'
const ADMIN_PASS  = process.env.ADMIN_PASS  || 'TempPass2024!'

let passed = 0
let failed = 0
let cookie = ''

function log(ok, name, detail = '') {
  const mark = ok ? '✅' : '❌'
  if (ok) passed++; else failed++
  console.log(`  ${mark} ${name}${detail ? '  →  ' + detail : ''}`)
}

async function get(path, authed = false) {
  const headers = authed && cookie ? { Cookie: cookie } : {}
  const r = await fetch(`${API}${path}`, { headers })
  return { status: r.status, body: await r.json().catch(() => null) }
}

async function post(path, body, authed = false) {
  const headers = { 'Content-Type': 'application/json', ...(authed && cookie ? { Cookie: cookie } : {}) }
  const r = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  // Node 18+ puede usar getSetCookie(), fallback a get()
  const cookies = r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie')].filter(Boolean)
  if (cookies.length) cookie = cookies.map(c => c.split(';')[0]).join('; ')
  return { status: r.status, body: await r.json().catch(() => null) }
}

async function run() {
  console.log(`\n🔍 Lengua Joven — API E2E Tests`)
  console.log(`   Base URL: ${API}\n`)

  // ── 1. SALUD ─────────────────────────────────────────────────────────────
  console.log('[ Health ]')
  const health = await get('/api/health')
  log(health.status === 200 && health.body?.ok, 'GET /api/health', `status ${health.status}`)

  // ── 2. ENDPOINTS PÚBLICOS ─────────────────────────────────────────────────
  console.log('\n[ Endpoints públicos ]')
  const planteles = await get('/api/publico/planteles')
  log(planteles.status === 200 && Array.isArray(planteles.body), 'GET /api/publico/planteles', `${planteles.body?.length ?? '?'} planteles`)

  const idiomas = await get('/api/publico/idiomas')
  log(idiomas.status === 200 && Array.isArray(idiomas.body), 'GET /api/publico/idiomas', `${idiomas.body?.length ?? '?'} idiomas`)

  const aviso = await get('/api/publico/aviso-privacidad')
  log(aviso.status === 200 && aviso.body?.id, 'GET /api/publico/aviso-privacidad', aviso.body?.nombre || 'sin nombre')

  // Endpoint sin auth debe dar 403 o 401
  const noAuth = await get('/api/usuarios')
  log(noAuth.status === 401 || noAuth.status === 403, 'GET /api/usuarios (sin auth) → debe rechazar', `status ${noAuth.status}`)

  // ── 3. AUTENTICACIÓN ──────────────────────────────────────────────────────
  console.log('\n[ Autenticación ]')
  const badLogin = await post('/api/auth/login', { email: 'noexiste@test.com', password: 'wrong' })
  log(badLogin.status === 401, 'POST /api/auth/login (credenciales incorrectas)', `status ${badLogin.status}`)

  const goodLogin = await post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS })
  const loginOk = goodLogin.status === 200 && goodLogin.body?.user?.rol === 'superadmin'
  log(loginOk, 'POST /api/auth/login (superadmin)', `status ${goodLogin.status} | rol: ${goodLogin.body?.user?.rol ?? goodLogin.body?.error ?? 'sin respuesta'}`)
  if (!cookie) console.log('  ⚠️  Sin cookie — verifica credenciales con ADMIN_PASS=tuPass node tests/api-e2e.js\n')

  // ── 4. ENDPOINTS AUTENTICADOS ─────────────────────────────────────────────
  console.log('\n[ Endpoints autenticados ]')
  const usuarios = await get('/api/usuarios', true)
  log(usuarios.status === 200 && Array.isArray(usuarios.body), 'GET /api/usuarios', `${usuarios.body?.length ?? '?'} usuarios`)

  const plantelesAuth = await get('/api/planteles', true)
  log(plantelesAuth.status === 200, 'GET /api/planteles', `status ${plantelesAuth.status}`)

  const legal = await get('/api/legal', true)
  log(legal.status === 200 && legal.body?.rows !== undefined, 'GET /api/legal (solicitudes ARCO)', `${legal.body?.rows?.length ?? '?'} solicitudes`)

  const avisos = await get('/api/legal/avisos', true)
  log(avisos.status === 200 && Array.isArray(avisos.body?.rows), 'GET /api/legal/avisos', `${avisos.body?.rows?.length ?? '?'} avisos`)

  const auditoria = await get('/api/convenios/auditoria', true)
  log(auditoria.status === 200 && Array.isArray(auditoria.body), 'GET /api/convenios/auditoria', `${auditoria.body?.length ?? '?'} entradas`)

  // ── 5. RATE LIMITING ──────────────────────────────────────────────────────
  console.log('\n[ Rate limiting ]')
  const rlPromises = Array.from({ length: 35 }, () => get('/api/publico/idiomas'))
  const rlResults = await Promise.all(rlPromises)
  const got429 = rlResults.some(r => r.status === 429)
  log(got429, 'Rate limit público (30/min) — 35 req simultáneas → debe dar 429')

  // ── 6. LOGOUT ─────────────────────────────────────────────────────────────
  console.log('\n[ Logout ]')
  const logout = await post('/api/auth/logout', {}, true)
  log(logout.status === 200 && logout.body?.ok, 'POST /api/auth/logout')

  const afterLogout = await get('/api/usuarios', true)
  log(afterLogout.status === 401 || afterLogout.status === 403, 'GET /api/usuarios después de logout → debe rechazar', `status ${afterLogout.status}`)

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(48)}`)
  console.log(`  Resultado: ${passed} pasaron, ${failed} fallaron de ${passed + failed} pruebas`)
  if (failed === 0) console.log('  🎉 Todo en orden!\n')
  else console.log('  ⚠️  Revisa los ❌ arriba.\n')

  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error('Error inesperado:', e); process.exit(1) })
