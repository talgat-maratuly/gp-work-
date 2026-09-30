import { test, expect } from './map-fixture'

test('maps stay under the mobile menu and unmount across back and forward navigation', async ({ page, request }, info) => {
  const ip = '10.30.0.48'
  await page.context().setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
  const auth = await request.post('http://localhost:3002/api/auth/login', { headers: { 'X-Forwarded-For': ip }, data: {
    username: process.env.ADMIN_USERNAME || 'e2e-admin', password: process.env.ADMIN_PASSWORD || 'e2e-admin-password',
  } })
  expect(auth.ok()).toBeTruthy()
  const director = `map-director-${Date.now()}-${info.project.name}`
  const password = 'map-menu-browser-password'
  const created = await request.post('http://localhost:3002/api/users', { headers: { Authorization: `Bearer ${(await auth.json()).accessToken}`, 'X-Forwarded-For': ip },
    data: { username: director, fullName: 'Директор карты', password, role: 'DIRECTOR' } })
  expect(created.ok()).toBeTruthy()
  // A stable report fixture ensures that the work map exists even on an empty DB.
  // This regression tests Leaflet layering/navigation; report persistence has its own API tests.
  await page.route(/\/api\/work-logs(?:\?.*)?$/, route => route.fulfill({ json: [{
    id: 990001, latitude: 51.23, longitude: 51.37, workerFullName: 'Проверка карты',
    submittedAt: '2026-09-30T10:00:00Z', photoUrls: [], workVolume: '1',
  }] }))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/admin/warehouse')
  await page.getByLabel('Логин', { exact: true }).fill(director)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Склад', exact: true })).toBeVisible()
  const mobile = info.project.name.startsWith('mobile')
  const menu = page.getByRole('complementary', { name: 'Меню GP Work', exact: true })
  async function navigate(name: string) {
    const href = ({ 'Карта': '/admin/map', 'Диспетчерская': '/admin/dispatcher', 'Склад': '/admin/warehouse' } as Record<string, string>)[name]
    if (mobile) {
      await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
      await menu.locator(`a[href="${href}"]`).click()
    } else await page.locator(`aside:visible a[href="${href}"]`).click()
  }
  for (const name of ['Карта', 'Диспетчерская']) {
    await navigate(name)
    const map = page.locator('.leaflet-container')
    await expect(map).toHaveCount(1)
    await map.scrollIntoViewIfNeeded()
    await expect(map.locator('.leaflet-tile-loaded').first()).toBeVisible()
    if (mobile) {
      await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
      await expect(menu).toBeVisible()
      const aboveMap = await map.evaluate(element => {
        const rect = element.getBoundingClientRect()
        const y = (Math.max(rect.top, 220) + Math.min(rect.bottom, innerHeight - 20)) / 2
        return [100, innerWidth - 25].map(x => {
          const top = document.elementFromPoint(x, y)
          const overlay = document.querySelector('aside[aria-label="Меню GP Work"]')?.parentElement
          return !!top && !!overlay?.contains(top) && !element.contains(top)
        })
      })
      expect(aboveMap).toEqual([true, true])
      await page.screenshot({ path: info.outputPath(`map-menu-${name}.png`), fullPage: false })
      await menu.getByRole('button', { name: 'Закрыть меню', exact: true }).click()
    }
    await navigate('Склад')
    await expect(page.getByRole('heading', { name: 'Склад', exact: true })).toBeVisible()
    await expect(map).toHaveCount(0)
    await page.goBack()
    await expect(map).toHaveCount(1)
    await page.goForward()
    await expect(map).toHaveCount(0)
  }
  expect(errors).toEqual([])
})
