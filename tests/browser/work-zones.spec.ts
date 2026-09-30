import { test, expect } from './map-fixture'

// UI contract tests use an in-memory API; production data is never touched.
for (const role of ['ADMIN', 'DIRECTOR', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR']) {
  test(`working zones without reports and editing rights: ${role}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    const sections = [
      { id: 1, objectId: 1, name: 'Офис ИТР', code: 'office', isActive: true, latitude: null, longitude: null, radiusMeters: null },
      { id: 2, objectId: 1, name: 'Прополка', code: 'park', isActive: true, latitude: 51.23, longitude: 51.37, radiusMeters: 150 },
    ]
    let patches = 0
    let rejectSave = true
    await page.addInitScript(() => localStorage.setItem('gp-work_token', 'ui-contract-token'))
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/auth/me')) return route.fulfill({ json: { id: 1, fullName: 'Проверка', username: 'test', role, isActive: true } })
      if (path.endsWith('/sections/1') && route.request().method() === 'PATCH') {
        patches++
        if (rejectSave) return route.fulfill({ status: 403, json: { message: 'Недостаточно прав' } })
        Object.assign(sections[0], route.request().postDataJSON())
        return route.fulfill({ json: sections[0] })
      }
      if (path.endsWith('/objects')) return route.fulfill({ json: [{ id: 1, name: 'Рабочие места', isActive: true }] })
      if (path.endsWith('/sections')) return route.fulfill({ json: sections })
      return route.fulfill({ json: [] })
    })
    await page.goto('/admin/map')
    const zones = page.getByRole('region', { name: 'Рабочие геозоны', exact: true })
    await expect(zones.getByRole('status')).toHaveText('На карте: 1. Без координат: 1.')
    await expect(zones.locator('.work-zone-boundary')).toHaveCount(1)
    await zones.getByLabel('Объект и участок', { exact: true }).selectOption('1')
    const edit = zones.getByRole('button', { name: 'Настроить местоположение участка' })
    if (role === 'ADMIN' || role === 'DIRECTOR') {
      await edit.click()
      await zones.getByLabel('Широта', { exact: true }).fill('51.23')
      await zones.getByLabel('Долгота', { exact: true }).fill('51.37')
      await zones.getByLabel('Радиус, м', { exact: true }).fill('250')
      await zones.getByRole('button', { name: 'Сохранить координаты' }).click()
      await expect(zones.getByRole('alert')).toBeVisible()
      await expect(zones.locator('.work-zone-boundary')).toHaveCount(1)
      rejectSave = false
      await zones.getByRole('button', { name: 'Сохранить координаты' }).click()
      await expect(zones.locator('.work-zone-boundary')).toHaveCount(2)
      await expect(zones.getByText('Радиус: 250 м', { exact: true })).toBeVisible()
      expect(sections[0].code).toBe('office')
      await page.reload()
      await expect(zones.locator('.work-zone-boundary')).toHaveCount(2)
    } else {
      await expect(edit).toHaveCount(0)
      expect(patches).toBe(0)
    }
    expect(errors).toEqual([])
  })
}
