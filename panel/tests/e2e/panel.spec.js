import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin@injuve.mx'
const ADMIN_PASS  = process.env.ADMIN_PASS  || 'TempPass2024!'

// Helper: login y esperar panel
async function loginAdmin(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.getByPlaceholder('usuario@injuve.mx').fill(ADMIN_EMAIL)
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASS)
  await page.getByRole('button', { name: 'Iniciar sesión' }).last().click()
  await page.waitForTimeout(3000) // esperar carga del panel
}

test.describe('Panel — navegación post-login', () => {
  test('muestra panel tras login exitoso', async ({ page }) => {
    await loginAdmin(page)
    // El panel debe mostrar algún elemento de navegación
    await expect(page.getByText(/Usuarios|Planteles|Dashboard|Grupos/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('sección Usuarios accesible', async ({ page }) => {
    await loginAdmin(page)
    await page.locator('.nav-item', { hasText: /Usuarios/ }).click()
    await expect(page.getByText(/usuarios|correo|rol/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('sección Planteles accesible', async ({ page }) => {
    await loginAdmin(page)
    await page.locator('.nav-item', { hasText: /Planteles/ }).click()
    await expect(page.getByText(/convenio|plantel/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('sección Legal y ARCO carga sin error', async ({ page }) => {
    await loginAdmin(page)
    await page.locator('.nav-item', { hasText: /Legal/ }).click()
    await expect(page.getByText(/ARCO|solicitud/i).first()).toBeVisible({ timeout: 10000 })
    // No debe mostrar "error interno"
    await expect(page.getByText(/error interno/i)).not.toBeVisible()
  })

  test('tab Avisos de privacidad carga el aviso', async ({ page }) => {
    await loginAdmin(page)
    await page.locator('.nav-item', { hasText: /Legal/ }).click()
    await page.getByText(/Avisos de privacidad/i).click()
    await expect(page.getByText(/Aviso de Privacidad|Vigente|Inactivo/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/error interno/i)).not.toBeVisible()
  })
})
