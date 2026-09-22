import { test, expect } from 'playwright/test'

test.skip(process.env.GP_WEB_PRODUCTION !== 'true', 'Runs against the production build and its real service worker')

for (const [index, role] of ['DIRECTOR', 'WORKER'].entries()) {
  test(`${role}: deployed bundle opens section and retains it after PWA reload and login`, async ({ page, context, request }, info) => {
    const ip = `10.56.${info.project.name.startsWith('mobile') ? 2 : 1}.${index + 1}`
    await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
    const api = 'http://localhost:3002/api'
    const auth = await request.post(`${api}/auth/login`, { headers: { 'X-Forwarded-For': ip }, data: {
      username: process.env.ADMIN_USERNAME || 'e2e-admin', password: process.env.ADMIN_PASSWORD || 'e2e-admin-password',
    } })
    expect(auth.ok()).toBeTruthy()
    const headers = { Authorization: `Bearer ${(await auth.json()).accessToken}`, 'X-Forwarded-For': ip }
    const create = async (path: string, data: unknown) => {
      const result = await request.post(`${api}${path}`, { headers, data })
      expect(result.ok(), await result.text()).toBeTruthy()
      return result.json()
    }
    const suffix = `${Date.now()}-${role}-${info.project.name}`
    const password = 'production-form-test-password'
    const user = await create('/users', { fullName: `Production form ${suffix}`, username: `prod-form-${suffix}`, role, password })
    const object = await create('/objects', { name: `Production object ${suffix}` })
    const section = await create('/sections', { objectId: object.id, name: `Production section ${suffix}`,
      latitude: 51.2301, longitude: 51.3701, radiusMeters: 150 })
    const signIn = async () => {
      await page.getByLabel('Логин', { exact: true }).fill(user.username)
      await page.getByLabel('Пароль', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Войти', exact: true }).click()
    }
    await page.goto(role === 'DIRECTOR' ? '/admin/objects' : `/work-form/${section.code}/`)
    await signIn()
    if (role === 'DIRECTOR') {
      await page.getByRole('row').filter({ has: page.getByRole('cell', { name: section.name, exact: true }) })
        .getByRole('link', { name: 'открыть', exact: true }).click()
    }
    await expect(page).toHaveURL(new RegExp(`/field/scan/${section.code}$`))
    await expect(page.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
    expect(context.pages()).toHaveLength(1)
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '')).toContain('/sw.js')
    await page.reload()
    await expect(page.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
    const start = page.getByRole('button', { name: 'Начать рабочий день', exact: true })
    if (role === 'DIRECTOR') await expect(start).toBeDisabled()
    else await expect(start).toBeEnabled()
    await page.getByRole('button', { name: 'Выйти', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await signIn()
    await expect(page).toHaveURL(new RegExp(`/field/scan/${section.code}$`))
    await expect(page.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath('production-section-form.png'), fullPage: true })
  })
}
