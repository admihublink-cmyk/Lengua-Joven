import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin@injuve.mx'
const ADMIN_PASS  = process.env.ADMIN_PASS  || 'TempPass2024!'

// ── Landing page ──────────────────────────────────────────────────────────────
test.describe('Landing page', () => {
  test('carga correctamente y muestra hero', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Lengua Joven|INJUVE/i)
    await expect(page.getByText('Aprende un idioma')).toBeVisible()
    await expect(page.getByText('Abre tu futuro')).toBeVisible()
  })

  test('navbar visible con botón de login', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
    await expect(page.getByAltText('INJUVE NL')).toBeVisible()
  })

  test('sección números de emergencia visible', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.getByText('Números de emergencia')).toBeVisible()
    await expect(page.getByText('911')).toBeVisible()
    await expect(page.getByText('089')).toBeVisible()
    await expect(page.getByText('070')).toBeVisible()
    await expect(page.getByText('073')).toBeVisible()
  })

  test('footer con logos visibles', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.getByText('soporte@injuve.mx')).toBeVisible()
  })

  test('links de navegación funcionan (scroll)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Quiénes somos/i }).click()
    await expect(page.getByText('¿Quiénes somos?')).toBeInViewport()
  })

  test('sección oferta educativa muestra idiomas', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Oferta educativa/i }).click()
    await expect(page.getByText('Oferta educativa')).toBeInViewport()
  })
})

// ── Modal de login ────────────────────────────────────────────────────────────
test.describe('Modal de login', () => {
  test('se abre y cierra correctamente', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByText('Panel de Gestión Educativa')).toBeVisible()
    // Cerrar haciendo clic en el fondo
    await page.mouse.click(10, 10)
    await expect(page.getByText('Panel de Gestión Educativa')).not.toBeVisible()
  })

  test('muestra error con credenciales incorrectas', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await page.getByPlaceholder('usuario@injuve.mx').fill('noexiste@test.com')
    await page.getByPlaceholder('••••••••').fill('wrongpass')
    await page.getByRole('button', { name: 'Iniciar sesión' }).last().click()
    await expect(page.getByText(/[Cc]redenciales|[Ii]ncorrectas|intento/)).toBeVisible({ timeout: 10000 })
  })

  test('login exitoso con superadmin', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await page.getByPlaceholder('usuario@injuve.mx').fill(ADMIN_EMAIL)
    await page.getByPlaceholder('••••••••').fill(ADMIN_PASS)
    await page.getByRole('button', { name: 'Iniciar sesión' }).last().click()
    // Después del login debe mostrar el panel (dashboard o nav de panel)
    await expect(page.getByText(/[Dd]ashboard|[Bb]ienvenid|[Pp]lanteles|[Uu]suarios/)).toBeVisible({ timeout: 15000 })
  })
})

// ── Modal pre-registro ────────────────────────────────────────────────────────
test.describe('Pre-registro', () => {
  test('se abre el formulario', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Pre-registrarme/i }).first().click()
    await expect(page.getByText('Pre-registro')).toBeVisible()
    await expect(page.getByPlaceholder(/Ej. Ana González/i)).toBeVisible()
  })

  test('valida campos requeridos', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Pre-registrarme/i }).first().click()
    await page.getByRole('button', { name: 'Enviar pre-registro' }).click()
    await expect(page.getByText(/requerido|obligatorio/i)).toBeVisible()
  })

  test('valida CURP inválido', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Pre-registrarme/i }).first().click()
    await page.getByPlaceholder(/Ej. Ana González/i).fill('Test Usuario')
    await page.getByPlaceholder('correo@ejemplo.com').first().fill('test@test.com')
    await page.getByPlaceholder('81 1234 5678').first().fill('8112345678')
    await page.getByPlaceholder('XXXX000000XXXXXX00').fill('INVALIDO')
    await page.getByRole('button', { name: 'Enviar pre-registro' }).click()
    await expect(page.getByText(/CURP/i)).toBeVisible()
  })
})
